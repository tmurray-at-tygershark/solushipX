const functions = require('firebase-functions/v2');
const { Storage } = require('@google-cloud/storage');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { PubSub } = require('@google-cloud/pubsub');
const csv = require('csv-parser');
const { Readable } = require('stream');
require('dotenv').config();

// Initialize the admin app if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Get Firestore instance with ignoreUndefinedProperties
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// Initialize admin database - use a different approach to access admin database
const adminDb = admin.firestore();
// Set the database ID to "admin"
console.log('Setting up admin database with database ID: admin');
try {
  // Use proper admin database reference by setting a direct connection option
  adminDb._settings = { 
    ...adminDb._settings, 
    databaseId: 'admin' 
  };
} catch (err) {
  console.error('Error setting admin database ID:', err);
}

// Helper function to get the appropriate database
function getDb(isAdmin = true) {
  if (isAdmin) {
    console.log('Using admin database for operation');
    return adminDb;
  }
  console.log('Using regular database for operation');
  return db;
}

// Initialize Google Cloud Storage
const storage = new Storage();

// Initialize Pub/Sub with config variables
const pubsub = new PubSub();
const TOPIC_NAME = process.env.PUBSUB_TOPIC || 'edi-processing';
const SUBSCRIPTION_PATH = process.env.PUBSUB_SUBSCRIPTION || 'projects/solushipx/subscriptions/edi-processing-sub';

// Initialize Gemini AI with API key from .env
const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
console.log('GOOGLE_GENAI_API_KEY is', GEMINI_API_KEY ? 'set' : 'not set');
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Storage bucket - updated to the correct bucket name
const STORAGE_BUCKET = process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'solushipx.firebasestorage.app';

/**
 * Triggered when a new file is uploaded to Firebase Storage
 * Creates a Firestore record and publishes a message to start processing
 */
