const functions = require('firebase-functions/v2');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK ONCE
if (!admin.apps.length) {
    admin.initializeApp();
    console.log('Firebase Admin initialized in main index.js');
} else {
    console.log('Firebase Admin already initialized.');
}

// Import function modules/files
const mappingFunctions = require("./mapping_functions");
const mappingTestRouter = require('./api/edi-mapping-test');
const carrierApiFunctions = require('./carrier-api');
const ediProcessingFunctions = require('./edi-processing');
const checkEdiUploadsFunctions = require('./check-edi-uploads');
const adminUserManagementFunctions = require('./admin-user-management');
const adminCreateUserFunctions = require('./admin-create-user'); 

// Initialize Express app
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Mount the mapping test router
app.use('/api/edi-mapping', mappingTestRouter);

// --- Define all exports for Firebase --- 

// HTTP Express App
exports.api = functions.https.onRequest(app);

// Callable/Triggered functions exported individually by their exact exported name
exports.generateEdiMapping = mappingFunctions.generateEdiMapping;

// Functions from carrier-api structure
if (carrierApiFunctions.getRatesEShipPlus) {
    exports.getRatesEShipPlus = carrierApiFunctions.getRatesEShipPlus;
}

// Functions from edi-processing.js
if (ediProcessingFunctions.onFileUploaded) {
    exports.onFileUploaded = ediProcessingFunctions.onFileUploaded;
}
if (ediProcessingFunctions.processEdiFile) {
    exports.processEdiFile = ediProcessingFunctions.processEdiFile;
}
if (ediProcessingFunctions.processEdiHttp) {
    exports.processEdiHttp = ediProcessingFunctions.processEdiHttp;
}
if (ediProcessingFunctions.processEdiManual) {
    exports.processEdiManual = ediProcessingFunctions.processEdiManual;
}

// Functions from check-edi-uploads.js
if (checkEdiUploadsFunctions.checkEdiUploads) {
    exports.checkEdiUploads = checkEdiUploadsFunctions.checkEdiUploads;
}

// Functions from admin-user-management.js
if (adminUserManagementFunctions.checkUserCompanyOwnership) {
    exports.checkUserCompanyOwnership = adminUserManagementFunctions.checkUserCompanyOwnership;
}
if (adminUserManagementFunctions.adminDeleteUser) {
    exports.adminDeleteUser = adminUserManagementFunctions.adminDeleteUser;
}
if (adminUserManagementFunctions.adminResetUserPassword) {
    exports.adminResetUserPassword = adminUserManagementFunctions.adminResetUserPassword;
}
if (adminUserManagementFunctions.adminGetUsersAuthData) {
    exports.adminGetUsersAuthData = adminUserManagementFunctions.adminGetUsersAuthData;
}

// Functions from admin-create-user.js
if (adminCreateUserFunctions.adminCreateUser) {
    exports.adminCreateUser = adminCreateUserFunctions.adminCreateUser;
}

// Note: Any functions previously deployed but not explicitly exported here will be removed from deployment.
// If you have other function files (e.g., getCompany.js), they need to be imported and their functions exported similarly.