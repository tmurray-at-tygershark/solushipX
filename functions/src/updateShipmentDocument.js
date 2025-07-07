const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const db = getFirestore();

/**
 * Cloud Function to update shipment document metadata
 * Updates document properties like name, type, visibility, etc.
 */
exports.updateShipmentDocument = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { 
            shipmentId, 
            documentId, 
            updates,
            reason = 'Document updated'
        } = request.data;

        // Validate input
        if (!shipmentId) {
            throw new HttpsError('invalid-argument', 'Shipment ID is required');
        }

        if (!documentId) {
            throw new HttpsError('invalid-argument', 'Document ID is required');
        }

        if (!updates || typeof updates !== 'object') {
            throw new HttpsError('invalid-argument', 'Updates object is required');
        }

        // Verify user authentication
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const uid = request.auth.uid;
        console.log(`📝 Updating document ${documentId} for shipment ${shipmentId} by user ${uid}`);

        // Check if user has access to this shipment
        const shipmentDoc = await db.collection('shipments').doc(shipmentId).get();
        if (!shipmentDoc.exists) {
            throw new HttpsError('not-found', 'Shipment not found');
        }

        const shipmentData = shipmentDoc.data();

        // Get user data to check permissions
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            throw new HttpsError('permission-denied', 'User not found');
        }

        const userData = userDoc.data();
        const userRole = userData.role;
        const userCompanyId = userData.companyId;

        // Check access permissions
        const isAdmin = userRole === 'admin' || userRole === 'superadmin';
        const isOwner = shipmentData.companyId === userCompanyId;

        if (!isAdmin && !isOwner) {
            throw new HttpsError('permission-denied', 'Access denied to this shipment');
        }

        // Find the document in the shipment's documents
        const shipmentDocuments = shipmentData.documents || {};
        let documentFound = false;
        let documentCategory = null;
        let documentIndex = -1;
        let currentDocument = null;

        // Search through all document categories
        for (const [category, docs] of Object.entries(shipmentDocuments)) {
            if (Array.isArray(docs)) {
                const index = docs.findIndex(doc => 
                    doc.id === documentId || 
                    doc.filename === documentId ||
                    doc.name === documentId
                );
                
                if (index !== -1) {
                    documentFound = true;
                    documentCategory = category;
                    documentIndex = index;
                    currentDocument = docs[index];
                    break;
                }
            }
        }

        if (!documentFound) {
            throw new HttpsError('not-found', 'Document not found in shipment');
        }

        // Prepare allowed update fields (security measure)
        const allowedFields = [
            'filename',
            'name',
            'documentType',
            'description',
            'tags',
            'visibility',
            'metadata'
        ];

        const sanitizedUpdates = {};
        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key)) {
                sanitizedUpdates[key] = updates[key];
            }
        });

        // Add update metadata
        sanitizedUpdates.updatedAt = FieldValue.serverTimestamp();
        sanitizedUpdates.updatedBy = uid;
        sanitizedUpdates.updatedByEmail = userData.email || 'unknown@example.com';

        // Create updated document object
        const updatedDocument = {
            ...currentDocument,
            ...sanitizedUpdates
        };

        // Update the document in the shipment
        const updatedDocuments = { ...shipmentDocuments };
        updatedDocuments[documentCategory][documentIndex] = updatedDocument;

        // Update shipment with new document data
        await db.collection('shipments').doc(shipmentId).update({
            documents: updatedDocuments,
            updatedAt: FieldValue.serverTimestamp()
        });

        // Create audit log entry
        const auditEntry = {
            shipmentId: shipmentId,
            documentId: documentId,
            action: 'document_updated',
            userId: uid,
            userEmail: userData.email || 'unknown@example.com',
            timestamp: FieldValue.serverTimestamp(),
            changes: sanitizedUpdates,
            previousData: {
                filename: currentDocument.filename,
                documentType: currentDocument.documentType,
                description: currentDocument.description
            },
            reason: reason,
            metadata: {
                documentCategory: documentCategory,
                userRole: userRole,
                companyId: userCompanyId
            }
        };

        // Add audit log entry
        await db.collection('shipmentAuditLog').add(auditEntry);

        console.log(`✅ Document ${documentId} updated successfully for shipment ${shipmentId}`);

        return {
            success: true,
            documentId: documentId,
            updatedDocument: {
                ...updatedDocument,
                updatedAt: new Date().toISOString() // Convert for response
            },
            message: 'Document updated successfully'
        };

    } catch (error) {
        console.error('Error updating shipment document:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', 'Failed to update document: ' + error.message);
    }
}); 