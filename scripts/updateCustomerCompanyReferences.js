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

async function updateCustomerCompanyReferences() {
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
    
    // Get all customers
    const customersRef = collection(db, 'customers');
    const customersSnapshot = await getDocs(customersRef);
    console.log(`Found ${customersSnapshot.size} customers`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each customer
    for (const docSnapshot of customersSnapshot.docs) {
      const customerData = docSnapshot.data();
      const currentCompanyId = customerData.companyId;
      
      // Skip if customer doesn't have a companyId
      if (!currentCompanyId) {
        console.log(`Skipped: "${customerData.name}" (no companyId found)`);
        skippedCount++;
        continue;
      }
      
      // Check if we have a mapping for this company ID
      if (companyIdMap[currentCompanyId]) {
        // Update the customer document with the companyID
        const customerRef = doc(db, 'customers', docSnapshot.id);
        await updateDoc(customerRef, {
          companyId: companyIdMap[currentCompanyId]
        });
        
        console.log(`Updated: "${customerData.name}" -> Changed companyId from ${currentCompanyId} to ${companyIdMap[currentCompanyId]}`);
        updatedCount++;
      } else {
        console.log(`Error: "${customerData.name}" -> Company with ID ${currentCompanyId} not found in mapping`);
        errorCount++;
      }
    }

    console.log('\nUpdate Summary:');
    console.log(`Total customers processed: ${customersSnapshot.size}`);
    console.log(`Customers updated: ${updatedCount}`);
    console.log(`Customers skipped: ${skippedCount}`);
    console.log(`Customers with errors: ${errorCount}`);

  } catch (error) {
    console.error('Error updating customer company references:', error);
  }
}

// Run the update
updateCustomerCompanyReferences(); 