/**
 * Rate Template Management System
 * Handles CSV template generation, validation, and import for carrier rate cards
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Generate CSV template for rate card upload
 */
exports.generateRateTemplate = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data, context) => {
        try {
            const { templateType, carrierId } = data;

            if (!templateType) {
                throw new functions.https.HttpsError('invalid-argument', 'Template type is required');
            }

            const template = generateTemplateByType(templateType);
            
            return {
                success: true,
                templateType,
                fileName: `${templateType}_rate_template.csv`,
                csvContent: template.csvContent,
                headers: template.headers,
                sampleData: template.sampleData,
                instructions: template.instructions
            };

        } catch (error) {
            functions.logger.error('❌ Template generation error', { error: error.message });
            throw new functions.https.HttpsError('internal', 'Failed to generate template', error.message);
        }
    });

/**
 * Validate and import rate card from CSV data
 */
exports.importRateCard = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 60, memory: '512MB' })
    .https.onCall(async (data, context) => {
        try {
            const { carrierId, templateType, csvData, rateCardName, currency = 'CAD', serviceLevel = 'Standard' } = data;

            if (!carrierId || !templateType || !csvData) {
                throw new functions.https.HttpsError('invalid-argument', 'Carrier ID, template type, and CSV data are required');
            }

            // Validate CSV data structure
            const validation = validateCsvData(csvData, templateType);
            if (!validation.valid) {
                return {
                    success: false,
                    errors: validation.errors,
                    validationFailed: true
                };
            }

            // Parse and transform CSV data into rate card format
            const rateCardData = transformCsvToRateCard(csvData, templateType, {
                carrierId,
                rateCardName: rateCardName || `${templateType} Rate Card`,
                currency,
                serviceLevel
            });

            // Save to database
            const rateCardRef = await db.collection('carrierRateCards').add({
                ...rateCardData,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth?.uid || 'system',
                enabled: true,
                source: 'csv_import'
            });

            functions.logger.info('✅ Rate card imported successfully', {
                rateCardId: rateCardRef.id,
                carrierId,
                templateType,
                recordCount: csvData.length
            });

            return {
                success: true,
                rateCardId: rateCardRef.id,
                rateCardName: rateCardData.rateCardName,
                recordCount: csvData.length,
                templateType,
                summary: generateImportSummary(rateCardData, templateType)
            };

        } catch (error) {
            functions.logger.error('❌ Rate card import error', { error: error.message });
            throw new functions.https.HttpsError('internal', 'Failed to import rate card', error.message);
        }
    });

/**
 * Get available rate templates
 */
exports.getRateTemplates = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data, context) => {
        try {
            const templates = {
                skid_based: {
                    name: 'Skid-Based Pricing',
                    description: 'Pricing based on number of skids (1-26 skids)',
                    fields: ['Skid_Count', 'Rate', 'Fuel_Surcharge_Pct', 'Transit_Days', 'Max_Weight_Per_Skid', 'Notes'],
                    icon: '📦',
                    recommended: true
                },
                weight_distance: {
                    name: 'Weight + Distance Matrix',
                    description: 'Pricing based on weight breaks and distance factors',
                    fields: ['Weight_Min', 'Weight_Max', 'Rate_Per_LB', 'Min_Charge', 'Distance_Factor', 'Fuel_Pct'],
                    icon: '⚖️'
                },
                zone_matrix: {
                    name: 'Zone-to-Zone Rates',
                    description: 'Fixed rates between origin and destination zones',
                    fields: ['Origin_Zone', 'Dest_Zone', 'Base_Rate', 'Fuel_Pct', 'Transit_Days', 'Max_Weight'],
                    icon: '🗺️'
                },
                dimensional_weight: {
                    name: 'Dimensional Weight Pricing',
                    description: 'Pricing based on dimensional weight calculations',
                    fields: ['Service_Level', 'DIM_Factor', 'Rate_Per_LB', 'Min_Charge', 'Max_Dimensions'],
                    icon: '📏'
                },
                hybrid_complex: {
                    name: 'Hybrid Complex Pricing',
                    description: 'Complex pricing combining multiple factors',
                    fields: ['Base_Rate', 'Skid_Rate', 'Weight_Rate', 'Distance_Rate', 'Fuel_Pct', 'Service_Level'],
                    icon: '🔧'
                }
            };

            return {
                success: true,
                templates
            };

        } catch (error) {
            functions.logger.error('❌ Get templates error', { error: error.message });
            throw new functions.https.HttpsError('internal', 'Failed to get templates', error.message);
        }
    });

