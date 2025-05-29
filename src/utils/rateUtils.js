import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Fetch full rate details from shipmentRates collection by rate document ID
 * @param {string} rateDocumentId - The document ID in the shipmentRates collection
 * @returns {Object|null} - The full rate data or null if not found
 */
export const getRateDetailsByDocumentId = async (rateDocumentId, shipmentId = null) => {
    try {
        if (!rateDocumentId) {
            console.warn('No rateDocumentId provided to getRateDetailsByDocumentId');
            return null;
        }

        // For unified structure, the rateDocumentId should match the shipmentId
        const effectiveShipmentId = shipmentId || rateDocumentId;

        // Try unified structure first - check main document (shipmentId as document ID)
        if (effectiveShipmentId) {
            const unifiedRateRef = doc(db, 'shipmentRates', effectiveShipmentId);
            const unifiedRateDoc = await getDoc(unifiedRateRef);
            
            if (unifiedRateDoc.exists()) {
                const rateData = unifiedRateDoc.data();
                if (rateData._isUnifiedStructure) {
                    console.log(`Found unified rate by document ID: ${rateDocumentId}`);
                    return {
                        id: unifiedRateDoc.id,
                        ...rateData,
                        source: 'unified-main'
                    };
                }
            }
            
            // Also check subcollection structure
            const subcollectionRateRef = doc(db, 'shipments', effectiveShipmentId, 'rates', effectiveShipmentId);
            const subcollectionRateDoc = await getDoc(subcollectionRateRef);
            
            if (subcollectionRateDoc.exists()) {
                console.log(`Found unified subcollection rate by document ID: ${rateDocumentId}`);
                return {
                    id: subcollectionRateDoc.id,
                    ...subcollectionRateDoc.data(),
                    source: 'unified-sub'
                };
            }
        }

        // Fallback to legacy structure - try direct document lookup
        const legacyRateRef = doc(db, 'shipmentRates', rateDocumentId);
        const legacyRateDoc = await getDoc(legacyRateRef);

        if (legacyRateDoc.exists()) {
            const rateData = legacyRateDoc.data();
            if (!rateData._isUnifiedStructure) {
                console.log(`Found legacy rate by document ID: ${rateDocumentId}`);
                return {
                    id: legacyRateDoc.id,
                    ...rateData,
                    source: 'legacy-direct'
                };
            }
        }

        console.log(`No rate found for document ID: ${rateDocumentId}`);
        return null;
    } catch (error) {
        console.error('Error fetching rate details by document ID:', error);
        return null;
    }
};

/**
 * Fetch all rates for a specific shipment
 * @param {string} shipmentId - The shipment ID
 * @returns {Array} - Array of rate objects
 */
export const getRatesForShipment = async (shipmentId) => {
    try {
        if (!shipmentId) {
            console.warn('No shipmentId provided to getRatesForShipment');
            return [];
        }

        // Try unified structure first - check main document (shipmentId as document ID)
        const unifiedRateRef = doc(db, 'shipmentRates', shipmentId);
        const unifiedRateDoc = await getDoc(unifiedRateRef);
        
        const rates = [];
        
        if (unifiedRateDoc.exists()) {
            const rateData = unifiedRateDoc.data();
            if (rateData._isUnifiedStructure) {
                rates.push({
                    id: unifiedRateDoc.id,
                    ...rateData,
                    source: 'unified-main'
                });
                console.log(`Found unified rate for shipment ${shipmentId}:`, unifiedRateDoc.id);
            }
        }
        
        // Also check subcollection structure
        const subcollectionRateRef = doc(db, 'shipments', shipmentId, 'rates', shipmentId);
        const subcollectionRateDoc = await getDoc(subcollectionRateRef);
        
        if (subcollectionRateDoc.exists()) {
            const rateData = subcollectionRateDoc.data();
            // Only add if not already found in main collection
            if (!rates.some(rate => rate.id === subcollectionRateDoc.id)) {
                rates.push({
                    id: subcollectionRateDoc.id,
                    ...rateData,
                    source: 'unified-sub'
                });
                console.log(`Found unified subcollection rate for shipment ${shipmentId}:`, subcollectionRateDoc.id);
            }
        }

        // Fallback to legacy structure for backward compatibility
        if (rates.length === 0) {
            const ratesRef = collection(db, 'shipmentRates');
            const q = query(ratesRef, where('shipmentId', '==', shipmentId));
            const querySnapshot = await getDocs(q);

            querySnapshot.forEach((doc) => {
                const rateData = doc.data();
                // Skip if this was created with unified structure
                if (!rateData._isUnifiedStructure) {
                    rates.push({
                        id: doc.id,
                        ...rateData,
                        source: 'legacy-query'
                    });
                }
            });
            console.log(`Found ${rates.length} legacy rates for shipment ${shipmentId}`);
        }

        console.log(`Total rates found for shipment ${shipmentId}:`, rates.length);
        return rates;
    } catch (error) {
        console.error('Error fetching rates for shipment:', error);
        return [];
    }
};

