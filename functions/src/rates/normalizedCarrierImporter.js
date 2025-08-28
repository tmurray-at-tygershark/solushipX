/**
 * Normalized Carrier Import System
 * Handles complex real-world carrier rate structures with terminal mapping
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Get supported import formats and templates
 */
exports.getCarrierImportFormats = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data, context) => {
        try {
            const formats = {
                // Terminal-based carriers (like APEX)
                terminal_weight_based: {
                    name: 'Terminal + Weight-Based Rates',
                    description: 'Carriers with terminal mapping and weight-based pricing (per 100lbs)',
                    icon: '🏭',
                    complexity: 'advanced',
                    templates: [
                        {
                            name: 'City-to-Terminal Mapping',
                            file: 'terminal_mapping_template.csv',
                            headers: ['City', 'Province_State', 'Terminal_Code', 'Terminal_Name', 'Service_Area'],
                            required: true
                        },
                        {
                            name: 'Terminal Rate Matrix',
                            file: 'terminal_rates_template.csv', 
                            headers: ['Origin_Terminal', 'Destination_Terminal', 'Weight_Min', 'Weight_Max', 'Rate_Per_100lbs', 'Fuel_Surcharge_Pct', 'Transit_Days'],
                            required: true
                        }
                    ],
                    example: {
                        carrier: 'APEX Transport',
                        description: 'Cities map to terminals (Kitchener→KIT), rates calculated per weight break between terminals'
                    }
                },
                
                // Simple skid-based carriers
                skid_based: {
                    name: 'Skid-Based Pricing',
                    description: 'Simple 1-26 skid pricing with direct rates',
                    icon: '📦',
                    complexity: 'simple',
                    templates: [
                        {
                            name: 'Skid Rate Card',
                            file: 'skid_rates_template.csv',
                            headers: ['Skid_Count', 'Rate', 'Fuel_Surcharge_Pct', 'Transit_Days', 'Max_Weight_Per_Skid'],
                            required: true
                        }
                    ],
                    example: {
                        carrier: 'Simple Freight Lines',
                        description: 'Direct pricing: 1 skid = $485, 2 skids = $650, etc.'
                    }
                },
                
                // Zone-based carriers (simplified)
                zone_matrix: {
                    name: 'Zone-to-Zone Rates',
                    description: 'Direct province/state to province/state pricing',
                    icon: '🗺️',
                    complexity: 'medium',
                    templates: [
                        {
                            name: 'Zone Rate Matrix',
                            file: 'zone_matrix_template.csv',
                            headers: ['Origin_Zone', 'Destination_Zone', 'Base_Rate', 'Fuel_Surcharge_Pct', 'Transit_Days', 'Max_Weight'],
                            required: true
                        }
                    ],
                    example: {
                        carrier: 'Regional Express',
                        description: 'ON→QC = $485, ON→BC = $1250, etc.'
                    }
                },
                
                // Hybrid carriers (multiple pricing models)
                hybrid_terminal_zone: {
                    name: 'Hybrid Terminal + Zone',
                    description: 'Combines terminal mapping with zone-based fallback',
                    icon: '🔧',
                    complexity: 'expert',
                    templates: [
                        {
                            name: 'Terminal Mapping',
                            file: 'hybrid_terminal_mapping.csv',
                            headers: ['City', 'Province_State', 'Terminal_Code', 'Terminal_Name', 'Priority'],
                            required: true
                        },
                        {
                            name: 'Terminal Rates',
                            file: 'hybrid_terminal_rates.csv',
                            headers: ['Origin_Terminal', 'Destination_Terminal', 'Rate_Structure', 'Base_Rate', 'Per_Weight_Rate', 'Min_Charge'],
                            required: false
                        },
                        {
                            name: 'Zone Fallback Rates',
                            file: 'hybrid_zone_fallback.csv',
                            headers: ['Origin_Zone', 'Destination_Zone', 'Base_Rate', 'Fuel_Surcharge_Pct'],
                            required: false
                        }
                    ],
                    example: {
                        carrier: 'Advanced Logistics',
                        description: 'Uses terminal rates when available, falls back to zone rates'
                    }
                }
            };

            return {
                success: true,
                formats,
                recommendations: {
                    beginners: ['skid_based'],
                    intermediate: ['zone_matrix', 'terminal_weight_based'],
                    advanced: ['hybrid_terminal_zone']
                }
            };

        } catch (error) {
            functions.logger.error('❌ Get import formats error', { error: error.message });
            throw new functions.https.HttpsError('internal', 'Failed to get import formats', error.message);
        }
    });

