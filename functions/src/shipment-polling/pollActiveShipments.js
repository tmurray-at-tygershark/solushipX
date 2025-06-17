const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { recordStatusChange, recordTrackingUpdate } = require('../utils/shipmentEvents');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Background polling function that runs every 5 minutes to update active shipments
 * This ensures we don't miss status changes even when users aren't actively viewing shipments
 */
exports.pollActiveShipments = onSchedule(
    {
        schedule: 'every 5 minutes',
        timeZone: 'America/Toronto',
        timeoutSeconds: 540, // 9 minutes max execution time
        memory: '2GiB'
    },
    async (event) => {
        console.log('🔄 Starting scheduled polling of active shipments...');
        
        try {
            // Get all shipments that are not in final states
            const activeStatuses = ['pending', 'booked', 'scheduled', 'awaiting_shipment', 'in_transit', 'on_hold'];
            
            const shipmentsRef = db.collection('shipments');
            const activeShipments = [];
            
            // Query for each active status (Firestore doesn't support array-contains for 'in' operator with large arrays)
            for (const status of activeStatuses) {
                const snapshot = await shipmentsRef
                    .where('status', '==', status)
                    .get();
                
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    // Only include shipments that have been created more than 5 minutes ago to avoid polling too early
                    const createdAt = data.createdAt?.toDate() || new Date();
                    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                    
                    if (createdAt < fiveMinutesAgo) {
                        activeShipments.push({
                            id: doc.id,
                            ...data
                        });
                    }
                });
            }
            
            console.log(`📦 Found ${activeShipments.length} active shipments to poll`);
            
            if (activeShipments.length === 0) {
                console.log('✅ No active shipments to poll');
                return { success: true, message: 'No active shipments found' };
            }
            
            // Process shipments in batches to avoid timeouts
            const batchSize = 10;
            const results = {
                processed: 0,
                updated: 0,
                errors: 0,
                skipped: 0
            };
            
            for (let i = 0; i < activeShipments.length; i += batchSize) {
                const batch = activeShipments.slice(i, i + batchSize);
                console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activeShipments.length / batchSize)}`);
                
                // Process batch in parallel with controlled concurrency
                const batchPromises = batch.map(async (shipment) => {
                    try {
                        const result = await pollSingleShipment(shipment);
                        results.processed++;
                        if (result.updated) results.updated++;
                        if (result.skipped) results.skipped++;
                        return result;
                    } catch (error) {
                        console.error(`❌ Error polling shipment ${shipment.shipmentID}:`, error.message);
                        results.errors++;
                        return { error: error.message };
                    }
                });
                
                await Promise.all(batchPromises);
                
                // Small delay between batches to be respectful to carrier APIs
                if (i + batchSize < activeShipments.length) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            console.log('✅ Polling completed:', results);
            
            return {
                success: true,
                results,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error in pollActiveShipments:', error);
            throw new Error(`Polling failed: ${error.message}`);
        }
    });

/**
 * Poll a single shipment for status updates
 */
async function pollSingleShipment(shipment) {
    try {
        console.log(`🔍 Polling shipment ${shipment.shipmentID}...`);
        
        // Check if we should skip this shipment based on last poll time
        const lastPolled = shipment.lastStatusPoll?.toDate();
        const minimumPollInterval = 15 * 60 * 1000; // 15 minutes
        
        if (lastPolled && (Date.now() - lastPolled.getTime()) < minimumPollInterval) {
            console.log(`⏭️  Skipping ${shipment.shipmentID} - polled recently`);
            return { skipped: true };
        }
        
        // Determine carrier and tracking info
        const carrierInfo = await determineCarrierInfo(shipment);
        
        if (!carrierInfo.canPoll) {
            console.log(`⏭️  Skipping ${shipment.shipmentID} - carrier ${carrierInfo.carrier} not supported for polling`);
            return { skipped: true };
        }
        
        // Call the appropriate status checking function
        const statusResult = await checkCarrierStatus(shipment, carrierInfo);
        
        if (statusResult.success && statusResult.statusChanged) {
            console.log(`✅ Updated status for ${shipment.shipmentID}: ${shipment.status} → ${statusResult.newStatus}`);
            
            // Update shipment document with new status and last poll time
            await db.collection('shipments').doc(shipment.id).update({
                status: statusResult.newStatus,
                statusLastChecked: admin.firestore.Timestamp.now(),
                lastStatusPoll: admin.firestore.Timestamp.now(),
                carrierTrackingData: statusResult.trackingData || shipment.carrierTrackingData,
                estimatedDelivery: statusResult.estimatedDelivery || shipment.estimatedDelivery,
                actualDelivery: statusResult.actualDelivery || shipment.actualDelivery
            });
            
            // Record status change event (with deduplication)
            await recordStatusChangeWithDeduplication(
                shipment.id,
                shipment.status,
                statusResult.newStatus,
                null, // userData
                'Automatic status update from scheduled polling',
                carrierInfo.carrier
            );
            
            // Record tracking updates if available
            if (statusResult.trackingUpdates && statusResult.trackingUpdates.length > 0) {
                await recordTrackingUpdateWithDeduplication(
                    shipment.id,
                    statusResult.trackingUpdates,
                    carrierInfo.carrier
                );
            }
            
            return { updated: true, newStatus: statusResult.newStatus };
        } else {
            // Update last poll time even if no status change
            await db.collection('shipments').doc(shipment.id).update({
                lastStatusPoll: admin.firestore.Timestamp.now(),
                statusLastChecked: admin.firestore.Timestamp.now()
            });
            
            console.log(`📋 No status change for ${shipment.shipmentID}`);
            return { updated: false };
        }
        
    } catch (error) {
        console.error(`❌ Error polling ${shipment.shipmentID}:`, error);
        
        // Update last poll time even on error to prevent constant retrying
        try {
            await db.collection('shipments').doc(shipment.id).update({
                lastStatusPoll: admin.firestore.Timestamp.now(),
                lastPollError: error.message
            });
        } catch (updateError) {
            console.error('Failed to update poll timestamp:', updateError);
        }
        
        throw error;
    }
}

/**
 * Determine carrier information and polling capabilities
 */
async function determineCarrierInfo(shipment) {
    let carrier = null;
    let trackingNumber = null;
    let bookingReferenceNumber = null;
    let canPoll = shouldPollShipment(shipment);

    // Get the carrier name for pattern matching
    const carrierName = shipment.selectedRate?.carrier || 
                       shipment.selectedRateRef?.carrier || 
                       shipment.carrier || '';
    const lowerCarrierName = carrierName.toLowerCase();

    // Priority 1: Check for explicit eShipPlus identifiers
    const isEShipPlusExplicit =
        shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
        shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
        shipment.selectedRate?.sourceCarrierName === 'eShipPlus' ||
        shipment.selectedRateRef?.sourceCarrierName === 'eShipPlus';

    // Priority 2: Check for freight carrier patterns (eShipPlus sub-carriers)
    const freightPatterns = [
        'freight', 'ltl', 'fedex freight', 'road runner', 'roadrunner',
        'estes', 'yrc', 'xpo', 'old dominion', 'odfl', 'saia', 'ward'
    ];
    const isEShipPlusPattern = freightPatterns.some(pattern => lowerCarrierName.includes(pattern));

    if (isEShipPlusExplicit || isEShipPlusPattern) {
        carrier = 'eShipPlus';
        bookingReferenceNumber = shipment.carrierBookingConfirmation?.confirmationNumber ||
                                shipment.carrierBookingConfirmation?.bookingReferenceNumber ||
                                shipment.carrierBookingConfirmation?.proNumber;
        canPoll = canPoll && !!bookingReferenceNumber;
        
        if (isEShipPlusPattern && !isEShipPlusExplicit) {
            console.log(`🔍 Detected eShipPlus sub-carrier: ${carrierName}`);
        }
    }
    // Check for Canpar
    else if (lowerCarrierName.includes('canpar')) {
        carrier = 'Canpar';
        trackingNumber = shipment.trackingNumber ||
                        shipment.selectedRate?.TrackingNumber ||
                        shipment.selectedRate?.Barcode ||
                        shipment.carrierBookingConfirmation?.trackingNumber;
        canPoll = canPoll && !!trackingNumber;
    }
    // Check for Polaris Transportation
    else if (lowerCarrierName.includes('polaris')) {
        carrier = 'Polaris Transportation';
        trackingNumber = shipment.carrierBookingConfirmation?.confirmationNumber ||
                        shipment.carrierBookingConfirmation?.proNumber ||
                        shipment.trackingNumber;
        canPoll = canPoll && !!trackingNumber;
    }
    // Default carrier detection
    else {
        carrier = carrierName || 'Unknown';
        trackingNumber = shipment.trackingNumber ||
                        shipment.carrierBookingConfirmation?.trackingNumber ||
                        shipment.carrierBookingConfirmation?.proNumber;
        canPoll = false; // Default to not polling unknown carriers
    }

    return {
        carrier,
        trackingNumber,
        bookingReferenceNumber,
        canPoll
    };
}

/**
 * Check carrier status using the appropriate API
 */
async function checkCarrierStatus(shipment, carrierInfo) {
    const { carrier, trackingNumber, bookingReferenceNumber } = carrierInfo;
    
    try {
        // Use the internal checkShipmentStatus function
        const { checkShipmentStatusInternal } = require('../checkShipmentStatus');
        
        const requestParams = {
            shipmentId: shipment.id,
            carrier: carrier
        };
        
        // Add appropriate tracking identifier
        if (carrier === 'eShipPlus' && bookingReferenceNumber) {
            requestParams.bookingReferenceNumber = bookingReferenceNumber;
        } else if (trackingNumber) {
            requestParams.trackingNumber = trackingNumber;
        }
        
        // Add carrierID for better carrier identification
        if (shipment.selectedRate?.displayCarrierId) {
            requestParams.carrierID = shipment.selectedRate.displayCarrierId;
        } else if (shipment.selectedRateRef?.displayCarrierId) {
            requestParams.carrierID = shipment.selectedRateRef.displayCarrierId;
        }
        
        console.log(`🔍 Checking status for ${shipment.shipmentID} with ${carrier}...`);
        
        // Call the internal status check function
        const result = await checkShipmentStatusInternal(requestParams);
        
        if (result.success !== false) {
            const statusChanged = shipment.status !== result.status;
            
            return {
                success: true,
                statusChanged,
                newStatus: result.status,
                trackingData: result,
                trackingUpdates: result.trackingUpdates || [],
                estimatedDelivery: result.estimatedDelivery,
                actualDelivery: result.actualDelivery
            };
        } else {
            console.warn(`⚠️  Status check failed for ${shipment.shipmentID}:`, result.error);
            return {
                success: false,
                error: result.error
            };
        }
        
    } catch (error) {
        console.error(`❌ Error checking status for ${shipment.shipmentID}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Record status change with smart deduplication
 */
