const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migratePackagesToSubcollection() {
  try {
    console.log('Starting package migration...');
    
    // Get all shipment documents
    const shipmentsSnapshot = await db.collection('shipments').get();
    
    let processedCount = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process each shipment
    for (const doc of shipmentsSnapshot.docs) {
      processedCount++;
      const shipmentData = doc.data();
      
      // Check if the shipment has packages
      if (shipmentData.packages && Array.isArray(shipmentData.packages) && shipmentData.packages.length > 0) {
        try {
          // Create a batch for this shipment's packages
          const batch = db.batch();
          
          // Add each package to the subcollection
          shipmentData.packages.forEach((pkg, index) => {
            const packageRef = db.collection('shipments').doc(doc.id).collection('packages').doc();
            batch.set(packageRef, pkg);
          });
          
          // Commit the batch
          await batch.commit();
          
          // Remove packages from the main document
          await db.collection('shipments').doc(doc.id).update({
            packages: admin.firestore.FieldValue.delete()
          });
          
          migratedCount++;
          console.log(`Migrated ${shipmentData.packages.length} packages for shipment ${doc.id}`);
        } catch (error) {
          errorCount++;
          console.error(`Error migrating packages for shipment ${doc.id}:`, error);
        }
      } else {
        skippedCount++;
        console.log(`Skipped shipment ${doc.id} - no packages found`);
      }
      
      // Log progress every 10 shipments
      if (processedCount % 10 === 0) {
        console.log(`Processed ${processedCount} shipments so far...`);
      }
    }
    
    console.log('Migration completed!');
    console.log(`Total shipments processed: ${processedCount}`);
    console.log(`Shipments with migrated packages: ${migratedCount}`);
    console.log(`Shipments skipped (no packages): ${skippedCount}`);
    console.log(`Shipments with errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Exit the process
    process.exit(0);
  }
}

// Run the migration
migratePackagesToSubcollection(); 