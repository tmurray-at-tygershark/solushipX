const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../functions/service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://solushipx-default-rtdb.firebaseio.com/',
        storageBucket: 'solushipx.firebasestorage.app'
    });
}

const db = admin.firestore();

/**
 * Update all shipments to set invoice status to "not_invoiced"
 */
async function updateAllShipmentsInvoiceStatus() {
    try {
        console.log('🔄 Starting bulk update of shipment invoice status...');
        
        // Get all shipments in batches
        let lastDoc = null;
        let totalUpdated = 0;
        let batchCount = 0;
        const batchSize = 500; // Firestore batch write limit
        
        do {
            console.log(`📦 Processing batch ${batchCount + 1}...`);
            
            // Build query
            let query = db.collection('shipments')
                .orderBy('createdAt')
                .limit(batchSize);
                
            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }
            
            const snapshot = await query.get();
            
            if (snapshot.empty) {
                console.log('✅ No more shipments to process');
                break;
            }
            
            // Create batch for updates
            const batch = db.batch();
            let batchUpdates = 0;
            
            snapshot.docs.forEach(doc => {
                const shipmentData = doc.data();
                
                // Check if shipment already has invoiceStatus set
                if (!shipmentData.invoiceStatus) {
                    // Update shipment with invoice status
                    batch.update(doc.ref, {
                        invoiceStatus: 'not_invoiced',
                        invoiceStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        invoiceStatusUpdatedBy: 'system_script'
                    });
                    batchUpdates++;
                }
            });
            
            // Commit batch if there are updates
            if (batchUpdates > 0) {
                await batch.commit();
                totalUpdated += batchUpdates;
                console.log(`✅ Updated ${batchUpdates} shipments in batch ${batchCount + 1}`);
            } else {
                console.log(`⏭️  No updates needed in batch ${batchCount + 1}`);
            }
            
            // Set up for next batch
            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            batchCount++;
            
            // Add delay to prevent overwhelming Firestore
            if (batchUpdates > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }
            
        } while (lastDoc);
        
        console.log('🎉 Bulk update complete!');
        console.log(`📊 Total shipments updated: ${totalUpdated}`);
        console.log(`📦 Total batches processed: ${batchCount}`);
        
    } catch (error) {
        console.error('❌ Error updating shipment invoice status:', error);
        throw error;
    }
}

/**
 * Verify the updates by checking a sample of shipments
 */
async function verifyUpdates() {
    try {
        console.log('🔍 Verifying updates...');
        
        // Get a sample of shipments to verify
        const sampleQuery = db.collection('shipments')
            .limit(10);
            
        const snapshot = await sampleQuery.get();
        
        let verifiedCount = 0;
        let missingCount = 0;
        
        snapshot.docs.forEach(doc => {
            const shipmentData = doc.data();
            if (shipmentData.invoiceStatus === 'not_invoiced') {
                verifiedCount++;
            } else {
                missingCount++;
                console.log(`⚠️  Shipment ${doc.id} missing invoice status:`, shipmentData.shipmentID || 'No ID');
            }
        });
        
        console.log(`✅ Verified: ${verifiedCount} shipments have correct invoice status`);
        console.log(`⚠️  Missing: ${missingCount} shipments still need invoice status`);
        
    } catch (error) {
        console.error('❌ Error verifying updates:', error);
    }
}

/**
 * Main execution function
 */
async function main() {
    try {
        console.log('🚀 Starting Invoice Status Update Script');
        console.log('==========================================');
        
        // Run the update
        await updateAllShipmentsInvoiceStatus();
        
        // Verify the updates
        await verifyUpdates();
        
        console.log('==========================================');
        console.log('✅ Script completed successfully!');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    updateAllShipmentsInvoiceStatus,
    verifyUpdates
}; 