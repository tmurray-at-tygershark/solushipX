/**
 * QuickShip Zone-Based Rate Management Cloud Functions
 * Applies Connected Carriers geographic routing logic to QuickShip rate mapping
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

/**
 * Get QuickShip zone rate configuration for a carrier
 */
exports.getQuickShipZoneRates = functions
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
                throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
            }

            const { carrierId } = data;

            if (!carrierId) {
                throw new functions.https.HttpsError('invalid-argument', 'Carrier ID is required');
            }

            logger.info('🗺️ Loading QuickShip zone rate configuration', { carrierId });

            // Get zone rate configuration from Firestore
            const zoneRateDoc = await admin.firestore()
                .collection('quickShipZoneRates')
                .doc(carrierId)
                .get();

            if (!zoneRateDoc.exists) {
                // Return default empty configuration
                return {
                    success: true,
                    zoneConfig: {
                        pickupZones: {
                            domesticCanada: false,
                            domesticUS: false,
                            provinceToProvince: false,
                            stateToState: false,
                            provinceToState: false,
                            countryToCountry: false,
                            cityToCity: false,
                            provinceProvinceRouting: [],
                            stateStateRouting: [],
                            provinceStateRouting: [],
                            countryCountryRouting: [],
                            cityPairRouting: []
                        },
                        deliveryZones: {
                            domesticCanada: false,
                            domesticUS: false,
                            provinceToProvince: false,
                            stateToState: false,
                            provinceToState: false,
                            countryToCountry: false,
                            cityToCity: false,
                            provinceProvinceRouting: [],
                            stateStateRouting: [],
                            provinceStateRouting: [],
                            countryCountryRouting: [],
                            cityPairRouting: []
                        }
                    },
                    rateMapping: {
                        rateType: 'skid_based',
                        currency: 'CAD',
                        zonePairRates: []
                    }
                };
            }

            const zoneRateData = zoneRateDoc.data();

            logger.info('✅ Successfully loaded zone rate configuration', { 
                carrierId,
                hasPickupZones: !!zoneRateData.zoneConfig?.pickupZones,
                hasDeliveryZones: !!zoneRateData.zoneConfig?.deliveryZones,
                rateCount: zoneRateData.rateMapping?.zonePairRates?.length || 0
            });

            return {
                success: true,
                zoneConfig: zoneRateData.zoneConfig,
                rateMapping: zoneRateData.rateMapping
            };

        } catch (error) {
            logger.error('❌ Error loading QuickShip zone rate configuration', {
                error: error.message,
                stack: error.stack,
                carrierId: data.carrierId
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError('internal', 'Failed to load zone rate configuration', error.message);
        }
    });

/**
 * Save QuickShip zone rate configuration for a carrier
 */
exports.saveQuickShipZoneRates = functions
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
                throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
            }

            const { carrierId, zoneConfig, rateMapping } = data;

            if (!carrierId || !zoneConfig || !rateMapping) {
                throw new functions.https.HttpsError('invalid-argument', 'Carrier ID, zone config, and rate mapping are required');
            }

            logger.info('💾 Saving QuickShip zone rate configuration', { 
                carrierId,
                rateType: rateMapping.rateType,
                rateCount: rateMapping.zonePairRates?.length || 0
            });

            // Validate zone configuration structure
            const requiredZoneFields = [
                'domesticCanada', 'domesticUS', 'provinceToProvince', 'stateToState',
                'provinceToState', 'countryToCountry', 'cityToCity'
            ];

            for (const zoneType of ['pickupZones', 'deliveryZones']) {
                if (!zoneConfig[zoneType]) {
                    throw new functions.https.HttpsError('invalid-argument', `Missing ${zoneType} configuration`);
                }
            }

            // Validate rate mapping structure
            if (!['skid_based', 'weight_based'].includes(rateMapping.rateType)) {
                throw new functions.https.HttpsError('invalid-argument', 'Invalid rate type');
            }

            if (!['CAD', 'USD'].includes(rateMapping.currency)) {
                throw new functions.https.HttpsError('invalid-argument', 'Invalid currency');
            }

            // Save to Firestore
            const zoneRateData = {
                carrierId,
                zoneConfig,
                rateMapping,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: context.auth.uid
            };

            await admin.firestore()
                .collection('quickShipZoneRates')
                .doc(carrierId)
                .set(zoneRateData, { merge: true });

            logger.info('✅ Successfully saved QuickShip zone rate configuration', { 
                carrierId,
                pickupZoneCount: Object.values(zoneConfig.pickupZones).filter(Boolean).length,
                deliveryZoneCount: Object.values(zoneConfig.deliveryZones).filter(Boolean).length,
                ratePairCount: rateMapping.zonePairRates.length
            });

            return {
                success: true,
                message: 'Zone rate configuration saved successfully'
            };

        } catch (error) {
            logger.error('❌ Error saving QuickShip zone rate configuration', {
                error: error.message,
                stack: error.stack,
                carrierId: data.carrierId
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError('internal', 'Failed to save zone rate configuration', error.message);
        }
    });

/**
 * Calculate QuickShip rates based on zone mapping
 */
