const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

const db = admin.firestore();

/**
 * Approve charges with finalized values
 * Enhanced approval function that applies calculated final charge values during approval
 */
const approveChargesWithFinalValues = onCall({
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 120
}, async (request) => {
    try {
        const { 
            shipmentIds, 
            finalizedCharges = [],
            approvalType = 'bulk',
            overrideExceptions = false,
            approvalNotes = ''
        } = request.data;
        
        const userId = request.auth?.uid;
        const userEmail = request.auth?.email;

        if (!userId) {
            throw new Error('Authentication required');
        }

        if (!shipmentIds || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
            throw new Error('Shipment IDs array is required');
        }

        logger.info('✅ Approving charges with finalized values', {
            shipmentCount: shipmentIds.length,
            finalizedChargesCount: finalizedCharges.length,
            approvalType,
            overrideExceptions,
            userId
        });

        const results = [];
        const errors = [];

        // Process each shipment with finalized values
        for (const shipmentId of shipmentIds) {
            try {
                // Find corresponding finalized charge data
                const finalizedCharge = finalizedCharges.find(fc => 
                    fc.shipmentId === shipmentId || fc.id === shipmentId
                );

                const result = await processShipmentApprovalWithFinalValues(
                    shipmentId, 
                    userId, 
                    userEmail, 
                    overrideExceptions,
                    approvalNotes,
                    finalizedCharge
                );
                results.push(result);
            } catch (error) {
                logger.error(`❌ Failed to approve shipment ${shipmentId}:`, error);
                
                // Try to get the actual shipmentID for better error messages
                let displayShipmentId = shipmentId;
                try {
                    const finalizedCharge = finalizedCharges.find(fc => 
                        fc.shipmentId === shipmentId || fc.id === shipmentId
                    );
                    if (finalizedCharge?.shipmentID) {
                        displayShipmentId = finalizedCharge.shipmentID;
                    }
                } catch (e) {
                    // Use original shipmentId if we can't get the business ID
                }
                
                errors.push({
                    shipmentId: displayShipmentId,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = errors.length;

        return {
            success: failureCount === 0,
            processedCount: shipmentIds.length,
            successCount: successCount,
            failureCount: failureCount,
            results: results,
            errors: errors,
            // 🔧 FIX: Provide clear error message when there are failures
            error: failureCount > 0 ? errors.map(e => `${e.shipmentId}: ${e.error}`).join('; ') : null,
            message: `Processed ${successCount}/${shipmentIds.length} charges with finalized values`
        };

    } catch (error) {
        logger.error('❌ Enhanced approval error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Process approval for a single shipment with finalized values
 */
async function processShipmentApprovalWithFinalValues(shipmentId, userId, userEmail, overrideExceptions, approvalNotes, finalizedCharge) {
    // 🔧 CRITICAL FIX: Implement dual lookup strategy - document ID first, then shipmentID field
    logger.info(`🔍 Attempting dual lookup for shipment: ${shipmentId}`);
    
    let shipmentDoc = null;
    let documentId = null;
    let shipmentData = null;
    
    // Strategy 1: Try direct document ID lookup
    try {
        const docRef = db.collection('shipments').doc(shipmentId);
        const directDoc = await docRef.get();
        
        if (directDoc.exists) {
            shipmentDoc = directDoc;
            documentId = directDoc.id;
            shipmentData = directDoc.data();
            logger.info(`✅ Found shipment by document ID: ${documentId}`);
        }
    } catch (error) {
        logger.warn(`⚠️ Document ID lookup failed: ${error.message}`);
    }
    
    // Strategy 2: If not found by document ID, query by shipmentID field
    if (!shipmentDoc) {
        logger.info(`🔍 Querying shipment by shipmentID field: ${shipmentId}`);
        const shipmentQuery = await db.collection('shipments')
            .where('shipmentID', '==', shipmentId)
            .limit(1)
            .get();
            
        if (!shipmentQuery.empty) {
            shipmentDoc = shipmentQuery.docs[0];
            documentId = shipmentDoc.id;
            shipmentData = shipmentDoc.data();
            logger.info(`✅ Found shipment by shipmentID field. Document ID: ${documentId}`);
        }
    }
    
    // If still not found, throw error
    if (!shipmentDoc || !shipmentData) {
        throw new Error(`Shipment ${shipmentId} not found in database using either document ID or shipmentID field`);
    }

    const currentStatus = shipmentData.chargeStatus?.status || 'pending_review';

    // Check if shipment can be approved
    const canApprove = await validateApproval(shipmentData, overrideExceptions);
    if (!canApprove.allowed) {
        throw new Error(canApprove.reason);
    }

    // Prepare approval update with finalized values
    const approvalData = {
        chargeStatus: {
            status: 'approved',
            approvedBy: userEmail || 'system',
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedByUserId: userId || null,
            previousStatus: currentStatus,
            overrideExceptions: overrideExceptions,
            approvalNotes: approvalNotes || '',
            autoGenerated: false,
            finalizedCharges: true // Flag indicating charges were finalized during approval
        },
        
        // Update invoice status if not set
        invoiceStatus: shipmentData.invoiceStatus || 'uninvoiced',
        
        // Track approval in status history
        [`statusHistory.${Date.now()}`]: {
            status: shipmentData.status || 'unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            note: overrideExceptions ? 
                `Charges approved with finalized values and exception override: ${approvalNotes}` :
                `Charges approved with finalized values: ${approvalNotes}`,
            updatedBy: userEmail || 'system',
            type: 'charges_approved_finalized',
            changes: {
                previousChargeStatus: currentStatus,
                newChargeStatus: 'approved',
                overrideExceptions: overrideExceptions,
                finalizedCharges: true,
                exceptionCount: shipmentData.exceptionStatus?.exceptionCount || 0
            }
        }
    };

    // Apply finalized charge values if provided
    if (finalizedCharge) {
        logger.info(`💰 Finalized charges for ${shipmentId}:`, finalizedCharge);
        
        // 🔧 CRITICAL FIX: DON'T overwrite actualRates.totalCharges (carrier cost)
        // Store finalized customer charges in a separate field structure
        approvalData.finalizedCharges = {
            customerCharge: finalizedCharge.actualCharge || finalizedCharge.finalCharge || 0,
            currency: finalizedCharge.currency || 'USD',
            charges: finalizedCharge.charges || [],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedFrom: 'finalized_approval',
            finalizedValues: true
        };
        
        // 🔧 PRESERVE actualRates.totalCharges (carrier cost) - don't overwrite it!
        // Only update if actualRates doesn't exist yet
        if (!shipmentData.actualRates || !shipmentData.actualRates.totalCharges) {
            approvalData.actualRates = {
                totalCharges: finalizedCharge.actualCost || 0,  // ✅ Use COST, not charge
                currency: finalizedCharge.currency || 'USD',
                charges: finalizedCharge.charges || [],
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedFrom: 'finalized_approval'
            };
        }

        // Update cost comparison with finalized values
        approvalData.costComparison = {
            quotedCost: finalizedCharge.quotedCost || 0,
            actualCost: finalizedCharge.actualCost || 0,
            quotedCharge: finalizedCharge.quotedCharge || 0,
            actualCharge: finalizedCharge.actualCharge || 0,
            costVariance: finalizedCharge.costVariance || 0,
            chargeVariance: finalizedCharge.chargeVariance || 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            finalizedValues: true
        };
    }

    // If overriding exceptions, mark them as resolved
    if (overrideExceptions && shipmentData.exceptionStatus?.hasExceptions) {
        approvalData.exceptionStatus = {
            ...shipmentData.exceptionStatus,
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            resolvedBy: userEmail || 'system',
            resolutionMethod: 'finalized_approval_override',
            resolutionNotes: approvalNotes
        };
    }

    // Update shipment document
    await db.collection('shipments').doc(documentId).update(approvalData);

    // Log approval event
    await logFinalizedApprovalEvent(documentId, shipmentData.shipmentID, userEmail, overrideExceptions, approvalNotes, finalizedCharge);

    return {
        success: true,
        shipmentId: documentId,
        shipmentID: shipmentData.shipmentID,
        previousStatus: currentStatus,
        newStatus: 'approved',
        overrideExceptions: overrideExceptions,
        finalizedCharges: !!finalizedCharge,
        message: 'Charges approved with finalized values'
    };
}

/**
 * Validate if shipment can be approved
 */
async function validateApproval(shipmentData, overrideExceptions) {
    // Check if shipment is cancelled
    if (shipmentData.status === 'cancelled' || shipmentData.status === 'canceled') {
        return {
            allowed: false,
            reason: 'Cannot approve charges for cancelled shipments'
        };
    }

    // Check if already approved
    if (shipmentData.chargeStatus?.status === 'approved') {
        return {
            allowed: false,
            reason: 'Charges are already approved'
        };
    }

    // Check for high-severity exceptions
    if (!overrideExceptions && shipmentData.exceptionStatus?.hasExceptions) {
        const highSeverityExceptions = shipmentData.exceptionStatus.exceptions?.filter(
            ex => ex.severity === 'HIGH'
        ) || [];
        
        if (highSeverityExceptions.length > 0) {
            return {
                allowed: false,
                reason: `Cannot approve due to ${highSeverityExceptions.length} high-severity exception(s). Override required.`
            };
        }
    }

    return {
        allowed: true,
        reason: 'Validation passed'
    };
}

/**
 * Log finalized approval event for audit trail
 */
async function logFinalizedApprovalEvent(shipmentId, shipmentID, userEmail, overrideExceptions, approvalNotes, finalizedCharge) {
    try {
        await db.collection('chargeApprovalLog').add({
            shipmentId: shipmentId,
            shipmentID: shipmentID,
            approvedBy: userEmail || 'system',
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
            overrideExceptions: overrideExceptions,
            approvalNotes: approvalNotes,
            finalizedCharges: !!finalizedCharge,
            finalizedValues: finalizedCharge || null,
            action: 'charge_approval_finalized'
        });
    } catch (error) {
        logger.warn('Failed to log finalized approval event:', error);
    }
}

module.exports = { approveChargesWithFinalValues }; 