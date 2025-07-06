const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
    });
}

const db = admin.firestore();

/**
 * Script to fix charge inconsistency in cancelled shipments
 * Addresses the bug where totalCharges shows one value but manualRates charges show "0.00"
 */
async function fixChargeInconsistency() {
    console.log('🔧 Starting charge inconsistency fix for cancelled shipments...');
    
    try {
        // Find all cancelled shipments
        const cancelledShipmentsQuery = await db.collection('shipments')
            .where('status', '==', 'cancelled')
            .get();
        
        console.log(`📊 Found ${cancelledShipmentsQuery.size} cancelled shipments to check`);
        
        let fixedCount = 0;
        let checkedCount = 0;
        const batch = db.batch();
        
        for (const doc of cancelledShipmentsQuery.docs) {
            checkedCount++;
            const shipmentData = doc.data();
            const shipmentId = shipmentData.shipmentID || doc.id;
            
            // Check if this shipment has the charge inconsistency bug
            const hasInconsistency = checkForChargeInconsistency(shipmentData);
            
            if (hasInconsistency.found) {
                console.log(`🐛 Found inconsistency in shipment ${shipmentId}:`, hasInconsistency.details);
                
                // Prepare fix data
                const fixData = prepareChargeConsistencyFix(shipmentData);
                
                // Add to batch update
                batch.update(doc.ref, fixData);
                fixedCount++;
                
                console.log(`✅ Prepared fix for shipment ${shipmentId}`);
                
                // Execute batch every 450 operations (Firestore limit is 500)
                if (fixedCount % 450 === 0) {
                    console.log(`📝 Committing batch of ${fixedCount} fixes...`);
                    await batch.commit();
                    console.log(`✅ Batch committed successfully`);
                }
            } else {
                console.log(`✓ Shipment ${shipmentId} charges are consistent`);
            }
        }
        
        // Commit any remaining updates
        if (fixedCount % 450 !== 0) {
            console.log(`📝 Committing final batch of fixes...`);
            await batch.commit();
            console.log(`✅ Final batch committed successfully`);
        }
        
        console.log(`\n🎉 Charge inconsistency fix completed!`);
        console.log(`📊 Summary:`);
        console.log(`   - Shipments checked: ${checkedCount}`);
        console.log(`   - Shipments fixed: ${fixedCount}`);
        console.log(`   - Shipments already consistent: ${checkedCount - fixedCount}`);
        
    } catch (error) {
        console.error('❌ Error fixing charge inconsistency:', error);
        throw error;
    }
}

/**
 * Check if a shipment has charge inconsistency
 */
function checkForChargeInconsistency(shipmentData) {
    const totalCharges = shipmentData.totalCharges || 0;
    const manualRates = shipmentData.manualRates || [];
    const carrierConfirmationRates = shipmentData.carrierConfirmationRates || [];
    
    // Calculate sum of manual rates charges
    const manualRatesTotal = manualRates.reduce((sum, rate) => {
        const charge = parseFloat(rate.charge) || 0;
        return sum + charge;
    }, 0);
    
    // Calculate sum of carrier confirmation rates charges
    const carrierRatesTotal = carrierConfirmationRates.reduce((sum, rate) => {
        const charge = parseFloat(rate.charge) || 0;
        return sum + charge;
    }, 0);
    
    // Check for inconsistencies
    const inconsistencies = [];
    
    // 1. totalCharges vs manualRates mismatch
    if (totalCharges > 0 && manualRatesTotal === 0 && manualRates.length > 0) {
        inconsistencies.push(`totalCharges (${totalCharges}) but manualRates charges are all 0`);
    }
    
    // 2. totalCharges vs carrierConfirmationRates mismatch
    if (totalCharges > 0 && carrierRatesTotal > 0 && Math.abs(totalCharges - carrierRatesTotal) > 0.01) {
        inconsistencies.push(`totalCharges (${totalCharges}) doesn't match carrierConfirmationRates total (${carrierRatesTotal})`);
    }
    
    // 3. selectedRate inconsistency
    if (shipmentData.selectedRate?.totalCharges && shipmentData.selectedRate.totalCharges !== totalCharges) {
        inconsistencies.push(`selectedRate.totalCharges (${shipmentData.selectedRate.totalCharges}) doesn't match totalCharges (${totalCharges})`);
    }
    
    return {
        found: inconsistencies.length > 0,
        details: {
            totalCharges,
            manualRatesTotal,
            carrierRatesTotal,
            manualRatesCount: manualRates.length,
            carrierRatesCount: carrierConfirmationRates.length,
            inconsistencies
        }
    };
}

