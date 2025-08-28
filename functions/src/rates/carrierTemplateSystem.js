/**
 * Comprehensive Carrier Template System
 * Handles custom CSV mapping for carriers with their own rate formats
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Create custom template mapping for carriers with unique CSV formats
 */
exports.createCarrierTemplateMapping = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB'
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
                carrierId,
                templateName,
                carrierName,
                csvStructure,
                fieldMappings,
                rateCalculationRules,
                validationRules = {},
                sampleData = []
            } = data;

            if (!carrierId || !templateName || !csvStructure || !fieldMappings) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID, template name, CSV structure, and field mappings are required'
                );
            }

            logger.info('🗂️ Creating custom carrier template mapping', {
                carrierId,
                templateName,
                carrierName
            });

            // Create template mapping document
            const templateData = {
                carrierId: carrierId.trim(),
                templateName: templateName.trim(),
                carrierName: carrierName?.trim() || '',
                templateType: 'custom_carrier_csv',
                
                // CSV Structure Definition
                csvStructure: {
                    hasHeaders: csvStructure.hasHeaders !== false,
                    headerRow: csvStructure.headerRow || 1,
                    dataStartRow: csvStructure.dataStartRow || 2,
                    delimiter: csvStructure.delimiter || ',',
                    encoding: csvStructure.encoding || 'utf-8',
                    expectedColumns: csvStructure.expectedColumns || [],
                    requiredColumns: csvStructure.requiredColumns || []
                },
                
                // Field Mappings (CSV columns → internal fields)
                fieldMappings: {
                    // Geographic mappings
                    origin: fieldMappings.origin || null,
                    destination: fieldMappings.destination || null,
                    originCity: fieldMappings.originCity || null,
                    originProvince: fieldMappings.originProvince || null,
                    originPostal: fieldMappings.originPostal || null,
                    destinationCity: fieldMappings.destinationCity || null,
                    destinationProvince: fieldMappings.destinationProvince || null,
                    destinationPostal: fieldMappings.destinationPostal || null,
                    
                    // Weight/dimension mappings
                    weightMin: fieldMappings.weightMin || null,
                    weightMax: fieldMappings.weightMax || null,
                    weight: fieldMappings.weight || null,
                    skidCount: fieldMappings.skidCount || null,
                    linearFeet: fieldMappings.linearFeet || null,
                    cube: fieldMappings.cube || null,
                    pieces: fieldMappings.pieces || null,
                    
                    // Rate mappings
                    baseRate: fieldMappings.baseRate || null,
                    fuelSurcharge: fieldMappings.fuelSurcharge || null,
                    fuelSurchargePct: fieldMappings.fuelSurchargePct || null,
                    minCharge: fieldMappings.minCharge || null,
                    accessorials: fieldMappings.accessorials || null,
                    totalRate: fieldMappings.totalRate || null,
                    
                    // Service mappings
                    serviceLevel: fieldMappings.serviceLevel || null,
                    transitDays: fieldMappings.transitDays || null,
                    equipmentType: fieldMappings.equipmentType || null,
                    
                    // Custom fields (carrier-specific)
                    customFields: fieldMappings.customFields || {}
                },
                
                // Rate Calculation Rules
                rateCalculationRules: {
                    calculationType: rateCalculationRules.calculationType || 'explicit', // explicit, per_unit, hybrid
                    baseUnit: rateCalculationRules.baseUnit || 'weight', // weight, skid, lf, cube
                    unitMultiplier: rateCalculationRules.unitMultiplier || 1,
                    
                    // Weight-based calculations
                    weightCalculation: {
                        method: rateCalculationRules.weightCalculation?.method || 'per_lb', // per_lb, per_100lbs, flat_rate
                        roundingRule: rateCalculationRules.weightCalculation?.roundingRule || 'up', // up, down, nearest
                        roundingIncrement: rateCalculationRules.weightCalculation?.roundingIncrement || 1
                    },
                    
                    // Fuel surcharge handling
                    fuelSurcharge: {
                        type: rateCalculationRules.fuelSurcharge?.type || 'percentage', // percentage, flat, embedded
                        applyTo: rateCalculationRules.fuelSurcharge?.applyTo || 'base_rate', // base_rate, total_rate
                        defaultValue: rateCalculationRules.fuelSurcharge?.defaultValue || 0
                    },
                    
                    // Minimum charge handling
                    minimumCharge: {
                        applyGlobally: rateCalculationRules.minimumCharge?.applyGlobally || false,
                        field: rateCalculationRules.minimumCharge?.field || 'minCharge',
                        defaultValue: rateCalculationRules.minimumCharge?.defaultValue || 0
                    },
                    
                    // Custom calculation formulas
                    customFormulas: rateCalculationRules.customFormulas || []
                },
                
                // Validation Rules
                validationRules: {
                    requiredFields: validationRules.requiredFields || [],
                    numericFields: validationRules.numericFields || [],
                    rangeValidations: validationRules.rangeValidations || {},
                    customValidations: validationRules.customValidations || []
                },
                
                // Sample data for testing
                sampleData: sampleData.slice(0, 10), // Limit to 10 sample rows
                
                // Metadata
                enabled: true,
                version: 1,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid,
                usage: {
                    importsCount: 0,
                    lastUsed: null,
                    successRate: 0
                }
            };

            // Save template mapping
            const templateRef = await db.collection('carrierTemplateMappings').add(templateData);

            logger.info('✅ Custom carrier template mapping created', {
                templateId: templateRef.id,
                carrierId,
                templateName
            });

            return {
                success: true,
                templateId: templateRef.id,
                message: 'Custom carrier template mapping created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating carrier template mapping', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create carrier template mapping',
                error.message
            );
        }
    });

