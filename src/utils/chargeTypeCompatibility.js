import shipmentChargeTypeService from '../services/shipmentChargeTypeService';

/**
 * Charge Type Compatibility Utility
 * Handles backward compatibility between static and dynamic charge types
 * Ensures existing shipments continue to work seamlessly
 */

/**
 * Legacy static charge codes mapping for migration
 * Maps old charge codes to new dynamic system equivalents
 */
const LEGACY_CHARGE_CODE_MAPPING = {
    // Core freight codes
    'FRT': 'FRT',
    'FREIGHT': 'FRT',
    'BASE': 'FRT',
    
    // Fuel codes
    'FUE': 'FUE',
    'FUEL': 'FUE',
    'FUEL_SURCHARGE': 'FUE',
    'FSC': 'FUE',
    
    // Accessorial codes
    'ACC': 'ACC',
    'ACCESSORIAL': 'ACC',
    'ACCESS': 'ACC',
    
    // Service/Logistics codes
    'SUR': 'SUR',
    'SURCHARGE': 'SUR',
    'LOG': 'LOG',
    'LOGISTICS': 'LOG',
    'SERVICE': 'SUR',
    
    // Tax codes (preserve all variations)
    'HST': 'HST',
    'HST ON': 'HST ON',
    'HST BC': 'HST BC',
    'HST NB': 'HST NB',
    'HST NF': 'HST NF',
    'HST NS': 'HST NS',
    'HST PE': 'HST PE',
    'GST': 'GST',
    'QST': 'QST',
    'PST': 'PST',
    'TAX': 'HST',
    'SALES_TAX': 'HST',
    
    // Government/Customs codes
    'GOVT': 'GOVT',
    'GOVD': 'GOVD',
    'GOVERNMENT': 'GOVT',
    'CUSTOMS': 'GOVT',
    'DUTY': 'GOVD',
    'GSTIMP': 'GSTIMP',
    'BROKERAGE': 'GOVT',
    
    // Miscellaneous codes
    'MSC': 'MSC',
    'MISC': 'MSC',
    'MISCELLANEOUS': 'MSC',
    'OTHER': 'MSC',
    'CLAIMS': 'CLAIMS',
    'INSURANCE': 'ACC',
    'INS': 'ACC',
    
    // Special/legacy codes
    'IC LOG': 'IC LOG',
    'IC SUR': 'IC SUR',
    'INTEGRATED_CARRIERS_LOG': 'IC LOG',
    'INTEGRATED_CARRIERS_SUR': 'IC SUR'
};

/**
 * Validate and normalize a charge code for compatibility
 * @param {string} code Original charge code
 * @returns {Promise<Object>} Validation result with normalized code
 */
export async function validateChargeCode(code) {
    if (!code || typeof code !== 'string') {
        return {
            isValid: false,
            originalCode: code,
            normalizedCode: null,
            chargeType: null,
            isLegacy: false,
            error: 'Invalid or missing charge code'
        };
    }

    const upperCode = code.trim().toUpperCase();
    
    try {
        // Check if code exists in dynamic system
        const chargeType = await shipmentChargeTypeService.getChargeTypeByCode(upperCode);
        
        if (chargeType) {
            return {
                isValid: true,
                originalCode: code,
                normalizedCode: upperCode,
                chargeType: chargeType,
                isLegacy: !chargeType.isDynamic,
                migrationNeeded: false
            };
        }

        // Check legacy mapping
        const mappedCode = LEGACY_CHARGE_CODE_MAPPING[upperCode];
        if (mappedCode) {
            const mappedChargeType = await shipmentChargeTypeService.getChargeTypeByCode(mappedCode);
            
            if (mappedChargeType) {
                return {
                    isValid: true,
                    originalCode: code,
                    normalizedCode: mappedCode,
                    chargeType: mappedChargeType,
                    isLegacy: true,
                    migrationNeeded: true,
                    migrationNote: `Code '${upperCode}' mapped to '${mappedCode}'`
                };
            }
        }

        // Code not found in either system
        return {
            isValid: false,
            originalCode: code,
            normalizedCode: upperCode,
            chargeType: null,
            isLegacy: true,
            migrationNeeded: true,
            error: `Unknown charge code: ${upperCode}`,
            suggestion: await findSimilarChargeCode(upperCode)
        };

    } catch (error) {
        console.error('Error validating charge code:', error);
        
        // Fallback to static validation
        const staticCode = LEGACY_CHARGE_CODE_MAPPING[upperCode] || upperCode;
        
        return {
            isValid: true, // Allow it to work with fallback
            originalCode: code,
            normalizedCode: staticCode,
            chargeType: {
                value: staticCode,
                label: staticCode,
                description: `Legacy: ${staticCode}`,
                category: 'miscellaneous',
                isDynamic: false,
                isFallback: true
            },
            isLegacy: true,
            migrationNeeded: true,
            error: 'Dynamic system unavailable, using fallback'
        };
    }
}

