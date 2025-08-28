/**
 * Unified Break Sets System
 * Metric-agnostic rating engine that handles weight/LF/skid/cube with one system
 * Implements generalized break set pattern from enterprise research
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Calculate rates using unified break sets (weight/LF/skid/cube)
 */
exports.calculateUnifiedRates = functions
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
                zoneCode,
                freightClass = null
            } = data;

            if (!tariffId || !shipmentData || !zoneCode) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Tariff ID, shipment data, and zone code are required'
                );
            }

            logger.info('⚖️ Calculating unified rates', {
                tariffId,
                zoneCode,
                freightClass,
                weight: shipmentData.totalWeight,
                dimensions: shipmentData.totalDimensions
            });

            // 1. Get tariff configuration
            const tariff = await getTariffConfig(tariffId);
            if (!tariff) {
                throw new functions.https.HttpsError('not-found', 'Tariff not found');
            }

            // 2. Calculate metrics for each configured break set
            const results = {};

            // Weight-based calculation
            if (tariff.weightBreakSetId) {
                results.weight = await calculateMetricRates(
                    tariff.weightBreakSetId,
                    'weight',
                    shipmentData.totalWeight,
                    tariff,
                    zoneCode,
                    freightClass
                );
            }

            // Capacity-based calculations (LF, skid, cube)
            if (tariff.capacityBreakSetId) {
                const capacityMetrics = await calculateCapacityMetrics(shipmentData, tariff);
                
                if (capacityMetrics.linearFeet > 0) {
                    results.linearFeet = await calculateMetricRates(
                        tariff.capacityBreakSetId,
                        'lf',
                        capacityMetrics.linearFeet,
                        tariff,
                        zoneCode,
                        freightClass
                    );
                }

                if (capacityMetrics.skidCount > 0) {
                    results.skids = await calculateMetricRates(
                        tariff.capacityBreakSetId,
                        'skid',
                        capacityMetrics.skidCount,
                        tariff,
                        zoneCode,
                        freightClass
                    );
                }

                if (capacityMetrics.cubeUtilization > 0) {
                    results.cube = await calculateMetricRates(
                        tariff.capacityBreakSetId,
                        'cube',
                        capacityMetrics.cubeUtilization,
                        tariff,
                        zoneCode,
                        freightClass
                    );
                }
            }

            // 3. Apply comparison policy (min/max)
            const finalResult = applyComparisonPolicy(results, tariff.comparePolicy || 'max');

            logger.info('✅ Unified rate calculation completed', {
                results: Object.keys(results),
                finalRate: finalResult.totalRate,
                winningMetric: finalResult.winningMetric
            });

            return {
                success: true,
                ...finalResult,
                allResults: results,
                tariffInfo: {
                    id: tariff.id,
                    name: tariff.name,
                    comparePolicy: tariff.comparePolicy
                }
            };

        } catch (error) {
            logger.error('❌ Error calculating unified rates', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to calculate unified rates',
                error.message
            );
        }
    });

/**
 * Create unified break set (metric-agnostic)
 */
exports.createUnifiedBreakSet = functions
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
                name,
                metric,
                unit,
                method,
                meta = {}
            } = data;

            // Validate required fields
            if (!name || !metric || !unit || !method) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Name, metric, unit, and method are required'
                );
            }

            // Validate metric type
            const validMetrics = ['weight', 'lf', 'skid', 'cube'];
            if (!validMetrics.includes(metric)) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    `Metric must be one of: ${validMetrics.join(', ')}`
                );
            }

            // Validate method
            const validMethods = ['step', 'extend'];
            if (!validMethods.includes(method)) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    `Method must be one of: ${validMethods.join(', ')}`
                );
            }

            logger.info('📊 Creating unified break set', {
                name,
                metric,
                unit,
                method
            });

            // Create break set data
            const breakSetData = {
                name: name.trim(),
                metric: metric.toLowerCase(),
                unit: unit.toLowerCase(),
                method: method.toLowerCase(),
                meta: {
                    roundingIncrement: meta.roundingIncrement || 1,
                    roundingDirection: meta.roundingDirection || 'up',
                    calculationMethod: meta.calculationMethod || 'standard',
                    ...meta
                },
                enabled: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid
            };

            const breakSetRef = await db.collection('ratingBreakSets').add(breakSetData);

            logger.info('✅ Unified break set created', {
                breakSetId: breakSetRef.id,
                name,
                metric
            });

            return {
                success: true,
                breakSetId: breakSetRef.id,
                message: 'Unified break set created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating unified break set', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create unified break set',
                error.message
            );
        }
    });

/**
 * Add breaks to unified break set
 */