exports.calculateQuickShipZoneRates = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            const { carrierId, shipmentData } = data;

            if (!carrierId || !shipmentData) {
                throw new functions.https.HttpsError('invalid-argument', 'Carrier ID and shipment data are required');
            }

            logger.info('🧮 Calculating QuickShip zone rates', { 
                carrierId,
                origin: shipmentData.origin,
                destination: shipmentData.destination
            });

            // Load zone rate configuration
            const zoneRateDoc = await admin.firestore()
                .collection('quickShipZoneRates')
                .doc(carrierId)
                .get();

            if (!zoneRateDoc.exists) {
                return {
                    success: false,
                    error: 'No zone rate configuration found for this carrier'
                };
            }

            const { zoneConfig, rateMapping } = zoneRateDoc.data();

            // Determine origin and destination zones
            const originZone = determineZone(shipmentData.origin, zoneConfig.pickupZones);
            const destinationZone = determineZone(shipmentData.destination, zoneConfig.deliveryZones);

            if (!originZone || !destinationZone) {
                return {
                    success: false,
                    error: 'Origin or destination not served by this carrier'
                };
            }

            // Find matching zone pair rate
            const zonePairRate = rateMapping.zonePairRates.find(rate => 
                rate.fromZone === originZone && rate.toZone === destinationZone
            );

            if (!zonePairRate) {
                return {
                    success: false,
                    error: 'No rates configured for this origin-destination pair'
                };
            }

            // Calculate rate based on shipment characteristics
            let calculatedRate = 0;
            
            if (rateMapping.rateType === 'skid_based') {
                const skidCount = shipmentData.packages?.length || 1;
                const rateKey = `skid${Math.min(skidCount, 26)}`; // Cap at 26 skids
                calculatedRate = zonePairRate.rates[rateKey] || zonePairRate.rates.skid1;
            } else if (rateMapping.rateType === 'weight_based') {
                const totalWeight = shipmentData.packages?.reduce((total, pkg) => total + (pkg.weight || 0), 0) || 0;
                // Weight-based calculation logic here
                calculatedRate = calculateWeightBasedRate(totalWeight, zonePairRate.rates);
            }

            logger.info('✅ Successfully calculated QuickShip zone rate', { 
                carrierId,
                originZone,
                destinationZone,
                calculatedRate,
                currency: rateMapping.currency
            });

            return {
                success: true,
                rate: calculatedRate,
                currency: rateMapping.currency,
                originZone,
                destinationZone,
                rateType: rateMapping.rateType
            };

        } catch (error) {
            logger.error('❌ Error calculating QuickShip zone rates', {
                error: error.message,
                stack: error.stack,
                carrierId: data.carrierId
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError('internal', 'Failed to calculate zone rates', error.message);
        }
    });

/**
 * Helper function to determine which zone a location belongs to
 */
function determineZone(location, zoneConfig) {
    const { city, province, state, country, postalCode } = location;

    // Check domestic coverage first
    if (country === 'CA' && zoneConfig.domesticCanada) {
        return 'DOMESTIC_CA';
    }
    if (country === 'US' && zoneConfig.domesticUS) {
        return 'DOMESTIC_US';
    }

    // Check specific route configurations
    if (zoneConfig.provinceToProvince && zoneConfig.provinceProvinceRouting) {
        for (const route of zoneConfig.provinceProvinceRouting) {
            if (route.from === province || route.to === province) {
                return `PROVINCE_${province}`;
            }
        }
    }

    if (zoneConfig.stateToState && zoneConfig.stateStateRouting) {
        for (const route of zoneConfig.stateStateRouting) {
            if (route.from === state || route.to === state) {
                return `STATE_${state}`;
            }
        }
    }

    if (zoneConfig.cityToCity && zoneConfig.cityPairRouting) {
        for (const cityPair of zoneConfig.cityPairRouting) {
            if ((cityPair.fromCity === city && cityPair.fromProvState === (province || state)) ||
                (cityPair.toCity === city && cityPair.toProvState === (province || state))) {
                return `CITY_${city}_${province || state}`;
            }
        }
    }

    // Check cross-border routes
    if (zoneConfig.provinceToState && zoneConfig.provinceStateRouting) {
        for (const route of zoneConfig.provinceStateRouting) {
            if (route.from === province || route.from === state ||
                route.to === province || route.to === state) {
                return `CROSS_BORDER_${province || state}`;
            }
        }
    }

    return null; // Location not served
}

/**
 * Helper function to calculate weight-based rates
 */
function calculateWeightBasedRate(weight, weightRates) {
    // Find the appropriate weight break
    const weightBreaks = Object.keys(weightRates)
        .filter(key => key.startsWith('weight'))
        .map(key => ({
            breakpoint: parseInt(key.replace('weight', '')),
            rate: weightRates[key]
        }))
        .sort((a, b) => a.breakpoint - b.breakpoint);

    for (const weightBreak of weightBreaks) {
        if (weight <= weightBreak.breakpoint) {
            return weightBreak.rate;
        }
    }

    // If weight exceeds all breaks, use the highest rate
    return weightBreaks[weightBreaks.length - 1]?.rate || 0;
}
