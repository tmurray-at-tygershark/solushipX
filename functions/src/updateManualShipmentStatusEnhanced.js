const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

// Import shipment events utility
const { recordShipmentEvent, EVENT_TYPES, EVENT_SOURCES } = require('./utils/shipmentEvents');

const db = getFirestore();

/**
 * Enhanced Cloud Function to manually override shipment status using the dynamic status system
 * This function works with master statuses and sub-statuses from the database
 */
exports.updateManualShipmentStatusEnhanced = onCall({
    cors: true,
    enforceAppCheck: false
}, async (request) => {
    try {
        const { shipmentId, masterStatusId, subStatusId, reason, timestamp } = request.data;
        const { auth } = request;

        // Validate authentication
        if (!auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        // Validate required parameters
        if (!shipmentId || !masterStatusId) {
            throw new HttpsError('invalid-argument', 'Missing required parameters: shipmentId and masterStatusId');
        }

        logger.info(`Enhanced manual status override requested for shipment ${shipmentId}`, {
            shipmentId,
            masterStatusId,
            subStatusId,
            userId: auth.uid,
            reason
        });

        // Get shipment document reference
        const shipmentRef = db.collection('shipments').doc(shipmentId);
        const shipmentDoc = await shipmentRef.get();

        if (!shipmentDoc.exists) {
            throw new HttpsError('not-found', `Shipment not found: ${shipmentId}`);
        }

        const shipmentData = shipmentDoc.data();

        // Get master status data
        const masterStatusDoc = await db.collection('masterStatuses').doc(masterStatusId).get();
        if (!masterStatusDoc.exists) {
            throw new HttpsError('not-found', `Master status not found: ${masterStatusId}`);
        }
        const masterStatusData = masterStatusDoc.data();

        // Get sub-status data if provided
        let subStatusData = null;
        if (subStatusId) {
            const subStatusDoc = await db.collection('shipmentStatuses').doc(subStatusId).get();
            if (!subStatusDoc.exists) {
                throw new HttpsError('not-found', `Sub-status not found: ${subStatusId}`);
            }
            subStatusData = subStatusDoc.data();
            
            // Verify sub-status belongs to the master status
            if (subStatusData.masterStatus !== masterStatusId) {
                throw new HttpsError('invalid-argument', 'Sub-status does not belong to the selected master status');
            }
        }

        // Create the new status object for the shipment
        const newStatusObject = {
            masterStatus: {
                id: masterStatusId,
                label: masterStatusData.label,
                displayLabel: masterStatusData.displayLabel,
                color: masterStatusData.color,
                fontColor: masterStatusData.fontColor
            }
        };

        if (subStatusData) {
            newStatusObject.subStatus = {
                id: subStatusId,
                statusLabel: subStatusData.statusLabel,
                statusCode: subStatusData.statusCode,
                statusMeaning: subStatusData.statusMeaning
            };
        }

        // Create status override data for enhanced system
        const statusOverrideEnhanced = {
            isManual: true,
            overriddenBy: auth.uid,
            overriddenAt: admin.firestore.FieldValue.serverTimestamp(),
            originalStatus: shipmentData.status,
            originalStatusEnhanced: shipmentData.statusEnhanced || null,
            newStatusEnhanced: newStatusObject,
            reason: reason || 'Manual status override (Enhanced)',
            preventAutoUpdates: true,
            systemVersion: 'enhanced_v2'
        };

        // For backward compatibility, also set a legacy status
        const legacyStatus = masterStatusData.label; // Use master status label as legacy status

        // Create audit trail entry
        const auditEntry = {
            shipmentId,
            action: 'enhanced_manual_status_override',
            userId: auth.uid,
            userEmail: auth.token?.email || 'unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            changes: {
                field: 'statusEnhanced',
                oldValue: shipmentData.statusEnhanced || null,
                newValue: newStatusObject,
                legacyStatus: legacyStatus
            },
            metadata: {
                reason: reason || 'Manual status override (Enhanced)',
                clientTimestamp: timestamp,
                source: 'enhanced_manual_override',
                masterStatusLabel: masterStatusData.displayLabel,
                subStatusLabel: subStatusData?.statusLabel || null
            }
        };

        // Prepare status history entry
        const statusHistoryEntry = {
            statusEnhanced: newStatusObject,
            status: legacyStatus, // Also update legacy status for compatibility
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            source: 'enhanced_manual_override',
            description: subStatusData ? 
                `Status manually changed to ${masterStatusData.displayLabel}: ${subStatusData.statusLabel}` :
                `Status manually changed to ${masterStatusData.displayLabel}`,
            updatedBy: auth.uid,
            reason: reason || 'Manual status override (Enhanced)'
        };

        // Batch write to ensure atomicity
        const batch = db.batch();

        // Update shipment document with enhanced status
        batch.update(shipmentRef, {
            status: legacyStatus, // Maintain backward compatibility
            statusEnhanced: newStatusObject, // New enhanced status structure
            statusOverrideEnhanced,
            statusLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            statusUpdateSource: 'enhanced_manual_override',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Add audit trail entry
        const auditRef = db.collection('auditTrail').doc();
        batch.set(auditRef, auditEntry);

        // Add status history entry
        const statusHistoryRef = shipmentRef.collection('statusHistory').doc();
        batch.set(statusHistoryRef, statusHistoryEntry);

        // Execute the batch
        await batch.commit();

        // Record enhanced status override event in shipment timeline
        try {
            const statusDescription = subStatusData ? 
                `${masterStatusData.displayLabel}: ${subStatusData.statusLabel}` :
                masterStatusData.displayLabel;

            await recordShipmentEvent(
                shipmentId,
                EVENT_TYPES.STATUS_UPDATE,
                `Status Manually Updated: ${statusDescription}`,
                `Status manually changed to "${statusDescription}"${reason ? `. Reason: ${reason}` : ""}`,
                EVENT_SOURCES.USER,
                {
                    email: auth.token?.email || 'unknown',
                    userId: auth.uid,
                    userName: auth.token?.name || auth.token?.email?.split('@')[0] || 'Unknown User'
                },
                {
                    statusChange: {
                        from: shipmentData.statusEnhanced || shipmentData.status,
                        to: newStatusObject,
                        reason: reason || 'Manual status override (Enhanced)'
                    },
                    isManualOverride: true,
                    isEnhancedStatus: true,
                    overrideReason: reason
                }
            );
            logger.info(`Recorded enhanced manual status override event for shipment ${shipmentId}`);
        } catch (eventError) {
            logger.error('Error recording enhanced manual status override event:', eventError);
            // Don't fail the main operation if event recording fails
        }

        logger.info(`Enhanced manual status override completed for shipment ${shipmentId}`, {
            shipmentId,
            previousStatus: shipmentData.statusEnhanced || shipmentData.status,
            newStatus: newStatusObject,
            userId: auth.uid,
            reason
        });

        // Return success response
        return {
            success: true,
            message: `Status manually updated to ${subStatusData ? 
                `${masterStatusData.displayLabel}: ${subStatusData.statusLabel}` :
                masterStatusData.displayLabel}`,
            statusChanged: true,
            shipmentId,
            previousStatus: shipmentData.statusEnhanced || shipmentData.status,
            newStatusEnhanced: newStatusObject,
            legacyStatus: legacyStatus,
            overriddenBy: auth.uid,
            overriddenAt: timestamp || new Date().toISOString(),
            auditTrailId: auditRef.id
        };

    } catch (error) {
        logger.error('Error in updateManualShipmentStatusEnhanced:', error);
        
        // Re-throw HttpsError instances as-is
        if (error instanceof HttpsError) {
            throw error;
        }
        
        // Convert other errors to HttpsError
        throw new HttpsError('internal', `Failed to update enhanced manual status: ${error.message}`);
    }
});

/**
 * Helper function to check if a shipment has enhanced manual status override
 */
function hasEnhancedManualStatusOverride(shipmentData) {
    return shipmentData?.statusOverrideEnhanced?.isManual === true && 
           shipmentData?.statusOverrideEnhanced?.preventAutoUpdates === true;
}

/**
 * Helper function to get the effective enhanced status of a shipment
 */
function getEffectiveEnhancedStatus(shipmentData) {
    if (hasEnhancedManualStatusOverride(shipmentData)) {
        return shipmentData.statusOverrideEnhanced.newStatusEnhanced || shipmentData.statusEnhanced;
    }
    return shipmentData.statusEnhanced || shipmentData.status;
}

module.exports = {
    updateManualShipmentStatusEnhanced: exports.updateManualShipmentStatusEnhanced,
    hasEnhancedManualStatusOverride,
    getEffectiveEnhancedStatus
}; 