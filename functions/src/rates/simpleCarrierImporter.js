/**
 * Simple Carrier Importer - The Real-World Solution
 * Handles the most common carrier CSV format: From/To locations with skid or weight rates
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Generate simple carrier rate template (the format 90% of carriers use)
 */
exports.generateSimpleCarrierTemplate = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
            }

            const { templateType = 'city_to_city_skid', includePostal = false } = data;

            logger.info('📋 Generating simple carrier template', { templateType, includePostal });

            let template;

            switch (templateType) {
                case 'city_to_city_skid':
                    template = generateCityToCitySkidTemplate(includePostal);
                    break;
                case 'city_to_city_weight':
                    template = generateCityToCityWeightTemplate(includePostal);
                    break;
                case 'postal_to_postal_skid':
                    template = generatePostalToPostalSkidTemplate();
                    break;
                case 'postal_to_postal_weight':
                    template = generatePostalToPostalWeightTemplate();
                    break;
                default:
                    throw new functions.https.HttpsError('invalid-argument', 'Invalid template type');
            }

            return {
                success: true,
                template,
                fileName: `${templateType}_template.csv`,
                instructions: [
                    'Fill in your carrier\'s rate data using this template',
                    'From/To locations can be cities or postal codes',
                    'Rates should be in CAD unless specified otherwise',
                    'Leave fields empty if not applicable to your carrier',
                    'Contact support if you need help mapping your data'
                ]
            };

        } catch (error) {
            logger.error('❌ Error generating simple template', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to generate template',
                error.message
            );
        }
    });

/**
 * Import simple carrier rates from standardized CSV
 */
exports.importSimpleCarrierRates = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 120,
        memory: '512MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
            }

            const {
                carrierId,
                carrierName,
                csvData,
                templateType,
                currency = 'CAD',
                effectiveDate = new Date().toISOString()
            } = data;

            if (!carrierId || !csvData || !templateType) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID, CSV data, and template type are required'
                );
            }

            logger.info('📥 Importing simple carrier rates', {
                carrierId,
                carrierName,
                templateType,
                rows: csvData.length - 1
            });

            // Validate CSV structure
            const validation = validateSimpleCSV(csvData, templateType);
            if (!validation.valid) {
                return {
                    success: false,
                    validationErrors: validation.errors,
                    sampleErrors: validation.sampleErrors
                };
            }

            // Process CSV data
            const processedRates = processSimpleCarrierCSV(csvData, templateType);

            // Save to database
            const rateCardData = {
                carrierId: carrierId.trim(),
                carrierName: carrierName?.trim() || '',
                templateType: templateType,
                rateStructure: templateType.includes('skid') ? 'skid_based' : 'weight_based',
                locationFormat: templateType.includes('postal') ? 'postal_code' : 'city_name',
                currency: currency,
                effectiveDate: admin.firestore.Timestamp.fromDate(new Date(effectiveDate)),
                rates: processedRates,
                recordCount: processedRates.length,
                importedAt: admin.firestore.FieldValue.serverTimestamp(),
                importedBy: context.auth.uid,
                enabled: true,
                version: 1,
                metadata: {
                    csvRows: csvData.length - 1,
                    successfulRows: processedRates.length,
                    source: 'simple_carrier_import'
                }
            };

            const rateCardRef = await db.collection('carrierRateCards').add(rateCardData);

            logger.info('✅ Simple carrier rates imported', {
                rateCardId: rateCardRef.id,
                carrierId,
                processedRows: processedRates.length
            });

            return {
                success: true,
                rateCardId: rateCardRef.id,
                processedRows: processedRates.length,
                templateType: templateType,
                message: 'Carrier rates imported successfully'
            };

        } catch (error) {
            logger.error('❌ Error importing simple carrier rates', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to import carrier rates',
                error.message
            );
        }
    });

/**
 * Look up rates for simple carriers
 */
