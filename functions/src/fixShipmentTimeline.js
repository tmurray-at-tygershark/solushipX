const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

// Import shipment events utility
const { recordShipmentEvent, EVENT_TYPES, EVENT_SOURCES } = require('./utils/shipmentEvents');

const db = admin.firestore();

/**
 * Cloud Function to retroactively fix missing events in shipment timelines
 * This analyzes existing shipment data and creates missing timeline events
 */
exports.fixShipmentTimeline = onCall({
    cors: true,
    enforceAppCheck: false,
    timeoutSeconds: 300
}, async (request) => {
    try {
        const { shipmentId, forceRecreate = false } = request.data;
        const { auth } = request;

        // Validate authentication
        if (!auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        // Validate required parameters
        if (!shipmentId) {
            throw new HttpsError('invalid-argument', 'Missing required parameter: shipmentId');
        }

        logger.info(`Fixing timeline for shipment: ${shipmentId}`, {
            shipmentId,
            forceRecreate,
            userId: auth.uid
        });

        // Get shipment document
        const shipmentRef = db.collection('shipments').doc(shipmentId);
        const shipmentDoc = await shipmentRef.get();

        if (!shipmentDoc.exists) {
            throw new HttpsError('not-found', `Shipment not found: ${shipmentId}`);
        }

        const shipmentData = shipmentDoc.data();
        const firestoreDocId = shipmentDoc.id;

        // Get existing events to avoid duplicates (unless force recreate)
        let existingEvents = [];
        if (!forceRecreate) {
            const eventsRef = db.collection('shipmentEvents').doc(firestoreDocId);
            const eventsDoc = await eventsRef.get();
            if (eventsDoc.exists) {
                existingEvents = eventsDoc.data().events || [];
            }
        }

        const eventsToCreate = [];
        const eventsSummary = [];

        // Helper function to check if event already exists
        const eventExists = (eventType, title) => {
            return existingEvents.some(event => 
                event.eventType === eventType && 
                (event.title === title || event.title.includes(title))
            );
        };

        // 1. SHIPMENT CREATION EVENT
        if (shipmentData.createdAt && (!eventExists(EVENT_TYPES.CREATED, 'Created') || forceRecreate)) {
            const creationTimestamp = shipmentData.createdAt.toDate ? 
                shipmentData.createdAt.toDate().toISOString() : 
                new Date(shipmentData.createdAt).toISOString();

            eventsToCreate.push({
                eventType: EVENT_TYPES.CREATED,
                title: 'Shipment Created',
                description: `Shipment created${shipmentData.creationMethod ? ` via ${shipmentData.creationMethod}` : ''}`,
                timestamp: creationTimestamp,
                source: EVENT_SOURCES.USER,
                userData: {
                    email: shipmentData.createdByEmail || shipmentData.createdBy || 'unknown',
                    userId: shipmentData.createdBy || 'unknown',
                    userName: shipmentData.createdByName || (shipmentData.createdByEmail || 'Unknown User').split('@')[0]
                },
                metadata: {
                    shipmentType: shipmentData.shipmentInfo?.shipmentType || shipmentData.shipmentType || 'freight',
                    creationMethod: shipmentData.creationMethod,
                    isRetroactiveEvent: true
                }
            });
            eventsSummary.push('Shipment Creation');
        }

        // 2. DRAFT EVENTS (if applicable)
        if (shipmentData.isDraft && shipmentData.draftSavedAt) {
            if (!eventExists(EVENT_TYPES.USER_ACTION, 'Draft') || forceRecreate) {
                const draftTimestamp = shipmentData.draftSavedAt.toDate ? 
                    shipmentData.draftSavedAt.toDate().toISOString() : 
                    new Date(shipmentData.draftSavedAt).toISOString();

                eventsToCreate.push({
                    eventType: EVENT_TYPES.USER_ACTION,
                    title: 'Draft Saved',
                    description: `Shipment saved as draft (version ${shipmentData.draftVersion || 1})`,
                    timestamp: draftTimestamp,
                    source: EVENT_SOURCES.USER,
                    userData: {
                        email: shipmentData.createdByEmail || shipmentData.createdBy || 'unknown',
                        userId: shipmentData.createdBy || 'unknown',
                        userName: shipmentData.createdByName || (shipmentData.createdByEmail || 'Unknown User').split('@')[0]
                    },
                    metadata: {
                        draftVersion: shipmentData.draftVersion,
                        isRetroactiveEvent: true
                    }
                });
                eventsSummary.push('Draft Saved');
            }
        }

        // 3. BOOKING CONFIRMATION EVENT (for QuickShip and booked shipments)
        if (shipmentData.bookingTimestamp || shipmentData.bookedAt || shipmentData.creationMethod === 'quickship') {
            if (!eventExists(EVENT_TYPES.BOOKING_CONFIRMED, 'Booking') || forceRecreate) {
                const bookingTimestamp = shipmentData.bookingTimestamp || 
                    (shipmentData.bookedAt?.toDate ? shipmentData.bookedAt.toDate().toISOString() : 
                     shipmentData.bookedAt) ||
                    shipmentData.createdAt?.toDate?.().toISOString() ||
                    new Date(shipmentData.createdAt).toISOString();

                eventsToCreate.push({
                    eventType: EVENT_TYPES.BOOKING_CONFIRMED,
                    title: shipmentData.creationMethod === 'quickship' ? 'QuickShip Booking Confirmed' : 'Booking Confirmed',
                    description: `${shipmentData.creationMethod === 'quickship' ? 'QuickShip' : 'Shipment'} booking confirmed for carrier: ${shipmentData.carrier || shipmentData.selectedCarrier || 'Unknown'}`,
                    timestamp: bookingTimestamp,
                    source: EVENT_SOURCES.USER,
                    userData: {
                        email: shipmentData.createdByEmail || shipmentData.createdBy || 'unknown',
                        userId: shipmentData.createdBy || 'unknown',
                        userName: shipmentData.createdByName || (shipmentData.createdByEmail || 'Unknown User').split('@')[0]
                    },
                    metadata: {
                        carrier: shipmentData.carrier || shipmentData.selectedCarrier,
                        bookingMethod: shipmentData.bookingMethod || shipmentData.creationMethod,
                        totalCharges: shipmentData.totalCharges || shipmentData.totalCost,
                        currency: shipmentData.currency,
                        trackingNumber: shipmentData.shipmentID,
                        isRetroactiveEvent: true
                    }
                });
                eventsSummary.push('Booking Confirmation');
            }
        }

        // 4. CANCELLATION EVENT
        if (shipmentData.cancelledAt && shipmentData.status === 'cancelled') {
            if (!eventExists('shipment_cancelled', 'Cancelled') || forceRecreate) {
                const cancellationTimestamp = shipmentData.cancelledAt.toDate ? 
                    shipmentData.cancelledAt.toDate().toISOString() : 
                    new Date(shipmentData.cancelledAt).toISOString();

                eventsToCreate.push({
                    eventType: 'shipment_cancelled',
                    title: 'Shipment Cancelled',
                    description: `Shipment was cancelled${shipmentData.cancellationReason ? `: ${shipmentData.cancellationReason}` : ''}`,
                    timestamp: cancellationTimestamp,
                    source: EVENT_SOURCES.USER,
                    userData: {
                        email: shipmentData.cancelledByEmail || 'unknown',
                        userId: shipmentData.cancelledBy || 'unknown',
                        userName: (shipmentData.cancelledByEmail || 'Unknown User').split('@')[0]
                    },
                    metadata: {
                        cancellationReason: shipmentData.cancellationReason,
                        carrierNotified: shipmentData.carrierCancellationResult?.success || false,
                        isRetroactiveEvent: true
                    }
                });
                eventsSummary.push('Cancellation');
            }
        }

        // 5. MANUAL STATUS OVERRIDE EVENT
        if (shipmentData.statusOverride?.isManual) {
            if (!eventExists(EVENT_TYPES.STATUS_UPDATE, 'Manually Updated') || forceRecreate) {
                const overrideTimestamp = shipmentData.statusOverride.overriddenAt?.toDate ? 
                    shipmentData.statusOverride.overriddenAt.toDate().toISOString() : 
                    new Date(shipmentData.statusOverride.overriddenAt).toISOString();

                eventsToCreate.push({
                    eventType: EVENT_TYPES.STATUS_UPDATE,
                    title: `Status Manually Updated: ${shipmentData.statusOverride.manualStatus || shipmentData.status}`,
                    description: `Status manually changed from "${shipmentData.statusOverride.originalStatus}" to "${shipmentData.statusOverride.manualStatus || shipmentData.status}"${shipmentData.statusOverride.reason ? `. Reason: ${shipmentData.statusOverride.reason}` : ''}`,
                    timestamp: overrideTimestamp,
                    source: EVENT_SOURCES.USER,
                    userData: {
                        email: 'unknown', // We don't have this info in the override
                        userId: shipmentData.statusOverride.overriddenBy || 'unknown',
                        userName: 'Unknown User'
                    },
                    metadata: {
                        statusChange: {
                            from: shipmentData.statusOverride.originalStatus,
                            to: shipmentData.statusOverride.manualStatus || shipmentData.status,
                            reason: shipmentData.statusOverride.reason
                        },
                        isManualOverride: true,
                        overrideReason: shipmentData.statusOverride.reason,
                        isRetroactiveEvent: true
                    }
                });
                eventsSummary.push('Manual Status Override');
            }
        }

        // 6. DOCUMENT GENERATION EVENTS (if we can infer them)
        // This is harder to retroactively determine, but we can check for common patterns
        if (shipmentData.documents || shipmentData.bolGenerated || shipmentData.carrierConfirmationGenerated) {
            // Add logic here if document generation timestamps are available
        }

        // 7. EDIT HISTORY EVENTS
        if (shipmentData.editHistory && Array.isArray(shipmentData.editHistory)) {
            shipmentData.editHistory.forEach((edit, index) => {
                const editEventTitle = `Shipment ${edit.action || 'Updated'}`;
                if (!eventExists(EVENT_TYPES.USER_ACTION, editEventTitle) || forceRecreate) {
                    const editTimestamp = edit.timestamp?.toDate ? 
                        edit.timestamp.toDate().toISOString() : 
                        new Date(edit.timestamp).toISOString();

                    eventsToCreate.push({
                        eventType: EVENT_TYPES.USER_ACTION,
                        title: editEventTitle.charAt(0).toUpperCase() + editEventTitle.slice(1),
                        description: `${edit.action || 'Shipment updated'}${edit.reason ? `: ${edit.reason}` : ''}`,
                        timestamp: editTimestamp,
                        source: EVENT_SOURCES.USER,
                        userData: {
                            email: edit.userEmail || 'unknown',
                            userId: edit.userId || 'unknown',
                            userName: (edit.userEmail || 'Unknown User').split('@')[0]
                        },
                        metadata: {
                            action: edit.action,
                            reason: edit.reason,
                            carrierNotified: edit.carrierNotified,
                            shipperNotified: edit.shipperNotified,
                            isRetroactiveEvent: true
                        }
                    });
                }
            });
            if (shipmentData.editHistory.length > 0) {
                eventsSummary.push(`${shipmentData.editHistory.length} Edit History Events`);
            }
        }

        // Create all events
        let createdCount = 0;
        for (const eventData of eventsToCreate) {
            try {
                const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const event = {
                    eventId,
                    ...eventData
                };

                const shipmentEventsRef = db.collection('shipmentEvents').doc(firestoreDocId);
                const shipmentEventsDoc = await shipmentEventsRef.get();

                if (shipmentEventsDoc.exists && !forceRecreate) {
                    await shipmentEventsRef.update({
                        events: admin.firestore.FieldValue.arrayUnion(event),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                } else if (forceRecreate || !shipmentEventsDoc.exists) {
                    // For force recreate, replace all events
                    const eventsToSet = forceRecreate ? eventsToCreate.map((e, i) => ({
                        eventId: `evt_${Date.now() + i}_${Math.random().toString(36).substr(2, 9)}`,
                        ...e
                    })) : [event];

                    await shipmentEventsRef.set({
                        shipmentID: shipmentData.shipmentID || shipmentId,
                        events: eventsToSet,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    if (forceRecreate) {
                        createdCount = eventsToSet.length;
                        break; // Exit loop since we set all events at once
                    }
                }

                createdCount++;
                logger.info(`Created retroactive event: ${eventData.title} for shipment ${shipmentId}`);

            } catch (eventError) {
                logger.error(`Error creating retroactive event: ${eventData.title}`, eventError);
            }
        }

        logger.info(`Timeline fix completed for shipment ${shipmentId}`, {
            shipmentId,
            eventsCreated: createdCount,
            eventsSummary,
            forceRecreate
        });

        return {
            success: true,
            message: `Timeline fixed for shipment ${shipmentId}`,
            shipmentId,
            eventsCreated: createdCount,
            eventsSummary,
            forceRecreate,
            details: {
                totalEventsProcessed: eventsToCreate.length,
                existingEventsCount: existingEvents.length,
                shipmentStatus: shipmentData.status,
                creationMethod: shipmentData.creationMethod
            }
        };

    } catch (error) {
        logger.error('Error in fixShipmentTimeline:', error);
        
        // Re-throw HttpsError instances as-is
        if (error instanceof HttpsError) {
            throw error;
        }
        
        // Convert other errors to HttpsError
        throw new HttpsError('internal', `Failed to fix shipment timeline: ${error.message}`);
    }
});

module.exports = {
    fixShipmentTimeline: exports.fixShipmentTimeline
}; 