const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Get carrier weight eligibility rules with filtering and pagination
 */
exports.getCarrierWeightRules = functions
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

            logger.info('🔍 Getting carrier weight eligibility rules', {
                userId: context.auth.uid,
                carrierId
            });

            // Build query
            let query = db.collection('carrierWeightRules');

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
                const collectionRef = db.collection('carrierWeightRules');
                const testSnapshot = await collectionRef.limit(1).get();
                
                if (testSnapshot.empty) {
                    logger.info('📭 Carrier weight rules collection is empty');
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

            logger.info('✅ Carrier weight rules retrieved', {
                totalCount,
                returnedCount: rules.length
            });

            return {
                success: true,
                rules
            };

        } catch (error) {
            logger.error('❌ Error getting carrier weight rules', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to get carrier weight rules',
                error.message
            );
        }
    });

/**
 * Create a new carrier weight eligibility rule
 */
exports.createCarrierWeightRule = functions
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
                minWeight,
                maxWeight,
                weightUnit,
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

            logger.info('🆕 Creating carrier weight rule', {
                userId: context.auth.uid,
                carrierId,
                restrictionType,
                weightUnit,
                minWeight,
                maxWeight
            });

            const ruleData = {
                carrierId: carrierId,
                restrictionType: restrictionType,
                minWeight: minWeight ? Number(minWeight) : null,
                maxWeight: maxWeight ? Number(maxWeight) : null,
                weightUnit: weightUnit || 'lbs',
                description: description || '',
                enabled: enabled !== false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('carrierWeightRules').add(ruleData);

            logger.info('✅ Carrier weight rule created', {
                ruleId: docRef.id,
                carrierId: carrierId
            });

            return {
                success: true,
                ruleId: docRef.id,
                message: 'Carrier weight rule created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating carrier weight rule', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create carrier weight rule',
                error.message
            );
        }
    });

/**
 * Update an existing carrier weight eligibility rule
 */
exports.updateCarrierWeightRule = functions
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
                weightUnit,
                minWeight,
                maxWeight,
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

            logger.info('📝 Updating carrier weight rule', {
                userId: context.auth.uid,
                ruleId,
                carrierId
            });

            const ruleRef = db.collection('carrierWeightRules').doc(ruleId);
            const ruleDoc = await ruleRef.get();

            if (!ruleDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Carrier weight rule not found'
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
                weightUnit: weightUnit,
                minWeight: Number(minWeight),
                maxWeight: maxWeight ? Number(maxWeight) : null,
                exclude: Boolean(exclude),
                notes: notes || '',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: context.auth.uid
            };

            await ruleRef.update(updateData);

            logger.info('✅ Carrier weight rule updated', {
                ruleId,
                carrierId
            });

            return {
                success: true,
                message: 'Carrier weight rule updated successfully'
            };

        } catch (error) {
            logger.error('❌ Error updating carrier weight rule', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to update carrier weight rule',
                error.message
            );
        }
    });

/**
 * Delete a carrier weight eligibility rule
 */
exports.deleteCarrierWeightRule = functions
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

            logger.info('🗑️ Deleting carrier weight rule', {
                userId: context.auth.uid,
                ruleId
            });

            const ruleRef = db.collection('carrierWeightRules').doc(ruleId);
            const ruleDoc = await ruleRef.get();

            if (!ruleDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Carrier weight rule not found'
                );
            }

            await ruleRef.delete();

            logger.info('✅ Carrier weight rule deleted', {
                ruleId
            });

            return {
                success: true,
                message: 'Carrier weight rule deleted successfully'
            };

        } catch (error) {
            logger.error('❌ Error deleting carrier weight rule', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to delete carrier weight rule',
                error.message
            );
        }
    });
