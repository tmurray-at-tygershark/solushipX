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
  console.log('Function called with auth context:', context?.auth?.uid ? 'User authenticated' : 'Not authenticated');
  
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
    
    try {
      // Query customers where companyId matches
      console.log(`Querying customers where companyId == "${companyId}"`);
      const snapshot = await db.collection('customers').where('companyId', '==', companyId).get();
      
      if (snapshot.empty) {
        console.log(`No customers found with companyId: ${companyId}`);
        // Return an empty array with consistent structure
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
      const customers = [];
      
      // Process each document individually to avoid errors
      snapshot.forEach(doc => {
        try {
          const customerData = doc.data();
          
          // Handle timestamps safely
          let createdAt = null;
          let updatedAt = null;
          
          try {
            if (customerData.createdAt && typeof customerData.createdAt.toDate === 'function') {
              createdAt = customerData.createdAt.toDate().toISOString();
            }
          } catch (err) {
            console.warn(`Error converting createdAt timestamp for customer ${doc.id}:`, err.message);
          }
          
          try {
            if (customerData.updatedAt && typeof customerData.updatedAt.toDate === 'function') {
              updatedAt = customerData.updatedAt.toDate().toISOString();
            }
          } catch (err) {
            console.warn(`Error converting updatedAt timestamp for customer ${doc.id}:`, err.message);
          }
          
          // Create a clean customer object without circular references
          const customer = {
            id: doc.id,
            customerId: doc.id, // Ensure customerId is always present
            ...customerData,
            createdAt,
            updatedAt
          };
          
          customers.push(customer);
        } catch (docErr) {
          console.error(`Error processing customer document ${doc.id}:`, docErr.message);
          // Continue with the next document
        }
      });
      
      // If we failed to process any customers, return meaningful data
      if (customers.length === 0 && !snapshot.empty) {
        console.warn(`Failed to process any of the ${snapshot.size} customers due to errors`);
      }
      
      const response = {
        success: true,
        data: {
          companyId,
          count: customers.length,
          customers
        }
      };
      
      console.log(`CUSTOMERS: Returning success: ${customers.length} customers found`);
      
      // Log a partial sample rather than the full object to avoid circular references
      if (customers.length > 0) {
        const sample = {
          id: customers[0].id,
          customerId: customers[0].customerId,
          name: customers[0].name || '[no name]'
        };
        console.log('First customer sample:', JSON.stringify(sample));
      }
      
      return response;
    } catch (dbError) {
      console.error('Database error in getCompanyCustomers:', dbError.message);
      throw new functions.https.HttpsError(
        'internal',
        'Database error: ' + dbError.message
      );
    }
  } catch (error) {
    // Log error details safely
    console.error('ERROR in getCompanyCustomers:', { 
      message: error.message,
      code: error.code || 'unknown'
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