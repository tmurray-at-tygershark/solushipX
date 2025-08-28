/**
 * NMFC Class System with FAK Mapping
 * Implements sophisticated LTL class-based pricing with "discount off base" support
 * Based on enterprise LTL contract patterns
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Calculate LTL rates with NMFC class support
 * Supports explicit rates and "discount off base" pricing
 */
exports.calculateLTLWithClass = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB'
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

            const {
                tariffId,
                shipmentData,
                customerId = null
            } = data;

            if (!tariffId || !shipmentData) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Tariff ID and shipment data are required'
                );
            }

            logger.info('🚛 Calculating LTL rates with NMFC class', {
                tariffId,
                customerId,
                weight: shipmentData.totalWeight,
                dimensions: shipmentData.totalCube
            });

            // 1. Get tariff configuration
            const tariff = await getTariffConfig(tariffId);
            if (!tariff) {
                throw new functions.https.HttpsError('not-found', 'Tariff not found');
            }

            // 2. Determine freight class
            const freightClass = await determineFreightClass(shipmentData, tariff);
            logger.info('📋 Freight class determined', { 
                actualClass: freightClass.actual,
                priceClass: freightClass.price 
            });

            // 3. Calculate rates based on pricing mode
            let rateResult;
            if (tariff.pricingMode === 'base_discount') {
                rateResult = await calculateBaseDiscountRates(tariff, shipmentData, freightClass, customerId);
            } else {
                rateResult = await calculateExplicitRates(tariff, shipmentData, freightClass);
            }

            // 4. Apply additional charges and minimums
            const finalResult = await applyAdditionalCharges(rateResult, tariff, shipmentData);

            logger.info('✅ LTL rate calculation completed', {
                linehaul: finalResult.linehaul,
                totalCharge: finalResult.totalCharge,
                freightClass: freightClass.price
            });

            return {
                success: true,
                ...finalResult,
                freightClass,
                tariffInfo: {
                    id: tariff.id,
                    name: tariff.name,
                    pricingMode: tariff.pricingMode
                }
            };

        } catch (error) {
            logger.error('❌ Error calculating LTL rates with class', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to calculate LTL rates',
                error.message
            );
        }
    });

/**
 * Manage freight classes (50, 55, 60...500)
 */
exports.getFreightClasses = functions
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

            logger.info('📋 Loading freight classes');

            const classesSnapshot = await db.collection('freightClasses')
                .orderBy('code')
                .get();

            const classes = [];
            classesSnapshot.forEach(doc => {
                classes.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return {
                success: true,
                classes,
                count: classes.length
            };

        } catch (error) {
            logger.error('❌ Error loading freight classes', {
                error: error.message
            });

            throw new functions.https.HttpsError(
                'internal',
                'Failed to load freight classes',
                error.message
            );
        }
    });

/**
 * Manage FAK (Freight All Kinds) mappings
 */
exports.createFAKMapping = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            // Validate authentication and permissions
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
            }

            const userDoc = await db.collection('users').doc(context.auth.uid).get();
            const userData = userDoc.data();
            if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
                throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
            }

            const {
                tariffId,
                customerId = null,
                fromClassCode,
                toClassCode,
                effectiveFrom,
                effectiveTo
            } = data;

            if (!fromClassCode || !toClassCode) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'From class and to class codes are required'
                );
            }

            logger.info('🔄 Creating FAK mapping', {
                tariffId,
                customerId,
                mapping: `${fromClassCode} → ${toClassCode}`
            });

            // Validate freight classes exist
            const fromClass = await getFreightClassByCode(fromClassCode);
            const toClass = await getFreightClassByCode(toClassCode);

            if (!fromClass || !toClass) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Invalid freight class codes'
                );
            }

            // Create FAK mapping
            const fakData = {
                tariffId: tariffId || null,
                customerId: customerId || null,
                fromClassId: fromClass.id,
                fromClassCode: fromClassCode,
                toClassId: toClass.id,
                toClassCode: toClassCode,
                effectiveFrom: effectiveFrom ? admin.firestore.Timestamp.fromDate(new Date(effectiveFrom)) : admin.firestore.Timestamp.now(),
                effectiveTo: effectiveTo ? admin.firestore.Timestamp.fromDate(new Date(effectiveTo)) : null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid
            };

            const fakRef = await db.collection('classPricingOverrides').add(fakData);

            logger.info('✅ FAK mapping created', {
                fakId: fakRef.id,
                mapping: `${fromClassCode} → ${toClassCode}`
            });

            return {
                success: true,
                fakId: fakRef.id,
                message: 'FAK mapping created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating FAK mapping', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create FAK mapping',
                error.message
            );
        }
    });

/**
 * Initialize standard NMFC freight classes
 */
