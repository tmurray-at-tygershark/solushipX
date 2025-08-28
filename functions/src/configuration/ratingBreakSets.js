/**
 * Rating Break Sets Management
 * Supports weight, linear feet (LF), and skid/pallet pricing
 * Implements reusable break ladders across carriers
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

/**
 * Get all rating break sets
 */
exports.getRatingBreakSets = functions
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

            logger.info('⚖️ Loading rating break sets', {
                userId: context.auth.uid
            });

            const db = admin.firestore();
            const breakSetsSnapshot = await db.collection('ratingBreakSets').get();

            const breakSets = [];
            breakSetsSnapshot.forEach(doc => {
                breakSets.push({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
                    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null
                });
            });

            // Sort by metric, then name
            breakSets.sort((a, b) => {
                if (a.metric !== b.metric) return a.metric.localeCompare(b.metric);
                return a.name.localeCompare(b.name);
            });

            logger.info('✅ Rating break sets loaded successfully', {
                totalBreakSets: breakSets.length
            });

            return {
                success: true,
                breakSets
            };

        } catch (error) {
            logger.error('❌ Error loading rating break sets', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to load rating break sets',
                error.message
            );
        }
    });

/**
 * Create a new rating break set
 */
exports.createRatingBreakSet = functions
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

            // Validate required fields
            if (!data.name || !data.metric || !data.unit || !data.method) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Name, metric, unit, and method are required'
                );
            }

            logger.info('⚖️ Creating rating break set', {
                userId: context.auth.uid,
                breakSetData: data
            });

            const db = admin.firestore();

            // Create break set data
            const breakSetData = {
                name: data.name.trim(), // e.g., "LTL-NA-Std v1", "LF v1 (per-LF extend)"
                metric: data.metric.trim().toLowerCase(), // 'weight', 'lf', 'skid'
                unit: data.unit.trim().toLowerCase(), // 'lb', 'kg', 'cwt', 'lf', 'skid'
                method: data.method.trim().toLowerCase(), // 'step', 'extend'
                description: data.description?.trim() || '',
                meta: data.meta || {}, // rounding rules, min increments, etc.
                enabled: data.enabled !== false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid
            };

            // Validate metric/unit combinations
            const validCombinations = {
                'weight': ['lb', 'kg', 'cwt'],
                'lf': ['lf'],
                'skid': ['skid']
            };

            if (!validCombinations[breakSetData.metric]?.includes(breakSetData.unit)) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    `Invalid unit "${breakSetData.unit}" for metric "${breakSetData.metric}"`
                );
            }

            // Validate method
            if (!['step', 'extend'].includes(breakSetData.method)) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Method must be either "step" or "extend"'
                );
            }

            // Check for duplicates
            const duplicateQuery = await db.collection('ratingBreakSets')
                .where('name', '==', breakSetData.name)
                .get();

            if (!duplicateQuery.empty) {
                throw new functions.https.HttpsError(
                    'already-exists',
                    'A rating break set with this name already exists'
                );
            }

            // Create the break set
            const breakSetRef = await db.collection('ratingBreakSets').add(breakSetData);

            logger.info('✅ Rating break set created successfully', {
                breakSetId: breakSetRef.id,
                breakSetName: breakSetData.name
            });

            return {
                success: true,
                breakSetId: breakSetRef.id,
                message: 'Rating break set created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating rating break set', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create rating break set',
                error.message
            );
        }
    });

/**
 * Get rating breaks for a specific break set
 */
exports.getRatingBreaks = functions
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

            if (!data.breakSetId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Break set ID is required'
                );
            }

            logger.info('⚖️ Loading rating breaks', {
                userId: context.auth.uid,
                breakSetId: data.breakSetId
            });

            const db = admin.firestore();
            const breaksSnapshot = await db.collection('ratingBreaks')
                .where('breakSetId', '==', data.breakSetId)
                .orderBy('seq')
                .get();

            const breaks = [];
            breaksSnapshot.forEach(doc => {
                breaks.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            logger.info('✅ Rating breaks loaded successfully', {
                totalBreaks: breaks.length,
                breakSetId: data.breakSetId
            });

            return {
                success: true,
                breaks,
                breakSetId: data.breakSetId
            };

        } catch (error) {
            logger.error('❌ Error loading rating breaks', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to load rating breaks',
                error.message
            );
        }
    });

/**
 * Create rating breaks for a break set
 */
