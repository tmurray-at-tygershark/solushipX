const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Admin SDK if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Enhanced Rating Engine with DIM Weight Support
 * Integrates with simple carrier rates and DIM factor calculations
 */

// Calculate rates with DIM weight consideration
exports.calculateEnhancedRates = functions.https.onCall(async (data, context) => {
    try {
        const {
            carrierId,
            serviceType,
            zone,
            fromLocation,
            toLocation,
            packages,
            customerId = null,
            shipmentType = 'package' // 'package', 'skid', 'ltl'
        } = data;

        // Validate required fields
        if (!carrierId || !fromLocation || !toLocation || !packages || !Array.isArray(packages)) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Carrier ID, from/to locations, and packages array are required'
            );
        }

        // Calculate package metrics
        const packageMetrics = calculatePackageMetrics(packages);
        
        // Calculate DIM weight for each package and total chargeable weight
        const dimWeightCalculations = await calculateDimWeights({
            carrierId,
            serviceType,
            zone,
            packages,
            customerId
        });

        // Use chargeable weight (higher of actual or volumetric weight)
        const totalChargeableWeight = dimWeightCalculations.totalChargeableWeight;
        const totalActualWeight = packageMetrics.totalWeight;
        const totalSkids = calculateSkidsFromPackages(packages);

        // Get applicable rate from simple carrier rates
        const rateResult = await getSimpleCarrierRate({
            carrierId,
            fromLocation,
            toLocation,
            weight: totalChargeableWeight, // Use chargeable weight for rating
            skids: totalSkids,
            shipmentType
        });

        if (!rateResult.success) {
            return {
                success: false,
                error: rateResult.error || 'No rate found for this route',
                dimWeightInfo: dimWeightCalculations
            };
        }

        // Calculate final rate with DIM weight adjustments
        const finalRate = calculateFinalRateWithDim({
            baseRate: rateResult.rate,
            actualWeight: totalActualWeight,
            chargeableWeight: totalChargeableWeight,
            dimWeightCalculations,
            packageMetrics
        });

        return {
            success: true,
            rate: finalRate,
            rateBreakdown: {
                baseRate: rateResult.rate.baseRate,
                totalRate: finalRate.totalRate,
                actualWeight: totalActualWeight,
                chargeableWeight: totalChargeableWeight,
                dimWeightApplied: totalChargeableWeight > totalActualWeight,
                weightDifference: totalChargeableWeight - totalActualWeight
            },
            dimWeightInfo: dimWeightCalculations,
            packageMetrics,
            rateCard: rateResult.rateCard,
            calculation: finalRate.calculation
        };

    } catch (error) {
        console.error('Error calculating enhanced rates:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to calculate enhanced rates');
    }
});

// Helper function to calculate package metrics
function calculatePackageMetrics(packages) {
    let totalWeight = 0;
    let totalPieces = 0;
    let totalVolume = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;
    let totalDeclaredValue = 0;

    packages.forEach(pkg => {
        const quantity = parseInt(pkg.quantity) || 1;
        const weight = parseFloat(pkg.weight) || 0;
        const length = parseFloat(pkg.length) || 0;
        const width = parseFloat(pkg.width) || 0;
        const height = parseFloat(pkg.height) || 0;
        const declaredValue = parseFloat(pkg.declaredValue) || 0;

        totalWeight += weight * quantity;
        totalPieces += quantity;
        totalVolume += (length * width * height) * quantity;
        totalDeclaredValue += declaredValue * quantity;

        // Track maximum dimensions for any single package
        maxLength = Math.max(maxLength, length);
        maxWidth = Math.max(maxWidth, width);
        maxHeight = Math.max(maxHeight, height);
    });

    return {
        totalWeight,
        totalPieces,
        totalVolume,
        maxLength,
        maxWidth,
        maxHeight,
        totalDeclaredValue,
        packageCount: packages.length
    };
}

