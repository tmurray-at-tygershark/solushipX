const functions = require('firebase-functions/v2');
const axios = require('axios');
const { parseStringPromise } = require("xml2js");
require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
const { onCall, onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });

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

// Temporary function to update user role
const tempUpdateUserRole = onRequest({ cors: true }, async (req, res) => {
    try {
        const db = admin.firestore();
        // User ID from the logs
        const userId = 'TzLyhOoYJfR6ev0OCZXdFdsE9Xj2';
        
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('Current user data:', {
                email: userData.email,
                role: userData.role,
                connectedCompanies: userData.connectedCompanies
            });
            
            // Update role to admin
            await userRef.update({
                role: 'admin',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            res.json({ 
                success: true, 
                message: 'User role updated to admin successfully',
                email: userData.email,
                oldRole: userData.role,
                newRole: 'admin'
            });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const db = admin.firestore();

// Import function handlers
const { getRatesEShipPlus } = require('./src/carrier-api/eshipplus/getRates');
const { cancelShipmentEShipPlus } = require('./src/carrier-api/eshipplus/cancelShipment');
// const { generateEShipPlusBOL } = require('./src/carrier-api/eshipplus/generateBOL'); // Removed - using Generic BOL instead
const { getRatesCanpar } = require('./src/carrier-api/canpar/getRates');
const { cancelShipmentCanpar } = require('./src/carrier-api/canpar/cancelShipment');
const { getHistoryCanpar } = require("./src/carrier-api/canpar/getHistory");
const { generateCanparLabel } = require('./src/carrier-api/canpar/generateLabel');
const { getRatesPolarisTransportation } = require('./src/carrier-api/polaristransportation/getRates');
const { bookPolarisTransportationShipment } = require('./src/carrier-api/polaristransportation/bookRate');
const { getStatusPolarisTransportation } = require('./src/carrier-api/polaristransportation/getStatus');
const { getHistoryPolarisTransportation } = require('./src/carrier-api/polaristransportation/getHistory');
const { generatePolarisTransportationBOL } = require('./src/carrier-api/polaristransportation/generateBOL');
const { bookRateUniversal } = require('./src/bookRateUniversal');
const ediProcessing = require('./src/edi-processing');
const { checkEdiUploads } = require('./src/check-edi-uploads');
const { generateEdiMapping } = require('./src/mapping_functions');
const { adminCreateUser } = require('./src/admin-create-user');
const { adminResetUserPassword, checkUserCompanyOwnership, adminDeleteUser, adminGetUsersAuthData, adminListAllUsers, adminInviteUser, adminResendInvite, verifyInviteAndSetPassword } = require('./src/admin-user-management');
const { adminDeleteCustomer } = require('./src/admin-customer-management');
const { createRole, updateRole, deleteRole, getRoles, assignUserRole } = require('./src/admin-role-management');
const { getSystemSettings, updateSystemSettings } = require('./src/admin-system-settings');
const { getShipmentDocuments, getDocumentDownloadUrl } = require('./src/getShipmentDocuments');
const { checkShipmentStatus } = require('./src/checkShipmentStatus');
const eshipPlusApi = require('./src/carrier-api/eshipplus');

// Import new smart status update and polling functions
const { pollActiveShipments } = require('./src/shipment-polling/pollActiveShipments');
const { backgroundStatusPoll } = require('./src/shipment-polling/backgroundStatusPoll');
const { smartStatusUpdate, forceStatusRefresh, performSmartStatusUpdate } = require('./src/shipment-polling/smartStatusUpdate');

// Import email notification functions
const { 
  onShipmentCreated, 
  onShipmentStatusChanged, 
  sendTestNotification,
  sendCustomerNoteNotification,
  updateNotificationPreferences,
  getNotificationPreferences,
  migrateToCollectionSystem
} = require('./src/notifications/emailService');

// Import AI agent functions
const { createShippingOrigin } = require('./src/createShippingOrigin');
const { createCustomer } = require('./src/createCustomer');
const { createCustomerDestination } = require('./src/createCustomerDestination');
const { trackShipment } = require('./src/trackShipment');
const { getRatesUniversal } = require('./src/getRatesUniversal');

// Import report functions
const { generateReport } = require('./src/generateReport');
const { 
    scheduleReport, 
    updateReportSchedule, 
    deleteReportSchedule, 
    getCompanyReportSchedules, 
    triggerScheduledReport 
} = require('./src/scheduleReport');
const { sendTestReportNotification } = require('./src/sendTestReportNotification');

// Import keep-alive functions for preventing cold starts
const {
    keepAliveEShipPlus,
    keepAliveCanpar,
    keepAlivePolaris,
    keepAliveQuickShip,
    keepAliveAllCarriers,
    warmupCarriersNow,
    carrierHealthCheck
} = require('./src/keepAlive');

// Import QuickShip functions
const { bookQuickShipment } = require('./src/carrier-api/generic/bookQuickShipment');
const { generateGenericBOL } = require('./src/carrier-api/generic/generateGenericBOL');
const { generateCarrierConfirmation } = require('./src/carrier-api/generic/generateCarrierConfirmation');

// Import CreateShipmentX notification functions
const sendCreateShipmentXNotificationsModule = require('./src/functions/generic/sendCreateShipmentXNotifications');

// Import manual status override function
const { updateManualShipmentStatus } = require('./src/updateManualShipmentStatus');

// Import enhanced manual status override function
const { updateManualShipmentStatusEnhanced } = require('./src/updateManualShipmentStatusEnhanced');

// Import sales commission functions
const {
    createSalesPerson,
    updateSalesPerson,
    getSalesPersons,
    deleteSalesPerson,
    createSalesTeam,
    updateSalesTeam,
    getSalesTeams,
    deleteSalesTeam,
    calculateCommissions,
    generateCommissionReport,
    scheduleCommissionReport,
    getSalesPersonCommissionSummary,
    markCommissionsAsPaid
} = require('./src/salesCommissions');

// Import invoice generation function
const { onInvoiceCreated, generateInvoicePDFAndEmail } = require('./src/generateInvoicePDFAndEmail');

// Import currency sync functions
const { syncCurrencyRates, scheduledCurrencySync } = require('./src/syncCurrencyRates');

// Import PDF parsing functions
const { processPdfFile, getPdfResults, retryPdfProcessing, exportPdfResults, processPdfBatch } = require('./src/pdfParsing');
const { processBulkPdfFile } = require('./src/bulkProcessingEngine');

// Import file upload functions
const { uploadFile, uploadFileBase64, uploadAPFile } = require('./src/fileUpload');

// Import address book update function
const { updateAddressBookOwnerCompanyID } = require('./src/updateAddressBookOwnerCompanyID');

// Document regeneration functions
const { regenerateBOL, regenerateCarrierConfirmation, regenerateAllDocuments } = require('./src/carrier-api/generic/regenerateDocuments');

// Shipment management functions
const { updateShipment } = require('./src/shipment-management/updateShipment');
const updateShipmentCharges = require('./src/shipment-management/updateShipmentCharges');

// Import general cancellation function
const { cancelShipment } = require('./src/cancelShipment');

// Import document upload functions
const { uploadShipmentDocument, deleteShipmentDocument, getShipmentDocuments: getShipmentDocsNew } = require('./src/uploadShipmentDocument');

// Import missing document management functions
const { getShipmentAuditLog } = require('./src/getShipmentAuditLog');
const { updateShipmentDocument } = require('./src/updateShipmentDocument');
const { updateShipmentField } = require('./src/updateShipmentField');

// Import archive shipment function
const { archiveShipment } = require('./src/archiveShipment');

// Import shipment status management functions
const {
createMasterStatus,
updateMasterStatus,
deleteMasterStatus,
getMasterStatuses,
createShipmentStatus,
updateShipmentStatus,
deleteShipmentStatus,
getShipmentStatuses
} = require('./src/admin-shipment-statuses');

// Import invoice status management functions
const {
createInvoiceStatus,
updateInvoiceStatus,
deleteInvoiceStatus,
getInvoiceStatuses,
getAllInvoiceStatuses
} = require('./src/admin-invoice-statuses');

// Import follow-up functions
const {
    createFollowUpRule,
    updateFollowUpRule,
    getFollowUpRules,
    createFollowUpTask,
    updateFollowUpTask,
    getFollowUpTasks,
    deleteFollowUpTask,
    getFollowUpTasksByShipment,
    addTaskNote,
    completeTask,
    escalateTask,
    getShipmentFollowUpSummary
} = require('./src/followUps/followUpEngine');

// Import follow-up task management functions
const {
    getFollowUpTasks: getFollowUpTaskTemplates,
    createFollowUpTask: createFollowUpTaskTemplate,
    updateFollowUpTask: updateFollowUpTaskTemplate,
    deleteFollowUpTask: deleteFollowUpTaskTemplate,
    getEnabledFollowUpTasks
} = require('./src/followup-tasks-management');

const { directGeminiExtraction } = require('./src/ai/directGeminiExtraction');

// Export Callable functions
exports.getRatesEShipPlus = getRatesEShipPlus;
exports.cancelShipmentEShipPlus = cancelShipmentEShipPlus;
// exports.generateEShipPlusBOL = generateEShipPlusBOL; // Removed - using Generic BOL instead
exports.getRatesCanpar = getRatesCanpar;
exports.cancelShipmentCanpar = cancelShipmentCanpar;
exports.generateCanparLabel = generateCanparLabel;
exports.getHistoryCanpar = getHistoryCanpar;
exports.getRatesPolarisTransportation = getRatesPolarisTransportation;
exports.bookPolarisTransportationShipment = bookPolarisTransportationShipment;
exports.getStatusPolarisTransportation = getStatusPolarisTransportation;
exports.getHistoryPolarisTransportation = getHistoryPolarisTransportation;
exports.generatePolarisTransportationBOL = generatePolarisTransportationBOL;
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
exports.adminDeleteCustomer = adminDeleteCustomer;
exports.adminGetUsersAuthData = adminGetUsersAuthData;
exports.adminListAllUsers = adminListAllUsers;
exports.adminInviteUser = adminInviteUser;
exports.adminResendInvite = adminResendInvite;
exports.verifyInviteAndSetPassword = verifyInviteAndSetPassword;
exports.createRole = createRole;
exports.updateRole = updateRole;
exports.deleteRole = deleteRole;
exports.getRoles = getRoles;
exports.assignUserRole = assignUserRole;
exports.getSystemSettings = getSystemSettings;
exports.updateSystemSettings = updateSystemSettings;
exports.getShipmentDocuments = getShipmentDocuments;
exports.getDocumentDownloadUrl = getDocumentDownloadUrl;
exports.checkShipmentStatus = checkShipmentStatus;

// Export new smart status update and polling functions
exports.pollActiveShipments = pollActiveShipments;
exports.backgroundStatusPoll = backgroundStatusPoll;
exports.smartStatusUpdate = smartStatusUpdate;
exports.forceStatusRefresh = forceStatusRefresh;
exports.performSmartStatusUpdate = performSmartStatusUpdate;

// Export email notification functions
exports.onShipmentCreated = onShipmentCreated;
exports.onShipmentStatusChanged = onShipmentStatusChanged;
exports.sendTestNotification = sendTestNotification;
exports.sendCustomerNoteNotification = sendCustomerNoteNotification;
exports.updateNotificationPreferences = updateNotificationPreferences;
exports.getNotificationPreferences = getNotificationPreferences;
exports.migrateToCollectionSystem = migrateToCollectionSystem;

// Export AI agent functions
exports.createShippingOrigin = createShippingOrigin;
exports.createCustomer = createCustomer;
exports.createCustomerDestination = createCustomerDestination;
exports.trackShipment = trackShipment;
exports.getRatesUniversal = getRatesUniversal;

// Export report functions
exports.generateReport = generateReport;
exports.scheduleReport = scheduleReport;
exports.updateReportSchedule = updateReportSchedule;
exports.deleteReportSchedule = deleteReportSchedule;
exports.getCompanyReportSchedules = getCompanyReportSchedules;
exports.triggerScheduledReport = triggerScheduledReport;
exports.sendTestReportNotification = sendTestReportNotification;

// Export keep-alive functions for preventing cold starts
exports.keepAliveEShipPlus = keepAliveEShipPlus;
exports.keepAliveCanpar = keepAliveCanpar;
exports.keepAlivePolaris = keepAlivePolaris;
exports.keepAliveQuickShip = keepAliveQuickShip;
exports.keepAliveAllCarriers = keepAliveAllCarriers;
exports.warmupCarriersNow = warmupCarriersNow;
exports.carrierHealthCheck = carrierHealthCheck;

// Export QuickShip functions
exports.bookQuickShipment = bookQuickShipment;
exports.generateGenericBOL = generateGenericBOL;
exports.generateCarrierConfirmation = generateCarrierConfirmation;

// Export CreateShipmentX notification functions
exports.sendCreateShipmentXNotifications = sendCreateShipmentXNotificationsModule.sendCreateShipmentXNotifications;

// Export manual status override function
exports.updateManualShipmentStatus = updateManualShipmentStatus;

// Export updateShipmentInvoiceStatus function for AP processing automation
const { updateShipmentInvoiceStatus } = require('./src/updateShipmentInvoiceStatus.js');
exports.updateShipmentInvoiceStatus = updateShipmentInvoiceStatus;

// Export intelligent auto-processing function for post-extraction automation
const { processIntelligentAutoApproval, onAPUploadCompleted } = require('./src/intelligentAutoProcessing.js');
exports.processIntelligentAutoApproval = processIntelligentAutoApproval;
exports.onAPUploadCompleted = onAPUploadCompleted;

// Export test functions for diagnostics
const { testEnhancedStatusEmails } = require('./src/testEnhancedStatusEmails');
exports.testEnhancedStatusEmails = testEnhancedStatusEmails;

const { quickDiagnosticEmailTest } = require('./src/quickDiagnosticEmailTest');
exports.quickDiagnosticEmailTest = quickDiagnosticEmailTest;

// Export sales commission functions
exports.createSalesPerson = createSalesPerson;
exports.updateSalesPerson = updateSalesPerson;
exports.getSalesPersons = getSalesPersons;
exports.deleteSalesPerson = deleteSalesPerson;
exports.createSalesTeam = createSalesTeam;
exports.updateSalesTeam = updateSalesTeam;
exports.getSalesTeams = getSalesTeams;
exports.deleteSalesTeam = deleteSalesTeam;
exports.calculateCommissions = calculateCommissions;
exports.generateCommissionReport = generateCommissionReport;
exports.scheduleCommissionReport = scheduleCommissionReport;
exports.getSalesPersonCommissionSummary = getSalesPersonCommissionSummary;
exports.markCommissionsAsPaid = markCommissionsAsPaid;

// Export currency sync functions
exports.syncCurrencyRates = syncCurrencyRates;
exports.scheduledCurrencySync = scheduledCurrencySync;

// Export PDF parsing functions
exports.processPdfFile = processPdfFile;
exports.getPdfResults = getPdfResults;
exports.retryPdfProcessing = retryPdfProcessing;
exports.exportPdfResults = exportPdfResults;
exports.processPdfBatch = processPdfBatch;
exports.processBulkPdfFile = processBulkPdfFile;

// Export Visual Training functions
const { analyzeInvoiceWithVision } = require('./src/visualTraining/analyzeInvoiceWithVision');
const { updateTrainingFromCorrections } = require('./src/visualTraining/updateTrainingFromCorrections');
const { 
    createTrainingCarrier,
    getTrainingCarriers,
    updateTrainingCarrier,
    deleteTrainingCarrier,
    getCarrierDetails,
    retrainCarrier,
    getCarrierCategories
} = require('./src/visualTraining/carrierManagement');
const { 
    getUnifiedTrainingCarriers: getCarrierManagementCarriers, 
    addUnifiedTrainingCarrier, 
    deleteUnifiedTrainingCarrier 
} = require('./src/ai/carrierManagement');
const {
    getUnifiedTrainingCarriers,
    addTrainingSample,
    processTrainingSample,
    getTrainingAnalytics
} = require('./src/visualTraining/unifiedTrainingSystem');
// Visual annotation callable (used by VisualAnnotationTrainer)
const { processVisualTrainingSample } = require('./src/visualTraining/visualAnnotationProcessor');
// Invoice testing engine for model validation
const { 
    testCarrierModel, 
    getCarrierTestingHistory, 
    getTestResults 
} = require('./src/visualTraining/invoiceTestingEngine');
// AI-powered prompt generation
const { generateCarrierPrompt, updateCarrierPrompt } = require('./src/visualTraining/promptGenerator');

const { deleteAPUpload } = require('./src/deleteAPUpload');
const { testPromptGenerator } = require('./src/debug/testPromptGenerator');

exports.analyzeInvoiceWithVision = analyzeInvoiceWithVision;
exports.updateTrainingFromCorrections = updateTrainingFromCorrections;
exports.createTrainingCarrier = createTrainingCarrier;
exports.getTrainingCarriers = getTrainingCarriers;
exports.updateTrainingCarrier = updateTrainingCarrier;
exports.deleteTrainingCarrier = deleteTrainingCarrier;
exports.getCarrierDetails = getCarrierDetails;
exports.retrainCarrier = retrainCarrier;
exports.getCarrierCategories = getCarrierCategories;
exports.addUnifiedTrainingCarrier = addUnifiedTrainingCarrier;
exports.deleteUnifiedTrainingCarrier = deleteUnifiedTrainingCarrier;
exports.getUnifiedTrainingCarriers = getUnifiedTrainingCarriers;
exports.addTrainingSample = addTrainingSample;
exports.processTrainingSample = processTrainingSample;
exports.getTrainingAnalytics = getTrainingAnalytics;
exports.processVisualTrainingSample = processVisualTrainingSample;
exports.testCarrierModel = testCarrierModel;
exports.getCarrierTestingHistory = getCarrierTestingHistory;
exports.getTestResults = getTestResults;
exports.generateCarrierPrompt = generateCarrierPrompt;
exports.updateCarrierPrompt = updateCarrierPrompt;
exports.deleteAPUpload = deleteAPUpload;
exports.testPromptGenerator = testPromptGenerator;

// AP Processing functions
const { matchInvoiceToShipment } = require('./src/matchInvoiceToShipment');
const { createShipmentCharge } = require('./src/createShipmentCharge');
const { updateActualCosts } = require('./src/billing/updateActualCosts');
const { detectExceptions } = require('./src/billing/detectExceptions');
const { approveCharges, rejectCharges } = require('./src/billing/approveCharges');
const { processAPApproval } = require('./src/billing/processAPApproval');
const { finalApproveAPCharges } = require('./src/billing/finalApproveAPCharges');
const { overrideApprovedCharges } = require('./src/billing/overrideApprovedCharges');
const { regenerateInvoice } = require('./src/billing/regenerateInvoice');
const { updateInvoiceStatus: updateBillingInvoiceStatus } = require('./src/billing/updateInvoiceStatus');
const { approveChargesWithFinalValues } = require('./src/billing/approveChargesWithFinalValues');
const { testInvoiceGeneration } = require('./src/billing/testInvoiceGeneration');
const { generateBulkInvoices } = require('./src/billing/bulkInvoiceGenerator');
const { previewBulkInvoices } = require('./src/billing/previewBulkInvoices');
const { emailBulkInvoices } = require('./src/billing/emailBulkInvoices');
const { sendTestInvoiceEmail } = require('./src/billing/sendTestInvoiceEmail');
const { getInvoiceRecipients } = require('./src/billing/getInvoiceRecipients');
const { preflightInvoiceReview } = require('./src/billing/preflightInvoiceReview');
const { markShipmentsReadyToInvoice } = require('./src/billing/markShipmentsReadyToInvoice');
// AP matching helpers
const { searchShipmentsForMatching } = require('./src/ap/searchShipmentsForMatching');
const { processApUpload, processApReconcile } = require('./src/ap/apOrchestrator');
const { migrateCarrierTemplates } = require('./src/ap/migrateCarrierTemplates');
const trainingApi = require('./src/ap/trainingApi');
const { 
    getChargeTypes, 
    createChargeType, 
    updateChargeType, 
    deleteChargeType, 
    getChargeTypeStats 
} = require('./src/admin-charge-types');
exports.matchInvoiceToShipment = matchInvoiceToShipment;
exports.createShipmentCharge = createShipmentCharge;
exports.updateActualCosts = updateActualCosts;
exports.detectExceptions = detectExceptions;
exports.approveCharges = approveCharges;
exports.rejectCharges = rejectCharges;
exports.processAPApproval = processAPApproval;
exports.finalApproveAPCharges = finalApproveAPCharges;
exports.overrideApprovedCharges = overrideApprovedCharges;
exports.regenerateInvoice = regenerateInvoice;
exports.updateBillingInvoiceStatus = updateBillingInvoiceStatus;
exports.approveChargesWithFinalValues = approveChargesWithFinalValues;
exports.testInvoiceGeneration = testInvoiceGeneration;
exports.generateBulkInvoices = generateBulkInvoices;
exports.previewBulkInvoices = previewBulkInvoices;
exports.emailBulkInvoices = emailBulkInvoices;
exports.sendTestInvoiceEmail = sendTestInvoiceEmail;
exports.getInvoiceRecipients = getInvoiceRecipients;
exports.preflightInvoiceReview = preflightInvoiceReview;
exports.markShipmentsReadyToInvoice = markShipmentsReadyToInvoice;
exports.searchShipmentsForMatching = searchShipmentsForMatching;
exports.processApUpload = processApUpload;
exports.processApReconcile = processApReconcile;
exports.migrateCarrierTemplates = migrateCarrierTemplates;
exports.uploadTrainingSamples = trainingApi.uploadTrainingSamples;
exports.extractTrainingFeatures = trainingApi.extractTrainingFeatures;
exports.upsertCarrierTemplate = trainingApi.upsertCarrierTemplate;
exports.getBestTemplateForPdf = trainingApi.getBestTemplateForPdf;
exports.recordExtractionFeedback = trainingApi.recordExtractionFeedback;
exports.listTrainingSamples = trainingApi.listTrainingSamples;
exports.listCarrierTemplates = trainingApi.listCarrierTemplates;
exports.listTrainedCarriers = trainingApi.listTrainedCarriers;
exports.getTrainingSummary = trainingApi.getTrainingSummary;
exports.updateCarrierTemplateMetadata = trainingApi.updateCarrierTemplateMetadata;

// Charge Type Management Functions
exports.getChargeTypes = getChargeTypes;
exports.createChargeType = createChargeType;
exports.updateChargeType = updateChargeType;
exports.deleteChargeType = deleteChargeType;
exports.getChargeTypeStats = getChargeTypeStats;

// Export duplicate invoice search function
const { adminFindDuplicateInvoices } = require('./src/admin-find-duplicate-invoices');
exports.adminFindDuplicateInvoices = adminFindDuplicateInvoices;

// Export daily currency rate fetching functions
const { fetchDailyCurrencyRates, fetchCurrencyRatesManual } = require('./src/fetchDailyCurrencyRates');
exports.fetchDailyCurrencyRates = fetchDailyCurrencyRates;
exports.fetchCurrencyRatesManual = fetchCurrencyRatesManual;

// Export file upload functions
exports.uploadFile = uploadFile;
exports.uploadFileBase64 = uploadFileBase64;
exports.uploadAPFile = uploadAPFile;

// Export address book update function
exports.updateAddressBookOwnerCompanyID = updateAddressBookOwnerCompanyID;

// Export invoice generation functions
exports.onInvoiceCreated = onInvoiceCreated;
exports.generateInvoicePDFAndEmail = generateInvoicePDFAndEmail;

// Document regeneration functions
exports.regenerateBOL = regenerateBOL;
exports.tempUpdateUserRole = tempUpdateUserRole;
exports.regenerateCarrierConfirmation = regenerateCarrierConfirmation;
exports.regenerateAllDocuments = regenerateAllDocuments;

// Export shipment management functions
exports.updateShipment = updateShipment;
exports.updateShipmentCharges = updateShipmentCharges;

// Export general cancellation function
exports.cancelShipment = cancelShipment;

// Export document upload functions
exports.uploadShipmentDocument = uploadShipmentDocument;
exports.deleteShipmentDocument = deleteShipmentDocument;
exports.getShipmentDocumentsNew = getShipmentDocsNew;

// Export missing document management functions
exports.getShipmentAuditLog = getShipmentAuditLog;
exports.updateShipmentDocument = updateShipmentDocument;
exports.updateShipmentField = updateShipmentField;

// Export archive shipment function
exports.archiveShipment = archiveShipment;

// Export shipment status management functions
exports.createMasterStatus = createMasterStatus;
exports.updateMasterStatus = updateMasterStatus;
exports.deleteMasterStatus = deleteMasterStatus;
exports.getMasterStatuses = getMasterStatuses;
exports.createShipmentStatus = createShipmentStatus;
exports.updateShipmentStatus = updateShipmentStatus;
exports.deleteShipmentStatus = deleteShipmentStatus;
exports.getShipmentStatuses = getShipmentStatuses;

// Export invoice status management functions
exports.createInvoiceStatus = createInvoiceStatus;
exports.updateInvoiceStatus = updateInvoiceStatus;
exports.deleteInvoiceStatus = deleteInvoiceStatus;
exports.getInvoiceStatuses = getInvoiceStatuses;
exports.getAllInvoiceStatuses = getAllInvoiceStatuses;

// Export follow-up functions
exports.createFollowUpRule = createFollowUpRule;
exports.updateFollowUpRule = updateFollowUpRule;
exports.getFollowUpRules = getFollowUpRules;
exports.createFollowUpTask = createFollowUpTask;
exports.updateFollowUpTask = updateFollowUpTask;
exports.getFollowUpTasks = getFollowUpTasks;
exports.deleteFollowUpTask = deleteFollowUpTask;
exports.getFollowUpTasksByShipment = getFollowUpTasksByShipment;
exports.addTaskNote = addTaskNote;
exports.completeTask = completeTask;
exports.escalateTask = escalateTask;
exports.getShipmentFollowUpSummary = getShipmentFollowUpSummary;

// Export follow-up task template management functions
exports.getFollowUpTaskTemplates = getFollowUpTaskTemplates;
exports.createFollowUpTaskTemplate = createFollowUpTaskTemplate;
exports.updateFollowUpTaskTemplate = updateFollowUpTaskTemplate;
exports.deleteFollowUpTaskTemplate = deleteFollowUpTaskTemplate;
exports.getEnabledFollowUpTasks = getEnabledFollowUpTasks;

// AI Analysis function for rates
exports.analyzeRatesWithAI = onRequest(
  {
    timeoutSeconds: 300,
    memory: "512MiB",
    cors: true,
    region: 'us-central1'
  },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        const { rates } = req.body;

        if (!rates || !Array.isArray(rates) || rates.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No rates provided for analysis'
          });
        }

        // Set up streaming response
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Prepare rate data for analysis
        const rateAnalysisData = rates.map(rate => ({
          carrier: rate.carrier?.name || rate.carrier || 'Unknown',
          service: rate.service?.name || rate.service || 'Standard',
          price: rate.pricing?.total || rate.totalCharges || rate.price || 0,
          currency: rate.pricing?.currency || rate.currency || 'USD',
          transitDays: rate.transit?.days || rate.transitDays || 0,
          guaranteed: rate.transit?.guaranteed || rate.guaranteed || false,
          estimatedDelivery: rate.transit?.estimatedDelivery || rate.estimatedDeliveryDate || null
        }));

        // Create analysis prompt
        const prompt = `
You are a shipping and logistics expert AI assistant. Analyze the following shipping rates and provide insights to help the user make an informed decision.

Rate Data:
${JSON.stringify(rateAnalysisData, null, 2)}

Please provide a comprehensive analysis including:

## 📊 Rate Overview
- Total number of rates available
- Price range (lowest to highest)
- Average transit time

## 💰 Best Value Analysis
- Most cost-effective option
- Best balance of price and speed
- Premium options and their benefits

## ⚡ Speed Analysis
- Fastest delivery option
- Standard delivery timeframes
- Guaranteed vs non-guaranteed services

## 🎯 Recommendations
Based on different priorities:
- **Budget-conscious**: Recommend the most economical option
- **Time-sensitive**: Recommend the fastest option
- **Balanced**: Recommend the best value for money

## ⚠️ Important Considerations
- Any significant price differences and why they might exist
- Transit time variations between carriers
- Service level differences

Keep your analysis concise, practical, and focused on helping the user choose the right shipping option for their needs. Use clear formatting with bullet points and sections.
`;

        try {
          // Generate streaming response using GenKit
          const response = await ai.generate({
            prompt: prompt,
            config: {
              temperature: 0.3,
              maxOutputTokens: 2048,
            }
          });

          // Stream the response
          if (response.text) {
            // Send the complete response
            res.write(`data: ${JSON.stringify({ chunk: response.text, success: true })}\n\n`);
            res.write(`data: ${JSON.stringify({ done: true, success: true })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ success: false, message: 'No response generated' })}\n\n`);
          }
        } catch (aiError) {
          console.error('AI Generation Error:', aiError);
          res.write(`data: ${JSON.stringify({ 
            success: false, 
            message: 'AI analysis failed: ' + aiError.message 
          })}\n\n`);
        }

        res.end();

      } catch (error) {
        console.error('AI Analysis Error:', error);
        
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Failed to analyze rates: ' + error.message
          });
        } else {
          res.write(`data: ${JSON.stringify({ 
            success: false, 
            message: 'Analysis failed: ' + error.message 
          })}\n\n`);
          res.end();
        }
      }
    });
  }
);

