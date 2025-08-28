/**
 * Universal Carrier Rating Engine
 * Handles multiple rate structures and calculation methods for all carriers
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Universal rating calculation that works with any carrier structure
 */
exports.calculateUniversalRates = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB',
        cors: true
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        
        try {
            logger.info('🌍 Starting universal rate calculation', {
                carrierId: data.carrierId,
                hasShipmentData: !!data.shipmentData,
                userId: context.auth?.uid
            });

            // Validate input
            if (!data.carrierId || !data.shipmentData) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID and shipment data are required'
                );
            }

            const { carrierId, shipmentData } = data;

            // Get carrier and rate data
            const [carrierData, rateCards, eligibilityRules] = await Promise.all([
                getCarrierData(carrierId),
                getCarrierRateCards(carrierId),
                getCarrierEligibilityRules(carrierId)
            ]);

            if (!carrierData) {
                throw new functions.https.HttpsError('not-found', 'Carrier not found');
            }

            // Check carrier eligibility first
            const eligibilityCheck = checkCarrierEligibility(shipmentData, carrierData, eligibilityRules);
            if (!eligibilityCheck.eligible) {
                logger.warn('❌ Carrier not eligible', { 
                    carrierId, 
                    reasons: eligibilityCheck.reasons 
                });
                return {
                    success: false,
                    eligible: false,
                    reasons: eligibilityCheck.reasons,
                    error: 'Carrier not eligible for this shipment'
                };
            }

            // Calculate shipment metrics
            const shipmentMetrics = calculateShipmentMetrics(shipmentData);
            logger.info('📊 Shipment metrics calculated', shipmentMetrics);

            // Find best rate card for this shipment
            const bestRateCard = selectBestRateCard(rateCards, shipmentMetrics, shipmentData);
            if (!bestRateCard) {
                logger.warn('❌ No applicable rate card found', { carrierId, availableCards: rateCards.length });
                return {
                    success: false,
                    eligible: true,
                    error: 'No applicable rate card found for this shipment',
                    availableRateCards: rateCards.length
                };
            }

            // Calculate rates using the universal engine
            const rateCalculation = await calculateRatesByStructure(
                bestRateCard,
                shipmentMetrics,
                shipmentData,
                carrierData
            );

            // Add additional services if specified
            const additionalServicesCharges = calculateAdditionalServices(
                shipmentData.additionalServices || [],
                rateCalculation.baseTotal,
                bestRateCard
            );

            const finalRateBreakdown = [
                ...rateCalculation.rateBreakdown,
                ...additionalServicesCharges
            ];

            const additionalServicesTotal = additionalServicesCharges.reduce(
                (sum, charge) => sum + parseFloat(charge.charge || 0), 0
            );

            const result = {
                success: true,
                eligible: true,
                carrier: {
                    id: carrierData.id,
                    name: carrierData.name,
                    logo: carrierData.logo
                },
                rateCard: {
                    id: bestRateCard.id,
                    name: bestRateCard.rateCardName,
                    type: bestRateCard.rateType,
                    structure: bestRateCard.rateStructure
                },
                shipmentMetrics,
                rateBreakdown: finalRateBreakdown,
                baseTotal: rateCalculation.baseTotal,
                additionalServicesTotal,
                finalTotal: rateCalculation.finalTotal + additionalServicesTotal,
                currency: bestRateCard.currency || 'CAD',
                transitTime: rateCalculation.transitTime,
                serviceLevel: bestRateCard.serviceLevel || 'Standard',
                calculatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            logger.info('✅ Universal rate calculation completed', {
                finalTotal: result.finalTotal,
                structure: bestRateCard.rateStructure,
                rateBreakdownCount: finalRateBreakdown.length
            });

            return result;

        } catch (error) {
            logger.error('❌ Universal rating error', {
                error: error.message,
                stack: error.stack,
                carrierId: data.carrierId
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Universal rate calculation failed',
                error.message
            );
        }
    });

/**
 * Calculate comprehensive shipment metrics
 */
