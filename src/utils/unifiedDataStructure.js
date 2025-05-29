/**
 * Unified Data Structure Utilities
 * 
 * This module provides helper functions for working with the unified document ID structure
 * where shipments, rates, documents, and storage all use the same shipment ID for consistency.
 * 
 * Structure:
 * - shipments/{shipmentId} - Main shipment document
 * - shipments/{shipmentId}/rates/{shipmentId} - Rates subcollection using same ID
 * - shipments/{shipmentId}/documents/{shipmentId} - Documents subcollection using same ID
 * - shipmentRates/{shipmentId} - Main rates collection using same ID
 * - shipmentDocuments/{shipmentId} - Main documents collection using same ID
 * - storage: shipment-documents/{shipmentId}/ - Storage folder using same ID
 */

import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    limit 
} from 'firebase/firestore';

/**
 * Get shipment with all related data using unified structure
 * @param {Object} db - Firestore database instance
 * @param {string} shipmentId - Shipment ID
 * @returns {Promise<Object>} Complete shipment data with rates and documents
 */
export const getUnifiedShipmentData = async (db, shipmentId) => {
    try {
        // Get main shipment document
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentSnap = await getDoc(shipmentRef);
        
        if (!shipmentSnap.exists()) {
            throw new Error(`Shipment ${shipmentId} not found`);
        }
        
        const shipmentData = {
            id: shipmentSnap.id,
            ...shipmentSnap.data()
        };
        
        // Get rates using unified structure (shipmentId as rate document ID)
        const unifiedRateRef = doc(db, 'shipmentRates', shipmentId);
        const unifiedRateSnap = await getDoc(unifiedRateRef);
        
        if (unifiedRateSnap.exists()) {
            const rateData = unifiedRateSnap.data();
            if (rateData._isUnifiedStructure) {
                shipmentData.selectedRate = {
                    id: unifiedRateSnap.id,
                    ...rateData
                };
            }
        }
        
        // Also check subcollection
        const subcollectionRateRef = doc(db, 'shipments', shipmentId, 'rates', shipmentId);
        const subcollectionRateSnap = await getDoc(subcollectionRateRef);
        
        if (subcollectionRateSnap.exists() && !shipmentData.selectedRate) {
            shipmentData.selectedRate = {
                id: subcollectionRateSnap.id,
                ...subcollectionRateSnap.data()
            };
        }
        
        // Get documents using unified structure (shipmentId as document ID)
        const unifiedDocRef = doc(db, 'shipmentDocuments', shipmentId);
        const unifiedDocSnap = await getDoc(unifiedDocRef);
        
        shipmentData.documents = [];
        
        if (unifiedDocSnap.exists()) {
            const docData = unifiedDocSnap.data();
            if (docData._isUnifiedStructure) {
                shipmentData.documents.push({
                    id: unifiedDocSnap.id,
                    ...docData
                });
            }
        }
        
        // Also check subcollection
        const subcollectionDocRef = doc(db, 'shipments', shipmentId, 'documents', shipmentId);
        const subcollectionDocSnap = await getDoc(subcollectionDocRef);
        
        if (subcollectionDocSnap.exists()) {
            // Only add if not already found in main collection
            if (!shipmentData.documents.some(doc => doc.id === subcollectionDocSnap.id)) {
                shipmentData.documents.push({
                    id: subcollectionDocSnap.id,
                    ...subcollectionDocSnap.data()
                });
            }
        }
        
        console.log(`Retrieved unified shipment data for ${shipmentId}:`, {
            shipmentExists: true,
            hasRate: !!shipmentData.selectedRate,
            documentsCount: shipmentData.documents.length
        });
        
        return shipmentData;
        
    } catch (error) {
        console.error('Error getting unified shipment data:', error);
        throw error;
    }
};

/**
 * Save rate using unified structure (shipmentId as document ID)
 * @param {Object} db - Firestore database instance
 * @param {string} shipmentId - Shipment ID
 * @param {Object} rateData - Rate data to save
 * @returns {Promise<string>} Rate ID (same as shipment ID)
 */