// Helper function to map HTTP status codes to Firebase HttpsError codes
// See: https://firebase.google.com/docs/reference/functions/providers_https_.httpserrorcode
const mapHttpStatusToFirebaseErrorCode = (httpStatus) => {
  switch (httpStatus) {
    case 200: return 'ok';
    case 400: return 'invalid-argument';
    case 401: return 'unauthenticated';
    case 403: return 'permission-denied';
    case 404: return 'not-found';
    case 409: return 'already-exists'; // Or 'aborted' depending on context
    case 429: return 'resource-exhausted';
    case 499: return 'cancelled';
    case 500: return 'internal';
    case 501: return 'unimplemented';
    case 503: return 'unavailable';
    case 504: return 'deadline-exceeded';
    default:
      if (httpStatus >= 200 && httpStatus < 300) return 'ok';
      if (httpStatus >= 400 && httpStatus < 500) return 'failed-precondition'; // Generic client error
      if (httpStatus >= 500 && httpStatus < 600) return 'internal'; // Generic server error
      return 'unknown';
  }
};

/**
 * Cloud Function to fetch and return shipment history for an eShipPlus shipment.
 * Expects { shipmentNumber: "..." } in the request body or query parameters.
 */
exports.getHistoryEShipPlus = onRequest(
    { 
      timeoutSeconds: 120,
      memory: "256MiB", 
      cors: true, 
      region: 'us-central1' 
    },
    async (req, res) => {
  cors(req, res, async () => {
    try {
      const shipmentNumber = req.body?.data?.shipmentNumber || req.body?.shipmentNumber || req.query?.shipmentNumber;

      if (!shipmentNumber) {
        functions.logger.warn("getHistoryEShipPlus: Missing shipmentNumber in request.", { body: req.body, query: req.query });
        return res.status(400).send({ success: false, error: "ShipmentNumber is required." });
      }

      functions.logger.info(`getHistoryEShipPlus called for eShipPlus shipmentNumber: ${shipmentNumber}`);
      const historyUpdates = await eshipPlusApi.fetchAndTransformEShipPlusHistory(shipmentNumber);
      
      functions.logger.info(`Successfully fetched ${historyUpdates.length} history updates for eShipPlus ${shipmentNumber}.`);
      // Wrap the successful response in a 'data' object
      return res.status(200).send({ data: { success: true, trackingUpdates: historyUpdates } });

    } catch (error) {
      functions.logger.error("Error in getHistoryEShipPlus Cloud Function:", {
          message: error.message,
          stack: error.stack,
          code: error.code,
          httpErrorCode: error.httpErrorCode,
          details: error.details
      });
      
      let statusCode = 500;
      let clientErrorMessage = "Failed to fetch eShipPlus shipment history due to an internal error.";
      let firebaseErrorCode = 'internal'; // Default Firebase error code

      if (error.httpErrorCode && error.httpErrorCode.status) {
        statusCode = error.httpErrorCode.status;
        clientErrorMessage = error.message;
        firebaseErrorCode = mapHttpStatusToFirebaseErrorCode(statusCode);
      } else if (error.isAxiosError && error.response) {
        statusCode = error.response.status;
        clientErrorMessage = `External API error: ${error.response.statusText}`;
        firebaseErrorCode = mapHttpStatusToFirebaseErrorCode(statusCode);
      } else if (typeof error.code === 'string') { // Check if it's a Firebase HttpsError style error
        // Use the code from HttpsError if available (e.g., 'unauthenticated', 'invalid-argument')
        // These are already valid Firebase HttpsErrorCodes
        const knownFirebaseCodes = ['ok', 'cancelled', 'unknown', 'invalid-argument', 'deadline-exceeded', 'not-found', 'already-exists', 'permission-denied', 'resource-exhausted', 'failed-precondition', 'aborted', 'out-of-range', 'unimplemented', 'internal', 'unavailable', 'data-loss', 'unauthenticated'];
        if (knownFirebaseCodes.includes(error.code)) {
          firebaseErrorCode = error.code;
        }
        clientErrorMessage = error.message || 'An error occurred.';
        // Attempt to map common HTTP status codes if error.code isn't a standard Firebase one
        if (error.status && typeof error.status === 'number') {
            statusCode = error.status;
            if (!knownFirebaseCodes.includes(firebaseErrorCode)) { // If error.code wasn't a direct match
                 firebaseErrorCode = mapHttpStatusToFirebaseErrorCode(statusCode);
            }
        } else if (error.code === 'unauthenticated') {
            statusCode = 401;
            firebaseErrorCode = 'unauthenticated';
        } else if (error.code === 'invalid-argument') {
            statusCode = 400;
            firebaseErrorCode = 'invalid-argument';
        }
        // Default to 500 if statusCode wasn't set by a specific error type
        if (statusCode !== 400 && statusCode !== 401 && statusCode !== 403 && statusCode !== 404) {
            statusCode = 500; 
        }
      }

      // Wrap the error response in an 'error' object
      return res.status(statusCode).send({ 
        error: { 
          status: firebaseErrorCode, 
          message: clientErrorMessage, 
          details: error.details // Pass along details if they exist
        } 
      });
    }
  });
});

