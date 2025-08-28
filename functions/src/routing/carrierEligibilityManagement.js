const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Get carrier eligibility rules with filtering and pagination
 */
exports.getCarrierEligibilityRules = functions
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
                page = 1, 
                limit = 25, 
                filters = {}, 
                searchTerm = '', 
                carrierId,
                filterCompany,
                filterCustomer,
                filterService,
                filterStatus
            } = data;

            logger.info('🔍 Getting carrier eligibility rules', {
                userId: context.auth.uid,
                page,
                limit,
                filters,
                searchTerm,
                carrierId,
                filterCompany,
                filterCustomer,
                filterService,
                filterStatus
            });

            // Build query
            let query = db.collection('carrierEligibilityRules');

            // Apply carrier filter (from carrierId parameter or filters.carrier)
            const carrierFilter = carrierId || filters.carrier;
            if (carrierFilter && carrierFilter !== '') {
                query = query.where('carrierId', '==', carrierFilter);
            }

            // Apply other filters
            if (filterCompany && filterCompany !== '' && filterCompany !== 'ALL') {
                query = query.where('companyId', '==', filterCompany);
            }
            if (filterCustomer && filterCustomer !== '' && filterCustomer !== 'ALL') {
                query = query.where('customerId', '==', filterCustomer);
            }
            if (filterService && filterService !== '' && filterService !== 'ALL') {
                query = query.where('serviceCode', '==', filterService);
            }
            if (filters.company && filters.company !== '') {
                query = query.where('companyId', '==', filters.company);
            }
            if (filters.customer && filters.customer !== '') {
                query = query.where('customerId', '==', filters.customer);
            }
            if (filters.service && filters.service !== '') {
                query = query.where('serviceCode', '==', filters.service);
            }
            if (filters.carrier && filters.carrier !== '') {
                query = query.where('carrierId', '==', filters.carrier);
            }
            if (filters.fromCountry && filters.fromCountry !== '') {
                query = query.where('fromCountry', '==', filters.fromCountry);
            }
            if (filters.toCountry && filters.toCountry !== '') {
                query = query.where('toCountry', '==', filters.toCountry);
            }
            if (filters.exclude && filters.exclude !== 'all') {
                query = query.where('exclude', '==', filters.exclude === 'true');
            }

            let totalCount = 0;
            let rules = [];

            try {
                // Try to get collection info first
                const collectionRef = db.collection('carrierEligibilityRules');
                const testSnapshot = await collectionRef.limit(1).get();
                
                if (testSnapshot.empty) {
                    // Collection is empty or doesn't exist
                    logger.info('📭 Carrier eligibility rules collection is empty');
                    return {
                        success: true,
                        rules: [],
                        totalCount: 0,
                        page,
                        totalPages: 0,
                        hasNextPage: false,
                        hasPreviousPage: false
                    };
                }

                // Add ordering only if collection has documents
                query = query.orderBy('createdAt', 'desc');

                // Get total count for pagination
                const totalSnapshot = await query.get();
                totalCount = totalSnapshot.size;

                // Apply pagination
                const offset = (page - 1) * limit;
                query = query.offset(offset).limit(limit);

                const querySnapshot = await query.get();

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
                    carrierId: carrierFilter
                });
                
                // Return empty results instead of throwing error
                return {
                    success: true,
                    rules: [],
                    totalCount: 0,
                    page,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                };
            }

            // Apply search term filtering (client-side for now)
            let filteredRules = rules;
            if (searchTerm && searchTerm.trim() !== '') {
                const searchLower = searchTerm.toLowerCase();
                filteredRules = rules.filter(rule => 
                    rule.customer?.toLowerCase().includes(searchLower) ||
                    rule.business?.toLowerCase().includes(searchLower) ||
                    rule.carrier?.toLowerCase().includes(searchLower) ||
                    rule.service?.toLowerCase().includes(searchLower) ||
                    rule.fromCountry?.toLowerCase().includes(searchLower) ||
                    rule.fromState?.toLowerCase().includes(searchLower) ||
                    rule.toCountry?.toLowerCase().includes(searchLower) ||
                    rule.toState?.toLowerCase().includes(searchLower)
                );
            }

            logger.info('✅ Carrier eligibility rules retrieved', {
                totalCount,
                returnedCount: filteredRules.length,
                page,
                limit
            });

            return {
                success: true,
                rules: filteredRules,
                totalCount: searchTerm ? filteredRules.length : totalCount,
                page,
                limit
            };

        } catch (error) {
            logger.error('❌ Error getting carrier eligibility rules', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to get carrier eligibility rules',
                error.message
            );
        }
    });

/**
 * Create a new carrier eligibility rule
 */
