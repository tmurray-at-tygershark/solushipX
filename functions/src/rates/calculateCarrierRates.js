/**
 * Cloud Function for Carrier Rate Calculations
 * Provides server-side rate calculation for QuickShip carriers
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

/**
 * Calculate rates for a QuickShip carrier
 */
exports.calculateCarrierRates = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        
        try {
            logger.info('📊 Starting carrier rate calculation', {
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
            const db = admin.firestore();

            // Get carrier information
            const carrierDoc = await db.collection('quickshipCarriers').doc(carrierId).get();
            if (!carrierDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Carrier not found'
                );
            }

            const carrierData = carrierDoc.data();
            logger.info('📋 Carrier data loaded', { carrierName: carrierData.name });

            // Get carrier rate cards
            const rateCardsQuery = await db.collection('carrierRateCards')
                .where('carrierId', '==', carrierId)
                .where('enabled', '==', true)
                .orderBy('createdAt', 'desc')
                .get();

            if (rateCardsQuery.empty) {
                logger.warn('⚠️ No rate cards found for carrier', { carrierId });
                return {
                    success: false,
                    error: 'No rate configuration found for this carrier',
                    rateBreakdown: []
                };
            }

            const rateCards = rateCardsQuery.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            logger.info('📋 Rate cards loaded', { count: rateCards.length });

            // Calculate volumetric weight
            const weightCalculation = calculateVolumetricWeight(
                shipmentData.packages,
                166, // Default DIM factor
                shipmentData.unitSystem || 'imperial'
            );

            logger.info('⚖️ Weight calculation completed', weightCalculation);

            // Select best rate card (for now, use the first one)
            const rateCard = rateCards[0];
            
            // Calculate rates based on rate card type
            let rateCalculation;
            switch (rateCard.rateType) {
                case 'skid_based':
                    rateCalculation = calculateSkidBasedRates(shipmentData, rateCard, weightCalculation);
                    break;
                case 'weight_based':
                    rateCalculation = calculateWeightBasedRates(shipmentData, rateCard, weightCalculation);
                    break;
                case 'zone_based':
                    rateCalculation = calculateZoneBasedRates(shipmentData, rateCard, weightCalculation);
                    break;
                default:
                    rateCalculation = calculateFlatRates(shipmentData, rateCard, weightCalculation);
            }

            // Add additional services if provided
            const additionalServicesCharges = calculateAdditionalServices(
                shipmentData.additionalServices || [],
                rateCalculation.baseTotal,
                rateCard
            );

            const finalRateBreakdown = [
                ...rateCalculation.rateBreakdown,
                ...additionalServicesCharges
            ];

            const finalTotal = finalRateBreakdown.reduce((sum, rate) => sum + parseFloat(rate.charge || 0), 0);

            const result = {
                success: true,
                carrier: carrierData,
                rateCard: {
                    id: rateCard.id,
                    name: rateCard.rateCardName,
                    type: rateCard.rateType
                },
                weightCalculation,
                rateBreakdown: finalRateBreakdown,
                baseTotal: rateCalculation.baseTotal,
                additionalServicesTotal: additionalServicesCharges.reduce((sum, rate) => sum + parseFloat(rate.charge || 0), 0),
                finalTotal,
                currency: rateCard.currency || 'CAD',
                alternateCarriers: rateCalculation.alternateCarriers || [],
                calculatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            logger.info('✅ Rate calculation completed', {
                finalTotal,
                rateCount: finalRateBreakdown.length
            });

            return result;

        } catch (error) {
            logger.error('❌ Rate calculation error', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Rate calculation failed',
                error.message
            );
        }
    });

/**
 * Calculate volumetric weight for packages
 */