/**
 * Generate template content by type
 */
function generateTemplateByType(templateType) {
    switch (templateType) {
        case 'skid_based':
            return generateSkidTemplate();
        case 'weight_distance':
            return generateWeightDistanceTemplate();
        case 'zone_matrix':
            return generateZoneMatrixTemplate();
        case 'dimensional_weight':
            return generateDimensionalTemplate();
        case 'hybrid_complex':
            return generateHybridTemplate();
        default:
            throw new Error(`Unknown template type: ${templateType}`);
    }
}

/**
 * Enhanced skid-based template with realistic Canadian pricing
 */
function generateSkidTemplate() {
    const headers = ['Skid_Count', 'Sell', 'Fuel_Surcharge_Pct', 'Transit_Days', 'Max_Weight_Per_Skid', 'Notes'];
    
    // Realistic modern Canadian skid pricing (CAD)
    const sampleData = [
        ['1', '485.00', '15.5', '2', '2000', 'Single skid LTL'],
        ['2', '650.00', '15.5', '2', '2000', 'Two skid LTL'],
        ['3', '815.00', '15.5', '3', '2000', 'Three skid LTL'],
        ['4', '980.00', '15.5', '3', '2000', 'Four skid LTL'],
        ['5', '1145.00', '15.5', '3', '2000', 'Five skid LTL'],
        ['6', '1310.00', '15.5', '3', '2000', 'Six skid LTL'],
        ['7', '1475.00', '15.5', '4', '2000', 'Seven skid LTL'],
        ['8', '1640.00', '15.5', '4', '2000', 'Eight skid LTL'],
        ['9', '1805.00', '15.5', '4', '2000', 'Nine skid LTL'],
        ['10', '1970.00', '15.5', '4', '2000', 'Ten skid LTL'],
        ['11', '2135.00', '15.5', '4', '2000', 'Eleven skid partial'],
        ['12', '2300.00', '15.5', '5', '2000', 'Twelve skid partial'],
        ['13', '2465.00', '15.5', '5', '2000', 'Thirteen skid partial'],
        ['14', '2630.00', '15.5', '5', '2000', 'Fourteen skid partial'],
        ['15', '2795.00', '15.5', '5', '2000', 'Fifteen skid partial'],
        ['16', '2960.00', '15.5', '5', '2000', 'Sixteen skid FTL'],
        ['17', '3125.00', '15.5', '5', '2000', 'Seventeen skid FTL'],
        ['18', '3290.00', '15.5', '5', '2000', 'Eighteen skid FTL'],
        ['19', '3455.00', '15.5', '5', '2000', 'Nineteen skid FTL'],
        ['20', '3620.00', '15.5', '5', '2000', 'Twenty skid FTL'],
        ['21', '3785.00', '15.5', '5', '2000', 'Twenty-one skid FTL'],
        ['22', '3950.00', '15.5', '5', '2000', 'Twenty-two skid FTL'],
        ['23', '4115.00', '15.5', '5', '2000', 'Twenty-three skid FTL'],
        ['24', '4280.00', '15.5', '5', '2000', 'Twenty-four skid FTL'],
        ['25', '4445.00', '15.5', '5', '2000', 'Twenty-five skid FTL'],
        ['26', '4610.00', '15.5', '5', '2000', 'Full truck (26 skids)']
    ];

    const csvContent = [headers, ...sampleData]
        .map(row => row.join(','))
        .join('\n');

    return {
        headers,
        sampleData,
        csvContent,
        instructions: [
            'Skid_Count: Number of skids (1-26)',
            'Sell: Your selling price in CAD',
            'Fuel_Surcharge_Pct: Fuel surcharge percentage (typically 15.5%)',
            'Transit_Days: Expected delivery time in business days',
            'Max_Weight_Per_Skid: Maximum weight per skid in pounds',
            'Notes: Optional description for this rate'
        ]
    };
}

/**
 * Weight + Distance template
 */
