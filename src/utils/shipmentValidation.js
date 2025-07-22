import shipmentChargeTypeService from '../services/shipmentChargeTypeService';
import { validateChargeCode, getValidChargeCodesForValidation } from './chargeTypeCompatibility';

/**
 * Shipment Validation Utilities
 * Enhanced validation for shipment forms with dynamic charge type support
 * Maintains backward compatibility with static validation
 */

/**
 * Enhanced QuickShip validation rules with dynamic charge type support
 */
export const ENHANCED_QUICKSHIP_VALIDATION = {
    shipFrom: {
        required: ['companyName', 'street', 'city', 'state', 'postalCode', 'country'],
        optional: ['contact', 'phone', 'email', 'street2']
    },
    shipTo: {
        required: ['companyName', 'street', 'city', 'state', 'postalCode', 'country'],
        optional: ['contact', 'phone', 'email', 'street2']
    },
    packages: {
        minCount: 1,
        maxCount: 99,
        required: ['itemDescription', 'packagingType', 'packagingQuantity', 'weight', 'length', 'width', 'height'],
        weightLimits: { min: 0.1, max: 30000 }, // lbs
        dimensionLimits: { min: 1, max: 999 } // inches
    },
    rates: {
        minCount: 0, // Allow no rates
        required: [], // No fields are required
        validateCodes: true // Enable dynamic code validation
    }
};

/**
 * Validate manual rates with dynamic charge type support
 * @param {Array} manualRates Array of manual rate objects
 * @param {Object} options Validation options
 * @returns {Promise<Object>} Validation result
 */
export async function validateManualRates(manualRates, options = {}) {
    const {
        allowEmptyRates = true,
        requireValidCodes = false,
        autoCorrectCodes = false
    } = options;

    // Allow empty rates if specified
    if (allowEmptyRates && (!manualRates || manualRates.length === 0)) {
        return { valid: true };
    }

    const errors = [];
    const warnings = [];
    const corrections = [];

    try {
        // Get valid codes for validation
        const validCodes = await getValidChargeCodesForValidation();

        for (let i = 0; i < manualRates.length; i++) {
            const rate = manualRates[i];
            const rateNumber = i + 1;

            // Validate rate code if provided
            if (rate.code) {
                const codeValidation = await validateChargeCode(rate.code);
                
                if (!codeValidation.isValid) {
                    if (requireValidCodes) {
                        errors.push({
                            field: 'code',
                            message: `Rate ${rateNumber}: ${codeValidation.error}`,
                            rateIndex: i,
                            suggestion: codeValidation.suggestion
                        });
                    } else {
                        warnings.push({
                            field: 'code',
                            message: `Rate ${rateNumber}: ${codeValidation.error}`,
                            rateIndex: i,
                            suggestion: codeValidation.suggestion
                        });
                    }
                } else if (codeValidation.migrationNeeded && autoCorrectCodes) {
                    corrections.push({
                        field: 'code',
                        message: `Rate ${rateNumber}: Code updated from '${rate.code}' to '${codeValidation.normalizedCode}'`,
                        rateIndex: i,
                        originalValue: rate.code,
                        correctedValue: codeValidation.normalizedCode
                    });
                }
            }

            // Validate numeric fields
            if (rate.cost !== '' && rate.cost !== null && rate.cost !== undefined) {
                const cost = parseFloat(rate.cost);
                if (isNaN(cost) || cost < 0) {
                    errors.push({
                        field: 'cost',
                        message: `Rate ${rateNumber}: Cost must be a valid number (0 or greater)`,
                        rateIndex: i
                    });
                }
            }

            if (rate.charge !== '' && rate.charge !== null && rate.charge !== undefined) {
                const charge = parseFloat(rate.charge);
                if (isNaN(charge) || charge < 0) {
                    errors.push({
                        field: 'charge',
                        message: `Rate ${rateNumber}: Charge must be a valid number (0 or greater)`,
                        rateIndex: i
                    });
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            corrections,
            validCodes // Include valid codes for reference
        };

    } catch (error) {
        console.error('Error validating manual rates:', error);
        
        // Fallback to basic validation
        return {
            valid: true,
            errors: [{
                field: 'system',
                message: 'Validation system temporarily unavailable - using basic validation',
                error: error.message
            }],
            warnings: [],
            corrections: [],
            fallbackUsed: true
        };
    }
}

/**
 * Enhanced package validation
 * @param {Array} packages Array of package objects
 * @param {string} unitSystem Unit system ('imperial' or 'metric')
 * @returns {Object} Validation result
 */
export function validatePackages(packages, unitSystem = 'imperial') {
    if (!packages || packages.length === 0) {
        return { valid: false, message: 'At least one package is required.' };
    }

    if (packages.length > ENHANCED_QUICKSHIP_VALIDATION.packages.maxCount) {
        return { 
            valid: false, 
            message: `Maximum ${ENHANCED_QUICKSHIP_VALIDATION.packages.maxCount} packages allowed.` 
        };
    }

    const weightLimits = unitSystem === 'metric' 
        ? { min: 0.05, max: 13608 } // kg equivalent
        : ENHANCED_QUICKSHIP_VALIDATION.packages.weightLimits;

    const dimensionLimits = unitSystem === 'metric'
        ? { min: 2.5, max: 2540 } // cm equivalent
        : ENHANCED_QUICKSHIP_VALIDATION.packages.dimensionLimits;

    for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i];
        const packageNumber = i + 1;

        // Check required fields
        for (const field of ENHANCED_QUICKSHIP_VALIDATION.packages.required) {
            if (!pkg[field] || pkg[field] === '') {
                return { 
                    valid: false, 
                    message: `Package ${packageNumber}: ${field} is required.` 
                };
            }
        }

        // Validate weight
        const weight = parseFloat(pkg.weight);
        if (isNaN(weight) || weight < weightLimits.min || weight > weightLimits.max) {
            const unit = unitSystem === 'metric' ? 'kg' : 'lbs';
            return { 
                valid: false, 
                message: `Package ${packageNumber}: Weight must be between ${weightLimits.min} and ${weightLimits.max} ${unit}.` 
            };
        }

        // Validate dimensions
        const dimensions = ['length', 'width', 'height'];
        for (const dim of dimensions) {
            const value = parseFloat(pkg[dim]);
            if (isNaN(value) || value < dimensionLimits.min || value > dimensionLimits.max) {
                const unit = unitSystem === 'metric' ? 'cm' : 'in';
                return { 
                    valid: false, 
                    message: `Package ${packageNumber}: ${dim} must be between ${dimensionLimits.min} and ${dimensionLimits.max} ${unit}.` 
                };
            }
        }

        // Validate packaging quantity
        const quantity = parseInt(pkg.packagingQuantity);
        if (isNaN(quantity) || quantity < 1 || quantity > 30) {
            return { 
                valid: false, 
                message: `Package ${packageNumber}: Packaging quantity must be between 1 and 30.` 
            };
        }

        // Validate declared value if provided
        if (pkg.declaredValue && pkg.declaredValue !== '') {
            const declaredValue = parseFloat(pkg.declaredValue);
            if (isNaN(declaredValue) || declaredValue < 0) {
                return { 
                    valid: false, 
                    message: `Package ${packageNumber}: Declared value must be a valid positive number.` 
                };
            }
        }
    }

    return { valid: true };
}