// Add the QuickShip email diagnostic function
const { quickShipEmailDiagnostic } = require('./src/quickShipEmailDiagnostic');
exports.quickShipEmailDiagnostic = quickShipEmailDiagnostic;

// Training functions
const { getTrainingSample, listTrainingSamples } = require('./src/visualTraining/unifiedTrainingSystem');
exports.getTrainingSample = getTrainingSample;
exports.listTrainingSamples = listTrainingSamples;

// Test Functions
const { testSendGridEmail } = require('./src/testSendGridEmail');
exports.testSendGridEmail = testSendGridEmail;

// Rate Calculation Functions
const { calculateCarrierRates } = require('./src/rates/calculateCarrierRates');
const {
    createCarrierRateCard,
    updateCarrierRateCard,
    deleteCarrierRateCard,
    getCarrierRateCards,
    manageDIMFactor
} = require('./src/rates/carrierRateCardManagement');
const {
    createConnectedCarrier,
    updateQuickShipCarrier,
    getConversionCandidates
} = require('./src/rates/carrierConversionService');
const {
    generateRateCardTemplate,
    importRateCards
} = require('./src/rates/rateCardImportService');
const {
    getCarrierRoutes,
    createEnhancedRateCard,
    updateEnhancedRateCard,
    getEnhancedRateCards,
    deleteEnhancedRateCard,
    calculateEnhancedChargeMappingRates,
    bulkImportEnhancedRateCards
} = require('./src/carriers/enhancedChargeMapping');

