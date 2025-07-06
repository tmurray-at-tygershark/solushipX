const { onCall } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const { v4: uuidv4 } = require('uuid');

// Set global options
setGlobalOptions({
    maxInstances: 10,
    timeoutSeconds: 120,
    memory: '512MiB',
    cors: true
});

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const bucket = getStorage().bucket();

// Allowed file types and their MIME types
const ALLOWED_FILE_TYPES = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif'
};

// Maximum file size (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Document type validation
const VALID_DOCUMENT_TYPES = [
    'bill_of_lading',
    'labels', 
    'commercial_invoice',
    'proof_of_pickup',
    'proof_of_delivery',
    'packing_list',
    'photos',
    'other'
];

/**
 * Upload a document for a shipment
 */
exports.uploadShipmentDocument = onCall(async (request) => {
    try {
        // Validate authentication
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { 
            shipmentId, 
            firebaseDocId, 
            fileName, 
            fileData, 
            fileType, 
            fileSize, 
            documentType = 'other',
            metadata = {}
        } = request.data;

        // Validate required parameters
        if (!shipmentId || !firebaseDocId || !fileName || !fileData) {
            throw new Error('Missing required parameters: shipmentId, firebaseDocId, fileName, fileData');
        }

        // Validate file type
        if (!ALLOWED_FILE_TYPES[fileType]) {
            throw new Error(`Unsupported file type: ${fileType}. Allowed types: ${Object.keys(ALLOWED_FILE_TYPES).join(', ')}`);
        }

        // Validate file size
        if (fileSize > MAX_FILE_SIZE) {
            throw new Error(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
        }

        // Validate document type
        if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
            throw new Error(`Invalid document type: ${documentType}. Valid types: ${VALID_DOCUMENT_TYPES.join(', ')}`);
        }

        // Verify shipment exists and user has access
        const shipmentRef = db.collection('shipments').doc(firebaseDocId);
        const shipmentDoc = await shipmentRef.get();
        
        if (!shipmentDoc.exists) {
            throw new Error('Shipment not found');
        }

        const shipmentData = shipmentDoc.data();
        
        // Check if user has access to this shipment (basic access control)
        const userRef = db.collection('users').doc(request.auth.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            throw new Error('User not found');
        }

        const userData = userDoc.data();
        const userRole = userData.role;
        
        // Allow access if user is admin/superadmin or if shipment belongs to their company
        const hasAccess = ['admin', 'superadmin'].includes(userRole) || 
                         shipmentData.companyID === userData.companyID;
        
        if (!hasAccess) {
            throw new Error('Access denied: You do not have permission to upload documents for this shipment');
        }

        // Generate unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileExtension = ALLOWED_FILE_TYPES[fileType];
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueFileName = `${timestamp}_${sanitizedFileName}`;
        
        // Create storage path
        const storagePath = `shipment-documents/${firebaseDocId}/${uniqueFileName}`;
        
        // Convert base64 to buffer
        const fileBuffer = Buffer.from(fileData, 'base64');
        
        // Validate actual file size matches reported size
        if (Math.abs(fileBuffer.length - fileSize) > 1024) { // Allow 1KB tolerance
            console.warn(`File size mismatch: reported ${fileSize}, actual ${fileBuffer.length}`);
        }

        // Upload file to Firebase Storage
        const file = bucket.file(storagePath);
        await file.save(fileBuffer, {
            metadata: {
                contentType: fileType,
                metadata: {
                    shipmentId: shipmentId,
                    documentType: documentType,
                    uploadedBy: request.auth.uid,
                    uploadedByEmail: request.auth.token.email || 'unknown',
                    uploadedAt: new Date().toISOString(),
                    originalFileName: fileName,
                    fileSize: fileBuffer.length.toString(),
                    ...metadata
                }
            }
        });

        // Generate signed URL for download (valid for 1 year)
        const [downloadUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
        });

        // Create document metadata for Firestore
        const documentMetadata = {
            shipmentId: shipmentId,
            firebaseDocId: firebaseDocId,
            documentType: documentType,
            filename: uniqueFileName,
            originalFileName: fileName,
            fileSize: fileBuffer.length,
            fileType: fileType,
            storagePath: storagePath,
            downloadUrl: downloadUrl,
            uploadedBy: request.auth.uid,
            uploadedByEmail: request.auth.token.email || 'unknown',
            uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            isUserUploaded: true,
            metadata: {
                ...metadata,
                userAgent: request.rawRequest?.headers?.['user-agent'] || 'unknown'
            }
        };

        // Save document metadata to Firestore
        const docRef = await db.collection('shipmentDocuments').add(documentMetadata);
        
        // Also add to the shipment's documents subcollection for unified structure
        await shipmentRef.collection('documents').doc(docRef.id).set({
            ...documentMetadata,
            id: docRef.id
        });

        // Update shipment's lastUpdated timestamp
        await shipmentRef.update({
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            hasUserUploadedDocuments: true
        });

        console.log(`Document uploaded successfully: ${uniqueFileName} for shipment ${shipmentId}`);

        return {
            success: true,
            documentId: docRef.id,
            downloadUrl: downloadUrl,
            storagePath: storagePath,
            filename: uniqueFileName,
            message: 'Document uploaded successfully'
        };

    } catch (error) {
        console.error('Error uploading shipment document:', error);
        
        return {
            success: false,
            error: error.message || 'Failed to upload document'
        };
    }
});