function generateWeightDistanceTemplate() {
    const headers = ['Weight_Min', 'Weight_Max', 'Rate_Per_LB', 'Min_Charge', 'Distance_Factor', 'Fuel_Pct'];
    
    const sampleData = [
        ['0', '500', '0.95', '185.00', '1.0', '15.5'],
        ['501', '1000', '0.85', '275.00', '1.0', '15.5'],
        ['1001', '2500', '0.75', '485.00', '1.1', '15.5'],
        ['2501', '5000', '0.65', '750.00', '1.2', '15.5'],
        ['5001', '10000', '0.55', '1250.00', '1.3', '15.5'],
        ['10001', '20000', '0.45', '2200.00', '1.4', '15.5'],
        ['20001', '40000', '0.35', '3800.00', '1.5', '15.5'],
        ['40001', '99999', '0.25', '5500.00', '1.6', '15.5']
    ];

    const csvContent = [headers, ...sampleData]
        .map(row => row.join(','))
        .join('\n');

    return {
        headers,
        sampleData,
        csvContent,
        instructions: [
            'Weight_Min: Minimum weight for this rate break (lbs)',
            'Weight_Max: Maximum weight for this rate break (lbs)',
            'Rate_Per_LB: Rate per pound in CAD',
            'Min_Charge: Minimum charge for this weight break',
            'Distance_Factor: Multiplier based on distance (1.0 = no change)',
            'Fuel_Pct: Fuel surcharge percentage'
        ]
    };
}

/**
 * Zone matrix template with all Canadian provinces and US states
 */
function generateZoneMatrixTemplate() {
    const headers = ['Origin_Zone', 'Dest_Zone', 'Base_Rate', 'Fuel_Pct', 'Transit_Days', 'Max_Weight'];
    
    const sampleData = [
        // Canadian interprovincial routes
        ['ON', 'QC', '485.00', '15.5', '2', '10000'],
        ['ON', 'BC', '1250.00', '15.5', '5', '10000'],
        ['ON', 'AB', '975.00', '15.5', '4', '10000'],
        ['QC', 'BC', '1450.00', '15.5', '6', '10000'],
        ['QC', 'AB', '1175.00', '15.5', '5', '10000'],
        ['BC', 'AB', '485.00', '15.5', '2', '10000'],
        ['AB', 'SK', '385.00', '15.5', '2', '10000'],
        ['SK', 'MB', '385.00', '15.5', '2', '10000'],
        ['MB', 'ON', '685.00', '15.5', '3', '10000'],
        // Cross-border routes (sample)
        ['ON', 'NY', '650.00', '15.5', '2', '10000'],
        ['BC', 'WA', '485.00', '15.5', '2', '10000'],
        ['AB', 'MT', '585.00', '15.5', '3', '10000'],
        // US interstate routes (sample)
        ['NY', 'CA', '1850.00', '15.5', '7', '10000'],
        ['TX', 'CA', '1450.00', '15.5', '5', '10000'],
        ['FL', 'NY', '1250.00', '15.5', '4', '10000']
    ];

    const csvContent = [headers, ...sampleData]
        .map(row => row.join(','))
        .join('\n');

    return {
        headers,
        sampleData,
        csvContent,
        instructions: [
            'Origin_Zone: Origin province/state code (ON, QC, BC, NY, CA, etc.)',
            'Dest_Zone: Destination province/state code',
            'Base_Rate: Fixed rate for this route in CAD',
            'Fuel_Pct: Fuel surcharge percentage',
            'Transit_Days: Expected delivery time in business days',
            'Max_Weight: Maximum weight for this route (lbs)'
        ]
    };
}

/**
 * Dimensional weight template
 */
function generateDimensionalTemplate() {
    const headers = ['Service_Level', 'DIM_Factor', 'Rate_Per_LB', 'Min_Charge', 'Max_Dimensions'];
    
    const sampleData = [
        ['Standard', '166', '0.65', '185.00', '96x96x96'],
        ['Express', '139', '0.85', '225.00', '72x72x72'],
        ['Economy', '194', '0.55', '165.00', '120x120x120'],
        ['Overnight', '139', '1.25', '350.00', '48x48x48'],
        ['LTL', '166', '0.45', '275.00', '240x240x120']
    ];

    const csvContent = [headers, ...sampleData]
        .map(row => row.join(','))
        .join('\n');

    return {
        headers,
        sampleData,
        csvContent,
        instructions: [
            'Service_Level: Service type (Standard, Express, Economy, etc.)',
            'DIM_Factor: Dimensional factor for calculation (166 for LTL, 139 for express)',
            'Rate_Per_LB: Rate per dimensional pound in CAD',
            'Min_Charge: Minimum charge for this service level',
            'Max_Dimensions: Maximum package dimensions LxWxH in inches'
        ]
    };
}