/**
 * Generate normalized template for specific format
 */
exports.generateNormalizedTemplate = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data, context) => {
        try {
            const { format, templateType, carrierId } = data;

            if (!format || !templateType) {
                throw new functions.https.HttpsError('invalid-argument', 'Format and template type are required');
            }

            const template = generateTemplateByFormat(format, templateType);
            
            return {
                success: true,
                format,
                templateType,
                fileName: template.fileName,
                csvContent: template.csvContent,
                headers: template.headers,
                sampleData: template.sampleData,
                instructions: template.instructions,
                notes: template.notes
            };

        } catch (error) {
            functions.logger.error('❌ Generate normalized template error', { error: error.message });
            throw new functions.https.HttpsError('internal', 'Failed to generate template', error.message);
        }
    });

/**
 * Import normalized carrier configuration
 */
exports.importNormalizedCarrierConfig = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 120, memory: '1GB' })
    .https.onCall(async (data, context) => {
        try {
            const { carrierId, format, templates, configName, currency = 'CAD' } = data;

            if (!carrierId || !format || !templates) {
                throw new functions.https.HttpsError('invalid-argument', 'Carrier ID, format, and templates are required');
            }

            functions.logger.info('🔄 Starting normalized carrier import', {
                carrierId, format, templatesCount: Object.keys(templates).length
            });

            // Validate all templates
            const validation = validateNormalizedTemplates(format, templates);
            if (!validation.valid) {
                return {
                    success: false,
                    errors: validation.errors,
                    validationFailed: true
                };
            }

            // Process and normalize the carrier configuration
            const normalizedConfig = await processNormalizedCarrierConfig(carrierId, format, templates, {
                configName: configName || `${format} Configuration`,
                currency,
                createdBy: context.auth?.uid || 'system'
            });

            // Save to database with enhanced structure
            const configRef = await db.collection('normalizedCarrierConfigs').add({
                ...normalizedConfig,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                enabled: true,
                version: '2.0' // New normalized version
            });

            // Update carrier with reference to normalized config
            await db.collection('quickshipCarriers').doc(carrierId).update({
                normalizedConfigId: configRef.id,
                ratingMethod: 'normalized',
                lastConfigUpdate: admin.firestore.FieldValue.serverTimestamp()
            });

            functions.logger.info('✅ Normalized carrier configuration imported', {
                configId: configRef.id,
                carrierId,
                format,
                recordCount: normalizedConfig.totalRecords
            });

            return {
                success: true,
                configId: configRef.id,
                format,
                summary: generateImportSummary(normalizedConfig),
                totalRecords: normalizedConfig.totalRecords,
                configName: normalizedConfig.configName
            };

        } catch (error) {
            functions.logger.error('❌ Normalized carrier import error', { error: error.message });
            throw new functions.https.HttpsError('internal', 'Failed to import normalized carrier config', error.message);
        }
    });

/**
 * Generate template content by format and type
 */
function generateTemplateByFormat(format, templateType) {
    switch (format) {
        case 'terminal_weight_based':
            return generateTerminalWeightTemplate(templateType);
        case 'skid_based':
            return generateSkidBasedTemplate(templateType);
        case 'zone_matrix':
            return generateZoneMatrixTemplate(templateType);
        case 'hybrid_terminal_zone':
            return generateHybridTemplate(templateType);
        default:
            throw new Error(`Unknown format: ${format}`);
    }
}

/**
 * Generate terminal + weight-based templates (APEX style)
 */
