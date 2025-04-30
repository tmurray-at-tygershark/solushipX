const admin = require('firebase-admin');
const functions = require('firebase-functions');

/**
 * Simple function to fetch company shipment origins by companyID
 * 
 * @param {Object} data - Request data containing companyId
 * @param {Object} context - Firebase callable context
 * @returns {Promise<Object>} Promise resolving with shipment origins
 */
async function getCompanyShipmentOrigins(data, context) {
  console.log('Function called with auth:', context.auth ? 'Authenticated' : 'Not authenticated');
  
  try {
    // Simplify companyId extraction assuming direct data object from callable function
    const companyId = data?.companyId;
    
    // Validate companyId
    if (!companyId) {
      console.log('Missing companyId in request');
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Company ID is required'
      );
    }
    
    console.log(`Looking up company with ID: ${companyId}`);
    
    // Get Firestore instance using admin privileges
    const db = admin.firestore();
    
    // Try looking up by companyID field first
    console.log(`Querying companies where companyID == "${companyId}"`);
    const snapshot = await db.collection('companies').where('companyID', '==', companyId).limit(1).get();
    
    if (!snapshot.empty) {
      console.log(`Found company with companyID: ${companyId}`);
      const doc = snapshot.docs[0];
      const companyData = doc.data();
      
      console.log(`Company found. Has shipFromAddresses: ${!!companyData.shipFromAddresses}, count: ${companyData.shipFromAddresses?.length || 0}`);
      
      const shipFromAddresses = companyData.shipFromAddresses || [];
      
      // Ensure each address has an ID matching the frontend generation logic
      const shipFromAddressesWithId = shipFromAddresses.map((addr, index) => ({
          ...addr,
          id: addr.id || `address_${index}` // Add the ID if missing
      }));

      const response = {
        success: true,
        data: {
          companyId: companyData.companyID || companyId,
          shipFromAddresses: shipFromAddressesWithId
        }
      };
      
      console.log(`ORIGINS: Attempting to return success: ${shipFromAddressesWithId.length} addresses found`);
      return response;
    }
    
    // If not found, try by document ID
    console.log(`Company not found by companyID field, trying document ID: ${companyId}`);
    const directDoc = await db.collection('companies').doc(companyId).get();
    
    if (directDoc.exists) {
      console.log(`Found company with document ID: ${companyId}`);
      const companyData = directDoc.data();
      
      console.log(`Company found by document ID. Has shipFromAddresses: ${!!companyData.shipFromAddresses}, count: ${companyData.shipFromAddresses?.length || 0}`);
      
      const shipFromAddresses = companyData.shipFromAddresses || [];
      
      // Ensure each address has an ID matching the frontend generation logic
      const shipFromAddressesWithId = shipFromAddresses.map((addr, index) => ({
          ...addr,
          id: addr.id || `address_${index}` // Add the ID if missing
      }));
      
      const response = {
        success: true,
        data: {
          companyId: companyData.companyID || companyId,
          companyName: companyData.name || 'Unknown Company',
          shipFromAddresses: shipFromAddressesWithId
        }
      };

      console.log(`ORIGINS: Attempting to return success: ${shipFromAddressesWithId.length} addresses found by document ID`);
      return response;
    }
    
    // Not found by any method
    console.log(`No company found with ID: ${companyId}`);
    throw new functions.https.HttpsError(
      'not-found',
      'Company not found with the provided ID'
    );
    
  } catch (error) {
    // Log error details
    console.error('ERROR in getCompanyShipmentOrigins:', { 
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
      'Error retrieving company data: ' + error.message
    );
  }
}

// Export the function
module.exports = { getCompanyShipmentOrigins }; 