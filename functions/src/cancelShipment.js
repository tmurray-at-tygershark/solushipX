const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

// Import shipment events utility
const { recordShipmentEvent, EVENT_TYPES, EVENT_SOURCES } = require('./utils/shipmentEvents');

const db = admin.firestore();

/**
 * Cloud Function to cancel shipments with proper event recording
 */
exports.cancelShipment = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
    region: 'us-central1'
}, async (request) => {
    try {
        const { shipmentId, firebaseDocId, reason } = request.data;
        const { auth } = request;

        // Validate authentication
        if (!auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        // Validate required parameters
        if (!shipmentId || !firebaseDocId || !reason) {
            throw new HttpsError('invalid-argument', 'Missing required parameters');
        }

        logger.info(`Cancellation requested for shipment ${shipmentId}`, {
            shipmentId,
            firebaseDocId,
            userId: auth.uid,
            reason: reason.trim()
        });

        // Get shipment document
        const shipmentRef = db.collection('shipments').doc(firebaseDocId);
        const shipmentDoc = await shipmentRef.get();

        if (!shipmentDoc.exists) {
            throw new HttpsError('not-found', `Shipment ${shipmentId} not found`);
        }

        const shipmentData = shipmentDoc.data();

        // Check if already cancelled
        if (shipmentData.status === 'cancelled' || shipmentData.status === 'canceled') {
            throw new HttpsError('failed-precondition', 'Shipment is already cancelled');
        }

        // Simple cancellation - preserve all charges by default
        const now = admin.firestore.FieldValue.serverTimestamp();
        const cancelledByEmail = auth.token?.email || 'unknown@system.local';
        
        const cancellationData = {
            status: 'cancelled',
            cancelledAt: now,
            cancelledBy: auth.uid,
            cancelledByEmail: cancelledByEmail,
            cancellationReason: reason.trim(),
            updatedAt: now,
            lastModifiedBy: cancelledByEmail
        };

        // Update shipment document
        await shipmentRef.update(cancellationData);

        // **CRITICAL FIX**: Record cancellation event in shipment timeline
        // Use firebaseDocId for event recording since that's what the frontend listener uses
        try {
            await recordShipmentEvent(
                firebaseDocId,
                'shipment_cancelled',
                'Shipment Cancelled',
                `Shipment was cancelled: ${reason.trim()}`,
                EVENT_SOURCES.USER,
                {
                    email: cancelledByEmail,
                    uid: auth.uid,
                    displayName: auth.token?.name || auth.token?.email?.split('@')[0] || 'Unknown User'
                },
                {
                    cancellationReason: reason.trim(),
                    originalStatus: shipmentData.status,
                    carrierNotified: false,
                    shipmentID: shipmentId // Keep the business ID for reference
                }
            );
            logger.info(`Recorded cancellation event for shipment ${shipmentId} (docId: ${firebaseDocId})`);
        } catch (eventError) {
            logger.error('Error recording cancellation event:', eventError);
            // Don't fail the main operation if event recording fails
        }

        logger.info('Shipment cancelled successfully', {
            shipmentId,
            firebaseDocId,
            userId: auth.uid
        });

        return {
            success: true,
            message: 'Shipment cancelled successfully',
            data: {
                shipmentId,
                cancelledAt: cancellationData.cancelledAt,
                cancellationReason: reason.trim()
            }
        };

    } catch (error) {
        logger.error('Error cancelling shipment:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', error.message || 'An internal error occurred while cancelling the shipment');
    }
}); 