/**
 * Delete a shipment document (admin only)
 */
exports.deleteShipmentDocument = onCall(async (request) => {
    try {
        // Validate authentication
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { documentId, shipmentId } = request.data;

        if (!documentId || !shipmentId) {
            throw new Error('Missing required parameters: documentId, shipmentId');
        }

        // Check if user is admin
        const userRef = db.collection('users').doc(request.auth.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            throw new Error('User not found');
        }

        const userData = userDoc.data();
        const userRole = userData.role;
        
        if (!['admin', 'superadmin'].includes(userRole)) {
            throw new Error('Access denied: Admin privileges required');
        }

        // Get document metadata
        const docRef = db.collection('shipmentDocuments').doc(documentId);
        const docDoc = await docRef.get();
        
        if (!docDoc.exists) {
            throw new Error('Document not found');
        }

        const docData = docDoc.data();
        
        // Delete from Firebase Storage
        if (docData.storagePath) {
            try {
                const file = bucket.file(docData.storagePath);
                await file.delete();
            } catch (storageError) {
                console.warn('Failed to delete file from storage:', storageError.message);
                // Continue with metadata deletion even if storage deletion fails
            }
        }

        // Delete from Firestore
        await docRef.delete();
        
        // Also delete from shipment's documents subcollection
        const shipmentRef = db.collection('shipments').doc(docData.firebaseDocId);
        await shipmentRef.collection('documents').doc(documentId).delete();

        console.log(`Document deleted successfully: ${documentId}`);

        return {
            success: true,
            message: 'Document deleted successfully'
        };

    } catch (error) {
        console.error('Error deleting shipment document:', error);
        
        return {
            success: false,
            error: error.message || 'Failed to delete document'
        };
    }
});

/**
 * Get all documents for a shipment
 */
exports.getShipmentDocuments = onCall(async (request) => {
    try {
        // Validate authentication
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { shipmentId, firebaseDocId } = request.data;

        if (!shipmentId || !firebaseDocId) {
            throw new Error('Missing required parameters: shipmentId, firebaseDocId');
        }

        // Verify user has access to this shipment
        const userRef = db.collection('users').doc(request.auth.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            throw new Error('User not found');
        }

        const userData = userDoc.data();
        const userRole = userData.role;

        // Get shipment to verify access
        const shipmentRef = db.collection('shipments').doc(firebaseDocId);
        const shipmentDoc = await shipmentRef.get();
        
        if (!shipmentDoc.exists) {
            throw new Error('Shipment not found');
        }

        const shipmentData = shipmentDoc.data();
        
        // Check access
        const hasAccess = ['admin', 'superadmin'].includes(userRole) || 
                         shipmentData.companyID === userData.companyID;
        
        if (!hasAccess) {
            throw new Error('Access denied');
        }

        // Get documents from Firestore
        const documentsQuery = db.collection('shipmentDocuments')
            .where('shipmentId', '==', shipmentId)
            .orderBy('createdAt', 'desc');
        
        const documentsSnapshot = await documentsQuery.get();
        const documents = [];

        for (const doc of documentsSnapshot.docs) {
            const data = doc.data();
            
            // Refresh download URL if needed
            if (data.storagePath) {
                try {
                    const file = bucket.file(data.storagePath);
                    const [downloadUrl] = await file.getSignedUrl({
                        action: 'read',
                        expires: Date.now() + 60 * 60 * 1000 // 1 hour
                    });
                    
                    documents.push({
                        id: doc.id,
                        ...data,
                        downloadUrl: downloadUrl
                    });
                } catch (error) {
                    console.warn(`Failed to generate download URL for document ${doc.id}:`, error.message);
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

        return {
            success: true,
            documents: documents
        };

    } catch (error) {
        console.error('Error getting shipment documents:', error);
        
        return {
            success: false,
            error: error.message || 'Failed to get documents'
        };
    }
}); 