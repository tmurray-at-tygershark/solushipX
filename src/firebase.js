import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

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

// Initialize Auth
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Functions
const functions = getFunctions(app);

// Define callable functions
const getShippingRates = httpsCallable(functions, 'getShippingRates');
const analyzeRatesWithAI = httpsCallable(functions, 'analyzeRatesWithAI');
const getMapsApiKey = httpsCallable(functions, 'getMapsApiKey');

// Connect to emulator in development
if (process.env.NODE_ENV === 'development') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
}

// Add error handling for functions
const wrapCallable = (callable) => {
    return async (...args) => {
        try {
            const result = await callable(...args);
            return result.data;
        } catch (error) {
            console.error('Firebase function error:', error);
            throw error;
        }
    };
};

// Export wrapped functions
const wrappedGetShippingRates = wrapCallable(getShippingRates);
const wrappedAnalyzeRatesWithAI = wrapCallable(analyzeRatesWithAI);
const wrappedGetMapsApiKey = wrapCallable(getMapsApiKey);

export {
    auth,
    db,
    functions,
    wrappedGetShippingRates,
    wrappedAnalyzeRatesWithAI,
    wrappedGetMapsApiKey
}; 