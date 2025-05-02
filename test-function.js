// Test script for calling Firebase Functions
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFunctions, httpsCallable, connectFunctionsEmulator } = require('firebase/functions');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDn8W3z6dmmE4-EEXUYokYBD1DGAyCfZ3s",
  authDomain: "solushipx.firebaseapp.com",
  projectId: "solushipx",
  storageBucket: "solushipx.appspot.com",
  messagingSenderId: "631060580275",
  appId: "1:631060580275:web:1a98ce1603fbe6e15bbca4"
};

// Test function - this will run when you execute the script
async function testGetCompany() {
  console.log('Initializing Firebase...');
  
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const functions = getFunctions(app);
  
  try {
    console.log('Authenticating...');
    const auth = getAuth(app);
    
    // Replace with your test user credentials
    // You need a valid user that has access to the company in question
    const email = 'YOUR_TEST_EMAIL@example.com';
    const password = 'YOUR_TEST_PASSWORD';
    
    try {
      // Try to authenticate - this will help with Firestore permissions
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Authentication successful. User ID:', userCredential.user.uid);
    } catch (authError) {
      console.warn('Authentication failed:', authError.message);
      console.log('Will try to continue without authentication...');
    }
    
    // Get the cloud function
    console.log('Getting function reference...');
    const getCompanyFunction = httpsCallable(functions, 'getCompany');
    
    // Call the function with test data
    console.log('Calling getCompany function...');
    const companyId = 'OSJ4266';  // Replace with a valid company ID
    const response = await getCompanyFunction({ companyId });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('Success:', response.data.success);
    
    if (response.data.success) {
      const companyData = response.data.data;
      console.log(`Company data:`, companyData);
    }
  } catch (error) {
    console.error('Error calling function:', error);
    console.error('Error details:', error.message);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    if (error.details) {
      console.error('Error details:', error.details);
    }
  }
}

// Run the test
testGetCompany()
  .then(() => console.log('Test completed.'))
  .catch(err => console.error('Test failed:', err))
  .finally(() => process.exit()); 