const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// IMPORTANT: Replace with your actual service account credentials file path
const serviceAccount = require("../../../service-account.json");

// Initialize a specific Firebase app instance for this script
// This prevents conflicts if other parts of your functions init admin differently
let scriptApp;
if (!admin.apps.find(app => app.name === 'migrationScriptApp')) {
  scriptApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL: 'YOUR_PROJECT_ID.firebaseio.com' // Optional: If needed for specific project targeting
  }, 'migrationScriptApp');
} else {
  scriptApp = admin.app('migrationScriptApp');
}

// Get a Firestore client for the (default) database
const defaultDb = getFirestore(scriptApp); 

// Get a Firestore client specifically for the 'admin' database
const adminDb = getFirestore(scriptApp, 'admin');

const COLLECTIONS_TO_COPY_DIRECTLY = ['ediUploads', 'ediResults']; // ediMappings handled separately
const EDI_MAPPINGS_COLLECTION = 'ediMappings';
const BATCH_SIZE = 200; // Firestore batch limit is 500, use a smaller size for safety

async function copySimpleCollection(sourceDb, destDb, collectionName) {
  console.log(`Starting direct copy for collection: ${collectionName}`);
  const sourceCollectionRef = sourceDb.collection(collectionName);
  const destCollectionRef = destDb.collection(collectionName);
  let lastDocument = null;
  let documentsCopied = 0;
  let batchesCommitted = 0;

  while (true) {
    let query = sourceCollectionRef.orderBy(admin.firestore.FieldPath.documentId()).limit(BATCH_SIZE);
    if (lastDocument) {
      query = query.startAfter(lastDocument);
    }
    const snapshot = await query.get();
    if (snapshot.empty) break;

    let batch = destDb.batch();
    let currentBatchSize = 0;
    snapshot.docs.forEach(doc => {
      batch.set(destCollectionRef.doc(doc.id), doc.data());
      currentBatchSize++;
      documentsCopied++;
      lastDocument = doc;
    });

    if (currentBatchSize > 0) {
      await batch.commit();
      batchesCommitted++;
      console.log(`  Committed batch ${batchesCommitted} for ${collectionName} (${currentBatchSize} docs). Total: ${documentsCopied}`);
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  console.log(`Finished direct copy for ${collectionName}. Copied ${documentsCopied} documents.
`);
}

async function copyEdiMappingsWithSubcollections(sourceDb, destDb) {
  const collectionName = EDI_MAPPINGS_COLLECTION;
  console.log(`Starting copy for collection with subcollections: ${collectionName}`);
  const sourceCollectionRef = sourceDb.collection(collectionName);
  const destCollectionRef = destDb.collection(collectionName);
  let parentDocumentsCopied = 0;
  let subDocumentsCopied = 0;
  let batchesCommitted = 0;

  const parentDocsSnapshot = await sourceCollectionRef.get();
  if (parentDocsSnapshot.empty) {
    console.log(`No documents found in ${collectionName} in the source database.`);
    return;
  }

  for (const parentDoc of parentDocsSnapshot.docs) {
    const parentDocId = parentDoc.id;
    const parentDocData = parentDoc.data();
    const destParentDocRef = destCollectionRef.doc(parentDocId);

    console.log(`  Processing parent document: ${collectionName}/${parentDocId}`);
    
    // Create a batch for this parent doc and its subcollections
    let currentOverallBatch = destDb.batch();
    let operationsInCurrentBatch = 0;

    // Copy parent document data (if any actual data exists beyond subcollections)
    // Check if parentDocData has own properties (not just empty from subcollections)
    if (Object.keys(parentDocData).length > 0) {
        currentOverallBatch.set(destParentDocRef, parentDocData, { merge: true }); // Merge to be safe with existing data
        operationsInCurrentBatch++;
        console.log(`    Scheduled set for parent document ${parentDocId}`);
    }
    parentDocumentsCopied++;

    // Handle 'default' subcollection
    const sourceSubCollectionRef = sourceCollectionRef.doc(parentDocId).collection('default');
    const destSubCollectionRef = destParentDocRef.collection('default');
    const subCollectionSnapshot = await sourceSubCollectionRef.get();

    if (!subCollectionSnapshot.empty) {
      console.log(`    Found ${subCollectionSnapshot.size} documents in 'default' subcollection of ${parentDocId}`);
      subCollectionSnapshot.docs.forEach(subDoc => {
        const subDocData = subDoc.data();
        const destSubDocRef = destSubCollectionRef.doc(subDoc.id);
        currentOverallBatch.set(destSubDocRef, subDocData); // Overwrite subcollection docs
        operationsInCurrentBatch++;
        subDocumentsCopied++;
        if (operationsInCurrentBatch >= BATCH_SIZE -1) { // -1 to leave space for a potential parent doc write if it was deferred
            console.log(`      Committing batch due to size limit within subcollection of ${parentDocId}`);
            currentOverallBatch.commit().then(() => batchesCommitted++); // Fire and forget for now, or await if strict order needed
            currentOverallBatch = destDb.batch();
            operationsInCurrentBatch = 0;
        }
      });
    } else {
      console.log(`    No 'default' subcollection found or empty for ${parentDocId}`);
    }
    
    // Commit any remaining operations for this parent document and its subcollections
    if (operationsInCurrentBatch > 0) {
        console.log(`    Committing final batch for parent ${parentDocId} with ${operationsInCurrentBatch} operations.`);
        await currentOverallBatch.commit();
        batchesCommitted++;
    }
    await new Promise(resolve => setTimeout(resolve, 50)); // Delay after each parent doc
  }
  console.log(`Finished copying ${collectionName}. Parent docs processed: ${parentDocumentsCopied}, Subcollection docs copied: ${subDocumentsCopied}. Total batches: ${batchesCommitted}.
`);
}

async function migrateAdminDataToDefault() {
  console.log("Starting migration of data from 'admin' database to '(default)' database.");
  console.warn("IMPORTANT: Ensure you have backed up both databases before proceeding!");
  console.log("This script will copy documents. If a document with the same ID exists in the default DB, it will be OVERWRITTEN (except for ediMappings parent which uses merge).");

  try {
    for (const collectionName of COLLECTIONS_TO_COPY_DIRECTLY) {
      await copySimpleCollection(adminDb, defaultDb, collectionName);
    }
    await copyEdiMappingsWithSubcollections(adminDb, defaultDb);

    console.log("\nData migration completed successfully for all specified collections!");
  } catch (error) {
    console.error("Error during data migration:", error);
    console.error("Migration FAILED. Please check the logs and your database states.");
  }
}

migrateAdminDataToDefault().then(() => {
  console.log("\nMigration script finished execution.");
  // Consider exiting the process if run as a standalone script
  // process.exit(0);
}).catch(err => {
  console.error("Script execution failed with unhandled error:", err);
  // process.exit(1);
}); 