exports.calculateCarrierRates = calculateCarrierRates;
exports.createCarrierRateCard = createCarrierRateCard;
exports.updateCarrierRateCard = updateCarrierRateCard;
exports.deleteCarrierRateCard = deleteCarrierRateCard;
exports.getCarrierRateCards = getCarrierRateCards;
exports.manageDIMFactor = manageDIMFactor;

// Enhanced Charge Mapping Functions
exports.getCarrierRoutes = getCarrierRoutes;
exports.createEnhancedRateCard = createEnhancedRateCard;
exports.updateEnhancedRateCard = updateEnhancedRateCard;
exports.getEnhancedRateCards = getEnhancedRateCards;
exports.deleteEnhancedRateCard = deleteEnhancedRateCard;
exports.calculateEnhancedChargeMappingRates = calculateEnhancedChargeMappingRates;
exports.bulkImportEnhancedRateCards = bulkImportEnhancedRateCards;
exports.createConnectedCarrier = createConnectedCarrier;
exports.updateQuickShipCarrier = updateQuickShipCarrier;
exports.getConversionCandidates = getConversionCandidates;
exports.generateRateCardTemplate = generateRateCardTemplate;
exports.importRateCards = importRateCards;

// Shipping Zones Management Functions
const {
    getShippingZones,
    createShippingZone,
    updateShippingZone,
    deleteShippingZone
} = require('./src/configuration/shippingZonesManagement');

