const functions = require('firebase-functions/v2');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK ONCE
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        storageBucket: 'solushipx.firebasestorage.app'
    });
    console.log('Firebase Admin initialized in main index.js with correct storage bucket');
} else {
    console.log('Firebase Admin already initialized.');
}

console.log('LOG-MAIN-INDEX: Starting module imports...');

// Import function modules/files
const mappingFunctions = require("./mapping_functions");
console.log('LOG-MAIN-INDEX: mappingFunctions imported.');

const mappingTestRouter = require('./api/edi-mapping-test');
console.log('LOG-MAIN-INDEX: mappingTestRouter imported.');

const carrierApiFunctions = require('./carrier-api'); 
console.log('LOG-MAIN-INDEX: carrierApiFunctions imported.');
console.log('LOG-MAIN-INDEX: Available carrier functions:', Object.keys(carrierApiFunctions));
console.log('LOG-MAIN-INDEX: getRatesCanpar available:', !!carrierApiFunctions.getRatesCanpar);

const ediProcessingFunctions = require('./edi-processing');
console.log('LOG-MAIN-INDEX: ediProcessingFunctions imported.');

const checkEdiUploadsFunctions = require('./check-edi-uploads');
console.log('LOG-MAIN-INDEX: checkEdiUploadsFunctions imported.');

const adminUserManagementFunctions = require('./admin-user-management');
console.log('LOG-MAIN-INDEX: adminUserManagementFunctions imported.');

const adminCreateUserFunctions = require('./admin-create-user'); 
console.log('LOG-MAIN-INDEX: adminCreateUserFunctions imported.');

// Import notification functions
const notificationFunctions = require('./notifications/emailService');
console.log('LOG-MAIN-INDEX: notificationFunctions imported.');

// Import carrier API functions
const eshipPlusFunctions = require('./carrier-api/eshipplus');
const canparFunctions = require('./carrier-api/canpar');

// Import universal booking function
const { bookRateUniversal } = require('./bookRateUniversal');

// Import AI agent functions
const { createShippingOrigin } = require('./createShippingOrigin');
const { createCustomer } = require('./createCustomer');
const { createCustomerDestination } = require('./createCustomerDestination');
const { trackShipment } = require('./trackShipment');
const { getRatesUniversal } = require('./getRatesUniversal');
console.log('LOG-MAIN-INDEX: AI agent functions imported.');

// Initialize Express app
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
console.log('LOG-MAIN-INDEX: Express app initialized.');

// Mount the mapping test router
app.use('/api/edi-mapping', mappingTestRouter);
console.log('LOG-MAIN-INDEX: edi-mapping-test router mounted.');

// --- Define all exports for Firebase --- 
console.log('LOG-MAIN-INDEX: Defining exports...');

// HTTP Express App
exports.api = functions.https.onRequest(app);
console.log('LOG-MAIN-INDEX: exports.api defined.');

// Callable/Triggered functions exported individually by their exact exported name
if (mappingFunctions && mappingFunctions.generateEdiMapping) {
    exports.generateEdiMapping = mappingFunctions.generateEdiMapping;
    console.log('LOG-MAIN-INDEX: exports.generateEdiMapping defined.');
} else {
    console.warn('LOG-MAIN-INDEX: generateEdiMapping not found in mappingFunctions module.');
}

// Functions from carrier-api structure
if (carrierApiFunctions && carrierApiFunctions.getRatesEShipPlus) {
    exports.getRatesEShipPlus = carrierApiFunctions.getRatesEShipPlus;
    console.log('LOG-MAIN-INDEX: exports.getRatesEShipPlus defined.');
} else {
    console.warn('LOG-MAIN-INDEX: getRatesEShipPlus not found in carrierApiFunctions module.');
}

