import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Fetch full rate details from shipmentRates collection by rate document ID
 * @param {string} rateDocumentId - The document ID in the shipmentRates collection
 * @returns {Object|null} - The full rate data or null if not found
 */
export const getRateDetailsByDocumentId = async (rateDocumentId) => {
    try {
        if (!rateDocumentId) {
            console.warn('No rateDocumentId provided to getRateDetailsByDocumentId');
            return null;
        }

        const rateDocRef = doc(db, 'shipmentRates', rateDocumentId);
        const rateDocSnap = await getDoc(rateDocRef);

        if (rateDocSnap.exists()) {
            return {
                id: rateDocSnap.id,
                ...rateDocSnap.data()
            };
        } else {
            console.warn(`Rate document not found: ${rateDocumentId}`);
            return null;
        }
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

        const ratesRef = collection(db, 'shipmentRates');
        const q = query(ratesRef, where('shipmentId', '==', shipmentId));
        const querySnapshot = await getDocs(q);

        const rates = [];
        querySnapshot.forEach((doc) => {
            rates.push({
                id: doc.id,
                ...doc.data()
            });
        });

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

        const ratesRef = collection(db, 'shipmentRates');
        const q = query(
            ratesRef, 
            where('shipmentId', '==', shipmentId),
            where('status', '==', status)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Return the first (most recent) matching rate
            const rateDoc = querySnapshot.docs[0];
            return {
                id: rateDoc.id,
                ...rateDoc.data()
            };
        }

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