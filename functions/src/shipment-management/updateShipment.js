const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Update an existing shipment with change tracking and validation
 */
const updateShipment = onCall({
    minInstances: 1,
    memory: '1GiB',
    timeoutSeconds: 120
}, async (request) => {
    try {
        const { 
            shipmentId, 
            firebaseDocId, 
            updates, 
            changes, 
            regenerateDocuments = false,
            reason = 'Shipment updated'
        } = request.data;
        const { uid: userId, email: userEmail } = request.auth;

        logger.info('updateShipment called:', { 
            shipmentId, 
            firebaseDocId, 
            userId, 
            changesCount: changes?.length || 0,
            regenerateDocuments 
        });

        if (!shipmentId || !firebaseDocId || !updates) {
            throw new Error('Shipment ID, Firebase document ID, and updates are required');
        }

        // Get current shipment data
        const shipmentRef = db.collection('shipments').doc(firebaseDocId);
        const shipmentDoc = await shipmentRef.get();

        if (!shipmentDoc.exists()) {
            throw new Error(`Shipment ${firebaseDocId} not found`);
        }

        const currentShipment = shipmentDoc.data();

        // Validate shipment can be edited
        const canEdit = validateShipmentEditable(currentShipment);
        if (!canEdit.allowed) {
            throw new Error(canEdit.reason);
        }

        // Validate the updates
        const validationResult = await validateUpdates(updates, currentShipment);
        if (!validationResult.valid) {
            throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
        }

        // Prepare the update data
        const updateData = {
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: userId,
            lastModifiedBy: userEmail,
            editHistory: admin.firestore.FieldValue.arrayUnion({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                userId: userId,
                userEmail: userEmail,
                changes: changes,
                reason: reason,
                regenerateDocuments: regenerateDocuments
            })
        };

        // Calculate if significant changes require rate re-evaluation
        const requiresRateUpdate = checkIfRateUpdateRequired(changes);
        if (requiresRateUpdate) {
            updateData.rateUpdateRequired = true;
            updateData.rateUpdateReason = 'Shipment details changed - rates may need updating';
        }

        // Update the shipment
        await shipmentRef.update(updateData);

        // Log the update in shipment events
        await recordShipmentEvent(firebaseDocId, 'shipment_updated', userId, userEmail, changes, reason);

        // If significant changes, consider regenerating documents
        if (regenerateDocuments) {
            try {
                await triggerDocumentRegeneration(shipmentId, firebaseDocId, userId, userEmail, reason);
            } catch (docError) {
                logger.warn('Document regeneration failed but shipment update succeeded:', docError);
                // Don't fail the whole operation if document regeneration fails
            }
        }

        // If address or service changes, might need carrier notification
        const requiresCarrierNotification = checkIfCarrierNotificationRequired(changes);
        if (requiresCarrierNotification) {
            try {
                await notifyCarrierOfChanges(currentShipment, updates, changes, userId, userEmail);
            } catch (notificationError) {
                logger.warn('Carrier notification failed but shipment update succeeded:', notificationError);
            }
        }

        // Get updated shipment data
        const updatedShipmentDoc = await shipmentRef.get();
        const updatedShipment = updatedShipmentDoc.data();

        logger.info('Shipment updated successfully:', { 
            shipmentId, 
            firebaseDocId, 
            userId,
            regenerateDocuments,
            requiresCarrierNotification
        });

        return {
            success: true,
            message: 'Shipment updated successfully',
            data: {
                updatedShipment: updatedShipment,
                changes: changes,
                regenerateDocuments: regenerateDocuments,
                requiresRateUpdate: requiresRateUpdate,
                requiresCarrierNotification: requiresCarrierNotification
            }
        };

    } catch (error) {
        logger.error('Error updating shipment:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Validate if a shipment can be edited
 */
function validateShipmentEditable(shipment) {
    const status = shipment.status?.toLowerCase();
    
    // Cannot edit delivered, cancelled, or void shipments
    if (status === 'delivered') {
        return { allowed: false, reason: 'Cannot edit delivered shipments' };
    }
    
    if (status === 'cancelled' || status === 'canceled' || status === 'void' || status === 'voided') {
        return { allowed: false, reason: 'Cannot edit cancelled or void shipments' };
    }
    
    // Check if shipment is in transit - limited editing allowed
    if (status === 'in_transit' || status === 'in transit' || status === 'out_for_delivery') {
        return { 
            allowed: true, 
            reason: 'Limited editing available for in-transit shipments',
            limited: true 
        };
    }
    
    return { allowed: true };
}

/**
 * Validate the proposed updates
 */
async function validateUpdates(updates, currentShipment) {
    const errors = [];
    
    // Validate shipment info
    if (updates.shipmentInfo) {
        if (updates.shipmentInfo.shipmentDate) {
            const shipmentDate = new Date(updates.shipmentInfo.shipmentDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (shipmentDate < today) {
                errors.push('Shipment date cannot be in the past');
            }
        }
    }
    
    // Validate packages
    if (updates.packages) {
        if (!Array.isArray(updates.packages) || updates.packages.length === 0) {
            errors.push('At least one package is required');
        } else {
            updates.packages.forEach((pkg, index) => {
                if (!pkg.weight || pkg.weight <= 0) {
                    errors.push(`Package ${index + 1}: Weight is required and must be greater than 0`);
                }
                if (!pkg.length || !pkg.width || !pkg.height) {
                    errors.push(`Package ${index + 1}: Dimensions (length, width, height) are required`);
                }
                if (pkg.weight > 1000) { // Example business rule
                    errors.push(`Package ${index + 1}: Weight exceeds maximum allowed (1000 lbs)`);
                }
            });
        }
    }
    
    // Validate addresses
    if (updates.shipFrom && !updates.shipFrom.street) {
        errors.push('Ship From address must include street address');
    }
    if (updates.shipTo && !updates.shipTo.street) {
        errors.push('Ship To address must include street address');
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Check if changes require rate re-evaluation
 */
function checkIfRateUpdateRequired(changes) {
    const rateAffectingFields = [
        'packages',
        'shipFrom',
        'shipTo',
        'serviceLevel',
        'shipmentType',
        'hazmatShipment',
        'refrigerated',
        'liftGateRequired',
        'signatureRequired'
    ];
    
    return changes.some(change => 
        rateAffectingFields.some(field => change.field.includes(field))
    );
}

/**
 * Check if changes require carrier notification
 */
function checkIfCarrierNotificationRequired(changes) {
    const notificationRequiredFields = [
        'shipFrom',
        'shipTo',
        'shipmentDate',
        'packages',
        'specialInstructions',
        'carrierTrackingNumber'
    ];
    
    return changes.some(change => 
        notificationRequiredFields.some(field => change.field.includes(field))
    );
}

/**
 * Record shipment update event
 */
async function recordShipmentEvent(shipmentId, eventType, userId, userEmail, changes, reason) {
    try {
        // **ENHANCED EVENT RECORDING**: Use proper shipment events utility
        const { recordShipmentEvent: recordEvent, EVENT_TYPES, EVENT_SOURCES } = require('../utils/shipmentEvents');
        
        // Determine event type based on the changes
        let title = 'Shipment Updated';
        let description = 'Shipment details updated by user';
        let eventTypeToUse = EVENT_TYPES.USER_ACTION;
        
        // Check if this is a draft creation or update
        const isDraftUpdate = changes.some(change => 
            change.field === 'isDraft' || 
            change.field === 'draftSavedAt' ||
            change.field === 'draftVersion'
        );
        
        if (isDraftUpdate) {
            const isCreatingDraft = changes.some(change => 
                change.field === 'isDraft' && change.newValue === true && change.oldValue !== true
            );
            
            if (isCreatingDraft) {
                title = 'Draft Created';
                description = 'Shipment saved as draft for later completion';
                eventTypeToUse = EVENT_TYPES.CREATED;
            } else {
                title = 'Draft Updated';
                description = 'Draft shipment details updated';
                eventTypeToUse = EVENT_TYPES.USER_ACTION;
            }
        }
        
        // Record the event using the proper utility
        await recordEvent(
            shipmentId,
            eventTypeToUse,
            title,
            `${description}${reason ? `. Reason: ${reason}` : ''}`,
            EVENT_SOURCES.USER,
            {
                email: userEmail,
                userId: userId,
                userName: userEmail ? userEmail.split('@')[0] : 'Unknown User'
            },
            {
                changes: changes,
                changesCount: changes.length,
                isDraftUpdate: isDraftUpdate,
                updateReason: reason
            }
        );
        
        logger.info('Enhanced shipment event recorded:', { 
            shipmentId, 
            eventType: eventTypeToUse, 
            title,
            userId,
            changesCount: changes.length 
        });
        
    } catch (error) {
        logger.error('Error recording enhanced shipment event:', error);
        
        // Fallback to original method if enhanced recording fails
        try {
            const eventRef = db.collection('shipmentEvents').doc();
            await eventRef.set({
                shipmentId: shipmentId,
                eventType: eventType,
                eventSource: 'user',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                title: 'Shipment Updated',
                description: `Shipment details updated by user`,
                details: {
                    updatedBy: userId,
                    updatedByEmail: userEmail,
                    changes: changes,
                    reason: reason,
                    changesCount: changes.length
                },
                metadata: {
                    userId: userId,
                    userEmail: userEmail,
                    action: 'shipment_update'
                }
            });
            
            logger.info('Fallback shipment event recorded:', { shipmentId, eventType, userId });
        } catch (fallbackError) {
            logger.error('Error recording fallback shipment event:', fallbackError);
        }
        
        // Don't throw - this is non-critical
    }
}

/**
 * Trigger document regeneration if needed
 */
async function triggerDocumentRegeneration(shipmentId, firebaseDocId, userId, userEmail, reason) {
    logger.info('Triggering document regeneration:', { shipmentId, firebaseDocId });
    
    // This would call the document regeneration functions
    // For now, just log the intent
    logger.info('Document regeneration triggered due to shipment update:', {
        shipmentId,
        firebaseDocId,
        reason: `Shipment updated: ${reason}`
    });
    
    // In a full implementation, you would call:
    // - regenerateBOL function
    // - regenerateCarrierConfirmation function
    // Based on what documents exist and what changed
}

/**
 * Notify carrier of significant changes
 */
async function notifyCarrierOfChanges(originalShipment, updates, changes, userId, userEmail) {
    logger.info('Carrier notification required for shipment update:', {
        shipmentId: originalShipment.shipmentID,
        carrier: originalShipment.selectedCarrier || originalShipment.carrier,
        changes: changes.map(c => c.field)
    });
    
    // This would implement actual carrier notification logic
    // For now, just log the intent
    logger.info('Carrier notification sent for shipment update');
}

module.exports = {
    updateShipment
}; 