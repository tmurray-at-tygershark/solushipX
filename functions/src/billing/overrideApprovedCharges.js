const { logger } = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const { onCall } = require('firebase-functions/v2/https');

const db = getFirestore();

/**
 * Override approved charges - revert them back to pending status
 * This allows re-review of charges that were previously approved
 */
exports.overrideApprovedCharges = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { data } = request;
        const { shipmentIds, overrideReason, overrideType, overriddenBy } = data;

        // Validate authentication
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        // Validate parameters
        if (!shipmentIds || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
            throw new Error('Shipment IDs are required');
        }

        if (!overrideReason || !overrideType || !overriddenBy) {
            throw new Error('Override reason, type, and user are required');
        }

        logger.info(`Starting charge override for ${shipmentIds.length} shipments`, {
            shipmentIds,
            overrideType,
            overriddenBy
        });

        let successCount = 0;
        let failedCount = 0;
        const overrideResults = [];

        // Process each shipment
        for (const shipmentId of shipmentIds) {
            try {
                // Get the shipment document
                const shipmentRef = db.collection('shipments').doc(shipmentId);
                const shipmentDoc = await shipmentRef.get();

                if (!shipmentDoc.exists) {
                    logger.warn(`Shipment ${shipmentId} not found`);
                    failedCount++;
                    overrideResults.push({
                        shipmentId,
                        success: false,
                        error: 'Shipment not found'
                    });
                    continue;
                }

                const shipmentData = shipmentDoc.data();

                // Check if shipment has approved status
                const isApproved = shipmentData.status === 'approved' ||
                                 shipmentData.chargeStatus === 'approved' ||
                                 shipmentData.approvalStatus === 'approved';

                if (!isApproved) {
                    logger.info(`Shipment ${shipmentId} is not in approved status, skipping`);
                    failedCount++;
                    overrideResults.push({
                        shipmentId,
                        success: false,
                        error: 'Shipment is not approved'
                    });
                    continue;
                }

                // Prepare override data
                const overrideData = {
                    // Reset approval status
                    status: 'pending',
                    chargeStatus: 'pending',
                    approvalStatus: 'pending',
                    
                    // Clear finalized charge values to force re-review
                    actualCharge: null,
                    finalizedCharges: null,
                    chargeApprovalTimestamp: null,
                    approvedAt: null,
                    approvedBy: null,
                    
                    // Add override tracking
                    chargeOverride: {
                        isOverridden: true,
                        overrideType: overrideType,
                        overrideReason: overrideReason,
                        overriddenBy: overriddenBy,
                        overriddenAt: new Date(),
                        previousStatus: shipmentData.status || shipmentData.chargeStatus || 'approved',
                        previousApprovalData: {
                            approvedBy: shipmentData.approvedBy,
                            approvedAt: shipmentData.approvedAt,
                            chargeApprovalTimestamp: shipmentData.chargeApprovalTimestamp,
                            actualCharge: shipmentData.actualCharge,
                            finalizedCharges: shipmentData.finalizedCharges
                        }
                    },
                    
                    // Update audit fields
                    lastModified: new Date(),
                    lastModifiedBy: overriddenBy
                };

                // Update the shipment document
                await shipmentRef.update(overrideData);

                logger.info(`Successfully overrode charges for shipment ${shipmentId}`);
                successCount++;
                overrideResults.push({
                    shipmentId,
                    success: true,
                    previousStatus: shipmentData.status || shipmentData.chargeStatus,
                    newStatus: 'pending'
                });

            } catch (error) {
                logger.error(`Failed to override charges for shipment ${shipmentId}:`, error);
                failedCount++;
                overrideResults.push({
                    shipmentId,
                    success: false,
                    error: error.message
                });
            }
        }

        const response = {
            success: successCount > 0,
            successCount,
            failedCount,
            processedCount: shipmentIds.length,
            overrideResults,
            message: `Override completed: ${successCount} successful, ${failedCount} failed`
        };

        logger.info('Charge override operation completed', response);
        return response;

    } catch (error) {
        logger.error('Error in overrideApprovedCharges:', error);
        throw new Error(`Failed to override charges: ${error.message}`);
    }
}); 