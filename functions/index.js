const functions = require('firebase-functions/v2');
const axios = require('axios');
const { parseStringPromise } = require("xml2js");
require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

// Import GenKit dependencies
const { gemini20Flash, googleAI } = require('@genkit-ai/googleai');
const { genkit } = require('genkit');

// Configure GenKit instance
const ai = genkit({
  plugins: [googleAI()],
  model: gemini20Flash,
  stream: true // Enable streaming by default
});

// Initialize with the specific service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log('Initialized Admin SDK with service account');

// Import function handlers
const { getRatesEShipPlus } = require('./src/getRates-EShipPlus');
const { getCompany } = require('./src/getCompany');
const { getCompanyCustomers } = require('./src/getCompanyCustomers');
const { getCompanyCustomerDestinations } = require('./src/getCompanyCustomerDestinations');

// Export the Callable rate function (Used by Frontend)
exports.getRatesEShipPlus = getRatesEShipPlus;

// Export other Callable functions
exports.getCompany = functions.https.onCall({ /* ... */ }, getCompany);
exports.getCompanyCustomers = functions.https.onCall({ 
    minInstances: 0,
    timeoutSeconds: 60,
  memory: '256MiB'
}, (data, context) => {
  // Safely log only primitive data without circular references
  console.log("getCompanyCustomers called with companyId:", 
    data?.companyId || (data?.data && data.data.companyId) || 'No ID provided');
  
  // Add a try-catch wrapper to ensure errors are properly logged
  try {
    return getCompanyCustomers(data, context);
  } catch (error) {
    console.error("getCompanyCustomers function error:", error.message);
    throw error;
  }
});
exports.getCompanyCustomerDestinations = functions.https.onCall({ /* ... */ }, (data, context) => { /* ... */ });