// Helper function to calculate DIM weights for all packages
async function calculateDimWeights({ carrierId, serviceType, zone, packages, customerId }) {
    const packageDimWeights = [];
    let totalActualWeight = 0;
    let totalVolumetricWeight = 0;
    let totalChargeableWeight = 0;
    let dimFactorUsed = null;

    // Import the DIM weight calculation function
    const { calculateVolumetricWeight } = require('./dimFactorSystem');

    for (const pkg of packages) {
        const quantity = parseInt(pkg.quantity) || 1;
        const weight = parseFloat(pkg.weight) || 0;
        const length = parseFloat(pkg.length) || 0;
        const width = parseFloat(pkg.width) || 0;
        const height = parseFloat(pkg.height) || 0;
        const dimensionUnit = pkg.dimensionUnit || 'in';
        const weightUnit = pkg.weightUnit || 'lbs';

        if (length > 0 && width > 0 && height > 0) {
            try {
                // Calculate DIM weight for this package
                const dimResult = await calculateVolumetricWeight.handler({
                    carrierId,
                    serviceType,
                    zone,
                    length,
                    width,
                    height,
                    actualWeight: weight,
                    dimensionUnit,
                    weightUnit,
                    customerId
                }, { auth: { uid: 'system' } });

                if (dimResult.data && dimResult.data.success) {
                    const pkgDimWeight = {
                        packageIndex: packages.indexOf(pkg),
                        quantity,
                        actualWeight: weight,
                        volumetricWeight: dimResult.data.volumetricWeight,
                        chargeableWeight: dimResult.data.chargeableWeight,
                        totalActualWeight: weight * quantity,
                        totalVolumetricWeight: dimResult.data.volumetricWeight * quantity,
                        totalChargeableWeight: dimResult.data.chargeableWeight * quantity,
                        dimFactorUsed: dimResult.data.dimFactorUsed,
                        calculation: dimResult.data.calculation
                    };

                    packageDimWeights.push(pkgDimWeight);
                    
                    totalActualWeight += pkgDimWeight.totalActualWeight;
                    totalVolumetricWeight += pkgDimWeight.totalVolumetricWeight;
                    totalChargeableWeight += pkgDimWeight.totalChargeableWeight;
                    
                    if (!dimFactorUsed && dimResult.data.dimFactorUsed) {
                        dimFactorUsed = dimResult.data.dimFactorUsed;
                    }
                } else {
                    // No DIM factor found, use actual weight
                    const pkgWeight = {
                        packageIndex: packages.indexOf(pkg),
                        quantity,
                        actualWeight: weight,
                        volumetricWeight: 0,
                        chargeableWeight: weight,
                        totalActualWeight: weight * quantity,
                        totalVolumetricWeight: 0,
                        totalChargeableWeight: weight * quantity,
                        dimFactorUsed: null,
                        calculation: 'No DIM factor - using actual weight'
                    };

                    packageDimWeights.push(pkgWeight);
                    totalActualWeight += pkgWeight.totalActualWeight;
                    totalChargeableWeight += pkgWeight.totalChargeableWeight;
                }
            } catch (error) {
                console.error('Error calculating DIM weight for package:', error);
                
                // Fallback to actual weight on error
                const fallbackWeight = weight * quantity;
                packageDimWeights.push({
                    packageIndex: packages.indexOf(pkg),
                    quantity,
                    actualWeight: weight,
                    volumetricWeight: 0,
                    chargeableWeight: weight,
                    totalActualWeight: fallbackWeight,
                    totalVolumetricWeight: 0,
                    totalChargeableWeight: fallbackWeight,
                    dimFactorUsed: null,
                    calculation: 'Error calculating DIM weight - using actual weight',
                    error: error.message
                });
                
                totalActualWeight += fallbackWeight;
                totalChargeableWeight += fallbackWeight;
            }
        } else {
            // No dimensions provided, use actual weight
            const actualWeight = weight * quantity;
            packageDimWeights.push({
                packageIndex: packages.indexOf(pkg),
                quantity,
                actualWeight: weight,
                volumetricWeight: 0,
                chargeableWeight: weight,
                totalActualWeight: actualWeight,
                totalVolumetricWeight: 0,
                totalChargeableWeight: actualWeight,
                dimFactorUsed: null,
                calculation: 'No dimensions provided - using actual weight'
            });
            
            totalActualWeight += actualWeight;
            totalChargeableWeight += actualWeight;
        }
    }

    return {
        packageDimWeights,
        totalActualWeight,
        totalVolumetricWeight,
        totalChargeableWeight,
        dimWeightApplied: totalChargeableWeight > totalActualWeight,
        weightSavings: Math.max(0, totalActualWeight - totalChargeableWeight),
        weightPenalty: Math.max(0, totalChargeableWeight - totalActualWeight),
        dimFactorUsed,
        summary: `Total: ${totalActualWeight.toFixed(2)} lbs actual → ${totalChargeableWeight.toFixed(2)} lbs chargeable (${totalChargeableWeight > totalActualWeight ? '+' : ''}${(totalChargeableWeight - totalActualWeight).toFixed(2)} lbs)`
    };
}