exports.getSimpleCarrierRates = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
            }

            const {
                carrierId,
                fromLocation,
                toLocation,
                shipmentData
            } = data;

            if (!carrierId || !fromLocation || !toLocation || !shipmentData) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID, from/to locations, and shipment data are required'
                );
            }

            logger.info('🔍 Looking up simple carrier rates', {
                carrierId,
                fromLocation,
                toLocation,
                weight: shipmentData.totalWeight,
                skids: shipmentData.totalSkids
            });

            // Get carrier rate card
            const rateCardSnapshot = await db.collection('carrierRateCards')
                .where('carrierId', '==', carrierId)
                .where('enabled', '==', true)
                .orderBy('version', 'desc')
                .limit(1)
                .get();

            if (rateCardSnapshot.empty) {
                throw new functions.https.HttpsError('not-found', 'No rate card found for carrier');
            }

            const rateCard = rateCardSnapshot.docs[0].data();

            // Find matching rate
            const matchingRate = findMatchingRate(rateCard, fromLocation, toLocation, shipmentData);

            if (!matchingRate) {
                return {
                    success: false,
                    error: 'No matching rate found for this route',
                    availableRoutes: getAvailableRoutes(rateCard, fromLocation, toLocation)
                };
            }

            // Calculate final rate
            const calculatedRate = calculateFinalRate(matchingRate, shipmentData, rateCard);

            logger.info('✅ Rate found for simple carrier', {
                carrierId,
                route: `${fromLocation} → ${toLocation}`,
                baseRate: calculatedRate.baseRate,
                totalRate: calculatedRate.totalRate
            });

            return {
                success: true,
                rate: calculatedRate,
                rateCard: {
                    id: rateCardSnapshot.docs[0].id,
                    templateType: rateCard.templateType,
                    currency: rateCard.currency,
                    effectiveDate: rateCard.effectiveDate?.toDate?.()?.toISOString()
                }
            };

        } catch (error) {
            logger.error('❌ Error getting simple carrier rates', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to get carrier rates',
                error.message
            );
        }
    });

/**
 * Template Generators
 */

function generateCityToCitySkidTemplate(includePostal = false) {
    const baseHeaders = ['From_City', 'From_Province_State', 'To_City', 'To_Province_State'];
    
    if (includePostal) {
        baseHeaders.splice(2, 0, 'From_Postal_Zip');
        baseHeaders.splice(5, 0, 'To_Postal_Zip');
    }

    const skidHeaders = [];
    for (let i = 1; i <= 26; i++) {
        skidHeaders.push(`${i}_Skid_Rate`);
    }

    const headers = [
        ...baseHeaders,
        'Min_Weight_Lbs',
        ...skidHeaders,
        'Max_Weight_Per_Skid'
    ];

    const sampleData = [
        [
            'Toronto', 'ON', includePostal ? 'M5V3A8' : '', 'Montreal', 'QC', includePostal ? 'H3B2G7' : '',
            '100',
            '485.00', '650.00', '815.00', '980.00', '1145.00', '1310.00', '1475.00', '1640.00', '1805.00', '1970.00',
            '2135.00', '2300.00', '2465.00', '2630.00', '2795.00', '2960.00', '3125.00', '3290.00', '3455.00', '3620.00',
            '3785.00', '3950.00', '4115.00', '4280.00', '4445.00', '4610.00',
            '2000'
        ],
        [
            'Toronto', 'ON', includePostal ? 'M5V3A8' : '', 'Vancouver', 'BC', includePostal ? 'V6B2G7' : '',
            '100',
            '1250.00', '1485.00', '1720.00', '1955.00', '2190.00', '2425.00', '2660.00', '2895.00', '3130.00', '3365.00',
            '3600.00', '3835.00', '4070.00', '4305.00', '4540.00', '4775.00', '5010.00', '5245.00', '5480.00', '5715.00',
            '5950.00', '6185.00', '6420.00', '6655.00', '6890.00', '7125.00',
            '2000'
        ]
    ];

    return {
        headers: headers,
        sampleData: sampleData,
        csvContent: [headers, ...sampleData].map(row => row.join(',')).join('\n')
    };
}

function generateCityToCityWeightTemplate(includePostal = false) {
    const baseHeaders = ['From_City', 'From_Province_State', 'To_City', 'To_Province_State'];
    
    if (includePostal) {
        baseHeaders.splice(2, 0, 'From_Postal_Zip');
        baseHeaders.splice(5, 0, 'To_Postal_Zip');
    }

    const headers = [
        ...baseHeaders,
        'Weight_Min_Lbs',
        'Weight_Max_Lbs',
        'Rate_Per_100Lbs',
        'Min_Charge'
    ];

    const sampleData = [
        [
            'Toronto', 'ON', includePostal ? 'M5V3A8' : '', 'Montreal', 'QC', includePostal ? 'H3B2G7' : '',
            '0', '500', '78.50', '125.00'
        ],
        [
            'Toronto', 'ON', includePostal ? 'M5V3A8' : '', 'Montreal', 'QC', includePostal ? 'H3B2G7' : '',
            '501', '1000', '65.25', '275.00'
        ],
        [
            'Toronto', 'ON', includePostal ? 'M5V3A8' : '', 'Montreal', 'QC', includePostal ? 'H3B2G7' : '',
            '1001', '5000', '52.75', '485.00'
        ]
    ];

    return {
        headers: headers,
        sampleData: sampleData,
        csvContent: [headers, ...sampleData].map(row => row.join(',')).join('\n')
    };
}