export const saveUnifiedRate = async (db, shipmentId, rateData) => {
    try {
        const dataToSave = {
            ...rateData,
            shipmentId,
            createdAt: new Date(),
            updatedAt: new Date(),
            _isUnifiedStructure: true,
            migrationNote: 'Created with unified ID structure'
        };

        // Save to main collection using shipment ID as document ID
        const mainRateRef = doc(db, 'shipmentRates', shipmentId);
        await setDoc(mainRateRef, dataToSave);
        
        // Save to subcollection using shipment ID as document ID
        const subcollectionRateRef = doc(db, 'shipments', shipmentId, 'rates', shipmentId);
        await setDoc(subcollectionRateRef, dataToSave);
        
        console.log(`Rate saved with unified ID structure: shipments/${shipmentId}/rates/${shipmentId} and shipmentRates/${shipmentId}`);
        
        return shipmentId; // Return shipment ID as the rate ID
    } catch (error) {
        console.error('Error saving unified rate:', error);
        throw error;
    }
};

/**
 * Save document using unified structure (shipmentId as document ID)
 * @param {Object} db - Firestore database instance
 * @param {string} shipmentId - Shipment ID
 * @param {Object} documentData - Document data to save
 * @returns {Promise<string>} Document ID (same as shipment ID)
 */
export const saveUnifiedDocument = async (db, shipmentId, documentData) => {
    try {
        const dataToSave = {
            ...documentData,
            shipmentId,
            createdAt: new Date(),
            updatedAt: new Date(),
            _isUnifiedStructure: true,
            migrationNote: 'Created with unified ID structure'
        };

        // Save to main collection using shipment ID as document ID
        const mainDocRef = doc(db, 'shipmentDocuments', shipmentId);
        await setDoc(mainDocRef, dataToSave);
        
        // Save to subcollection using shipment ID as document ID
        const subcollectionDocRef = doc(db, 'shipments', shipmentId, 'documents', shipmentId);
        await setDoc(subcollectionDocRef, dataToSave);
        
        console.log(`Document saved with unified ID structure: shipments/${shipmentId}/documents/${shipmentId} and shipmentDocuments/${shipmentId}`);
        
        return shipmentId; // Return shipment ID as the document ID
    } catch (error) {
        console.error('Error saving unified document:', error);
        throw error;
    }
};

/**
 * Get unified storage path for shipment files
 * @param {string} shipmentId - Shipment ID
 * @param {string} filename - File name
 * @returns {string} Storage path
 */
export const getUnifiedStoragePath = (shipmentId, filename) => {
    return `shipment-documents/${shipmentId}/${filename}`;
};

/**
 * Get shipment rates using unified structure
 * @param {Object} db - Firestore database instance
 * @param {string} shipmentId - Shipment ID
 * @returns {Promise<Array>} Array of rate objects
 */
export const getShipmentRates = async (db, shipmentId) => {
    try {
        const rates = [];
        
        // Check main collection first (shipmentId as document ID)
        const mainRateRef = doc(db, 'shipmentRates', shipmentId);
        const mainRateSnap = await getDoc(mainRateRef);
        
        if (mainRateSnap.exists()) {
            const rateData = mainRateSnap.data();
            if (rateData._isUnifiedStructure) {
                rates.push({
                    id: mainRateSnap.id,
                    ...rateData,
                    source: 'unified-main'
                });
            }
        }
        
        // Check subcollection
        const subcollectionRateRef = doc(db, 'shipments', shipmentId, 'rates', shipmentId);
        const subcollectionRateSnap = await getDoc(subcollectionRateRef);
        
        if (subcollectionRateSnap.exists()) {
            // Only add if not already found in main collection
            if (!rates.some(rate => rate.id === subcollectionRateSnap.id)) {
                rates.push({
                    id: subcollectionRateSnap.id,
                    ...subcollectionRateSnap.data(),
                    source: 'unified-sub'
                });
            }
        }
        
        // Fallback to legacy query if no unified rates found
        if (rates.length === 0) {
            const ratesRef = collection(db, 'shipmentRates');
            const q = query(ratesRef, where('shipmentId', '==', shipmentId));
            const querySnapshot = await getDocs(q);
            
            querySnapshot.forEach(doc => {
                const rateData = doc.data();
                if (!rateData._isUnifiedStructure) {
                    rates.push({
                        id: doc.id,
                        ...rateData,
                        source: 'legacy-query'
                    });
                }
            });
        }
        
        return rates;
    } catch (error) {
        console.error('Error getting shipment rates:', error);
        return [];
    }
};

