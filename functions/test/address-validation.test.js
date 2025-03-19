const { validateAddress } = require('../utils/validation');
const assert = require('assert');

describe('Address Validation Tests', () => {
    // Test Case 1: Valid US address
    it('should validate a valid US address', () => {
        const address = {
            street1: '123 Main St',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'US'
        };
        assert.doesNotThrow(() => validateAddress(address));
    });

    // Test Case 2: Valid Canadian address
    it('should validate a valid Canadian address', () => {
        const address = {
            street1: '456 Queen St',
            city: 'Toronto',
            state: 'ON',
            postalCode: 'M5V 2H1',
            country: 'CA'
        };
        assert.doesNotThrow(() => validateAddress(address));
    });

    // Test Case 3: Invalid US postal code
    it('should reject invalid US postal code', () => {
        const address = {
            street1: '123 Main St',
            city: 'New York',
            state: 'NY',
            postalCode: '1234', // Invalid format
            country: 'US'
        };
        assert.throws(() => validateAddress(address), /Invalid US postal code format/);
    });

    // Test Case 4: Invalid Canadian postal code
    it('should reject invalid Canadian postal code', () => {
        const address = {
            street1: '456 Queen St',
            city: 'Toronto',
            state: 'ON',
            postalCode: '12345', // Invalid format
            country: 'CA'
        };
        assert.throws(() => validateAddress(address), /Invalid Canadian postal code format/);
    });

    // Test Case 5: Missing required fields
    it('should reject address with missing required fields', () => {
        const address = {
            street1: '123 Main St',
            city: 'New York',
            // Missing state and postal code
            country: 'US'
        };
        assert.throws(() => validateAddress(address), /Missing required fields/);
    });
}); 