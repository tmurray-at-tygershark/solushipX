/**
 * Validates required fields in an object
 * @param {Object} data - The object to validate
 * @param {string[]} requiredFields - Array of required field names
 * @throws {Error} If any required field is missing
 */
function validateRequiredFields(data, requiredFields) {
    const missingFields = requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
}

/**
 * Validates an address object
 * @param {Object} address - The address object to validate
 * @throws {Error} If the address is invalid
 */
function validateAddress(address) {
    const requiredFields = ['city', 'state', 'postalCode', 'country'];
    validateRequiredFields(address, requiredFields);

    // Additional address validation rules
    if (address.country === 'US' && !/^\d{5}(-\d{4})?$/.test(address.postalCode)) {
        throw new Error('Invalid US postal code format');
    }
    if (address.country === 'CA' && !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(address.postalCode)) {
        throw new Error('Invalid Canadian postal code format');
    }
}

/**
 * Validates package dimensions
 * @param {Object} dimensions - The package dimensions object
 * @throws {Error} If dimensions are invalid
 */
function validateDimensions(dimensions) {
    const requiredFields = ['length', 'width', 'height', 'weight'];
    validateRequiredFields(dimensions, requiredFields);

    // Validate numeric values and ranges
    for (const field of requiredFields) {
        const value = parseFloat(dimensions[field]);
        if (isNaN(value) || value <= 0) {
            throw new Error(`Invalid ${field}: must be a positive number`);
        }
    }
}

module.exports = {
    validateRequiredFields,
    validateAddress,
    validateDimensions
}; 