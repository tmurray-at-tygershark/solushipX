const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where } = require('firebase/firestore');
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

async function migrateRatesToNested() {
  try {
    console.log('Starting migration of rates to nested structure...');
    
    // Get all shipment rates
    const ratesSnapshot = await getDocs(collection(db, 'shipmentRates'));
    console.log(`Found ${ratesSnapshot.size} rates to migrate`);
    
    // Process each rate
    for (const rateDoc of ratesSnapshot.docs) {
      const rateData = rateDoc.data();
      const shipmentId = rateData.shipmentId;
      
      if (!shipmentId) {
        console.log(`Rate ${rateDoc.id} has no shipmentId, skipping`);
        continue;
      }
      
      // Find the corresponding shipment
      const shipmentsRef = collection(db, 'shipments');
      const q = query(shipmentsRef, where('shipmentID', '==', shipmentId));
      const shipmentSnapshot = await getDocs(q);
      
      if (shipmentSnapshot.empty) {
        console.log(`No shipment found for rate ${rateDoc.id} with shipmentId ${shipmentId}`);
        continue;
      }
      
      const shipmentDoc = shipmentSnapshot.docs[0];
      
      // Prepare rate data for nesting (remove shipmentId as it's redundant)
      const nestedRateData = { ...rateData };
      delete nestedRateData.shipmentId;
      
      // Update the shipment document with the nested rate
      await updateDoc(doc(db, 'shipments', shipmentDoc.id), {
        rate: nestedRateData
      });
      
      console.log(`Successfully nested rate for shipment ${shipmentId}`);
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run the migration
migrateRatesToNested(); 