/**
 * Prepare fix data to make charges consistent for cancelled shipments
 */
function prepareChargeConsistencyFix(shipmentData) {
    const fixData = {
        // Set all charges to 0 for cancelled shipments
        totalCharges: 0,
        totalCost: 0,
        
        // Update manual rates to have 0 charges
        manualRates: shipmentData.manualRates ? 
            shipmentData.manualRates.map(rate => ({
                ...rate,
                charge: "0.00",
                cost: "0.00"
            })) : [],
            
        // Update carrier confirmation rates to have 0 charges
        carrierConfirmationRates: shipmentData.carrierConfirmationRates ?
            shipmentData.carrierConfirmationRates.map(rate => ({
                ...rate,
                charge: 0,
                cost: 0
            })) : [],
        
        // Update selected rate if it exists
        selectedRate: shipmentData.selectedRate ? {
            ...shipmentData.selectedRate,
            totalCharges: 0,
            totalCost: 0,
            price: 0
        } : null,
        
        // Add metadata about the fix
        chargeInconsistencyFixed: true,
        chargeInconsistencyFixedAt: admin.firestore.FieldValue.serverTimestamp(),
        chargeInconsistencyFixedBy: 'automated-script',
        
        // Update the updatedAt timestamp
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Remove null fields
    Object.keys(fixData).forEach(key => {
        if (fixData[key] === null) {
            delete fixData[key];
        }
    });
    
    return fixData;
}

/**
 * Preview mode - show what would be fixed without making changes
 */
async function previewChargeInconsistencyFix() {
    console.log('👀 Preview mode: Checking for charge inconsistencies...');
    
    try {
        const cancelledShipmentsQuery = await db.collection('shipments')
            .where('status', '==', 'cancelled')
            .limit(50) // Limit for preview
            .get();
        
        console.log(`📊 Checking ${cancelledShipmentsQuery.size} cancelled shipments (preview)`);
        
        let inconsistentCount = 0;
        
        for (const doc of cancelledShipmentsQuery.docs) {
            const shipmentData = doc.data();
            const shipmentId = shipmentData.shipmentID || doc.id;
            
            const hasInconsistency = checkForChargeInconsistency(shipmentData);
            
            if (hasInconsistency.found) {
                inconsistentCount++;
                console.log(`🐛 WOULD FIX - Shipment ${shipmentId}:`, hasInconsistency.details);
            }
        }
        
        console.log(`\n📊 Preview Summary:`);
        console.log(`   - Shipments that would be fixed: ${inconsistentCount}`);
        console.log(`   - Shipments already consistent: ${cancelledShipmentsQuery.size - inconsistentCount}`);
        
    } catch (error) {
        console.error('❌ Error in preview mode:', error);
        throw error;
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const isPreview = args.includes('--preview');
    
    if (isPreview) {
        await previewChargeInconsistencyFix();
    } else {
        console.log('⚠️  This will modify cancelled shipments to fix charge inconsistencies.');
        console.log('⚠️  Run with --preview flag first to see what would be changed.');
        console.log('⚠️  Press Ctrl+C within 5 seconds to cancel...\n');
        
        // 5 second delay for safety
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await fixChargeInconsistency();
    }
    
    console.log('✅ Script completed successfully');
    process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

// Run the script
main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
}); 