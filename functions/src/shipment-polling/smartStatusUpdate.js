const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { recordStatusChange, recordTrackingUpdate } = require('../utils/shipmentEvents');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Core smart status update logic shared between regular and force updates
 */
async function performSmartStatusUpdate(shipmentId, force = false, userId) {
    console.log(`🔄 Smart status update requested for shipment: ${shipmentId}${force ? ' (FORCED)' : ''}`);

    try {
        // Get shipment document
        const shipmentDoc = await db.collection('shipments').doc(shipmentId).get();
        
        if (!shipmentDoc.exists) {
            throw new HttpsError('not-found', 'Shipment not found');
        }

        const shipment = { id: shipmentDoc.id, ...shipmentDoc.data() };
        
        // Check if we should skip the update based on intelligent rules
        const shouldUpdate = await shouldPerformStatusUpdate(shipment, force);
        
        if (!shouldUpdate.proceed) {
            console.log(`⏭️  Skipping status update for ${shipment.shipmentID}: ${shouldUpdate.reason}`);
            return {
                success: true,
                skipped: true,
                reason: shouldUpdate.reason,
                lastChecked: shipment.statusLastChecked?.toDate()?.toISOString(),
                currentStatus: shipment.status
            };
        }

        // Determine carrier and tracking info
        const carrierInfo = await determineCarrierInfo(shipment);
        
        if (!carrierInfo.canUpdate) {
            console.log(`⏭️  Cannot update status for ${shipment.shipmentID}: ${carrierInfo.reason}`);
            return {
                success: true,
                skipped: true,
                reason: carrierInfo.reason,
                currentStatus: shipment.status
            };
        }

        // Perform the status check
        const statusResult = await performSmartStatusCheck(shipment, carrierInfo, userId);

        if (statusResult.success) {
            console.log(`✅ Smart status update completed for ${shipment.shipmentID}`);
            return {
                success: true,
                updated: statusResult.updated,
                statusChanged: statusResult.statusChanged,
                previousStatus: statusResult.previousStatus,
                newStatus: statusResult.newStatus,
                trackingUpdatesCount: statusResult.trackingUpdatesCount || 0,
                lastChecked: new Date().toISOString()
            };
        } else {
            console.warn(`⚠️  Smart status update failed for ${shipment.shipmentID}:`, statusResult.error);
            return {
                success: false,
                error: statusResult.error,
                currentStatus: shipment.status
            };
        }

    } catch (error) {
        console.error(`❌ Error in smart status update for ${shipmentId}:`, error);
        throw new HttpsError('internal', `Status update failed: ${error.message}`);
    }
}

/**
 * Smart status update function for real-time checks when users visit shipment pages
 * This includes intelligent deduplication and only updates when necessary
 */
exports.smartStatusUpdate = onCall(
    {
        timeoutSeconds: 60,
        memory: '1GiB'
    },
    async (request) => {
        // Validate authentication
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { shipmentId, force = false } = request.data;

        if (!shipmentId) {
            throw new HttpsError('invalid-argument', 'shipmentId is required');
        }

        return await performSmartStatusUpdate(shipmentId, force, request.auth.uid);
    });

/**
 * Determine if we should perform a status update based on intelligent rules
 */
async function shouldPerformStatusUpdate(shipment, force = false) {
    // Always update if forced
    if (force) {
        return { proceed: true, reason: 'Force update requested' };
    }

    // Don't update if shipment is in final state
    const finalStates = ['delivered', 'cancelled', 'void'];
    if (finalStates.includes(shipment.status?.toLowerCase())) {
        return { 
            proceed: false, 
            reason: `Shipment is in final state: ${shipment.status}` 
        };
    }

    // Don't update if shipment is too new (less than 2 minutes old)
    const createdAt = shipment.createdAt?.toDate() || new Date();
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    if (createdAt > twoMinutesAgo) {
        return { 
            proceed: false, 
            reason: 'Shipment is too new for status checking' 
        };
    }

    // Check last status check time
    const lastChecked = shipment.statusLastChecked?.toDate();
    const minimumInterval = 5 * 60 * 1000; // 5 minutes minimum between checks
    
    if (lastChecked && (Date.now() - lastChecked.getTime()) < minimumInterval) {
        return { 
            proceed: false, 
            reason: 'Status checked recently, minimum interval not met' 
        };
    }

    // Check if there have been too many recent status checks (rate limiting)
    const recentChecks = await countRecentStatusChecks(shipment.id);
    if (recentChecks > 10) { // Max 10 checks per hour
        return { 
            proceed: false, 
            reason: 'Rate limit exceeded - too many recent status checks' 
        };
    }

    return { proceed: true, reason: 'Status update conditions met' };
}

