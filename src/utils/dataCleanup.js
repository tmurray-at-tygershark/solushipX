import { collection, getDocs, doc, updateDoc, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Clean up redundant fields from shipment documents
 * Removes: selectedRate (full object), readableShipmentID
 * Keeps: selectedRateRef (reference only)
 */
export const cleanupShipmentDocuments = async () => {
    try {
        console.log('Starting shipment document cleanup...');
        
        const shipmentsRef = collection(db, 'shipments');
        const snapshot = await getDocs(shipmentsRef);
        
        const batch = writeBatch(db);
        let updateCount = 0;
        
        snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const docRef = doc(db, 'shipments', docSnapshot.id);
            
            // Check if document has redundant fields
            const hasSelectedRate = data.selectedRate !== undefined;
            const hasReadableShipmentID = data.readableShipmentID !== undefined;
            
            if (hasSelectedRate || hasReadableShipmentID) {
                const updates = {};
                
                // Remove selectedRate field (keep selectedRateRef)
                if (hasSelectedRate) {
                    updates.selectedRate = null; // Set to null to remove field
                    console.log(`Removing selectedRate from shipment ${docSnapshot.id}`);
                }
                
                // Remove readableShipmentID field (shipmentID is already readable)
                if (hasReadableShipmentID) {
                    updates.readableShipmentID = null; // Set to null to remove field
                    console.log(`Removing readableShipmentID from shipment ${docSnapshot.id}`);
                }
                
                // Add updatedAt timestamp
                updates.updatedAt = new Date();
                
                batch.update(docRef, updates);
                updateCount++;
            }
        });
        
        if (updateCount > 0) {
            await batch.commit();
            console.log(`Successfully cleaned up ${updateCount} shipment documents`);
        } else {
            console.log('No shipment documents needed cleanup');
        }
        
        return {
            success: true,
            documentsUpdated: updateCount,
            totalDocuments: snapshot.size
        };
        
    } catch (error) {
        console.error('Error cleaning up shipment documents:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Preview what documents would be cleaned up without making changes
 */
export const previewCleanup = async () => {
    try {
        console.log('Previewing shipment document cleanup...');
        
        const shipmentsRef = collection(db, 'shipments');
        const snapshot = await getDocs(shipmentsRef);
        
        const documentsToClean = [];
        
        snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const hasSelectedRate = data.selectedRate !== undefined;
            const hasReadableShipmentID = data.readableShipmentID !== undefined;
            
            if (hasSelectedRate || hasReadableShipmentID) {
                documentsToClean.push({
                    id: docSnapshot.id,
                    shipmentID: data.shipmentID,
                    hasSelectedRate,
                    hasReadableShipmentID,
                    selectedRateRef: data.selectedRateRef ? 'Present' : 'Missing'
                });
            }
        });
        
        console.log(`Found ${documentsToClean.length} documents that need cleanup:`, documentsToClean);
        
        return {
            totalDocuments: snapshot.size,
            documentsNeedingCleanup: documentsToClean.length,
            documents: documentsToClean
        };
        
    } catch (error) {
        console.error('Error previewing cleanup:', error);
        return {
            error: error.message
        };
    }
};

/**
 * Data cleanup utility for removing legacy fields from shipment documents
 * This script removes fields that are no longer used in the new data structure
 */

/**
 * Remove legacy fields from all shipment documents
 * Legacy fields to remove:
 * - selectedRate (full rate object, replaced by selectedRateRef)
 * - rateDetails (empty object, no longer used)
 * - shipmentId (lowercase, redundant with document ID)
 * - readableShipmentID (replaced by shipmentID)
 * - confirmationNumber (moved to selectedRateRef map)
 */
