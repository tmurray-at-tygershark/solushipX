import { initializeApp } from 'firebase/app';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

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

// Initialize Functions with custom URLs for Cloud Run
const functions = getFunctions(app, 'us-central1');

// Set custom function URLs for Cloud Run
const getShippingRates = functions.httpsCallable('getShippingRates', {
    url: 'https://getshippingrates-xedyh5vw7a-uc.a.run.app'
});

const analyzeRatesWithAI = functions.httpsCallable('analyzeRatesWithAI', {
    url: 'https://analyzerateswithai-xedyh5vw7a-uc.a.run.app'
});

const getMapsApiKey = functions.httpsCallable('getMapsApiKey', {
    url: 'https://getmapsapikey-xedyh5vw7a-uc.a.run.app'
});

// Connect to emulator in development
if (process.env.NODE_ENV === 'development') {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export { functions, getShippingRates, analyzeRatesWithAI, getMapsApiKey }; 