/**
 * Count recent status checks for rate limiting
 */
async function countRecentStatusChecks(shipmentId) {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        const recentEventsRef = db.collection('shipmentEvents')
            .where('shipmentId', '==', shipmentId)
            .where('eventType', 'in', ['status_update', 'status_check'])
            .where('timestamp', '>', admin.firestore.Timestamp.fromDate(oneHourAgo));
        
        const snapshot = await recentEventsRef.get();
        return snapshot.size;
    } catch (error) {
        console.warn('Error counting recent status checks:', error);
        return 0; // Assume no recent checks if query fails
    }
}

/**
 * Determine carrier information and update capabilities
 */
async function determineCarrierInfo(shipment) {
    let carrier = null;
    let trackingNumber = null;
    let bookingReferenceNumber = null;
    let canUpdate = false;
    let reason = '';

    // Enhanced carrier detection logic
    const displayCarrierScac = shipment.selectedRate?.displayCarrierScac || 
                              shipment.selectedRateRef?.displayCarrierScac ||
                              shipment.displayCarrierScac;
    
    const sourceCarrier = shipment.selectedRate?.sourceCarrier ||
                         shipment.selectedRateRef?.sourceCarrier ||
                         shipment.sourceCarrier;
    
    const carrierName = shipment.selectedRate?.carrier ||
                       shipment.selectedRateRef?.carrier ||
                       shipment.carrier ||
                       shipment.selectedRate?.rawBookingAPIResponse?.BookedRate?.CarrierName ||
                       shipment.rawBookingAPIResponse?.BookedRate?.CarrierName;

    console.log(`🔍 Carrier detection for shipment ${shipment.shipmentID}:`, {
        displayCarrierScac,
        sourceCarrier,
        carrierName,
        selectedRateDisplayCarrierId: shipment.selectedRate?.displayCarrierId,
        selectedRateRefDisplayCarrierId: shipment.selectedRateRef?.displayCarrierId
    });

    // Check for eShipPlus (primary integration)
    if (shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
        shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
        shipment.selectedRate?.sourceCarrierName === 'eShipPlus' ||
        shipment.selectedRateRef?.sourceCarrierName === 'eShipPlus' ||
        sourceCarrier === 'ESHIPPLUS') {
        
        carrier = 'eShipPlus';
        bookingReferenceNumber = shipment.carrierBookingConfirmation?.confirmationNumber ||
                                shipment.carrierBookingConfirmation?.bookingReferenceNumber ||
                                shipment.carrierBookingConfirmation?.proNumber;
        canUpdate = !!bookingReferenceNumber;
        reason = canUpdate ? 'eShipPlus carrier supported' : 'Missing booking reference number for eShipPlus';
        
        console.log(`✅ Detected eShipPlus carrier: ${carrierName}, bookingRef: ${bookingReferenceNumber}`);
    }
    // Ward Trucking (eShipPlus integration) - Enhanced detection
    else if (displayCarrierScac === 'WARD' ||
             carrierName?.toLowerCase().includes('ward') ||
             (sourceCarrier === 'ESHIPPLUS' && carrierName?.toLowerCase().includes('ward'))) {
        
        carrier = 'eShipPlus'; // Ward Trucking uses eShipPlus integration
        bookingReferenceNumber = shipment.carrierBookingConfirmation?.confirmationNumber ||
                                shipment.carrierBookingConfirmation?.bookingReferenceNumber ||
                                shipment.carrierBookingConfirmation?.proNumber;
        canUpdate = !!bookingReferenceNumber;
        reason = canUpdate ? 'Ward Trucking (via eShipPlus) supported' : 'Missing booking reference for Ward Trucking';
        
        console.log(`✅ Detected Ward Trucking via eShipPlus, bookingRef: ${bookingReferenceNumber}`);
    }
    // Other freight carriers via eShipPlus
    else if (sourceCarrier === 'ESHIPPLUS' || 
             (carrierName && isFreightCarrier(carrierName))) {
        
        carrier = 'eShipPlus';
        bookingReferenceNumber = shipment.carrierBookingConfirmation?.confirmationNumber ||
                                shipment.carrierBookingConfirmation?.bookingReferenceNumber ||
                                shipment.carrierBookingConfirmation?.proNumber;
        canUpdate = !!bookingReferenceNumber;
        reason = canUpdate ? `${carrierName} (via eShipPlus) supported` : `Missing booking reference for ${carrierName}`;
        
        console.log(`✅ Detected freight carrier ${carrierName} via eShipPlus, bookingRef: ${bookingReferenceNumber}`);
    }
    // Check for Canpar
    else if (carrierName?.toLowerCase().includes('canpar') ||
             displayCarrierScac === 'CANPAR') {
        
        carrier = 'Canpar';
        trackingNumber = shipment.trackingNumber ||
                        shipment.selectedRate?.TrackingNumber ||
                        shipment.selectedRate?.Barcode ||
                        shipment.carrierBookingConfirmation?.trackingNumber;
        canUpdate = !!trackingNumber;
        reason = canUpdate ? 'Canpar carrier supported' : 'Missing tracking number for Canpar';
        
        console.log(`✅ Detected Canpar carrier, trackingNumber: ${trackingNumber}`);
    }
    // Check for Polaris Transportation
    else if (carrierName?.toLowerCase().includes('polaris') ||
             displayCarrierScac === 'POLARIS') {
        
        carrier = 'Polaris Transportation';
        trackingNumber = shipment.carrierBookingConfirmation?.confirmationNumber ||
                        shipment.carrierBookingConfirmation?.proNumber ||
                        shipment.trackingNumber;
        canUpdate = !!trackingNumber;
        reason = canUpdate ? 'Polaris Transportation carrier supported' : 'Missing confirmation number for Polaris Transportation';
        
        console.log(`✅ Detected Polaris Transportation, trackingNumber: ${trackingNumber}`);
    }
    // Default carrier detection
    else {
        carrier = carrierName || 'Unknown';
        canUpdate = false;
        reason = `Carrier ${carrier} not supported for automatic status updates`;
        
        console.log(`❌ Unsupported carrier: ${carrier}`);
    }

    return {
        carrier,
        trackingNumber,
        bookingReferenceNumber,
        canUpdate,
        reason
    };
}

