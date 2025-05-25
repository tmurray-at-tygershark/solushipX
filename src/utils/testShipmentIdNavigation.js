/**
 * Test utility to verify shipment ID navigation
 * This can be used to test that shipment URLs work with the new shipmentID format
 */

import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Test function to verify that a shipment can be found by shipmentID
 * @param {string} shipmentID - The shipment ID to test (e.g., "IC-DWSLOGISTICS-A7X9K2")
 * @returns {Promise<Object|null>} - The shipment data if found, null otherwise
 */
export const testShipmentIdLookup = async (shipmentID) => {
    try {
        console.log('Testing shipment ID lookup for:', shipmentID);
        
        const shipmentsRef = collection(db, 'shipments');
        const q = query(shipmentsRef, where('shipmentID', '==', shipmentID), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            const shipmentData = { id: docSnap.id, ...docSnap.data() };
            
            console.log('✅ Shipment found:', {
                shipmentID: shipmentData.shipmentID,
                firestoreDocId: docSnap.id,
                status: shipmentData.status,
                carrier: shipmentData.selectedRate?.carrier || 'N/A'
            });
            
            return shipmentData;
        } else {
            console.log('❌ No shipment found with shipmentID:', shipmentID);
            return null;
        }
    } catch (error) {
        console.error('Error testing shipment ID lookup:', error);
        return null;
    }
};

/**
 * Test function to verify URL generation for shipment navigation
 * @param {Object} shipment - The shipment object
 * @returns {string} - The URL that would be generated for navigation
 */
export const testShipmentUrlGeneration = (shipment) => {
    const shipmentId = shipment.shipmentID || shipment.id;
    const url = `/shipment/${shipmentId}`;
    
    console.log('Generated URL for shipment:', {
        originalId: shipment.id,
        shipmentID: shipment.shipmentID,
        generatedUrl: url
    });
    
    return url;
};

/**
 * Test function to simulate the new navigation flow
 */
export const testNavigationFlow = async () => {
    console.log('🧪 Testing shipment ID navigation flow...');
    
    // Test with a sample shipment ID format
    const testShipmentIds = [
        'IC-DWSLOGISTICS-A7X9K2',
        'IC-DWSLOGISTICS-B8Y4L3',
        'IC-DWSLOGISTICS-C9Z5M4'
    ];
    
    for (const shipmentID of testShipmentIds) {
        const result = await testShipmentIdLookup(shipmentID);
        if (result) {
            const url = testShipmentUrlGeneration(result);
            console.log(`✅ Navigation test passed for ${shipmentID} -> ${url}`);
        } else {
            console.log(`⚠️  No shipment found for ${shipmentID} (this is expected if the shipment doesn't exist)`);
        }
    }
    
    console.log('🏁 Navigation flow test completed');
};

export default {
    testShipmentIdLookup,
    testShipmentUrlGeneration,
    testNavigationFlow
}; 