/**
 * Enhanced address validation
 * @param {Object} address Address object to validate
 * @param {string} type Address type ('shipFrom' or 'shipTo')
 * @returns {Object} Validation result
 */
export function validateAddress(address, type) {
    if (!address) {
        return { 
            valid: false, 
            message: `${type === 'shipFrom' ? 'Ship from' : 'Ship to'} address is required.` 
        };
    }

    const requiredFields = ENHANCED_QUICKSHIP_VALIDATION[type]?.required || 
                          ENHANCED_QUICKSHIP_VALIDATION.shipFrom.required;

    for (const field of requiredFields) {
        if (!address[field] || address[field].toString().trim() === '') {
            return { 
                valid: false, 
                message: `${type === 'shipFrom' ? 'Ship from' : 'Ship to'} address: ${field} is required.` 
            };
        }
    }

    // Validate postal code format (basic validation)
    if (address.postalCode) {
        const postalCode = address.postalCode.replace(/\s/g, '').toUpperCase();
        const isCanadian = address.country === 'CA' || address.country === 'CAN';
        const isUS = address.country === 'US' || address.country === 'USA';

        if (isCanadian) {
            // Canadian postal code format: A1A 1A1
            const canadianPattern = /^[A-Z]\d[A-Z]\d[A-Z]\d$/;
            if (!canadianPattern.test(postalCode)) {
                return { 
                    valid: false, 
                    message: `${type === 'shipFrom' ? 'Ship from' : 'Ship to'} address: Invalid Canadian postal code format (should be A1A 1A1).` 
                };
            }
        } else if (isUS) {
            // US ZIP code format: 12345 or 12345-6789
            const usPattern = /^\d{5}(-?\d{4})?$/;
            if (!usPattern.test(postalCode)) {
                return { 
                    valid: false, 
                    message: `${type === 'shipFrom' ? 'Ship from' : 'Ship to'} address: Invalid US ZIP code format.` 
                };
            }
        }
    }

    return { valid: true };
}