/**
 * Helper function to identify freight carriers that typically use eShipPlus
 */
function isFreightCarrier(carrierName) {
    const freightCarriers = [
        'fedex freight', 'road runner', 'estes', 'yrc', 'xpo', 
        'old dominion', 'saia', 'ward', 'ltl', 'freight'
    ];
    
    const lowerCarrierName = carrierName.toLowerCase();
    return freightCarriers.some(freightCarrier => 
        lowerCarrierName.includes(freightCarrier)
    );
}

/**
 * Perform smart status check with deduplication
 */
async function performSmartStatusCheck(shipment, carrierInfo, userId) {
    const { carrier, trackingNumber, bookingReferenceNumber } = carrierInfo;
    
    try {
        console.log(`🔍 Smart status check for ${shipment.shipmentID} with ${carrier}...`);
        console.log(`📋 Carrier info:`, {
            carrier,
            trackingNumber,
            bookingReferenceNumber,
            canUpdate: carrierInfo.canUpdate,
            reason: carrierInfo.reason
        });
        
        // Use the shared status checker module
        const { checkStatus } = require('../utils/statusChecker');
        
        const requestParams = {
            shipmentId: shipment.id,
            carrier: carrier
        };
        
        // Add appropriate tracking identifier
        if (carrier === 'eShipPlus' && bookingReferenceNumber) {
            requestParams.bookingReferenceNumber = bookingReferenceNumber;
            console.log(`📦 Using booking reference for eShipPlus: ${bookingReferenceNumber}`);
        } else if (trackingNumber) {
            requestParams.trackingNumber = trackingNumber;
            console.log(`📦 Using tracking number: ${trackingNumber}`);
        }
        
        // Add display carrier SCAC if available
        const displayCarrierScac = shipment.selectedRate?.displayCarrierScac || 
                                  shipment.selectedRateRef?.displayCarrierScac ||
                                  shipment.displayCarrierScac;
        if (displayCarrierScac) {
            requestParams.displayCarrierScac = displayCarrierScac;
            console.log(`🏷️  Using displayCarrierScac: ${displayCarrierScac}`);
        }
        
        console.log(`📤 Calling shared checkStatus with:`, {
            shipmentId: requestParams.shipmentId,
            carrier: requestParams.carrier,
            displayCarrierScac: requestParams.displayCarrierScac,
            hasBookingRef: !!requestParams.bookingReferenceNumber,
            hasTrackingNumber: !!requestParams.trackingNumber
        });
        
        // Record the status check attempt
        await recordStatusCheckEvent(shipment.id, userId, carrier);
        
        // Call the shared status check function
        const result = await checkStatus(requestParams);
        
        console.log(`📥 checkStatus result:`, {
            success: result.success,
            status: result.status,
            error: result.error,
            hasTrackingUpdates: !!(result.trackingUpdates && result.trackingUpdates.length > 0)
        });
        
        if (result.success) {
            const statusChanged = shipment.status !== result.status;
            const previousStatus = shipment.status;
            
            console.log(`📊 Status comparison: ${previousStatus} -> ${result.status} (changed: ${statusChanged})`);
            
            // Update shipment document
            const updateData = {
                statusLastChecked: admin.firestore.Timestamp.now(),
                carrierTrackingData: result,
                lastSmartUpdate: admin.firestore.Timestamp.now(),
                lastUpdateSource: 'smart_status_update'
            };
            
            if (statusChanged) {
                updateData.status = result.status;
                updateData.statusUpdatedAt = admin.firestore.Timestamp.now();
                
                if (result.estimatedDelivery) {
                    updateData.estimatedDelivery = admin.firestore.Timestamp.fromDate(new Date(result.estimatedDelivery));
                }
                
                if (result.actualDelivery) {
                    updateData.actualDelivery = admin.firestore.Timestamp.fromDate(new Date(result.actualDelivery));
                }
                
                console.log(`📝 Updating shipment status to: ${result.status}`);
            }
            
            await db.collection('shipments').doc(shipment.id).update(updateData);
            
            // Record status change event if status changed (with smart deduplication)
            if (statusChanged) {
                await recordStatusChangeWithSmartDeduplication(
                    shipment.id,
                    previousStatus,
                    result.status,
                    { userId, email: null }, // Basic user data
                    'Status updated via smart status check',
                    carrier
                );
            }
            
            // Record tracking updates if available (with smart deduplication)
            let trackingUpdatesCount = 0;
            if (result.trackingUpdates && result.trackingUpdates.length > 0) {
                trackingUpdatesCount = await recordTrackingUpdatesWithSmartDeduplication(
                    shipment.id,
                    result.trackingUpdates,
                    carrier
                );
                console.log(`📋 Recorded ${trackingUpdatesCount} tracking updates`);
            }
            
            return {
                success: true,
                updated: true,
                statusChanged,
                previousStatus,
                newStatus: result.status,
                trackingUpdatesCount,
                carrierData: result
            };
        } else {
            console.warn(`⚠️  Smart status check failed for ${shipment.shipmentID}:`, result.error);
            return {
                success: false,
                error: result.error || 'Status check returned unsuccessful result'
            };
        }
        
    } catch (error) {
        console.error(`❌ Error in smart status check for ${shipment.shipmentID}:`, {
            error: error.message,
            stack: error.stack,
            carrier,
            hasBookingRef: !!bookingReferenceNumber,
            hasTrackingNumber: !!trackingNumber
        });
        return {
            success: false,
            error: `Status check failed: ${error.message}`
        };
    }
}