if (carrierApiFunctions && carrierApiFunctions.bookRateEShipPlus) {
    exports.bookRateEShipPlus = carrierApiFunctions.bookRateEShipPlus;
    console.log('LOG-MAIN-INDEX: exports.bookRateEShipPlus defined.');
} else {
    console.warn('LOG-MAIN-INDEX: bookRateEShipPlus not found in carrierApiFunctions module.');
}

if (carrierApiFunctions && carrierApiFunctions.cancelShipmentEShipPlus) {
    exports.cancelShipmentEShipPlus = carrierApiFunctions.cancelShipmentEShipPlus;
    console.log('LOG-MAIN-INDEX: exports.cancelShipmentEShipPlus defined.');
} else {
    console.warn('LOG-MAIN-INDEX: cancelShipmentEShipPlus not found in carrierApiFunctions module.');
}

if (carrierApiFunctions && carrierApiFunctions.cancelShipmentCanpar) {
    exports.cancelShipmentCanpar = carrierApiFunctions.cancelShipmentCanpar;
    console.log('LOG-MAIN-INDEX: exports.cancelShipmentCanpar defined.');
} else {
    console.warn('LOG-MAIN-INDEX: cancelShipmentCanpar not found in carrierApiFunctions module.');
}

if (carrierApiFunctions && carrierApiFunctions.getRatesCanpar) {
    exports.getRatesCanpar = carrierApiFunctions.getRatesCanpar;
    console.log('LOG-MAIN-INDEX: exports.getRatesCanpar defined.');
} else {
    console.warn('LOG-MAIN-INDEX: getRatesCanpar not found in carrierApiFunctions module.');
}

// Universal booking function
exports.bookRateUniversal = bookRateUniversal;
console.log('LOG-MAIN-INDEX: exports.bookRateUniversal defined.');

// AI Agent functions
exports.createShippingOrigin = createShippingOrigin;
console.log('LOG-MAIN-INDEX: exports.createShippingOrigin defined.');

exports.createCustomer = createCustomer;
console.log('LOG-MAIN-INDEX: exports.createCustomer defined.');

exports.createCustomerDestination = createCustomerDestination;
console.log('LOG-MAIN-INDEX: exports.createCustomerDestination defined.');

exports.trackShipment = trackShipment;
console.log('LOG-MAIN-INDEX: exports.trackShipment defined.');

exports.getRatesUniversal = getRatesUniversal;
console.log('LOG-MAIN-INDEX: exports.getRatesUniversal defined.');

// Functions from edi-processing.js
if (ediProcessingFunctions && ediProcessingFunctions.onFileUploaded) {
    exports.onFileUploaded = ediProcessingFunctions.onFileUploaded;
    console.log('LOG-MAIN-INDEX: exports.onFileUploaded defined.');
} else {
    console.warn('LOG-MAIN-INDEX: onFileUploaded not found in ediProcessingFunctions module.');
}
if (ediProcessingFunctions && ediProcessingFunctions.processEdiFile) {
    exports.processEdiFile = ediProcessingFunctions.processEdiFile;
    console.log('LOG-MAIN-INDEX: exports.processEdiFile defined.');
} else {
    console.warn('LOG-MAIN-INDEX: processEdiFile not found in ediProcessingFunctions module.');
}
if (ediProcessingFunctions && ediProcessingFunctions.processEdiHttp) {
    exports.processEdiHttp = ediProcessingFunctions.processEdiHttp;
    console.log('LOG-MAIN-INDEX: exports.processEdiHttp defined.');
} else {
    console.warn('LOG-MAIN-INDEX: processEdiHttp not found in ediProcessingFunctions module.');
}
if (ediProcessingFunctions && ediProcessingFunctions.processEdiManual) {
    exports.processEdiManual = ediProcessingFunctions.processEdiManual;
    console.log('LOG-MAIN-INDEX: exports.processEdiManual defined.');
} else {
    console.warn('LOG-MAIN-INDEX: processEdiManual not found in ediProcessingFunctions module.');
}

