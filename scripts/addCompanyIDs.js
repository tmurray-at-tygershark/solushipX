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
function generateCompanyID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Function to check if a company ID already exists
async function isCompanyIDUnique(companyID) {
  const companiesRef = collection(db, 'companies');
  const snapshot = await getDocs(companiesRef);
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.companyID === companyID) {
      return false;
    }
  }
  
  return true;
}

// Function to generate a unique company ID
async function generateUniqueCompanyID() {
  let companyID;
  let isUnique = false;
  
  while (!isUnique) {
    companyID = generateCompanyID();
    isUnique = await isCompanyIDUnique(companyID);
  }
  
  return companyID;
}

async function addCompanyIDs() {
  try {
    // Get all companies
    const companiesRef = collection(db, 'companies');
    const companiesSnapshot = await getDocs(companiesRef);
    console.log(`Found ${companiesSnapshot.size} companies`);

    let updatedCount = 0;
    let skippedCount = 0;

    // Process each company
    for (const docSnapshot of companiesSnapshot.docs) {
      const companyData = docSnapshot.data();
      
      // Skip if company already has a companyID
      if (companyData.companyID) {
        console.log(`Skipped: "${companyData.name}" (already has companyID: ${companyData.companyID})`);
        skippedCount++;
        continue;
      }
      
      // Generate a unique company ID
      const companyID = await generateUniqueCompanyID();
      
      // Update the company document
      const companyRef = doc(db, 'companies', docSnapshot.id);
      await updateDoc(companyRef, {
        companyID: companyID
      });
      
      console.log(`Updated: "${companyData.name}" -> Added companyID: ${companyID}`);
      updatedCount++;
    }

    console.log('\nUpdate Summary:');
    console.log(`Total companies processed: ${companiesSnapshot.size}`);
    console.log(`Companies updated: ${updatedCount}`);
    console.log(`Companies skipped: ${skippedCount}`);

  } catch (error) {
    console.error('Error adding company IDs:', error);
  }
}

// Run the update
addCompanyIDs(); 