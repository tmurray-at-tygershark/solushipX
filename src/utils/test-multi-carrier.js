/**
 * Test Multi-Carrier Rate Fetching System
 * This file contains test functions to verify the multi-carrier implementation
 */

import { fetchMultiCarrierRates, getEligibleCarriers } from './carrierEligibility';

// Test freight shipment data - DOMESTIC (CA -> CA)
const testDomesticFreightShipment = {
    shipFrom: {
        company: 'Test Shipper Inc',
        address: '123 Shipping St',
        city: 'Toronto',
        state: 'ON',
        province: 'ON',
        postalCode: 'M5V 3A8',
        country: 'CA',
        contact: 'John Shipper',
        phone: '416-555-0123',
        email: 'shipper@test.com'
    },
    shipTo: {
        company: 'Test Receiver Corp',
        address: '456 Receiving Ave',
        city: 'Vancouver',
        state: 'BC',
        province: 'BC',
        postalCode: 'V6B 1A1',
        country: 'CA', // Same country = DOMESTIC
        contact: 'Jane Receiver',
        phone: '604-555-0456',
        email: 'receiver@test.com'
    },
    packages: [
        {
            description: 'Test Freight Item',
            weight: 500,
            length: 48,
            width: 40,
            height: 36,
            packagingQuantity: 2,
            freightClass: '70',
            declaredValue: 1000,
            stackable: true
        }
    ],
    shipmentInfo: {
        shipmentType: 'freight',
        shipmentDate: new Date().toISOString().split('T')[0],
        shipperReferenceNumber: 'TEST-DOMESTIC-001'
    }
};

// Test freight shipment data - INTERNATIONAL (CA -> US)
const testInternationalFreightShipment = {
    shipFrom: {
        company: 'Test Shipper Inc',
        address: '123 Shipping St',
        city: 'Toronto',
        state: 'ON',
        province: 'ON',
        postalCode: 'M5V 3A8',
        country: 'CA',
        contact: 'John Shipper',
        phone: '416-555-0123',
        email: 'shipper@test.com'
    },
    shipTo: {
        company: 'Test Receiver Corp',
        address: '456 Receiving Ave',
        city: 'New York',
        state: 'NY',
        province: 'NY',
        postalCode: '10001',
        country: 'US', // Different country = INTERNATIONAL
        contact: 'Jane Receiver',
        phone: '212-555-0456',
        email: 'receiver@test.com'
    },
    packages: [
        {
            description: 'Test International Freight',
            weight: 750,
            length: 48,
            width: 40,
            height: 36,
            packagingQuantity: 3,
            freightClass: '70',
            declaredValue: 1500,
            stackable: true
        }
    ],
    shipmentInfo: {
        shipmentType: 'freight',
        shipmentDate: new Date().toISOString().split('T')[0],
        shipperReferenceNumber: 'TEST-INTERNATIONAL-001'
    }
};

// Test courier shipment data
const testCourierShipment = {
    shipFrom: {
        company: 'Test Shipper Inc',
        address: '123 Shipping St',
        city: 'Toronto',
        state: 'ON',
        province: 'ON',
        postalCode: 'M5V 3A8',
        country: 'CA',
        contact: 'John Shipper',
        phone: '416-555-0123',
        email: 'shipper@test.com'
    },
    shipTo: {
        company: 'Test Receiver Corp',
        address: '456 Receiving Ave',
        city: 'Vancouver',
        state: 'BC',
        province: 'BC',
        postalCode: 'V6B 1A1',
        country: 'CA',
        contact: 'Jane Receiver',
        phone: '604-555-0456',
        email: 'receiver@test.com'
    },
    packages: [
        {
            description: 'Test Package',
            weight: 5,
            length: 12,
            width: 8,
            height: 6,
            packagingQuantity: 1,
            declaredValue: 100
        }
    ],
    shipmentInfo: {
        shipmentType: 'courier',
        shipmentDate: new Date().toISOString().split('T')[0],
        shipperReferenceNumber: 'TEST-COURIER-001'
    }
};

/**
 * Test eligible carrier detection
 */
export async function testEligibleCarriers() {
    console.log('🧪 Testing Eligible Carrier Detection...');
    
    // Test domestic freight shipment (CA -> CA)
    console.log('\n📦 Testing DOMESTIC Freight Shipment (CA -> CA):');
    const domesticFreightCarriers = getEligibleCarriers(testDomesticFreightShipment);
    console.log('Eligible carriers for domestic freight:', domesticFreightCarriers.map(c => c.name));
    
    // Test international freight shipment (CA -> US) 
    console.log('\n🌍 Testing INTERNATIONAL Freight Shipment (CA -> US):');
    const internationalFreightCarriers = getEligibleCarriers(testInternationalFreightShipment);
    console.log('Eligible carriers for international freight:', internationalFreightCarriers.map(c => c.name));
    
    // Test courier shipment
    console.log('\n📫 Testing Courier Shipment:');
    const courierCarriers = getEligibleCarriers(testCourierShipment);
    console.log('Eligible carriers for courier:', courierCarriers.map(c => c.name));
    
    return { domesticFreightCarriers, internationalFreightCarriers, courierCarriers };
}