exports.initializeFreightClasses = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            // Validate authentication and permissions
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
            }

            const userDoc = await db.collection('users').doc(context.auth.uid).get();
            const userData = userDoc.data();
            if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
                throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
            }

            logger.info('📋 Initializing standard NMFC freight classes');

            // Standard NMFC classes
            const standardClasses = [
                { code: '50', description: 'Very dense, high value items' },
                { code: '55', description: 'Dense, high value items' },
                { code: '60', description: 'Dense items' },
                { code: '65', description: 'Moderately dense items' },
                { code: '70', description: 'Average density items' },
                { code: '77.5', description: 'Slightly below average density' },
                { code: '85', description: 'Below average density' },
                { code: '92.5', description: 'Low density items' },
                { code: '100', description: 'Standard reference class' },
                { code: '110', description: 'Light, bulky items' },
                { code: '125', description: 'Very light, bulky items' },
                { code: '150', description: 'Extremely light, bulky items' },
                { code: '175', description: 'Very low density items' },
                { code: '200', description: 'Low density, fragile items' },
                { code: '250', description: 'Very low density, high care items' },
                { code: '300', description: 'Extremely low density items' },
                { code: '400', description: 'Ultra-low density items' },
                { code: '500', description: 'Lowest density classification' }
            ];

            const batch = db.batch();
            const createdClasses = [];

            for (const classInfo of standardClasses) {
                // Check if class already exists
                const existingSnapshot = await db.collection('freightClasses')
                    .where('code', '==', classInfo.code)
                    .limit(1)
                    .get();

                if (existingSnapshot.empty) {
                    const classRef = db.collection('freightClasses').doc();
                    batch.set(classRef, {
                        code: classInfo.code,
                        description: classInfo.description,
                        densityRange: calculateDensityRange(classInfo.code),
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        createdBy: context.auth.uid
                    });
                    createdClasses.push(classInfo.code);
                }
            }

            await batch.commit();

            logger.info('✅ Freight classes initialized', {
                created: createdClasses.length,
                total: standardClasses.length
            });

            return {
                success: true,
                created: createdClasses.length,
                total: standardClasses.length,
                message: `${createdClasses.length} freight classes created`
            };

        } catch (error) {
            logger.error('❌ Error initializing freight classes', {
                error: error.message,
                stack: error.stack
            });

            throw new functions.https.HttpsError(
                'internal',
                'Failed to initialize freight classes',
                error.message
            );
        }
    });

/**
 * Helper Functions for NMFC Class System
 */

async function getTariffConfig(tariffId) {
    const tariffDoc = await db.collection('tariffs').doc(tariffId).get();
    return tariffDoc.exists ? { id: tariffDoc.id, ...tariffDoc.data() } : null;
}

async function determineFreightClass(shipmentData, tariff) {
    let actualClass = null;
    let priceClass = null;

    // 1. Use declared NMFC class if provided
    if (shipmentData.nmfcClass) {
        actualClass = shipmentData.nmfcClass;
    } else {
        // 2. Calculate class by density
        actualClass = await calculateClassByDensity(shipmentData);
    }

    // 3. Apply FAK mapping if exists
    priceClass = await applyFAKMapping(tariff.id, actualClass, shipmentData.customerId);

    return {
        actual: actualClass,
        price: priceClass || actualClass,
        source: priceClass ? 'FAK_mapped' : (shipmentData.nmfcClass ? 'declared' : 'density_calculated')
    };
}

async function calculateClassByDensity(shipmentData) {
    // Calculate density (pounds per cubic foot)
    const totalWeight = shipmentData.totalWeight || 0;
    const totalCube = shipmentData.totalCube || 0;

    if (totalCube === 0) {
        return '70'; // Default class if no dimensions
    }

    const density = totalWeight / totalCube; // PCF (pounds per cubic foot)

    // Standard NMFC density ranges
    if (density >= 50) return '50';
    if (density >= 35) return '55';
    if (density >= 30) return '60';
    if (density >= 22.5) return '65';
    if (density >= 15) return '70';
    if (density >= 13.5) return '77.5';
    if (density >= 12) return '85';
    if (density >= 10.5) return '92.5';
    if (density >= 9) return '100';
    if (density >= 8) return '110';
    if (density >= 6) return '125';
    if (density >= 5) return '150';
    if (density >= 4) return '175';
    if (density >= 3) return '200';
    if (density >= 2) return '250';
    if (density >= 1) return '300';
    if (density >= 0.5) return '400';
    return '500';
}

async function applyFAKMapping(tariffId, actualClass, customerId) {
    // Build query for FAK mapping
    let query = db.collection('classPricingOverrides')
        .where('fromClassCode', '==', actualClass);

    // Check customer-specific mapping first
    if (customerId) {
        const customerQuery = query.where('customerId', '==', customerId);
        const customerSnapshot = await customerQuery.limit(1).get();
        if (!customerSnapshot.empty) {
            return customerSnapshot.docs[0].data().toClassCode;
        }
    }

    // Check tariff-specific mapping
    if (tariffId) {
        const tariffQuery = query.where('tariffId', '==', tariffId);
        const tariffSnapshot = await tariffQuery.limit(1).get();
        if (!tariffSnapshot.empty) {
            return tariffSnapshot.docs[0].data().toClassCode;
        }
    }

    // Check global mapping
    const globalQuery = query
        .where('tariffId', '==', null)
        .where('customerId', '==', null);
    const globalSnapshot = await globalQuery.limit(1).get();
    if (!globalSnapshot.empty) {
        return globalSnapshot.docs[0].data().toClassCode;
    }

    return null; // No FAK mapping found
}

