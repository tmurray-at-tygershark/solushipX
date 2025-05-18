const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

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

async function migrateMappings() {
  console.log("Starting EDI mapping migration to default database...");

  try {
    // Get all collections from the default database (for reference, not strictly needed for migration)
    // const collections = await adminDb.listCollections();
    const collections = await db.listCollections(); // USE DEFAULT DB
    console.log("Collections found in the default database:");
    collections.forEach(col => console.log(`- ${col.id}`));

    // Source: Assume old mappings are in 'ediMappings' in default DB (if they were ever there)
    // Or, if they were *only* in 'admin' DB, this script might need to read from a backup/export if adminDb is truly gone
    // For now, let's assume we are restructuring ediMappings within the *default* database.
    const oldEdiMappingsRef = db.collection('ediMappings'); // Read from default
    const oldEdiMappingsSnapshot = await oldEdiMappingsRef.get();

    if (oldEdiMappingsSnapshot.empty) {
      console.log("No documents found in 'ediMappings' in the default database to migrate.");
      return;
    }

    console.log(`Found ${oldEdiMappingsSnapshot.size} documents in 'ediMappings' (default DB) to process for migration format.`);

    const batch = db.batch(); // Batch for default DB

    for (const doc of oldEdiMappingsSnapshot.docs) {
      const mappingData = doc.data();
      const oldDocId = doc.id;

      // Check if this document already follows the new structure (has a carrierId field)
      // Or if it has subcollections (which is the old structure we might be moving away from)
      if (mappingData.carrierId && mappingData.fieldMappings) {
        // This document might already be in the new top-level format
        console.log(`Document ${oldDocId} seems to be in the new format already, ensuring structure.`);
        
        // Example: ensure it's directly under ediMappings/{carrierId}
        // If oldDocId is NOT mappingData.carrierId, it implies a different structure.
        // For this script, we'll assume we are creating the new structure.

        const newCarrierId = mappingData.carrierId.toLowerCase().replace(/\s+/g, '_');
        const targetDocRef = db.collection('ediMappings').doc(newCarrierId).collection('default').doc('mapping');
        
        console.log(`  Setting data for ${newCarrierId} at ${targetDocRef.path}`);
        batch.set(targetDocRef, { 
            ...mappingData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // If the old document ID is different from the newCarrierId, consider deleting the old one
        if (oldDocId !== newCarrierId) {
            // Optional: Delete the old top-level document if it was structured differently
            // console.log(`  (Optional) Deleting old document at ediMappings/${oldDocId}`);
            // batch.delete(db.collection('ediMappings').doc(oldDocId));
        }

      } else {
        // This might be an old document that itself is a carrier (e.g., ediMappings/FEDEX)
        // And its mapping data is in a subcollection doc (e.g., ediMappings/FEDEX/default/mapping)
        console.log(`Document ${oldDocId} might be an old carrier document. Checking for subcollection data...`);
        const oldDefaultMappingRef = db.collection('ediMappings').doc(oldDocId).collection('default').doc('mapping');
        const oldDefaultMappingDoc = await oldDefaultMappingRef.get();

        if (oldDefaultMappingDoc.exists) {
          const subcollectionMappingData = oldDefaultMappingDoc.data();
          const newCarrierId = oldDocId.toLowerCase().replace(/\s+/g, '_'); // Use oldDocId as carrierId

          const targetDocRef = db.collection('ediMappings').doc(newCarrierId).collection('default').doc('mapping');
          console.log(`  Migrating subcollection data for ${oldDocId} to ${targetDocRef.path}`);
          batch.set(targetDocRef, { 
            ...subcollectionMappingData,
            carrierId: newCarrierId, // Add carrierId if it wasn't there
            name: mappingData.name || newCarrierId, // Use name from parent or carrierId
            description: mappingData.description || '',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          
          // We might also want to update/set the top-level carrier doc ediMappings/{newCarrierId}
          const topLevelCarrierRef = db.collection('ediMappings').doc(newCarrierId);
          batch.set(topLevelCarrierRef, {
            name: mappingData.name || newCarrierId,
            description: mappingData.description || '',
            enabled: mappingData.enabled !== undefined ? mappingData.enabled : true, // Default to true
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

        } else {
          console.log(`  No 'default/mapping' subcollection found for ${oldDocId}. Skipping.`);
        }
      }
    }

    await batch.commit();
    console.log("Migration batch committed successfully to the default database.");

  } catch (error) {
    console.error("Error migrating mappings:", error);
  }
}

migrateMappings().then(() => {
  console.log("\nEDI mapping migration script finished.");
}).catch(err => {
    console.error("Script execution failed:", err)
}); 