async function recordStatusChangeWithDeduplication(shipmentId, fromStatus, toStatus, userData, reason, carrier) {
    try {
        // Check for recent duplicate status change events
        const recentEventsRef = db.collection('shipmentEvents')
            .where('shipmentId', '==', shipmentId)
            .where('eventType', '==', 'status_update')
            .orderBy('timestamp', 'desc')
            .limit(5);
        
        const recentEventsSnapshot = await recentEventsRef.get();
        
        // Check if we already have this exact status change in the last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        for (const doc of recentEventsSnapshot.docs) {
            const event = doc.data();
            const eventTime = event.timestamp.toDate();
            
            if (eventTime > oneHourAgo &&
                event.statusChange?.from === fromStatus &&
                event.statusChange?.to === toStatus &&
                event.source === 'system_polling') {
                
                console.log(`⏭️  Skipping duplicate status change event for ${shipmentId}: ${fromStatus} → ${toStatus}`);
                return; // Skip duplicate
            }
        }
        
        // Record the status change
        await recordStatusChange(
            shipmentId,
            fromStatus,
            toStatus,
            userData,
            reason,
            'system_polling' // Mark as system-generated
        );
        
        console.log(`✅ Recorded status change for ${shipmentId}: ${fromStatus} → ${toStatus}`);
        
    } catch (error) {
        console.error('Error recording status change with deduplication:', error);
        // Still try to record without deduplication as fallback
        await recordStatusChange(shipmentId, fromStatus, toStatus, userData, reason, 'system_polling');
    }
}

