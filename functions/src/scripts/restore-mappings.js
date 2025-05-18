const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { getFirestore } = require('firebase-admin/firestore'); // Not needed if admin is initialized globally

// Assuming admin SDK is initialized globally in functions/index.js
// const serviceAccount = require("../../service-account.json"); // Path to your service account key

// if (admin.apps.length === 0) {
//   admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//   });
// }

// Use the globally initialized admin.firestore() instance for the default database
const db = admin.firestore();
// REMOVE: const adminDb = getFirestore(admin.app(), 'admin');

const BACKUP_DIR = path.join(__dirname, 'mapping_backups'); // Standardized backup directory name

async function restoreMappings() {
  console.log(`Starting EDI mapping restore from ${BACKUP_DIR} to default database...`);

  if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`Backup directory not found: ${BACKUP_DIR}`);
    return;
  }

  const backupFiles = fs.readdirSync(BACKUP_DIR).filter(file => file.endsWith('_mapping_backup.json'));

  if (backupFiles.length === 0) {
    console.log("No mapping backup files found in backup directory.");
    return;
  }

  console.log(`Found ${backupFiles.length} backup files to process.`);
  const batch = db.batch(); // Batch for default DB

  for (const fileName of backupFiles) {
    const filePath = path.join(BACKUP_DIR, fileName);
    try {
      const mappingData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      // Ensure carrierId is present in the mapping data, derive if necessary
      let carrierId = mappingData.carrierId;
      if (!carrierId) {
        // Try to derive carrierId from fileName (e.g., fedex_mapping_backup.json -> fedex)
        const parts = fileName.split('_');
        if (parts.length > 0) {
          carrierId = parts[0].toLowerCase();
          console.log(`Derived carrierId '${carrierId}' from filename ${fileName} as it was missing in the backup data.`);
          mappingData.carrierId = carrierId; // Add it to the data to be restored
        } else {
          console.warn(`Could not derive carrierId for ${fileName}. Skipping this file.`);
          continue;
        }
      }
      
      carrierId = carrierId.toLowerCase().replace(/\s+/g, '_');

      // Restore to new structure: ediMappings/{carrierId}/default/mapping
      // const carrierRef = adminDb.collection('ediMappings').doc(carrierId);
      const mainCarrierDocRef = db.collection('ediMappings').doc(carrierId); // USE DEFAULT DB
      const targetMappingRef = mainCarrierDocRef.collection('default').doc('mapping');

      console.log(`  Restoring mapping for ${carrierId} to ${targetMappingRef.path}`);
      
      // Ensure top-level carrier document exists or is created/merged
      const carrierDocData = {
        name: mappingData.name || carrierId.charAt(0).toUpperCase() + carrierId.slice(1), // Use mapping name or formatted carrierId
        description: mappingData.description || `Mapping for ${carrierId}`,
        enabled: mappingData.enabled !== undefined ? mappingData.enabled : true, // Default to true if not in backup
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      batch.set(mainCarrierDocRef, carrierDocData, { merge: true });

      // Set the mapping data in the subcollection
      // Ensure not to spread unrelated fields from the old top-level doc into the mapping subcollection doc
      const { name, description, enabled, ...actualMappingFields } = mappingData;
      batch.set(targetMappingRef, { 
        ...actualMappingFields, // Spread only the actual mapping fields
        carrierId: carrierId, // Ensure carrierId is part of the mapping document itself
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      }, { merge: true });

    } catch (error) {
      console.error(`Error processing or restoring file ${fileName}:`, error);
    }
  }

  try {
    await batch.commit();
    console.log("Mapping restore batch committed successfully to the default database.");
  } catch (error) {
    console.error("Error committing restore batch:", error);
  }
}

restoreMappings().then(() => {
  console.log("\nEDI mapping restore script finished.");
}).catch(err => {
    console.error("Script execution failed:", err);
}); 