exports.onFileUploaded = functions.firestore
  .onDocumentCreated({
    document: 'ediUploads/{docId}',
    region: 'us-central1',
    database: 'admin' // Specify the admin database explicitly
  }, async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('No data associated with the event');
      return;
    }
    
    const fileData = snapshot.data();
    const docId = event.params.docId;
    const isAdmin = fileData.isAdmin || false;
    
    try {
      // Publish a message to the EDI processing topic
      const messageData = {
        docId,
        storagePath: fileData.storagePath,
        fileName: fileData.fileName,
        isAdmin
      };
      
      const dataBuffer = Buffer.from(JSON.stringify(messageData));
      await pubsub.topic(TOPIC_NAME).publish(dataBuffer);
      
      console.log(`Message published to ${TOPIC_NAME} for document ${docId}`);
      
      // Get the appropriate database
      const database = getDb(isAdmin);
      
      // Update the document status in the appropriate collection
      const collectionPath = 'ediUploads';
      await database.collection(collectionPath).doc(docId).update({
        processingStatus: 'queued',
        queuedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error queuing file for processing:', error);
      
      // Update the document with error info in the appropriate collection
      const database = getDb(isAdmin);
      const collectionPath = 'ediUploads';
      await database.collection(collectionPath).doc(docId).update({
        processingStatus: 'failed',
        error: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { success: false, error: error.message };
    }
  });

/**
 * Processes EDI files from Pub/Sub messages
 * This function is triggered by Pub/Sub and runs on Cloud Run
 */
exports.processEdiFile = functions.pubsub.onMessagePublished({
  topic: TOPIC_NAME,
  region: 'us-central1',
  timeoutSeconds: 540,
  memory: '4GB',
  retry: false
}, async (event) => {
  const startTime = Date.now();
  let uploadRef;
  
  try {
    console.log('Received message from subscription:', SUBSCRIPTION_PATH);
    console.log('Using Gemini API Key:', GEMINI_API_KEY ? 'Key is set' : 'Key is NOT set');
    console.log('Using Storage Bucket:', STORAGE_BUCKET);
    
    // Parse the message data from the Pub/Sub message
    const rawMessage = Buffer.from(event.data.message.data, 'base64').toString();
    console.log('Raw message from Pub/Sub:', rawMessage);
    const messageData = JSON.parse(rawMessage);
    console.log('Parsed message data:', JSON.stringify(messageData));
    const { docId, storagePath, fileName, isAdmin } = messageData;
    
    console.log(`Processing document ${docId}, file: ${fileName}, isAdmin: ${isAdmin}`);
    
    // Get the appropriate database
    const database = getDb(isAdmin);
    console.log(`Database info: ${database._settings ? JSON.stringify(database._settings) : 'No settings'}`);
    
    // Get reference to the upload document in the appropriate collection
    const collectionPath = 'ediUploads';
    console.log(`Using collection path: ${collectionPath} to find document ${docId}`);
    
    // IMPORTANT: For admin database access, use direct initialization which ensures proper databaseId
    let uploadData;
    let directAdminDb;
    
    if (isAdmin) {
      // Create a direct reference to the admin database
      directAdminDb = admin.firestore(admin.app(), 'admin');
      console.log('Created direct admin database reference');
      uploadRef = directAdminDb.collection(collectionPath).doc(docId);
    } else {
      uploadRef = database.collection(collectionPath).doc(docId);
    }
    
    // Check if document exists before updating
    const docSnapshot = await uploadRef.get();
    if (!docSnapshot.exists) {
      throw new Error(`Document ${docId} not found in collection ${collectionPath}. Please check if the document exists.`);
    }
    
    // Get the upload data, including the carrier if specified
    uploadData = docSnapshot.data();
    const carrier = uploadData.carrier || null;
    console.log(`Using carrier from upload: ${carrier || 'Not specified'}`);
    
    // Update status to processing
    await uploadRef.update({
      processingStatus: 'processing',
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Get the file from Cloud Storage
    const bucket = storage.bucket(STORAGE_BUCKET);
    const file = bucket.file(storagePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('File not found in storage');
    }
    
    // Download and parse the CSV file
    const [fileContent] = await file.download();
    const csvContent = fileContent.toString('utf-8');
    
    // Check if file is empty or invalid
    if (!csvContent || csvContent.trim().length === 0) {
      throw new Error('File is empty or invalid');
    }
    
    console.log(`Successfully downloaded file, size: ${fileContent.length} bytes`);
    
    // Process the file with Gemini AI
    const records = await processWithAI(csvContent, fileName);
    
    // Apply the carrier to all records if it was specified in the upload
    const processedRecords = carrier 
      ? records.map(record => {
          // Only apply carrier if not already detected
          if (!record.carrier) {
            return { ...record, carrier };
          }
          return record;
        })
      : records;
    
    console.log(`Extracted ${processedRecords.length} records from the CSV`);
    
    // Save the results to Firestore in the appropriate collection
    const resultsCollectionPath = 'ediResults';
    let resultRef;
    
    // Use direct admin database reference if needed
    if (isAdmin) {
      // Use the already created direct admin database reference
      resultRef = await directAdminDb.collection(resultsCollectionPath).add({
        uploadId: docId,
        fileName,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        records: processedRecords,
        totalRecords: processedRecords.length,
        carrier, // Include the carrier in the results document
        totalCost: processedRecords.reduce((sum, record) => sum + (parseFloat(record.totalCost || record.cost) || 0), 0),
        rawCsvSample: csvContent.substring(0, 5000), // Store a sample for debugging
        isAdmin: isAdmin || false
      });
      
      // Update the original upload document using the direct admin reference
      const processingTimeMs = Date.now() - startTime;
      await directAdminDb.collection('ediUploads').doc(docId).update({
        processingStatus: 'completed',
        processingTimeMs,
        resultDocId: resultRef.id,
        recordCount: processedRecords.length,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        confidenceScore: 0.92, // This would ideally come from the AI model
      });
    } else {
      resultRef = await database.collection(resultsCollectionPath).add({
        uploadId: docId,
        fileName,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        records: processedRecords,
        totalRecords: processedRecords.length,
        carrier, // Include the carrier in the results document
        totalCost: processedRecords.reduce((sum, record) => sum + (parseFloat(record.totalCost || record.cost) || 0), 0),
        rawCsvSample: csvContent.substring(0, 5000), // Store a sample for debugging
        isAdmin: isAdmin || false
      });
      
      // Update the original upload document
      const processingTimeMs = Date.now() - startTime;
      await uploadRef.update({
        processingStatus: 'completed',
        processingTimeMs,
        resultDocId: resultRef.id,
        recordCount: processedRecords.length,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        confidenceScore: 0.92, // This would ideally come from the AI model
      });
    }
    
    return { success: true, recordCount: processedRecords.length };
  } catch (error) {
    console.error('Error processing EDI file:', error);
    
    // Update the document with error information
    if (uploadRef) {
      await uploadRef.update({
        processingStatus: 'failed',
        error: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    return { success: false, error: error.message };
  }
});

/**
 * Process the CSV content using Gemini AI
 * @param {string} csvContent - Raw CSV content
 * @param {string} fileName - Original file name
 * @returns {Array} - Array of extracted record objects
 */
async function processWithAI(csvContent, fileName) {
  try {
    // Initialize the model - use a more specific model name
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // Create a prompt with detailed instructions
    const prompt = `
You are an expert at extracting data from complex CSV files containing carrier shipment and charge information. I need you to parse the following CSV content that contains both shipment records and various charge entries from a carrier system.

Your task is to:
1. Identify all records in the data (both shipments and other charges)
2. Extract key information for each record
3. Return a structured JSON array with one object per record

IMPORTANT DISTINCTION:
- Some records represent actual shipments with tracking numbers, weights, dimensions, etc.
- Other records represent charges, fees, or administrative entries that are NOT shipments
- Do NOT filter out any records - extract ALL rows even if they have zero values or appear to be non-shipment charges

For each record, extract the following fields (when available):
- recordType: Determine if this is a "shipment" or "charge" (non-shipment) record
- accountNumber: The account number used for the shipment or charge
- invoiceNumber: The invoice number for the shipment or charge
- invoiceDate: The date of the invoice
- manifestNumber: The manifest number for the shipment
- manifestDate: The date of the manifest (IMPORTANT: this is often equivalent to the ship date)
- pieces: The number of pieces or quantity of the shipment (may be labeled as "Quantity")
- trackingNumber: The tracking number or barcode for the shipment
- carrier: The shipping carrier name (e.g., FedEx, UPS, USPS)
- serviceType: The service level (e.g., Ground, Express, Priority)
- shipDate: When the package was shipped (NOTE: If not explicitly available, check for manifestDate)
- deliveryDate: When the package was or will be delivered
- origin: Object containing origin address details (company, street, city, state, postalCode, country)
- shipmentReference: Shipper/consignee reference numbers for the shipment (look for PO number, customer reference, order number, etc.)
- destination: Object containing destination address details
- reportedWeight: The initial weight submitted for the shipment
- actualWeight: The actual weight of the shipment after carrier measurement
- weightUnit: Unit of weight - interpret abbreviations logically (e.g., "L" means pounds/LBS, "K" means kilograms/KGS, etc.)
- dimensions: Object with length, width, height if available
- packages: Array of package details if multiple packages exist
- description: Description of the charge or line item (especially important for non-shipment charges)
- postalCode: Postal/ZIP code related to the shipment or charge
- costs: Breakdown of shipping costs including:
  - base: Base shipping cost
  - fuel: Fuel surcharge
  - freight: Freight charge
  - miscellaneous: Miscellaneous charges
  - additionalFees: Additional fees
  - serviceCharges: Service charges
  - signatureService: Signature service fees
  - surcharges: Other surcharges
  - taxes: General tax amount
  - gst: Goods and Services Tax (GST)
  - pst: Provincial Sales Tax (PST)
  - hst: Harmonized Sales Tax (HST)
  - declaredValueCharge: Extra charge for declared value
  - extendedAreaCharge: Charge for delivery to extended areas
  - extraCareCharge: Charge for extra care handling
  - codCharge: Cash on Delivery charge
  - addressCorrectionCharge: Address correction fee
  - discounts: Any discounts applied
- totalCost: Total cost for this record
- chargeType: For non-shipment charges, the type of charge (e.g., "Administrative", "Fee", "Surcharge")

GUIDELINES FOR EXTRACTION:
1. If a field is missing entirely, omit it from the JSON rather than including null or empty values.
2. Format all monetary values as numbers without currency symbols.
3. Convert weights to numeric values.
4. Ensure all dates are formatted consistently (YYYY-MM-DD or MM/DD/YYYY).
5. Be smart about data types - use numbers for numeric values, not strings.
6. For addresses, combine fields intelligently if split across columns.
7. For weight units, interpret abbreviated units - e.g., "L" or "LB" as "LBS" (pounds), "K" or "KG" as "KGS" (kilograms), "OZ" as ounces.
8. IMPORTANT: Pay special attention to tax fields like GST, PST, and HST - these are critical Canadian taxes that must be captured correctly.
9. IMPORTANT: Include ALL records from the CSV, even those with zero values for pieces or weight.
10. IMPORTANT: For each record, determine if it's a shipment (has tracking/pieces/weight) or a charge/fee and set the "recordType" field accordingly.
11. IMPORTANT: If shipDate is not available, use manifestDate as the shipDate.

COUNTRY RECOGNITION GUIDELINES:
1. IMPORTANT: For address data, correctly identify whether an address is in the US or Canada based on:
   - Canadian postal codes follow format: Letter-Number-Letter Number-Letter-Number (e.g., A1A 1A1)
   - US ZIP codes are either 5 digits (e.g., 90210) or 9 digits with optional hyphen (e.g., 90210-1234)
   - Canadian province codes include: AB, BC, MB, NB, NL, NS, NT, NU, ON, PE, QC, SK, YT
   - If a province code is present, the country is Canada
   - If a postal code starts with a letter, the country is Canada
   - If a postal code is all numeric, the country is US
2. Set the country field in origin and destination objects to "CA" for Canadian addresses and "US" for US addresses.
3. Do not default all countries to "US" - make an intelligent determination based on postal codes and province information.
4. If GST, PST, or HST tax fields are present, this often indicates a Canadian shipment or charge.

EXAMPLE OF EXPECTED OUTPUT FORMAT:
[
  {
    "recordType": "shipment",
    "invoiceNumber": "INV12345",
    "trackingNumber": "1Z999AA1234567890",
    "shipmentReference": "PO-98765-REF",
    "carrier": "UPS",
    "serviceType": "Ground",
    "manifestDate": "2023-05-01",
    "shipDate": "2023-05-01",
    "origin": {
      "company": "ACME Corp",
      "street": "123 Shipping Lane",
      "city": "Atlanta",
      "state": "GA",
      "postalCode": "30328",
      "country": "US"
    },
    "destination": {
      "company": "Widget Inc",
      "street": "456 Receiving Dr",
      "city": "Dallas",
      "state": "TX",
      "postalCode": "75201",
      "country": "US"
    },
    "actualWeight": 15.4,
    "weightUnit": "LBS",
    "pieces": 2,
    "postalCode": "75201",
    "costs": {
      "base": 25.50,
      "fuel": 5.25,
      "surcharges": 3.00,
      "taxes": 2.55,
      "gst": 1.20,
      "pst": 1.35
    },
    "totalCost": 36.30
  },
  {
    "recordType": "charge",
    "invoiceNumber": "INV12345",
    "accountNumber": "42001076",
    "description": "Address Correction",
    "chargeType": "Fee",
    "postalCode": "75201",
    "costs": {
      "addressCorrectionCharge": 12.00
    },
    "totalCost": 12.00
  },
  {
    "recordType": "shipment",
    "invoiceNumber": "INV12346",
    "trackingNumber": "FEDEX0987654321",
    "shipmentReference": "ORD-555123",
    "carrier": "FedEx",
    "serviceType": "International",
    "manifestDate": "2023-05-02",
    "shipDate": "2023-05-02",
    "origin": {
      "company": "Global Exports Ltd",
      "street": "789 Shipping Rd",
      "city": "Toronto",
      "state": "ON",
      "postalCode": "M5V 2L7",
      "country": "CA"
    },
    "destination": {
      "company": "International Imports",
      "street": "123 Receiver Way",
      "city": "Chicago",
      "state": "IL",
      "postalCode": "60601",
      "country": "US"
    },
    "actualWeight": 7.2,
    "weightUnit": "KGS",
    "dimensions": {
      "length": 30,
      "width": 25,
      "height": 20,
      "unit": "CM"
    },
    "pieces": 1,
    "costs": {
      "base": 65.50,
      "fuel": 8.25,
      "gst": 3.40,
      "hst": 5.00
    },
    "totalCost": 82.15
  }
]

Analyze the following CSV data and return ONLY the JSON array with extracted records, no explanations or commentary:

${csvContent}
`;

    // Call the AI model
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textResponse = response.text();
    
    // Extract the JSON array from the response
    let jsonStart = textResponse.indexOf('[');
    let jsonEnd = textResponse.lastIndexOf(']') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      // Fallback to a more flexible approach if JSON array isn't found
      // Look for object notation
      jsonStart = textResponse.indexOf('{');
      if (jsonStart !== -1) {
        // Find the matching closing brace
        let braceCount = 1;
        jsonEnd = jsonStart + 1;
        while (braceCount > 0 && jsonEnd < textResponse.length) {
          if (textResponse[jsonEnd] === '{') braceCount++;
          if (textResponse[jsonEnd] === '}') braceCount--;
          jsonEnd++;
        }
        
        // If we found a complete object, wrap it in an array
        if (braceCount === 0) {
          const singleObject = textResponse.substring(jsonStart, jsonEnd);
          return JSON.parse(`[${singleObject}]`);
        }
      }
      
      throw new Error('Could not extract valid JSON from AI response');
    }
    
    const jsonString = textResponse.substring(jsonStart, jsonEnd);
    
    // Attempt to fix common JSON parsing issues
    let fixedJsonString = jsonString;
    try {
      const parsedData = JSON.parse(fixedJsonString);
      
      // Validate the extracted data
      if (!Array.isArray(parsedData)) {
        throw new Error('AI did not return an array of records');
      }
      
      // Normalize the record data to ensure consistent field names
      return parsedData.map(normalizeRecordData);
    } catch (parseError) {
      console.error('Error parsing JSON from AI response:', parseError);
      
      // Try to fix common JSON syntax errors
      if (parseError instanceof SyntaxError) {
        // Try to fix trailing commas in objects
        fixedJsonString = fixedJsonString.replace(/,\s*}/g, '}');
        fixedJsonString = fixedJsonString.replace(/,\s*]/g, ']');
        
        // Try to fix unquoted property names
        fixedJsonString = fixedJsonString.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        
        // Try to fix single quotes instead of double quotes
        fixedJsonString = fixedJsonString.replace(/'/g, '"');
        
        try {
          const parsedData = JSON.parse(fixedJsonString);
          if (Array.isArray(parsedData)) {
            console.log('Successfully fixed JSON parsing issues');
            return parsedData.map(normalizeRecordData);
          }
        } catch (secondError) {
          console.error('Failed to fix JSON parsing issues:', secondError);
        }
      }
      
      throw new Error(`Failed to parse JSON from AI response: ${parseError.message}`);
    }
  } catch (error) {
    console.error('Error in AI processing:', error);
    // For production, you would want to implement fallback parsing logic here
    throw error;
  }
}

/**
 * Detect country based on postal code pattern and state/province code
 * @param {string} postalCode - Postal code or ZIP code
 * @param {string} stateProvince - State or province code
 * @returns {string} - Detected country code (US or CA)
 */
function detectCountry(postalCode, stateProvince) {
  // Handle case where both parameters are undefined
  if (!postalCode && !stateProvince) {
    return 'US'; // Default to US if no information provided
  }
  
  // Check postal code pattern first as it's the most reliable indicator
  if (postalCode) {
    // Normalize the postal code - remove spaces and convert to uppercase
    const normalizedPostalCode = postalCode.toString().replace(/\s+/g, '').toUpperCase();
    
    // Canadian postal codes follow pattern: Letter-Number-Letter-Number-Letter-Number (A1A1A1)
    // or with a space in the middle: Letter-Number-Letter Space Number-Letter-Number (A1A 1A1)
    const canadianPostalCodePattern = /^[A-Z][0-9][A-Z][0-9][A-Z][0-9]$|^[A-Z][0-9][A-Z]$/;
    
    // US ZIP codes are either 5 digits or 5+4 digits (with or without hyphen)
    const usZipCodePattern = /^\d{5}(-\d{4})?$|^\d{9}$/;
    
    if (canadianPostalCodePattern.test(normalizedPostalCode)) {
      return 'CA'; // Canadian postal code pattern detected
    }
    
    if (usZipCodePattern.test(normalizedPostalCode)) {
      return 'US'; // US ZIP code pattern detected
    }
    
    // If it starts with a letter, it's more likely to be Canadian
    if (/^[A-Z]/.test(normalizedPostalCode)) {
      return 'CA';
    }
  }
  
  // Check state/province code if postal code wasn't conclusive
  if (stateProvince) {
    const normalizedStateProvince = stateProvince.toString().toUpperCase().trim();
    
    // Common Canadian province abbreviations
    const canadianProvinces = [
      'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
      'ALBERTA', 'BRITISH COLUMBIA', 'MANITOBA', 'NEW BRUNSWICK', 'NEWFOUNDLAND', 
      'NOVA SCOTIA', 'NORTHWEST TERRITORIES', 'NUNAVUT', 'ONTARIO', 'PRINCE EDWARD ISLAND', 
      'QUEBEC', 'SASKATCHEWAN', 'YUKON'
    ];
    
    if (canadianProvinces.includes(normalizedStateProvince)) {
      return 'CA'; // Canadian province detected
    }
  }
  
  // Default to US if nothing specific was detected
  return 'US';
}

/**
 * Normalize record data to ensure consistent field naming
 * @param {Object} record - Raw record data from AI extraction
 * @returns {Object} - Normalized record data
 */
function normalizeRecordData(record) {
  // Create a standardized object with our preferred field names
  const normalized = {
    // Record type - defaults to "shipment" for backward compatibility
    recordType: record.recordType || "shipment",
    
    // Invoice and account fields
    accountNumber: record.accountNumber || record.account_number || record.account,
    invoiceNumber: record.invoiceNumber || record.invoice_number || record.invoice,
    invoiceDate: record.invoiceDate || record.invoice_date,
    manifestNumber: record.manifestNumber || record.manifest_number || record.manifest,
    manifestDate: record.manifestDate || record.manifest_date,
    
    // Shipment identifiers
    trackingNumber: record.trackingNumber || record.tracking_number || record.barcode || 
                    record.tracking || record.referenceNumber || record.reference,
    
    // Make sure to properly extract shipmentReference - add this field specifically
    shipmentReference: record.shipmentReference || record.shipment_reference || 
                      record.shipper_reference || record.consignee_reference || 
                      record.reference_number || record.customer_reference || 
                      record.po_number || record.purchase_order || record.external_id,
    
    // For non-shipment charges
    description: record.description || record.desc || record.itemDescription,
    chargeType: record.chargeType || record.charge_type,
    
    // For both charge and shipment types
    postalCode: record.postalCode || record.postal_code || record.zip,
                       
    // Carrier and service information
    carrier: record.carrier || record.carrierName || record.carrier_name,
    serviceType: record.serviceType || record.service_type || record.service,
    
    // Dates
    // Use manifestDate as a fallback for shipDate if shipDate is not available
    shipDate: record.shipDate || record.ship_date || record.manifestDate || record.manifest_date || record.date,
    deliveryDate: record.deliveryDate || record.delivery_date,
    
    // Quantity
    pieces: parseIntSafe(record.pieces || record.quantity || record.items),
    
    // Weight fields - attempt to convert to numbers
    reportedWeight: parseFloatSafe(record.reportedWeight || record.reported_weight || record.stated_weight),
    actualWeight: parseFloatSafe(record.actualWeight || record.actual_weight || record.weight || record.billedWeight || record.billed_weight),
    weightUnit: standardizeUOM(record.weightUnit || record.weight_unit || 'lbs'),
  };
  
  // Handle origin address
  if (record.origin || record.from) {
    const origin = record.origin || record.from;
    
    if (typeof origin === 'string') {
      normalized.origin = { city: origin }; // Handle simple string addresses
    } else {
      const originPostalCode = origin.postalCode || origin.postal_code || origin.zip || '';
      const originState = origin.state || origin.province || '';
      const originCountry = origin.country || detectCountry(originPostalCode, originState);
      
      normalized.origin = {
        company: origin.company || origin.name || '',
        street: origin.street || origin.address || '',
        // Only include street2 if it exists
        ...(origin.street2 || origin.address2 ? { street2: origin.street2 || origin.address2 } : {}),
        city: origin.city || '',
        state: originState,
        postalCode: originPostalCode,
        country: originCountry, // Use the detected country
      };
    }
  }
  
  // Handle destination address
  if (record.destination || record.to) {
    const destination = record.destination || record.to;
    
    if (typeof destination === 'string') {
      normalized.destination = { city: destination }; // Handle simple string addresses
    } else {
      const destPostalCode = destination.postalCode || destination.postal_code || destination.zip || '';
      const destState = destination.state || destination.province || '';
      const destCountry = destination.country || detectCountry(destPostalCode, destState);
      
      normalized.destination = {
        company: destination.company || destination.name || '',
        street: destination.street || destination.address || '',
        // Only include street2 if it exists
        ...(destination.street2 || destination.address2 ? { street2: destination.street2 || destination.address2 } : {}),
        city: destination.city || '',
        state: destState,
        postalCode: destPostalCode,
        country: destCountry, // Use the detected country
      };
    }
  }
  
  // Handle separate postalCode field
  if (normalized.postalCode && !record.destination) {
    // If there's a standalone postalCode but no destination, create a minimal destination
    const postalCodeCountry = detectCountry(normalized.postalCode);
    
    if (!normalized.destination) {
      normalized.destination = {
        postalCode: normalized.postalCode,
        country: postalCodeCountry
      };
    }
  }
  
  // Handle cost breakdown with expanded tax and charge fields
  if (record.costs || record.charges) {
    const costs = record.costs || record.charges;
    normalized.costs = {
      base: parseFloatSafe(costs.base || costs.baseCharge || 0),
      fuel: parseFloatSafe(costs.fuel || costs.fuelSurcharge || costs.fuel_surcharge || 0),
      freight: parseFloatSafe(costs.freight || costs.freightCharge || 0),
      miscellaneous: parseFloatSafe(costs.miscellaneous || costs.misc || 0),
      additionalFees: parseFloatSafe(costs.additionalFees || costs.additional || costs.additional_fees || 0),
      serviceCharges: parseFloatSafe(costs.serviceCharges || costs.service || costs.service_charges || 0),
      signatureService: parseFloatSafe(costs.signatureService || costs.signature || 0),
      surcharges: parseFloatSafe(costs.surcharges || 0),
      taxes: parseFloatSafe(costs.taxes || costs.tax || 0),
      
      // Canadian tax fields
      gst: parseFloatSafe(costs.gst || 0),
      pst: parseFloatSafe(costs.pst || 0),
      hst: parseFloatSafe(costs.hst || 0),
      
      // Additional specific charges
      addressCorrectionCharge: parseFloatSafe(costs.addressCorrectionCharge || costs.addressCorrection || 0),
      codCharge: parseFloatSafe(costs.codCharge || costs.cod || 0),
      declaredValueCharge: parseFloatSafe(costs.declaredValueCharge || costs.declaredValue || 0),
      extendedAreaCharge: parseFloatSafe(costs.extendedAreaCharge || costs.extendedArea || 0),
      extraCareCharge: parseFloatSafe(costs.extraCareCharge || costs.extraCare || 0),
      discounts: parseFloatSafe(costs.discounts || costs.discount || 0),
    };
    
    // Only include non-zero values
    normalized.costs = Object.fromEntries(
      Object.entries(normalized.costs).filter(([_, value]) => value > 0)
    );
  }
  
  // Handle total cost - calculate from costs if not provided
  normalized.totalCost = parseFloatSafe(record.totalCost || record.total_cost || record.total || record.cost || 0);
  
  // If no total cost but we have costs breakdown, calculate total
  if (normalized.totalCost === 0 && normalized.costs) {
    normalized.totalCost = Object.values(normalized.costs).reduce((sum, val) => sum + val, 0);
  }
  
  // Handle dimensions
  if (record.dimensions) {
    normalized.dimensions = {
      length: parseFloatSafe(record.dimensions.length || 0),
      width: parseFloatSafe(record.dimensions.width || 0),
      height: parseFloatSafe(record.dimensions.height || 0),
      unit: standardizeUOM(record.dimensions.unit || 'in')
    };
    
    // Only include dimensions if at least one dimension is provided
    if (normalized.dimensions.length === 0 && 
        normalized.dimensions.width === 0 && 
        normalized.dimensions.height === 0) {
      delete normalized.dimensions;
    }
  }
  
  // Handle packages if they exist
  if (record.packages && Array.isArray(record.packages)) {
    normalized.packages = record.packages;
  }
  
  // Return only non-empty fields
  return Object.fromEntries(
    Object.entries(normalized).filter(([_, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      if (typeof value === 'object' && Object.keys(value).length === 0) return false;
      return true;
    })
  );
}

/**
 * Safely parse integer values
 * @param {any} value - Value to parse
 * @returns {number|undefined} - Parsed integer or undefined
 */
function parseIntSafe(value) {
  if (value === undefined || value === null) return undefined;
  
  if (typeof value === 'number') return Math.round(value);
  
  if (typeof value === 'string') {
    // Remove non-numeric characters except decimal points
    const cleanStr = value.replace(/[^\d.-]/g, '');
    const parsed = parseInt(cleanStr, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  
  return undefined;
}

/**
 * Safely parse float values
 * @param {any} value - Value to parse
 * @returns {number|undefined} - Parsed float or undefined
 */
function parseFloatSafe(value) {
  if (value === undefined || value === null) return undefined;
  
  if (typeof value === 'number') return value;
  
  if (typeof value === 'string') {
    // Remove non-numeric characters except decimal points
    const cleanStr = value.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? undefined : parsed;
  }
  
  return undefined;
}

/**
 * Standardize units of measure
 * @param {string} unit - Raw unit of measure from CSV
 * @returns {string} - Standardized unit
 */
function standardizeUOM(unit) {
  if (!unit) return 'LBS'; // Default to pounds if missing
  
  // Convert to uppercase for easier comparison
  const normalizedUnit = unit.toUpperCase().trim();
  
  // Weight units standardization
  // Pounds
  if (['L', 'LB', 'LBS', 'POUND', 'POUNDS', '#', 'P'].includes(normalizedUnit)) {
    return 'LBS';
  }
  
  // Kilograms
  if (['K', 'KG', 'KGS', 'KILO', 'KILOS', 'KILOGRAM', 'KILOGRAMS'].includes(normalizedUnit)) {
    return 'KGS';
  }
  
  // Ounces
  if (['OZ', 'OUNCE', 'OUNCES'].includes(normalizedUnit)) {
    return 'OZ';
  }
  
  // Dimensions units standardization
  if (['IN', 'INCH', 'INCHES', '"'].includes(normalizedUnit)) {
    return 'IN';
  }
  
  if (['CM', 'CENTIMETER', 'CENTIMETERS'].includes(normalizedUnit)) {
    return 'CM';
  }
  
  if (['M', 'METER', 'METERS'].includes(normalizedUnit)) {
    return 'M';
  }
  
  // Return the original if not recognized
  return unit;
}

/**
 * HTTP endpoint for direct testing and development
 */
exports.processEdiHttp = functions.https.onRequest({
  region: 'us-central1',
  timeoutSeconds: 540,
  memory: '2GiB'
}, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    
    const { csvContent, fileName } = req.body;
    
    if (!csvContent) {
      res.status(400).send({ error: 'CSV content is required' });
      return;
    }
    
    const records = await processWithAI(csvContent, fileName || 'test.csv');
    
    res.status(200).send({
      success: true,
      records,
      count: records.length
    });
  } catch (error) {
    console.error('Error processing CSV via HTTP:', error);
    res.status(500).send({
      success: false,
      error: error.message
    });
  }
});

/**
 * HTTP endpoint for manual processing of queued documents
 * This allows direct access to process a document without needing the Pub/Sub trigger
 */
exports.processEdiManual = functions.https.onRequest(async (req, res) => {
  try {
    const docId = req.query.docId;
    
    if (!docId) {
      return res.status(400).json({ error: 'Missing docId parameter' });
    }
    
    console.log(`Manual processing initiated for document ${docId}`);
    
    // Get document directly from the admin database
    const directAdminDb = admin.firestore(admin.app(), 'admin');
    const docRef = directAdminDb.collection('ediUploads').doc(docId);
    const docSnapshot = await docRef.get();
    
    if (!docSnapshot.exists) {
      return res.status(404).json({ 
        error: `Document ${docId} not found in admin database` 
      });
    }
    
    const fileData = docSnapshot.data();
    
    // Create the message data
    const messageData = {
      docId,
      storagePath: fileData.storagePath,
      fileName: fileData.fileName,
      isAdmin: true
    };
    
    // Directly call the processing logic instead of using Pub/Sub
    const startTime = Date.now();
    
    // Create a direct reference to the admin database
    const uploadRef = directAdminDb.collection('ediUploads').doc(docId);
    
    // Update status to processing
    await uploadRef.update({
      processingStatus: 'processing',
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      manualProcessing: true
    });
    
    // Get the file from Cloud Storage
    const bucket = storage.bucket(STORAGE_BUCKET);
    const file = bucket.file(fileData.storagePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      await uploadRef.update({
        processingStatus: 'failed',
        error: 'File not found in storage',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(404).json({ error: 'File not found in storage' });
    }
    
    // Download and parse the CSV file
    const [fileContent] = await file.download();
    const csvContent = fileContent.toString('utf-8');
    
    // Check if file is empty or invalid
    if (!csvContent || csvContent.trim().length === 0) {
      await uploadRef.update({
        processingStatus: 'failed',
        error: 'File is empty or invalid',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(400).json({ error: 'File is empty or invalid' });
    }
    
    console.log(`Successfully downloaded file, size: ${fileContent.length} bytes`);
    
    // Process the file with Gemini AI
    const records = await processWithAI(csvContent, fileData.fileName);
    
    console.log(`Extracted ${records.length} records from the CSV`);
    
    // Save the results to Firestore in the appropriate collection
    const resultsCollectionPath = 'ediResults';
    const resultRef = await directAdminDb.collection(resultsCollectionPath).add({
      uploadId: docId,
      fileName: fileData.fileName,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      records,
      totalRecords: records.length,
      totalCost: records.reduce((sum, record) => sum + (parseFloat(record.totalCost || record.cost) || 0), 0),
      rawCsvSample: csvContent.substring(0, 5000), // Store a sample for debugging
      isAdmin: true,
      manualProcessing: true
    });
    
    // Update the original upload document
    const processingTimeMs = Date.now() - startTime;
    await uploadRef.update({
      processingStatus: 'completed',
      processingTimeMs,
      resultDocId: resultRef.id,
      recordCount: records.length,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      confidenceScore: 0.92, // This would ideally come from the AI model
    });
    
    return res.status(200).json({
      success: true,
      message: `Document ${docId} processed successfully`,
      recordCount: records.length,
      processingTimeMs
    });
    
  } catch (error) {
    console.error('Error in manual processing:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}); 