exports.getShippingZones = getShippingZones;
exports.createShippingZone = createShippingZone;
exports.updateShippingZone = updateShippingZone;
exports.deleteShippingZone = deleteShippingZone;

// Carrier Eligibility Management Functions
const {
    getCarrierEligibilityRules,
    createCarrierEligibilityRule,
    updateCarrierEligibilityRule,
    deleteCarrierEligibilityRule,
    getCarriers
} = require('./src/routing/carrierEligibilityManagement');

exports.getCarrierEligibilityRules = getCarrierEligibilityRules;
exports.createCarrierEligibilityRule = createCarrierEligibilityRule;
exports.updateCarrierEligibilityRule = updateCarrierEligibilityRule;
exports.deleteCarrierEligibilityRule = deleteCarrierEligibilityRule;

// Enterprise Zone Management Functions
const {
    getRegions,
    createRegion,
    getZoneSets,
    createZoneSet,
    deleteZoneSet,
    getZones,
    createZone,
    updateZone,
    deleteZone,
    getZoneMaps,
    resolveZone
} = require('./src/configuration/enterpriseZoneManagement');

exports.getRegions = getRegions;
exports.createRegion = createRegion;
exports.getZoneSets = getZoneSets;
exports.createZoneSet = createZoneSet;
exports.deleteZoneSet = deleteZoneSet;
exports.getZones = getZones;
exports.createZone = createZone;
exports.updateZone = updateZone;
exports.deleteZone = deleteZone;
exports.getZoneMaps = getZoneMaps;
exports.resolveZone = resolveZone;

