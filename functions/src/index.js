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

// Import role management functions
const adminRoleManagementFunctions = require('./admin-role-management');
console.log('LOG-MAIN-INDEX: adminRoleManagementFunctions imported.');

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

// Import report functions
const { generateReport } = require('./generateReport');
const { 
    scheduleReport, 
    updateReportSchedule, 
    deleteReportSchedule, 
    getCompanyReportSchedules, 
    triggerScheduledReport 
} = require('./scheduleReport');

// Add test email function
const { sendTestReportNotification } = require('./sendTestReportNotification');

// Import invoice generation function
const { generateInvoicePDFAndEmail } = require('./generateInvoicePDFAndEmail');
// Import invoice recipient helper
const { getInvoiceRecipients } = require('./billing/getInvoiceRecipients');

// Import file upload functions
const fileUploadFunctions = require('./fileUpload');

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

// General cancellation function - TEMPORARILY COMMENTED OUT FOR TESTING
// const { cancelShipment } = require('./cancelShipment');
// exports.cancelShipment = cancelShipment;
// console.log('LOG-MAIN-INDEX: exports.cancelShipment defined.');

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

// Functions from admin-role-management.js
if (adminRoleManagementFunctions && adminRoleManagementFunctions.adminCreateRole) {
    exports.adminCreateRole = adminRoleManagementFunctions.adminCreateRole;
    console.log('LOG-MAIN-INDEX: exports.adminCreateRole defined.');
} else {
    console.warn('LOG-MAIN-INDEX: adminCreateRole not found in adminRoleManagementFunctions.');
}

if (adminRoleManagementFunctions && adminRoleManagementFunctions.adminUpdateRole) {
    exports.adminUpdateRole = adminRoleManagementFunctions.adminUpdateRole;
    console.log('LOG-MAIN-INDEX: exports.adminUpdateRole defined.');
} else {
    console.warn('LOG-MAIN-INDEX: adminUpdateRole not found in adminRoleManagementFunctions.');
}

if (adminRoleManagementFunctions && adminRoleManagementFunctions.adminDeleteRole) {
    exports.adminDeleteRole = adminRoleManagementFunctions.adminDeleteRole;
    console.log('LOG-MAIN-INDEX: exports.adminDeleteRole defined.');
} else {
    console.warn('LOG-MAIN-INDEX: adminDeleteRole not found in adminRoleManagementFunctions.');
}

if (adminRoleManagementFunctions && adminRoleManagementFunctions.adminUpdateRolePermissions) {
    exports.adminUpdateRolePermissions = adminRoleManagementFunctions.adminUpdateRolePermissions;
    console.log('LOG-MAIN-INDEX: exports.adminUpdateRolePermissions defined.');
} else {
    console.warn('LOG-MAIN-INDEX: adminUpdateRolePermissions not found in adminRoleManagementFunctions.');
}

if (adminRoleManagementFunctions && adminRoleManagementFunctions.adminCreatePermission) {
    exports.adminCreatePermission = adminRoleManagementFunctions.adminCreatePermission;
    console.log('LOG-MAIN-INDEX: exports.adminCreatePermission defined.');
} else {
    console.warn('LOG-MAIN-INDEX: adminCreatePermission not found in adminRoleManagementFunctions.');
}

if (adminRoleManagementFunctions && adminRoleManagementFunctions.adminBulkAssignRole) {
    exports.adminBulkAssignRole = adminRoleManagementFunctions.adminBulkAssignRole;
    console.log('LOG-MAIN-INDEX: exports.adminBulkAssignRole defined.');
} else {
    console.warn('LOG-MAIN-INDEX: adminBulkAssignRole not found in adminRoleManagementFunctions.');
}