function generatePostalToPostalSkidTemplate() {
    const headers = [
        'From_Postal_FSA', 'To_Postal_FSA'
    ];

    // Add skid rates
    for (let i = 1; i <= 26; i++) {
        headers.push(`${i}_Skid_Rate`);
    }

    headers.push('Min_Weight_Lbs', 'Max_Weight_Per_Skid');

    const sampleData = [
        [
            'M5V', 'H3B',
            '485.00', '650.00', '815.00', '980.00', '1145.00', '1310.00', '1475.00', '1640.00', '1805.00', '1970.00',
            '2135.00', '2300.00', '2465.00', '2630.00', '2795.00', '2960.00', '3125.00', '3290.00', '3455.00', '3620.00',
            '3785.00', '3950.00', '4115.00', '4280.00', '4445.00', '4610.00',
            '100', '2000'
        ],
        [
            'M5V', 'V6B',
            '1250.00', '1485.00', '1720.00', '1955.00', '2190.00', '2425.00', '2660.00', '2895.00', '3130.00', '3365.00',
            '3600.00', '3835.00', '4070.00', '4305.00', '4540.00', '4775.00', '5010.00', '5245.00', '5480.00', '5715.00',
            '5950.00', '6185.00', '6420.00', '6655.00', '6890.00', '7125.00',
            '100', '2000'
        ]
    ];

    return {
        headers: headers,
        sampleData: sampleData,
        csvContent: [headers, ...sampleData].map(row => row.join(',')).join('\n')
    };
}

function generatePostalToPostalWeightTemplate() {
    const headers = [
        'From_Postal_FSA',
        'To_Postal_FSA',
        'Weight_Min_Lbs',
        'Weight_Max_Lbs',
        'Rate_Per_100Lbs',
        'Min_Charge'
    ];

    const sampleData = [
        ['M5V', 'H3B', '0', '500', '78.50', '125.00'],
        ['M5V', 'H3B', '501', '1000', '65.25', '275.00'],
        ['M5V', 'H3B', '1001', '5000', '52.75', '485.00']
    ];

    return {
        headers: headers,
        sampleData: sampleData,
        csvContent: [headers, ...sampleData].map(row => row.join(',')).join('\n')
    };
}

/**
 * Validation Functions
 */

function validateSimpleCSV(csvData, templateType) {
    const errors = [];
    const sampleErrors = [];

    if (csvData.length < 2) {
        errors.push('CSV must contain at least header row and one data row');
        return { valid: false, errors, sampleErrors };
    }

    const headers = csvData[0];
    const dataRows = csvData.slice(1);

    // Validate required columns based on template type
    const requiredColumns = getRequiredColumns(templateType);
    requiredColumns.forEach(column => {
        if (!headers.includes(column)) {
            errors.push(`Required column '${column}' not found`);
        }
    });

    // Validate sample data
    const sampleSize = Math.min(dataRows.length, 5);
    for (let i = 0; i < sampleSize; i++) {
        const row = dataRows[i];
        const rowErrors = validateDataRow(row, headers, templateType, i + 2);
        sampleErrors.push(...rowErrors);
    }

    return {
        valid: errors.length === 0,
        errors,
        sampleErrors: sampleErrors.slice(0, 10) // Limit to 10 sample errors
    };
}

function getRequiredColumns(templateType) {
    const baseColumns = templateType.includes('postal') 
        ? ['From_Postal_FSA', 'To_Postal_FSA']
        : ['From_City', 'From_Province_State', 'To_City', 'To_Province_State'];

    if (templateType.includes('skid')) {
        return [...baseColumns, '1_Skid_Rate'];
    } else {
        return [...baseColumns, 'Weight_Min_Lbs', 'Weight_Max_Lbs', 'Rate_Per_100Lbs'];
    }
}

