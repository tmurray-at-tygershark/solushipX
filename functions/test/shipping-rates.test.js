const axios = require('axios');
const assert = require('assert');

const API_URL = 'https://us-central1-solushipx.cloudfunctions.net/getShippingRates';

describe('Shipping Rates API Tests', () => {
    // Test Case 1: Domestic US shipment
    it('should calculate rates for domestic US shipment', async () => {
        const request = {
            fromAddress: {
                street1: '123 Main St',
                city: 'New York',
                state: 'NY',
                postalCode: '10001',
                country: 'US'
            },
            toAddress: {
                street1: '456 Market St',
                city: 'San Francisco',
                state: 'CA',
                postalCode: '94105',
                country: 'US'
            },
            package: {
                length: 12,
                width: 12,
                height: 12,
                weight: 10
            }
        };

        try {
            const response = await axios.post(API_URL, request);
            assert.strictEqual(response.status, 200);
            assert(response.data.success);
        } catch (error) {
            console.error('Test failed:', error.response?.data || error.message);
            throw error;
        }
    });

    // Test Case 2: International shipment (US to Canada)
    it('should calculate rates for international shipment', async () => {
        const request = {
            fromAddress: {
                street1: '123 Main St',
                city: 'Seattle',
                state: 'WA',
                postalCode: '98101',
                country: 'US'
            },
            toAddress: {
                street1: '456 Queen St',
                city: 'Vancouver',
                state: 'BC',
                postalCode: 'V6B 1Y1',
                country: 'CA'
            },
            package: {
                length: 12,
                width: 12,
                height: 12,
                weight: 10
            }
        };

        try {
            const response = await axios.post(API_URL, request);
            assert.strictEqual(response.status, 200);
            assert(response.data.success);
        } catch (error) {
            console.error('Test failed:', error.response?.data || error.message);
            throw error;
        }
    });

    // Test Case 3: Invalid address format
    it('should reject invalid address format', async () => {
        const request = {
            fromAddress: {
                street1: '123 Main St',
                city: 'New York',
                state: 'NY',
                postalCode: '1234', // Invalid format
                country: 'US'
            },
            toAddress: {
                street1: '456 Market St',
                city: 'San Francisco',
                state: 'CA',
                postalCode: '94105',
                country: 'US'
            },
            package: {
                length: 12,
                width: 12,
                height: 12,
                weight: 10
            }
        };

        try {
            await axios.post(API_URL, request);
            assert.fail('Should have thrown an error');
        } catch (error) {
            if (error.response) {
                assert.strictEqual(error.response.status, 400);
                assert(!error.response.data.success);
                assert(error.response.data.error.code === 'VALIDATION_ERROR');
            } else {
                throw error;
            }
        }
    });
}); 