const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

// Import shipment events utility
const { recordShipmentEvent, EVENT_TYPES, EVENT_SOURCES } = require('./utils/shipmentEvents');

const db = admin.firestore();

/**
 * Cloud Function to manually override shipment status
 * This function allows authorized users to manually set shipment statuses
 * and prevents automatic carrier updates once manual override is enabled
 */
exports.updateManualShipmentStatus = onCall({
    cors: true,
    enforceAppCheck: false
}, async (request) => {
    try {
        const { shipmentId, newStatus, previousStatus, reason, timestamp, enhancedStatus } = request.data;
        const { auth } = request;

        // Validate authentication
        if (!auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        // Validate required parameters
        if (!shipmentId || !newStatus) {
            throw new HttpsError('invalid-argument', 'Missing required parameters: shipmentId and newStatus');
        }

        // Valid status values (using universal status model)
        const VALID_STATUSES = [
            'pending', 'booked', 'scheduled', 'awaiting_shipment',
            'in_transit', 'delivered', 'on_hold', 'canceled', 'void'
        ];

        if (!VALID_STATUSES.includes(newStatus)) {
            throw new HttpsError('invalid-argument', `Invalid status: ${newStatus}`);
        }

        logger.info(`Manual status override requested for shipment ${shipmentId}`, {
            shipmentId,
            newStatus,
            previousStatus,
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

        // Create status override data
        const statusOverride = {
            isManual: true,
            overriddenBy: auth.uid,
            overriddenAt: admin.firestore.FieldValue.serverTimestamp(),
            originalStatus: shipmentData.status,
            manualStatus: newStatus,
            reason: reason || 'Manual status override',
            preventAutoUpdates: true,
            lastUpdate: new Date().toISOString(), // This ensures the field always changes
            updateCount: (shipmentData.statusOverride?.updateCount || 0) + 1
        };

        // Only add enhancedStatus if it's not undefined
        if (enhancedStatus !== undefined && enhancedStatus !== null) {
            statusOverride.enhancedStatus = enhancedStatus;
        }

        // Create audit trail entry
        const auditEntry = {
            shipmentId,
            action: 'manual_status_override',
            userId: auth.uid,
            userEmail: auth.token?.email || 'unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            changes: {
                field: 'status',
                oldValue: shipmentData.status,
                newValue: newStatus
            },
            metadata: {
                reason: reason || 'Manual status override',
                clientTimestamp: timestamp,
                source: 'manual_override'
            }
        };

        // Prepare status history entry
        const statusHistoryEntry = {
            status: newStatus,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            source: 'manual_override',
            description: `Status manually changed to ${newStatus}`,
            updatedBy: auth.uid,
            reason: reason || 'Manual status override'
        };

        // Batch write to ensure atomicity
        const batch = db.batch();

        // Prepare the update data for the shipment document
        const updateData = {
            status: newStatus,
            statusOverride,
            statusLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            statusUpdateSource: 'manual_override',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            // CRITICAL: Add fields that always change to ensure Firestore trigger fires
            lastStatusChange: admin.firestore.FieldValue.serverTimestamp(),
            statusChangeCounter: (shipmentData.statusChangeCounter || 0) + 1,
            // Add unique identifier for each status change
            statusChangeId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        // Only add enhancedStatus if it's not undefined
        if (enhancedStatus !== undefined && enhancedStatus !== null) {
            updateData.enhancedStatus = enhancedStatus;
        }

        // Update shipment document
        batch.update(shipmentRef, updateData);

        // Add audit trail entry
        const auditRef = db.collection('auditTrail').doc();
        batch.set(auditRef, auditEntry);

        // Add status history entry
        const statusHistoryRef = shipmentRef.collection('statusHistory').doc();
        batch.set(statusHistoryRef, statusHistoryEntry);

        // Execute the batch
        await batch.commit();

        // **CRITICAL FIX**: Record manual status override event in shipment timeline
        try {
            await recordShipmentEvent(
                shipmentId,
                EVENT_TYPES.STATUS_UPDATE,
                `Status Manually Updated: ${newStatus}`,
                `Status manually changed from "${shipmentData.status}" to "${newStatus}"${reason ? `. Reason: ${reason}` : ""}`,
                EVENT_SOURCES.USER,
                {
                    email: auth.token?.email || 'unknown',
                    userId: auth.uid,
                    userName: auth.token?.name || auth.token?.email?.split('@')[0] || 'Unknown User'
                },
                {
                    statusChange: {
                        from: shipmentData.status,
                        to: newStatus,
                        reason: reason || 'Manual status override'
                    },
                    isManualOverride: true,
                    overrideReason: reason
                }
            );
            logger.info(`Recorded manual status override event for shipment ${shipmentId}: ${shipmentData.status} -> ${newStatus}`);
        } catch (eventError) {
            logger.error('Error recording manual status override event:', eventError);
            // Don't fail the main operation if event recording fails
        }

        logger.info(`Manual status override completed for shipment ${shipmentId}`, {
            shipmentId,
            previousStatus: shipmentData.status,
            newStatus,
            userId: auth.uid,
            reason
        });

        // Return success response
        return {
            success: true,
            message: `Status manually updated to ${newStatus}`,
            statusChanged: true,
            shipmentId,
            previousStatus: shipmentData.status,
            newStatus,
            overriddenBy: auth.uid,
            overriddenAt: timestamp || new Date().toISOString(),
            auditTrailId: auditRef.id
        };

    } catch (error) {
        logger.error('Error in updateManualShipmentStatus:', error);
        
        // Re-throw HttpsError instances as-is
        if (error instanceof HttpsError) {
            throw error;
        }
        
        // Convert other errors to HttpsError
        throw new HttpsError('internal', `Failed to update manual status: ${error.message}`);
    }
});

/**
 * Helper function to check if a shipment has manual status override
 * This can be used by other functions to determine if automatic updates should be skipped
 */
function hasManualStatusOverride(shipmentData) {
    return shipmentData?.statusOverride?.isManual === true && 
           shipmentData?.statusOverride?.preventAutoUpdates === true;
}

/**
 * Helper function to get the effective status of a shipment
 * Returns the manual status if overridden, otherwise returns the regular status
 */
function getEffectiveStatus(shipmentData) {
    if (hasManualStatusOverride(shipmentData)) {
        return shipmentData.statusOverride.manualStatus || shipmentData.status;
    }
    return shipmentData.status;
}

module.exports = {
    updateManualShipmentStatus: exports.updateManualShipmentStatus,
    hasManualStatusOverride,
    getEffectiveStatus
}; 