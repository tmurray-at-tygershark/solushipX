/**
 * Normalized Rating Engine
 * Handles terminal-based routing and complex carrier configurations
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Calculate rates using normalized carrier configuration
 */
exports.calculateNormalizedRates = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB',
        cors: true
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        
        try {
            logger.info('🎯 Starting normalized rate calculation', {
                carrierId: data.carrierId,
                hasShipmentData: !!data.shipmentData,
                userId: context.auth?.uid
            });

            const { carrierId, shipmentData } = data;

            if (!carrierId || !shipmentData) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID and shipment data are required'
                );
            }

            // Get carrier information
            const carrierDoc = await db.collection('quickshipCarriers').doc(carrierId).get();
            if (!carrierDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Carrier not found');
            }

            const carrierData = carrierDoc.data();
            
            // Check if carrier has normalized configuration
            if (!carrierData.normalizedConfigId) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Carrier does not have normalized rate configuration'
                );
            }

            // Get normalized configuration
            const configDoc = await db.collection('normalizedCarrierConfigs').doc(carrierData.normalizedConfigId).get();
            if (!configDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Carrier configuration not found');
            }

            const config = configDoc.data();
            logger.info('📋 Loaded normalized configuration', { 
                format: config.format, 
                configName: config.configName 
            });

            // Calculate shipment metrics
            const shipmentMetrics = calculateShipmentMetrics(shipmentData);
            logger.info('📊 Shipment metrics calculated', shipmentMetrics);

            // Calculate rates based on configuration format
            const rateCalculation = await calculateRatesByFormat(
                config,
                shipmentMetrics,
                shipmentData,
                carrierData
            );

            const result = {
                success: true,
                carrier: {
                    id: carrierData.id || carrierId,
                    name: carrierData.name,
                    logo: carrierData.logo
                },
                configuration: {
                    id: config.id || carrierData.normalizedConfigId,
                    name: config.configName,
                    format: config.format
                },
                shipmentMetrics,
                rateBreakdown: rateCalculation.rateBreakdown,
                baseTotal: rateCalculation.baseTotal,
                finalTotal: rateCalculation.finalTotal,
                currency: config.currency || 'CAD',
                transitTime: rateCalculation.transitTime,
                routingInfo: rateCalculation.routingInfo,
                calculatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            logger.info('✅ Normalized rate calculation completed', {
                finalTotal: result.finalTotal,
                format: config.format,
                routingInfo: rateCalculation.routingInfo
            });

            return result;

        } catch (error) {
            logger.error('❌ Normalized rating error', {
                error: error.message,
                stack: error.stack,
                carrierId: data.carrierId
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Normalized rate calculation failed',
                error.message
            );
        }
    });

/**
 * Calculate shipment metrics for normalized rating
 */
function calculateShipmentMetrics(shipmentData) {
    const packages = shipmentData.packages || [];
    const origin = shipmentData.origin;
    const destination = shipmentData.destination;
    const unitSystem = shipmentData.unitSystem || 'imperial';

    // Calculate total weight and dimensions
    let totalWeight = 0;
    let totalVolume = 0;
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
    });

    // Calculate skid equivalents for skid-based pricing
    const skidFootprint = unitSystem === 'metric' ? (121.92 * 121.92) : (48 * 48);
    const totalFootprint = packages.reduce((sum, pkg) => {
        const length = parseFloat(pkg.length || (unitSystem === 'metric' ? 121.92 : 48));
        const width = parseFloat(pkg.width || (unitSystem === 'metric' ? 121.92 : 48));
        const quantity = parseInt(pkg.quantity || 1);
        return sum + (length * width * quantity);
    }, 0);
    
    const skidEquivalents = Math.ceil(totalFootprint / skidFootprint);

    // Normalize city names for terminal lookup
    const originCity = normalizeCity(origin?.city);
    const destinationCity = normalizeCity(destination?.city);
    const originProvince = normalizeProvince(origin?.province || origin?.state);
    const destinationProvince = normalizeProvince(destination?.province || destination?.state);

    return {
        totalWeight: Math.round(totalWeight * 100) / 100,
        totalVolume: Math.round(totalVolume * 100) / 100,
        skidEquivalents,
        totalPieces,
        packageCount: packages.length,
        unitSystem,
        route: {
            origin: {
                city: originCity,
                province: originProvince,
                postalCode: origin?.postalCode,
                raw: origin
            },
            destination: {
                city: destinationCity,
                province: destinationProvince,
                postalCode: destination?.postalCode,
                raw: destination
            }
        }
    };
}

/**
 * Calculate rates based on configuration format
 */
