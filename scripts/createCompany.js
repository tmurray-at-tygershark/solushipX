const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
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

async function createCompany() {
  try {
    const companyId = "OSJ4266";
    const companyData = {
      id: companyId,
      companyID: companyId,
      name: "SolushipX",
      type: "shipper",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      
      // Contact Information
      contact: {
        name: "Tyler",
        email: "tyler@tygershark.com",
        phone: "",
        position: "Admin"
      },
      
      // Address
      address: {
        street: "",
        street2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "US"
      },
      
      // Business Details
      businessDetails: {
        taxId: "",
        registrationNumber: "",
        industry: "Logistics",
        size: "medium"
      },

      // Ship From Addresses
      shipFromAddresses: [
        {
          id: "default",
          name: "Headquarters",
          company: "SolushipX",
          street: "",
          street2: "",
          city: "",
          state: "",
          postalCode: "",
          country: "US",
          contactName: "Tyler",
          contactPhone: "",
          contactEmail: "tyler@tygershark.com",
          isDefault: true
        }
      ]
    };

    // Create the company document
    await setDoc(doc(db, 'companies', companyId), companyData);
    console.log(`Successfully created company document with ID: ${companyId}`);

  } catch (error) {
    console.error('Error creating company:', error);
  }
}

// Run the function
createCompany(); 