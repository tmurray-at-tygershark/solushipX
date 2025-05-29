const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');

const db = admin.firestore();
// Use the default Firebase project bucket
const bucket = getStorage().bucket('solushipx.appspot.com');

/**
 * Document Manager - Handles carrier-specific documents
 * Stores documents in Firebase Storage and metadata in Firestore
 */

// Document type constants
const DOCUMENT_TYPES = {
    LABEL: 'label',
    BOL: 'bol', 
    INVOICE: 'invoice',
    POD: 'pod', // Proof of Delivery
    MANIFEST: 'manifest',
    OTHER: 'other'
};

// Carrier-specific document handlers
const CARRIER_HANDLERS = {
    ESHIPPLUS: 'eshipplus',
    CANPAR: 'canpar',
    FEDEX: 'fedex',
    UPS: 'ups'
};

/**
 * Process and store documents from carrier booking response
 * @param {string} shipmentId - Shipment ID
 * @param {string} carrierType - Carrier type (eshipplus, canpar, etc.)
 * @param {Array} rawDocuments - Raw documents from carrier API
 * @param {Object} bookingData - Additional booking context
 * @returns {Array} Array of document metadata
 */
async function processCarrierDocuments(shipmentId, carrierType, rawDocuments, bookingData = {}) {
    try {
        const handler = getCarrierHandler(carrierType);
        if (!handler) {
            throw new Error(`No handler found for carrier: ${carrierType}`);
        }

        const processedDocuments = [];
        
        for (let i = 0; i < rawDocuments.length; i++) {
            const rawDoc = rawDocuments[i];
            try {
                const documentMetadata = await handler.processDocument(
                    shipmentId, 
                    rawDoc, 
                    i, 
                    bookingData
                );
                
                if (documentMetadata) {
                    processedDocuments.push(documentMetadata);
                }
            } catch (error) {
                console.error(`Error processing document ${i} for shipment ${shipmentId}:`, error);
                // Continue processing other documents even if one fails
            }
        }

        return processedDocuments;
    } catch (error) {
        console.error('Error in processCarrierDocuments:', error);
        throw error;
    }
}

/**
 * Get carrier-specific document handler
 * @param {string} carrierType - Carrier type
 * @returns {Object} Carrier handler
 */
function getCarrierHandler(carrierType) {
    switch (carrierType.toLowerCase()) {
        case CARRIER_HANDLERS.ESHIPPLUS:
            return new EShipPlusDocumentHandler();
        case CARRIER_HANDLERS.CANPAR:
            return new CanparDocumentHandler();
        default:
            console.warn(`No specific handler for carrier: ${carrierType}, using generic handler`);
            return new GenericDocumentHandler();
    }
}

/**
 * Base Document Handler Class
 */
class BaseDocumentHandler {
    async processDocument(shipmentId, rawDoc, index, bookingData) {
        throw new Error('processDocument must be implemented by subclass');
    }

    async storeDocument(shipmentId, documentData, filename) {
        try {
            // Create file path
            const filePath = `shipments/${shipmentId}/documents/${filename}`;
            
            // Convert base64 to buffer
            const buffer = Buffer.from(documentData, 'base64');
            
            // Upload to Firebase Storage
            const file = bucket.file(filePath);
            await file.save(buffer, {
                metadata: {
                    contentType: 'application/pdf',
                    cacheControl: 'public, max-age=31536000',
                },
                public: false // Keep documents private
            });

            // Generate signed URL that expires in 1 hour
            const [signedUrl] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000, // 1 hour
            });

