const functions = require('firebase-functions/v2');
const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Import document manager
const { getDocumentsByType, getShipmentDocuments } = require('./shipment-documents/documentManager');

const logger = console;

/**
 * Cloud Function to retrieve shipment documents
 * @param {Object} request - Cloud Function request
 * @param {string} request.data.shipmentId - Shipment ID
 * @param {string} request.data.documentType - Optional document type filter
 * @param {boolean} request.data.organized - Whether to return documents organized by type
 * @returns {Object} Documents data
 */
exports.getShipmentDocuments = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
    region: 'us-central1'
}, async (request) => {
    try {
        // Validate authentication
        if (!request.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'User must be authenticated to access shipment documents.'
            );
        }

        // Extract request data
        const { shipmentId, documentType, organized = true } = request.data;

        // Validate required parameters
        if (!shipmentId) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'shipmentId is required.'
            );
        }

        logger.info(`Retrieving documents for shipment: ${shipmentId}`, {
            documentType,
            organized,
            userId: request.auth.uid
        });

        // Verify user has access to this shipment
        const db = admin.firestore();
        const shipmentRef = db.collection('shipments').doc(shipmentId);
        const shipmentDoc = await shipmentRef.get();

        if (!shipmentDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'Shipment not found.'
            );
        }

        let documents = {};

        // Fetch documents from unified structure (subcollection)
        const unifiedDocsRef = shipmentRef.collection('documents');
        const unifiedDocsSnapshot = await unifiedDocsRef.get();
        
        // Fetch specific document by shipment ID (unified ID structure)
        const unifiedMainDocRef = shipmentRef.collection('documents').doc(shipmentId);
        const unifiedMainDoc = await unifiedMainDocRef.get();
        
        // Fetch documents from legacy structure for backward compatibility
        const legacyDocsRef = db.collection('shipmentDocuments');
        const legacyDocsQuery = legacyDocsRef.where('shipmentId', '==', shipmentId);
        const legacyDocsSnapshot = await legacyDocsQuery.get();
        
        // Fetch specific document by shipment ID from legacy collection (unified ID structure)
        const legacyMainDocRef = db.collection('shipmentDocuments').doc(shipmentId);
        const legacyMainDoc = await legacyMainDocRef.get();

        // Process unified structure documents
        const unifiedDocs = [];
        
        // Add the main document (shipmentId as document ID) if it exists
        if (unifiedMainDoc.exists) {
            const docData = unifiedMainDoc.data();
            unifiedDocs.push({
                id: unifiedMainDoc.id,
                ...docData,
                source: 'unified-main' // Mark source for debugging
            });
        }
        
        // Add other documents from subcollection
        unifiedDocsSnapshot.forEach(doc => {
            // Skip if this is the main document we already added
            if (doc.id !== shipmentId) {
                const docData = doc.data();
                unifiedDocs.push({
                    id: doc.id,
                    ...docData,
                    source: 'unified-sub' // Mark source for debugging
                });
            }
        });

        // Process legacy structure documents
        const legacyDocs = [];
        
        // Add the main document (shipmentId as document ID) if it exists
        if (legacyMainDoc.exists) {
            const docData = legacyMainDoc.data();
            // Skip if this document was created with unified structure (has the flag)
            if (!docData._isUnifiedStructure) {
                legacyDocs.push({
                    id: legacyMainDoc.id,
                    ...docData,
                    source: 'legacy-main' // Mark source for debugging
                });
            }
        }
        
        // Add other documents from query
        legacyDocsSnapshot.forEach(doc => {
            const docData = doc.data();
            
            // Skip if this is the main document we already processed
            if (doc.id === shipmentId) {
                return;
            }
            
            // Skip if this document was created with unified structure (has the flag)
            if (docData._isUnifiedStructure) {
                return;
            }
            
            // Skip if this document already exists in unified structure
            const existsInUnified = unifiedDocs.some(unifiedDoc => 
                unifiedDoc.id === doc.id ||
                unifiedDoc.filename === docData.filename ||
                (unifiedDoc.metadata?.canparShipmentId && 
                 docData.metadata?.canparShipmentId &&
                 unifiedDoc.metadata.canparShipmentId === docData.metadata.canparShipmentId)
            );
            
            if (!existsInUnified) {
                legacyDocs.push({
                    id: doc.id,
                    ...docData,
                    source: 'legacy-query' // Mark source for debugging
                });
            }
        });

        // Combine both sources, prioritizing unified structure
        const allDocs = [...unifiedDocs, ...legacyDocs];

        if (organized) {
            // Enhanced organize documents by type with better label detection
            documents = {
                labels: allDocs.filter(doc => {
                    // Standard label identification
                    if (doc.docType === 2 || doc.documentType === 'label') {
                        return true;
                    }
                    
                    // Enhanced label detection for freight/eShipPlus shipments
                    const filename = (doc.filename || '').toLowerCase();
                    const carrier = (doc.carrier || '').toLowerCase();
                    
                    // Check for label-like filenames
                    if (filename.includes('label') || 
                        filename.includes('shipping') ||
                        filename.includes('ship-label') ||
                        filename.includes('freight-label')) {
                        return true;
                    }
                    
                    // Specific eShipPlus ProLabel detection (based on actual API response)
                    if (filename.includes('prolabel') || 
                        filename.includes('pro-label') ||
                        filename.includes('prolabel4x6') ||
                        filename.includes('prolabelavery') ||
                        filename.includes('4x6inch') ||
                        filename.includes('3x4inch')) {
                        return true;
                    }
                    
                    // Check for eShipPlus documents that should be treated as labels
                    if (carrier.includes('eshipplus') || carrier.includes('eship')) {
                        // eShipPlus often provides shipping labels with different naming
                        if (filename.includes('ship') || 
                            filename.includes('print') ||
                            doc.metadata?.eshipplus?.docType === 2 ||
                            doc.metadata?.documentCategory === 'shipping_label') {
                            return true;
                        }
                    }
                    
                    // Check document content type and metadata
                    if (doc.metadata?.documentType === 'shipping_label' ||
                        doc.metadata?.category === 'label' ||
                        doc.metadata?.type === 'label') {
                        return true;
                    }
                    
                    return false;
                }),
                bol: allDocs.filter(doc => {
                    if (doc.docType === 1 || doc.documentType === 'bol') {
                        return true;
                    }
                    
                    // Enhanced BOL detection
                    const filename = (doc.filename || '').toLowerCase();
                    if (filename.includes('bol') || 
                        filename.includes('bill-of-lading') ||
                        filename.includes('bill_of_lading') ||
                        filename.includes('billoflading') ||  // eShipPlus format
                        doc.metadata?.documentType === 'bill_of_lading') {
                        return true;
                    }
                    
                    return false;
                }).sort((a, b) => {
                    // Priority sorting: Generated BOLs first, then by creation date (newest first)
                    
                    // Priority 1: Generated BOLs (isGeneratedBOL flag)
                    const aIsGenerated = a.isGeneratedBOL === true || a.metadata?.eshipplus?.generated === true;
                    const bIsGenerated = b.isGeneratedBOL === true || b.metadata?.eshipplus?.generated === true;
                    
                    if (aIsGenerated && !bIsGenerated) return -1; // a comes first
                    if (!aIsGenerated && bIsGenerated) return 1;  // b comes first
                    
                    // Priority 2: BOLs that replace API BOLs
                    const aReplacesApi = a.replacesApiBOL === true || a.metadata?.eshipplus?.replacesApiBol === true;
                    const bReplacesApi = b.replacesApiBOL === true || b.metadata?.eshipplus?.replacesApiBol === true;
                    
                    if (aReplacesApi && !bReplacesApi) return -1;
                    if (!aReplacesApi && bReplacesApi) return 1;
                    
                    // Priority 3: BOLs with generated filename patterns
                    const aHasGeneratedFilename = (a.filename || '').includes('eshipplus-bol') || 
                                                 (a.filename || '').includes('polaris-bol');
                    const bHasGeneratedFilename = (b.filename || '').includes('eshipplus-bol') || 
                                                 (b.filename || '').includes('polaris-bol');
                    
                    if (aHasGeneratedFilename && !bHasGeneratedFilename) return -1;
                    if (!aHasGeneratedFilename && bHasGeneratedFilename) return 1;
                    
                    // Priority 4: Sort by creation date (newest first)
                    const aDate = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                    const bDate = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                    
                    return new Date(bDate) - new Date(aDate);
                }),
                invoice: allDocs.filter(doc => {
                    if (doc.docType === 3 || doc.documentType === 'invoice') {
                        return true;
                    }
                    
                    // Enhanced invoice detection
                    const filename = (doc.filename || '').toLowerCase();
                    if (filename.includes('invoice') || 
                        filename.includes('bill') ||
                        doc.metadata?.documentType === 'invoice') {
                        return true;
                    }
                    
                    return false;
                }),
                other: allDocs.filter(doc => {
                    // A document is "other" if it doesn't match any of the above categories
                    const filename = (doc.filename || '').toLowerCase();
                    const carrier = (doc.carrier || '').toLowerCase();
                    
                    // Check if it's a label
                    const isLabel = doc.docType === 2 || 
                                   doc.documentType === 'label' ||
                                   filename.includes('label') || 
                                   filename.includes('shipping') ||
                                   filename.includes('ship-label') ||
                                   filename.includes('freight-label') ||
                                   (carrier.includes('eshipplus') && (filename.includes('ship') || filename.includes('print'))) ||
                                   doc.metadata?.documentType === 'shipping_label' ||
                                   doc.metadata?.category === 'label';
                    
                    // Check if it's a BOL
                    const isBol = doc.docType === 1 || 
                                 doc.documentType === 'bol' ||
                                 filename.includes('bol') || 
                                 filename.includes('bill-of-lading') ||
                                 doc.metadata?.documentType === 'bill_of_lading';
                    
                    // Check if it's an invoice
                    const isInvoice = doc.docType === 3 || 
                                     doc.documentType === 'invoice' ||
                                     filename.includes('invoice') || 
                                     filename.includes('bill') ||
                                     doc.metadata?.documentType === 'invoice';
                    
                    // Return true if it's none of the above
                    return !isLabel && !isBol && !isInvoice;
                })
            };
        } else {
            // Apply document type filter if specified with enhanced detection
            if (documentType) {
                documents = allDocs.filter(doc => {
                    // Direct match
                    if (doc.documentType === documentType) {
                        return true;
                    }
                    
                    // Enhanced label detection
                    if (documentType === 'label') {
                        if (doc.docType === 2) return true;
                        
                        const filename = (doc.filename || '').toLowerCase();
                        const carrier = (doc.carrier || '').toLowerCase();
                        
                        // Check for label-like filenames
                        if (filename.includes('label') || 
                            filename.includes('shipping') ||
                            filename.includes('ship-label') ||
                            filename.includes('freight-label')) {
                            return true;
                        }
                        
                        // Specific eShipPlus ProLabel detection (based on actual API response)
                        if (filename.includes('prolabel') || 
                            filename.includes('pro-label') ||
                            filename.includes('prolabel4x6') ||
                            filename.includes('prolabelavery') ||
                            filename.includes('4x6inch') ||
                            filename.includes('3x4inch')) {
                            return true;
                        }
                        
                        // Check for eShipPlus documents that should be treated as labels
                        if (carrier.includes('eshipplus') || carrier.includes('eship')) {
                            if (filename.includes('ship') || 
                                filename.includes('print') ||
                                doc.metadata?.eshipplus?.docType === 2 ||
                                doc.metadata?.documentCategory === 'shipping_label') {
                                return true;
                            }
                        }
                        
                        // Check document metadata
                        if (doc.metadata?.documentType === 'shipping_label' ||
                            doc.metadata?.category === 'label' ||
                            doc.metadata?.type === 'label') {
                            return true;
                        }
                    }
                    
                    // Enhanced BOL detection
                    if (documentType === 'bol') {
                        if (doc.docType === 1) return true;
                        
                        const filename = (doc.filename || '').toLowerCase();
                        if (filename.includes('bol') || 
                            filename.includes('bill-of-lading') ||
                            filename.includes('bill_of_lading') ||
                            filename.includes('billoflading') ||  // eShipPlus format
                            doc.metadata?.documentType === 'bill_of_lading') {
                            return true;
                        }
                    }
                    
                    // Enhanced invoice detection
                    if (documentType === 'invoice') {
                        if (doc.docType === 3) return true;
                        
                        const filename = (doc.filename || '').toLowerCase();
                        if (filename.includes('invoice') || 
                            filename.includes('bill') ||
                            doc.metadata?.documentType === 'invoice') {
                            return true;
                        }
                    }
                    
                    return false;
                });
            } else {
                documents = allDocs;
            }
        }

        logger.info(`Successfully retrieved documents for shipment ${shipmentId}:`, {
            unifiedCount: unifiedDocs.length,
            legacyCount: legacyDocs.length,
            totalDocuments: allDocs.length,
            organized,
            documentIds: allDocs.map(doc => doc.id),
            unifiedMainDoc: unifiedMainDoc.exists,
            legacyMainDoc: legacyMainDoc.exists,
            // Enhanced logging for document categorization debugging
            documentDetails: allDocs.map(doc => ({
                id: doc.id,
                filename: doc.filename,
                docType: doc.docType,
                documentType: doc.documentType,
                carrier: doc.carrier,
                source: doc.source,
                metadata: doc.metadata
            })),
            categorizedCounts: organized ? {
                labels: documents.labels?.length || 0,
                bol: documents.bol?.length || 0,
                invoice: documents.invoice?.length || 0,
                other: documents.other?.length || 0
            } : { total: documents.length }
        });

        return {
            success: true,
            data: documents,
            shipmentId,
            organized,
            metadata: {
                unifiedDocuments: unifiedDocs.length,
                legacyDocuments: legacyDocs.length,
                totalDocuments: allDocs.length,
                documentIds: allDocs.map(doc => doc.id),
                sources: {
                    unified: unifiedDocs.map(doc => ({ id: doc.id, source: doc.source })),
                    legacy: legacyDocs.map(doc => ({ id: doc.id, source: doc.source }))
                },
                unifiedMainDoc: unifiedMainDoc.exists,
                legacyMainDoc: legacyMainDoc.exists
            }
        };

    } catch (error) {
        logger.error('Error in getShipmentDocuments:', error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        throw new functions.https.HttpsError(
            'internal',
            'An error occurred while retrieving shipment documents.',
            { originalError: error.message }
        );
    }
});

