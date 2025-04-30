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
const { getCompanyShipmentOrigins } = require('./src/getCompanyShipmentOrigins');
const { getCompanyCustomers } = require('./src/getCompanyCustomers');
const { getCompanyCustomerDestinations } = require('./src/getCompanyCustomerDestinations');

// Export the Callable rate function (Used by Frontend)
exports.getRatesEShipPlus = getRatesEShipPlus;

// Export other Callable functions
exports.getCompany = functions.https.onCall({ /* ... */ }, getCompany);
exports.getCompanyShipmentOrigins = functions.https.onCall({ /* ... */ }, (data, context) => { /* ... */ });
exports.getCompanyCustomers = functions.https.onCall({ /* ... */ }, (data, context) => { /* ... */ });
exports.getCompanyCustomerDestinations = functions.https.onCall({ /* ... */ }, (data, context) => { /* ... */ });