function calculateShipmentMetrics(shipmentData) {
    const packages = shipmentData.packages || [];
    const origin = shipmentData.origin;
    const destination = shipmentData.destination;
    const unitSystem = shipmentData.unitSystem || 'imperial';

    // Calculate total dimensions and weight
    let totalWeight = 0;
    let totalVolume = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;
    let totalPieces = 0;

    packages.forEach(pkg => {
        const weight = parseFloat(pkg.weight || 0);
        const length = parseFloat(pkg.length || 0);
        const width = parseFloat(pkg.width || 0);
        const height = parseFloat(pkg.height || 0);
        const quantity = parseInt(pkg.quantity || 1);

        totalWeight += weight * quantity;
        totalVolume += (length * width * height) * quantity;
        totalPieces += quantity;

        // Track maximum dimensions for individual package limits
        maxLength = Math.max(maxLength, length);
        maxWidth = Math.max(maxWidth, width);
        maxHeight = Math.max(maxHeight, height);
    });

    // Calculate skid equivalents (4'x4' = 48"x48" = 2304 sq inches base)
    const skidFootprint = unitSystem === 'metric' ? (121.92 * 121.92) : (48 * 48); // cm² or in²
    const totalFootprint = packages.reduce((sum, pkg) => {
        const length = parseFloat(pkg.length || (unitSystem === 'metric' ? 121.92 : 48));
        const width = parseFloat(pkg.width || (unitSystem === 'metric' ? 121.92 : 48));
        const quantity = parseInt(pkg.quantity || 1);
        return sum + (length * width * quantity);
    }, 0);
    
    const skidEquivalents = Math.ceil(totalFootprint / skidFootprint);

    // Calculate dimensional weight based on shipment type and service level
    const dimFactor = getDimensionalFactor(shipmentData.shipmentType, shipmentData.serviceLevel);
    const dimensionalWeight = totalVolume / dimFactor;
    const chargeableWeight = Math.max(totalWeight, dimensionalWeight);

    // Calculate distance if coordinates available
    const distance = calculateDistance(origin, destination);

    // Determine route zones
    const originZone = getZoneFromLocation(origin);
    const destinationZone = getZoneFromLocation(destination);

    return {
        totalWeight: Math.round(totalWeight * 100) / 100,
        dimensionalWeight: Math.round(dimensionalWeight * 100) / 100,
        chargeableWeight: Math.round(chargeableWeight * 100) / 100,
        totalVolume: Math.round(totalVolume * 100) / 100,
        skidEquivalents,
        maxLength,
        maxWidth,
        maxHeight,
        totalPieces,
        distance: Math.round(distance),
        packageCount: packages.length,
        unitSystem,
        route: {
            origin: origin,
            destination: destination,
            originZone,
            destinationZone,
            routeKey: `${originZone}-${destinationZone}`
        },
        dimFactor
    };
}

/**
 * Universal rate calculation by structure type
 */
async function calculateRatesByStructure(rateCard, metrics, shipmentData, carrierData) {
    const structure = rateCard.rateStructure || rateCard.rateType;

    logger.info('📊 Calculating rates with structure', { structure, rateCardId: rateCard.id });

    switch (structure) {
        case 'skid_based':
            return calculateSkidBasedRates(rateCard, metrics, shipmentData);
        
        case 'weight_distance':
            return calculateWeightDistanceRates(rateCard, metrics, shipmentData);
        
        case 'zone_matrix':
            return calculateZoneMatrixRates(rateCard, metrics, shipmentData);
        
        case 'dimensional_weight':
            return calculateDimensionalWeightRates(rateCard, metrics, shipmentData);
        
        case 'hybrid_complex':
            return calculateHybridRates(rateCard, metrics, shipmentData);
        
        case 'flat_rate':
            return calculateFlatRates(rateCard, metrics, shipmentData);
        
        default:
            // Fallback to existing rate calculation logic if structure not recognized
            logger.warn('⚠️ Unknown rate structure, using fallback', { structure });
            return calculateFallbackRates(rateCard, metrics, shipmentData);
    }
}

/**
 * Enhanced skid-based rate calculation
 */