/**
 * Cloud Function to get a fresh download URL for a specific document
 * @param {Object} request - Cloud Function request
 * @param {string} request.data.documentId - Document ID
 * @param {string} request.data.shipmentId - Optional shipment ID (for unified structure)
 * @returns {Object} Fresh download URL
 */
exports.getDocumentDownloadUrl = onCall({
    cors: true,
    timeoutSeconds: 30,
    memory: "256MiB",
    region: 'us-central1'
}, async (request) => {
    try {
        // Validate authentication
        if (!request.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'User must be authenticated to access document URLs.'
            );
        }

        const { documentId, shipmentId } = request.data;

        if (!documentId) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'documentId is required.'
            );
        }

        logger.info(`Generating fresh download URL for document: ${documentId}`, {
            shipmentId,
            userId: request.auth.uid
        });

        const db = admin.firestore();
        let documentData = null;
        let foundInUnified = false;
        let documentPath = '';
        
        // For unified ID structure, the documentId should match the shipmentId
        const effectiveShipmentId = shipmentId || documentId;

        // Try unified structure first - check main document (shipmentId as document ID)
        if (effectiveShipmentId) {
            try {
                const unifiedDocRef = db.collection('shipments').doc(effectiveShipmentId)
                                        .collection('documents').doc(effectiveShipmentId);
                const unifiedDocSnapshot = await unifiedDocRef.get();
                
                if (unifiedDocSnapshot.exists) {
                    documentData = unifiedDocSnapshot.data();
                    foundInUnified = true;
                    documentPath = `shipments/${effectiveShipmentId}/documents/${effectiveShipmentId}`;
                    logger.info(`Document found in unified structure (main): ${documentPath}`);
                }
            } catch (error) {
                logger.warn(`Error checking unified structure for document ${documentId}:`, error.message);
            }
        }

        // Try unified structure - check specific document ID if different from shipment ID
        if (!documentData && shipmentId && documentId !== shipmentId) {
            try {
                const unifiedDocRef = db.collection('shipments').doc(shipmentId)
                                        .collection('documents').doc(documentId);
                const unifiedDocSnapshot = await unifiedDocRef.get();
                
                if (unifiedDocSnapshot.exists) {
                    documentData = unifiedDocSnapshot.data();
                    foundInUnified = true;
                    documentPath = `shipments/${shipmentId}/documents/${documentId}`;
                    logger.info(`Document found in unified structure (specific): ${documentPath}`);
                }
            } catch (error) {
                logger.warn(`Error checking unified structure for specific document ${documentId}:`, error.message);
            }
        }

        // Fallback to legacy structure - check main document (shipmentId as document ID)
        if (!documentData && effectiveShipmentId) {
            const legacyDocRef = db.collection('shipmentDocuments').doc(effectiveShipmentId);
            const legacyDocSnapshot = await legacyDocRef.get();

            if (legacyDocSnapshot.exists) {
                documentData = legacyDocSnapshot.data();
                documentPath = `shipmentDocuments/${effectiveShipmentId}`;
                logger.info(`Document found in legacy structure (main): ${documentPath}`);
            }
        }

        // Fallback to legacy structure - check specific document ID
        if (!documentData) {
            const legacyDocRef = db.collection('shipmentDocuments').doc(documentId);
            const legacyDocSnapshot = await legacyDocRef.get();

            if (legacyDocSnapshot.exists) {
                documentData = legacyDocSnapshot.data();
                documentPath = `shipmentDocuments/${documentId}`;
                logger.info(`Document found in legacy structure (specific): ${documentPath}`);
            }
        }

        // If still not found, try searching legacy collection by shipmentId
        if (!documentData && effectiveShipmentId) {
            const legacySearchQuery = db.collection('shipmentDocuments')
                                        .where('shipmentId', '==', effectiveShipmentId)
                                        .limit(10); // Limit to prevent large queries
            const legacySearchSnapshot = await legacySearchQuery.get();
            
            if (!legacySearchSnapshot.empty) {
                // Try to find the specific document by ID or filename
                const matchingDoc = legacySearchSnapshot.docs.find(doc => 
                    doc.id === documentId || 
                    doc.data().unifiedDocumentId === documentId ||
                    doc.data().filename?.includes(documentId)
                );
                
                if (matchingDoc) {
                    documentData = matchingDoc.data();
                    documentPath = `shipmentDocuments/${matchingDoc.id}`;
                    logger.info(`Document found by search: ${documentPath}`);
                }
            }
        }

        if (!documentData) {
            logger.error(`Document not found: ${documentId}`, {
                shipmentId,
                effectiveShipmentId,
                searchPaths: [
                    effectiveShipmentId ? `shipments/${effectiveShipmentId}/documents/${effectiveShipmentId}` : 'skipped',
                    shipmentId && documentId !== shipmentId ? `shipments/${shipmentId}/documents/${documentId}` : 'skipped',
                    effectiveShipmentId ? `shipmentDocuments/${effectiveShipmentId}` : 'skipped',
                    `shipmentDocuments/${documentId}`,
                    effectiveShipmentId ? `shipmentDocuments where shipmentId=${effectiveShipmentId}` : 'skipped'
                ]
            });
            throw new functions.https.HttpsError(
                'not-found',
                'Document not found.'
            );
        }

        // Verify user has access to this document's shipment
        const finalShipmentId = effectiveShipmentId || documentData.shipmentId;
        if (finalShipmentId) {
            const shipmentRef = db.collection('shipments').doc(finalShipmentId);
            const shipmentDoc = await shipmentRef.get();

            if (!shipmentDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Associated shipment not found.'
                );
            }
        }

        // Generate fresh signed URL
        const { getStorage } = require('firebase-admin/storage');
        const bucket = getStorage().bucket();
        const file = bucket.file(documentData.storagePath);

        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });

        logger.info(`Successfully generated download URL for document ${documentId}`, {
            shipmentId: finalShipmentId,
            foundInUnified,
            storagePath: documentData.storagePath,
            documentPath
        });

        return {
            success: true,
            downloadUrl: signedUrl,
            documentId,
            filename: documentData.filename,
            documentType: documentData.documentType,
            metadata: {
                foundInUnified,
                shipmentId: finalShipmentId,
                storagePath: documentData.storagePath,
                documentPath
            }
        };

    } catch (error) {
        logger.error('Error in getDocumentDownloadUrl:', error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        throw new functions.https.HttpsError(
            'internal',
            'An error occurred while generating document download URL.',
            { originalError: error.message }
        );
    }
}); 