function generateTerminalWeightTemplate(templateType) {
    switch (templateType) {
        case 'terminal_mapping':
            return {
                fileName: 'terminal_mapping_template.csv',
                headers: ['City', 'Province_State', 'Terminal_Code', 'Terminal_Name', 'Service_Area'],
                sampleData: [
                    // Ontario cities mapping to terminals
                    ['TORONTO', 'ON', 'TOR', 'Toronto Terminal', 'GTA'],
                    ['MISSISSAUGA', 'ON', 'TOR', 'Toronto Terminal', 'GTA'],
                    ['BRAMPTON', 'ON', 'TOR', 'Toronto Terminal', 'GTA'],
                    ['KITCHENER', 'ON', 'KIT', 'Kitchener Terminal', 'WATERLOO'],
                    ['WATERLOO', 'ON', 'KIT', 'Kitchener Terminal', 'WATERLOO'],
                    ['CAMBRIDGE', 'ON', 'KIT', 'Kitchener Terminal', 'WATERLOO'],
                    ['OTTAWA', 'ON', 'OTT', 'Ottawa Terminal', 'OTTAWA'],
                    ['BARRIE', 'ON', 'BAR', 'Barrie Terminal', 'SIMCOE'],
                    ['LONDON', 'ON', 'LON', 'London Terminal', 'SOUTHWEST'],
                    ['WINDSOR', 'ON', 'WIN', 'Windsor Terminal', 'ESSEX'],
                    // Quebec
                    ['MONTREAL', 'QC', 'MTL', 'Montreal Terminal', 'MONTREAL'],
                    ['LAVAL', 'QC', 'MTL', 'Montreal Terminal', 'MONTREAL'],
                    ['QUEBEC CITY', 'QC', 'QUE', 'Quebec Terminal', 'QUEBEC'],
                    // BC
                    ['VANCOUVER', 'BC', 'VAN', 'Vancouver Terminal', 'LOWER_MAINLAND'],
                    ['BURNABY', 'BC', 'VAN', 'Vancouver Terminal', 'LOWER_MAINLAND'],
                    ['RICHMOND', 'BC', 'VAN', 'Vancouver Terminal', 'LOWER_MAINLAND']
                ],
                csvContent: '',
                instructions: [
                    'City: Exact city name (uppercase for consistency)',
                    'Province_State: Province/state code (ON, QC, BC, etc.)',
                    'Terminal_Code: 3-letter terminal identifier',
                    'Terminal_Name: Full terminal name',
                    'Service_Area: Broader service area grouping'
                ],
                notes: [
                    'Map small cities to major terminals for rate lookup',
                    'Multiple cities can map to the same terminal',
                    'Terminal codes must match those used in rate matrix'
                ]
            };

        case 'terminal_rates':
            return {
                fileName: 'terminal_rates_template.csv',
                headers: ['Origin_Terminal', 'Destination_Terminal', 'Weight_Min', 'Weight_Max', 'Rate_Type', 'Rate_Value', 'Min_Charge', 'Fuel_Surcharge_Pct', 'Transit_Days'],
                sampleData: [
                    // Kitchener to other terminals - PER_100LBS pricing (like APEX)
                    ['KIT', 'TOR', '0', '500', 'PER_100LBS', '78.11', '125.00', '15.5', '1'],
                    ['KIT', 'TOR', '501', '1000', 'PER_100LBS', '42.05', '275.00', '15.5', '1'],
                    ['KIT', 'TOR', '1001', '2000', 'PER_100LBS', '40.05', '485.00', '15.5', '1'],
                    ['KIT', 'TOR', '2001', '5000', 'PER_100LBS', '37.37', '750.00', '15.5', '1'],
                    ['KIT', 'TOR', '5001', '10000', 'PER_100LBS', '34.53', '1200.00', '15.5', '1'],
                    // KIT to Montreal - PER_100LBS pricing
                    ['KIT', 'MTL', '0', '500', 'PER_100LBS', '95.25', '185.00', '15.5', '2'],
                    ['KIT', 'MTL', '501', '1000', 'PER_100LBS', '52.15', '325.00', '15.5', '2'],
                    ['KIT', 'MTL', '1001', '2000', 'PER_100LBS', '48.25', '585.00', '15.5', '2'],
                    // Alternative carrier with PER_LB pricing (straight per pound)
                    ['KIT', 'VAN', '0', '500', 'PER_LB', '1.85', '225.00', '15.5', '5'],
                    ['KIT', 'VAN', '501', '1000', 'PER_LB', '1.25', '450.00', '15.5', '5'],
                    ['KIT', 'VAN', '1001', '2000', 'PER_LB', '0.98', '750.00', '15.5', '5'],
                    // Flat rate example (fixed rate regardless of weight within range)
                    ['KIT', 'OTT', '0', '1000', 'FLAT_RATE', '485.00', '485.00', '15.5', '2'],
                    ['KIT', 'OTT', '1001', '5000', 'FLAT_RATE', '950.00', '950.00', '15.5', '2']
                ],
                csvContent: '',
                instructions: [
                    'Origin_Terminal: 3-letter code from terminal mapping',
                    'Destination_Terminal: 3-letter code from terminal mapping',
                    'Weight_Min: Minimum weight for this rate break (lbs)',
                    'Weight_Max: Maximum weight for this rate break (lbs)',
                    'Rate_Type: PER_100LBS, PER_LB, or FLAT_RATE',
                    'Rate_Value: Rate amount based on Rate_Type',
                    'Min_Charge: Minimum charge for this weight break',
                    'Fuel_Surcharge_Pct: Fuel surcharge percentage',
                    'Transit_Days: Expected delivery time in business days'
                ],
                notes: [
                    'Rate Types: PER_100LBS (rate × weight/100), PER_LB (rate × weight), FLAT_RATE (fixed rate)',
                    'Weight breaks should be continuous (no gaps)',
                    'Each terminal pair needs complete weight break coverage',
                    'Min_Charge ensures minimum revenue per shipment'
                ]
            };

        default:
            throw new Error(`Unknown terminal weight template type: ${templateType}`);
    }

    // Add CSV content generation
    const csvContent = [
        result.headers,
        ...result.sampleData
    ].map(row => row.join(',')).join('\n');
    
    result.csvContent = csvContent;
    return result;
}