async function calculateRatesByFormat(config, metrics, shipmentData, carrierData) {
    switch (config.format) {
        case 'terminal_weight_based':
            return calculateTerminalWeightBasedRates(config, metrics, shipmentData);
        
        case 'skid_based':
            return calculateSkidBasedRates(config, metrics, shipmentData);
        
        case 'zone_matrix':
            return calculateZoneMatrixRates(config, metrics, shipmentData);
        
        case 'hybrid_terminal_zone':
            return calculateHybridRates(config, metrics, shipmentData);
        
        default:
            throw new Error(`Unsupported configuration format: ${config.format}`);
    }
}

/**
 * Calculate terminal + weight-based rates (APEX style)
 */
function calculateTerminalWeightBasedRates(config, metrics, shipmentData) {
    const { terminalMapping, terminalRates } = config;
    
    // Step 1: Find origin and destination terminals
    const originTerminal = findTerminalForCity(
        metrics.route.origin.city,
        metrics.route.origin.province,
        terminalMapping
    );
    
    const destinationTerminal = findTerminalForCity(
        metrics.route.destination.city,
        metrics.route.destination.province,
        terminalMapping
    );
    
    if (!originTerminal) {
        throw new Error(`No terminal found for origin: ${metrics.route.origin.city}, ${metrics.route.origin.province}`);
    }
    
    if (!destinationTerminal) {
        throw new Error(`No terminal found for destination: ${metrics.route.destination.city}, ${metrics.route.destination.province}`);
    }
    
    // Step 2: Find applicable rate between terminals
    const applicableRate = findTerminalRate(
        originTerminal.terminalCode,
        destinationTerminal.terminalCode,
        metrics.totalWeight,
        terminalRates
    );
    
    if (!applicableRate) {
        throw new Error(`No rate found between terminals ${originTerminal.terminalCode} and ${destinationTerminal.terminalCode} for weight ${metrics.totalWeight} lbs`);
    }
    
    // Step 3: Calculate rate based on rate type
    let freightCharge = 0;
    let calculationDetails = '';
    
    switch (applicableRate.rateType) {
        case 'PER_100LBS':
            const weightHundreds = metrics.totalWeight / 100;
            freightCharge = weightHundreds * applicableRate.rateValue;
            calculationDetails = `${weightHundreds.toFixed(2)} × $${applicableRate.rateValue}/100lbs = $${freightCharge.toFixed(2)}`;
            break;
            
        case 'PER_LB':
            freightCharge = metrics.totalWeight * applicableRate.rateValue;
            calculationDetails = `${metrics.totalWeight} lbs × $${applicableRate.rateValue}/lb = $${freightCharge.toFixed(2)}`;
            break;
            
        case 'FLAT_RATE':
            freightCharge = applicableRate.rateValue;
            calculationDetails = `Flat rate: $${freightCharge.toFixed(2)}`;
            break;
            
        default:
            throw new Error(`Unknown rate type: ${applicableRate.rateType}`);
    }
    
    // Apply minimum charge
    const originalFreightCharge = freightCharge;
    freightCharge = Math.max(freightCharge, applicableRate.minCharge);
    
    if (freightCharge > originalFreightCharge) {
        calculationDetails += ` (min charge: $${applicableRate.minCharge})`;
    }
    
    const fuelSurcharge = freightCharge * (applicableRate.fuelSurcharge / 100);
    const totalCharge = freightCharge + fuelSurcharge;
    
    const rateBreakdown = [
        {
            id: 1,
            carrier: config.carrierName || 'Auto',
            code: 'FRT',
            chargeName: `Freight - ${metrics.totalWeight} lbs (${applicableRate.rateType.replace('_', ' ')})`,
            cost: (freightCharge * 0.7).toFixed(2),
            costCurrency: config.currency || 'CAD',
            charge: freightCharge.toFixed(2),
            chargeCurrency: config.currency || 'CAD',
            source: 'terminal_weight_based'
        }
    ];
    
    if (fuelSurcharge > 0) {
        rateBreakdown.push({
            id: 2,
            carrier: config.carrierName || 'Auto',
            code: 'FSC',
            chargeName: `Fuel Surcharge (${applicableRate.fuelSurcharge}%)`,
            cost: (fuelSurcharge * 0.7).toFixed(2),
            costCurrency: config.currency || 'CAD',
            charge: fuelSurcharge.toFixed(2),
            chargeCurrency: config.currency || 'CAD',
            source: 'terminal_weight_based'
        });
    }
    
    return {
        rateBreakdown,
        baseTotal: freightCharge,
        finalTotal: totalCharge,
        transitTime: `${applicableRate.transitDays} business day${applicableRate.transitDays > 1 ? 's' : ''}`,
        routingInfo: {
            originTerminal: originTerminal.terminalCode,
            originTerminalName: originTerminal.terminalName,
            destinationTerminal: destinationTerminal.terminalCode,
            destinationTerminalName: destinationTerminal.terminalName,
            weightBreak: `${applicableRate.weightMin}-${applicableRate.weightMax} lbs`,
            rateType: applicableRate.rateType,
            rateValue: applicableRate.rateValue,
            minCharge: applicableRate.minCharge,
            calculation: calculationDetails
        }
    };
}