exports.addUnifiedBreaks = functions
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

            const { breakSetId, breaks } = data;

            if (!breakSetId || !breaks || !Array.isArray(breaks)) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Break set ID and breaks array are required'
                );
            }

            logger.info('📊 Adding breaks to unified break set', {
                breakSetId,
                breakCount: breaks.length
            });

            // Validate break set exists
            const breakSetDoc = await db.collection('ratingBreakSets').doc(breakSetId).get();
            if (!breakSetDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Break set not found');
            }

            // Create breaks in batch
            const batch = db.batch();
            const createdBreaks = [];

            breaks.forEach((breakData, index) => {
                if (!breakData.minMetric || typeof breakData.minMetric !== 'number') {
                    throw new functions.https.HttpsError(
                        'invalid-argument',
                        `Break ${index + 1}: minMetric is required and must be a number`
                    );
                }

                const breakRef = db.collection('ratingBreaks').doc();
                const breakDoc = {
                    breakSetId: breakSetId,
                    minMetric: parseFloat(breakData.minMetric),
                    maxMetric: breakData.maxMetric ? parseFloat(breakData.maxMetric) : null,
                    seq: index + 1,
                    description: breakData.description || '',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdBy: context.auth.uid
                };

                batch.set(breakRef, breakDoc);
                createdBreaks.push({ id: breakRef.id, ...breakDoc });
            });

            await batch.commit();

            logger.info('✅ Breaks added to unified break set', {
                breakSetId,
                created: createdBreaks.length
            });

            return {
                success: true,
                created: createdBreaks.length,
                breaks: createdBreaks,
                message: `${createdBreaks.length} breaks added successfully`
            };

        } catch (error) {
            logger.error('❌ Error adding unified breaks', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to add unified breaks',
                error.message
            );
        }
    });

/**
 * Helper Functions for Unified Break Sets
 */

async function getTariffConfig(tariffId) {
    const tariffDoc = await db.collection('tariffs').doc(tariffId).get();
    return tariffDoc.exists ? { id: tariffDoc.id, ...tariffDoc.data() } : null;
}

async function calculateMetricRates(breakSetId, metric, metricValue, tariff, zoneCode, freightClass) {
    // Get break set configuration
    const breakSetDoc = await db.collection('ratingBreakSets').doc(breakSetId).get();
    if (!breakSetDoc.exists) {
        throw new Error(`Break set ${breakSetId} not found`);
    }

    const breakSet = breakSetDoc.data();

    // Apply rounding rules before calculation
    const roundedValue = applyRounding(metricValue, breakSet.meta);

    // Get applicable breaks
    const breaksSnapshot = await db.collection('ratingBreaks')
        .where('breakSetId', '==', breakSetId)
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
        if (roundedValue < breakData.minMetric) continue;
        if (breakData.maxMetric && roundedValue > breakData.maxMetric) continue;

        // Get rate for this break, zone, and class
        let rateQuery = db.collection('rateMatrix')
            .where('tariffId', '==', tariff.id)
            .where('breakId', '==', breakData.id)
            .where('zoneCode', '==', zoneCode);

        if (freightClass) {
            rateQuery = rateQuery.where('classCode', '==', freightClass);
        }

        const rateSnapshot = await rateQuery.limit(1).get();
        if (rateSnapshot.empty) continue;

        const rateData = rateSnapshot.docs[0].data();

        // Calculate charge based on method
        let units = roundedValue;
        if (breakSet.method === 'extend') {
            units = Math.max(roundedValue, breakData.minMetric);
        }

        let charge;
        if (breakSet.metric === 'skid' && rateData.flatBand) {
            // Flat band pricing for skids
            charge = rateData.rateValue;
        } else {
            // Per-unit pricing
            charge = units * rateData.rateValue;
        }

        // Apply minimum charge
        if (rateData.minCharge) {
            charge = Math.max(charge, rateData.minCharge);
        }

        if (charge < bestCharge) {
            bestCharge = charge;
            bestRate = {
                metric: metric,
                breakId: breakData.id,
                inputValue: metricValue,
                roundedValue: roundedValue,
                units: units,
                rateValue: rateData.rateValue,
                minCharge: rateData.minCharge,
                charge: charge,
                method: breakSet.method,
                calculation: generateCalculationDescription(breakSet, breakData, units, rateData, charge)
            };
        }
    }

    return bestRate;
}