/**
 * Find similar charge codes for suggestions
 * @param {string} code Code to find similar matches for
 * @returns {Promise<string|null>} Suggested code or null
 */
async function findSimilarChargeCode(code) {
    try {
        const chargeTypes = await shipmentChargeTypeService.getChargeTypes();
        const upperCode = code.toUpperCase();
        
        // Look for partial matches in codes
        for (const chargeType of chargeTypes) {
            if (chargeType.value.includes(upperCode) || upperCode.includes(chargeType.value)) {
                return chargeType.value;
            }
        }

        // Look for partial matches in descriptions
        for (const chargeType of chargeTypes) {
            if (chargeType.description.toLowerCase().includes(code.toLowerCase()) ||
                code.toLowerCase().includes(chargeType.description.toLowerCase())) {
                return chargeType.value;
            }
        }

        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Maps API billing detail categories to dynamic charge types
 * @param {string} category - The category from API billing details
 * @param {string} name - The name/description from API billing details  
 * @param {Array} availableChargeTypes - Array of available dynamic charge types
 * @returns {Object} - Object with chargeCode and chargeName
 */
export function mapAPIChargesToDynamicTypes(category, name, availableChargeTypes = []) {
    const categoryLower = (category || '').toLowerCase();
    const nameLower = (name || '').toLowerCase();
    
    // Priority mapping: try to find exact matches first
    let chargeCode = null;
    let chargeName = name || '';
    
    // Check available dynamic charge types for matches
    if (availableChargeTypes && availableChargeTypes.length > 0) {
        // Try category-based matching first
        const categoryMapping = {
            'freight': 'FRT',
            'fuel': 'FUE', 
            'service': 'SUR',
            'accessorial': 'ACC',
            'taxes': 'TAX',
            'insurance': 'INS',
            'logistics': 'LOG',
            'government': 'GOV',
            'surcharges': 'SUR',
            'miscellaneous': 'MSC'
        };
        
        // First try direct category mapping
        if (categoryMapping[categoryLower]) {
            const preferredCode = categoryMapping[categoryLower];
            const matchingType = availableChargeTypes.find(ct => ct.value === preferredCode);
            if (matchingType) {
                chargeCode = matchingType.value;
                chargeName = matchingType.description || name || matchingType.label || chargeCode;
                return { chargeCode, chargeName };
            }
        }
        
        // Try name-based matching
        for (const nameKey of Object.keys(categoryMapping)) {
            if (nameLower.includes(nameKey)) {
                const preferredCode = categoryMapping[nameKey];
                const matchingType = availableChargeTypes.find(ct => ct.value === preferredCode);
                if (matchingType) {
                    chargeCode = matchingType.value;
                    chargeName = matchingType.description || name || matchingType.label || chargeCode;
                    return { chargeCode, chargeName };
                }
            }
        }
        
        // Try finding any charge type that matches the name
        const nameMatch = availableChargeTypes.find(ct => 
            (ct.description && ct.description.toLowerCase().includes(nameLower)) ||
            (ct.label && ct.label.toLowerCase().includes(nameLower)) ||
            nameLower.includes((ct.description || '').toLowerCase()) ||
            nameLower.includes((ct.label || '').toLowerCase())
        );
        
        if (nameMatch) {
            chargeCode = nameMatch.value;
            chargeName = nameMatch.description || name || nameMatch.label || chargeCode;
            return { chargeCode, chargeName };
        }
    }
    
    // Fallback to static mapping if no dynamic match found
    const staticMapping = {
        'freight': 'FRT',
        'fuel': 'FUE',
        'service': 'SUR', 
        'accessorial': 'ACC',
        'taxes': 'TAX',
        'insurance': 'INS',
        'surcharges': 'SUR',
        'miscellaneous': 'MSC'
    };
    
    // Try static category mapping
    if (staticMapping[categoryLower]) {
        chargeCode = staticMapping[categoryLower];
        return { chargeCode, chargeName };
    }
    
    // Try static name-based mapping
    for (const nameKey of Object.keys(staticMapping)) {
        if (nameLower.includes(nameKey)) {
            chargeCode = staticMapping[nameKey];
            return { chargeCode, chargeName };
        }
    }
    
    // Ultimate fallback
    return { 
        chargeCode: 'MSC', 
        chargeName: name || 'Miscellaneous Charge'
    };
}

/**
 * Migrate a shipment's charge codes to new dynamic system
 * @param {Array} manualRates Array of manual rates to migrate
 * @returns {Promise<Object>} Migration result
 */
export async function migrateShipmentChargeCodes(manualRates) {
    if (!manualRates || !Array.isArray(manualRates)) {
        return {
            success: true,
            originalRates: [],
            migratedRates: [],
            changes: [],
            errors: []
        };
    }

    const migrationResult = {
        success: true,
        originalRates: [...manualRates],
        migratedRates: [],
        changes: [],
        errors: []
    };

    for (const rate of manualRates) {
        try {
            if (!rate.code) {
                // Keep rates without codes as-is
                migrationResult.migratedRates.push(rate);
                continue;
            }

            const validation = await validateChargeCode(rate.code);
            
            if (validation.isValid) {
                const migratedRate = { ...rate };
                
                if (validation.migrationNeeded && validation.normalizedCode !== rate.code) {
                    // Update the code
                    migratedRate.code = validation.normalizedCode;
                    
                    // Update charge name if it was auto-populated or empty
                    if (!rate.chargeName || rate.chargeName === rate.code || 
                        validation.chargeType?.description) {
                        migratedRate.chargeName = validation.chargeType.description;
                    }
                    
                    migrationResult.changes.push({
                        type: 'code_migration',
                        originalCode: rate.code,
                        newCode: validation.normalizedCode,
                        originalName: rate.chargeName,
                        newName: migratedRate.chargeName,
                        rateId: rate.id
                    });
                }
                
                migrationResult.migratedRates.push(migratedRate);
            } else {
                // Keep invalid codes but flag them
                migrationResult.migratedRates.push(rate);
                migrationResult.errors.push({
                    type: 'invalid_code',
                    code: rate.code,
                    error: validation.error,
                    suggestion: validation.suggestion,
                    rateId: rate.id
                });
                migrationResult.success = false;
            }
        } catch (error) {
            migrationResult.errors.push({
                type: 'migration_error',
                code: rate.code,
                error: error.message,
                rateId: rate.id
            });
            migrationResult.success = false;
            
            // Keep original rate
            migrationResult.migratedRates.push(rate);
        }
    }

    return migrationResult;
}

/**
 * Validate an array of charge codes
 * @param {Array} codes Array of charge codes to validate
 * @returns {Promise<Array>} Array of validation results
 */
export async function validateChargeCodes(codes) {
    if (!codes || !Array.isArray(codes)) {
        return [];
    }

    const validations = [];
    
    for (const code of codes) {
        const validation = await validateChargeCode(code);
        validations.push(validation);
    }

    return validations;
}

/**
 * Get all valid charge codes for validation purposes
 * @returns {Promise<Array>} Array of valid charge codes
 */
export async function getValidChargeCodesForValidation() {
    try {
        const dynamicCodes = await shipmentChargeTypeService.getValidCodes();
        const legacyCodes = Object.keys(LEGACY_CHARGE_CODE_MAPPING);
        
        // Combine and deduplicate
        const allCodes = [...new Set([...dynamicCodes, ...legacyCodes])];
        
        return allCodes;
    } catch (error) {
        console.error('Error getting valid charge codes:', error);
        // Return legacy codes as fallback
        return Object.keys(LEGACY_CHARGE_CODE_MAPPING);
    }
}

/**
 * Check if a manual rates array needs migration
 * @param {Array} manualRates Array of manual rates
 * @returns {Promise<boolean>} True if migration is needed
 */
export async function needsMigration(manualRates) {
    if (!manualRates || !Array.isArray(manualRates)) {
        return false;
    }

    for (const rate of manualRates) {
        if (rate.code) {
            const validation = await validateChargeCode(rate.code);
            if (validation.migrationNeeded) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Create a migration summary for display to users
 * @param {Object} migrationResult Result from migrateShipmentChargeCodes
 * @returns {Object} User-friendly migration summary
 */
export function createMigrationSummary(migrationResult) {
    const summary = {
        totalRates: migrationResult.originalRates.length,
        migratedRates: migrationResult.changes.length,
        errors: migrationResult.errors.length,
        success: migrationResult.success,
        details: []
    };

    // Add change details
    migrationResult.changes.forEach(change => {
        if (change.type === 'code_migration') {
            summary.details.push({
                type: 'success',
                message: `Updated charge code '${change.originalCode}' to '${change.newCode}'`,
                technical: change
            });
        }
    });

    // Add error details
    migrationResult.errors.forEach(error => {
        let message = `Issue with charge code '${error.code}': ${error.error}`;
        if (error.suggestion) {
            message += ` (Suggestion: ${error.suggestion})`;
        }
        
        summary.details.push({
            type: 'error',
            message: message,
            technical: error
        });
    });

    return summary;
} 