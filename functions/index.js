const functions = require('firebase-functions/v2');
const axios = require('axios');
const { parseStringPromise } = require("xml2js");
require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
const { onCall } = require("firebase-functions/v2/https");

// Import GenKit dependencies
const { gemini20Flash, googleAI } = require('@genkit-ai/googleai');
const { genkit } = require('genkit');

// Configure GenKit instance
const ai = genkit({
  plugins: [googleAI()],
  model: gemini20Flash,
  stream: true // Enable streaming by default
});

// Initialize Firebase Admin SDK ONCE
if (admin.apps.length === 0) { 
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "solushipx.firebasestorage.app"
  });
  console.log('Initialized Admin SDK with correct storage bucket');
} else {
  console.log('Admin SDK already initialized.');
}

const db = admin.firestore();

// Import function handlers
const { getRatesEShipPlus } = require('./src/carrier-api/eshipplus/getRates');
const { getRatesCanpar } = require('./src/carrier-api/canpar/getRates');
const { generateCanparLabel } = require('./src/carrier-api/canpar/generateLabel');
const { bookRateUniversal } = require('./src/bookRateUniversal');
const ediProcessing = require('./src/edi-processing');
const { checkEdiUploads } = require('./src/check-edi-uploads');
const { generateEdiMapping } = require('./src/mapping_functions');
const { adminCreateUser } = require('./src/admin-create-user');
const { adminResetUserPassword, checkUserCompanyOwnership, adminDeleteUser, adminGetUsersAuthData } = require('./src/admin-user-management');
const { getShipmentDocuments, getDocumentDownloadUrl } = require('./src/getShipmentDocuments');
const { checkShipmentStatus } = require('./src/checkShipmentStatus');

// Export Callable functions
exports.getRatesEShipPlus = getRatesEShipPlus;
exports.getRatesCanpar = getRatesCanpar;
exports.generateCanparLabel = generateCanparLabel;
exports.bookRateUniversal = bookRateUniversal;
exports.onFileUploaded = ediProcessing.onFileUploaded;
exports.processEdiFile = ediProcessing.processEdiFile;
exports.processEdiHttp = ediProcessing.processEdiHttp;
exports.processEdiManual = ediProcessing.processEdiManual;
exports.checkEdiUploads = checkEdiUploads;
exports.generateEdiMapping = generateEdiMapping;
exports.adminCreateUser = adminCreateUser;
exports.adminResetUserPassword = adminResetUserPassword;
exports.checkUserCompanyOwnership = checkUserCompanyOwnership;
exports.adminDeleteUser = adminDeleteUser;
exports.adminGetUsersAuthData = adminGetUsersAuthData;
exports.getShipmentDocuments = getShipmentDocuments;
exports.getDocumentDownloadUrl = getDocumentDownloadUrl;
exports.checkShipmentStatus = checkShipmentStatus;
