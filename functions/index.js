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

// Import EDI processing functions
const ediProcessing = require('./src/edi-processing');

// Export the Callable rate function (Used by Frontend)
exports.getRatesEShipPlus = getRatesEShipPlus;

// Export other Callable functions using v2 syntax

// Export EDI processing functions
exports.onFileUploaded = ediProcessing.onFileUploaded;
exports.processEdiFile = ediProcessing.processEdiFile;
exports.processEdiHttp = ediProcessing.processEdiHttp;
exports.processEdiManual = ediProcessing.processEdiManual;

// Export diagnostic functions
const { checkEdiUploads } = require('./src/check-edi-uploads');
exports.checkEdiUploads = checkEdiUploads;

const { generateEdiMapping } = require('./src/mapping_functions');

// If you have an Express app or other functions, import and export them as well:
// const { api } = require('./src/index');
// exports.api = api;

exports.generateEdiMapping = generateEdiMapping;
// Export other functions as needed