/**
 * Record status check event for auditing
 */
async function recordStatusCheckEvent(shipmentId, userId, carrier) {
    try {
        await db.collection('shipmentEvents').add({
            shipmentId,
            eventType: 'status_check',
            title: 'Status Check',
            description: `Status checked via smart update system`,
            timestamp: admin.firestore.Timestamp.now(),
            source: 'smart_status_update',
            carrier,
            userData: {
                userId,
                automated: false,
                userInitiated: true
            },
            metadata: {
                checkType: 'smart_update',
                userTriggered: true
            }
        });
    } catch (error) {
        console.warn('Failed to record status check event:', error);
        // Don't fail the main operation if event recording fails
    }
}

/**
 * Record status change with smart deduplication
 */
async function recordStatusChangeWithSmartDeduplication(shipmentId, fromStatus, toStatus, userData, reason, carrier) {
    try {
        // Check for recent duplicate status change events
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        const recentEventsRef = db.collection('shipmentEvents')
            .where('shipmentId', '==', shipmentId)
            .where('eventType', '==', 'status_update')
            .where('timestamp', '>', admin.firestore.Timestamp.fromDate(thirtyMinutesAgo))
            .orderBy('timestamp', 'desc')
            .limit(3);
        
        const recentEventsSnapshot = await recentEventsRef.get();
        
        // Check if we already have this exact status change recently
        for (const doc of recentEventsSnapshot.docs) {
            const event = doc.data();
            
            if (event.statusChange?.from === fromStatus &&
                event.statusChange?.to === toStatus) {
                
                console.log(`⏭️  Skipping duplicate status change event for ${shipmentId}: ${fromStatus} → ${toStatus}`);
                return false; // Indicate duplicate was skipped
            }
        }
        
        // Record the status change
        await recordStatusChange(
            shipmentId,
            fromStatus,
            toStatus,
            userData,
            reason,
            'smart_status_update'
        );
        
        console.log(`✅ Recorded smart status change for ${shipmentId}: ${fromStatus} → ${toStatus}`);
        return true; // Indicate status change was recorded
        
    } catch (error) {
        console.error('Error recording status change with smart deduplication:', error);
        // Still try to record without deduplication as fallback
        await recordStatusChange(shipmentId, fromStatus, toStatus, userData, reason, 'smart_status_update');
        return true;
    }
}

