const admin = require('firebase-admin');
const functions = require('firebase-functions');

/**
 * Function to fetch customers by companyID
 * 
 * @param {Object} data - Request data containing companyID
 * @param {Object} context - Firebase callable context
 * @returns {Promise<Object>} Promise resolving with customers data
 */
async function getCompanyCustomers(data, context) {
  console.log('Function called with auth context:', context?.auth?.uid ? 'User authenticated' : 'Not authenticated');
  
  try {
    // Extract companyID from the request data - support both capitalizations for backward compatibility
    const companyID = data?.companyID || data?.companyId || (data?.data && (data.data.companyID || data.data.companyId));
    
    // Validate companyID
    if (!companyID) {
      console.log('Missing companyID in request');
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Company ID is required'
      );
    }
    
    console.log(`Looking up customers with companyID: ${companyID}`);
    
    // Get Firestore instance for default database
    const db = admin.firestore();
    console.log('Using Firestore DEFAULT database');
    
    // Log database connection details
    console.log('Database settings:', JSON.stringify(db._settings || {}));
    console.log('Firebase app name:', admin.app().name);
    console.log('Firebase project ID:', admin.app().options.projectId);
    
    // List all collections to verify we can access the database at all
    try {
      console.log('Attempting to list all collections:');
      const collections = await db.listCollections();
      const collectionIds = collections.map(col => col.id);
      console.log('Available collections:', collectionIds.join(', '));
      
      if (collectionIds.includes('customers')) {
        console.log('✅ Customers collection found in the database');
      } else {
        console.log('❌ Customers collection NOT found in the database');
      }
    } catch (listError) {
      console.error('Error listing collections:', listError);
    }
    
    try {
      // Query the default database with case variations
      console.log(`Querying customers collection where companyID == "${companyID}"`);
      
      // First try the uppercase field name (companyID)
      let snapshot = await db.collection('customers').where('companyID', '==', companyID).get();
      
      // If no results, try the lowercase field name (companyId)
      if (snapshot.empty) {
        console.log(`No results with uppercase companyID, trying lowercase companyId field...`);
        snapshot = await db.collection('customers').where('companyId', '==', companyID).get();
      }
      
      if (snapshot.empty) {
        console.log(`No customers found with companyID: ${companyID} (tried both uppercase and lowercase field names)`);
        
        // Debug: Fetch a few customers to see what field names they have
        const debugSnapshot = await db.collection('customers').limit(3).get();
        if (!debugSnapshot.empty) {
          console.log(`DEBUG: Found ${debugSnapshot.size} customer documents to examine field names:`);
          debugSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`\n--- DOCUMENT ${doc.id} ---`);
            console.log(`All field names: ${Object.keys(data).join(', ')}`);
            
            // Log all field values
            Object.keys(data).forEach(key => {
              const value = data[key];
              const valueType = typeof value;
              const displayValue = valueType === 'object' && value !== null 
                ? (value instanceof Date ? value.toISOString() : JSON.stringify(value))
                : String(value);
              console.log(`${key} (${valueType}): ${displayValue}`);
            });
            
            // Look specifically for any company-related fields (with flexible matching)
            const companyFields = Object.keys(data).filter(key => 
              key.toLowerCase().includes('company')
            );
            if (companyFields.length > 0) {
              console.log(`\nCompany-related fields: ${companyFields.join(', ')}`);
              companyFields.forEach(field => {
                console.log(`${field} = ${JSON.stringify(data[field])}`);
              });
            } else {
              console.log(`\nNo company-related fields found in this document`);
            }
          });
        } else {
          console.log('DEBUG: No customer documents found at all. Collection might be empty.');
        }
        
        // Examine the specific document from the URL
        console.log('Looking for specific document mentioned in URL: 0QlVsrv3Vce56FGe9BWA');
        const specificDocRef = db.collection('customers').doc('0QlVsrv3Vce56FGe9BWA');
        const specificDoc = await specificDocRef.get();
        
        if (specificDoc.exists) {
          console.log('Found the specific document!');
          const data = specificDoc.data();
          console.log(`\n--- DOCUMENT 0QlVsrv3Vce56FGe9BWA ---`);
          console.log(`All field names: ${Object.keys(data).join(', ')}`);
          
          // Log all field values
          Object.keys(data).forEach(key => {
            const value = data[key];
            const valueType = typeof value;
            const displayValue = valueType === 'object' && value !== null 
              ? (value instanceof Date ? value.toISOString() : JSON.stringify(value))
              : String(value);
            console.log(`${key} (${valueType}): ${displayValue}`);
          });
        } else {
          console.log('Specific document NOT found');
          
          // Check if it might be in the admin database
          try {
            console.log('Checking if document exists in admin database...');
            const adminDb = admin.firestore(admin.app(), 'admin');
            const adminDocRef = adminDb.collection('customers').doc('0QlVsrv3Vce56FGe9BWA');
            const adminDoc = await adminDocRef.get();
            
            if (adminDoc.exists) {
              console.log('✅ Found the document in ADMIN database!');
              const data = adminDoc.data();
              console.log(`All field names: ${Object.keys(data).join(', ')}`);
            } else {
              console.log('❌ Document not found in admin database either');
            }
          } catch (adminErr) {
            console.error('Error checking admin database:', adminErr);
          }
          
          // Check if it might be in a different collection
          try {
            const allCollections = await db.listCollections();
            console.log('Searching for document in all collections...');
            
            for (const collection of allCollections) {
              const collectionId = collection.id;
              if (collectionId !== 'customers') { // Skip customers since we already checked
                const docRef = db.collection(collectionId).doc('0QlVsrv3Vce56FGe9BWA');
                const docSnapshot = await docRef.get();
                
                if (docSnapshot.exists) {
                  console.log(`✅ Found document in collection "${collectionId}"!`);
                  const data = docSnapshot.data();
                  console.log(`All field names: ${Object.keys(data).join(', ')}`);
                  break;
                }
              }
            }
          } catch (otherErr) {
            console.error('Error checking other collections:', otherErr);
          }
          
          // Try with a slightly different document ID format
          console.log('Trying alternative document ID format...');
          try {
            // Try with lowercase 'l' instead of uppercase 'I'
            const altDocId = '0QlVsrv3Vce56FGe9BWA'.replace('I', 'l');
            console.log(`Trying with alternate ID: ${altDocId}`);
            const altDocRef = db.collection('customers').doc(altDocId);
            const altDoc = await altDocRef.get();
            
            if (altDoc.exists) {
              console.log(`✅ Found document with alternate ID: ${altDocId}`);
              const data = altDoc.data();
              console.log(`All field names: ${Object.keys(data).join(', ')}`);
            } else {
              console.log(`❌ Document not found with alternate ID: ${altDocId}`);
            }
          } catch (altErr) {
            console.error('Error checking alternate document ID:', altErr);
          }
          
          // Return an empty array with consistent structure
          return {
            success: true,
            data: {
              companyID,
              customers: []
            }
          };
        }
      }
      
      // Process results
      console.log(`Found ${snapshot.size} customer(s) with companyID: ${companyID}`);
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
            customerID: doc.id, // Use customerID with capital ID to match database
            customerId: doc.id, // Keep customerId for backward compatibility
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
          companyID,
          count: customers.length,
          customers
        }
      };
      
      console.log(`CUSTOMERS: Returning success: ${customers.length} customers found`);
      
      // Log a partial sample rather than the full object to avoid circular references
      if (customers.length > 0) {
        const sample = {
          id: customers[0].id,
          customerID: customers[0].customerID || customers[0].customerId,
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