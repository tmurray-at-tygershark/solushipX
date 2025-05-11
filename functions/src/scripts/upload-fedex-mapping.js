const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../../service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Initialize Firestore with admin database
const db = admin.firestore(admin.app());
db.settings({ 
  databaseId: 'admin',
  ignoreUndefinedProperties: true 
});
console.log('Database settings:', db._settings);

async function uploadFedexMapping() {
  try {
    // Read the mapping file
    const mappingPath = path.join(__dirname, '../edi-mappings/fedex_mapping.json');
    const mappingData = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

    // Create the mapping document
    const mappingRef = db.collection('ediMappings').doc('fedex_text_csv_57fd250aa2849f85a26b563b446a0848');
    await mappingRef.set(mappingData);

    // After uploading the mapping, verify it exists
    const verifyRef = db.collection('ediMappings').doc('fedex_text_csv_57fd250aa2849f85a26b563b446a0848');
    const verifyDoc = await verifyRef.get();
    if (verifyDoc.exists) {
      console.log('Verification successful: FedEx mapping exists in admin Firestore.');
    } else {
      console.error('Verification failed: FedEx mapping not found in admin Firestore.');
    }

    console.log('Successfully uploaded FedEx mapping to Firestore');
    process.exit(0);
  } catch (error) {
    console.error('Error uploading mapping:', error);
    process.exit(1);
  }
}

uploadFedexMapping(); 