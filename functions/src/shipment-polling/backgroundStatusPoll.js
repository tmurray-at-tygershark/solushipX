const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { performSmartStatusUpdate } = require('./smartStatusUpdate');
const { logger } = require('firebase-functions');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Background status polling using smart status update logic
 * Runs every 5 minutes to check active shipments
 */
exports.backgroundStatusPoll = onSchedule(
    {
        schedule: 'every 5 minutes',
        timeZone: 'America/Toronto',
        timeoutSeconds: 540, // 9 minutes max execution time
        memory: '2GiB'
    },
    async (event) => {
        console.log('🔄 Starting background status polling using smart update system...');
        
        try {
            // Get active shipments that need status updates
            const activeShipments = await getActiveShipmentsForPolling();
            
            if (activeShipments.length === 0) {
                console.log('✅ No active shipments found for status polling');
                return;
            }

            console.log(`📦 Found ${activeShipments.length} active shipments for status polling`);

            // Process shipments with controlled concurrency
            const batchSize = 5; // Process 5 shipments at a time
            const results = {
                processed: 0,
                updated: 0,
                errors: 0,
                skipped: 0
            };

            for (let i = 0; i < activeShipments.length; i += batchSize) {
                const batch = activeShipments.slice(i, i + batchSize);
                
                console.log(`📊 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activeShipments.length / batchSize)}`);

                // Process batch in parallel
                const batchPromises = batch.map(async (shipment) => {
                    try {
                        const result = await performSmartStatusUpdate(shipment.id, false, 'system-background-poll');
                        
                        results.processed++;
                        
                        if (result.success) {
                            if (result.statusChanged) {
                                results.updated++;
                                console.log(`✅ Updated ${shipment.shipmentID || shipment.id}: ${result.previousStatus} → ${result.newStatus}`);
                            } else if (result.skipped) {
                                results.skipped++;
                                console.log(`⏭️  Skipped ${shipment.shipmentID || shipment.id}: ${result.reason}`);
                            } else {
                                console.log(`✓ Checked ${shipment.shipmentID || shipment.id}: No change`);
                            }
                        } else {
                            results.errors++;
                            console.warn(`⚠️  Error checking ${shipment.shipmentID || shipment.id}: ${result.error}`);
                        }

                        return result;
                    } catch (error) {
                        results.errors++;
                        console.error(`❌ Exception checking ${shipment.shipmentID || shipment.id}:`, error);
                        return { success: false, error: error.message };
                    }
                });

                // Wait for batch to complete
                await Promise.all(batchPromises);

                // Small delay between batches to avoid overwhelming carrier APIs
                if (i + batchSize < activeShipments.length) {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
                }
            }

            console.log(`🎯 Background polling completed:`, {
                totalShipments: activeShipments.length,
                processed: results.processed,
                updated: results.updated,
                skipped: results.skipped,
                errors: results.errors,
                successRate: `${Math.round((results.processed - results.errors) / results.processed * 100)}%`
            });

            // Log summary to Firestore for monitoring
            await db.collection('systemEvents').add({
                type: 'background_status_poll',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                results,
                totalShipments: activeShipments.length
            });

        } catch (error) {
            console.error('❌ Error in background status polling:', error);
            
            // Log error to Firestore for monitoring
            await db.collection('systemEvents').add({
                type: 'background_status_poll_error',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                error: error.message,
                stack: error.stack
            });
        }
    });

/**
 * Get active shipments that are eligible for background status polling
 */
async function getActiveShipmentsForPolling() {
    try {
        // Get shipments that are in active statuses and eligible for polling
        const activeStatuses = ['booked', 'scheduled', 'in_transit', 'pending'];
        
        // Query for active shipments created more than 2 minutes ago
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        
        const shipmentsSnapshot = await db.collection('shipments')
            .where('status', 'in', activeStatuses)
            .where('createdAt', '<=', twoMinutesAgo)
            .orderBy('createdAt')
            .orderBy('statusLastChecked') // Prioritize shipments that haven't been checked recently
            .limit(100) // Limit to prevent overwhelming the system
            .get();

        const shipments = [];
        
        shipmentsSnapshot.forEach(doc => {
            const data = doc.data();
            
            // Additional filtering for shipments that need checking
            const lastChecked = data.statusLastChecked?.toDate();
            const shouldCheck = !lastChecked || 
                               (Date.now() - lastChecked.getTime()) > (30 * 60 * 1000); // 30 minutes
            
            if (shouldCheck) {
                shipments.push({
                    id: doc.id,
                    ...data,
                    shipmentID: data.shipmentID || doc.id
                });
            }
        });

        console.log(`🔍 Found ${shipments.length} eligible shipments out of ${shipmentsSnapshot.size} active shipments`);
        
        return shipments;

    } catch (error) {
        console.error('Error fetching active shipments for polling:', error);
        return [];
    }
}

module.exports = { backgroundStatusPoll: exports.backgroundStatusPoll }; 