/**
 * Generate skid-based template (simple carriers)
 */
function generateSkidBasedTemplate(templateType) {
    const headers = ['Skid_Count', 'Rate', 'Fuel_Surcharge_Pct', 'Transit_Days', 'Max_Weight_Per_Skid', 'Notes'];
    
    const sampleData = [
        ['1', '485.00', '15.5', '2', '2000', 'Single skid LTL'],
        ['2', '650.00', '15.5', '2', '2000', 'Two skid LTL'],
        ['3', '815.00', '15.5', '3', '2000', 'Three skid LTL'],
        ['4', '980.00', '15.5', '3', '2000', 'Four skid LTL'],
        ['5', '1145.00', '15.5', '3', '2000', 'Five skid LTL'],
        ['10', '1970.00', '15.5', '4', '2000', 'Ten skid LTL'],
        ['15', '2795.00', '15.5', '5', '2000', 'Fifteen skid partial'],
        ['20', '3620.00', '15.5', '5', '2000', 'Twenty skid FTL'],
        ['26', '4610.00', '15.5', '5', '2000', 'Full truck (26 skids)']
    ];

    const csvContent = [headers, ...sampleData].map(row => row.join(',')).join('\n');

    return {
        fileName: 'skid_rates_template.csv',
        headers,
        sampleData,
        csvContent,
        instructions: [
            'Skid_Count: Number of skids (1-26)',
            'Rate: Your selling price in CAD',
            'Fuel_Surcharge_Pct: Fuel surcharge percentage',
            'Transit_Days: Expected delivery time',
            'Max_Weight_Per_Skid: Weight limit per skid',
            'Notes: Optional description'
        ],
        notes: [
            'Simple pricing model based on skid count',
            'Most common for LTL freight carriers',
            'Automatically calculates skid equivalents from shipment dimensions'
        ]
    };
}

/**
 * Validate normalized templates
 */