/**
 * Auto-detect CSV format and suggest field mappings
 */
exports.autoDetectCarrierCSV = functions
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

            const { csvData, carrierId } = data;

            if (!csvData || !Array.isArray(csvData) || csvData.length < 2) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Valid CSV data with at least header and one data row is required'
                );
            }

            logger.info('🔍 Auto-detecting CSV format', {
                carrierId,
                rows: csvData.length,
                columns: csvData[0]?.length
            });

            const headers = csvData[0];
            const sampleRow = csvData[1];

            // Analyze headers and suggest mappings
            const suggestions = analyzeCSVStructure(headers, sampleRow);

            // Check for existing templates for this carrier
            const existingTemplates = await getExistingCarrierTemplates(carrierId);

            // Calculate confidence scores for suggested mappings
            const mappingConfidence = calculateMappingConfidence(suggestions, existingTemplates);

            logger.info('✅ CSV auto-detection completed', {
                suggestedMappings: Object.keys(suggestions.fieldMappings).length,
                confidence: mappingConfidence.overall
            });

            return {
                success: true,
                suggestions: {
                    ...suggestions,
                    confidence: mappingConfidence
                },
                existingTemplates: existingTemplates.map(t => ({
                    id: t.id,
                    templateName: t.templateName,
                    lastUsed: t.usage?.lastUsed,
                    successRate: t.usage?.successRate || 0
                }))
            };

        } catch (error) {
            logger.error('❌ Error auto-detecting CSV format', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to auto-detect CSV format',
                error.message
            );
        }
    });

/**
 * Import rates using custom carrier template mapping
 */
exports.importWithCustomTemplate = functions
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

            const { templateId, csvData, validateOnly = false } = data;

            if (!templateId || !csvData) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Template ID and CSV data are required'
                );
            }

            logger.info('📥 Importing rates with custom template', {
                templateId,
                rows: csvData.length,
                validateOnly
            });

            // Get template mapping
            const templateDoc = await db.collection('carrierTemplateMappings').doc(templateId).get();
            if (!templateDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Template mapping not found');
            }

            const template = templateDoc.data();

            // Validate CSV against template
            const validation = validateCSVAgainstTemplate(csvData, template);
            if (!validation.valid) {
                return {
                    success: false,
                    validationErrors: validation.errors,
                    warningCount: validation.warnings?.length || 0
                };
            }

            if (validateOnly) {
                return {
                    success: true,
                    validation: validation,
                    previewData: processCSVRows(csvData.slice(1, 6), template), // First 5 rows
                    message: 'CSV validation completed successfully'
                };
            }

            // Process and import all rows
            const processedRates = processCSVRows(csvData.slice(1), template);
            
            // Save to database
            const batch = db.batch();
            const rateCardRef = db.collection('carrierRateCards').doc();
            
            const rateCardData = {
                carrierId: template.carrierId,
                templateId: templateId,
                templateName: template.templateName,
                rateType: 'custom_csv_import',
                rateStructure: template.rateCalculationRules.calculationType,
                rates: processedRates,
                recordCount: processedRates.length,
                importedAt: admin.firestore.FieldValue.serverTimestamp(),
                importedBy: context.auth.uid,
                enabled: true,
                version: 1,
                metadata: {
                    csvRows: csvData.length - 1,
                    successfulRows: processedRates.length,
                    templateVersion: template.version
                }
            };

            batch.set(rateCardRef, rateCardData);

            // Update template usage statistics
            const templateUpdateData = {
                'usage.importsCount': admin.firestore.FieldValue.increment(1),
                'usage.lastUsed': admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            batch.update(db.collection('carrierTemplateMappings').doc(templateId), templateUpdateData);

            await batch.commit();

            logger.info('✅ Custom template import completed', {
                rateCardId: rateCardRef.id,
                templateId,
                processedRows: processedRates.length
            });

            return {
                success: true,
                rateCardId: rateCardRef.id,
                processedRows: processedRates.length,
                validation: validation,
                message: 'Rates imported successfully using custom template'
            };

        } catch (error) {
            logger.error('❌ Error importing with custom template', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to import with custom template',
                error.message
            );
        }
    });

