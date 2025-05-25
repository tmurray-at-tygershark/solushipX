/**
 * Test script to verify that selectedRate field is no longer being saved
 * Run this in the browser console after deployment to verify the fix
 */

import { previewLegacyFieldCleanup, cleanupLegacyShipmentFields } from './dataCleanup';

/**
 * Test the deployment to ensure selectedRate is no longer being saved
 */
export const testDeploymentFix = async () => {
    console.log('🧪 Testing Deployment Fix for selectedRate Field');
    console.log('================================================');
    
    try {
        // First, preview what legacy fields exist
        console.log('\n1️⃣ Checking for existing legacy fields...');
        const previewResults = await previewLegacyFieldCleanup();
        
        console.log('\n📊 Current State:');
        console.log(`📄 Total documents: ${previewResults.total}`);
        console.log(`🧹 Documents with legacy fields: ${previewResults.withLegacyFields}`);
        console.log(`✨ Clean documents: ${previewResults.total - previewResults.withLegacyFields}`);
        
        if (previewResults.fieldsFound.selectedRate > 0) {
            console.log(`\n⚠️  Found ${previewResults.fieldsFound.selectedRate} documents with selectedRate field`);
            console.log('💡 These are from before the deployment fix. You can clean them up.');
            
            const shouldCleanup = confirm(
                `Found ${previewResults.fieldsFound.selectedRate} documents with legacy selectedRate fields.\n\n` +
                `Do you want to clean them up now?`
            );
            
            if (shouldCleanup) {
                console.log('\n2️⃣ Cleaning up legacy selectedRate fields...');
                const cleanupResults = await cleanupLegacyShipmentFields();
                
                console.log('\n✅ Cleanup completed!');
                console.log(`🧹 Updated: ${cleanupResults.updated} documents`);
                console.log(`✨ Clean: ${cleanupResults.clean} documents`);
                
                return {
                    preview: previewResults,
                    cleanup: cleanupResults,
                    message: 'Legacy fields cleaned up successfully!'
                };
            } else {
                return {
                    preview: previewResults,
                    message: 'Legacy fields found but cleanup was skipped by user.'
                };
            }
        } else {
            console.log('\n✅ No selectedRate fields found in existing documents!');
            console.log('🎉 The deployment fix is working correctly.');
            
            return {
                preview: previewResults,
                message: 'No legacy selectedRate fields found. Deployment fix is working!'
            };
        }
        
    } catch (error) {
        console.error('❌ Error during deployment test:', error);
        throw error;
    }
};

/**
 * Instructions for testing the fix
 */
export const showTestInstructions = () => {
    console.log('🔧 Testing Instructions for selectedRate Fix');
    console.log('===========================================');
    console.log('');
    console.log('1. Create a new shipment and select a rate');
    console.log('2. Check the shipment document in Firestore');
    console.log('3. Verify that only "selectedRateRef" exists, not "selectedRate"');
    console.log('4. The selectedRateRef should contain only reference data:');
    console.log('   - rateDocumentId');
    console.log('   - rateId');
    console.log('   - carrier');
    console.log('   - service');
    console.log('   - totalCharges');
    console.log('   - transitDays');
    console.log('   - estimatedDeliveryDate');
    console.log('   - currency');
    console.log('   - guaranteed');
    console.log('');
    console.log('5. Full rate details should be in the "shipmentRates" collection');
    console.log('');
    console.log('💡 Run testDeploymentFix() to check for existing legacy fields');
};

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
    window.testDeploymentFix = testDeploymentFix;
    window.showTestInstructions = showTestInstructions;
    
    console.log('🔧 Deployment test functions loaded!');
    console.log('📝 Available commands:');
    console.log('  - testDeploymentFix() - Check and clean up legacy selectedRate fields');
    console.log('  - showTestInstructions() - Show manual testing instructions');
}

export default {
    testDeploymentFix,
    showTestInstructions
}; 