// Helper function to calculate skids from packages
function calculateSkidsFromPackages(packages) {
    let totalSkids = 0;
    
    packages.forEach(pkg => {
        const quantity = parseInt(pkg.quantity) || 1;
        const packageType = pkg.packageType || '';
        
        // Count skids, pallets, and crates as skids
        if (packageType.toLowerCase().includes('skid') || 
            packageType.toLowerCase().includes('pallet') || 
            packageType.toLowerCase().includes('crate')) {
            totalSkids += quantity;
        } else {
            // For other package types, estimate skids based on size/weight
            const weight = parseFloat(pkg.weight) || 0;
            const volume = (parseFloat(pkg.length) || 0) * 
                          (parseFloat(pkg.width) || 0) * 
                          (parseFloat(pkg.height) || 0);
            
            // Rough estimation: if package is heavy (>200 lbs) or large (>20 cubic feet), count as skid
            if (weight > 200 || volume > 20) {
                totalSkids += quantity;
            }
        }
    });
    
    return Math.max(1, totalSkids); // Minimum 1 skid
}

// Helper function to get simple carrier rate
async function getSimpleCarrierRate({ carrierId, fromLocation, toLocation, weight, skids, shipmentType }) {
    try {
        // Query simple carrier rates
        const ratesSnapshot = await db.collection('simpleCarrierRates')
            .where('carrierId', '==', carrierId)
            .where('isActive', '==', true)
            .get();

        if (ratesSnapshot.empty) {
            return {
                success: false,
                error: 'No rates found for this carrier'
            };
        }

        let bestMatch = null;
        let bestMatchScore = -1;

        ratesSnapshot.forEach(doc => {
            const rateCard = doc.data();
            
            // Find matching rate
            for (const rate of rateCard.rates || []) {
                const matchScore = calculateRouteMatchScore(rate, fromLocation, toLocation);
                
                if (matchScore > bestMatchScore) {
                    // Check if weight/skid requirements are met
                    if (rate.rateType === 'skid_based') {
                        const skidRate = rate.skidRates && rate.skidRates[skids.toString()];
                        if (skidRate && (!rate.minWeight || weight >= rate.minWeight)) {
                            bestMatch = {
                                rate: {
                                    baseRate: parseFloat(skidRate),
                                    totalRate: parseFloat(skidRate),
                                    rateType: 'skid_based',
                                    skidsUsed: skids,
                                    calculation: `${skids} skid(s) × $${skidRate} = $${skidRate}`
                                },
                                rateCard: {
                                    id: doc.id,
                                    carrierName: rateCard.carrierName,
                                    currency: rateCard.currency,
                                    rateStructure: rateCard.rateStructure
                                }
                            };
                            bestMatchScore = matchScore;
                        }
                    } else if (rate.rateType === 'weight_based') {
                        if (weight >= rate.weightMin && weight <= rate.weightMax) {
                            const weightHundreds = weight / 100;
                            const baseRate = weightHundreds * rate.ratePer100Lbs;
                            const finalRate = Math.max(baseRate, rate.minCharge || 0);
                            
                            bestMatch = {
                                rate: {
                                    baseRate: parseFloat(baseRate.toFixed(2)),
                                    totalRate: parseFloat(finalRate.toFixed(2)),
                                    rateType: 'weight_based',
                                    weightUsed: weight,
                                    calculation: `${weightHundreds.toFixed(2)} cwt × $${rate.ratePer100Lbs}/cwt = $${baseRate.toFixed(2)}, min charge $${rate.minCharge || 0} = $${finalRate.toFixed(2)}`
                                },
                                rateCard: {
                                    id: doc.id,
                                    carrierName: rateCard.carrierName,
                                    currency: rateCard.currency,
                                    rateStructure: rateCard.rateStructure
                                }
                            };
                            bestMatchScore = matchScore;
                        }
                    }
                }
            }
        });

        if (bestMatch) {
            return {
                success: true,
                ...bestMatch
            };
        } else {
            return {
                success: false,
                error: 'No matching rate found for this route and shipment details'
            };
        }

    } catch (error) {
        console.error('Error getting simple carrier rate:', error);
        return {
            success: false,
            error: 'Failed to retrieve carrier rates'
        };
    }
}

