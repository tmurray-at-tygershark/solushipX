const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, deleteDoc } = require('firebase/firestore');
require('dotenv').config();

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

async function deleteEmptyShipments() {
  try {
    console.log('Starting to check for empty shipments...');
    
    // Get all shipments
    const shipmentsRef = collection(db, 'shipments');
    const shipmentsSnapshot = await getDocs(shipmentsRef);
    
    console.log(`Found ${shipmentsSnapshot.size} total shipments`);
    
    let deletedCount = 0;
    let checkedCount = 0;
    
    // Process each shipment
    for (const doc of shipmentsSnapshot.docs) {
      checkedCount++;
      const shipmentData = doc.data();
      
      // Check if the shipment is empty or incomplete
      const isEmpty = !shipmentData.shipmentInfo || 
                     !shipmentData.shipFrom || 
                     !shipmentData.shipTo || 
                     !shipmentData.selectedRate;
      
      if (isEmpty) {
        console.log(`Deleting empty shipment ${doc.id}`);
        await deleteDoc(doc.ref);
        deletedCount++;
      }
      
      // Log progress every 10 shipments
      if (checkedCount % 10 === 0) {
        console.log(`Checked ${checkedCount} shipments so far...`);
      }
    }
    
    console.log('\nDeletion Summary:');
    console.log(`Total shipments checked: ${checkedCount}`);
    console.log(`Empty shipments deleted: ${deletedCount}`);
    console.log(`Remaining shipments: ${checkedCount - deletedCount}`);
    
  } catch (error) {
    console.error('Error deleting empty shipments:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
deleteEmptyShipments(); 