// Rating Break Sets Functions
const {
    getRatingBreakSets,
    createRatingBreakSet,
    getRatingBreaks,
    createRatingBreaks,
    calculateRating
} = require('./src/configuration/ratingBreakSets');

exports.getRatingBreakSets = getRatingBreakSets;
exports.createRatingBreakSet = createRatingBreakSet;
exports.getRatingBreaks = getRatingBreaks;
exports.createRatingBreaks = createRatingBreaks;
exports.calculateRating = calculateRating;

// Zone Population Function
const { populateNorthAmericanZones } = require('./src/configuration/populateNorthAmericanZones');
exports.populateNorthAmericanZones = populateNorthAmericanZones;

// Carrier Weight Eligibility Functions
const {
    getCarrierWeightRules,
    createCarrierWeightRule,
    updateCarrierWeightRule,
    deleteCarrierWeightRule
} = require('./src/carriers/carrierWeightEligibility');

exports.getCarrierWeightRules = getCarrierWeightRules;
exports.createCarrierWeightRule = createCarrierWeightRule;
exports.updateCarrierWeightRule = updateCarrierWeightRule;
exports.deleteCarrierWeightRule = deleteCarrierWeightRule;

// Carrier Dimension Eligibility Functions
const {
    getCarrierDimensionRules,
    createCarrierDimensionRule,
    updateCarrierDimensionRule,
    deleteCarrierDimensionRule
} = require('./src/carriers/carrierDimensionEligibility');