/**
 * Comprehensive QuickShip form validation
 * @param {Object} formData Complete form data object
 * @param {Object} options Validation options
 * @returns {Promise<Object>} Complete validation result
 */
export async function validateQuickShipForm(formData, options = {}) {
    const {
        requireRates = false,
        validateChargeTypes = true,
        autoCorrectCodes = false
    } = options;

    const validationResults = {
        valid: true,
        errors: [],
        warnings: [],
        corrections: [],
        sections: {}
    };

    try {
        // Validate addresses
        const shipFromValidation = validateAddress(formData.shipFromAddress, 'shipFrom');
        validationResults.sections.shipFrom = shipFromValidation;
        if (!shipFromValidation.valid) {
            validationResults.valid = false;
            validationResults.errors.push(shipFromValidation.message);
        }

        const shipToValidation = validateAddress(formData.shipToAddress, 'shipTo');
        validationResults.sections.shipTo = shipToValidation;
        if (!shipToValidation.valid) {
            validationResults.valid = false;
            validationResults.errors.push(shipToValidation.message);
        }

        // Validate packages
        const packagesValidation = validatePackages(formData.packages, formData.unitSystem);
        validationResults.sections.packages = packagesValidation;
        if (!packagesValidation.valid) {
            validationResults.valid = false;
            validationResults.errors.push(packagesValidation.message);
        }

        // Validate carrier selection
        if (!formData.selectedCarrier || formData.selectedCarrier.trim() === '') {
            validationResults.valid = false;
            validationResults.errors.push('Please select a carrier for your shipment.');
        }

        // Validate manual rates
        const ratesValidation = await validateManualRates(formData.manualRates, {
            allowEmptyRates: !requireRates,
            requireValidCodes: validateChargeTypes,
            autoCorrectCodes: autoCorrectCodes
        });

        validationResults.sections.rates = ratesValidation;
        if (!ratesValidation.valid) {
            validationResults.valid = false;
            validationResults.errors.push(...ratesValidation.errors.map(e => e.message));
        }

        // Collect warnings and corrections
        if (ratesValidation.warnings) {
            validationResults.warnings.push(...ratesValidation.warnings.map(w => w.message));
        }
        if (ratesValidation.corrections) {
            validationResults.corrections.push(...ratesValidation.corrections);
        }

        return validationResults;

    } catch (error) {
        console.error('Error during form validation:', error);
        
        return {
            valid: false,
            errors: ['Validation system error - please try again'],
            warnings: [],
            corrections: [],
            sections: {},
            systemError: error.message
        };
    }
}

/**
 * Get auto-populated charge name for a code
 * @param {string} code Charge type code
 * @param {string} currentName Current charge name
 * @returns {Promise<string>} Appropriate charge name
 */
export async function getAutoPopulatedChargeName(code, currentName = '') {
    try {
        return await shipmentChargeTypeService.autoPopulateChargeName(code, currentName);
    } catch (error) {
        console.error('Error getting auto-populated charge name:', error);
        // Fallback to current name or code
        return currentName || code || '';
    }
}

/**
 * Validate individual charge type code
 * @param {string} code Charge type code to validate
 * @returns {Promise<boolean>} True if valid
 */
export async function isValidChargeTypeCode(code) {
    try {
        const validation = await validateChargeCode(code);
        return validation.isValid;
    } catch (error) {
        console.error('Error validating charge type code:', error);
        // Fallback to allow unknown codes (for backward compatibility)
        return true;
    }
}

/**
 * Enhanced error messages for better user experience
 */
export const ENHANCED_ERROR_MESSAGES = {
    MISSING_ADDRESSES: 'Please select both ship from and ship to addresses before booking.',
    MISSING_CARRIER: 'Please select a carrier for your shipment.',
    INVALID_PACKAGES: 'Please ensure all package information is complete and valid.',
    INVALID_RATES: 'Please check your rate information for any errors.',
    INVALID_CHARGE_CODES: 'Some charge codes are not recognized. Please review and correct them.',
    WEIGHT_LIMIT: 'Package weight must be within the allowed limits.',
    DIMENSION_LIMIT: 'Package dimensions must be within the allowed limits.',
    NETWORK_ERROR: 'Network error occurred. Please check your connection and try again.',
    BOOKING_FAILED: 'Failed to book shipment. Please try again or contact support.',
    VALIDATION_ERROR: 'Please correct the highlighted errors before proceeding.'
}; 