/**
 * Get shipment documents using unified structure
 * @param {Object} db - Firestore database instance
 * @param {string} shipmentId - Shipment ID
 * @returns {Promise<Array>} Array of document objects
 */
export const getShipmentDocuments = async (db, shipmentId) => {
    try {
        const documents = [];
        
        // Check main collection first (shipmentId as document ID)
        const mainDocRef = doc(db, 'shipmentDocuments', shipmentId);
        const mainDocSnap = await getDoc(mainDocRef);
        
        if (mainDocSnap.exists()) {
            const docData = mainDocSnap.data();
            if (docData._isUnifiedStructure) {
                documents.push({
                    id: mainDocSnap.id,
                    ...docData,
                    source: 'unified-main'
                });
            }
        }
        
        // Check subcollection
        const subcollectionDocRef = doc(db, 'shipments', shipmentId, 'documents', shipmentId);
        const subcollectionDocSnap = await getDoc(subcollectionDocRef);
        
        if (subcollectionDocSnap.exists()) {
            // Only add if not already found in main collection
            if (!documents.some(doc => doc.id === subcollectionDocSnap.id)) {
                documents.push({
                    id: subcollectionDocSnap.id,
                    ...subcollectionDocSnap.data(),
                    source: 'unified-sub'
                });
            }
        }
        
        // Fallback to legacy query if no unified documents found
        if (documents.length === 0) {
            const docsRef = collection(db, 'shipmentDocuments');
            const q = query(docsRef, where('shipmentId', '==', shipmentId));
            const querySnapshot = await getDocs(q);
            
            querySnapshot.forEach(doc => {
                const docData = doc.data();
                if (!docData._isUnifiedStructure) {
                    documents.push({
                        id: doc.id,
                        ...docData,
                        source: 'legacy-query'
                    });
                }
            });
        }
        
        return documents;
    } catch (error) {
        console.error('Error getting shipment documents:', error);
        return [];
    }
};

/**
 * Migrate existing data to unified structure
 * @param {Object} db - Firestore database instance
 * @param {string} shipmentId - Shipment ID to migrate
 * @returns {Promise<Object>} Migration results
 */
export const migrateToUnifiedStructure = async (db, shipmentId) => {
    try {
        const results = {
            shipmentExists: false,
            ratesMigrated: 0,
            documentsMigrated: 0,
            errors: []
        };
        
        // Verify shipment exists
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentSnap = await getDoc(shipmentRef);
        
        if (!shipmentSnap.exists()) {
            throw new Error(`Shipment ${shipmentId} not found`);
        }
        
        results.shipmentExists = true;
        
        // Migrate rates
        const ratesRef = collection(db, 'shipmentRates');
        const ratesQuery = query(ratesRef, where('shipmentId', '==', shipmentId));
        const ratesSnapshot = await getDocs(ratesQuery);
        
        for (const rateDoc of ratesSnapshot.docs) {
            const rateData = rateDoc.data();
            
            // Skip if already using unified structure
            if (rateData._isUnifiedStructure) {
                continue;
            }
            
            try {
                await saveUnifiedRate(db, shipmentId, rateData);
                results.ratesMigrated++;
            } catch (error) {
                results.errors.push(`Rate migration error: ${error.message}`);
            }
        }
        
        // Migrate documents
        const docsRef = collection(db, 'shipmentDocuments');
        const docsQuery = query(docsRef, where('shipmentId', '==', shipmentId));
        const docsSnapshot = await getDocs(docsQuery);
        
        for (const docDoc of docsSnapshot.docs) {
            const docData = docDoc.data();
            
            // Skip if already using unified structure
            if (docData._isUnifiedStructure) {
                continue;
            }
            
            try {
                await saveUnifiedDocument(db, shipmentId, docData);
                results.documentsMigrated++;
            } catch (error) {
                results.errors.push(`Document migration error: ${error.message}`);
            }
        }
        
        console.log(`Migration completed for shipment ${shipmentId}:`, results);
        return results;
        
    } catch (error) {
        console.error('Error during migration:', error);
        throw error;
    }
};

export default {
    getUnifiedShipmentData,
    saveUnifiedRate,
    saveUnifiedDocument,
    getUnifiedStoragePath,
    getShipmentRates,
    getShipmentDocuments,
    migrateToUnifiedStructure
}; 