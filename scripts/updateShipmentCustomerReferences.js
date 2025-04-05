const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where } = require('firebase/firestore');
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

async function updateShipmentCustomerReferences() {
  try {
    // Get all customers to create a mapping of document IDs to customerIDs
    const customersRef = collection(db, 'customers');
    const customersSnapshot = await getDocs(customersRef);
    
    // Create a mapping of customer document IDs to customerIDs
    const customerIdMap = {};
    customersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.customerID) {
        customerIdMap[doc.id] = data.customerID;
      }
    });
    
    console.log(`Found ${customersSnapshot.size} customers with customerIDs`);
    
    // Get all shipments
    const shipmentsRef = collection(db, 'shipments');
    const shipmentsSnapshot = await getDocs(shipmentsRef);
    console.log(`Found ${shipmentsSnapshot.size} shipments`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each shipment
    for (const docSnapshot of shipmentsSnapshot.docs) {
      const shipmentData = docSnapshot.data();
      const currentCustomerId = shipmentData.customerId;
      
      // Skip if shipment doesn't have a customerId
      if (!currentCustomerId) {
        console.log(`Skipped: Shipment ${docSnapshot.id} (no customerId found)`);
        skippedCount++;
        continue;
      }
      
      // Check if we have a mapping for this customer ID
      if (customerIdMap[currentCustomerId]) {
        // Update the shipment document with the customerID
        const shipmentRef = doc(db, 'shipments', docSnapshot.id);
        await updateDoc(shipmentRef, {
          customerId: customerIdMap[currentCustomerId]
        });
        
        console.log(`Updated: Shipment ${docSnapshot.id} -> Changed customerId from ${currentCustomerId} to ${customerIdMap[currentCustomerId]}`);
        updatedCount++;
      } else {
        console.log(`Error: Shipment ${docSnapshot.id} -> Customer with ID ${currentCustomerId} not found in mapping`);
        errorCount++;
      }
    }

    console.log('\nUpdate Summary:');
    console.log(`Total shipments processed: ${shipmentsSnapshot.size}`);
    console.log(`Shipments updated: ${updatedCount}`);
    console.log(`Shipments skipped: ${skippedCount}`);
    console.log(`Shipments with errors: ${errorCount}`);

  } catch (error) {
    console.error('Error updating shipment customer references:', error);
  }
}

// Run the update
updateShipmentCustomerReferences(); 