exports.getCarrierDimensionRules = getCarrierDimensionRules;
exports.createCarrierDimensionRule = createCarrierDimensionRule;
exports.updateCarrierDimensionRule = updateCarrierDimensionRule;
exports.deleteCarrierDimensionRule = deleteCarrierDimensionRule;

// Universal Rating Engine Functions
const { calculateUniversalRates } = require('./src/rates/universalRatingEngine');
const { generateRateTemplate, importRateCard, getRateTemplates } = require('./src/rates/rateTemplateManager');

exports.calculateUniversalRates = calculateUniversalRates;
exports.generateRateTemplate = generateRateTemplate;
exports.importRateCard = importRateCard;
exports.getRateTemplates = getRateTemplates;

// Normalized Carrier Import & Rating Functions  
const { getCarrierImportFormats, generateNormalizedTemplate, importNormalizedCarrierConfig } = require('./src/rates/normalizedCarrierImporter');
const { calculateNormalizedRates } = require('./src/rates/normalizedRatingEngine');

exports.getCarrierImportFormats = getCarrierImportFormats;
exports.generateNormalizedTemplate = generateNormalizedTemplate;
exports.importNormalizedCarrierConfig = importNormalizedCarrierConfig;
exports.calculateNormalizedRates = calculateNormalizedRates;

// Enhanced Zone Management Functions
const { 
    getCarrierZoneOverrides, 
    createCarrierZoneOverride, 
    resolveZoneWithOverrides 
} = require('./src/configuration/enhancedZoneManagement');

exports.getCarrierZoneOverrides = getCarrierZoneOverrides;
exports.createCarrierZoneOverride = createCarrierZoneOverride;
exports.resolveZoneWithOverrides = resolveZoneWithOverrides;

// NMFC Class System Functions
const { 
    calculateLTLWithClass, 
    getFreightClasses, 
    createFAKMapping, 
    initializeFreightClasses 
} = require('./src/rates/nmfcClassSystem');

exports.calculateLTLWithClass = calculateLTLWithClass;
exports.getFreightClasses = getFreightClasses;
exports.createFAKMapping = createFAKMapping;
exports.initializeFreightClasses = initializeFreightClasses;

// Unified Break Sets Functions
const { 
    calculateUnifiedRates, 
    createUnifiedBreakSet, 
    addUnifiedBreaks 
} = require('./src/rates/unifiedBreakSets');

exports.calculateUnifiedRates = calculateUnifiedRates;
exports.createUnifiedBreakSet = createUnifiedBreakSet;
exports.addUnifiedBreaks = addUnifiedBreaks;