/**
 * Get all carrier template mappings
 */
exports.getCarrierTemplateMappings = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        try {
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
            }

            const { carrierId } = data;

            let query = db.collection('carrierTemplateMappings')
                .where('enabled', '==', true)
                .orderBy('createdAt', 'desc');

            if (carrierId) {
                query = query.where('carrierId', '==', carrierId);
            }

            const snapshot = await query.get();
            const templates = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                templates.push({
                    id: doc.id,
                    templateName: data.templateName,
                    carrierName: data.carrierName,
                    carrierId: data.carrierId,
                    templateType: data.templateType,
                    fieldMappings: data.fieldMappings,
                    rateCalculationRules: data.rateCalculationRules,
                    usage: data.usage,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
                    lastUsed: data.usage?.lastUsed?.toDate?.()?.toISOString() || null
                });
            });

            return {
                success: true,
                templates,
                count: templates.length
            };

        } catch (error) {
            throw new functions.https.HttpsError(
                'internal',
                'Failed to get carrier template mappings',
                error.message
            );
        }
    });

/**
 * Helper Functions
 */

function analyzeCSVStructure(headers, sampleRow) {
    const fieldMappings = {};
    const suggestions = {
        csvStructure: {
            hasHeaders: true,
            headerRow: 1,
            dataStartRow: 2,
            expectedColumns: headers,
            requiredColumns: []
        },
        fieldMappings: fieldMappings,
        rateCalculationRules: {
            calculationType: 'explicit',
            baseUnit: 'weight'
        }
    };

    // Analyze each header for potential mappings
    headers.forEach((header, index) => {
        const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
        const sampleValue = sampleRow?.[index];

        // Geographic field detection
        if (normalizedHeader.includes('origin') || normalizedHeader.includes('from')) {
            if (normalizedHeader.includes('city')) fieldMappings.originCity = header;
            else if (normalizedHeader.includes('province') || normalizedHeader.includes('state')) fieldMappings.originProvince = header;
            else if (normalizedHeader.includes('postal') || normalizedHeader.includes('zip')) fieldMappings.originPostal = header;
            else fieldMappings.origin = header;
        }

        if (normalizedHeader.includes('destination') || normalizedHeader.includes('dest') || normalizedHeader.includes('to')) {
            if (normalizedHeader.includes('city')) fieldMappings.destinationCity = header;
            else if (normalizedHeader.includes('province') || normalizedHeader.includes('state')) fieldMappings.destinationProvince = header;
            else if (normalizedHeader.includes('postal') || normalizedHeader.includes('zip')) fieldMappings.destinationPostal = header;
            else fieldMappings.destination = header;
        }

        // Weight field detection
        if (normalizedHeader.includes('weight')) {
            if (normalizedHeader.includes('min')) fieldMappings.weightMin = header;
            else if (normalizedHeader.includes('max')) fieldMappings.weightMax = header;
            else fieldMappings.weight = header;
        }

        // Rate field detection
        if (normalizedHeader.includes('rate') || normalizedHeader.includes('price') || normalizedHeader.includes('cost')) {
            if (normalizedHeader.includes('base') || normalizedHeader.includes('linehaul')) fieldMappings.baseRate = header;
            else if (normalizedHeader.includes('min')) fieldMappings.minCharge = header;
            else if (normalizedHeader.includes('total')) fieldMappings.totalRate = header;
            else fieldMappings.baseRate = header;
        }

        // Fuel surcharge detection
        if (normalizedHeader.includes('fuel')) {
            if (normalizedHeader.includes('pct') || normalizedHeader.includes('percent') || normalizedHeader.includes('%')) {
                fieldMappings.fuelSurchargePct = header;
            } else {
                fieldMappings.fuelSurcharge = header;
            }
        }

        // Service level detection
        if (normalizedHeader.includes('service') || normalizedHeader.includes('level')) {
            fieldMappings.serviceLevel = header;
        }

        // Transit time detection
        if (normalizedHeader.includes('transit') || normalizedHeader.includes('days') || normalizedHeader.includes('time')) {
            fieldMappings.transitDays = header;
        }

        // Skid count detection
        if (normalizedHeader.includes('skid') || normalizedHeader.includes('pallet')) {
            fieldMappings.skidCount = header;
        }

        // Linear feet detection
        if (normalizedHeader.includes('linear') || normalizedHeader.includes('lf') || normalizedHeader.includes('feet')) {
            fieldMappings.linearFeet = header;
        }
    });

    // Determine calculation type based on detected fields
    if (fieldMappings.skidCount) {
        suggestions.rateCalculationRules.baseUnit = 'skid';
    } else if (fieldMappings.linearFeet) {
        suggestions.rateCalculationRules.baseUnit = 'lf';
    } else if (fieldMappings.weight || fieldMappings.weightMin) {
        suggestions.rateCalculationRules.baseUnit = 'weight';
    }

    return suggestions;
}