// Functions from check-edi-uploads.js
if (checkEdiUploadsFunctions && checkEdiUploadsFunctions.checkEdiUploads) {
    exports.checkEdiUploads = checkEdiUploadsFunctions.checkEdiUploads;
    console.log('LOG-MAIN-INDEX: exports.checkEdiUploads defined.');
} else {
    console.warn('LOG-MAIN-INDEX: checkEdiUploads not found in checkEdiUploadsFunctions module.');
}

// Functions from admin-user-management.js
if (adminUserManagementFunctions && adminUserManagementFunctions.checkUserCompanyOwnership) {
    exports.checkUserCompanyOwnership = adminUserManagementFunctions.checkUserCompanyOwnership;
    console.log('LOG-MAIN-INDEX: exports.checkUserCompanyOwnership defined.');
} else {
    console.warn('LOG-MAIN-INDEX: checkUserCompanyOwnership not found in adminUserManagementFunctions.');
}
if (adminUserManagementFunctions && adminUserManagementFunctions.adminDeleteUser) {
    exports.adminDeleteUser = adminUserManagementFunctions.adminDeleteUser;
    console.log('LOG-MAIN-INDEX: exports.adminDeleteUser defined.');
} else {
    console.warn('LOG-MAIN-INDEX: adminDeleteUser not found in adminUserManagementFunctions.');
}
if (adminUserManagementFunctions && adminUserManagementFunctions.adminResetUserPassword) {
    exports.adminResetUserPassword = adminUserManagementFunctions.adminResetUserPassword;
    console.log('LOG-MAIN-INDEX: exports.adminResetUserPassword defined.');
} else {
    console.warn('LOG-MAIN-INDEX: adminResetUserPassword not found in adminUserManagementFunctions.');
}
if (adminUserManagementFunctions && adminUserManagementFunctions.adminGetUsersAuthData) {
    exports.adminGetUsersAuthData = adminUserManagementFunctions.adminGetUsersAuthData;
    console.log('LOG-MAIN-INDEX: exports.adminGetUsersAuthData defined.');
} else {
    console.warn('LOG-MAIN-INDEX: adminGetUsersAuthData not found in adminUserManagementFunctions.');
}

// Functions from admin-create-user.js
if (adminCreateUserFunctions && adminCreateUserFunctions.adminCreateUser) {
    exports.adminCreateUser = adminCreateUserFunctions.adminCreateUser;
    console.log('LOG-MAIN-INDEX: exports.adminCreateUser defined.');
} else {
    console.warn('LOG-MAIN-INDEX: adminCreateUser not found in adminCreateUserFunctions.');
}

// Functions from notifications/emailService.js
if (notificationFunctions && notificationFunctions.sendCustomerNoteNotification) {
    exports.sendCustomerNoteNotification = notificationFunctions.sendCustomerNoteNotification;
    console.log('LOG-MAIN-INDEX: exports.sendCustomerNoteNotification defined.');
} else {
    console.warn('LOG-MAIN-INDEX: sendCustomerNoteNotification not found in notificationFunctions.');
}

if (notificationFunctions && notificationFunctions.updateNotificationPreferences) {
    exports.updateNotificationPreferences = notificationFunctions.updateNotificationPreferences;
    console.log('LOG-MAIN-INDEX: exports.updateNotificationPreferences defined.');
} else {
    console.warn('LOG-MAIN-INDEX: updateNotificationPreferences not found in notificationFunctions.');
}

if (notificationFunctions && notificationFunctions.getNotificationPreferences) {
    exports.getNotificationPreferences = notificationFunctions.getNotificationPreferences;
    console.log('LOG-MAIN-INDEX: exports.getNotificationPreferences defined.');
} else {
    console.warn('LOG-MAIN-INDEX: getNotificationPreferences not found in notificationFunctions.');
}

console.log('LOG-MAIN-INDEX: All exports defined. index.js loading complete.');