function calculateSkidBasedRates(rateCard, metrics, shipmentData) {
    const skidCount = Math.max(1, metrics.skidEquivalents);
    const skidRates = rateCard.skidRates || [];

    logger.info('📦 Calculating skid-based rates', { 
        skidCount, 
        availableRates: skidRates.length,
        chargeableWeight: metrics.chargeableWeight 
    });

    // Find applicable skid rate
    let applicableRate = skidRates.find(rate => 
        parseInt(rate.skidCount) === skidCount
    );

    // If exact match not found, find next higher skid count
    if (!applicableRate) {
        applicableRate = skidRates
            .filter(rate => parseInt(rate.skidCount) >= skidCount)
            .sort((a, b) => parseInt(a.skidCount) - parseInt(b.skidCount))[0];
    }

    // If still no match, use highest available rate
    if (!applicableRate) {
        applicableRate = skidRates
            .sort((a, b) => parseInt(b.skidCount) - parseInt(a.skidCount))[0];
    }

    if (!applicableRate) {
        throw new Error(`No skid rate configuration found for ${skidCount} skids`);
    }

    const baseRate = parseFloat(applicableRate.rate || applicableRate.sell || 0);
    const fuelSurchargePercent = parseFloat(applicableRate.fuelSurcharge || 15.5);
    const fuelSurcharge = baseRate * (fuelSurchargePercent / 100);

    const rateBreakdown = [
        {
            id: 1,
            carrier: rateCard.carrierName || 'Auto',
            code: 'FRT',
            chargeName: `Freight - ${skidCount} Skid${skidCount > 1 ? 's' : ''} (${metrics.chargeableWeight} lbs)`,
            cost: (baseRate * 0.7).toFixed(2),
            costCurrency: rateCard.currency || 'CAD',
            charge: baseRate.toFixed(2),
            chargeCurrency: rateCard.currency || 'CAD',
            source: 'skid_based'
        }
    ];

    if (fuelSurcharge > 0) {
        rateBreakdown.push({
            id: 2,
            carrier: rateCard.carrierName || 'Auto',
            code: 'FSC',
            chargeName: `Fuel Surcharge (${fuelSurchargePercent}%)`,
            cost: (fuelSurcharge * 0.7).toFixed(2),
            costCurrency: rateCard.currency || 'CAD',
            charge: fuelSurcharge.toFixed(2),
            chargeCurrency: rateCard.currency || 'CAD',
            source: 'skid_based'
        });
    }

    const finalTotal = baseRate + fuelSurcharge;

    return {
        rateBreakdown,
        baseTotal: baseRate,
        finalTotal,
        transitTime: applicableRate.transitDays || calculateTransitTime(metrics.distance),
        notes: `${skidCount} skid${skidCount > 1 ? 's' : ''} @ ${applicableRate.rate || applicableRate.sell} ${rateCard.currency || 'CAD'}`
    };
}

/**
 * Weight + Distance rate calculation
 */
function calculateWeightDistanceRates(rateCard, metrics, shipmentData) {
    const chargeableWeight = metrics.chargeableWeight;
    const distance = metrics.distance || 0;
    const weightBreaks = rateCard.weightBreaks || [];

    logger.info('⚖️ Calculating weight-distance rates', { 
        chargeableWeight, 
        distance, 
        weightBreaksCount: weightBreaks.length 
    });

    // Find applicable weight break
    const applicableBreak = weightBreaks
        .filter(wb => 
            chargeableWeight >= (parseFloat(wb.minWeight) || 0) && 
            chargeableWeight <= (parseFloat(wb.maxWeight) || Infinity)
        )
        .sort((a, b) => parseFloat(a.minWeight) - parseFloat(b.minWeight))[0];

    if (!applicableBreak) {
        throw new Error(`No weight break found for ${chargeableWeight} lbs`);
    }

    const ratePerLb = parseFloat(applicableBreak.ratePerLb || 0);
    const minimumCharge = parseFloat(applicableBreak.minimumCharge || 0);
    const distanceFactor = parseFloat(applicableBreak.distanceFactor || 1.0);

    const weightCharge = chargeableWeight * ratePerLb;
    const distanceMultiplier = distance > 0 ? Math.max(1, (distance / 100) * distanceFactor) : 1;
    const baseRate = Math.max(weightCharge * distanceMultiplier, minimumCharge);

    const rateBreakdown = [
        {
            id: 1,
            carrier: rateCard.carrierName || 'Auto',
            code: 'FRT',
            chargeName: `Freight - ${chargeableWeight} lbs @ ${distance} miles`,
            cost: (baseRate * 0.7).toFixed(2),
            costCurrency: rateCard.currency || 'CAD',
            charge: baseRate.toFixed(2),
            chargeCurrency: rateCard.currency || 'CAD',
            source: 'weight_distance'
        }
    ];

    return {
        rateBreakdown,
        baseTotal: baseRate,
        finalTotal: baseRate,
        transitTime: calculateTransitTime(distance),
        notes: `${chargeableWeight} lbs × $${ratePerLb}/lb × ${distanceMultiplier.toFixed(2)} distance factor`
    };
}

