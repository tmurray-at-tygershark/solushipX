import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Utility functions for properly handling customer data in shipments
 * 
 * CRITICAL: The customer is the entity that OWNS the address, not the company at that address.
 * - shipTo.companyName = The company name at the delivery address
 * - shipTo.addressClassID = The customer ID that owns this address
 * - Customer = The entity we bill and have a relationship with
 */

/**
 * Extract the correct customer ID from shipment data
 * @param {Object} shipment - The shipment object
 * @returns {string|null} - The customer ID or null if not found
 */
export const extractCustomerIdFromShipment = (shipment) => {
    if (!shipment) return null;

    // SIMPLE: Get customer ID with correct priority
    const customerId = shipment.customerId || 
                      shipment.customerID || 
                      shipment.customer?.id ||
                      // addressClassID IS the customer ID when addressClass is 'customer'
                      (shipment.shipTo?.addressClass === 'customer' ? shipment.shipTo.addressClassID : null) ||
                      // Fallback to shipFrom
                      (shipment.shipFrom?.addressClass === 'customer' ? shipment.shipFrom.addressClassID : null);

    return customerId;
};

/**
 * Get the delivery company name (NOT the customer)
 * @param {Object} shipment - The shipment object
 * @returns {string} - The company name at the delivery address
 */
export const getDeliveryCompanyName = (shipment) => {
    if (!shipment?.shipTo) return 'Unknown Company';
    
    return shipment.shipTo.companyName || 
           shipment.shipTo.company || 
           shipment.shipTo.customerName || 
           'Unknown Company';
};

/**
 * Get the customer display name from customer data
 * @param {Object} customerData - The customer object from the database
 * @returns {string} - The customer display name
 */
export const getCustomerDisplayName = (customerData) => {
    if (!customerData) return 'Unknown Customer';
    
    return customerData.name || 
           customerData.companyName || 
           customerData.company || 
           customerData.customerName || 
           'Unknown Customer';
};

/**
 * Load customer data from the database using customer ID
 * @param {string} customerId - The customer ID
 * @returns {Promise<Object|null>} - The customer data or null if not found
 */
export const loadCustomerData = async (customerId) => {
    if (!customerId) return null;

    try {
        // Try to get customer by document ID first
        const customerDocRef = doc(db, 'customers', customerId);
        const customerDoc = await getDoc(customerDocRef);

        if (customerDoc.exists()) {
            return { id: customerDoc.id, ...customerDoc.data() };
        }

        // If not found by document ID, try by customerID field
        const customerQuery = query(
            collection(db, 'customers'),
            where('customerID', '==', customerId),
            limit(1)
        );
        const customerSnapshot = await getDocs(customerQuery);

        if (!customerSnapshot.empty) {
            const customerDocFromQuery = customerSnapshot.docs[0];
            return { id: customerDocFromQuery.id, ...customerDocFromQuery.data() };
        }

        return null;
    } catch (error) {
        console.error('Error loading customer data:', error);
        return null;
    }
};

/**
 * Create a proper customer display object for UI components
 * @param {Object} shipment - The shipment object
 * @param {Object} customerData - Optional customer data if already loaded
 * @returns {Promise<Object>} - Customer display object with proper fallbacks
 */
export const createCustomerDisplayData = async (shipment, customerData = null) => {
    const customerId = extractCustomerIdFromShipment(shipment);
    
    // If customer data provided, use it
    if (customerData) {
        return {
            id: customerData.id,
            customerId: customerId,
            name: getCustomerDisplayName(customerData),
            isLoadedFromDatabase: true,
            deliveryCompany: getDeliveryCompanyName(shipment)
        };
    }

    // Try to load customer data
    if (customerId) {
        const loadedCustomerData = await loadCustomerData(customerId);
        if (loadedCustomerData) {
            return {
                id: loadedCustomerData.id,
                customerId: customerId,
                name: getCustomerDisplayName(loadedCustomerData),
                isLoadedFromDatabase: true,
                deliveryCompany: getDeliveryCompanyName(shipment)
            };
        }
    }

    // Fallback to shipTo data with clear indication it's not the customer
    return {
        id: 'ship-to-fallback',
        customerId: customerId,
        name: `${getDeliveryCompanyName(shipment)} (Delivery Address)`,
        isLoadedFromDatabase: false,
        deliveryCompany: getDeliveryCompanyName(shipment),
        isFallback: true
    };
};

/**
 * Debug function to log customer extraction process
 * @param {Object} shipment - The shipment object
 * @param {string} context - Context where this is being called from
 */
export const debugCustomerExtraction = (shipment, context = 'Unknown') => {
    const customerId = extractCustomerIdFromShipment(shipment);
    const deliveryCompany = getDeliveryCompanyName(shipment);
    
    console.log(`🔍 Customer Debug [${context}]:`, {
        extractedCustomerId: customerId,
        deliveryCompanyName: deliveryCompany,
        shipment: {
            customerId: shipment?.customerId,
            customerID: shipment?.customerID,
            shipTo: {
                addressClass: shipment?.shipTo?.addressClass,
                addressClassID: shipment?.shipTo?.addressClassID,
                customerID: shipment?.shipTo?.customerID,
                companyName: shipment?.shipTo?.companyName,
                company: shipment?.shipTo?.company
            }
        }
    });
    
    return { customerId, deliveryCompany };
}; 