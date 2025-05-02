const functions = require('firebase-functions/v2');
const { Storage } = require('@google-cloud/storage');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { PubSub } = require('@google-cloud/pubsub');
const csv = require('csv-parser');
const { Readable } = require('stream');
require('dotenv').config();

// Get Firestore instance with ignoreUndefinedProperties
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

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
    region: 'us-central1'
  }, async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('No data associated with the event');
      return;
    }
    
    const fileData = snapshot.data();
    const docId = event.params.docId;
    
    try {
      // Publish a message to the EDI processing topic
      const messageData = {
        docId,
        storagePath: fileData.storagePath,
        fileName: fileData.fileName,
        isAdmin: fileData.isAdmin || false
      };
      
      const dataBuffer = Buffer.from(JSON.stringify(messageData));
      await pubsub.topic(TOPIC_NAME).publish(dataBuffer);
      
      console.log(`Message published to ${TOPIC_NAME} for document ${docId}`);
      
      // Update the document status
      await snapshot.ref.update({
        processingStatus: 'queued',
        queuedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error queuing file for processing:', error);
      
      await snapshot.ref.update({
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
    const messageData = JSON.parse(Buffer.from(event.data.message.data, 'base64').toString());
    const { docId, storagePath, fileName, isAdmin } = messageData;
    
    console.log(`Processing document ${docId}, file: ${fileName}, isAdmin: ${isAdmin}`);
    
    // Get reference to the upload document
    uploadRef = db.collection('ediUploads').doc(docId);
    
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
    const shipments = await processWithAI(csvContent, fileName);
    
    console.log(`Extracted ${shipments.length} shipments from the CSV`);
    
    // Save the results to Firestore
    const resultRef = await db.collection('ediResults').add({
      uploadId: docId,
      fileName,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      shipments,
      totalShipments: shipments.length,
      totalCost: shipments.reduce((sum, shipment) => sum + (parseFloat(shipment.totalCost || shipment.cost) || 0), 0),
      rawCsvSample: csvContent.substring(0, 5000), // Store a sample for debugging
      isAdmin: isAdmin || false
    });
    
    // Update the original upload document
    const processingTimeMs = Date.now() - startTime;
    await uploadRef.update({
      processingStatus: 'completed',
      processingTimeMs,
      resultDocId: resultRef.id,
      shipmentCount: shipments.length,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      confidenceScore: 0.92, // This would ideally come from the AI model
    });
    
    console.log(`Processing completed in ${processingTimeMs}ms`);
    
    return { success: true, shipmentCount: shipments.length };
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
 * @returns {Array} - Array of extracted shipment objects
 */
async function processWithAI(csvContent, fileName) {
  try {
    // Initialize the model - use a more specific model name
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // Create a prompt with detailed instructions
    const prompt = `
You are an expert at extracting shipment data from complex CSV files. I need you to parse the following CSV content that contains shipment records from a carrier system.

Your task is to:
1. Identify all shipment records in the data
2. Extract key information for each shipment
3. Return a structured JSON array with one object per shipment

IMPORTANT: The CSV format will vary significantly between carrier systems. Be flexible in your extraction approach.
- The header row may have different column names than expected
- Some data may be in unexpected columns or positions
- The CSV may contain extraneous information like headers, footers, or summary rows
- Focus on extracting actual shipment line items only

For each shipment, extract the following fields (when available):
- accountNumber: The account number used for the shipment
- invoiceNumber: The invoice number for the shipment
- invoiceDate: The date of the invoice
- manifestNumber: The manifest number for the shipment
- pieces: The number of pieces or quantity of the shipment (may be labeled as "Quantity")
- trackingNumber: The tracking number or barcode for the shipment
- carrier: The shipping carrier name (e.g., FedEx, UPS, USPS)
- serviceType: The service level (e.g., Ground, Express, Priority)
- shipDate: When the package was shipped
- deliveryDate: When the package was or will be delivered
- origin: Object containing origin address details (company, street, city, state, postalCode, country)
- shipmentReference: Shipper/consignee reference numbers for the shipment
- destination: Object containing destination address details
- reportedWeight: The initial weight submitted for the shipment
- actualWeight: The actual weight of the shipment after carrier measurement
- weightUnit: Unit of weight - interpret abbreviations logically (e.g., "L" means pounds/LBS, "K" means kilograms/KGS, etc.)
- dimensions: Object with length, width, height if available
- packages: Array of package details if multiple packages exist
- costs: Breakdown of shipping costs (base, fuel, freight, miscellaneous, additionalFees, serviceCharges, signatureService, surcharges, taxes)
- totalCost: Total shipping cost

GUIDELINES FOR EXTRACTION:
1. If a field is missing entirely, omit it from the JSON rather than including null or empty values.
2. Format all monetary values as numbers without currency symbols.
3. Convert weights to numeric values.
4. Ensure all dates are formatted consistently (YYYY-MM-DD or MM/DD/YYYY).
5. Be smart about data types - use numbers for numeric values, not strings.
6. If you're uncertain about a field but have a reasonable guess, include it and note your confidence.
7. For addresses, combine fields intelligently if split across columns.
8. For weight units, interpret abbreviated units - e.g., "L" or "LB" as "LBS" (pounds), "K" or "KG" as "KGS" (kilograms), "OZ" as ounces.

EXAMPLE OF EXPECTED OUTPUT FORMAT:
[
  {
    "invoiceNumber": "INV12345",
    "trackingNumber": "1Z999AA1234567890",
    "carrier": "UPS",
    "serviceType": "Ground",
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
    "weightUnit": "LBS", // If source shows "L", convert to "LBS"
    "pieces": 2,
    "costs": {
      "base": 25.50,
      "fuel": 5.25,
      "surcharges": 3.00,
      "taxes": 2.55
    },
    "totalCost": 36.30
  },
  {
    "invoiceNumber": "INV12346",
    "trackingNumber": "FEDEX0987654321",
    "carrier": "FedEx",
    "serviceType": "International",
    "shipDate": "2023-05-02",
    "actualWeight": 7.2,
    "weightUnit": "KGS", // If source shows "K", convert to "KGS"
    "dimensions": {
      "length": 30,
      "width": 25,
      "height": 20,
      "unit": "CM" // Standardize units of measure
    },
    "pieces": 1,
    "totalCost": 82.15
  }
]

Analyze the following CSV data and return ONLY the JSON array with extracted shipments, no explanations or commentary:

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
        throw new Error('AI did not return an array of shipments');
      }
      
      // Normalize the shipment data to ensure consistent field names
      return parsedData.map(normalizeShipmentData);
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
            return parsedData.map(normalizeShipmentData);
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
 * Normalize shipment data to ensure consistent field naming
 * @param {Object} shipment - Raw shipment data from AI extraction
 * @returns {Object} - Normalized shipment data
 */
function normalizeShipmentData(shipment) {
  // Create a standardized object with our preferred field names
  const normalized = {
    // Invoice and account fields
    accountNumber: shipment.accountNumber || shipment.account_number || shipment.account,
    invoiceNumber: shipment.invoiceNumber || shipment.invoice_number || shipment.invoice,
    invoiceDate: shipment.invoiceDate || shipment.invoice_date,
    manifestNumber: shipment.manifestNumber || shipment.manifest_number || shipment.manifest,
    
    // Shipment identifiers
    trackingNumber: shipment.trackingNumber || shipment.tracking_number || shipment.barcode || 
                    shipment.tracking || shipment.referenceNumber || shipment.reference,
    shipmentReference: shipment.shipmentReference || shipment.reference || shipment.references || 
                       shipment.shipment_reference,
                       
    // Carrier and service information
    carrier: shipment.carrier || shipment.carrierName || shipment.carrier_name,
    serviceType: shipment.serviceType || shipment.service_type || shipment.service,
    
    // Dates
    shipDate: shipment.shipDate || shipment.ship_date || shipment.date,
    deliveryDate: shipment.deliveryDate || shipment.delivery_date,
    
    // Quantity
    pieces: parseIntSafe(shipment.pieces || shipment.quantity || shipment.items),
    
    // Weight fields - attempt to convert to numbers
    reportedWeight: parseFloatSafe(shipment.reportedWeight || shipment.reported_weight || shipment.stated_weight),
    actualWeight: parseFloatSafe(shipment.actualWeight || shipment.actual_weight || shipment.weight),
    weightUnit: standardizeUOM(shipment.weightUnit || shipment.weight_unit || 'lbs'),
  };
  
  // Handle origin address
  if (shipment.origin || shipment.from) {
    const origin = shipment.origin || shipment.from;
    normalized.origin = typeof origin === 'string' 
      ? { city: origin } // Handle simple string addresses
      : {
          company: origin.company || origin.name || '',
          street: origin.street || origin.address || '',
          // Only include street2 if it exists
          ...(origin.street2 || origin.address2 ? { street2: origin.street2 || origin.address2 } : {}),
          city: origin.city || '',
          state: origin.state || '',
          postalCode: origin.postalCode || origin.postal_code || origin.zip || '',
          country: origin.country || 'US',
        };
  }
  
  // Handle destination address
  if (shipment.destination || shipment.to) {
    const destination = shipment.destination || shipment.to;
    normalized.destination = typeof destination === 'string'
      ? { city: destination } // Handle simple string addresses
      : {
          company: destination.company || destination.name || '',
          street: destination.street || destination.address || '',
          // Only include street2 if it exists
          ...(destination.street2 || destination.address2 ? { street2: destination.street2 || destination.address2 } : {}),
          city: destination.city || '',
          state: destination.state || '',
          postalCode: destination.postalCode || destination.postal_code || destination.zip || '',
          country: destination.country || 'US',
        };
  }
  
  // Handle cost breakdown
  if (shipment.costs || shipment.charges) {
    const costs = shipment.costs || shipment.charges;
    normalized.costs = {
      base: parseFloatSafe(costs.base || costs.baseCharge || 0),
      fuel: parseFloatSafe(costs.fuel || costs.fuelSurcharge || costs.fuel_surcharge || 0),
      freight: parseFloatSafe(costs.freight || 0),
      miscellaneous: parseFloatSafe(costs.miscellaneous || costs.misc || 0),
      additionalFees: parseFloatSafe(costs.additionalFees || costs.additional || costs.additional_fees || 0),
      serviceCharges: parseFloatSafe(costs.serviceCharges || costs.service || costs.service_charges || 0),
      signatureService: parseFloatSafe(costs.signatureService || costs.signature || 0),
      surcharges: parseFloatSafe(costs.surcharges || 0),
      taxes: parseFloatSafe(costs.taxes || costs.tax || 0),
    };
    
    // Only include non-zero values
    normalized.costs = Object.fromEntries(
      Object.entries(normalized.costs).filter(([_, value]) => value > 0)
    );
  }
  
  // Handle total cost - calculate from costs if not provided
  normalized.totalCost = parseFloatSafe(shipment.totalCost || shipment.total_cost || shipment.total || shipment.cost || 0);
  
  // If no total cost but we have costs breakdown, calculate total
  if (normalized.totalCost === 0 && normalized.costs) {
    normalized.totalCost = Object.values(normalized.costs).reduce((sum, val) => sum + val, 0);
  }
  
  // Handle dimensions
  if (shipment.dimensions) {
    normalized.dimensions = {
      length: parseFloatSafe(shipment.dimensions.length || 0),
      width: parseFloatSafe(shipment.dimensions.width || 0),
      height: parseFloatSafe(shipment.dimensions.height || 0),
      unit: standardizeUOM(shipment.dimensions.unit || 'in')
    };
    
    // Only include dimensions if at least one dimension is provided
    if (normalized.dimensions.length === 0 && 
        normalized.dimensions.width === 0 && 
        normalized.dimensions.height === 0) {
      delete normalized.dimensions;
    }
  }
  
  // Handle packages if they exist
  if (shipment.packages && Array.isArray(shipment.packages)) {
    normalized.packages = shipment.packages;
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
    
    const shipments = await processWithAI(csvContent, fileName || 'test.csv');
    
    res.status(200).send({
      success: true,
      shipments,
      count: shipments.length
    });
  } catch (error) {
    console.error('Error processing CSV via HTTP:', error);
    res.status(500).send({
      success: false,
      error: error.message
    });
  }
}); 