async function getExistingCarrierTemplates(carrierId) {
    if (!carrierId) return [];

    const snapshot = await db.collection('carrierTemplateMappings')
        .where('carrierId', '==', carrierId)
        .where('enabled', '==', true)
        .orderBy('usage.lastUsed', 'desc')
        .limit(5)
        .get();

    const templates = [];
    snapshot.forEach(doc => {
        templates.push({ id: doc.id, ...doc.data() });
    });

    return templates;
}

function calculateMappingConfidence(suggestions, existingTemplates) {
    const fieldCount = Object.keys(suggestions.fieldMappings).length;
    const maxPossibleFields = 15; // Reasonable max for carrier CSV

    const baseConfidence = Math.min((fieldCount / maxPossibleFields) * 100, 100);
    
    // Bonus for having essential fields
    let essentialFieldBonus = 0;
    const essentialFields = ['origin', 'destination', 'baseRate'];
    essentialFields.forEach(field => {
        if (suggestions.fieldMappings[field] || 
            suggestions.fieldMappings[field + 'City'] || 
            suggestions.fieldMappings[field + 'Province']) {
            essentialFieldBonus += 10;
        }
    });

    // Penalty for having existing similar templates (suggests manual review needed)
    const similarTemplatesPenalty = Math.min(existingTemplates.length * 5, 20);

    const overall = Math.max(0, Math.min(100, baseConfidence + essentialFieldBonus - similarTemplatesPenalty));

    return {
        overall: Math.round(overall),
        breakdown: {
            fieldCoverage: Math.round(baseConfidence),
            essentialFields: essentialFieldBonus,
            existingTemplates: -similarTemplatesPenalty
        }
    };
}

