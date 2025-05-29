const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const admin = require('firebase-admin');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const { getCarrierApiConfig } = require('../../utils');

const db = admin.firestore();
const storage = admin.storage();

// Helper function for safe property access
const safeAccess = (obj, path, defaultValue = null) => {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return defaultValue;
        }
    }
    return current;
};

// Build SOAP envelope for Canpar label generation
function buildCanparLabelSoapEnvelope(shipmentId, credentials, thermalFormat = false) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ws="http://ws.business.canshipws.canpar.com"
                  xmlns:xsd="http://dto.canshipws.canpar.com/xsd">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:getLabels>
      <ws:request>
        <xsd:user_id>${credentials.username}</xsd:user_id>
        <xsd:password>${credentials.password}</xsd:password>
        <xsd:id>${shipmentId}</xsd:id>
        <xsd:thermal>${thermalFormat}</xsd:thermal>
      </ws:request>
    </ws:getLabels>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Convert base64 PNG to PDF
async function convertPngToPdf(base64PngData) {
    try {
        // Decode base64 to buffer
        const pngBuffer = Buffer.from(base64PngData, 'base64');
        
        // Get image dimensions using sharp
        const imageMetadata = await sharp(pngBuffer).metadata();
        const { width, height } = imageMetadata;
        
        // Create PDF document
        const pdfDoc = new PDFDocument({
            size: [width || 612, height || 792], // Use image dimensions or default letter size
            margin: 0
        });
        
        // Create buffer stream to capture PDF data
        const chunks = [];
        pdfDoc.on('data', chunk => chunks.push(chunk));
        
        return new Promise((resolve, reject) => {
            pdfDoc.on('end', () => {
                try {
                    const pdfBuffer = Buffer.concat(chunks);
                    resolve(pdfBuffer);
                } catch (error) {
                    reject(error);
                }
            });
            
            pdfDoc.on('error', reject);
            
            try {
                // Add the PNG image to PDF
                pdfDoc.image(pngBuffer, 0, 0, {
                    width: width || 612,
                    height: height || 792
                });
                
                // Finalize the PDF
                pdfDoc.end();
            } catch (error) {
                reject(error);
            }
        });
    } catch (error) {
        logger.error('Error converting PNG to PDF:', error);
        throw new Error(`PNG to PDF conversion failed: ${error.message}`);
    }
}

// Store label document in Firebase Storage and create document record
async function storeCanparLabel(pdfBuffer, shipmentId, firebaseDocId, thermalFormat = false) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const labelType = thermalFormat ? 'thermal' : 'standard';
        const fileName = `canpar-label-${labelType}-${shipmentId}-${timestamp}.pdf`;
        const bucket = storage.bucket();
        
        // Use unified storage path: shipment-documents/{shipmentId}/
        const file = bucket.file(`shipment-documents/${firebaseDocId}/${fileName}`);
        
        // Upload PDF to Firebase Storage
        await file.save(pdfBuffer, {
            metadata: {
                contentType: 'application/pdf',
                metadata: {
                    shipmentId: shipmentId,
                    carrier: 'Canpar',
                    documentType: 'label',
                    generatedAt: new Date().toISOString(),
                    thermalFormat: thermalFormat,
                    labelType: labelType
                }
            }
        });
        
        // Get download URL
        const [downloadUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 1000 * 60 * 60 * 24 * 365 // 1 year
        });
        
        // Create document record using unified ID structure
        const documentData = {
            shipmentId: firebaseDocId,
            filename: fileName,
            docType: 2, // 2 for labels
            fileSize: pdfBuffer.length,
            carrier: 'Canpar',
            documentType: 'label',
            downloadUrl: downloadUrl,
            storagePath: `shipment-documents/${firebaseDocId}/${fileName}`,
            metadata: {
                canparShipmentId: shipmentId,
                labelFormat: 'PDF', // Converted from PNG
                thermalCompatible: thermalFormat,
                labelType: labelType,
                originalFormat: 'PNG'
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            _isUnifiedStructure: true, // Flag to identify unified structure documents
            migrationNote: 'Created with unified ID structure'
        };
        
        // UNIFIED ID STRUCTURE: Use shipment ID as the document ID
        // Store in unified structure: shipments/{shipmentId}/documents/{shipmentId}
        const unifiedDocRef = db.collection('shipments').doc(firebaseDocId)
                                .collection('documents').doc(firebaseDocId);
        
        await unifiedDocRef.set(documentData);
        
        // UNIFIED ID STRUCTURE: Use shipment ID as the main collection document ID
        // Store in main collection using shipment ID as document ID
        const legacyDocRef = db.collection('shipmentDocuments').doc(firebaseDocId);
        await legacyDocRef.set({
            ...documentData,
            unifiedDocumentId: firebaseDocId, // Reference to the unified structure
            migrationNote: 'Created with unified ID structure',
            _isUnifiedStructure: true // Flag to identify unified structure documents
        });
        
        logger.info(`Canpar label stored with unified ID structure:`, {
            shipmentId: firebaseDocId,
            documentId: firebaseDocId, // Now using shipment ID as document ID
            storagePath: documentData.storagePath,
            unifiedPath: `shipments/${firebaseDocId}/documents/${firebaseDocId}`,
            legacyPath: `shipmentDocuments/${firebaseDocId}`,
            thermalFormat: thermalFormat,
            labelType: labelType
        });
        
        return {
            documentId: firebaseDocId, // Return the unified document ID (same as shipment ID)
            downloadUrl: downloadUrl,
            fileName: fileName,
            storagePath: documentData.storagePath,
            unifiedPath: `shipments/${firebaseDocId}/documents/${firebaseDocId}`,
            legacyPath: `shipmentDocuments/${firebaseDocId}`,
            thermalFormat: thermalFormat,
            labelType: labelType
        };
        
    } catch (error) {
        logger.error('Error storing Canpar label:', error);
        throw new Error(`Failed to store label: ${error.message}`);
    }
}

