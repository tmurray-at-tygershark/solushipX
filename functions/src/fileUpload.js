const {onCall} = require('firebase-functions/v2/https');
const {setGlobalOptions} = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const cors = require('cors')({ origin: true });
const { countPdfPages, getPdfMetadata } = require('./utils/pdfPageCounter');

// Set global options
setGlobalOptions({maxInstances: 10, timeoutSeconds: 300, memory: '512MiB'});

// Initialize services
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const storage = new Storage();
const bucket = storage.bucket('solushipx.firebasestorage.app');

// Upload file with base64 data to bypass CORS issues
const uploadFileBase64 = onCall(async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { fileName, fileData, fileType, fileSize } = request.data;
        
        if (!fileName || !fileData) {
            throw new Error('Missing required parameters: fileName and fileData');
        }

        console.log('Processing file upload:', { fileName, fileType, fileSize });

        // Validate file size (50MB limit)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (fileSize && fileSize > maxSize) {
            throw new Error('File size exceeds 50MB limit');
        }

        // Generate unique file path
        const timestamp = Date.now();
        const filePath = `uploads/${request.auth.uid}/${timestamp}_${fileName}`;
        
        // Convert base64 to buffer
        const fileBuffer = Buffer.from(fileData, 'base64');
        
        // Upload to Firebase Storage
        const file = bucket.file(filePath);
        
        await file.save(fileBuffer, {
            metadata: {
                contentType: fileType || 'application/octet-stream',
                metadata: {
                    uploadedBy: request.auth.uid,
                    uploadedAt: new Date().toISOString(),
                    originalName: fileName
                }
            }
        });

        // Make file publicly readable
        await file.makePublic();

        // Get public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

        console.log('File uploaded successfully:', publicUrl);

        return {
            success: true,
            downloadURL: publicUrl,
            filePath,
            fileName,
            uploadedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('File upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
    }
});



/**
 * Cloud function to generate signed upload URL for large files
 * This avoids timeout issues by letting client upload directly to Cloud Storage
 */
