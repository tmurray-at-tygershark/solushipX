const axios = require('axios');
const { expect } = require('chai');

const API_URL = 'https://getshippingrates-xedyh5vw7a-uc.a.run.app';

// Helper function to get tomorrow's date in YYYY-MM-DD format
function getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
}

describe('Shipping Rates API Tests', () => {
    // Test Case 1: Valid domestic shipment (US to US)
    it('should return rates for domestic US shipment', async function() {
        this.timeout(30000); // Increase timeout for this test
        const request = {
            origin: {
                postalCode: "90210",
                city: "Beverly Hills",
                state: "CA",
                country: "US"
            },
            destination: {
                postalCode: "10001",
                city: "New York",
                state: "NY",
                country: "US"
            },
            items: [{
                weight: 100,
                height: 10,
                width: 10,
                length: 10,
                quantity: 1
            }],
            shipmentDate: getTomorrowDate()
        };

        const response = await axios.post(`${API_URL}/rates`, request);
        expect(response.status).to.equal(200);
        expect(response.data.success).to.be.true;
        expect(response.data.rates).to.have.property('soap:Envelope');
    });

    // Test Case 2: International shipment (US to Canada)
    it('should return rates for international shipment (US to Canada)', async function() {
        this.timeout(30000); // Increase timeout for this test
        const request = {
            origin: {
                postalCode: "98101",
                city: "Seattle",
                state: "WA",
                country: "US"
            },
            destination: {
                postalCode: "V6B 1Y1",
                city: "Vancouver",
                state: "BC",
                country: "CA"
            },
            items: [{
                weight: 50,
                height: 8,
                width: 8,
                length: 8,
                quantity: 1
            }],
            shipmentDate: getTomorrowDate()
        };

        const response = await axios.post(`${API_URL}/rates`, request);
        expect(response.status).to.equal(200);
        expect(response.data.success).to.be.true;
        expect(response.data.rates).to.have.property('soap:Envelope');
    });

    // Test Case 3: Multiple items
    it('should handle multiple items in shipment', async () => {
        const request = {
            origin: {
                postalCode: "60601",
                city: "Chicago",
                state: "IL",
                country: "US"
            },
            destination: {
                postalCode: "77001",
                city: "Houston",
                state: "TX",
                country: "US"
            },
            items: [
                {
                    weight: 25,
                    height: 5,
                    width: 5,
                    length: 5,
                    quantity: 2
                },
                {
                    weight: 15,
                    height: 3,
                    width: 3,
                    length: 3,
                    quantity: 1
                }
            ],
            shipmentDate: getTomorrowDate()
        };

        const response = await axios.post(`${API_URL}/rates`, request);
        expect(response.status).to.equal(200);
        expect(response.data.success).to.be.true;
        expect(response.data.rates).to.have.property('soap:Envelope');
    });

    // Test Case 4: Invalid postal code
    it('should handle invalid postal code', async () => {
        const request = {
            origin: {
                postalCode: "invalid",
                city: "Chicago",
                state: "IL",
                country: "US"
            },
            destination: {
                postalCode: "77001",
                city: "Houston",
                state: "TX",
                country: "US"
            },
            items: [{
                weight: 25,
                height: 5,
                width: 5,
                length: 5,
                quantity: 1
            }],
            shipmentDate: getTomorrowDate()
        };

        try {
            await axios.post(`${API_URL}/rates`, request);
            throw new Error('Should have failed');
        } catch (error) {
            if (error.response) {
                expect(error.response.status).to.equal(400);
                expect(error.response.data.success).to.be.false;
                expect(error.response.data.error.code).to.equal('API_ERROR');
            } else {
                throw error;
            }
        }
    });

    // Test Case 5: Missing required fields
    it('should handle missing required fields', async () => {
        const request = {
            origin: {
                postalCode: "60601",
                city: "Chicago",
                state: "IL"
                // Missing country
            },
            destination: {
                postalCode: "77001",
                city: "Houston",
                state: "TX",
                country: "US"
            },
            items: [{
                weight: 25,
                height: 5,
                width: 5,
                length: 5,
                quantity: 1
            }],
            shipmentDate: getTomorrowDate()
        };

        try {
            await axios.post(`${API_URL}/rates`, request);
            throw new Error('Should have failed');
        } catch (error) {
            if (error.response) {
                expect(error.response.status).to.equal(400);
                expect(error.response.data.success).to.be.false;
                expect(error.response.data.error.code).to.equal('VALIDATION_ERROR');
            } else {
                throw error;
            }
        }
    });

    // Test Case 6: Invalid weight
    it('should handle invalid weight values', async () => {
        const request = {
            origin: {
                postalCode: "60601",
                city: "Chicago",
                state: "IL",
                country: "US"
            },
            destination: {
                postalCode: "77001",
                city: "Houston",
                state: "TX",
                country: "US"
            },
            items: [{
                weight: -1, // Invalid negative weight
                height: 5,
                width: 5,
                length: 5,
                quantity: 1
            }],
            shipmentDate: getTomorrowDate()
        };

        try {
            await axios.post(`${API_URL}/rates`, request);
            throw new Error('Should have failed');
        } catch (error) {
            if (error.response) {
                expect(error.response.status).to.equal(400);
                expect(error.response.data.success).to.be.false;
                expect(error.response.data.error.code).to.equal('VALIDATION_ERROR');
            } else {
                throw error;
            }
        }
    });
}); 