async function calculateCapacityMetrics(shipmentData, tariff) {
    const metrics = {
        linearFeet: 0,
        skidCount: 0,
        cubeUtilization: 0
    };

    // Linear Feet calculation
    if (shipmentData.packages && shipmentData.packages.length > 0) {
        const lfConfig = tariff.meta?.lf || {};
        
        switch (lfConfig.method || 'footprint') {
            case 'declared':
                metrics.linearFeet = shipmentData.declaredLF || 0;
                break;
                
            case 'footprint':
                metrics.linearFeet = calculateFootprintLF(shipmentData.packages, lfConfig);
                break;
                
            case 'rows_across':
                metrics.linearFeet = calculateRowsAcrossLF(shipmentData.packages, lfConfig);
                break;
        }

        // Round LF
        const roundIncrement = lfConfig.roundIncrement || 0.5;
        metrics.linearFeet = Math.ceil(metrics.linearFeet / roundIncrement) * roundIncrement;
    }

    // Skid count calculation
    if (shipmentData.packages && shipmentData.packages.length > 0) {
        const skidConfig = tariff.meta?.skid || {};
        metrics.skidCount = calculateSkidCount(shipmentData.packages, skidConfig);
    }

    // Cube utilization calculation
    if (shipmentData.totalCube > 0) {
        const cubeConfig = tariff.meta?.cube || {};
        const trailerCube = cubeConfig.trailerCube || 4000; // Standard 53' trailer
        metrics.cubeUtilization = shipmentData.totalCube / trailerCube;
    }

    return metrics;
}

function calculateFootprintLF(packages, config) {
    const usableWidth = config.usableWidthIn || 100; // 100 inches usable width
    const packingEff = config.packingEff || 0.9; // 90% packing efficiency
    
    let totalFootprintSqIn = 0;
    
    packages.forEach(pkg => {
        const footprintSqIn = (pkg.length || 0) * (pkg.width || 0) * (pkg.quantity || 1);
        totalFootprintSqIn += footprintSqIn;
    });
    
    const effectiveLengthIn = totalFootprintSqIn / (usableWidth * packingEff);
    return effectiveLengthIn / 12; // Convert to feet
}

function calculateRowsAcrossLF(packages, config) {
    const usableWidth = config.usableWidthIn || 100;
    const avgPalletWidth = config.avgPalletWidthIn || 40;
    const avgPalletLength = config.avgPalletLengthIn || 48;
    
    let totalPallets = 0;
    packages.forEach(pkg => {
        totalPallets += pkg.quantity || 1;
    });
    
    const rowsAcross = Math.floor(usableWidth / avgPalletWidth);
    const rowsNeeded = Math.ceil(totalPallets / rowsAcross);
    
    return rowsNeeded * (avgPalletLength / 12);
}

function calculateSkidCount(packages, config) {
    const stackableMaxHeight = config.stackableMaxHeight || 84; // 84 inches
    const stackFactor = config.stackFactor || 0.5; // Stackable items count as 0.5
    
    let totalSkids = 0;
    
    packages.forEach(pkg => {
        const height = pkg.height || 0;
        const quantity = pkg.quantity || 1;
        
        if (height <= stackableMaxHeight && pkg.stackable) {
            totalSkids += quantity * stackFactor;
        } else {
            totalSkids += quantity;
        }
    });
    
    return Math.ceil(totalSkids);
}

function applyRounding(value, meta) {
    const increment = meta.roundingIncrement || 1;
    const direction = meta.roundingDirection || 'up';
    
    switch (direction) {
        case 'up':
            return Math.ceil(value / increment) * increment;
        case 'down':
            return Math.floor(value / increment) * increment;
        case 'nearest':
            return Math.round(value / increment) * increment;
        default:
            return value;
    }
}

function applyComparisonPolicy(results, policy) {
    const rates = Object.values(results).filter(r => r && r.charge);
    
    if (rates.length === 0) {
        throw new Error('No valid rates calculated');
    }
    
    let winningRate;
    
    switch (policy) {
        case 'min':
            winningRate = rates.reduce((min, rate) => 
                rate.charge < min.charge ? rate : min
            );
            break;
            
        case 'max':
        default:
            winningRate = rates.reduce((max, rate) => 
                rate.charge > max.charge ? rate : max
            );
            break;
    }
    
    return {
        winningMetric: winningRate.metric,
        totalRate: winningRate.charge,
        calculation: winningRate.calculation,
        details: winningRate
    };
}

function generateCalculationDescription(breakSet, breakData, units, rateData, charge) {
    switch (breakSet.metric) {
        case 'weight':
            if (breakSet.method === 'extend') {
                return `${units} ${breakSet.unit} (extended) × $${rateData.rateValue}/${breakSet.unit} = $${charge.toFixed(2)}`;
            } else {
                return `${units} ${breakSet.unit} × $${rateData.rateValue}/${breakSet.unit} = $${charge.toFixed(2)}`;
            }
            
        case 'lf':
            return `${units} LF × $${rateData.rateValue}/LF = $${charge.toFixed(2)}`;
            
        case 'skid':
            if (rateData.flatBand) {
                return `${units} skids (flat band) = $${charge.toFixed(2)}`;
            } else {
                return `${units} skids × $${rateData.rateValue}/skid = $${charge.toFixed(2)}`;
            }
            
        case 'cube':
            return `${units} cube utilization × $${rateData.rateValue}/cube = $${charge.toFixed(2)}`;
            
        default:
            return `${units} units × $${rateData.rateValue} = $${charge.toFixed(2)}`;
    }
}