function calculateVolumetricWeight(packages, dimFactor = 166, unitSystem = 'imperial') {
    if (!packages || packages.length === 0) {
        return {
            actualWeight: 0,
            volumetricWeight: 0,
            chargeableWeight: 0,
            totalVolume: 0,
            dimFactor,
            unitSystem
        };
    }

    let totalActualWeight = 0;
    let totalVolume = 0;

    packages.forEach(pkg => {
        const weight = parseFloat(pkg.weight) || 0;
        const quantity = parseInt(pkg.quantity) || 1;
        const length = parseFloat(pkg.length) || 0;
        const width = parseFloat(pkg.width) || 0;
        const height = parseFloat(pkg.height) || 0;

        totalActualWeight += weight * quantity;
        totalVolume += length * width * height * quantity;
    });

    const totalVolumetricWeight = totalVolume / dimFactor;
    const chargeableWeight = Math.max(totalActualWeight, totalVolumetricWeight);

    return {
        actualWeight: Math.round(totalActualWeight * 100) / 100,
        volumetricWeight: Math.round(totalVolumetricWeight * 100) / 100,
        chargeableWeight: Math.round(chargeableWeight * 100) / 100,
        totalVolume: Math.round(totalVolume * 100) / 100,
        dimFactor,
        unitSystem,
        usingVolumetricWeight: totalVolumetricWeight > totalActualWeight
    };
}

/**
 * Calculate skid-based rates
 */
function calculateSkidBasedRates(shipmentData, rateCard, weightCalculation) {
    // Count total skids/pallets
    const totalSkids = shipmentData.packages.reduce((sum, pkg) => {
        const isSkid = pkg.packagingType && (
            pkg.packagingType.toLowerCase().includes('pallet') ||
            pkg.packagingType.toLowerCase().includes('skid') ||
            pkg.packagingType === '245' || // PALLET code
            pkg.packagingType === '246'    // SKID code
        );
        return sum + (isSkid ? parseInt(pkg.quantity || 1) : 0);
    });

    if (totalSkids === 0) {
        throw new Error('No skids/pallets found in shipment for skid-based pricing');
    }

    // Find applicable skid rate
    const skidRates = rateCard.skidRates || [];
    const applicableRate = skidRates.find(rate => rate.skidCount === totalSkids) ||
                          skidRates.find(rate => rate.skidCount >= totalSkids);

    if (!applicableRate) {
        throw new Error(`No rate found for ${totalSkids} skids`);
    }

    const rateBreakdown = [
        {
            id: 1,
            carrier: rateCard.carrierName || 'Auto',
            code: 'FRT',
            chargeName: `Freight - ${totalSkids} Skid${totalSkids > 1 ? 's' : ''}`,
            cost: applicableRate.ourCost?.toString() || '0',
            costCurrency: rateCard.currency || 'CAD',
            charge: applicableRate.retailPrice?.toString() || '0',
            chargeCurrency: rateCard.currency || 'CAD',
            source: 'auto_calculated'
        }
    ];

    // Add alternate carriers if available
    const alternateCarriers = [];
    if (applicableRate.alternateCarrier) {
        alternateCarriers.push({
            name: applicableRate.alternateCarrier.name,
            cost: applicableRate.alternateCarrier.cost,
            savings: applicableRate.ourCost - applicableRate.alternateCarrier.cost
        });
    }

    return {
        rateBreakdown,
        baseTotal: parseFloat(applicableRate.retailPrice || 0),
        alternateCarriers,
        notes: applicableRate.notes
    };
}

/**
 * Calculate weight-based rates
 */
function calculateWeightBasedRates(shipmentData, rateCard, weightCalculation) {
    const chargeableWeight = weightCalculation.chargeableWeight;
    const weightBreaks = rateCard.weightBreaks || [];

    const applicableBreak = weightBreaks
        .filter(wb => chargeableWeight >= wb.minWeight && chargeableWeight <= wb.maxWeight)
        .sort((a, b) => a.minWeight - b.minWeight)[0];

    if (!applicableBreak) {
        throw new Error(`No rate found for weight ${chargeableWeight} lbs`);
    }

    const freightCharge = Math.max(
        chargeableWeight * applicableBreak.rate,
        applicableBreak.minimumCharge || 0
    );

    const rateBreakdown = [
        {
            id: 1,
            carrier: rateCard.carrierName || 'Auto',
            code: 'FRT',
            chargeName: `Freight - ${chargeableWeight} lbs`,
            cost: (freightCharge * 0.7).toFixed(2),
            costCurrency: rateCard.currency || 'CAD',
            charge: freightCharge.toFixed(2),
            chargeCurrency: rateCard.currency || 'CAD',
            source: 'auto_calculated'
        }
    ];

    return {
        rateBreakdown,
        baseTotal: freightCharge,
        alternateCarriers: []
    };
}

