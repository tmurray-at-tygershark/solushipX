/**
 * Test script for legacy field cleanup
 * Run this in the browser console to clean up legacy fields
 */

import { previewLegacyFieldCleanup, cleanupLegacyShipmentFields } from './dataCleanup';

/**
 * Test the legacy field cleanup functionality
 */
export const testLegacyCleanup = async () => {
    console.log('🧪 Testing Legacy Field Cleanup');
    console.log('================================');
    
    try {
        // First, preview what would be cleaned up
        console.log('\n1️⃣ Previewing cleanup...');
        const previewResults = await previewLegacyFieldCleanup();
        
        if (previewResults.withLegacyFields === 0) {
            console.log('✨ No legacy fields found! Database is already clean.');
            return previewResults;
        }
        
        // Ask for confirmation
        const shouldProceed = confirm(
            `Found ${previewResults.withLegacyFields} documents with legacy fields.\n\n` +
            `Legacy fields to be removed:\n` +
            `- selectedRate: ${previewResults.fieldsFound.selectedRate} documents\n` +
            `- rateDetails: ${previewResults.fieldsFound.rateDetails} documents\n` +
            `- shipmentId: ${previewResults.fieldsFound.shipmentId} documents\n` +
            `- readableShipmentID: ${previewResults.fieldsFound.readableShipmentID} documents\n\n` +
            `Do you want to proceed with the cleanup?`
        );
        
        if (!shouldProceed) {
            console.log('❌ Cleanup cancelled by user');
            return previewResults;
        }
        
        // Perform the actual cleanup
        console.log('\n2️⃣ Performing cleanup...');
        const cleanupResults = await cleanupLegacyShipmentFields();
        
        console.log('\n🎉 Cleanup completed successfully!');
        return {
            preview: previewResults,
            cleanup: cleanupResults
        };
        
    } catch (error) {
        console.error('❌ Error during cleanup test:', error);
        throw error;
    }
};

/**
 * Quick preview only (no changes)
 */
export const quickPreview = async () => {
    console.log('👀 Quick Preview of Legacy Fields');
    console.log('=================================');
    
    try {
        const results = await previewLegacyFieldCleanup();
        
        if (results.withLegacyFields === 0) {
            console.log('✨ Database is clean! No legacy fields found.');
        } else {
            console.log(`⚠️  Found ${results.withLegacyFields} documents that need cleanup.`);
            console.log('💡 Run testLegacyCleanup() to clean them up.');
        }
        
        return results;
    } catch (error) {
        console.error('❌ Error during preview:', error);
        throw error;
    }
};

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
    window.testLegacyCleanup = testLegacyCleanup;
    window.quickPreview = quickPreview;
    
    console.log('🔧 Legacy cleanup functions loaded!');
    console.log('📝 Available commands:');
    console.log('  - quickPreview() - Preview legacy fields without changes');
    console.log('  - testLegacyCleanup() - Preview and clean up legacy fields');
}

export default {
    testLegacyCleanup,
    quickPreview
}; 