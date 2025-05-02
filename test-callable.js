const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getAuth } = require('firebase/auth');

// Firebase configuration with the provided key
const firebaseConfig = {
  apiKey: "AIzaSyAEzqSUkvl6wG5zS4XCbdjMsFNwOPtOo7E",
  authDomain: "solushipx.firebaseapp.com",
  projectId: "solushipx",
  storageBucket: "solushipx.firebasestorage.app",
  messagingSenderId: "631060580275",
  appId: "1:631060580275:web:b641b47fa623e65f90adc6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, 'us-central1');

// Create callable function reference - use a different function that still exists
const getCompany = httpsCallable(functions, 'getCompany');

// Call the function with a company ID
const companyId = 'OSJ4266';

async function testFunction() {
  try {
    // Skip authentication for testing
    console.log('Skipping authentication for testing...');
    
    // Call the function with a company ID
    console.log(`Testing getCompany with companyId: ${companyId}`);
    const result = await getCompany({ companyId });
    console.log('Function call successful!');
    console.log('Result:', JSON.stringify(result.data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.details) {
      console.error('Error details:', error.details);
    }
  }
}

// Run the test
testFunction(); 