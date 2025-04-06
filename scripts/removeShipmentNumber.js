const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, deleteField } = require('firebase/firestore');
require('dotenv').config({ path: '../.env' });

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function removeShipmentNumber() {
  try {
    console.log('Starting removal of shipmentNumber field...');
    
    // Get all shipments
    const shipmentsSnapshot = await getDocs(collection(db, 'shipments'));
    console.log(`Found ${shipmentsSnapshot.size} shipments to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Process each shipment
    for (const shipmentDoc of shipmentsSnapshot.docs) {
      const shipmentData = shipmentDoc.data();
      
      // Check if shipmentNumber exists
      if ('shipmentNumber' in shipmentData) {
        // Use deleteField to explicitly remove the shipmentNumber field
        await updateDoc(doc(db, 'shipments', shipmentDoc.id), {
          shipmentNumber: deleteField()
        });
        
        console.log(`Removed shipmentNumber from shipment ${shipmentDoc.id}`);
        updatedCount++;
      } else {
        console.log(`Shipment ${shipmentDoc.id} does not have shipmentNumber field, skipping`);
        skippedCount++;
      }
    }
    
    console.log(`Migration completed successfully! Updated ${updatedCount} shipments, skipped ${skippedCount} shipments.`);
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run the migration
removeShipmentNumber(); 