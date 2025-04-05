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

async function updateCustomerNames() {
  try {
    // Get all customers
    const customersRef = collection(db, 'customers');
    const customersSnapshot = await getDocs(customersRef);
    console.log(`Found ${customersSnapshot.size} customers`);

    let updatedCount = 0;
    let skippedCount = 0;

    // Process each customer
    for (const docSnapshot of customersSnapshot.docs) {
      const customerData = docSnapshot.data();
      const currentName = customerData.name || '';

      // Check if the name starts with "Customer" followed by a number or "of" prefix
      const customerPrefixRegex = /^(Customer\s*\d+\s*[-:]?\s*|of\s+)/i;
      if (customerPrefixRegex.test(currentName)) {
        // Extract the actual name by removing the prefix and trailing spaces
        const actualName = currentName.replace(customerPrefixRegex, '').trim();
        
        // Update the customer document
        const customerRef = doc(db, 'customers', docSnapshot.id);
        await updateDoc(customerRef, {
          name: actualName
        });
        
        console.log(`Updated: "${currentName}" -> "${actualName}"`);
        updatedCount++;
      } else {
        console.log(`Skipped: "${currentName}" (no prefix found)`);
        skippedCount++;
      }
    }

    console.log('\nUpdate Summary:');
    console.log(`Total customers processed: ${customersSnapshot.size}`);
    console.log(`Customers updated: ${updatedCount}`);
    console.log(`Customers skipped: ${skippedCount}`);

  } catch (error) {
    console.error('Error updating customer names:', error);
  }
}

// Run the update
updateCustomerNames(); 