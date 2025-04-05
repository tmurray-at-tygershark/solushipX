const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, updateDoc } = require('firebase/firestore');
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

async function updateTrackingShipmentIds() {
  try {
    // Get all tracking numbers
    const trackingRef = collection(db, 'tracking');
    const trackingSnapshot = await getDocs(trackingRef);
    console.log(`Found ${trackingSnapshot.size} tracking records`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each tracking record
    for (const docSnapshot of trackingSnapshot.docs) {
      const trackingData = docSnapshot.data();
      const currentShipmentId = trackingData.shipmentId;
      
      // Skip if tracking record doesn't have a shipmentId
      if (!currentShipmentId) {
        console.log(`Skipped: Tracking record ${docSnapshot.id} (no shipmentId found)`);
        skippedCount++;
        continue;
      }

      try {
        // Get the shipment document to get its shipmentID
        const shipmentRef = doc(db, 'shipments', currentShipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (shipmentDoc.exists()) {
          const shipmentData = shipmentDoc.data();
          const newShipmentId = shipmentData.shipmentID;
          
          if (newShipmentId) {
            // Update the tracking document with the new shipmentID
            const trackingRef = doc(db, 'tracking', docSnapshot.id);
            await updateDoc(trackingRef, {
              shipmentId: newShipmentId
            });
            
            console.log(`Updated: Tracking record ${docSnapshot.id} -> Changed shipmentId from ${currentShipmentId} to ${newShipmentId}`);
            updatedCount++;
          } else {
            console.log(`Error: Tracking record ${docSnapshot.id} -> Shipment ${currentShipmentId} has no shipmentID`);
            errorCount++;
          }
        } else {
          console.log(`Error: Tracking record ${docSnapshot.id} -> Shipment ${currentShipmentId} not found`);
          errorCount++;
        }
      } catch (error) {
        console.error(`Error updating tracking record ${docSnapshot.id}:`, error);
        errorCount++;
      }
    }

    console.log('\nUpdate Summary:');
    console.log(`Total tracking records processed: ${trackingSnapshot.size}`);
    console.log(`Records updated: ${updatedCount}`);
    console.log(`Records skipped: ${skippedCount}`);
    console.log(`Records with errors: ${errorCount}`);

  } catch (error) {
    console.error('Error updating tracking shipment IDs:', error);
  }
}

// Run the update
updateTrackingShipmentIds(); 