// Enterprise Caching Functions
const { 
    getCachedZoneResolution, 
    getCachedRateCalculation, 
    getCacheStatistics, 
    clearCache, 
    prewarmCache 
} = require('./src/utils/enterpriseCaching');

exports.getCachedZoneResolution = getCachedZoneResolution;
exports.getCachedRateCalculation = getCachedRateCalculation;
exports.getCacheStatistics = getCacheStatistics;
exports.clearCache = clearCache;
exports.prewarmCache = prewarmCache;

// Custom Carrier Template System Functions
const { 
    createCarrierTemplateMapping, 
    autoDetectCarrierCSV, 
    importWithCustomTemplate,
    getCarrierTemplateMappings 
} = require('./src/rates/carrierTemplateSystem');

exports.createCarrierTemplateMapping = createCarrierTemplateMapping;
exports.autoDetectCarrierCSV = autoDetectCarrierCSV;
exports.importWithCustomTemplate = importWithCustomTemplate;
exports.getCarrierTemplateMappings = getCarrierTemplateMappings;

// Simple Carrier Import Functions (Real-World Solution)
const {
    generateSimpleCarrierTemplate,
    importSimpleCarrierRates,
    getSimpleCarrierRates
} = require('./src/rates/simpleCarrierImporter');

exports.generateSimpleCarrierTemplate = generateSimpleCarrierTemplate;
exports.importSimpleCarrierRates = importSimpleCarrierRates;
exports.getSimpleCarrierRates = getSimpleCarrierRates;

// DIM Factor Management Functions
const {
    createDimFactor,
    getDimFactors,
    updateDimFactor,
    deleteDimFactor,
    calculateVolumetricWeight,
    createCustomerDimFactorOverride
} = require('./src/rates/dimFactorSystem');

exports.createDimFactor = createDimFactor;
exports.getDimFactors = getDimFactors;
exports.updateDimFactor = updateDimFactor;
exports.deleteDimFactor = deleteDimFactor;
exports.calculateVolumetricWeight = calculateVolumetricWeight;
exports.createCustomerDimFactorOverride = createCustomerDimFactorOverride;

// Enhanced Rating Engine Functions
const {
    calculateEnhancedRates,
    testDimWeight
} = require('./src/rates/enhancedRatingEngine');

exports.calculateEnhancedRates = calculateEnhancedRates;
exports.testDimWeight = testDimWeight;

// AI/ML Training
exports.directGeminiExtraction = directGeminiExtraction;

// AP Processing
const { approveAPInvoice } = require('./src/apProcessing/approveAPInvoice');
exports.approveAPInvoice = approveAPInvoice;

// QuickShip Zone-Based Rate Management
const {
    getQuickShipZoneRates,
    saveQuickShipZoneRates,
    calculateQuickShipZoneRates
} = require('./src/quickship/quickShipZoneRates');

exports.getQuickShipZoneRates = getQuickShipZoneRates;
exports.saveQuickShipZoneRates = saveQuickShipZoneRates;
exports.calculateQuickShipZoneRates = calculateQuickShipZoneRates;

// Map City Selector Testing
const { testMapCitySelector } = require('./test-map-functionality');
exports.testMapCitySelector = testMapCitySelector;
// Comprehensive Zone Import System
const { importAllComprehensiveZones } = require('./src/configuration/masterZoneImportComplete');
exports.importAllComprehensiveZones = importAllComprehensiveZones;

// Custom Carrier Zone Management Functions
const {
    expandSystemZoneToCities,
    expandZoneSetToCities,
    expandCarrierCustomZonesToCities,
    expandCarrierCustomZoneSetsToCS,
    getCarrierCustomZoneSets,
    getCarrierCustomZones,
    createCarrierCustomZone,
    updateCarrierCustomZone,
    createCarrierCustomZoneSet,
    updateCarrierCustomZoneSet,
    deleteCarrierCustomZoneSet
} = require('./src/carriers/customZoneManagement');

// Zone Boundary Management
const {
    saveZoneBoundary,
    loadZoneBoundaries,
    updateZoneBoundary,
    deleteZoneBoundary
} = require('./src/carriers/zoneBoundaryManagement');

// Route Matrix Generation
const {
    generateCarrierRouteMatrix,
    loadCarrierRouteMatrix,
    updateCarrierRoute,
    deleteCarrierRoutes
} = require('./src/carriers/routeMatrixGeneration');

exports.expandSystemZoneToCities = expandSystemZoneToCities;
exports.expandZoneSetToCities = expandZoneSetToCities;
exports.expandCarrierCustomZonesToCities = expandCarrierCustomZonesToCities;
exports.expandCarrierCustomZoneSetsToCS = expandCarrierCustomZoneSetsToCS;
exports.getCarrierCustomZoneSets = getCarrierCustomZoneSets;
exports.getCarrierCustomZones = getCarrierCustomZones;
exports.createCarrierCustomZone = createCarrierCustomZone;
exports.updateCarrierCustomZone = updateCarrierCustomZone;
exports.createCarrierCustomZoneSet = createCarrierCustomZoneSet;
exports.updateCarrierCustomZoneSet = updateCarrierCustomZoneSet;
exports.deleteCarrierCustomZoneSet = deleteCarrierCustomZoneSet;

// Zone Boundary Management exports
exports.saveZoneBoundary = saveZoneBoundary;
exports.loadZoneBoundaries = loadZoneBoundaries;
exports.updateZoneBoundary = updateZoneBoundary;
exports.deleteZoneBoundary = deleteZoneBoundary;

// Route Matrix Generation exports
exports.generateCarrierRouteMatrix = generateCarrierRouteMatrix;
exports.loadCarrierRouteMatrix = loadCarrierRouteMatrix;
exports.updateCarrierRoute = updateCarrierRoute;
exports.deleteCarrierRoutes = deleteCarrierRoutes;

// AP Processing exports
const { applyInvoiceCharges } = require('./src/applyInvoiceCharges');
const { unapplyInvoiceCharges } = require('./src/unapplyInvoiceCharges');
exports.applyInvoiceCharges = applyInvoiceCharges;
exports.unapplyInvoiceCharges = unapplyInvoiceCharges;
