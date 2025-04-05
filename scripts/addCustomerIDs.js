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

// Function to generate a random 7-digit alphanumeric string
function generateCustomerID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Function to check if a customer ID already exists
async function isCustomerIDUnique(customerID) {
  const customersRef = collection(db, 'customers');
  const snapshot = await getDocs(customersRef);
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.customerID === customerID) {
      return false;
    }
  }
  
  return true;
}

// Function to generate a unique customer ID
async function generateUniqueCustomerID() {
  let customerID;
  let isUnique = false;
  
  while (!isUnique) {
    customerID = generateCustomerID();
    isUnique = await isCustomerIDUnique(customerID);
  }
  
  return customerID;
}

async function addCustomerIDs() {
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
      
      // Skip if customer already has a customerID
      if (customerData.customerID) {
        console.log(`Skipped: "${customerData.name}" (already has customerID: ${customerData.customerID})`);
        skippedCount++;
        continue;
      }
      
      // Generate a unique customer ID
      const customerID = await generateUniqueCustomerID();
      
      // Update the customer document
      const customerRef = doc(db, 'customers', docSnapshot.id);
      await updateDoc(customerRef, {
        customerID: customerID
      });
      
      console.log(`Updated: "${customerData.name}" -> Added customerID: ${customerID}`);
      updatedCount++;
    }

    console.log('\nUpdate Summary:');
    console.log(`Total customers processed: ${customersSnapshot.size}`);
    console.log(`Customers updated: ${updatedCount}`);
    console.log(`Customers skipped: ${skippedCount}`);

  } catch (error) {
    console.error('Error adding customer IDs:', error);
  }
}

// Run the update
addCustomerIDs(); 