/**
 * Record tracking updates with smart deduplication
 */
async function recordTrackingUpdatesWithSmartDeduplication(shipmentId, trackingUpdates, carrier) {
    try {
        if (!trackingUpdates || trackingUpdates.length === 0) return 0;
        
        // Get recent tracking events to check for duplicates
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        
        const recentTrackingRef = db.collection('shipmentEvents')
            .where('shipmentId', '==', shipmentId)
            .where('eventType', '==', 'tracking_update')
            .where('timestamp', '>', admin.firestore.Timestamp.fromDate(twoHoursAgo))
            .orderBy('timestamp', 'desc')
            .limit(20);
        
        const recentTrackingSnapshot = await recentTrackingRef.get();
        const recentEvents = recentTrackingSnapshot.docs.map(doc => doc.data());
        
        // Filter out duplicate tracking updates using multiple strategies
        const newUpdates = trackingUpdates.filter(update => {
            const updateHash = generateTrackingUpdateHash(update);
            
            // Check if we already have this exact update
            return !recentEvents.some(event => {
                // Hash-based deduplication
                if (event.trackingUpdateHash === updateHash) {
                    return true;
                }
                
                // Content-based deduplication
                if (event.trackingData && 
                    event.trackingData.status === update.status &&
                    event.trackingData.description === update.description) {
                    
                    // Check if timestamps are very close (within 5 minutes)
                    const eventTime = new Date(event.trackingData.timestamp);
                    const updateTime = new Date(update.timestamp);
                    const timeDiff = Math.abs(eventTime - updateTime);
                    
                    if (timeDiff < 5 * 60 * 1000) {
                        return true; // Consider it a duplicate
                    }
                }
                
                return false;
            });
        });
        
        if (newUpdates.length === 0) {
            console.log(`⏭️  No new tracking updates for ${shipmentId}`);
            return 0;
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
                source: 'smart_status_update',
                carrier,
                metadata: {
                    automated: false,
                    userInitiated: true,
                    smartUpdate: true
                }
            });
        }
        
        console.log(`✅ Recorded ${newUpdates.length} new tracking updates for ${shipmentId}`);
        return newUpdates.length;
        
    } catch (error) {
        console.error('Error recording tracking updates with smart deduplication:', error);
        // Fallback to original function
        await recordTrackingUpdate(shipmentId, trackingUpdates, carrier);
        return trackingUpdates.length;
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
        timestamp: new Date(update.timestamp).toISOString().substring(0, 16) // Round to minute
    };
    
    return crypto
        .createHash('md5')
        .update(JSON.stringify(hashData))
        .digest('hex');
}

/**
 * Force status refresh function that bypasses normal update rules
 * This is used for manual refreshes and always performs the update
 */
exports.forceStatusRefresh = onCall(
    {
        timeoutSeconds: 60,
        memory: '1GiB'
    },
    async (request) => {
        // Validate authentication
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { shipmentId } = request.data;

        if (!shipmentId) {
            throw new HttpsError('invalid-argument', 'shipmentId is required');
        }

        // Always force the update
        return await performSmartStatusUpdate(shipmentId, true, request.auth.uid);
    });

// Export both functions
module.exports = {
    smartStatusUpdate: exports.smartStatusUpdate,
    forceStatusRefresh: exports.forceStatusRefresh,
    performSmartStatusUpdate
}; 