/**
 * Zone matrix rate calculation
 */
function calculateZoneMatrixRates(rateCard, metrics, shipmentData) {
    const originZone = metrics.route.originZone;
    const destinationZone = metrics.route.destinationZone;
    const zoneMatrix = rateCard.zoneMatrix || [];
    const routeKey = metrics.route.routeKey;

    logger.info('🗺️ Calculating zone matrix rates', { 
        originZone, 
        destinationZone, 
        routeKey,
        matrixSize: zoneMatrix.length 
    });

    // Find applicable zone rate - try multiple matching strategies
    let zoneRate = zoneMatrix.find(zone => 
        zone.originZone === originZone && zone.destinationZone === destinationZone
    );

    // Try reverse route if not found
    if (!zoneRate) {
        zoneRate = zoneMatrix.find(zone => 
            zone.originZone === destinationZone && zone.destinationZone === originZone
        );
    }

    // Try route key matching
    if (!zoneRate) {
        zoneRate = zoneMatrix.find(zone => 
            zone.routeKey === routeKey || zone.routeKey === `${destinationZone}-${originZone}`
        );
    }

    if (!zoneRate) {
        throw new Error(`No zone rate found for route ${originZone} to ${destinationZone}`);
    }

    const baseRate = parseFloat(zoneRate.rate || 0);
    const fuelSurchargePercent = parseFloat(zoneRate.fuelSurcharge || 0);
    const fuelSurcharge = baseRate * (fuelSurchargePercent / 100);

    const rateBreakdown = [
        {
            id: 1,
            carrier: rateCard.carrierName || 'Auto',
            code: 'FRT',
            chargeName: `Freight - ${originZone} → ${destinationZone}`,
            cost: (baseRate * 0.7).toFixed(2),
            costCurrency: rateCard.currency || 'CAD',
            charge: baseRate.toFixed(2),
            chargeCurrency: rateCard.currency || 'CAD',
            source: 'zone_matrix'
        }
    ];

    if (fuelSurcharge > 0) {
        rateBreakdown.push({
            id: 2,
            carrier: rateCard.carrierName || 'Auto',
            code: 'FSC',
            chargeName: `Fuel Surcharge (${fuelSurchargePercent}%)`,
            cost: (fuelSurcharge * 0.7).toFixed(2),
            costCurrency: rateCard.currency || 'CAD',
            charge: fuelSurcharge.toFixed(2),
            chargeCurrency: rateCard.currency || 'CAD',
            source: 'zone_matrix'
        });
    }

    return {
        rateBreakdown,
        baseTotal: baseRate,
        finalTotal: baseRate + fuelSurcharge,
        transitTime: zoneRate.transitDays || calculateTransitTime(metrics.distance),
        notes: `Zone route: ${originZone} → ${destinationZone}`
    };
}

/**
 * Additional service calculations
 */
function calculateAdditionalServices(additionalServices, baseTotal, rateCard) {
    const additionalCharges = [];
    let chargeId = 100; // Start after main charges

    additionalServices.forEach(service => {
        let charge = 0;
        let chargeName = service.name || service;

        // Standard additional service rates
        switch (service.toLowerCase?.() || service) {
            case 'residential':
            case 'residential_delivery':
                charge = 25.00;
                chargeName = 'Residential Delivery';
                break;
            case 'liftgate':
            case 'liftgate_delivery':
                charge = 75.00;
                chargeName = 'Liftgate Service';
                break;
            case 'inside_delivery':
                charge = 50.00;
                chargeName = 'Inside Delivery';
                break;
            case 'appointment':
            case 'appointment_delivery':
                charge = 35.00;
                chargeName = 'Appointment Delivery';
                break;
            case 'tailgate':
                charge = 45.00;
                chargeName = 'Tailgate Service';
                break;
            default:
                charge = 25.00; // Default additional service charge
                chargeName = service.name || service;
        }

        if (charge > 0) {
            additionalCharges.push({
                id: chargeId++,
                carrier: rateCard.carrierName || 'Auto',
                code: 'ACC',
                chargeName,
                cost: (charge * 0.7).toFixed(2),
                costCurrency: rateCard.currency || 'CAD',
                charge: charge.toFixed(2),
                chargeCurrency: rateCard.currency || 'CAD',
                source: 'additional_service'
            });
        }
    });

    return additionalCharges;
}

