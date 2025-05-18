import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
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
console.log("Firebase Client Config In Use:", JSON.stringify(firebaseConfig, null, 2));
console.log("FIREBASE ENV TEST: firebaseConfig:", firebaseConfig);

// Initialize Auth
const auth = getAuth(app);

// Initialize Firestore - Default database
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

// Initialize Functions
const functions = getFunctions(app);

// Define callable functions
const analyzeRatesWithAI = httpsCallable(functions, 'analyzeRatesWithAI');
const getMapsApiKey = httpsCallable(functions, 'getMapsApiKey');

// Helper function to wrap callable functions
const wrapCallable = (func) => {
    return async (data) => {
        try {
            const result = await func(data);
            return result.data; // Assuming functions return { data: ... }
        } catch (error) {
            console.error(`Error calling function ${func.name}:`, error);
            throw error; // Re-throw for components to handle
        }
    };
};

// Define wrapped functions
const wrappedAnalyzeRatesWithAI = wrapCallable(analyzeRatesWithAI);
const wrappedGetMapsApiKey = wrapCallable(getMapsApiKey);

export {
    auth,
    db,
    storage,
    functions,
    wrappedAnalyzeRatesWithAI,
    wrappedGetMapsApiKey
}; 