exports.uploadFile = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        const { fileName, fileType, fileSize } = request.data;
        
        if (!fileName || !fileType) {
            throw new Error('fileName and fileType are required');
        }

        // Generate unique file path
        const timestamp = Date.now();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `ap-processing/${timestamp}_${sanitizedFileName}`;

        // Generate signed URL for upload (expires in 15 minutes)
        const file = bucket.file(filePath);
        const [uploadUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            contentType: fileType,
        });

        // Generate download URL that will be available after upload
        const [downloadUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        console.log(`Generated upload URL for file: ${fileName}, size: ${fileSize} bytes`);

        return {
            success: true,
            uploadUrl,
            downloadURL: downloadUrl,
            filePath,
            message: 'Upload URL generated successfully'
        };

    } catch (error) {
        console.error('Error generating upload URL:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Alternative function for small files - direct base64 upload
 * Keep this for backward compatibility or small files
 */
exports.uploadFileBase64 = onCall({
    cors: true,
    timeoutSeconds: 120,
}, async (request) => {
    try {
        const { fileName, fileData, fileType, fileSize } = request.data;
        
        if (!fileName || !fileData || !fileType) {
            throw new Error('fileName, fileData, and fileType are required');
        }

        // Check file size limit (50MB)
        const maxSize = 50 * 1024 * 1024;
        if (fileSize > maxSize) {
            throw new Error('File size exceeds 50MB limit');
        }

        // Generate unique file path - use carrier-logos for carrier uploads
        const timestamp = Date.now();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const isCarrierLogo = fileName.toLowerCase().includes('carrier') || sanitizedFileName.includes('CARRIER');
        const filePath = isCarrierLogo ? `carrier-logos/${sanitizedFileName}` : `uploads/${timestamp}_${sanitizedFileName}`;

        // Convert base64 to buffer
        const buffer = Buffer.from(fileData, 'base64');

        // For PDF files, count pages and extract metadata
        let pdfMetadata = null;
        if (fileType === 'application/pdf') {
            console.log('PDF detected, counting pages...');
            try {
                pdfMetadata = await getPdfMetadata(buffer);
                console.log('PDF metadata extracted:', pdfMetadata);
            } catch (error) {
                console.error('Error extracting PDF metadata:', error);
                // Continue with upload even if page counting fails
                pdfMetadata = { pageCount: null, error: error.message };
            }
        }

        // Upload to Cloud Storage
        const file = bucket.file(filePath);
        await file.save(buffer, {
            metadata: {
                contentType: fileType,
                metadata: {
                    originalName: fileName,
                    uploadedAt: new Date().toISOString(),
                    fileSize: fileSize.toString(),
                    ...(pdfMetadata && {
                        pageCount: pdfMetadata.pageCount?.toString(),
                        pdfTitle: pdfMetadata.title,
                        pdfAuthor: pdfMetadata.author,
                        pdfCreator: pdfMetadata.creator,
                        pdfProducer: pdfMetadata.producer
                    })
                }
            }
        });

        // Make file publicly accessible
        await file.makePublic();

        // Get public URL
        const downloadURL = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

        console.log(`Uploaded file: ${fileName}, size: ${fileSize} bytes${pdfMetadata?.pageCount ? `, pages: ${pdfMetadata.pageCount}` : ''}`);

        return {
            success: true,
            downloadURL,
            filePath,
            message: 'File uploaded successfully',
            metadata: pdfMetadata ? {
                pageCount: pdfMetadata.pageCount,
                pdfInfo: {
                    title: pdfMetadata.title,
                    author: pdfMetadata.author,
                    creator: pdfMetadata.creator,
                    producer: pdfMetadata.producer
                }
            } : null
        };

    } catch (error) {
        console.error('Error uploading file:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Enhanced upload function for AP Processing with PDF page counting
 * This function is specifically designed for the AP Processing module
 */
exports.uploadAPFile = onCall({
    cors: true,
    timeoutSeconds: 120,
}, async (request) => {
    try {
        const { fileName, fileData, fileType, fileSize, carrier } = request.data;
        
        if (!fileName || !fileData || !fileType) {
            throw new Error('fileName, fileData, and fileType are required');
        }

        // Check file size limit (50MB)
        const maxSize = 50 * 1024 * 1024;
        if (fileSize > maxSize) {
            throw new Error('File size exceeds 50MB limit');
        }

        // Generate unique file path for AP processing
        const timestamp = Date.now();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `ap-processing/${timestamp}_${sanitizedFileName}`;

        // Convert base64 to buffer
        const buffer = Buffer.from(fileData, 'base64');

        // For PDF files, count pages and extract metadata
        let pdfMetadata = null;
        if (fileType === 'application/pdf') {
            console.log('PDF detected for AP Processing, counting pages...');
            try {
                pdfMetadata = await getPdfMetadata(buffer);
                console.log('PDF metadata extracted for AP:', pdfMetadata);
            } catch (error) {
                console.error('Error extracting PDF metadata:', error);
                // Continue with upload even if page counting fails
                pdfMetadata = { pageCount: null, error: error.message };
            }
        }

        // Upload to Cloud Storage
        const file = bucket.file(filePath);
        await file.save(buffer, {
            metadata: {
                contentType: fileType,
                metadata: {
                    originalName: fileName,
                    uploadedAt: new Date().toISOString(),
                    fileSize: fileSize.toString(),
                    carrier: carrier || 'unknown',
                    uploadType: 'ap-processing',
                    ...(pdfMetadata && {
                        pageCount: pdfMetadata.pageCount?.toString(),
                        pdfTitle: pdfMetadata.title,
                        pdfAuthor: pdfMetadata.author,
                        pdfCreator: pdfMetadata.creator,
                        pdfProducer: pdfMetadata.producer
                    })
                }
            }
        });

        // Make file publicly accessible
        await file.makePublic();

        // Get public URL
        const downloadURL = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

        // Create a record in the AP uploads collection with page count
        const uploadRecord = {
            fileName: fileName,
            fileSize: fileSize,
            fileType: fileType,
            filePath: filePath,
            downloadURL: downloadURL,
            carrier: carrier || 'unknown',
            processingStatus: 'uploaded',
            uploadDate: admin.firestore.FieldValue.serverTimestamp(),
            userId: request.auth?.uid || 'anonymous',
            type: fileType === 'application/pdf' ? 'pdf' : 'edi',
            recordCount: 0, // Will be updated after processing
            metadata: {
                fileSize: fileSize,
                ...(pdfMetadata && {
                    pageCount: pdfMetadata.pageCount,
                    pdfInfo: {
                        title: pdfMetadata.title,
                        author: pdfMetadata.author,
                        creator: pdfMetadata.creator,
                        producer: pdfMetadata.producer,
                        creationDate: pdfMetadata.creationDate,
                        modificationDate: pdfMetadata.modificationDate,
                        version: pdfMetadata.version
                    }
                })
            }
        };

        // Save to Firestore
        const docRef = await admin.firestore().collection('apUploads').add(uploadRecord);

        console.log(`AP file uploaded: ${fileName}, size: ${fileSize} bytes${pdfMetadata?.pageCount ? `, pages: ${pdfMetadata.pageCount}` : ''}, docId: ${docRef.id}`);

        return {
            success: true,
            downloadURL,
            filePath,
            docId: docRef.id,
            message: 'File uploaded successfully',
            pageCount: pdfMetadata?.pageCount || null,
            metadata: pdfMetadata ? {
                pageCount: pdfMetadata.pageCount,
                pdfInfo: {
                    title: pdfMetadata.title,
                    author: pdfMetadata.author,
                    creator: pdfMetadata.creator,
                    producer: pdfMetadata.producer
                }
            } : null
        };

    } catch (error) {
        console.error('Error uploading AP file:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// Functions are exported using exports.functionName above 