export const cleanupLegacyShipmentFields = async () => {
    try {
        console.log('Starting cleanup of legacy shipment fields...');
        
        const shipmentsRef = collection(db, 'shipments');
        const querySnapshot = await getDocs(shipmentsRef);
        
        let processedCount = 0;
        let updatedCount = 0;
        
        for (const docSnap of querySnapshot.docs) {
            processedCount++;
            const data = docSnap.data();
            const docId = docSnap.id;
            
            // Check if document has any legacy fields
            const hasLegacyFields = 
                data.hasOwnProperty('selectedRate') ||
                data.hasOwnProperty('rateDetails') ||
                data.hasOwnProperty('shipmentId') ||
                data.hasOwnProperty('readableShipmentID') ||
                data.hasOwnProperty('confirmationNumber');
            
            if (hasLegacyFields) {
                console.log(`Cleaning up document ${docId}...`);
                
                const updateData = {};
                
                // Remove selectedRate field
                if (data.hasOwnProperty('selectedRate')) {
                    updateData.selectedRate = deleteField();
                    console.log(`  - Removing selectedRate field`);
                }
                
                // Remove rateDetails field
                if (data.hasOwnProperty('rateDetails')) {
                    updateData.rateDetails = deleteField();
                    console.log(`  - Removing rateDetails field`);
                }
                
                // Remove shipmentId field (lowercase)
                if (data.hasOwnProperty('shipmentId')) {
                    updateData.shipmentId = deleteField();
                    console.log(`  - Removing shipmentId field`);
                }
                
                // Remove readableShipmentID field
                if (data.hasOwnProperty('readableShipmentID')) {
                    updateData.readableShipmentID = deleteField();
                    console.log(`  - Removing readableShipmentID field`);
                }
                
                // Remove confirmationNumber field (now stored in selectedRateRef)
                if (data.hasOwnProperty('confirmationNumber')) {
                    updateData.confirmationNumber = deleteField();
                    console.log(`  - Removing confirmationNumber field (moved to selectedRateRef)`);
                }
                
                // Update the document
                const docRef = doc(db, 'shipments', docId);
                await updateDoc(docRef, updateData);
                
                updatedCount++;
                console.log(`  ✓ Document ${docId} cleaned up successfully`);
            }
        }
        
        console.log(`\n✅ Cleanup completed!`);
        console.log(`📊 Processed: ${processedCount} documents`);
        console.log(`🧹 Updated: ${updatedCount} documents`);
        console.log(`✨ Clean: ${processedCount - updatedCount} documents (no legacy fields)`);
        
        return {
            processed: processedCount,
            updated: updatedCount,
            clean: processedCount - updatedCount
        };
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    }
};

/**
 * Preview what would be cleaned up without making changes
 */
export const previewLegacyFieldCleanup = async () => {
    try {
        console.log('Previewing legacy field cleanup...');
        
        const shipmentsRef = collection(db, 'shipments');
        const querySnapshot = await getDocs(shipmentsRef);
        
        const results = {
            total: 0,
            withLegacyFields: 0,
            fieldsFound: {
                selectedRate: 0,
                rateDetails: 0,
                shipmentId: 0,
                readableShipmentID: 0,
                confirmationNumber: 0
            }
        };
        
        for (const docSnap of querySnapshot.docs) {
            results.total++;
            const data = docSnap.data();
            
            let hasLegacyFields = false;
            
            if (data.hasOwnProperty('selectedRate')) {
                results.fieldsFound.selectedRate++;
                hasLegacyFields = true;
            }
            
            if (data.hasOwnProperty('rateDetails')) {
                results.fieldsFound.rateDetails++;
                hasLegacyFields = true;
            }
            
            if (data.hasOwnProperty('shipmentId')) {
                results.fieldsFound.shipmentId++;
                hasLegacyFields = true;
            }
            
            if (data.hasOwnProperty('readableShipmentID')) {
                results.fieldsFound.readableShipmentID++;
                hasLegacyFields = true;
            }
            
            if (data.hasOwnProperty('confirmationNumber')) {
                results.fieldsFound.confirmationNumber++;
                hasLegacyFields = true;
            }
            
            if (hasLegacyFields) {
                results.withLegacyFields++;
            }
        }
        
        console.log('\n📋 Cleanup Preview Results:');
        console.log(`📊 Total documents: ${results.total}`);
        console.log(`🧹 Documents with legacy fields: ${results.withLegacyFields}`);
        console.log(`✨ Clean documents: ${results.total - results.withLegacyFields}`);
        console.log('\n🔍 Legacy fields found:');
        console.log(`  - selectedRate: ${results.fieldsFound.selectedRate} documents`);
        console.log(`  - rateDetails: ${results.fieldsFound.rateDetails} documents`);
        console.log(`  - shipmentId: ${results.fieldsFound.shipmentId} documents`);
        console.log(`  - readableShipmentID: ${results.fieldsFound.readableShipmentID} documents`);
        console.log(`  - confirmationNumber: ${results.fieldsFound.confirmationNumber} documents`);
        
        return results;
        
    } catch (error) {
        console.error('❌ Error during preview:', error);
        throw error;
    }
};

// Export both functions as default
export default {
    cleanupLegacyShipmentFields,
    previewLegacyFieldCleanup
}; 