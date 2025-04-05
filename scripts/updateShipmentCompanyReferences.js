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

async function updateShipmentCompanyReferences() {
  try {
    // Get all companies to create a mapping of document IDs to companyIDs
    const companiesRef = collection(db, 'companies');
    const companiesSnapshot = await getDocs(companiesRef);
    
    // Create a mapping of company document IDs to companyIDs
    const companyIdMap = {};
    companiesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.companyID) {
        companyIdMap[doc.id] = data.companyID;
      }
    });
    
    console.log(`Found ${companiesSnapshot.size} companies with companyIDs`);
    
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
      const currentCompanyId = shipmentData.companyId;
      
      // Skip if shipment doesn't have a companyId
      if (!currentCompanyId) {
        console.log(`Skipped: Shipment ${docSnapshot.id} (no companyId found)`);
        skippedCount++;
        continue;
      }
      
      // Check if we have a mapping for this company ID
      if (companyIdMap[currentCompanyId]) {
        // Update the shipment document with the companyID
        const shipmentRef = doc(db, 'shipments', docSnapshot.id);
        await updateDoc(shipmentRef, {
          companyId: companyIdMap[currentCompanyId]
        });
        
        console.log(`Updated: Shipment ${docSnapshot.id} -> Changed companyId from ${currentCompanyId} to ${companyIdMap[currentCompanyId]}`);
        updatedCount++;
      } else {
        console.log(`Error: Shipment ${docSnapshot.id} -> Company with ID ${currentCompanyId} not found in mapping`);
        errorCount++;
      }
    }

    console.log('\nUpdate Summary:');
    console.log(`Total shipments processed: ${shipmentsSnapshot.size}`);
    console.log(`Shipments updated: ${updatedCount}`);
    console.log(`Shipments skipped: ${skippedCount}`);
    console.log(`Shipments with errors: ${errorCount}`);

  } catch (error) {
    console.error('Error updating shipment company references:', error);
  }
}

// Run the update
updateShipmentCompanyReferences(); 