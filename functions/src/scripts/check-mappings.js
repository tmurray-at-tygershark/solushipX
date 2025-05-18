const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore'); // This import is for client SDK style, not needed if admin is initialized

// Assuming admin SDK is initialized globally in functions/index.js
// const serviceAccount = require("../../service-account.json"); // Path to your service account key

// if (admin.apps.length === 0) {
//   admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//   });
// }

// Use the globally initialized admin.firestore() instance
const db = admin.firestore();
// REMOVE: const adminDb = getFirestore(admin.app(), 'admin');

async function checkMappings() {
  console.log("Starting EDI mapping check...");

  try {
    // Check collections in the default database
    // const collections = await adminDb.listCollections();
    const collections = await db.listCollections(); // USE DEFAULT DB
    console.log("Collections found in the default database:");
    collections.forEach(col => console.log(`- ${col.id}`));

    // Check specific ediMappings collection
    // const ediMappingsRef = adminDb.collection('ediMappings');
    const ediMappingsRef = db.collection('ediMappings'); // USE DEFAULT DB
    const ediMappingsSnapshot = await ediMappingsRef.get();

    console.log(`\nFound ${ediMappingsSnapshot.size} documents in 'ediMappings' collection (default DB):`);
    if (ediMappingsSnapshot.empty) {
      console.log("No carrier mappings found in ediMappings.");
    }
    ediMappingsSnapshot.forEach(doc => {
      console.log(`  ${doc.id} =>`, JSON.stringify(doc.data()).substring(0, 100) + '...');
      // Further checks can be added here, e.g., subcollection 'default' and doc 'mapping'
    });

    // Check 'carriers' collection (if it exists and is relevant)
    // const carriersRef = adminDb.collection('carriers');
    const carriersRef = db.collection('carriers'); // USE DEFAULT DB
    const carriersSnapshot = await carriersRef.get();
    if (!carriersSnapshot.empty) {
        console.log(`\nFound ${carriersSnapshot.size} documents in 'carriers' collection (default DB):`);
        carriersSnapshot.forEach(doc => {
            console.log(`  ${doc.id} =>`, JSON.stringify(doc.data()).substring(0, 100) + '...');
        });
    } else {
        console.log("\n'carriers' collection is empty or does not exist in default DB.");
    }

  } catch (error) {
    console.error("Error checking mappings:", error);
  }
}

checkMappings().then(() => {
  console.log("\nMapping check script finished.");
}).catch(err => {
    console.error("Script execution failed:", err)
}); 