function validateCSVAgainstTemplate(csvData, template) {
    const errors = [];
    const warnings = [];

    if (csvData.length < 2) {
        errors.push('CSV must contain at least header row and one data row');
        return { valid: false, errors, warnings };
    }

    const headers = csvData[0];
    const dataRows = csvData.slice(1);

    // Validate expected columns exist
    template.csvStructure.requiredColumns.forEach(column => {
        if (!headers.includes(column)) {
            errors.push(`Required column '${column}' not found in CSV`);
        }
    });

    // Validate field mappings point to existing columns
    Object.entries(template.fieldMappings).forEach(([field, csvColumn]) => {
        if (csvColumn && !headers.includes(csvColumn)) {
            errors.push(`Mapped field '${field}' points to non-existent column '${csvColumn}'`);
        }
    });

    // Validate data types in sample rows
    const sampleSize = Math.min(dataRows.length, 10);
    for (let i = 0; i < sampleSize; i++) {
        const row = dataRows[i];
        
        // Check numeric fields
        template.validationRules.numericFields?.forEach(field => {
            const csvColumn = template.fieldMappings[field];
            if (csvColumn) {
                const columnIndex = headers.indexOf(csvColumn);
                const value = row[columnIndex];
                if (value && isNaN(parseFloat(value))) {
                    warnings.push(`Row ${i + 2}: '${csvColumn}' should be numeric but got '${value}'`);
                }
            }
        });

        // Check required fields
        template.validationRules.requiredFields?.forEach(field => {
            const csvColumn = template.fieldMappings[field];
            if (csvColumn) {
                const columnIndex = headers.indexOf(csvColumn);
                const value = row[columnIndex];
                if (!value || value.toString().trim() === '') {
                    warnings.push(`Row ${i + 2}: Required field '${csvColumn}' is empty`);
                }
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

function processCSVRows(dataRows, template) {
    const processedRates = [];

    dataRows.forEach((row, index) => {
        try {
            const processedRate = processRowWithTemplate(row, template, index + 2);
            if (processedRate) {
                processedRates.push(processedRate);
            }
        } catch (error) {
            console.warn(`Error processing row ${index + 2}:`, error.message);
        }
    });

    return processedRates;
}

function processRowWithTemplate(row, template, rowNumber) {
    const headers = template.csvStructure.expectedColumns;
    const mappings = template.fieldMappings;
    const rules = template.rateCalculationRules;

    // Extract values based on field mappings
    const extractValue = (field) => {
        const csvColumn = mappings[field];
        if (!csvColumn) return null;
        const columnIndex = headers.indexOf(csvColumn);
        return columnIndex >= 0 ? row[columnIndex] : null;
    };

    // Build rate object
    const rate = {
        rowNumber,
        
        // Geographic data
        origin: extractValue('origin'),
        destination: extractValue('destination'),
        originCity: extractValue('originCity'),
        originProvince: extractValue('originProvince'),
        originPostal: extractValue('originPostal'),
        destinationCity: extractValue('destinationCity'),
        destinationProvince: extractValue('destinationProvince'),
        destinationPostal: extractValue('destinationPostal'),
        
        // Weight/dimension data
        weightMin: parseFloat(extractValue('weightMin')) || 0,
        weightMax: parseFloat(extractValue('weightMax')) || null,
        weight: parseFloat(extractValue('weight')) || null,
        skidCount: parseInt(extractValue('skidCount')) || null,
        linearFeet: parseFloat(extractValue('linearFeet')) || null,
        
        // Rate data
        baseRate: parseFloat(extractValue('baseRate')) || 0,
        fuelSurcharge: parseFloat(extractValue('fuelSurcharge')) || null,
        fuelSurchargePct: parseFloat(extractValue('fuelSurchargePct')) || null,
        minCharge: parseFloat(extractValue('minCharge')) || null,
        totalRate: parseFloat(extractValue('totalRate')) || null,
        
        // Service data
        serviceLevel: extractValue('serviceLevel'),
        transitDays: parseInt(extractValue('transitDays')) || null,
        equipmentType: extractValue('equipmentType'),
        
        // Calculated fields
        calculationType: rules.calculationType,
        baseUnit: rules.baseUnit
    };

    // Apply calculation rules
    if (rules.calculationType === 'per_unit' && !rate.totalRate) {
        rate.totalRate = calculateRateFromRules(rate, rules);
    }

    // Apply fuel surcharge if not already calculated
    if (rate.fuelSurchargePct && !rate.fuelSurcharge) {
        const baseForFuel = rules.fuelSurcharge.applyTo === 'total_rate' ? rate.totalRate : rate.baseRate;
        rate.fuelSurcharge = baseForFuel * (rate.fuelSurchargePct / 100);
    }

    // Apply minimum charge
    if (rate.minCharge && rate.totalRate < rate.minCharge) {
        rate.totalRate = rate.minCharge;
        rate.minimumApplied = true;
    }

    return rate;
}

function calculateRateFromRules(rate, rules) {
    const { weightCalculation, baseUnit, unitMultiplier } = rules;
    
    let calculatedRate = 0;
    
    switch (baseUnit) {
        case 'weight':
            const weight = rate.weight || rate.weightMin || 0;
            if (weightCalculation.method === 'per_100lbs') {
                calculatedRate = (weight / 100) * rate.baseRate;
            } else if (weightCalculation.method === 'per_lb') {
                calculatedRate = weight * rate.baseRate;
            } else {
                calculatedRate = rate.baseRate; // flat_rate
            }
            break;
            
        case 'skid':
            calculatedRate = (rate.skidCount || 1) * rate.baseRate;
            break;
            
        case 'lf':
            calculatedRate = (rate.linearFeet || 1) * rate.baseRate;
            break;
            
        default:
            calculatedRate = rate.baseRate;
    }
    
    // Apply unit multiplier if specified
    if (unitMultiplier && unitMultiplier !== 1) {
        calculatedRate *= unitMultiplier;
    }
    
    return calculatedRate;
}