/**
 * Calculate zone-based rates
 */
function calculateZoneBasedRates(shipmentData, rateCard, weightCalculation) {
    const originPostal = shipmentData.origin?.postalCode?.substring(0, 3);
    const destPostal = shipmentData.destination?.postalCode?.substring(0, 3);

    if (!originPostal || !destPostal) {
        throw new Error('Origin and destination postal codes required for zone-based pricing');
    }

    const zones = rateCard.zones || [];
    const applicableZone = zones.find(zone => 
        zone.fromPostalCode === originPostal && zone.toPostalCode === destPostal
    );

    if (!applicableZone) {
        throw new Error(`No rate found for route ${originPostal} to ${destPostal}`);
    }

    const chargeableWeight = weightCalculation.chargeableWeight;
    const freightCharge = Math.max(
        applicableZone.baseRate + (chargeableWeight * applicableZone.perKgRate),
        applicableZone.minimumCharge || 0
    );

    const rateBreakdown = [
        {
            id: 1,
            carrier: rateCard.carrierName || 'Auto',
            code: 'FRT',
            chargeName: `Freight - ${originPostal} to ${destPostal}`,
            cost: (freightCharge * 0.7).toFixed(2),
            costCurrency: rateCard.currency || 'CAD',
            charge: freightCharge.toFixed(2),
            chargeCurrency: rateCard.currency || 'CAD',
            source: 'auto_calculated'
        }
    ];

    return {
        rateBreakdown,
        baseTotal: freightCharge,
        alternateCarriers: []
    };
}

/**
 * Calculate flat rates
 */
function calculateFlatRates(shipmentData, rateCard, weightCalculation) {
    const flatRate = rateCard.flatRate || 100;

    const rateBreakdown = [
        {
            id: 1,
            carrier: rateCard.carrierName || 'Auto',
            code: 'FRT',
            chargeName: 'Freight - Flat Rate',
            cost: (flatRate * 0.7).toFixed(2),
            costCurrency: rateCard.currency || 'CAD',
            charge: flatRate.toFixed(2),
            chargeCurrency: rateCard.currency || 'CAD',
            source: 'auto_calculated'
        }
    ];

    return {
        rateBreakdown,
        baseTotal: flatRate,
        alternateCarriers: []
    };
}

/**
 * Calculate additional services charges
 */
function calculateAdditionalServices(additionalServices, baseTotal, rateCard) {
    const serviceCharges = [];

    const serviceRates = {
        'signature_required': { rate: 5.00, type: 'flat' },
        'saturday_delivery': { rate: 15.00, type: 'flat' },
        'residential_delivery': { rate: 0.05, type: 'percentage' },
        'fuel_surcharge': { rate: 0.15, type: 'percentage' },
        'insurance': { rate: 0.02, type: 'percentage' }
    };

    additionalServices.forEach((service, index) => {
        const serviceConfig = serviceRates[service.code] || serviceRates[service];
        if (serviceConfig) {
            let charge = 0;
            if (serviceConfig.type === 'flat') {
                charge = serviceConfig.rate;
            } else if (serviceConfig.type === 'percentage') {
                charge = baseTotal * serviceConfig.rate;
            }

            serviceCharges.push({
                id: 100 + index,
                carrier: rateCard.carrierName || 'Auto',
                code: service.code || service,
                chargeName: service.name || service,
                cost: (charge * 0.8).toFixed(2),
                costCurrency: rateCard.currency || 'CAD',
                charge: charge.toFixed(2),
                chargeCurrency: rateCard.currency || 'CAD',
                source: 'auto_calculated'
            });
        }
    });

    return serviceCharges;
}
