const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
const serviceAccount = require('./solushipx-firebase-adminsdk-fbsvc-77f1f80481.json');

// Initialize with the specific service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
console.log('Initialized Admin SDK with service account');

// Import function handlers
const { getRatesEShipPlus } = require('./src/getRates-EShipPlus');
const { getCompany } = require('./src/getCompany');
const { getCompanyShipmentOrigins } = require('./src/getCompanyShipmentOrigins');

// Export the original rate function
exports.getRatesEShipPlus = getRatesEShipPlus;

// Export getCompany callable function
exports.getCompany = functions.https.onCall({
  cors: true,
  region: 'us-central1'
}, getCompany);

// Export getCompanyShipmentOrigins callable function with necessary configuration
exports.getCompanyShipmentOrigins = functions.https.onCall({
  region: 'us-central1',
  cors: true,
  enforceAppCheck: false,
  invoker: 'public',
  maxInstances: 10,
  timeoutSeconds: 120,
  memory: '256MiB',
}, (data, context) => {
  // The function runs with admin privileges regardless of the calling user
  return getCompanyShipmentOrigins(data, context);
});
