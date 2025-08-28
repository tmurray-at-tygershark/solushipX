const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Get carrier dimension eligibility rules with filtering and pagination
 */
exports.getCarrierDimensionRules = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
        cors: true
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            // Validate user role
            const userDoc = await admin.firestore()
                .collection('users')
                .doc(context.auth.uid)
                .get();

            const userData = userDoc.data();
            if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Insufficient permissions'
                );
            }

            const { carrierId } = data;

            logger.info('🔍 Getting carrier dimension eligibility rules', {
                userId: context.auth.uid,
                carrierId
            });

            // Build query
            let query = db.collection('carrierDimensionRules');

            // Apply carrier filter
            if (!carrierId || carrierId === '') {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID is required'
                );
            }
            
            query = query.where('carrierId', '==', carrierId);

            let totalCount = 0;
            let rules = [];

            try {
                // Check if collection exists
                const collectionRef = db.collection('carrierDimensionRules');
                const testSnapshot = await collectionRef.limit(1).get();
                
                if (testSnapshot.empty) {
                    logger.info('📭 Carrier dimension rules collection is empty');
                    return {
                        success: true,
                        rules: [],
                        totalCount: 0,
                        page,
                        totalPages: 0
                    };
                }

                // Add ordering
                query = query.orderBy('createdAt', 'desc');

                const querySnapshot = await query.get();
                totalCount = querySnapshot.size;

                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    rules.push({
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
                    });
                });

            } catch (firestoreError) {
                logger.warn('⚠️ Firestore query error, returning empty results', {
                    error: firestoreError.message,
                    carrierId
                });
                
                return {
                    success: true,
                    rules: [],
                    totalCount: 0
                };
            }

            logger.info('✅ Carrier dimension rules retrieved', {
                totalCount,
                returnedCount: rules.length
            });

            return {
                success: true,
                rules
            };

        } catch (error) {
            logger.error('❌ Error getting carrier dimension rules', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to get carrier dimension rules',
                error.message
            );
        }
    });

/**
 * Create a new carrier dimension eligibility rule
 */
exports.createCarrierDimensionRule = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
        cors: true
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            // Validate user role
            const userDoc = await admin.firestore()
                .collection('users')
                .doc(context.auth.uid)
                .get();

            const userData = userDoc.data();
            if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Insufficient permissions'
                );
            }

            const {
                carrierId,
                restrictionType,
                maxLength,
                maxWidth,
                maxHeight,
                dimensionUnit,
                description,
                enabled
            } = data;

            // Validation
            if (!carrierId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID is required'
                );
            }
            if (!restrictionType) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Restriction type is required'
                );
            }

            logger.info('🆕 Creating carrier dimension rule', {
                userId: context.auth.uid,
                carrierId,
                restrictionType,
                dimensionUnit,
                maxLength,
                maxWidth,
                maxHeight
            });

            const ruleData = {
                carrierId: carrierId,
                restrictionType: restrictionType,
                maxLength: maxLength ? Number(maxLength) : null,
                maxWidth: maxWidth ? Number(maxWidth) : null,
                maxHeight: maxHeight ? Number(maxHeight) : null,
                dimensionUnit: dimensionUnit || 'in',
                description: description || '',
                enabled: enabled !== false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('carrierDimensionRules').add(ruleData);

            logger.info('✅ Carrier dimension rule created', {
                ruleId: docRef.id,
                carrierId: carrierId
            });

            return {
                success: true,
                ruleId: docRef.id,
                message: 'Carrier dimension rule created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating carrier dimension rule', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create carrier dimension rule',
                error.message
            );
        }
    });

/**
 * Update an existing carrier dimension eligibility rule
 */
exports.updateCarrierDimensionRule = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
        cors: true
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            // Validate user role
            const userDoc = await admin.firestore()
                .collection('users')
                .doc(context.auth.uid)
                .get();

            const userData = userDoc.data();
            if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Insufficient permissions'
                );
            }

            const {
                ruleId,
                companyId,
                companyName,
                customerId,
                customerName,
                carrierId,
                carrierName,
                serviceCode,
                serviceName,
                dimensionUnit,
                maxLength,
                maxWidth,
                maxHeight,
                maxGirth,
                exclude,
                notes
            } = data;

            // Validation
            if (!ruleId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Rule ID is required'
                );
            }

            logger.info('📝 Updating carrier dimension rule', {
                userId: context.auth.uid,
                ruleId,
                carrierId
            });

            const ruleRef = db.collection('carrierDimensionRules').doc(ruleId);
            const ruleDoc = await ruleRef.get();

            if (!ruleDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Carrier dimension rule not found'
                );
            }

            const updateData = {
                companyId: companyId || '',
                companyName: companyName || '',
                customerId: customerId || 'ALL',
                customerName: customerName || 'ALL',
                carrierId: carrierId || '',
                carrierName: carrierName || '',
                serviceCode: serviceCode || 'ANY',
                serviceName: serviceName || 'ANY',
                dimensionUnit: dimensionUnit,
                maxLength: maxLength ? Number(maxLength) : null,
                maxWidth: maxWidth ? Number(maxWidth) : null,
                maxHeight: maxHeight ? Number(maxHeight) : null,
                maxGirth: maxGirth ? Number(maxGirth) : null,
                exclude: Boolean(exclude),
                notes: notes || '',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: context.auth.uid
            };

            await ruleRef.update(updateData);

            logger.info('✅ Carrier dimension rule updated', {
                ruleId,
                carrierId
            });

            return {
                success: true,
                message: 'Carrier dimension rule updated successfully'
            };

        } catch (error) {
            logger.error('❌ Error updating carrier dimension rule', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to update carrier dimension rule',
                error.message
            );
        }
    });

/**
 * Delete a carrier dimension eligibility rule
 */
exports.deleteCarrierDimensionRule = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
        cors: true
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            // Validate user role
            const userDoc = await admin.firestore()
                .collection('users')
                .doc(context.auth.uid)
                .get();

            const userData = userDoc.data();
            if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Insufficient permissions'
                );
            }

            const { ruleId } = data;

            if (!ruleId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Rule ID is required'
                );
            }

            logger.info('🗑️ Deleting carrier dimension rule', {
                userId: context.auth.uid,
                ruleId
            });

            const ruleRef = db.collection('carrierDimensionRules').doc(ruleId);
            const ruleDoc = await ruleRef.get();

            if (!ruleDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Carrier dimension rule not found'
                );
            }

            await ruleRef.delete();

            logger.info('✅ Carrier dimension rule deleted', {
                ruleId
            });

            return {
                success: true,
                message: 'Carrier dimension rule deleted successfully'
            };

        } catch (error) {
            logger.error('❌ Error deleting carrier dimension rule', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to delete carrier dimension rule',
                error.message
            );
        }
    });
