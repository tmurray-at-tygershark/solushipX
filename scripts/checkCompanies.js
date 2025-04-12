const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkCompanies() {
  try {
    const companiesSnapshot = await getDocs(collection(db, 'companies'));
    console.log(`Found ${companiesSnapshot.size} companies\n`);

    companiesSnapshot.forEach(doc => {
      const data = doc.data();
      console.log('Company:', {
        id: doc.id,
        ...data
      });
    });
  } catch (error) {
    console.error('Error checking companies:', error);
  }
}

checkCompanies(); 