exports.createRatingBreaks = functions
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

            if (!data.breakSetId || !data.breaks || !Array.isArray(data.breaks)) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Break set ID and breaks array are required'
                );
            }

            logger.info('⚖️ Creating rating breaks', {
                userId: context.auth.uid,
                breakSetId: data.breakSetId,
                breakCount: data.breaks.length
            });

            const db = admin.firestore();

            // Verify break set exists
            const breakSetDoc = await db.collection('ratingBreakSets').doc(data.breakSetId).get();
            if (!breakSetDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Break set not found'
                );
            }

            // Validate and sort breaks
            const sortedBreaks = data.breaks
                .map((breakData, index) => {
                    if (typeof breakData.minMetric !== 'number') {
                        throw new functions.https.HttpsError(
                            'invalid-argument',
                            `Break ${index + 1}: minMetric must be a number`
                        );
                    }

                    return {
                        breakSetId: data.breakSetId,
                        minMetric: breakData.minMetric,
                        maxMetric: breakData.maxMetric || null,
                        seq: index + 1,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        createdBy: context.auth.uid
                    };
                })
                .sort((a, b) => a.minMetric - b.minMetric)
                .map((breakData, index) => ({ ...breakData, seq: index + 1 }));

            // Validate no overlapping ranges for 'step' method
            const breakSet = breakSetDoc.data();
            if (breakSet.method === 'step') {
                for (let i = 0; i < sortedBreaks.length - 1; i++) {
                    const current = sortedBreaks[i];
                    const next = sortedBreaks[i + 1];
                    
                    if (current.maxMetric && current.maxMetric > next.minMetric) {
                        throw new functions.https.HttpsError(
                            'invalid-argument',
                            'Overlapping break ranges detected'
                        );
                    }
                }
            }

            // Delete existing breaks for this set
            const existingBreaksQuery = await db.collection('ratingBreaks')
                .where('breakSetId', '==', data.breakSetId)
                .get();

            const batch = db.batch();

            // Delete existing breaks
            existingBreaksQuery.forEach(doc => {
                batch.delete(doc.ref);
            });

            // Create new breaks
            sortedBreaks.forEach(breakData => {
                const breakRef = db.collection('ratingBreaks').doc();
                batch.set(breakRef, breakData);
            });

            await batch.commit();

            logger.info('✅ Rating breaks created successfully', {
                breakSetId: data.breakSetId,
                breakCount: sortedBreaks.length
            });

            return {
                success: true,
                breakSetId: data.breakSetId,
                breakCount: sortedBreaks.length,
                message: 'Rating breaks created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating rating breaks', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create rating breaks',
                error.message
            );
        }
    });

/**
 * Calculate rating for given metric value using break set
 * This is the core rating engine function
 */
exports.calculateRating = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
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

            if (!data.breakSetId || typeof data.metricValue !== 'number' || !data.rateMatrix) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Break set ID, metric value, and rate matrix are required'
                );
            }

            logger.info('💰 Calculating rating', {
                userId: context.auth.uid,
                breakSetId: data.breakSetId,
                metricValue: data.metricValue
            });

            const db = admin.firestore();

            // Get break set
            const breakSetDoc = await db.collection('ratingBreakSets').doc(data.breakSetId).get();
            if (!breakSetDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Break set not found'
                );
            }

            const breakSet = breakSetDoc.data();

            // Get breaks for this set
            const breaksSnapshot = await db.collection('ratingBreaks')
                .where('breakSetId', '==', data.breakSetId)
                .orderBy('seq')
                .get();

            if (breaksSnapshot.empty) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'No breaks found for this break set'
                );
            }

            const breaks = [];
            breaksSnapshot.forEach(doc => {
                breaks.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Calculate candidates
            const candidates = [];
            const rateMatrix = data.rateMatrix; // { breakId: { rateValue: number, minCharge?: number } }

            for (const breakData of breaks) {
                const rateInfo = rateMatrix[breakData.id];
                if (!rateInfo || typeof rateInfo.rateValue !== 'number') {
                    continue; // Skip if no rate defined for this break
                }

                let rawLinehaul = null;

                if (breakSet.method === 'extend') {
                    // Extend method: use max(metricValue, minMetric) * rateValue
                    const units = Math.max(data.metricValue, breakData.minMetric);
                    rawLinehaul = units * rateInfo.rateValue;
                } else if (breakSet.method === 'step') {
                    // Step method: use only if metricValue >= minMetric and < maxMetric
                    const isInRange = data.metricValue >= breakData.minMetric &&
                        (breakData.maxMetric === null || data.metricValue < breakData.maxMetric);
                    
                    if (isInRange) {
                        rawLinehaul = data.metricValue * rateInfo.rateValue;
                    }
                }

                if (rawLinehaul !== null) {
                    const linehaul = Math.max(rawLinehaul, rateInfo.minCharge || 0);
                    candidates.push({
                        breakId: breakData.id,
                        minMetric: breakData.minMetric,
                        maxMetric: breakData.maxMetric,
                        units: breakSet.method === 'extend' ? Math.max(data.metricValue, breakData.minMetric) : data.metricValue,
                        rateValue: rateInfo.rateValue,
                        rawLinehaul,
                        minCharge: rateInfo.minCharge || 0,
                        linehaul
                    });
                }
            }

            if (candidates.length === 0) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'No applicable rate found for the given metric value'
                );
            }

            // Select the best candidate (lowest total)
            const bestCandidate = candidates.reduce((best, current) => 
                (best === null || current.linehaul < best.linehaul) ? current : best
            );

            logger.info('✅ Rating calculated successfully', {
                breakSetId: data.breakSetId,
                metricValue: data.metricValue,
                bestBreakId: bestCandidate.breakId,
                linehaul: bestCandidate.linehaul,
                candidateCount: candidates.length
            });

            return {
                success: true,
                breakSet: {
                    id: data.breakSetId,
                    name: breakSet.name,
                    metric: breakSet.metric,
                    unit: breakSet.unit,
                    method: breakSet.method
                },
                metricValue: data.metricValue,
                bestCandidate,
                allCandidates: candidates
            };

        } catch (error) {
            logger.error('❌ Error calculating rating', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to calculate rating',
                error.message
            );
        }
    });