exports.createCarrierEligibilityRule = functions
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
                companyId,
                companyName,
                customerId,
                customerName,
                carrierId,
                carrierName,
                serviceCode,
                serviceName,
                fromCountry,
                fromState,
                fromCity,
                fromZipPostal,
                toCountry,
                toState,
                toCity,
                toZipPostal,
                exclude
            } = data;

            // Validation
            if (!carrierId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier is required'
                );
            }
            if (!companyId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Company is required'
                );
            }

            logger.info('🆕 Creating carrier eligibility rule', {
                userId: context.auth.uid,
                carrierId,
                companyId,
                fromCountry,
                toCountry
            });

            const ruleData = {
                companyId: companyId || '',
                companyName: companyName || '',
                customerId: customerId || 'ALL',
                customerName: customerName || 'ALL',
                carrierId: carrierId || '',
                carrierName: carrierName || '',
                serviceCode: serviceCode || 'ANY',
                serviceName: serviceName || 'ANY',
                fromCountry: fromCountry || '',
                fromState: fromState || 'ANY',
                fromCity: fromCity || '',
                fromZipPostal: fromZipPostal || '',
                toCountry: toCountry || '',
                toState: toState || 'ANY',
                toCity: toCity || '',
                toZipPostal: toZipPostal || '',
                exclude: Boolean(exclude),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('carrierEligibilityRules').add(ruleData);

            logger.info('✅ Carrier eligibility rule created', {
                ruleId: docRef.id,
                carrierId: carrierId
            });

            return {
                success: true,
                ruleId: docRef.id,
                message: 'Carrier eligibility rule created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating carrier eligibility rule', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create carrier eligibility rule',
                error.message
            );
        }
    });

/**
 * Update an existing carrier eligibility rule
 */
exports.updateCarrierEligibilityRule = functions
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
                fromCountry,
                fromState,
                fromCity,
                fromZipPostal,
                toCountry,
                toState,
                toCity,
                toZipPostal,
            } = data;

            // Validation
            if (!ruleId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Rule ID is required'
                );
            }

            if (!carrierId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier is required'
                );
            }

            logger.info('📝 Updating carrier eligibility rule', {
                userId: context.auth.uid,
                ruleId,
                carrierId
            });

            const ruleRef = db.collection('carrierEligibilityRules').doc(ruleId);
            const ruleDoc = await ruleRef.get();

            if (!ruleDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Carrier eligibility rule not found'
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
                fromCountry: fromCountry || '',
                fromState: fromState || 'ANY',
                fromCity: fromCity || '',
                fromZipPostal: fromZipPostal || '',
                toCountry: toCountry || '',
                toState: toState || 'ANY',
                toCity: toCity || '',
                toZipPostal: toZipPostal || '',
                exclude: Boolean(data.exclude),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: context.auth.uid
            };

            await ruleRef.update(updateData);

            logger.info('✅ Carrier eligibility rule updated', {
                ruleId,
                carrierId
            });

            return {
                success: true,
                message: 'Carrier eligibility rule updated successfully'
            };

        } catch (error) {
            logger.error('❌ Error updating carrier eligibility rule', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to update carrier eligibility rule',
                error.message
            );
        }
    });

/**
 * Delete a carrier eligibility rule
 */
exports.deleteCarrierEligibilityRule = functions
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

            logger.info('🗑️ Deleting carrier eligibility rule', {
                userId: context.auth.uid,
                ruleId
            });

            const ruleRef = db.collection('carrierEligibilityRules').doc(ruleId);
            const ruleDoc = await ruleRef.get();

            if (!ruleDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Carrier eligibility rule not found'
                );
            }

            await ruleRef.delete();

            logger.info('✅ Carrier eligibility rule deleted', {
                ruleId
            });

            return {
                success: true,
                message: 'Carrier eligibility rule deleted successfully'
            };

        } catch (error) {
            logger.error('❌ Error deleting carrier eligibility rule', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to delete carrier eligibility rule',
                error.message
            );
        }
    });

/**
 * Get carriers for eligibility rules (reuse existing function or create simple version)
 */
exports.getCarriers = functions
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

            logger.info('📋 Getting carriers for eligibility rules', {
                userId: context.auth.uid
            });

            const carriersSnapshot = await db.collection('carriers')
                .where('enabled', '==', true)
                .orderBy('name', 'asc')
                .get();

            const carriers = [];
            carriersSnapshot.forEach(doc => {
                const data = doc.data();
                carriers.push({
                    id: doc.id,
                    name: data.name,
                    carrierID: data.carrierID,
                    type: data.type
                });
            });

            logger.info('✅ Carriers retrieved for eligibility rules', {
                count: carriers.length
            });

            return {
                success: true,
                carriers
            };

        } catch (error) {
            logger.error('❌ Error getting carriers', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to get carriers',
                error.message
            );
        }
    });
