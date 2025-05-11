const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../../service-account.json'); // Adjusted path assuming script is in functions/src/scripts
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Initialize Firestore to specifically target the 'admin' database
const db = admin.firestore(admin.app()); // Get the default Firestore app instance
db.settings({ 
  databaseId: 'admin', 
  ignoreUndefinedProperties: true 
});
console.log('Upload Canpar Mapping: Using admin database. Settings applied:', db._settings);

async function uploadCanparMapping() {
  try {
    const mappingPath = path.join(__dirname, '../edi-mappings/canpar_mapping.json');
    const mappingData = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

    // Double-check the hash for safety, though it should be correct in the file
    const expectedHash = '50cdd1ee97252be8de438eac5c3777da';
    if (mappingData.headerHash !== expectedHash) {
        throw new Error(`Header hash in canpar_mapping.json (${mappingData.headerHash}) does not match expected hash (${expectedHash}). Please verify headers.`);
    }

    const mappingDocId = `canpar_text_csv_${mappingData.headerHash}`;
    const mappingRef = db.collection('ediMappings').doc(mappingDocId);
    await mappingRef.set(mappingData);

    console.log(`Successfully uploaded Canpar mapping to Firestore (admin DB) as ediMappings/${mappingDocId}`);

    // Verification step
    const verifyDoc = await mappingRef.get();
    if (verifyDoc.exists) {
      console.log('Verification successful: Canpar mapping exists in admin Firestore at expected location.');
    } else {
      console.error('Verification failed: Canpar mapping NOT found in admin Firestore after upload attempt.');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error uploading Canpar mapping:', error);
    process.exit(1);
  }
}

uploadCanparMapping(); 