async function calculateExplicitRates(tariff, shipmentData, freightClass) {
    // Calculate CWT (hundredweight)
    const cwt = Math.ceil(shipmentData.totalWeight / 100);

    // Get breaks for this tariff
    const breaksSnapshot = await db.collection('ratingBreaks')
        .where('breakSetId', '==', tariff.breakSetId)
        .orderBy('seq')
        .get();

    const breaks = [];
    breaksSnapshot.forEach(doc => {
        breaks.push({ id: doc.id, ...doc.data() });
    });

    let bestRate = null;
    let bestCharge = Infinity;

    for (const breakData of breaks) {
        // Check if this break applies
        if (cwt < breakData.minMetric) continue;
        if (breakData.maxMetric && cwt > breakData.maxMetric) continue;

        // Get rate for this class and break
        const rateSnapshot = await db.collection('rateMatrix')
            .where('tariffId', '==', tariff.id)
            .where('breakId', '==', breakData.id)
            .where('classCode', '==', freightClass.price)
            .limit(1)
            .get();

        if (rateSnapshot.empty) continue;

        const rateData = rateSnapshot.docs[0].data();
        
        // Calculate charge
        let units = cwt;
        if (tariff.method === 'extend') {
            units = Math.max(cwt, breakData.minMetric);
        }

        let charge = units * rateData.rateValue;
        if (rateData.minCharge) {
            charge = Math.max(charge, rateData.minCharge);
        }

        if (charge < bestCharge) {
            bestCharge = charge;
            bestRate = {
                breakId: breakData.id,
                rateValue: rateData.rateValue,
                minCharge: rateData.minCharge,
                units,
                linehaul: charge
            };
        }
    }

    return bestRate;
}

async function calculateBaseDiscountRates(tariff, shipmentData, freightClass, customerId) {
    // Get base tariff rates
    const baseSnapshot = await db.collection('baseRateMatrix')
        .where('baseTariffId', '==', tariff.baseTariffId)
        .where('classCode', '==', freightClass.price)
        .limit(1)
        .get();

    if (baseSnapshot.empty) {
        throw new functions.https.HttpsError('not-found', 'Base rate not found for class');
    }

    const baseRate = baseSnapshot.docs[0].data();
    const cwt = Math.ceil(shipmentData.totalWeight / 100);

    // Calculate discounted rate
    const discountedRate = baseRate.baseRateCwt * (1 - tariff.discountPct / 100);
    let linehaul = cwt * discountedRate;

    // Apply absolute minimum charge (AMC)
    if (tariff.amc) {
        linehaul = Math.max(linehaul, tariff.amc);
    }

    return {
        baseRate: baseRate.baseRateCwt,
        discountPct: tariff.discountPct,
        discountedRate,
        units: cwt,
        linehaul,
        amc: tariff.amc
    };
}

async function applyAdditionalCharges(rateResult, tariff, shipmentData) {
    // Apply fuel surcharge if configured
    let fuelSurcharge = 0;
    if (tariff.fuelSurchargePct) {
        fuelSurcharge = rateResult.linehaul * (tariff.fuelSurchargePct / 100);
    }

    // Add accessorial charges based on shipment services
    let accessorialCharges = 0;
    // TODO: Implement accessorial charge calculation

    const totalCharge = rateResult.linehaul + fuelSurcharge + accessorialCharges;

    return {
        ...rateResult,
        fuelSurcharge,
        accessorialCharges,
        totalCharge,
        breakdown: [
            { name: 'Linehaul', amount: rateResult.linehaul },
            { name: 'Fuel Surcharge', amount: fuelSurcharge },
            { name: 'Accessorials', amount: accessorialCharges }
        ]
    };
}

async function getFreightClassByCode(code) {
    const snapshot = await db.collection('freightClasses')
        .where('code', '==', code)
        .limit(1)
        .get();

    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

function calculateDensityRange(classCode) {
    // Return typical density range for each class
    const densityRanges = {
        '50': { min: 50, max: null },
        '55': { min: 35, max: 49.99 },
        '60': { min: 30, max: 34.99 },
        '65': { min: 22.5, max: 29.99 },
        '70': { min: 15, max: 22.49 },
        '77.5': { min: 13.5, max: 14.99 },
        '85': { min: 12, max: 13.49 },
        '92.5': { min: 10.5, max: 11.99 },
        '100': { min: 9, max: 10.49 },
        '110': { min: 8, max: 8.99 },
        '125': { min: 6, max: 7.99 },
        '150': { min: 5, max: 5.99 },
        '175': { min: 4, max: 4.99 },
        '200': { min: 3, max: 3.99 },
        '250': { min: 2, max: 2.99 },
        '300': { min: 1, max: 1.99 },
        '400': { min: 0.5, max: 0.99 },
        '500': { min: 0, max: 0.49 }
    };

    return densityRanges[classCode] || { min: 0, max: null };
}
