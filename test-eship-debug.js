const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDvyWbWfKk-pWjZKrVGK8bNYTtE_nNmEkw",
    authDomain: "solushipx.firebaseapp.com",
    projectId: "solushipx",
    storageBucket: "solushipx.firebasestorage.app",
    messagingSenderId: "590187366464",
    appId: "1:590187366464:web:f9e8c1a5e2e1f8e9e8e8e8",
    measurementId: "G-XXXXXXXXXX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

// Test data structures
const workingRequest = {
    "DeclineAdditionalInsuranceIfApplicable": true,
    "Destination": {
        "Contact": "Receiving Department",
        "Phone": "6472621493",
        "SpecialInstructions": "Ring Bell on Entry",
        "PostalCode": "07072",
        "City": "Carlstadt",
        "State": "NJ",
        "Email": "tmurray@airmaticcompressor.com",
        "StreetExtra": "",
        "Street": "700 Washington Avenue",
        "Country": { "Code": "US" },
        "Description": ""
    },
    "EarliestDelivery": { "Time": "09:00" },
    "ShipmentDate": "2025-06-23T00:00:00.0000000-04:00",
    "LatestPickup": { "Time": "17:00" },
    "LatestDelivery": { "Time": "17:00" },
    "BookingReferenceNumber": "TYTY",
    "serviceLevels": ["economy"],
    "HazardousMaterialShipment": false,
    "Origin": {
        "StreetExtra": "Suite 301",
        "Country": { "Code": "CA" },
        "Street": "4 Plunkett Court",
        "State": "ON",
        "Contact": "Shipping Department",
        "Email": "tyler@tygershark.com",
        "Phone": "6472621493",
        "PostalCode": "L4N 6M3",
        "Description": "",
        "City": "Barrie",
        "SpecialInstructions": "Ring buzzer when arriving"
    },
    "EarliestPickup": { "Time": "09:00" },
    "ReferenceNumber": "TYTY",
    "ShipmentBillType": "DefaultLogisticsPlus",
    "shipmentInfo": {
        "billType": "third_party",
        "shipmentType": "freight",
        "shipmentDate": "2025-06-23",
        "serviceLevel": "any",
        "shipperReferenceNumber": "TYTY"
    },
    "BookingReferenceNumberType": 2,
    "Items": [
        {
            "Stackable": true,
            "Height": 72,
            "Description": "TYTY",
            "DeclaredValue": 0,
            "Weight": 100,
            "Width": 40,
            "FreightClass": { "FreightClass": 50 },
            "PackagingQuantity": 1,
            "Length": 48
        }
    ]
};

// Simulated advanced form data structure
const advancedFormData = {
    shipFrom: {
        companyName: "Test Company",
        firstName: "John",
        lastName: "Doe",
        street: "4 Plunkett Court",
        street2: "Suite 301",
        city: "Barrie",
        state: "ON",
        postalCode: "L4N 6M3",
        country: "CA",
        phone: "6472621493",
        email: "tyler@tygershark.com",
        specialInstructions: "Ring buzzer when arriving"
    },
    shipTo: {
        companyName: "Destination Company",
        firstName: "Jane",
        lastName: "Smith",
        street: "700 Washington Avenue",
        street2: "",
        city: "Carlstadt",
        state: "NJ",
        postalCode: "07072",
        country: "US",
        phone: "6472621493",
        email: "tmurray@airmaticcompressor.com",
        specialInstructions: "Ring Bell on Entry"
    },
    packages: [
        {
            id: 1,
            itemDescription: "TYTY",
            packagingType: 262,
            packagingQuantity: 1,
            weight: 100,
            length: 48,
            width: 40,
            height: 72,
            freightClass: 50,
            stackable: true,
            declaredValue: 0
        }
    ],
    shipmentInfo: {
        shipmentType: "freight",
        serviceLevel: "any",
        shipmentDate: "2025-06-23",
        shipperReferenceNumber: "TYTY",
        billType: "third_party"
    }
};