function validateNormalizedTemplates(format, templates) {
    const errors = [];
    
    try {
        switch (format) {
            case 'terminal_weight_based':
                // Must have both terminal mapping and rates
                if (!templates.terminal_mapping) {
                    errors.push('Terminal mapping template is required');
                }
                if (!templates.terminal_rates) {
                    errors.push('Terminal rates template is required');
                }
                
                // Validate terminal mapping
                if (templates.terminal_mapping) {
                    errors.push(...validateTerminalMapping(templates.terminal_mapping));
                }
                
                // Validate terminal rates
                if (templates.terminal_rates) {
                    errors.push(...validateTerminalRates(templates.terminal_rates));
                }
                break;
                
            case 'skid_based':
                if (!templates.skid_rates) {
                    errors.push('Skid rates template is required');
                }
                if (templates.skid_rates) {
                    errors.push(...validateSkidRates(templates.skid_rates));
                }
                break;
                
            case 'zone_matrix':
                if (!templates.zone_matrix) {
                    errors.push('Zone matrix template is required');
                }
                break;
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
        
    } catch (error) {
        return {
            valid: false,
            errors: [`Validation error: ${error.message}`]
        };
    }
}

/**
 * Validate terminal mapping data
 */
function validateTerminalMapping(csvData) {
    const errors = [];
    const terminals = new Set();
    const cityTerminalMap = new Map();
    
    csvData.slice(1).forEach((row, index) => {
        const rowNum = index + 2;
        const [city, province, terminalCode, terminalName, serviceArea] = row;
        
        if (!city?.trim()) {
            errors.push(`Row ${rowNum}: City is required`);
        }
        
        if (!province?.trim()) {
            errors.push(`Row ${rowNum}: Province/State is required`);
        }
        
        if (!terminalCode?.trim() || terminalCode.length !== 3) {
            errors.push(`Row ${rowNum}: Terminal code must be exactly 3 characters`);
        }
        
        if (!terminalName?.trim()) {
            errors.push(`Row ${rowNum}: Terminal name is required`);
        }
        
        // Track terminals and city mappings
        if (terminalCode) {
            terminals.add(terminalCode.trim().toUpperCase());
            
            const cityKey = `${city?.trim()?.toUpperCase()}_${province?.trim()?.toUpperCase()}`;
            if (cityTerminalMap.has(cityKey)) {
                errors.push(`Row ${rowNum}: Duplicate city mapping for ${city}, ${province}`);
            } else {
                cityTerminalMap.set(cityKey, terminalCode.trim().toUpperCase());
            }
        }
    });
    
    return errors;
}

/**
 * Validate terminal rates data
 */
function validateTerminalRates(csvData) {
    const errors = [];
    const terminalPairs = new Map();
    
    csvData.slice(1).forEach((row, index) => {
        const rowNum = index + 2;
        const [origin, destination, weightMin, weightMax, rateType, rateValue, minCharge, fuelPct, transitDays] = row;
        
        if (!origin?.trim() || origin.length !== 3) {
            errors.push(`Row ${rowNum}: Origin terminal must be 3 characters`);
        }
        
        if (!destination?.trim() || destination.length !== 3) {
            errors.push(`Row ${rowNum}: Destination terminal must be 3 characters`);
        }
        
        const minWeight = parseFloat(weightMin);
        const maxWeight = parseFloat(weightMax);
        
        if (isNaN(minWeight) || minWeight < 0) {
            errors.push(`Row ${rowNum}: Invalid minimum weight`);
        }
        
        if (isNaN(maxWeight) || maxWeight <= minWeight) {
            errors.push(`Row ${rowNum}: Maximum weight must be greater than minimum`);
        }
        
        // Validate rate type
        const validRateTypes = ['PER_100LBS', 'PER_LB', 'FLAT_RATE'];
        if (!validRateTypes.includes(rateType?.trim()?.toUpperCase())) {
            errors.push(`Row ${rowNum}: Rate type must be PER_100LBS, PER_LB, or FLAT_RATE`);
        }
        
        // Validate rate value
        const rateVal = parseFloat(rateValue);
        if (isNaN(rateVal) || rateVal <= 0) {
            errors.push(`Row ${rowNum}: Invalid rate value`);
        }
        
        // Validate minimum charge
        const minChargeVal = parseFloat(minCharge);
        if (isNaN(minChargeVal) || minChargeVal < 0) {
            errors.push(`Row ${rowNum}: Invalid minimum charge`);
        }
        
        const fuelSurcharge = parseFloat(fuelPct);
        if (isNaN(fuelSurcharge) || fuelSurcharge < 0) {
            errors.push(`Row ${rowNum}: Invalid fuel surcharge percentage`);
        }
        
        // Check for overlapping weight ranges within same terminal pair
        const pairKey = `${origin}_${destination}`;
        if (!terminalPairs.has(pairKey)) {
            terminalPairs.set(pairKey, []);
        }
        
        const existingRanges = terminalPairs.get(pairKey);
        for (const existingRange of existingRanges) {
            if (!(maxWeight <= existingRange.min || minWeight >= existingRange.max)) {
                errors.push(`Row ${rowNum}: Overlapping weight range for ${origin} to ${destination}`);
            }
        }
        
        existingRanges.push({ min: minWeight, max: maxWeight });
    });
    
    return errors;
}

/**
 * Validate skid rates data
 */
function validateSkidRates(csvData) {
    const errors = [];
    const skidCounts = new Set();
    
    csvData.slice(1).forEach((row, index) => {
        const rowNum = index + 2;
        const [skidCount, rate, fuelPct, transitDays, maxWeight] = row;
        
        const skids = parseInt(skidCount);
        if (isNaN(skids) || skids < 1 || skids > 26) {
            errors.push(`Row ${rowNum}: Skid count must be 1-26`);
        }
        
        if (skidCounts.has(skids)) {
            errors.push(`Row ${rowNum}: Duplicate skid count ${skids}`);
        }
        skidCounts.add(skids);
        
        const rateValue = parseFloat(rate);
        if (isNaN(rateValue) || rateValue <= 0) {
            errors.push(`Row ${rowNum}: Invalid rate`);
        }
        
        const fuel = parseFloat(fuelPct);
        if (isNaN(fuel) || fuel < 0) {
            errors.push(`Row ${rowNum}: Invalid fuel surcharge percentage`);
        }
    });
    
    return errors;
}

/**
 * Process and normalize carrier configuration
 */
async function processNormalizedCarrierConfig(carrierId, format, templates, metadata) {
    const config = {
        carrierId,
        format,
        configName: metadata.configName,
        currency: metadata.currency,
        createdBy: metadata.createdBy,
        totalRecords: 0
    };
    
    switch (format) {
        case 'terminal_weight_based':
            config.terminalMapping = processTerminalMapping(templates.terminal_mapping);
            config.terminalRates = processTerminalRates(templates.terminal_rates);
            config.totalRecords = config.terminalMapping.length + config.terminalRates.length;
            break;
            
        case 'skid_based':
            config.skidRates = processSkidRates(templates.skid_rates);
            config.totalRecords = config.skidRates.length;
            break;
            
        case 'zone_matrix':
            config.zoneMatrix = processZoneMatrix(templates.zone_matrix);
            config.totalRecords = config.zoneMatrix.length;
            break;
    }
    
    return config;
}

/**
 * Process terminal mapping CSV data
 */
function processTerminalMapping(csvData) {
    return csvData.slice(1).map(row => ({
        city: row[0]?.trim()?.toUpperCase(),
        province: row[1]?.trim()?.toUpperCase(),
        terminalCode: row[2]?.trim()?.toUpperCase(),
        terminalName: row[3]?.trim(),
        serviceArea: row[4]?.trim()?.toUpperCase()
    }));
}

/**
 * Process terminal rates CSV data
 */
function processTerminalRates(csvData) {
    return csvData.slice(1).map(row => ({
        originTerminal: row[0]?.trim()?.toUpperCase(),
        destinationTerminal: row[1]?.trim()?.toUpperCase(),
        weightMin: parseFloat(row[2]),
        weightMax: parseFloat(row[3]),
        rateType: row[4]?.trim()?.toUpperCase(),
        rateValue: parseFloat(row[5]),
        minCharge: parseFloat(row[6]),
        fuelSurcharge: parseFloat(row[7]),
        transitDays: parseInt(row[8]) || 2
    }));
}

/**
 * Process skid rates CSV data
 */
function processSkidRates(csvData) {
    return csvData.slice(1).map(row => ({
        skidCount: parseInt(row[0]),
        rate: parseFloat(row[1]),
        fuelSurcharge: parseFloat(row[2]),
        transitDays: parseInt(row[3]) || 2,
        maxWeightPerSkid: parseFloat(row[4]) || 2000,
        notes: row[5]?.trim()
    }));
}

/**
 * Generate import summary
 */
function generateImportSummary(config) {
    const summary = {
        format: config.format,
        configName: config.configName,
        currency: config.currency,
        totalRecords: config.totalRecords
    };
    
    switch (config.format) {
        case 'terminal_weight_based':
            const terminalCodes = [...new Set(config.terminalMapping.map(m => m.terminalCode))];
            const terminalPairs = [...new Set(config.terminalRates.map(r => `${r.originTerminal}-${r.destinationTerminal}`))];
            
            summary.details = {
                terminals: terminalCodes.length,
                cityMappings: config.terminalMapping.length,
                ratePairs: terminalPairs.length,
                weightBreaks: config.terminalRates.length
            };
            break;
            
        case 'skid_based':
            const skidRange = config.skidRates.length > 0 ? 
                `${Math.min(...config.skidRates.map(r => r.skidCount))}-${Math.max(...config.skidRates.map(r => r.skidCount))} skids` : 
                'No rates';
            
            summary.details = {
                skidRange,
                rateCount: config.skidRates.length
            };
            break;
    }
    
    return summary;
}
