/**
 * Cloud Functions for Carrier Rate Card Management
 * Handles CRUD operations for carrier rate cards and DIM factors
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

/**
 * Create a new carrier rate card
 */
exports.createCarrierRateCard = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
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

            logger.info('🆕 Creating carrier rate card', {
                userId: context.auth.uid,
                carrierId: data.carrierId
            });

            // Validate required fields
            const requiredFields = ['carrierId', 'rateCardName', 'rateType'];
            for (const field of requiredFields) {
                if (!data[field]) {
                    throw new functions.https.HttpsError(
                        'invalid-argument',
                        `${field} is required`
                    );
                }
            }

            const db = admin.firestore();

            // Check if carrier exists
            const carrierDoc = await db.collection('quickshipCarriers').doc(data.carrierId).get();
            if (!carrierDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Carrier not found'
                );
            }

            const carrierData = carrierDoc.data();

            // Prepare rate card data
            const rateCardData = {
                carrierId: data.carrierId,
                carrierName: carrierData.name,
                rateCardName: data.rateCardName,
                rateType: data.rateType,
                enabled: data.enabled !== false,
                currency: data.currency || 'CAD',
                
                // Rate configuration based on type
                skidRates: data.skidRates || [],
                weightBreaks: data.weightBreaks || [],
                zones: data.zones || [],
                flatRate: data.flatRate || null,
                
                // Metadata
                effectiveDate: data.effectiveDate || admin.firestore.FieldValue.serverTimestamp(),
                expirationDate: data.expirationDate || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid
            };

            // Create the rate card
            const rateCardRef = await db.collection('carrierRateCards').add(rateCardData);

            logger.info('✅ Carrier rate card created', {
                rateCardId: rateCardRef.id,
                carrierId: data.carrierId
            });

            return {
                success: true,
                rateCardId: rateCardRef.id,
                message: 'Rate card created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating carrier rate card', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create rate card',
                error.message
            );
        }
    });

/**
 * Update an existing carrier rate card
 */
exports.updateCarrierRateCard = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
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

            if (!data.rateCardId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Rate card ID is required'
                );
            }

            logger.info('🔄 Updating carrier rate card', {
                userId: context.auth.uid,
                rateCardId: data.rateCardId
            });

            const db = admin.firestore();

            // Check if rate card exists
            const rateCardRef = db.collection('carrierRateCards').doc(data.rateCardId);
            const rateCardDoc = await rateCardRef.get();
            
            if (!rateCardDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Rate card not found'
                );
            }

            // Prepare update data
            const updateData = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: context.auth.uid
            };

            // Update allowed fields
            const allowedFields = [
                'rateCardName', 'rateType', 'enabled', 'currency',
                'skidRates', 'weightBreaks', 'zones', 'flatRate',
                'effectiveDate', 'expirationDate'
            ];

            allowedFields.forEach(field => {
                if (data.hasOwnProperty(field)) {
                    updateData[field] = data[field];
                }
            });

            // Update the rate card
            await rateCardRef.update(updateData);

            logger.info('✅ Carrier rate card updated', {
                rateCardId: data.rateCardId
            });

            return {
                success: true,
                message: 'Rate card updated successfully'
            };

        } catch (error) {
            logger.error('❌ Error updating carrier rate card', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to update rate card',
                error.message
            );
        }
    });

/**
 * Delete a carrier rate card
 */
exports.deleteCarrierRateCard = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
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

            if (!data.rateCardId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Rate card ID is required'
                );
            }

            logger.info('🗑️ Deleting carrier rate card', {
                userId: context.auth.uid,
                rateCardId: data.rateCardId
            });

            const db = admin.firestore();

            // Check if rate card exists
            const rateCardRef = db.collection('carrierRateCards').doc(data.rateCardId);
            const rateCardDoc = await rateCardRef.get();
            
            if (!rateCardDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Rate card not found'
                );
            }

            // Delete the rate card
            await rateCardRef.delete();

            logger.info('✅ Carrier rate card deleted', {
                rateCardId: data.rateCardId
            });

            return {
                success: true,
                message: 'Rate card deleted successfully'
            };

        } catch (error) {
            logger.error('❌ Error deleting carrier rate card', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to delete rate card',
                error.message
            );
        }
    });