// eShip Plus translator function (copy from your code)
const formatFullTimestamp = (dateString) => {
    if (!dateString) return null; 
    
    const date = new Date(dateString + 'T00:00:00');
    if (isNaN(date.getTime())) return null; 

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0') + "0000";

    const timezoneOffset = -date.getTimezoneOffset();
    const offsetSign = timezoneOffset >= 0 ? '+' : '-';
    const offsetHours = Math.abs(Math.floor(timezoneOffset / 60)).toString().padStart(2, '0');
    const offsetMinutes = Math.abs(timezoneOffset % 60).toString().padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds.slice(0,7)}${offsetSign}${offsetHours}:${offsetMinutes}`;
};

function toEShipPlusRequest(formData) {
    const bookingRef = formData.shipmentInfo?.shipperReferenceNumber || '';
    
    return {
        BookingReferenceNumber: bookingRef,
        BookingReferenceNumberType: 2,
        ShipmentBillType: "DefaultLogisticsPlus",
        ShipmentDate: formatFullTimestamp(formData.shipmentInfo?.shipmentDate),
        EarliestPickup: {
            Time: formData.shipmentInfo?.pickupWindow?.earliest || '09:00',
        },
        LatestPickup: {
            Time: formData.shipmentInfo?.pickupWindow?.latest || '17:00',
        },
        EarliestDelivery: {
            Time: formData.shipmentInfo?.deliveryWindow?.earliest || '09:00',
        },
        LatestDelivery: {
            Time: formData.shipmentInfo?.deliveryWindow?.latest || '17:00',
        },
        Origin: {
            Description: formData.shipFrom?.company || formData.shipFrom?.name || '', 
            Street: formData.shipFrom?.street || '', 
            StreetExtra: formData.shipFrom?.street2 || '', 
            PostalCode: formData.shipFrom?.postalCode || formData.shipFrom?.zipPostal || '',
            City: formData.shipFrom?.city || '',
            State: formData.shipFrom?.state || '',
            Country: { Code: formData.shipFrom?.country || 'US' }, 
            Contact: formData.shipFrom?.contactName || formData.shipFrom?.attention || 'Shipping Department', 
            Phone: formData.shipFrom?.phone || formData.shipFrom?.contactPhone || '',
            Email: formData.shipFrom?.email || formData.shipFrom?.contactEmail || '',
            SpecialInstructions: formData.shipFrom?.specialInstructions || 'none',
        },
        Destination: {
            Description: formData.shipTo?.company || formData.shipTo?.name || '', 
            Street: formData.shipTo?.street || '', 
            StreetExtra: formData.shipTo?.street2 || '', 
            PostalCode: formData.shipTo?.postalCode || formData.shipTo?.zipPostal || '',
            City: formData.shipTo?.city || '',
            State: formData.shipTo?.state || '',
            Country: { Code: formData.shipTo?.country || 'US' }, 
            Contact: formData.shipTo?.contactName || formData.shipTo?.attention || 'Receiving Department',
            Phone: formData.shipTo?.phone || formData.shipTo?.contactPhone || '',
            Email: formData.shipTo?.email || formData.shipTo?.contactEmail || '',
            SpecialInstructions: formData.shipTo?.specialInstructions || 'none',
        },
        Items: (formData.packages || []).map(pkg => ({
            Description: pkg.itemDescription || "Package",
            Weight: parseFloat(pkg.weight) || 0,
            PackagingQuantity: parseInt(pkg.packagingQuantity) || 1,
            Height: parseFloat(pkg.height) || 0,
            Width: parseFloat(pkg.width) || 0,
            Length: parseFloat(pkg.length) || 0,
            FreightClass: { FreightClass: parseFloat(pkg.freightClass) || 50.0 },
            DeclaredValue: parseFloat(pkg.declaredValue) || 0,
            Stackable: typeof pkg.stackable === 'boolean' ? pkg.stackable : true,
        })),
        DeclineAdditionalInsuranceIfApplicable: true,
        HazardousMaterialShipment: (formData.packages || []).some(pkg => pkg.hazardous || false),
        
        // Additional fields that match the working request format
        ReferenceNumber: bookingRef,
        serviceLevels: formData.serviceLevels || ["economy"],
        shipmentInfo: formData.shipmentInfo || {}
    };
}

// Test function
async function testEShipPlusRates() {
    const getRatesEShipPlus = httpsCallable(functions, 'getRatesEShipPlus');
    
    console.log('🧪 Testing eShip Plus Rate Fetching');
    console.log('=====================================\n');
    
    // Test 1: Known working request
    console.log('📦 Test 1: Known Working Request Structure');
    console.log('------------------------------------------');
    try {
        console.log('Request payload:', JSON.stringify(workingRequest, null, 2));
        const result1 = await getRatesEShipPlus(workingRequest);
        console.log('✅ Success! Response:', JSON.stringify(result1.data, null, 2));
    } catch (error) {
        console.log('❌ Failed:', error.message);
        console.log('Error details:', error);
    }
    
    console.log('\n');
    
    // Test 2: Advanced form data through translator
    console.log('📦 Test 2: Advanced Form Data → Translator → eShip Plus');
    console.log('--------------------------------------------------------');
    try {
        const translatedRequest = toEShipPlusRequest(advancedFormData);
        console.log('Original form data:', JSON.stringify(advancedFormData, null, 2));
        console.log('\nTranslated request:', JSON.stringify(translatedRequest, null, 2));
        
        const result2 = await getRatesEShipPlus(translatedRequest);
        console.log('✅ Success! Response:', JSON.stringify(result2.data, null, 2));
    } catch (error) {
        console.log('❌ Failed:', error.message);
        console.log('Error details:', error);
    }
    
    console.log('\n');
    
    // Test 3: Compare structures
    console.log('📊 Test 3: Structure Comparison');
    console.log('--------------------------------');
    const translatedRequest = toEShipPlusRequest(advancedFormData);
    
    console.log('🔍 Key Differences Analysis:');
    console.log('Working vs Translated Structure:');
    
    // Compare Origins
    console.log('\n📍 Origin Comparison:');
    console.log('Working Origin:', JSON.stringify(workingRequest.Origin, null, 2));
    console.log('Translated Origin:', JSON.stringify(translatedRequest.Origin, null, 2));
    
    // Compare Destinations
    console.log('\n📍 Destination Comparison:');
    console.log('Working Destination:', JSON.stringify(workingRequest.Destination, null, 2));
    console.log('Translated Destination:', JSON.stringify(translatedRequest.Destination, null, 2));
    
    // Compare Items
    console.log('\n📦 Items Comparison:');
    console.log('Working Items:', JSON.stringify(workingRequest.Items, null, 2));
    console.log('Translated Items:', JSON.stringify(translatedRequest.Items, null, 2));
    
    // Test 4: Minimal working structure
    console.log('\n📦 Test 4: Minimal Structure Test');
    console.log('----------------------------------');
    
    const minimalRequest = {
        ...workingRequest,
        // Override with translator output to see what's different
        Origin: translatedRequest.Origin,
        Destination: translatedRequest.Destination,
        Items: translatedRequest.Items
    };
    
    try {
        console.log('Minimal hybrid request:', JSON.stringify(minimalRequest, null, 2));
        const result4 = await getRatesEShipPlus(minimalRequest);
        console.log('✅ Success! Response:', JSON.stringify(result4.data, null, 2));
    } catch (error) {
        console.log('❌ Failed:', error.message);
        console.log('Error details:', error);
    }
}

// Run the test
testEShipPlusRates().catch(console.error); 