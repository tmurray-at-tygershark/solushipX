const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const db = getFirestore();

/**
 * Cloud Function to get shipment audit log
 * Retrieves audit trail for shipment document changes and updates
 */
exports.getShipmentAuditLog = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { shipmentId, limit = 50, startAfter = null } = request.data;

        // Validate input
        if (!shipmentId) {
            throw new HttpsError('invalid-argument', 'Shipment ID is required');
        }

        // Verify user authentication
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const uid = request.auth.uid;
        console.log(`🔍 Getting audit log for shipment ${shipmentId} by user ${uid}`);

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

        // Build query for audit log
        let auditQuery = db.collection('shipmentAuditLog')
            .where('shipmentId', '==', shipmentId)
            .orderBy('timestamp', 'desc')
            .limit(limit);

        // Add pagination if startAfter is provided
        if (startAfter) {
            const startAfterDoc = await db.collection('shipmentAuditLog').doc(startAfter).get();
            if (startAfterDoc.exists) {
                auditQuery = auditQuery.startAfter(startAfterDoc);
            }
        }

        // Execute query
        const auditSnapshot = await auditQuery.get();
        
        const auditEntries = [];
        auditSnapshot.forEach(doc => {
            const data = doc.data();
            auditEntries.push({
                id: doc.id,
                ...data,
                timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : null
            });
        });

        // Get user details for audit entries
        const userIds = [...new Set(auditEntries.map(entry => entry.userId).filter(Boolean))];
        const userDetails = {};

        if (userIds.length > 0) {
            const userPromises = userIds.map(async (userId) => {
                try {
                    const userDoc = await db.collection('users').doc(userId).get();
                    if (userDoc.exists) {
                        const user = userDoc.data();
                        return {
                            userId,
                            email: user.email,
                            firstName: user.firstName,
                            lastName: user.lastName
                        };
                    }
                    return { userId, email: 'Unknown User' };
                } catch (error) {
                    console.warn(`Failed to get user details for ${userId}:`, error);
                    return { userId, email: 'Unknown User' };
                }
            });

            const users = await Promise.all(userPromises);
            users.forEach(user => {
                userDetails[user.userId] = user;
            });
        }

        // Enhance audit entries with user details
        const enhancedEntries = auditEntries.map(entry => ({
            ...entry,
            user: userDetails[entry.userId] || { email: 'Unknown User' }
        }));

        console.log(`✅ Retrieved ${enhancedEntries.length} audit log entries for shipment ${shipmentId}`);

        return {
            success: true,
            auditLog: enhancedEntries,
            hasMore: auditSnapshot.size === limit,
            lastDoc: auditSnapshot.size > 0 ? auditSnapshot.docs[auditSnapshot.size - 1].id : null
        };

    } catch (error) {
        console.error('Error getting shipment audit log:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', 'Failed to get audit log: ' + error.message);
    }
}); 