function validateDataRow(row, headers, templateType, rowNum) {
    const errors = [];

    // Check from/to locations
    const fromCity = getColumnValue(row, headers, templateType.includes('postal') ? 'From_Postal_FSA' : 'From_City');
    const toCity = getColumnValue(row, headers, templateType.includes('postal') ? 'To_Postal_FSA' : 'To_City');

    if (!fromCity?.trim()) {
        errors.push(`Row ${rowNum}: From location is required`);
    }
    if (!toCity?.trim()) {
        errors.push(`Row ${rowNum}: To location is required`);
    }

    // Check rates
    if (templateType.includes('skid')) {
        const rate1 = getColumnValue(row, headers, '1_Skid_Rate');
        if (!rate1 || isNaN(parseFloat(rate1))) {
            errors.push(`Row ${rowNum}: 1_Skid_Rate must be a valid number`);
        }
    } else {
        const weightMin = getColumnValue(row, headers, 'Weight_Min_Lbs');
        const weightMax = getColumnValue(row, headers, 'Weight_Max_Lbs');
        const rate = getColumnValue(row, headers, 'Rate_Per_100Lbs');

        if (!weightMin || isNaN(parseFloat(weightMin))) {
            errors.push(`Row ${rowNum}: Weight_Min_Lbs must be a valid number`);
        }
        if (!rate || isNaN(parseFloat(rate))) {
            errors.push(`Row ${rowNum}: Rate_Per_100Lbs must be a valid number`);
        }
    }

    return errors;
}

function getColumnValue(row, headers, columnName) {
    const index = headers.indexOf(columnName);
    return index >= 0 ? row[index] : null;
}

/**
 * Processing Functions
 */

function processSimpleCarrierCSV(csvData, templateType) {
    const headers = csvData[0];
    const dataRows = csvData.slice(1);
    const processedRates = [];

    dataRows.forEach((row, index) => {
        try {
            const processedRate = processDataRow(row, headers, templateType, index + 2);
            if (processedRate) {
                processedRates.push(processedRate);
            }
        } catch (error) {
            console.warn(`Error processing row ${index + 2}:`, error.message);
        }
    });

    return processedRates;
}

function processDataRow(row, headers, templateType, rowNum) {
    const isPostal = templateType.includes('postal');
    const isSkid = templateType.includes('skid');

    // Extract location data
    const fromLocation = isPostal 
        ? getColumnValue(row, headers, 'From_Postal_FSA')
        : {
            city: getColumnValue(row, headers, 'From_City'),
            province: getColumnValue(row, headers, 'From_Province_State'),
            postal: getColumnValue(row, headers, 'From_Postal_Zip')
        };

    const toLocation = isPostal
        ? getColumnValue(row, headers, 'To_Postal_FSA')
        : {
            city: getColumnValue(row, headers, 'To_City'),
            province: getColumnValue(row, headers, 'To_Province_State'),
            postal: getColumnValue(row, headers, 'To_Postal_Zip')
        };

    // Extract rate data
    const rateData = {
        rowNumber: rowNum,
        fromLocation: fromLocation,
        toLocation: toLocation,
        locationType: isPostal ? 'postal' : 'city',
        rateType: isSkid ? 'skid_based' : 'weight_based',

        minWeight: parseFloat(getColumnValue(row, headers, 'Min_Weight_Lbs')) || 0
    };

    if (isSkid) {
        // Extract skid rates
        rateData.skidRates = {};
        for (let i = 1; i <= 26; i++) {
            const rate = getColumnValue(row, headers, `${i}_Skid_Rate`);
            if (rate && !isNaN(parseFloat(rate))) {
                rateData.skidRates[i] = parseFloat(rate);
            }
        }
        rateData.maxWeightPerSkid = parseInt(getColumnValue(row, headers, 'Max_Weight_Per_Skid')) || 2000;
    } else {
        // Extract weight-based rates
        rateData.weightMin = parseFloat(getColumnValue(row, headers, 'Weight_Min_Lbs')) || 0;
        rateData.weightMax = parseFloat(getColumnValue(row, headers, 'Weight_Max_Lbs')) || null;
        rateData.ratePer100Lbs = parseFloat(getColumnValue(row, headers, 'Rate_Per_100Lbs')) || 0;
        rateData.minCharge = parseFloat(getColumnValue(row, headers, 'Min_Charge')) || 0;
    }

    return rateData;
}

