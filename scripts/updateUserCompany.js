const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');
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

async function updateUserCompany() {
  try {
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    console.log(`Found ${usersSnapshot.size} users`);

    // Update each user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      console.log('Updating user:', userData.email);

      // Create the connectedCompanies structure with the correct format
      const connectedCompanies = {
        companies: ["OSJ4266"]
      };

      // Update the user document
      await updateDoc(doc(db, 'users', userDoc.id), {
        connectedCompanies
      });

      console.log('Updated user:', userData.email);
    }

    console.log('All users have been updated successfully');
  } catch (error) {
    console.error('Error updating users:', error);
  }
}

updateUserCompany(); 