/**
 * Test multi-carrier rate fetching for domestic freight
 */
export async function testMultiCarrierDomesticFreightRates() {
    console.log('🧪 Testing Multi-Carrier DOMESTIC Freight Rate Fetching...');
    
    try {
        const result = await fetchMultiCarrierRates(testDomesticFreightShipment, {
            timeout: 30000,
            includeFailures: true
        });
        
        console.log('✅ Multi-carrier domestic freight fetch completed:');
        console.log('Summary:', result.summary);
        console.log('Total rates found:', result.rates.length);
        
        // Log rate breakdown by carrier
        const ratesByCarrier = {};
        result.rates.forEach(rate => {
            const carrier = rate.sourceCarrier?.name || 'Unknown';
            if (!ratesByCarrier[carrier]) {
                ratesByCarrier[carrier] = [];
            }
            ratesByCarrier[carrier].push(rate);
        });
        
        console.log('\n📊 Domestic freight rate breakdown by carrier:');
        Object.entries(ratesByCarrier).forEach(([carrier, rates]) => {
            console.log(`${carrier}: ${rates.length} rates`);
            rates.forEach(rate => {
                console.log(`  - ${rate.displayCarrier?.name || rate.carrier?.name}: $${rate.pricing?.total || rate.totalCharges}`);
            });
        });
        
        return result;
        
    } catch (error) {
        console.error('❌ Multi-carrier domestic freight test failed:', error);
        throw error;
    }
}

/**
 * Test multi-carrier rate fetching for international freight
 */
export async function testMultiCarrierInternationalFreightRates() {
    console.log('🧪 Testing Multi-Carrier INTERNATIONAL Freight Rate Fetching...');
    
    try {
        const result = await fetchMultiCarrierRates(testInternationalFreightShipment, {
            timeout: 30000,
            includeFailures: true
        });
        
        console.log('✅ Multi-carrier international freight fetch completed:');
        console.log('Summary:', result.summary);
        console.log('Total rates found:', result.rates.length);
        
        // Log rate breakdown by carrier
        const ratesByCarrier = {};
        result.rates.forEach(rate => {
            const carrier = rate.sourceCarrier?.name || 'Unknown';
            if (!ratesByCarrier[carrier]) {
                ratesByCarrier[carrier] = [];
            }
            ratesByCarrier[carrier].push(rate);
        });
        
        console.log('\n📊 International freight rate breakdown by carrier:');
        Object.entries(ratesByCarrier).forEach(([carrier, rates]) => {
            console.log(`${carrier}: ${rates.length} rates`);
            rates.forEach(rate => {
                console.log(`  - ${rate.displayCarrier?.name || rate.carrier?.name}: $${rate.pricing?.total || rate.totalCharges}`);
            });
        });
        
        return result;
        
    } catch (error) {
        console.error('❌ Multi-carrier international freight test failed:', error);
        throw error;
    }
}

/**
 * Test multi-carrier rate fetching for courier
 */
export async function testMultiCarrierCourierRates() {
    console.log('🧪 Testing Multi-Carrier Courier Rate Fetching...');
    
    try {
        const result = await fetchMultiCarrierRates(testCourierShipment, {
            timeout: 30000,
            includeFailures: true
        });
        
        console.log('✅ Multi-carrier courier fetch completed:');
        console.log('Summary:', result.summary);
        console.log('Total rates found:', result.rates.length);
        
        return result;
        
    } catch (error) {
        console.error('❌ Multi-carrier courier test failed:', error);
        throw error;
    }
}

/**
 * Run all tests
 */
export async function runAllTests() {
    console.log('🚀 Starting Multi-Carrier System Tests...');
    
    try {
        // Test 1: Eligible carriers
        await testEligibleCarriers();
        
        // Test 2: Domestic freight rates
        await testMultiCarrierDomesticFreightRates();
        
        // Test 3: International freight rates  
        await testMultiCarrierInternationalFreightRates();
        
        // Test 4: Courier rates
        await testMultiCarrierCourierRates();
        
        console.log('\n✅ All tests completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
        throw error;
    }
}

// Export test data for use in components
export { testDomesticFreightShipment, testInternationalFreightShipment, testCourierShipment }; 