if (adminRoleManagementFunctions && adminRoleManagementFunctions.adminGetRolePermissions) {
    exports.adminGetRolePermissions = adminRoleManagementFunctions.adminGetRolePermissions;
    console.log('LOG-MAIN-INDEX: exports.adminGetRolePermissions defined.');
} else {
    console.warn('LOG-MAIN-INDEX: adminGetRolePermissions not found in adminRoleManagementFunctions.');
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

if (notificationFunctions && notificationFunctions.setupAdminNotifications) {
    exports.setupAdminNotifications = notificationFunctions.setupAdminNotifications;
    console.log('LOG-MAIN-INDEX: exports.setupAdminNotifications defined.');
} else {
    console.warn('LOG-MAIN-INDEX: setupAdminNotifications not found in notificationFunctions.');
}

// Export report functions
exports.generateReport = generateReport;
console.log('LOG-MAIN-INDEX: exports.generateReport defined.');

exports.scheduleReport = scheduleReport;
console.log('LOG-MAIN-INDEX: exports.scheduleReport defined.');

exports.updateReportSchedule = updateReportSchedule;
console.log('LOG-MAIN-INDEX: exports.updateReportSchedule defined.');

exports.deleteReportSchedule = deleteReportSchedule;
console.log('LOG-MAIN-INDEX: exports.deleteReportSchedule defined.');

exports.getCompanyReportSchedules = getCompanyReportSchedules;
console.log('LOG-MAIN-INDEX: exports.getCompanyReportSchedules defined.');

exports.triggerScheduledReport = triggerScheduledReport;
console.log('LOG-MAIN-INDEX: exports.triggerScheduledReport defined.');

exports.sendTestReportNotification = sendTestReportNotification;
console.log('LOG-MAIN-INDEX: exports.sendTestReportNotification defined.');

// Export invoice generation function
exports.generateInvoicePDFAndEmail = generateInvoicePDFAndEmail;
console.log('LOG-MAIN-INDEX: exports.generateInvoicePDFAndEmail defined.');

// Export invoice recipients endpoint
exports.getInvoiceRecipients = getInvoiceRecipients;
console.log('LOG-MAIN-INDEX: exports.getInvoiceRecipients defined.');

// Import and export additional billing functions
const { preflightInvoiceReview } = require('./billing/preflightInvoiceReview');
const { sendTestInvoiceEmail } = require('./billing/sendTestInvoiceEmail');
const { markShipmentsReadyToInvoice } = require('./billing/markShipmentsReadyToInvoice');
const { emailBulkInvoices } = require('./billing/emailBulkInvoices');
const { generateBulkInvoices } = require('./billing/bulkInvoiceGenerator');
const { previewBulkInvoices } = require('./billing/previewBulkInvoices');
const { overrideApprovedCharges } = require('./billing/overrideApprovedCharges');

exports.preflightInvoiceReview = preflightInvoiceReview;
console.log('LOG-MAIN-INDEX: exports.preflightInvoiceReview defined.');

exports.sendTestInvoiceEmail = sendTestInvoiceEmail;
console.log('LOG-MAIN-INDEX: exports.sendTestInvoiceEmail defined.');

exports.markShipmentsReadyToInvoice = markShipmentsReadyToInvoice;
console.log('LOG-MAIN-INDEX: exports.markShipmentsReadyToInvoice defined.');

exports.emailBulkInvoices = emailBulkInvoices;
console.log('LOG-MAIN-INDEX: exports.emailBulkInvoices defined.');

exports.generateBulkInvoices = generateBulkInvoices;
console.log('LOG-MAIN-INDEX: exports.generateBulkInvoices defined.');

exports.previewBulkInvoices = previewBulkInvoices;
console.log('LOG-MAIN-INDEX: exports.previewBulkInvoices defined.');

exports.overrideApprovedCharges = overrideApprovedCharges;
console.log('LOG-MAIN-INDEX: exports.overrideApprovedCharges defined.');

// Import and export AP processing functions
const { deleteAPUpload } = require('./deleteAPUpload');

exports.deleteAPUpload = deleteAPUpload;
console.log('LOG-MAIN-INDEX: exports.deleteAPUpload defined.');

// Export file upload functions
if (fileUploadFunctions && fileUploadFunctions.uploadFile) {
    exports.uploadFile = fileUploadFunctions.uploadFile;
    console.log('LOG-MAIN-INDEX: exports.uploadFile defined.');
} else {
    console.warn('LOG-MAIN-INDEX: uploadFile not found in fileUploadFunctions.');
}

if (fileUploadFunctions && fileUploadFunctions.uploadFileBase64) {
    exports.uploadFileBase64 = fileUploadFunctions.uploadFileBase64;
    console.log('LOG-MAIN-INDEX: exports.uploadFileBase64 defined.');
} else {
    console.warn('LOG-MAIN-INDEX: uploadFileBase64 not found in fileUploadFunctions.');
}



// Import and export sales commission functions
const salesCommissionFunctions = require('./salesCommissions');
console.log('LOG-MAIN-INDEX: salesCommissionFunctions imported.');

if (salesCommissionFunctions && salesCommissionFunctions.createSalesPerson) {
    exports.createSalesPerson = salesCommissionFunctions.createSalesPerson;
    console.log('LOG-MAIN-INDEX: exports.createSalesPerson defined.');
}

if (salesCommissionFunctions && salesCommissionFunctions.updateSalesPerson) {
    exports.updateSalesPerson = salesCommissionFunctions.updateSalesPerson;
    console.log('LOG-MAIN-INDEX: exports.updateSalesPerson defined.');
}

if (salesCommissionFunctions && salesCommissionFunctions.getSalesPersons) {
    exports.getSalesPersons = salesCommissionFunctions.getSalesPersons;
    console.log('LOG-MAIN-INDEX: exports.getSalesPersons defined.');
}

if (salesCommissionFunctions && salesCommissionFunctions.deleteSalesPerson) {
    exports.deleteSalesPerson = salesCommissionFunctions.deleteSalesPerson;
    console.log('LOG-MAIN-INDEX: exports.deleteSalesPerson defined.');
}

if (salesCommissionFunctions && salesCommissionFunctions.createSalesTeam) {
    exports.createSalesTeam = salesCommissionFunctions.createSalesTeam;
    console.log('LOG-MAIN-INDEX: exports.createSalesTeam defined.');
}

if (salesCommissionFunctions && salesCommissionFunctions.updateSalesTeam) {
    exports.updateSalesTeam = salesCommissionFunctions.updateSalesTeam;
    console.log('LOG-MAIN-INDEX: exports.updateSalesTeam defined.');
}

if (salesCommissionFunctions && salesCommissionFunctions.getSalesTeams) {
    exports.getSalesTeams = salesCommissionFunctions.getSalesTeams;
    console.log('LOG-MAIN-INDEX: exports.getSalesTeams defined.');
}

if (salesCommissionFunctions && salesCommissionFunctions.deleteSalesTeam) {
    exports.deleteSalesTeam = salesCommissionFunctions.deleteSalesTeam;
    console.log('LOG-MAIN-INDEX: exports.deleteSalesTeam defined.');
}

if (salesCommissionFunctions && salesCommissionFunctions.calculateCommissions) {
    exports.calculateCommissions = salesCommissionFunctions.calculateCommissions;
    console.log('LOG-MAIN-INDEX: exports.calculateCommissions defined.');
}

if (salesCommissionFunctions && salesCommissionFunctions.generateCommissionReport) {
    exports.generateCommissionReport = salesCommissionFunctions.generateCommissionReport;
    console.log('LOG-MAIN-INDEX: exports.generateCommissionReport defined.');
}

if (salesCommissionFunctions && salesCommissionFunctions.scheduleCommissionReport) {
    exports.scheduleCommissionReport = salesCommissionFunctions.scheduleCommissionReport;
    console.log('LOG-MAIN-INDEX: exports.scheduleCommissionReport defined.');
}

if (salesCommissionFunctions && salesCommissionFunctions.getSalesPersonCommissionSummary) {
    exports.getSalesPersonCommissionSummary = salesCommissionFunctions.getSalesPersonCommissionSummary;
    console.log('LOG-MAIN-INDEX: exports.getSalesPersonCommissionSummary defined.');
}

// Import and export document management functions
const { getShipmentAuditLog } = require('./getShipmentAuditLog');
const { updateShipmentDocument } = require('./updateShipmentDocument');
const { updateShipmentField } = require('./updateShipmentField');
const { uploadShipmentDocument } = require('./uploadShipmentDocument');

exports.getShipmentAuditLog = getShipmentAuditLog;
console.log('LOG-MAIN-INDEX: exports.getShipmentAuditLog defined.');

exports.updateShipmentDocument = updateShipmentDocument;
console.log('LOG-MAIN-INDEX: exports.updateShipmentDocument defined.');

exports.updateShipmentField = updateShipmentField;
console.log('LOG-MAIN-INDEX: exports.updateShipmentField defined.');

exports.uploadShipmentDocument = uploadShipmentDocument;
console.log('LOG-MAIN-INDEX: exports.uploadShipmentDocument defined.');

// Import and export test follow-up function (COMMENTED OUT - FILE MISSING)
// const { testFollowUp } = require('./testFollowUp');
// exports.testFollowUp = testFollowUp;
// console.log('LOG-MAIN-INDEX: exports.testFollowUp defined.');

// Import and export follow-up engine functions
const followUpFunctions = require('./followUps/followUpEngine');
console.log('LOG-MAIN-INDEX: followUpFunctions imported.');

if (followUpFunctions && followUpFunctions.createFollowUpRule) {
    exports.createFollowUpRule = followUpFunctions.createFollowUpRule;
    console.log('LOG-MAIN-INDEX: exports.createFollowUpRule defined.');
}

if (followUpFunctions && followUpFunctions.updateFollowUpRule) {
    exports.updateFollowUpRule = followUpFunctions.updateFollowUpRule;
    console.log('LOG-MAIN-INDEX: exports.updateFollowUpRule defined.');
}

if (followUpFunctions && followUpFunctions.getFollowUpRules) {
    exports.getFollowUpRules = followUpFunctions.getFollowUpRules;
    console.log('LOG-MAIN-INDEX: exports.getFollowUpRules defined.');
}

if (followUpFunctions && followUpFunctions.createFollowUpTask) {
    exports.createFollowUpTask = followUpFunctions.createFollowUpTask;
    console.log('LOG-MAIN-INDEX: exports.createFollowUpTask defined.');
}

if (followUpFunctions && followUpFunctions.updateFollowUpTask) {
    exports.updateFollowUpTask = followUpFunctions.updateFollowUpTask;
    console.log('LOG-MAIN-INDEX: exports.updateFollowUpTask defined.');
}

if (followUpFunctions && followUpFunctions.getFollowUpTasks) {
    exports.getFollowUpTasks = followUpFunctions.getFollowUpTasks;
    console.log('LOG-MAIN-INDEX: exports.getFollowUpTasks defined.');
}

if (followUpFunctions && followUpFunctions.deleteFollowUpTask) {
    exports.deleteFollowUpTask = followUpFunctions.deleteFollowUpTask;
    console.log('LOG-MAIN-INDEX: exports.deleteFollowUpTask defined.');
}

if (followUpFunctions && followUpFunctions.getFollowUpTasksByShipment) {
    exports.getFollowUpTasksByShipment = followUpFunctions.getFollowUpTasksByShipment;
    console.log('LOG-MAIN-INDEX: exports.getFollowUpTasksByShipment defined.');
}

if (followUpFunctions && followUpFunctions.addTaskNote) {
    exports.addTaskNote = followUpFunctions.addTaskNote;
    console.log('LOG-MAIN-INDEX: exports.addTaskNote defined.');
}

if (followUpFunctions && followUpFunctions.scheduleTaskReminder) {
    exports.scheduleTaskReminder = followUpFunctions.scheduleTaskReminder;
    console.log('LOG-MAIN-INDEX: exports.scheduleTaskReminder defined.');
}

if (followUpFunctions && followUpFunctions.completeTask) {
    exports.completeTask = followUpFunctions.completeTask;
    console.log('LOG-MAIN-INDEX: exports.completeTask defined.');
}

if (followUpFunctions && followUpFunctions.escalateTask) {
    exports.escalateTask = followUpFunctions.escalateTask;
    console.log('LOG-MAIN-INDEX: exports.escalateTask defined.');
}

if (followUpFunctions && followUpFunctions.getShipmentFollowUpSummary) {
    exports.getShipmentFollowUpSummary = followUpFunctions.getShipmentFollowUpSummary;
    console.log('LOG-MAIN-INDEX: exports.getShipmentFollowUpSummary defined.');
}

// Expose pending notifications processor (callable). A cron-based scheduler can call this periodically.
if (followUpFunctions && followUpFunctions.processPendingNotifications) {
    exports.processPendingNotifications = followUpFunctions.processPendingNotifications;
    console.log('LOG-MAIN-INDEX: exports.processPendingNotifications defined.');
}

// Import and export unified training system functions
const {
    getUnifiedTrainingCarriers,
    addTrainingSample,
    processTrainingSample,
    getTrainingAnalytics,
    getTrainingSample,
    listTrainingSamples
} = require('./visualTraining/unifiedTrainingSystem');

// Import visual annotation processor
const { processVisualTrainingSample } = require('./visualTraining/visualAnnotationProcessor');

exports.getUnifiedTrainingCarriers = getUnifiedTrainingCarriers;
console.log('LOG-MAIN-INDEX: exports.getUnifiedTrainingCarriers defined.');

exports.addTrainingSample = addTrainingSample;
console.log('LOG-MAIN-INDEX: exports.addTrainingSample defined.');

exports.processTrainingSample = processTrainingSample;
console.log('LOG-MAIN-INDEX: exports.processTrainingSample defined.');

exports.getTrainingAnalytics = getTrainingAnalytics;
console.log('LOG-MAIN-INDEX: exports.getTrainingAnalytics defined.');

exports.getTrainingSample = getTrainingSample;
console.log('LOG-MAIN-INDEX: exports.getTrainingSample defined.');

exports.listTrainingSamples = listTrainingSamples;
console.log('LOG-MAIN-INDEX: exports.listTrainingSamples defined.');

exports.processVisualTrainingSample = processVisualTrainingSample;
console.log('LOG-MAIN-INDEX: exports.processVisualTrainingSample defined.');

// Import and export enhanced AI processing functions
const { processInvoiceUnified, learnFromCorrections } = require('./ai/unifiedProcessingOrchestrator');
const { getUnifiedTrainingCarriers: getCarrierManagementCarriers, addUnifiedTrainingCarrier, deleteUnifiedTrainingCarrier } = require('./ai/carrierManagement');

exports.processInvoiceUnified = processInvoiceUnified;
console.log('LOG-MAIN-INDEX: exports.processInvoiceUnified defined.');

exports.learnFromCorrections = learnFromCorrections;
console.log('LOG-MAIN-INDEX: exports.learnFromCorrections defined.');

exports.getCarrierManagementCarriers = getCarrierManagementCarriers;
console.log('LOG-MAIN-INDEX: exports.getCarrierManagementCarriers defined.');

exports.addUnifiedTrainingCarrier = addUnifiedTrainingCarrier;
console.log('LOG-MAIN-INDEX: exports.addUnifiedTrainingCarrier defined.');

exports.deleteUnifiedTrainingCarrier = deleteUnifiedTrainingCarrier;
console.log('LOG-MAIN-INDEX: exports.deleteUnifiedTrainingCarrier defined.');

console.log('LOG-MAIN-INDEX: All exports defined. index.js loading complete.');