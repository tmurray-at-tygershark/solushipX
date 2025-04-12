const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, getDoc, doc } = require('firebase/firestore');
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

async function checkUserCompany() {
  try {
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    console.log(`Found ${usersSnapshot.size} users\n`);

    // Process each user
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      console.log('User:', {
        id: doc.id,
        email: userData.email,
        role: userData.role,
        connectedCompanies: userData.connectedCompanies || 'not set'
      });

      // If user has a company ID, check if company exists
      if (userData.companyId) {
        const companyDoc = await getDoc(doc(db, 'companies', userData.companyId));
        console.log('Company exists:', companyDoc.exists());
        if (companyDoc.exists()) {
          const companyData = companyDoc.data();
          console.log('Company data:', {
            id: companyDoc.id,
            name: companyData.name,
            companyID: companyData.companyID
          });
        }
      }
      console.log('\n');
    }
  } catch (error) {
    console.error('Error checking user company:', error);
  }
}

checkUserCompany(); 