// Helper function to calculate route match score
function calculateRouteMatchScore(rate, fromLocation, toLocation) {
    const fromMatch = compareLocations(rate.fromLocation, fromLocation);
    const toMatch = compareLocations(rate.toLocation, toLocation);
    
    // Both must match for a valid route
    if (fromMatch.score === 0 || toMatch.score === 0) {
        return 0;
    }
    
    // Combined score (higher is better)
    return fromMatch.score + toMatch.score;
}

// Helper function to compare locations
function compareLocations(rateLocation, shipmentLocation) {
    if (!rateLocation || !shipmentLocation) {
        return { score: 0, match: false };
    }

    // Exact city match (highest priority)
    if (rateLocation.city && shipmentLocation.city && 
        rateLocation.city.toLowerCase() === shipmentLocation.city.toLowerCase()) {
        return { score: 100, match: true, type: 'city' };
    }

    // Postal code match (FSA for Canadian, first 3 digits for US ZIP)
    if (rateLocation.postal && shipmentLocation.postal) {
        const rateFSA = rateLocation.postal.substring(0, 3).toUpperCase();
        const shipmentFSA = shipmentLocation.postal.substring(0, 3).toUpperCase();
        
        if (rateFSA === shipmentFSA) {
            return { score: 80, match: true, type: 'postal' };
        }
    }

    // State/Province match (lower priority)
    if (rateLocation.state && shipmentLocation.state &&
        rateLocation.state.toLowerCase() === shipmentLocation.state.toLowerCase()) {
        return { score: 20, match: true, type: 'state' };
    }

    return { score: 0, match: false };
}

// Helper function to calculate final rate with DIM weight considerations
function calculateFinalRateWithDim({ baseRate, actualWeight, chargeableWeight, dimWeightCalculations, packageMetrics }) {
    let finalRate = baseRate.totalRate;
    let adjustments = [];
    let calculation = baseRate.calculation || '';

    // Add DIM weight information to calculation
    if (dimWeightCalculations.dimWeightApplied) {
        const weightDiff = chargeableWeight - actualWeight;
        adjustments.push(`DIM Weight Applied: +${weightDiff.toFixed(2)} lbs chargeable weight`);
        calculation += ` | DIM: ${dimWeightCalculations.summary}`;
    }

    // Check for oversized package surcharges (example logic)
    if (packageMetrics.maxLength > 48 || packageMetrics.maxWidth > 48 || packageMetrics.maxHeight > 48) {
        const oversizeSurcharge = 25.00; // Example surcharge
        finalRate += oversizeSurcharge;
        adjustments.push(`Oversize Surcharge: +$${oversizeSurcharge.toFixed(2)}`);
    }

    // Check for high-value surcharges (example logic)
    if (packageMetrics.totalDeclaredValue > 1000) {
        const valueSurcharge = packageMetrics.totalDeclaredValue * 0.01; // 1% of declared value
        finalRate += valueSurcharge;
        adjustments.push(`Declared Value Surcharge: +$${valueSurcharge.toFixed(2)}`);
    }

    return {
        baseRate: baseRate.totalRate,
        totalRate: parseFloat(finalRate.toFixed(2)),
        adjustments,
        calculation: calculation + (adjustments.length > 0 ? ` | Adjustments: ${adjustments.join(', ')}` : ''),
        currency: baseRate.currency || 'CAD',
        rateType: baseRate.rateType,
        weightBasis: dimWeightCalculations.dimWeightApplied ? 'chargeable' : 'actual',
        effectiveWeight: chargeableWeight
    };
}

// Test DIM weight calculation
exports.testDimWeight = functions.https.onCall(async (data, context) => {
    try {
        const {
            carrierId = 'test-carrier',
            packages = [
                {
                    quantity: 1,
                    weight: 10,
                    length: 24,
                    width: 18,
                    height: 12,
                    dimensionUnit: 'in',
                    weightUnit: 'lbs'
                }
            ]
        } = data;

        const dimWeightCalculations = await calculateDimWeights({
            carrierId,
            serviceType: 'all',
            zone: 'all',
            packages,
            customerId: null
        });

        return {
            success: true,
            test: 'DIM Weight Calculation Test',
            input: { carrierId, packages },
            result: dimWeightCalculations
        };

    } catch (error) {
        console.error('Error testing DIM weight:', error);
        throw new functions.https.HttpsError('internal', `Test failed: ${error.message}`);
    }
});