            return {
                storagePath: filePath,
                downloadUrl: signedUrl,
                size: buffer.length
            };
        } catch (error) {
            console.error('Error storing document:', error);
            throw error;
        }
    }

    async saveDocumentMetadata(documentMetadata) {
        try {
            const docRef = await db.collection('shipmentDocuments').add({
                ...documentMetadata,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return docRef.id;
        } catch (error) {
            console.error('Error saving document metadata:', error);
            throw error;
        }
    }

    determineDocumentType(docName, docType) {
        const name = docName.toLowerCase();
        
        if (name.includes('label') || name.includes('prolabel')) {
            return DOCUMENT_TYPES.LABEL;
        } else if (name.includes('bol') || name.includes('billoflading')) {
            return DOCUMENT_TYPES.BOL;
        } else if (name.includes('invoice')) {
            return DOCUMENT_TYPES.INVOICE;
        } else if (name.includes('manifest')) {
            return DOCUMENT_TYPES.MANIFEST;
        }
        
        return DOCUMENT_TYPES.OTHER;
    }
}

/**
 * eShipPlus Document Handler
 */
class EShipPlusDocumentHandler extends BaseDocumentHandler {
    async processDocument(shipmentId, rawDoc, index, bookingData) {
        try {
            if (!rawDoc.DocImage || !rawDoc.Name) {
                console.warn(`eShipPlus document ${index} missing required data:`, rawDoc);
                return null;
            }

            // Generate filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${rawDoc.Name}_${timestamp}.pdf`;
            
            // Store document in Firebase Storage
            const storageResult = await this.storeDocument(
                shipmentId, 
                rawDoc.DocImage, 
                filename
            );

            // Determine document type and create metadata
            const documentType = this.determineDocumentType(rawDoc.Name, rawDoc.DocType);
            
            const documentMetadata = {
                shipmentId,
                carrier: 'eshipplus',
                documentType,
                name: rawDoc.Name,
                filename,
                originalIndex: index,
                docType: rawDoc.DocType,
                hasImage: true,
                storagePath: storageResult.storagePath,
                downloadUrl: storageResult.downloadUrl,
                fileSize: storageResult.size,
                proNumber: bookingData.proNumber || null,
                confirmationNumber: bookingData.confirmationNumber || null,
                
                // eShipPlus specific metadata
                eshipplus: {
                    docType: rawDoc.DocType,
                    originalName: rawDoc.Name,
                    hasImage: rawDoc.hasImage
                }
            };

            // Save metadata to Firestore
            const documentId = await this.saveDocumentMetadata(documentMetadata);
            
            return {
                ...documentMetadata,
                id: documentId
            };
        } catch (error) {
            console.error('Error processing eShipPlus document:', error);
            throw error;
        }
    }

    determineDocumentType(docName, docType) {
        const name = docName.toLowerCase();
        
        // eShipPlus specific naming patterns
        if (name.includes('prolabel') || name.includes('label')) {
            // Determine label size/type
            if (name.includes('4x6')) {
                return 'label_4x6';
            } else if (name.includes('3x4') || name.includes('avery')) {
                return 'label_avery_3x4';
            }
            return DOCUMENT_TYPES.LABEL;
        } else if (name.includes('billoflading') || name.includes('bol')) {
            return DOCUMENT_TYPES.BOL;
        }
        
        return DOCUMENT_TYPES.OTHER;
    }
}

/**
 * Canpar Document Handler
 */
class CanparDocumentHandler extends BaseDocumentHandler {
    async processDocument(shipmentId, rawDoc, index, bookingData) {
        // Implement Canpar-specific document processing
        // This will be different from eShipPlus structure
        console.log('Canpar document processing not yet implemented');
        return null;
    }
}

/**
 * Generic Document Handler
 */
class GenericDocumentHandler extends BaseDocumentHandler {
    async processDocument(shipmentId, rawDoc, index, bookingData) {
        // Generic handler for unknown carriers
        console.log('Generic document processing not yet implemented');
        return null;
    }
}

/**
 * Retrieve documents for a shipment
 * @param {string} shipmentId - Shipment ID
 * @param {string} documentType - Optional filter by document type
 * @returns {Array} Array of document metadata
 */
async function getShipmentDocuments(shipmentId, documentType = null) {
    try {
        let query = db.collection('shipmentDocuments')
            .where('shipmentId', '==', shipmentId)
            .orderBy('createdAt', 'desc');
        
        if (documentType) {
            query = query.where('documentType', '==', documentType);
        }

        const snapshot = await query.get();
        const documents = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Refresh download URL if needed (check if expired)
            if (data.downloadUrl && data.storagePath) {
                try {
                    // Generate fresh signed URL
                    const file = bucket.file(data.storagePath);
                    const [signedUrl] = await file.getSignedUrl({
                        action: 'read',
                        expires: Date.now() + 60 * 60 * 1000, // 1 hour
                    });
                    
                    documents.push({
                        id: doc.id,
                        ...data,
                        downloadUrl: signedUrl
                    });
                } catch (error) {
                    console.error(`Error refreshing URL for document ${doc.id}:`, error);
                    documents.push({
                        id: doc.id,
                        ...data,
                        downloadUrl: null
                    });
                }
            } else {
                documents.push({
                    id: doc.id,
                    ...data
                });
            }
        }

        return documents;
    } catch (error) {
        console.error('Error retrieving shipment documents:', error);
        throw error;
    }
}

/**
 * Get documents by type for UI display
 * @param {string} shipmentId - Shipment ID
 * @returns {Object} Documents organized by type
 */
async function getDocumentsByType(shipmentId) {
    try {
        const allDocuments = await getShipmentDocuments(shipmentId);
        
        const documentsByType = {
            labels: [],
            bol: [],
            invoices: [],
            other: []
        };

        allDocuments.forEach(doc => {
            switch (doc.documentType) {
                case DOCUMENT_TYPES.LABEL:
                case 'label_4x6':
                case 'label_avery_3x4':
                    documentsByType.labels.push(doc);
                    break;
                case DOCUMENT_TYPES.BOL:
                    documentsByType.bol.push(doc);
                    break;
                case DOCUMENT_TYPES.INVOICE:
                    documentsByType.invoices.push(doc);
                    break;
                default:
                    documentsByType.other.push(doc);
            }
        });

        return documentsByType;
    } catch (error) {
        console.error('Error organizing documents by type:', error);
        throw error;
    }
}

module.exports = {
    processCarrierDocuments,
    getShipmentDocuments,
    getDocumentsByType,
    DOCUMENT_TYPES,
    CARRIER_HANDLERS
}; 