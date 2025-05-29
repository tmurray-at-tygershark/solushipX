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

        // TODO: Add additional authorization checks here if needed
        // For example, check if user has access to this specific shipment
        // based on company ID, user roles, etc.

        let documents;

        if (organized) {
            // Return documents organized by type (labels, bol, etc.)
            documents = await getDocumentsByType(shipmentId);
        } else {
            // Return raw list of documents
            documents = await getShipmentDocuments(shipmentId, documentType);
        }

        logger.info(`Successfully retrieved documents for shipment ${shipmentId}:`, {
            totalDocuments: Array.isArray(documents) ? documents.length : Object.keys(documents).length,
            organized
        });

        return {
            success: true,
            data: documents,
            shipmentId,
            organized
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

        const { documentId } = request.data;

        if (!documentId) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'documentId is required.'
            );
        }

        logger.info(`Generating fresh download URL for document: ${documentId}`, {
            userId: request.auth.uid
        });

        // Get document metadata
        const db = admin.firestore();
        const docRef = db.collection('shipmentDocuments').doc(documentId);
        const docSnapshot = await docRef.get();

        if (!docSnapshot.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'Document not found.'
            );
        }

        const documentData = docSnapshot.data();

        // Verify user has access to this document's shipment
        const shipmentRef = db.collection('shipments').doc(documentData.shipmentId);
        const shipmentDoc = await shipmentRef.get();

        if (!shipmentDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'Associated shipment not found.'
            );
        }

        // TODO: Add authorization checks for the shipment

        // Generate fresh signed URL
        const { getStorage } = require('firebase-admin/storage');
        const bucket = getStorage().bucket();
        const file = bucket.file(documentData.storagePath);

        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });

        logger.info(`Successfully generated download URL for document ${documentId}`);

        return {
            success: true,
            downloadUrl: signedUrl,
            documentId,
            filename: documentData.filename,
            documentType: documentData.documentType
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