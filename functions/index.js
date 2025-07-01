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

const db = admin.firestore();

// Import function handlers
const { getRatesEShipPlus } = require('./src/carrier-api/eshipplus/getRates');
const { cancelShipmentEShipPlus } = require('./src/carrier-api/eshipplus/cancelShipment');
const { generateEShipPlusBOL } = require('./src/carrier-api/eshipplus/generateBOL');
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

// Import file upload functions
const { uploadFile, uploadFileBase64 } = require('./src/fileUpload');

// Import address book update function
const { updateAddressBookOwnerCompanyID } = require('./src/updateAddressBookOwnerCompanyID');

// Export Callable functions
exports.getRatesEShipPlus = getRatesEShipPlus;
exports.cancelShipmentEShipPlus = cancelShipmentEShipPlus;
exports.generateEShipPlusBOL = generateEShipPlusBOL;
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
exports.adminGetUsersAuthData = adminGetUsersAuthData;
exports.adminListAllUsers = adminListAllUsers;
exports.adminInviteUser = adminInviteUser;
exports.adminResendInvite = adminResendInvite;
exports.verifyInviteAndSetPassword = verifyInviteAndSetPassword;
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

// Export file upload functions
exports.uploadFile = uploadFile;
exports.uploadFileBase64 = uploadFileBase64;

// Export address book update function
exports.updateAddressBookOwnerCompanyID = updateAddressBookOwnerCompanyID;

// Export invoice generation functions
exports.onInvoiceCreated = onInvoiceCreated;
exports.generateInvoicePDFAndEmail = generateInvoicePDFAndEmail;

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