/**
 * Record tracking updates with smart deduplication
 */
async function recordTrackingUpdateWithDeduplication(shipmentId, trackingUpdates, carrier) {
    try {
        if (!trackingUpdates || trackingUpdates.length === 0) return;
        
        // Get recent tracking events to check for duplicates
        const recentTrackingRef = db.collection('shipmentEvents')
            .where('shipmentId', '==', shipmentId)
            .where('eventType', '==', 'tracking_update')
            .orderBy('timestamp', 'desc')
            .limit(10);
        
        const recentTrackingSnapshot = await recentTrackingRef.get();
        const recentEvents = recentTrackingSnapshot.docs.map(doc => doc.data());
        
        // Filter out duplicate tracking updates
        const newUpdates = trackingUpdates.filter(update => {
            const updateHash = generateTrackingUpdateHash(update);
            
            // Check if we already have this exact update
            return !recentEvents.some(event => 
                event.trackingUpdateHash === updateHash ||
                (event.trackingData && 
                 event.trackingData.status === update.status &&
                 event.trackingData.description === update.description &&
                 Math.abs(new Date(event.trackingData.timestamp) - new Date(update.timestamp)) < 60000) // Within 1 minute
            );
        });
        
        if (newUpdates.length === 0) {
            console.log(`⏭️  No new tracking updates for ${shipmentId}`);
            return;
        }
        
        // Record new tracking updates with hash for future deduplication
        for (const update of newUpdates) {
            const trackingUpdateHash = generateTrackingUpdateHash(update);
            
            await db.collection('shipmentEvents').add({
                shipmentId,
                eventType: 'tracking_update',
                title: update.status || 'Tracking Update',
                description: update.description || 'Shipment tracking update',
                timestamp: admin.firestore.Timestamp.fromDate(new Date(update.timestamp || Date.now())),
                trackingData: update,
                trackingUpdateHash,
                source: 'system_polling',
                carrier,
                metadata: {
                    automated: true,
                    pollingGenerated: true
                }
            });
        }
        
        console.log(`✅ Recorded ${newUpdates.length} new tracking updates for ${shipmentId}`);
        
    } catch (error) {
        console.error('Error recording tracking updates with deduplication:', error);
        // Fallback to original function
        await recordTrackingUpdate(shipmentId, trackingUpdates, carrier);
    }
}