/**
 * Calculate skid-based rates (simple carriers)
 */
function calculateSkidBasedRates(config, metrics, shipmentData) {
    const { skidRates } = config;
    const skidCount = Math.max(1, metrics.skidEquivalents);
    
    // Find applicable skid rate
    let applicableRate = skidRates.find(rate => rate.skidCount === skidCount);
    
    // If exact match not found, find next higher skid count
    if (!applicableRate) {
        applicableRate = skidRates
            .filter(rate => rate.skidCount >= skidCount)
            .sort((a, b) => a.skidCount - b.skidCount)[0];
    }
    
    // If still no match, use highest available rate
    if (!applicableRate) {
        applicableRate = skidRates
            .sort((a, b) => b.skidCount - a.skidCount)[0];
    }
    
    if (!applicableRate) {
        throw new Error(`No skid rate configuration found for ${skidCount} skids`);
    }
    
    const baseRate = applicableRate.rate;
    const fuelSurcharge = baseRate * (applicableRate.fuelSurcharge / 100);
    const totalCharge = baseRate + fuelSurcharge;
    
    const rateBreakdown = [
        {
            id: 1,
            carrier: config.carrierName || 'Auto',
            code: 'FRT',
            chargeName: `Freight - ${skidCount} Skid${skidCount > 1 ? 's' : ''} (${metrics.totalWeight} lbs)`,
            cost: (baseRate * 0.7).toFixed(2),
            costCurrency: config.currency || 'CAD',
            charge: baseRate.toFixed(2),
            chargeCurrency: config.currency || 'CAD',
            source: 'skid_based'
        }
    ];
    
    if (fuelSurcharge > 0) {
        rateBreakdown.push({
            id: 2,
            carrier: config.carrierName || 'Auto',
            code: 'FSC',
            chargeName: `Fuel Surcharge (${applicableRate.fuelSurcharge}%)`,
            cost: (fuelSurcharge * 0.7).toFixed(2),
            costCurrency: config.currency || 'CAD',
            charge: fuelSurcharge.toFixed(2),
            chargeCurrency: config.currency || 'CAD',
            source: 'skid_based'
        });
    }
    
    return {
        rateBreakdown,
        baseTotal: baseRate,
        finalTotal: totalCharge,
        transitTime: `${applicableRate.transitDays} business day${applicableRate.transitDays > 1 ? 's' : ''}`,
        routingInfo: {
            skidCount,
            rateUsed: applicableRate.skidCount,
            calculation: `${skidCount} skid${skidCount > 1 ? 's' : ''} @ $${applicableRate.rate}`,
            notes: applicableRate.notes
        }
    };
}

/**
 * Helper functions
 */

function normalizeCity(city) {
    if (!city) return '';
    return city.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '');
}

function normalizeProvince(province) {
    if (!province) return '';
    return province.trim().toUpperCase();
}

function findTerminalForCity(city, province, terminalMapping) {
    const normalizedCity = normalizeCity(city);
    const normalizedProvince = normalizeProvince(province);
    
    // Direct city match
    const directMatch = terminalMapping.find(mapping => 
        mapping.city === normalizedCity && mapping.province === normalizedProvince
    );
    
    if (directMatch) {
        return directMatch;
    }
    
    // Fuzzy city match (handle variations)
    const fuzzyMatch = terminalMapping.find(mapping => {
        if (mapping.province !== normalizedProvince) return false;
        
        // Check if cities are similar (handle spaces, punctuation)
        const mappingCity = mapping.city.replace(/\s+/g, '');
        const searchCity = normalizedCity.replace(/\s+/g, '');
        
        return mappingCity.includes(searchCity) || searchCity.includes(mappingCity);
    });
    
    return fuzzyMatch || null;
}

function findTerminalRate(originTerminal, destinationTerminal, weight, terminalRates) {
    return terminalRates.find(rate => 
        rate.originTerminal === originTerminal &&
        rate.destinationTerminal === destinationTerminal &&
        weight >= rate.weightMin &&
        weight <= rate.weightMax
    );
}

// Placeholder implementations for other formats
function calculateZoneMatrixRates(config, metrics, shipmentData) {
    // Implementation for zone-based pricing
    throw new Error('Zone matrix pricing not yet implemented');
}

function calculateHybridRates(config, metrics, shipmentData) {
    // Implementation for hybrid pricing models
    throw new Error('Hybrid pricing not yet implemented');
}