// Main function to generate Canpar label
const generateCanparLabel = onCall(async (request) => {
    try {
        const { shipmentId, firebaseDocId, carrier, thermalFormat = false } = request.data;
        
        logger.info('generateCanparLabel called with:', { shipmentId, firebaseDocId, carrier, thermalFormat });
        
        // Validate required parameters
        if (!shipmentId) {
            throw new Error('Shipment ID is required');
        }
        
        if (!firebaseDocId) {
            throw new Error('Firebase document ID is required');
        }
        
        // Try multiple variations of Canpar carrier name
        const canparVariations = ['Canpar', 'Canpar Express', 'CANPAR', 'canpar'];
        let carrierConfig = null;
        
        for (const variation of canparVariations) {
            logger.info(`Trying to get carrier config for: ${variation} with labels endpoint`);
            try {
                carrierConfig = await getCarrierApiConfig(variation, 'labels');
                if (carrierConfig) {
                    logger.info(`Found carrier config using variation: ${variation}`);
                    break;
                }
            } catch (error) {
                logger.warn(`Failed to get carrier config for ${variation}:`, error.message);
                continue;
            }
        }
        
        if (!carrierConfig) {
            throw new Error(`Canpar carrier configuration not found. Tried variations: ${canparVariations.join(', ')}`);
        }
        
        const credentials = carrierConfig.credentials;
        
        if (!credentials.username || !credentials.password) {
            throw new Error('Canpar API credentials not properly configured');
        }
        
        // Get labels endpoint - it should be in the API URL from the config
        const labelsEndpoint = carrierConfig.apiUrl;
        if (!labelsEndpoint) {
            throw new Error('Canpar labels endpoint not configured');
        }
        
        logger.info('Using Canpar labels endpoint:', labelsEndpoint);
        logger.info('Using credentials for user:', credentials.username);
        logger.info('Thermal format requested:', thermalFormat);
        
        // Build SOAP request for label generation with thermal format support
        const soapEnvelope = buildCanparLabelSoapEnvelope(shipmentId, credentials, thermalFormat);
        
        logger.info('Making SOAP request to Canpar for label generation...');
        
        // Make SOAP call to Canpar
        const response = await axios.post(labelsEndpoint, soapEnvelope, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'getLabels'
            },
            timeout: 30000 // 30 second timeout
        });
        
        logger.info('Received response from Canpar labels API');
        
        // Parse SOAP response
        const parsedResponse = await parseStringPromise(response.data);
        
        // Extract label data from response
        const labelData = safeAccess(parsedResponse, 'soapenv:Envelope.soapenv:Body.0.ns:getLabelsResponse.0.ns:return.0.ax29:labels.0');
        
        if (!labelData) {
            // Check for errors in response
            const error = safeAccess(parsedResponse, 'soapenv:Envelope.soapenv:Body.0.ns:getLabelsResponse.0.ns:return.0.ax29:error.0');
            if (error) {
                throw new Error(`Canpar API error: ${error}`);
            }
            throw new Error('No label data received from Canpar API');
        }
        
        logger.info('Label data extracted successfully, converting to PDF...');
        
        // Convert PNG to PDF
        const pdfBuffer = await convertPngToPdf(labelData);
        
        logger.info('PNG converted to PDF, storing document...');
        
        // Store the label document with thermal format info
        const documentInfo = await storeCanparLabel(pdfBuffer, shipmentId, firebaseDocId, thermalFormat);
        
        logger.info('Canpar label generation completed successfully');
        
        return {
            success: true,
            message: `Canpar label generated successfully${thermalFormat ? ' (thermal format)' : ' (standard format)'}`,
            data: {
                ...documentInfo,
                shipmentId: shipmentId,
                firebaseDocId: firebaseDocId,
                thermalFormat: thermalFormat
            }
        };
        
    } catch (error) {
        logger.error('Error in generateCanparLabel:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
});

module.exports = { generateCanparLabel }; 