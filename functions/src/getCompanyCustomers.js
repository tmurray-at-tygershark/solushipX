const admin = require('firebase-admin');
const functions = require('firebase-functions');

/**
 * Function to fetch customers by companyId
 * 
 * @param {Object} data - Request data containing companyId
 * @param {Object} context - Firebase callable context
 * @returns {Promise<Object>} Promise resolving with customers data
 */
async function getCompanyCustomers(data, context) {
  console.log('Function called with auth:', context.auth ? 'Authenticated' : 'Not authenticated');
  
  try {
    // Extract companyId from the request data
    const companyId = data?.companyId || (data?.data && data.data.companyId);
    
    // Validate companyId
    if (!companyId) {
      console.log('Missing companyId in request');
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Company ID is required'
      );
    }
    
    console.log(`Looking up customers with companyId: ${companyId}`);
    
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
          customers: []
        }
      };
    }
    
    // Process results
    console.log(`Found ${snapshot.size} customer(s) with companyId: ${companyId}`);
    const customers = snapshot.docs.map(doc => {
      const customerData = doc.data();
      return {
        id: doc.id,
        ...customerData,
        // Convert timestamps to ISO strings for serialization
        createdAt: customerData.createdAt ? customerData.createdAt.toDate().toISOString() : null,
        updatedAt: customerData.updatedAt ? customerData.updatedAt.toDate().toISOString() : null
      };
    });
    
    return {
      success: true,
      data: {
        companyId,
        count: customers.length,
        customers
      }
    };
    
  } catch (error) {
    // Log error details
    console.error('ERROR in getCompanyCustomers:', { 
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
      'Error retrieving customer data: ' + error.message
    );
  }
}

// Export the function
module.exports = { getCompanyCustomers }; 