/**
 * Hybrid complex template
 */
function generateHybridTemplate() {
    const headers = ['Base_Rate', 'Skid_Rate', 'Weight_Rate', 'Distance_Rate', 'Fuel_Pct', 'Service_Level'];
    
    const sampleData = [
        ['285.00', '125.00', '0.35', '0.65', '15.5', 'Standard'],
        ['485.00', '185.00', '0.55', '0.85', '18.0', 'Express'],
        ['185.00', '95.00', '0.25', '0.45', '15.5', 'Economy'],
        ['685.00', '285.00', '0.85', '1.25', '22.0', 'Overnight'],
        ['385.00', '155.00', '0.45', '0.75', '15.5', 'LTL']
    ];

    const csvContent = [headers, ...sampleData]
        .map(row => row.join(','))
        .join('\n');

    return {
        headers,
        sampleData,
        csvContent,
        instructions: [
            'Base_Rate: Base rate component in CAD',
            'Skid_Rate: Additional rate per skid in CAD',
            'Weight_Rate: Rate per pound component in CAD',
            'Distance_Rate: Rate per mile component in CAD',
            'Fuel_Pct: Fuel surcharge percentage',
            'Service_Level: Service type for this rate structure'
        ]
    };
}

/**
 * Validate CSV data structure
 */
