const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

// Initialize Firebase Admin with service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const companyId = 'OSJ4266';

async function testDirectFirestoreAccess() {
  try {
    console.log(`Looking up company with ID: ${companyId}`);
    
    // Try looking up by companyID field first
    console.log(`Querying companies where companyID == "${companyId}"`);
    const snapshot = await db.collection('companies').where('companyID', '==', companyId).limit(1).get();
    
    if (!snapshot.empty) {
      console.log(`Found company with companyID: ${companyId}`);
      const doc = snapshot.docs[0];
      const companyData = doc.data();
      
      console.log(`Company found. Document ID: ${doc.id}`);
      console.log(`Company name: ${companyData.name || 'Unknown'}`);
      console.log(`Has shipFromAddresses: ${!!companyData.shipFromAddresses}, count: ${companyData.shipFromAddresses?.length || 0}`);
      
      const shipFromAddresses = companyData.shipFromAddresses || [];
      
      if (shipFromAddresses.length > 0) {
        console.log('First shipFrom address:');
        console.log(JSON.stringify(shipFromAddresses[0], null, 2));
      }
      
      return;
    }
    
    // If not found, try by document ID
    console.log(`Company not found by companyID field, trying document ID: ${companyId}`);
    const directDoc = await db.collection('companies').doc(companyId).get();
    
    if (directDoc.exists) {
      console.log(`Found company with document ID: ${companyId}`);
      const companyData = directDoc.data();
      
      console.log(`Company name: ${companyData.name || 'Unknown'}`);
      console.log(`Has shipFromAddresses: ${!!companyData.shipFromAddresses}, count: ${companyData.shipFromAddresses?.length || 0}`);
      
      const shipFromAddresses = companyData.shipFromAddresses || [];
      
      if (shipFromAddresses.length > 0) {
        console.log('First shipFrom address:');
        console.log(JSON.stringify(shipFromAddresses[0], null, 2));
      }
      
      return;
    }
    
    console.log(`No company found with ID: ${companyId}`);
  } catch (error) {
    console.error('Error accessing Firestore:', error);
  }
}

// Run the test
testDirectFirestoreAccess()
  .then(() => console.log('Test completed.'))
  .catch(err => console.error('Test failed:', err))
  .finally(() => process.exit()); 