/**
 * Generate a hash for tracking updates to detect duplicates
 */
function generateTrackingUpdateHash(update) {
    const crypto = require('crypto');
    const hashData = {
        status: update.status,
        description: update.description,
        location: update.location,
        timestamp: new Date(update.timestamp).toISOString().substring(0, 16) // Round to minute for slight timing differences
    };
    
    return crypto
        .createHash('md5')
        .update(JSON.stringify(hashData))
        .digest('hex');
}

function shouldPollShipment(shipment) {
    const now = Date.now();
    const lastPoll = shipment.lastStatusPoll?.toDate ? shipment.lastStatusPoll.toDate() : (shipment.lastStatusPoll || new Date(0));
    const type = shipment.shipmentType || shipment.shipmentInfo?.shipmentType || '';
    const status = (shipment.status || '').toLowerCase();

    // Terminal states: never poll
    if ([
        'delivered', 'cancelled', 'void', 'canceled', 'voided'
    ].includes(status)) {
        return false;
    }

    // Freight: poll every 12 hours
    if (type.toLowerCase().includes('freight') || type.toLowerCase().includes('ltl')) {
        return now - lastPoll.getTime() > 12 * 60 * 60 * 1000;
    }

    // Courier: escalate for in transit/out for delivery
    if ([
        'in transit', 'out for delivery'
    ].includes(status)) {
        return now - lastPoll.getTime() > 10 * 60 * 1000; // 10 minutes
    }

    // Courier: other statuses, poll every 6 hours
    return now - lastPoll.getTime() > 6 * 60 * 60 * 1000;
} 