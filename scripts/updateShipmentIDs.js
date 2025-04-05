const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where, orderBy } = require('firebase/firestore');
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

async function updateShipmentIDs() {
  try {
    // Get all shipments
    const shipmentsRef = collection(db, 'shipments');
    const shipmentsSnapshot = await getDocs(shipmentsRef);
    console.log(`Found ${shipmentsSnapshot.size} shipments`);

    // Group shipments by companyId and customerId
    const shipmentGroups = {};
    
    shipmentsSnapshot.forEach(doc => {
      const data = doc.data();
      const companyId = data.companyId;
      const customerId = data.customerId;
      
      if (companyId && customerId) {
        const key = `${companyId}-${customerId}`;
        if (!shipmentGroups[key]) {
          shipmentGroups[key] = [];
        }
        shipmentGroups[key].push({
          id: doc.id,
          data: data
        });
      }
    });
    
    console.log(`Grouped shipments into ${Object.keys(shipmentGroups).length} company-customer combinations`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each group
    for (const [groupKey, shipments] of Object.entries(shipmentGroups)) {
      // Sort shipments by creation date to maintain chronological order
      shipments.sort((a, b) => {
        const dateA = a.data.createdAt?.seconds || 0;
        const dateB = b.data.createdAt?.seconds || 0;
        return dateA - dateB;
      });
      
      // Assign sequential numbers
      for (let i = 0; i < shipments.length; i++) {
        const shipment = shipments[i];
        const [companyId, customerId] = groupKey.split('-');
        const sequentialNumber = i + 1;
        const newShipmentID = `${companyId}-${customerId}-${sequentialNumber}`;
        
        try {
          // Update the shipment document
          const shipmentRef = doc(db, 'shipments', shipment.id);
          await updateDoc(shipmentRef, {
            shipmentID: newShipmentID
          });
          
          console.log(`Updated: Shipment ${shipment.id} -> Changed shipmentNumber to shipmentID: ${newShipmentID}`);
          updatedCount++;
        } catch (error) {
          console.error(`Error updating shipment ${shipment.id}:`, error);
          errorCount++;
        }
      }
    }

    console.log('\nUpdate Summary:');
    console.log(`Total shipments processed: ${shipmentsSnapshot.size}`);
    console.log(`Shipments updated: ${updatedCount}`);
    console.log(`Shipments skipped: ${skippedCount}`);
    console.log(`Shipments with errors: ${errorCount}`);

  } catch (error) {
    console.error('Error updating shipment IDs:', error);
  }
}

// Run the update
updateShipmentIDs(); 