const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const { recordShipmentEvent } = require('./utils/shipmentEvents');

const db = admin.firestore();

/**
 * Archive a shipment by setting its status to 'archived'
 * Archived shipments won't appear in normal queries or searches
 */
const archiveShipment = onCall({
    minInstances: 1,
    memory: '512MiB',
    timeoutSeconds: 30
}, async (request) => {
    try {
        const { shipmentId, firebaseDocId, reason = 'User requested archive' } = request.data;
        const { uid: userId, email: userEmail } = request.auth || {};

        // Ensure we have safe values for Firestore (no undefined values)
        const safeUserId = userId || 'unknown';
        const safeUserEmail = userEmail || 'unknown@system.local';

        logger.info('archiveShipment started:', { 
            shipmentId, 
            firebaseDocId, 
            userId: safeUserId, 
            userEmail: safeUserEmail,
            reason 
        });

        if (!shipmentId || !firebaseDocId) {
            throw new Error('Shipment ID and Firebase document ID are required');
        }

        // Get current shipment data
        logger.info('Fetching shipment data...', { firebaseDocId });
        const shipmentRef = db.collection('shipments').doc(firebaseDocId);
        const shipmentDoc = await shipmentRef.get();
        
        if (!shipmentDoc.exists) {
            throw new Error(`Shipment ${firebaseDocId} not found`);
        }

        const shipmentData = shipmentDoc.data();
        const previousStatus = shipmentData.status;
        
        logger.info('Shipment data retrieved successfully', { 
            shipmentId: shipmentData.shipmentID,
            status: shipmentData.status,
            previousStatus
        });

        // Check if shipment is already archived
        if (shipmentData.status === 'archived') {
            logger.info('Shipment is already archived', { shipmentId });
            return {
                success: true,
                message: 'Shipment is already archived',
                shipmentId,
                firebaseDocId
            };
        }

        // Update shipment status to archived
        const updateData = {
            status: 'archived',
            previousStatus: previousStatus,
            archivedAt: admin.firestore.FieldValue.serverTimestamp(),
            archivedBy: safeUserId,
            archivedByEmail: safeUserEmail,
            archiveReason: reason,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Add to archive history
        const archiveEntry = {
            action: 'archived',
            timestamp: new Date().toISOString(),
            userId: safeUserId,
            userEmail: safeUserEmail,
            previousStatus: previousStatus,
            reason: reason
        };

        if (!shipmentData.archiveHistory) {
            updateData.archiveHistory = [archiveEntry];
        } else {
            updateData.archiveHistory = admin.firestore.FieldValue.arrayUnion(archiveEntry);
        }

        // Update the shipment
        await shipmentRef.update(updateData);

        // Record shipment event
        await recordShipmentEvent(
            firebaseDocId, 
            'USER_ACTION', 
            'Shipment Archived',
            `Shipment archived by ${safeUserEmail}. Previous status: ${previousStatus}. Reason: ${reason}`,
            'user',
            { userId: safeUserId, email: safeUserEmail },
            { previousStatus, reason }
        );

        logger.info('Shipment archived successfully', { 
            shipmentId,
            firebaseDocId,
            previousStatus
        });

        return {
            success: true,
            message: 'Shipment archived successfully',
            shipmentId,
            firebaseDocId,
            previousStatus
        };

    } catch (error) {
        logger.error('Error archiving shipment:', error);
        throw error;
    }
});

module.exports = {
    archiveShipment
}; 