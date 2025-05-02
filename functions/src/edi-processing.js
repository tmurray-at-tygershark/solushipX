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

For each shipment, extract the following fields (when available):
- trackingNumber: The tracking or reference number for the shipment
- carrier: The shipping carrier name (e.g., FedEx, UPS, USPS)
- serviceType: The service level (e.g., Ground, Express, Priority)
- shipDate: When the package was shipped
- deliveryDate: When the package was or will be delivered
- origin: Object containing origin address details (company, street, city, state, postalCode, country)
- destination: Object containing destination address details
- weight: The weight of the shipment
- weightUnit: Unit of weight (e.g., lbs, kg)
- dimensions: Object with length, width, height if available
- packages: Array of package details if multiple packages exist
- costs: Breakdown of shipping costs (base, fuel, additional fees)
- totalCost: Total shipping cost

If you're uncertain about a field, use the most likely value based on context and format, but include it.
If a field is missing entirely, omit it from the JSON rather than including null values.
Format all monetary values as numbers without currency symbols.

Analyze the following CSV data and return ONLY the JSON array with extracted shipments:

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
    const parsedData = JSON.parse(jsonString);
    
    // Validate the extracted data
    if (!Array.isArray(parsedData)) {
      throw new Error('AI did not return an array of shipments');
    }
    
    // Normalize the shipment data to ensure consistent field names
    return parsedData.map(normalizeShipmentData);
  } catch (error) {
    console.error('Error in AI processing:', error);
    // For production, you would want to implement fallback parsing logic here
    // Either call a different model or use traditional parsing approaches
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
    // Use existing fields or alternates if they exist
    trackingNumber: shipment.trackingNumber || shipment.tracking_number || shipment.referenceNumber || shipment.reference,
    carrier: shipment.carrier || shipment.carrierName || shipment.carrier_name,
    serviceType: shipment.serviceType || shipment.service_type || shipment.service,
    shipDate: shipment.shipDate || shipment.ship_date || shipment.date,
    deliveryDate: shipment.deliveryDate || shipment.delivery_date,
    
    // Handle cost fields
    totalCost: parseFloat(shipment.totalCost || shipment.total_cost || shipment.cost || 0),
    
    // Handle weight
    weight: shipment.weight || shipment.package_weight,
    weightUnit: shipment.weightUnit || shipment.weight_unit || 'lbs',
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
      base: parseFloat(costs.base || costs.freight || 0),
      fuel: parseFloat(costs.fuel || costs.fuel_surcharge || 0),
      additional: parseFloat(costs.additional || costs.additionalFees || 0),
      total: parseFloat(costs.total || normalized.totalCost || 0)
    };
  }
  
  // Handle dimensions
  if (shipment.dimensions) {
    normalized.dimensions = {
      length: shipment.dimensions.length || 0,
      width: shipment.dimensions.width || 0,
      height: shipment.dimensions.height || 0,
      unit: shipment.dimensions.unit || 'in'
    };
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