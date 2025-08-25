const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');

const db = admin.firestore();
const storage = getStorage();

/**
 * Delete an AP upload file and its associated data
 * Removes both the file from Cloud Storage and the document from Firestore
 */
exports.deleteAPUpload = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        // Authentication check
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { uploadId } = request.data || {};
        
        if (!uploadId || typeof uploadId !== 'string') {
            throw new Error('Valid uploadId is required');
        }

        console.log(`Starting deletion process for upload: ${uploadId}`);

        // Try to find the upload document in multiple collections
        let uploadRef = db.collection('apUploads').doc(uploadId);
        let uploadDoc = await uploadRef.get();
        let collectionName = 'apUploads';
        
        if (!uploadDoc.exists) {
            // Try pdfUploads collection
            uploadRef = db.collection('pdfUploads').doc(uploadId);
            uploadDoc = await uploadRef.get();
            collectionName = 'pdfUploads';
            
            if (!uploadDoc.exists) {
                // Try ediUploads collection
                uploadRef = db.collection('ediUploads').doc(uploadId);
                uploadDoc = await uploadRef.get();
                collectionName = 'ediUploads';
                
                if (!uploadDoc.exists) {
                    console.log(`Upload document not found in any collection: ${uploadId}`);
                    throw new Error('Upload document not found');
                }
            }
        }

        console.log(`Found upload document in ${collectionName}: ${uploadId}`);

        const uploadData = uploadDoc.data();
        const { filePath, fileName, downloadURL } = uploadData;

        console.log(`Found upload document: ${fileName}, filePath: ${filePath}`);

        // Delete the file from Cloud Storage if filePath exists
        if (filePath) {
            try {
                const bucket = storage.bucket();
                const file = bucket.file(filePath);
                
                // Check if file exists before attempting deletion
                const [exists] = await file.exists();
                if (exists) {
                    await file.delete();
                    console.log(`Successfully deleted file from storage: ${filePath}`);
                } else {
                    console.log(`File not found in storage (may have been already deleted): ${filePath}`);
                }
            } catch (storageError) {
                console.error('Error deleting file from storage:', storageError);
                // Don't throw error here - continue with Firestore deletion even if storage deletion fails
            }
        }

        // Delete related documents from other collections
        const batch = db.batch();

        // Delete from the found collection
        batch.delete(uploadRef);
        console.log(`Marked ${collectionName} document for deletion: ${uploadId}`);

        // Delete from pdfResults collection if it exists (using same uploadId)
        const pdfResultRef = db.collection('pdfResults').doc(uploadId);
        const pdfResultDoc = await pdfResultRef.get();
        if (pdfResultDoc.exists) {
            batch.delete(pdfResultRef);
            console.log(`Marked pdfResults document for deletion: ${uploadId}`);
        }

        // If we found the doc in apUploads or ediUploads, also check pdfUploads
        if (collectionName !== 'pdfUploads') {
            const pdfUploadRef = db.collection('pdfUploads').doc(uploadId);
            const pdfUploadDoc = await pdfUploadRef.get();
            if (pdfUploadDoc.exists) {
                batch.delete(pdfUploadRef);
                console.log(`Marked pdfUploads document for deletion: ${uploadId}`);
            }
        }

        // If we found the doc in pdfUploads or ediUploads, also check apUploads
        if (collectionName !== 'apUploads') {
            const apUploadRef = db.collection('apUploads').doc(uploadId);
            const apUploadDoc = await apUploadRef.get();
            if (apUploadDoc.exists) {
                batch.delete(apUploadRef);
                console.log(`Marked apUploads document for deletion: ${uploadId}`);
            }
        }

        // Execute the batch deletion
        await batch.commit();

        console.log(`Successfully deleted upload: ${uploadId} (${fileName})`);

        return {
            success: true,
            message: `Upload "${fileName}" has been successfully deleted`,
            deletedUploadId: uploadId,
            deletedFile: fileName,
            deletedStoragePath: filePath || null
        };

    } catch (error) {
        console.error('Error deleting AP upload:', error);
        
        // Return user-friendly error messages
        if (error.message === 'Upload document not found') {
            return {
                success: false,
                error: 'The upload file was not found or may have already been deleted'
            };
        }
        
        return {
            success: false,
            error: `Failed to delete upload: ${error.message}`
        };
    }
});