/**
 * Get carrier rate cards
 */
exports.getCarrierRateCards = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
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

            logger.info('📋 Getting carrier rate cards', {
                userId: context.auth.uid,
                carrierId: data.carrierId
            });

            const db = admin.firestore();
            let query = db.collection('carrierRateCards');

            // Filter by carrier if specified
            if (data.carrierId) {
                query = query.where('carrierId', '==', data.carrierId);
            }

            // Filter by enabled status if specified
            if (data.enabledOnly) {
                query = query.where('enabled', '==', true);
            }

            // Order by creation date (only if no filters to avoid index issues)
            if (!data.carrierId) {
                query = query.orderBy('createdAt', 'desc');
            }

            const querySnapshot = await query.get();
            const rateCards = [];

            querySnapshot.forEach(doc => {
                const data = doc.data();
                rateCards.push({
                    id: doc.id,
                    ...data,
                    // Convert Firestore timestamps to ISO strings for frontend
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
                    effectiveDate: data.effectiveDate?.toDate?.()?.toISOString() || data.effectiveDate,
                    expirationDate: data.expirationDate?.toDate?.()?.toISOString() || data.expirationDate
                });
            });

            // Sort by creation date if we couldn't do it in the query
            if (data.carrierId) {
                rateCards.sort((a, b) => {
                    const dateA = new Date(a.createdAt);
                    const dateB = new Date(b.createdAt);
                    return dateB - dateA; // Descending order
                });
            }

            logger.info('✅ Retrieved carrier rate cards', {
                count: rateCards.length,
                carrierId: data.carrierId
            });

            return {
                success: true,
                rateCards
            };

        } catch (error) {
            logger.error('❌ Error getting carrier rate cards', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to get rate cards',
                error.message
            );
        }
    });

/**
 * Create or update DIM factor
 */
exports.manageDIMFactor = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
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

            logger.info('📏 Managing DIM factor', {
                userId: context.auth.uid,
                carrierId: data.carrierId,
                action: data.action || 'create'
            });

            // Validate required fields
            const requiredFields = ['carrierId', 'dimFactor', 'unit'];
            for (const field of requiredFields) {
                if (!data[field]) {
                    throw new functions.https.HttpsError(
                        'invalid-argument',
                        `${field} is required`
                    );
                }
            }

            const db = admin.firestore();

            // Prepare DIM factor data
            const dimFactorData = {
                carrierId: data.carrierId,
                carrierName: data.carrierName || '',
                serviceType: data.serviceType || 'All',
                zone: data.zone || 'All',
                dimFactor: parseFloat(data.dimFactor),
                unit: data.unit,
                effectiveDate: data.effectiveDate || admin.firestore.FieldValue.serverTimestamp(),
                expirationDate: data.expirationDate || null,
                enabled: data.enabled !== false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: context.auth.uid
            };

            let result;
            if (data.dimFactorId) {
                // Update existing DIM factor
                const dimFactorRef = db.collection('dimFactors').doc(data.dimFactorId);
                await dimFactorRef.update(dimFactorData);
                result = { success: true, dimFactorId: data.dimFactorId, action: 'updated' };
            } else {
                // Create new DIM factor
                dimFactorData.createdAt = admin.firestore.FieldValue.serverTimestamp();
                dimFactorData.createdBy = context.auth.uid;
                
                const dimFactorRef = await db.collection('dimFactors').add(dimFactorData);
                result = { success: true, dimFactorId: dimFactorRef.id, action: 'created' };
            }

            logger.info('✅ DIM factor managed successfully', result);
            return result;

        } catch (error) {
            logger.error('❌ Error managing DIM factor', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to manage DIM factor',
                error.message
            );
        }
    });