/**
 * Rate Lookup Functions
 */

function findMatchingRate(rateCard, fromLocation, toLocation, shipmentData) {
    const rates = rateCard.rates || [];
    
    // Find matching route
    const matchingRates = rates.filter(rate => {
        return matchesLocation(rate.fromLocation, fromLocation, rateCard.locationFormat) &&
               matchesLocation(rate.toLocation, toLocation, rateCard.locationFormat);
    });

    if (matchingRates.length === 0) {
        return null;
    }

    // For weight-based, find matching weight range
    if (rateCard.rateStructure === 'weight_based') {
        const weight = shipmentData.totalWeight || 0;
        return matchingRates.find(rate => 
            weight >= rate.weightMin && 
            (rate.weightMax === null || weight <= rate.weightMax)
        );
    }

    // For skid-based, return first match (no weight ranges)
    return matchingRates[0];
}

function matchesLocation(rateLocation, searchLocation, locationType) {
    if (locationType === 'postal') {
        return normalizePostal(rateLocation) === normalizePostal(searchLocation);
    } else {
        // City matching - try exact match first, then fuzzy match
        if (typeof rateLocation === 'string') {
            return normalizeCity(rateLocation) === normalizeCity(searchLocation);
        } else {
            return normalizeCity(rateLocation.city) === normalizeCity(searchLocation) ||
                   normalizeCity(rateLocation.city + ', ' + rateLocation.province) === normalizeCity(searchLocation);
        }
    }
}

function normalizePostal(postal) {
    if (!postal) return '';
    return postal.toString().replace(/\s+/g, '').toUpperCase().substring(0, 3);
}

function normalizeCity(city) {
    if (!city) return '';
    return city.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function calculateFinalRate(matchingRate, shipmentData, rateCard) {
    let baseRate = 0;
    let calculation = '';

    if (rateCard.rateStructure === 'skid_based') {
        const skidCount = shipmentData.totalSkids || calculateSkidsFromWeight(shipmentData.totalWeight, matchingRate.maxWeightPerSkid);
        baseRate = matchingRate.skidRates[skidCount] || matchingRate.skidRates[26] || 0; // Fallback to max skid rate
        calculation = `${skidCount} skids @ $${baseRate}`;
    } else {
        const weight = shipmentData.totalWeight || 0;
        const weightHundreds = weight / 100;
        baseRate = weightHundreds * matchingRate.ratePer100Lbs;
        
        // Apply minimum charge
        if (matchingRate.minCharge && baseRate < matchingRate.minCharge) {
            baseRate = matchingRate.minCharge;
            calculation = `${weight} lbs (minimum charge applied) = $${baseRate}`;
        } else {
            calculation = `${weightHundreds.toFixed(2)} cwt × $${matchingRate.ratePer100Lbs}/cwt = $${baseRate.toFixed(2)}`;
        }
    }

    // No fuel surcharge applied
    const totalRate = baseRate;

    return {
        baseRate: parseFloat(baseRate.toFixed(2)),
        totalRate: parseFloat(totalRate.toFixed(2)),
        calculation: calculation,
        rateStructure: rateCard.rateStructure,
        currency: rateCard.currency,
        minWeight: matchingRate.minWeight
    };
}

function calculateSkidsFromWeight(weight, maxWeightPerSkid = 2000) {
    if (!weight || weight <= 0) return 1;
    return Math.ceil(weight / maxWeightPerSkid);
}

function getAvailableRoutes(rateCard, fromLocation, toLocation) {
    const routes = rateCard.rates || [];
    const fromMatches = routes.filter(rate => 
        matchesLocation(rate.fromLocation, fromLocation, rateCard.locationFormat)
    );
    
    if (fromMatches.length === 0) {
        // Show available "from" locations
        return {
            type: 'available_origins',
            locations: [...new Set(routes.map(rate => 
                typeof rate.fromLocation === 'string' 
                    ? rate.fromLocation 
                    : `${rate.fromLocation.city}, ${rate.fromLocation.province}`
            ))].slice(0, 10)
        };
    } else {
        // Show available "to" locations for this "from"
        return {
            type: 'available_destinations',
            locations: [...new Set(fromMatches.map(rate => 
                typeof rate.toLocation === 'string' 
                    ? rate.toLocation 
                    : `${rate.toLocation.city}, ${rate.toLocation.province}`
            ))].slice(0, 10)
        };
    }
}
