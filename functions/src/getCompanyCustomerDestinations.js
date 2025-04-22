const admin = require('firebase-admin');
const functions = require('firebase-functions');

/**
 * Function to fetch customer addresses by companyId for shipping destinations
 * 
 * @param {Object} data - Request data containing companyId and optional parameters
 * @param {string} data.companyId - The company ID to fetch customers for
 * @param {boolean} data.includeAllTypes - Whether to include all address types (default: true)
 * @param {Object} context - Firebase callable context
 * @returns {Promise<Object>} Promise resolving with customer addresses data
 */
async function getCompanyCustomerDestinations(data, context) {
  console.log('Function called with auth:', context.auth ? 'Authenticated' : 'Not authenticated');
  
  try {
    // Extract companyId from the request data
    const companyId = data?.companyId || (data?.data && data.data.companyId);
    
    // Extract optional parameters with defaults
    const includeAllTypes = data?.includeAllTypes !== undefined ? data.includeAllTypes : true;
    
    console.log('Function parameters:', { companyId, includeAllTypes });
    
    // Validate companyId
    if (!companyId) {
      console.log('Missing companyId in request');
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Company ID is required'
      );
    }
    
    console.log(`Looking up customer destinations with companyId: ${companyId}`);
    
    // Get Firestore instance using admin privileges
    const db = admin.firestore();
    
    // Query customers where companyId matches
    console.log(`Querying customers where companyId == "${companyId}"`);
    const snapshot = await db.collection('customers').where('companyId', '==', companyId).get();
    
    if (snapshot.empty) {
      console.log(`No customers found with companyId: ${companyId}`);
      return {
        success: true,
        data: {
          companyId,
          destinations: []
        }
      };
    }
    
    // Process results
    console.log(`Found ${snapshot.size} customer(s) with companyId: ${companyId}`);
    
    // Transform customer data to focus on addresses
    const destinations = [];
    
    snapshot.docs.forEach(doc => {
      const customerData = doc.data();
      const customerId = doc.id;
      const customerName = customerData.name || 'Unknown Customer';
      
      console.log(`Processing customer: ${customerName} (${customerId})`);
      
      // Process each address for this customer
      if (customerData.addresses && Array.isArray(customerData.addresses)) {
        console.log(`Customer has ${customerData.addresses.length} addresses`);
        
        // Log all addresses for debugging
        customerData.addresses.forEach((address, idx) => {
          console.log(`Address #${idx}:`, {
            type: address.type || 'unknown',
            default: address.default || false,
            street: address.street,
            city: address.city,
            state: address.state,
            zip: address.zip || address.postalCode
          });
        });
        
        customerData.addresses.forEach((address, index) => {
          // Determine if this address should be included based on the filter settings
          const isShippingAddress = address.type === 'shipping';
          const isDefaultAddress = !!address.default;
          
          // Include all addresses if includeAllTypes is true
          const shouldInclude = includeAllTypes || isShippingAddress || isDefaultAddress;
          
          if (shouldInclude) {
            console.log(`Including address #${index} (type: ${address.type || 'unknown'}, default: ${address.default || false})`);
            
            destinations.push({
              id: `${customerId}_${index}`,
              customerId: customerId,
              customerName: customerName,
              address: {
                ...address,
                postalCode: address.zip || address.postalCode || '',
              },
              contact: customerData.contacts && customerData.contacts.length > 0 
                ? customerData.contacts[0] 
                : { name: '', phone: '', email: '' }
            });
          } else {
            console.log(`Skipping address #${index} (type: ${address.type || 'unknown'}, default: ${address.default || false})`);
          }
        });
      } else {
        console.log(`Customer has no addresses defined`);
      }
    });
    
    console.log(`Returning ${destinations.length} total destinations`);
    
    return {
      success: true,
      data: {
        companyId,
        count: destinations.length,
        destinations
      }
    };
    
  } catch (error) {
    // Log error details
    console.error('ERROR in getCompanyCustomerDestinations:', { 
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // If already a HttpsError, just re-throw it
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    // Otherwise, wrap in a generic internal error
    throw new functions.https.HttpsError(
      'internal',
      'Error retrieving customer destinations data: ' + error.message
    );
  }
}

// Export the function
module.exports = { getCompanyCustomerDestinations }; 