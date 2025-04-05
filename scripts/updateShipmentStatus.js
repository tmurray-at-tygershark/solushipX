const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
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

// List of possible shipment statuses
const SHIPMENT_STATUSES = [
    'Pending',
    'Awaiting Shipment',
    'In Transit',
    'On Hold',
    'Delivered',
    'Cancelled'
];

// Helper function to get random status
function getRandomStatus() {
    const randomIndex = Math.floor(Math.random() * SHIPMENT_STATUSES.length);
    return SHIPMENT_STATUSES[randomIndex];
}

async function updateShipmentStatuses() {
    try {
        // Get all shipments
        const shipmentsRef = collection(db, 'shipments');
        const shipmentsSnapshot = await getDocs(shipmentsRef);
        console.log(`Found ${shipmentsSnapshot.size} shipments`);

        let updatedCount = 0;
        let errorCount = 0;

        // Process each shipment
        for (const docSnapshot of shipmentsSnapshot.docs) {
            try {
                const newStatus = getRandomStatus();
                
                // Update the shipment document with the new status
                const shipmentRef = doc(db, 'shipments', docSnapshot.id);
                await updateDoc(shipmentRef, {
                    status: newStatus
                });
                
                console.log(`Updated: Shipment ${docSnapshot.id} with status: ${newStatus}`);
                updatedCount++;
            } catch (error) {
                console.error(`Error updating shipment ${docSnapshot.id}:`, error);
                errorCount++;
            }
        }

        console.log('\nUpdate Summary:');
        console.log(`Total shipments processed: ${shipmentsSnapshot.size}`);
        console.log(`Shipments updated: ${updatedCount}`);
        console.log(`Shipments with errors: ${errorCount}`);

    } catch (error) {
        console.error('Error updating shipment statuses:', error);
    }
}

// Run the update function
updateShipmentStatuses(); 