// Helper functions
async function getCarrierData(carrierId) {
    const doc = await db.collection('quickshipCarriers').doc(carrierId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getCarrierRateCards(carrierId) {
    const snapshot = await db.collection('carrierRateCards')
        .where('carrierId', '==', carrierId)
        .where('enabled', '==', true)
        .orderBy('createdAt', 'desc')
        .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getCarrierEligibilityRules(carrierId) {
    const [weightSnapshot, dimensionSnapshot] = await Promise.all([
        db.collection('carrierWeightRules').where('carrierId', '==', carrierId).get(),
        db.collection('carrierDimensionRules').where('carrierId', '==', carrierId).get()
    ]);

    return {
        weightRules: weightSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        dimensionRules: dimensionSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    };
}

function checkCarrierEligibility(shipmentData, carrierData, eligibilityRules) {
    const reasons = [];
    const metrics = calculateShipmentMetrics(shipmentData);

    // Check weight eligibility
    const weightRules = eligibilityRules.weightRules.filter(rule => rule.enabled);
    for (const rule of weightRules) {
        if (rule.minWeight && metrics.chargeableWeight < parseFloat(rule.minWeight)) {
            reasons.push(`Weight below minimum: ${rule.minWeight} ${rule.weightUnit}`);
        }
        if (rule.maxWeight && metrics.chargeableWeight > parseFloat(rule.maxWeight)) {
            reasons.push(`Weight exceeds maximum: ${rule.maxWeight} ${rule.weightUnit}`);
        }
    }

    // Check dimension eligibility
    const dimensionRules = eligibilityRules.dimensionRules.filter(rule => rule.enabled);
    for (const rule of dimensionRules) {
        if (rule.maxLength && metrics.maxLength > parseFloat(rule.maxLength)) {
            reasons.push(`Length exceeds maximum: ${rule.maxLength} ${rule.dimensionUnit}`);
        }
        if (rule.maxWidth && metrics.maxWidth > parseFloat(rule.maxWidth)) {
            reasons.push(`Width exceeds maximum: ${rule.maxWidth} ${rule.dimensionUnit}`);
        }
        if (rule.maxHeight && metrics.maxHeight > parseFloat(rule.maxHeight)) {
            reasons.push(`Height exceeds maximum: ${rule.maxHeight} ${rule.dimensionUnit}`);
        }
    }

    return {
        eligible: reasons.length === 0,
        reasons
    };
}

function selectBestRateCard(rateCards, metrics, shipmentData) {
    if (rateCards.length === 0) return null;

    // Priority selection logic:
    // 1. Service level match
    // 2. Weight range compatibility  
    // 3. Route coverage
    // 4. Most recent/active

    const serviceLevel = shipmentData.serviceLevel?.toLowerCase() || 'standard';
    
    // Filter by service level if specified
    let eligibleCards = rateCards.filter(card => 
        !card.serviceLevel || card.serviceLevel.toLowerCase() === serviceLevel
    );

    if (eligibleCards.length === 0) {
        eligibleCards = rateCards; // Fallback to all cards
    }

    // Score each card based on shipment fit
    const scoredCards = eligibleCards.map(card => ({
        card,
        score: calculateRateCardScore(card, metrics, shipmentData)
    }));

    // Return highest scoring card
    scoredCards.sort((a, b) => b.score - a.score);
    return scoredCards[0]?.card || rateCards[0];
}

function calculateRateCardScore(rateCard, metrics, shipmentData) {
    let score = 0;

    // Service level match bonus
    if (rateCard.serviceLevel?.toLowerCase() === shipmentData.serviceLevel?.toLowerCase()) {
        score += 50;
    }

    // Rate structure preference (skid-based gets priority for LTL)
    if (rateCard.rateStructure === 'skid_based' && metrics.skidEquivalents <= 26) {
        score += 30;
    }

    // Weight compatibility
    if (rateCard.maxWeight && metrics.chargeableWeight <= parseFloat(rateCard.maxWeight)) {
        score += 20;
    }

    // Recent card bonus
    const cardAge = Date.now() - (rateCard.createdAt?.toDate?.()?.getTime() || 0);
    const daysOld = cardAge / (1000 * 60 * 60 * 24);
    score += Math.max(0, 20 - daysOld); // Newer cards get higher score

    return score;
}

function getDimensionalFactor(shipmentType, serviceLevel) {
    // Return appropriate DIM factor based on shipment type and service level
    if (shipmentType === 'courier') {
        return serviceLevel === 'express' ? 139 : 166;
    }
    return 166; // Standard LTL DIM factor
}

function calculateDistance(origin, destination) {
    // Enhanced distance calculation with postal code fallback
    if (origin?.latitude && destination?.latitude) {
        return calculateHaversineDistance(origin, destination);
    }
    
    // Fallback to postal code distance estimation
    if (origin?.postalCode && destination?.postalCode) {
        return estimateDistanceByPostalCode(origin.postalCode, destination.postalCode);
    }
    
    return 0;
}

function calculateHaversineDistance(origin, destination) {
    const R = 3959; // Earth's radius in miles
    const dLat = (destination.latitude - origin.latitude) * Math.PI / 180;
    const dLon = (destination.longitude - origin.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(origin.latitude * Math.PI / 180) * Math.cos(destination.latitude * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
}

function estimateDistanceByPostalCode(originPostal, destPostal) {
    // Simplified postal code distance estimation for Canadian postal codes
    const originProvince = getProvinceFromPostal(originPostal);
    const destProvince = getProvinceFromPostal(destPostal);
    
    if (originProvince === destProvince) {
        return 200; // Intra-provincial average
    }
    
    // Inter-provincial distance estimates
    const provinceDistances = {
        'BC-AB': 350, 'BC-SK': 500, 'BC-MB': 750, 'BC-ON': 1200, 'BC-QC': 1400,
        'AB-SK': 200, 'AB-MB': 400, 'AB-ON': 900, 'AB-QC': 1100,
        'SK-MB': 250, 'SK-ON': 700, 'SK-QC': 900,
        'MB-ON': 450, 'MB-QC': 650,
        'ON-QC': 250
    };
    
    const key = `${originProvince}-${destProvince}`;
    const reverseKey = `${destProvince}-${originProvince}`;
    
    return provinceDistances[key] || provinceDistances[reverseKey] || 500;
}

function getZoneFromLocation(location) {
    if (!location) return 'UNKNOWN';
    
    // Priority: Use province/state if available
    if (location.province) return location.province;
    if (location.state) return location.state;
    
    // Fallback to postal code analysis
    if (location.postalCode) {
        return getProvinceFromPostal(location.postalCode);
    }
    
    return 'UNKNOWN';
}

function getProvinceFromPostal(postalCode) {
    if (!postalCode) return 'UNKNOWN';
    
    const firstChar = postalCode.charAt(0).toUpperCase();
    const postalToProvince = {
        'A': 'NL', 'B': 'NS', 'C': 'PE', 'E': 'NB',
        'G': 'QC', 'H': 'QC', 'J': 'QC',
        'K': 'ON', 'L': 'ON', 'M': 'ON', 'N': 'ON', 'P': 'ON',
        'R': 'MB', 'S': 'SK', 'T': 'AB',
        'V': 'BC', 'X': 'NU', 'Y': 'YT'
    };
    
    return postalToProvince[firstChar] || postalCode.substring(0, 3);
}

function calculateTransitTime(distance) {
    if (distance < 100) return '1 business day';
    if (distance < 300) return '2 business days';
    if (distance < 600) return '3 business days';
    if (distance < 1000) return '4 business days';
    if (distance < 1500) return '5 business days';
    return '5-7 business days';
}

// Additional rate calculation methods
function calculateDimensionalWeightRates(rateCard, metrics, shipmentData) {
    const dimFactor = metrics.dimFactor;
    const chargeableWeight = metrics.chargeableWeight;
    const ratePerLb = parseFloat(rateCard.dimWeightRate || 0.65);
    const minimumCharge = parseFloat(rateCard.minimumCharge || 150);

    const baseRate = Math.max(chargeableWeight * ratePerLb, minimumCharge);

    const rateBreakdown = [{
        id: 1,
        carrier: rateCard.carrierName || 'Auto',
        code: 'FRT',
        chargeName: `Dimensional Weight - ${chargeableWeight} lbs (DIM: ${dimFactor})`,
        cost: (baseRate * 0.7).toFixed(2),
        costCurrency: rateCard.currency || 'CAD',
        charge: baseRate.toFixed(2),
        chargeCurrency: rateCard.currency || 'CAD',
        source: 'dimensional_weight'
    }];

    return {
        rateBreakdown,
        baseTotal: baseRate,
        finalTotal: baseRate,
        transitTime: calculateTransitTime(metrics.distance),
        notes: `Chargeable weight: ${chargeableWeight} lbs (actual: ${metrics.totalWeight}, dim: ${metrics.dimensionalWeight})`
    };
}

function calculateHybridRates(rateCard, metrics, shipmentData) {
    // Complex hybrid calculation combining multiple factors
    const baseRate = parseFloat(rateCard.baseRate || 200);
    const skidRate = parseFloat(rateCard.skidRate || 0) * metrics.skidEquivalents;
    const weightRate = parseFloat(rateCard.weightRate || 0) * metrics.chargeableWeight;
    const distanceRate = parseFloat(rateCard.distanceRate || 0) * metrics.distance;

    const totalRate = baseRate + skidRate + weightRate + distanceRate;

    const rateBreakdown = [
        {
            id: 1,
            carrier: rateCard.carrierName || 'Auto',
            code: 'BASE',
            chargeName: 'Base Rate',
            cost: (baseRate * 0.7).toFixed(2),
            costCurrency: rateCard.currency || 'CAD',
            charge: baseRate.toFixed(2),
            chargeCurrency: rateCard.currency || 'CAD',
            source: 'hybrid_base'
        }
    ];

    if (skidRate > 0) {
        rateBreakdown.push({
            id: 2,
            carrier: rateCard.carrierName || 'Auto',
            code: 'SKD',
            chargeName: `Skid Charge (${metrics.skidEquivalents} skids)`,
            cost: (skidRate * 0.7).toFixed(2),
            costCurrency: rateCard.currency || 'CAD',
            charge: skidRate.toFixed(2),
            chargeCurrency: rateCard.currency || 'CAD',
            source: 'hybrid_skid'
        });
    }

    if (weightRate > 0) {
        rateBreakdown.push({
            id: 3,
            carrier: rateCard.carrierName || 'Auto',
            code: 'WGT',
            chargeName: `Weight Charge (${metrics.chargeableWeight} lbs)`,
            cost: (weightRate * 0.7).toFixed(2),
            costCurrency: rateCard.currency || 'CAD',
            charge: weightRate.toFixed(2),
            chargeCurrency: rateCard.currency || 'CAD',
            source: 'hybrid_weight'
        });
    }

    return {
        rateBreakdown,
        baseTotal: totalRate,
        finalTotal: totalRate,
        transitTime: calculateTransitTime(metrics.distance),
        notes: 'Hybrid rate calculation'
    };
}

function calculateFlatRates(rateCard, metrics, shipmentData) {
    const flatRate = parseFloat(rateCard.flatRate || 100);
    
    const rateBreakdown = [{
        id: 1,
        carrier: rateCard.carrierName || 'Auto',
        code: 'FRT',
        chargeName: 'Flat Rate',
        cost: (flatRate * 0.7).toFixed(2),
        costCurrency: rateCard.currency || 'CAD',
        charge: flatRate.toFixed(2),
        chargeCurrency: rateCard.currency || 'CAD',
        source: 'flat_rate'
    }];

    return {
        rateBreakdown,
        baseTotal: flatRate,
        finalTotal: flatRate,
        transitTime: '2-3 business days',
        notes: 'Flat rate pricing'
    };
}

function calculateFallbackRates(rateCard, metrics, shipmentData) {
    // Fallback to existing calculation logic for compatibility
    const estimatedRate = Math.max(200, metrics.chargeableWeight * 0.65);
    
    const rateBreakdown = [{
        id: 1,
        carrier: rateCard.carrierName || 'Auto',
        code: 'FRT',
        chargeName: 'Estimated Freight',
        cost: (estimatedRate * 0.7).toFixed(2),
        costCurrency: rateCard.currency || 'CAD',
        charge: estimatedRate.toFixed(2),
        chargeCurrency: rateCard.currency || 'CAD',
        source: 'fallback'
    }];

    return {
        rateBreakdown,
        baseTotal: estimatedRate,
        finalTotal: estimatedRate,
        transitTime: calculateTransitTime(metrics.distance),
        notes: 'Estimated rate (no specific rate card configuration found)'
    };
}
