const admin = require('firebase-admin');
const functions = require('firebase-functions');

/**
 * Helper function to safely stringify objects with circular references
 * @param {Object} obj - Object to stringify
 * @return {string} Safe JSON string
 */
const safeStringify = (obj) => {
  const seen = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }
    return value;
  });
};

/**
 * Cloud function to fetch company data by companyID
 * 
 * @param {Object} data - Request data
 * @param {string} data.companyId - Company ID to fetch
 * @returns {Object} Company data
 */
// Export a named function instead of using module.exports
function getCompany(data, context) {
  return new Promise(async (resolve, reject) => {
    try {
      // Log all incoming data for debugging
      console.log('Raw incoming data:', safeStringify(data));
      console.log('Context auth:', context?.auth ? 'Present' : 'Not present');
      
      // Extract companyId from the request data
      const companyId = data?.companyId || (data?.data && data.data.companyId);
      
      console.log('Extracted data:', { 
        companyId,
        dataType: typeof data
      });

      // Validate companyId
      if (!companyId) {
        console.log('Company ID validation failed: No company ID provided');
        reject(new functions.https.HttpsError(
          'invalid-argument',
          'Company ID is required',
          { code: 'missing-company-id' }
        ));
        return;
      }

      console.log(`Querying Firestore for company with ID: ${companyId}`);
      
      // Query Firestore for the company
      const db = admin.firestore();
      const companiesRef = db.collection('companies');
      const companyQuery = await companiesRef.where('companyID', '==', companyId).get();

      console.log(`Query result: Found ${companyQuery.size} companies`);

      if (companyQuery.empty) {
        console.log(`No company found with ID: ${companyId}`);
        
        // Try to find by document ID
        const directDoc = await companiesRef.doc(companyId).get();
        if (!directDoc.exists) {
          reject(new functions.https.HttpsError(
            'not-found',
            'Company not found',
            { code: 'not-found' }
          ));
          return;
        }

        // Found by document ID
        const companyData = directDoc.data();
        console.log('Company data retrieved by document ID');
        
        resolve({
          success: true,
          data: {
            id: directDoc.id,
            ...companyData
          }
        });
        return;
      }

      // Get the first matching company
      const companyDoc = companyQuery.docs[0];
      const companyData = companyDoc.data();
      console.log('Company data retrieved successfully');

      // Return the company data
      resolve({
        success: true,
        data: {
          id: companyDoc.id,
          ...companyData
        }
      });
      
    } catch (error) {
      console.error('Error fetching company:', error);
      // If the error is already an HttpsError, just rethrow it
      if (error instanceof functions.https.HttpsError) {
        reject(error);
      } else {
        // Otherwise, wrap it in an HttpsError
        reject(new functions.https.HttpsError(
          'internal',
          'Internal server error',
          { details: error.message }
        ));
      }
    }
  });
}

// Export the named function
module.exports = { getCompany }; 