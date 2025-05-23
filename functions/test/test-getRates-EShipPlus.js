const axios = require('axios');
require('dotenv').config();

// Test API key - replace with actual test key
const API_KEY = process.env.TEST_API_KEY || 'your-test-api-key';

// Test function URL - replace with actual deployed function URL
const API_URL = process.env.API_URL || 'https://us-central1-solushipx.cloudfunctions.net/getRatesEShipPlus';

// Sample valid request data
const validRequest = {
  bookingReferenceNumber: "test-shipment-123",
  bookingReferenceNumberType: "Shipment",
  shipmentBillType: "DefaultLogisticsPlus",
  shipmentDate: new Date().toISOString(),
  pickupWindow: {
    earliest: "09:00",
    latest: "17:00"
  },
  deliveryWindow: {
    earliest: "09:00",
    latest: "17:00"
  },
  fromAddress: {
    company: "Test Origin Company",
    street: "123 Test Street",
    street2: "Suite 100",
    postalCode: "94105",
    city: "San Francisco",
    state: "CA",
    country: "US",
    contactName: "John Test",
    contactPhone: "555-123-4567",
    contactEmail: "john@test.com",
    specialInstructions: "none"
  },
  toAddress: {
    company: "Test Destination Company",
    street: "456 Test Ave",
    street2: "",
    postalCode: "10001",
    city: "New York",
    state: "NY",
    country: "US",
    contactName: "Jane Test",
    contactPhone: "555-765-4321",
    contactEmail: "jane@test.com",
    specialInstructions: "none"
  },
  items: [
    {
      name: "Test Package",
      weight: 15.5,
      length: 24,
      width: 18,
      height: 12,
      quantity: 2,
      freightClass: "50",
      value: 500,
      stackable: true
    }
  ]
};

async function testGetRates() {
  console.log('Testing getRatesEShipPlus API...');
  console.log('Request:', JSON.stringify(validRequest, null, 2));
  
  try {
    const response = await axios.post(API_URL, validRequest, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    });
    
    console.log('Status Code:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('✅ Test PASSED: API returned successful response');
      
      if (response.data.data.availableRates && response.data.data.availableRates.length > 0) {
        console.log(`✅ ${response.data.data.availableRates.length} rates returned`);
        
        // Log the first rate details
        const firstRate = response.data.data.availableRates[0];
        console.log('Example Rate:');
        console.log(`  Carrier: ${firstRate.carrierName}`);
        console.log(`  Service: ${firstRate.serviceMode}`);
        console.log(`  Rate: $${firstRate.totalCharges}`);
        console.log(`  Transit Time: ${firstRate.transitTime} days`);
        console.log(`  Delivery Date: ${firstRate.estimatedDeliveryDate}`);
        
        // Check for eShipPlus specific fields
        console.log(`  Quote ID: ${firstRate.quoteId}`);
        console.log(`  SCAC: ${firstRate.carrierScac}`);
        console.log(`  Guaranteed: ${firstRate.guaranteedService ? 'Yes' : 'No'}`);
        
        if (firstRate.accessorials && firstRate.accessorials.length > 0) {
          console.log('  Accessorials:');
          firstRate.accessorials.forEach(acc => {
            console.log(`    - ${acc.description}: $${acc.amount}`);
          });
        }
      } else {
        console.log('⚠️ No rates were returned in the response');
      }
    } else {
      console.log('❌ Test FAILED: API returned error response');
    }
  } catch (error) {
    console.error('❌ Test FAILED with error:');
    if (error.response) {
      console.error('Status Code:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

// Run the test
testGetRates(); 