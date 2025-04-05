const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
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

async function inspectShipments() {
  try {
    console.log('Inspecting shipments collection in production...');
    
    // Get all shipments
    const shipmentsSnapshot = await getDocs(collection(db, 'shipments'));
    
    if (shipmentsSnapshot.empty) {
      console.log('No shipments found in the database.');
      return;
    }

    console.log(`Found ${shipmentsSnapshot.size} shipments.`);
    
    // Analyze the structure of the first shipment
    const firstShipment = shipmentsSnapshot.docs[0];
    console.log('\nSample Shipment Structure:');
    console.log('----------------------------');
    console.log('Document ID:', firstShipment.id);
    console.log('Data:', JSON.stringify(firstShipment.data(), null, 2));

    // Analyze all unique fields across shipments
    const allFields = new Set();
    shipmentsSnapshot.forEach(doc => {
      const data = doc.data();
      Object.keys(data).forEach(field => allFields.add(field));
    });

    console.log('\nAll Fields Found:');
    console.log('-----------------');
    allFields.forEach(field => console.log(field));

    // Count shipments by status
    const statusCount = {};
    shipmentsSnapshot.forEach(doc => {
      const status = doc.data().status || 'unknown';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });

    console.log('\nShipments by Status:');
    console.log('-------------------');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`${status}: ${count}`);
    });

  } catch (error) {
    console.error('Error inspecting shipments:', error);
  } finally {
    process.exit();
  }
}

inspectShipments(); 