/**
 * Fetch the selected/booked rate for a shipment
 * @param {string} shipmentId - The shipment ID
 * @param {string} status - The rate status to filter by ('selected', 'booked', etc.)
 * @returns {Object|null} - The rate object or null if not found
 */
export const getSelectedRateForShipment = async (shipmentId, status = 'selected') => {
    try {
        if (!shipmentId) {
            console.warn('No shipmentId provided to getSelectedRateForShipment');
            return null;
        }

        // Try unified structure first - check main document (shipmentId as document ID)
        const unifiedRateRef = doc(db, 'shipmentRates', shipmentId);
        const unifiedRateDoc = await getDoc(unifiedRateRef);
        
        if (unifiedRateDoc.exists()) {
            const rateData = unifiedRateDoc.data();
            if (rateData._isUnifiedStructure && 
                (rateData.status === status || status === 'any')) {
                console.log(`Found unified rate with status ${status} for shipment ${shipmentId}`);
                return {
                    id: unifiedRateDoc.id,
                    ...rateData,
                    source: 'unified-main'
                };
            }
        }
        
        // Also check subcollection structure
        const subcollectionRateRef = doc(db, 'shipments', shipmentId, 'rates', shipmentId);
        const subcollectionRateDoc = await getDoc(subcollectionRateRef);
        
        if (subcollectionRateDoc.exists()) {
            const rateData = subcollectionRateDoc.data();
            if (rateData.status === status || status === 'any') {
                console.log(`Found unified subcollection rate with status ${status} for shipment ${shipmentId}`);
                return {
                    id: subcollectionRateDoc.id,
                    ...rateData,
                    source: 'unified-sub'
                };
            }
        }

        // Fallback to legacy structure
        const ratesRef = collection(db, 'shipmentRates');
        const q = query(
            ratesRef, 
            where('shipmentId', '==', shipmentId),
            where('status', '==', status)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Return the first (most recent) matching rate that wasn't created with unified structure
            for (const rateDoc of querySnapshot.docs) {
                const rateData = rateDoc.data();
                if (!rateData._isUnifiedStructure) {
                    console.log(`Found legacy rate with status ${status} for shipment ${shipmentId}`);
                    return {
                        id: rateDoc.id,
                        ...rateData,
                        source: 'legacy-query'
                    };
                }
            }
        }

        console.log(`No rate found with status ${status} for shipment ${shipmentId}`);
        return null;
    } catch (error) {
        console.error('Error fetching selected rate for shipment:', error);
        return null;
    }
};

/**
 * Convert a rate reference to display format
 * @param {Object} rateRef - The rate reference object from shipment document
 * @returns {Object} - Formatted rate display object
 */
export const formatRateReference = (rateRef) => {
    if (!rateRef) return null;

    return {
        carrier: rateRef.carrier || 'Unknown',
        service: rateRef.service || 'Standard',
        totalCharges: rateRef.totalCharges || 0,
        transitDays: rateRef.transitDays || 0,
        estimatedDeliveryDate: rateRef.estimatedDeliveryDate || 'N/A',
        currency: rateRef.currency || 'USD',
        guaranteed: rateRef.guaranteed || false
    };
}; 