function validateCsvData(csvData, templateType) {
    const errors = [];
    
    if (!Array.isArray(csvData) || csvData.length === 0) {
        return { valid: false, errors: ['CSV data is empty or invalid'] };
    }

    // Get expected headers for template type
    const template = generateTemplateByType(templateType);
    const expectedHeaders = template.headers;

    // Check if first row contains headers
    const firstRow = csvData[0];
    if (!Array.isArray(firstRow)) {
        return { valid: false, errors: ['Invalid CSV format'] };
    }

    // Validate headers
    const missingHeaders = expectedHeaders.filter(header => 
        !firstRow.some(col => col.toLowerCase() === header.toLowerCase())
    );

    if (missingHeaders.length > 0) {
        errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Validate data rows
    const dataRows = csvData.slice(1);
    if (dataRows.length === 0) {
        errors.push('No data rows found');
    }

    // Template-specific validation
    switch (templateType) {
        case 'skid_based':
            errors.push(...validateSkidData(dataRows));
            break;
        case 'weight_distance':
            errors.push(...validateWeightDistanceData(dataRows));
            break;
        case 'zone_matrix':
            errors.push(...validateZoneMatrixData(dataRows));
            break;
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

function validateSkidData(dataRows) {
    const errors = [];
    const skidCounts = new Set();

    dataRows.forEach((row, index) => {
        const rowNum = index + 2; // Account for header row
        const skidCount = parseInt(row[0]);
        const rate = parseFloat(row[1]);

        if (isNaN(skidCount) || skidCount < 1 || skidCount > 26) {
            errors.push(`Row ${rowNum}: Invalid skid count (must be 1-26)`);
        }

        if (skidCounts.has(skidCount)) {
            errors.push(`Row ${rowNum}: Duplicate skid count ${skidCount}`);
        }
        skidCounts.add(skidCount);

        if (isNaN(rate) || rate <= 0) {
            errors.push(`Row ${rowNum}: Invalid rate (must be positive number)`);
        }
    });

    return errors;
}

function validateWeightDistanceData(dataRows) {
    const errors = [];
    let lastMaxWeight = 0;

    dataRows.forEach((row, index) => {
        const rowNum = index + 2;
        const minWeight = parseFloat(row[0]);
        const maxWeight = parseFloat(row[1]);
        const ratePerLb = parseFloat(row[2]);

        if (isNaN(minWeight) || minWeight < 0) {
            errors.push(`Row ${rowNum}: Invalid minimum weight`);
        }

        if (isNaN(maxWeight) || maxWeight <= minWeight) {
            errors.push(`Row ${rowNum}: Maximum weight must be greater than minimum weight`);
        }

        if (minWeight !== lastMaxWeight + 1 && index > 0) {
            errors.push(`Row ${rowNum}: Weight break gap detected`);
        }

        if (isNaN(ratePerLb) || ratePerLb <= 0) {
            errors.push(`Row ${rowNum}: Invalid rate per pound`);
        }

        lastMaxWeight = maxWeight;
    });

    return errors;
}

function validateZoneMatrixData(dataRows) {
    const errors = [];
    const routes = new Set();

    dataRows.forEach((row, index) => {
        const rowNum = index + 2;
        const originZone = row[0]?.trim();
        const destZone = row[1]?.trim();
        const baseRate = parseFloat(row[2]);

        if (!originZone || originZone.length < 2) {
            errors.push(`Row ${rowNum}: Invalid origin zone`);
        }

        if (!destZone || destZone.length < 2) {
            errors.push(`Row ${rowNum}: Invalid destination zone`);
        }

        const routeKey = `${originZone}-${destZone}`;
        if (routes.has(routeKey)) {
            errors.push(`Row ${rowNum}: Duplicate route ${routeKey}`);
        }
        routes.add(routeKey);

        if (isNaN(baseRate) || baseRate <= 0) {
            errors.push(`Row ${rowNum}: Invalid base rate`);
        }
    });

    return errors;
}

/**
 * Transform CSV data into rate card format
 */
function transformCsvToRateCard(csvData, templateType, metadata) {
    const headers = csvData[0];
    const dataRows = csvData.slice(1);

    const baseRateCard = {
        carrierId: metadata.carrierId,
        rateCardName: metadata.rateCardName,
        rateType: templateType,
        rateStructure: templateType,
        currency: metadata.currency,
        serviceLevel: metadata.serviceLevel,
        recordCount: dataRows.length
    };

    switch (templateType) {
        case 'skid_based':
            return {
                ...baseRateCard,
                skidRates: transformSkidData(dataRows, headers)
            };
        case 'weight_distance':
            return {
                ...baseRateCard,
                weightBreaks: transformWeightDistanceData(dataRows, headers)
            };
        case 'zone_matrix':
            return {
                ...baseRateCard,
                zoneMatrix: transformZoneMatrixData(dataRows, headers)
            };
        case 'dimensional_weight':
            return {
                ...baseRateCard,
                dimWeightRates: transformDimensionalData(dataRows, headers)
            };
        case 'hybrid_complex':
            return {
                ...baseRateCard,
                hybridRates: transformHybridData(dataRows, headers)
            };
        default:
            throw new Error(`Unknown template type: ${templateType}`);
    }
}

function transformSkidData(dataRows, headers) {
    return dataRows.map(row => {
        const skidRate = {};
        headers.forEach((header, index) => {
            const value = row[index];
            switch (header.toLowerCase()) {
                case 'skid_count':
                    skidRate.skidCount = parseInt(value);
                    break;
                case 'sell':
                case 'rate':
                    skidRate.rate = parseFloat(value);
                    skidRate.sell = parseFloat(value);
                    break;
                case 'fuel_surcharge_pct':
                    skidRate.fuelSurcharge = parseFloat(value);
                    break;
                case 'transit_days':
                    skidRate.transitDays = value;
                    break;
                case 'max_weight_per_skid':
                    skidRate.maxWeightPerSkid = parseFloat(value);
                    break;
                case 'notes':
                    skidRate.notes = value;
                    break;
            }
        });
        return skidRate;
    });
}

function transformWeightDistanceData(dataRows, headers) {
    return dataRows.map(row => {
        const weightBreak = {};
        headers.forEach((header, index) => {
            const value = row[index];
            switch (header.toLowerCase()) {
                case 'weight_min':
                    weightBreak.minWeight = parseFloat(value);
                    break;
                case 'weight_max':
                    weightBreak.maxWeight = parseFloat(value);
                    break;
                case 'rate_per_lb':
                    weightBreak.ratePerLb = parseFloat(value);
                    break;
                case 'min_charge':
                    weightBreak.minimumCharge = parseFloat(value);
                    break;
                case 'distance_factor':
                    weightBreak.distanceFactor = parseFloat(value);
                    break;
                case 'fuel_pct':
                    weightBreak.fuelSurcharge = parseFloat(value);
                    break;
            }
        });
        return weightBreak;
    });
}

function transformZoneMatrixData(dataRows, headers) {
    return dataRows.map(row => {
        const zoneRate = {};
        headers.forEach((header, index) => {
            const value = row[index];
            switch (header.toLowerCase()) {
                case 'origin_zone':
                    zoneRate.originZone = value.trim().toUpperCase();
                    break;
                case 'dest_zone':
                    zoneRate.destinationZone = value.trim().toUpperCase();
                    break;
                case 'base_rate':
                    zoneRate.rate = parseFloat(value);
                    break;
                case 'fuel_pct':
                    zoneRate.fuelSurcharge = parseFloat(value);
                    break;
                case 'transit_days':
                    zoneRate.transitDays = value;
                    break;
                case 'max_weight':
                    zoneRate.maxWeight = parseFloat(value);
                    break;
            }
        });
        // Create route key for easier lookup
        zoneRate.routeKey = `${zoneRate.originZone}-${zoneRate.destinationZone}`;
        return zoneRate;
    });
}

function transformDimensionalData(dataRows, headers) {
    return dataRows.map(row => {
        const dimRate = {};
        headers.forEach((header, index) => {
            const value = row[index];
            switch (header.toLowerCase()) {
                case 'service_level':
                    dimRate.serviceLevel = value;
                    break;
                case 'dim_factor':
                    dimRate.dimFactor = parseFloat(value);
                    break;
                case 'rate_per_lb':
                    dimRate.ratePerLb = parseFloat(value);
                    break;
                case 'min_charge':
                    dimRate.minimumCharge = parseFloat(value);
                    break;
                case 'max_dimensions':
                    dimRate.maxDimensions = value;
                    break;
            }
        });
        return dimRate;
    });
}

function transformHybridData(dataRows, headers) {
    return dataRows.map(row => {
        const hybridRate = {};
        headers.forEach((header, index) => {
            const value = row[index];
            switch (header.toLowerCase()) {
                case 'base_rate':
                    hybridRate.baseRate = parseFloat(value);
                    break;
                case 'skid_rate':
                    hybridRate.skidRate = parseFloat(value);
                    break;
                case 'weight_rate':
                    hybridRate.weightRate = parseFloat(value);
                    break;
                case 'distance_rate':
                    hybridRate.distanceRate = parseFloat(value);
                    break;
                case 'fuel_pct':
                    hybridRate.fuelSurcharge = parseFloat(value);
                    break;
                case 'service_level':
                    hybridRate.serviceLevel = value;
                    break;
            }
        });
        return hybridRate;
    });
}

/**
 * Generate import summary
 */
function generateImportSummary(rateCardData, templateType) {
    switch (templateType) {
        case 'skid_based':
            const skidRates = rateCardData.skidRates || [];
            const skidRange = skidRates.length > 0 ? 
                `${Math.min(...skidRates.map(r => r.skidCount))}-${Math.max(...skidRates.map(r => r.skidCount))} skids` : 'No rates';
            return {
                type: 'Skid-Based Pricing',
                rateCount: skidRates.length,
                coverage: skidRange,
                currency: rateCardData.currency
            };
        
        case 'weight_distance':
            const weightBreaks = rateCardData.weightBreaks || [];
            const weightRange = weightBreaks.length > 0 ? 
                `${Math.min(...weightBreaks.map(r => r.minWeight))}-${Math.max(...weightBreaks.map(r => r.maxWeight))} lbs` : 'No rates';
            return {
                type: 'Weight + Distance Matrix',
                rateCount: weightBreaks.length,
                coverage: weightRange,
                currency: rateCardData.currency
            };
        
        case 'zone_matrix':
            const zones = rateCardData.zoneMatrix || [];
            const uniqueOrigins = new Set(zones.map(z => z.originZone)).size;
            const uniqueDestinations = new Set(zones.map(z => z.destinationZone)).size;
            return {
                type: 'Zone Matrix Pricing',
                rateCount: zones.length,
                coverage: `${uniqueOrigins} origins to ${uniqueDestinations} destinations`,
                currency: rateCardData.currency
            };
        
        default:
            return {
                type: templateType,
                rateCount: rateCardData.recordCount || 0,
                coverage: 'Imported successfully',
                currency: rateCardData.currency
            };
    }
}
