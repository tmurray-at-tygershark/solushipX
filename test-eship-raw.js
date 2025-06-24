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

// Your working request from earlier
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
    "BookingReferenceNumber": "DEBUG_TEST",
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
    "ReferenceNumber": "DEBUG_TEST",
    "ShipmentBillType": "DefaultLogisticsPlus",
    "shipmentInfo": {
        "billType": "third_party",
        "shipmentType": "freight",
        "shipmentDate": "2025-06-23",
        "serviceLevel": "any",
        "shipperReferenceNumber": "DEBUG_TEST"
    },
    "BookingReferenceNumberType": 2,
    "Items": [
        {
            "Stackable": true,
            "Height": 72,
            "Description": "DEBUG_TEST",
            "DeclaredValue": 0,
            "Weight": 100,
            "Width": 40,
            "FreightClass": { "FreightClass": 50 },
            "PackagingQuantity": 1,
            "Length": 48
        }
    ]
};

async function testRawEShipResponse() {
    const getRatesEShipPlus = httpsCallable(functions, 'getRatesEShipPlus');
    
    console.log('🔬 Testing Raw eShip Plus Response Structure');
    console.log('==============================================\n');
    
    try {
        console.log('📤 Sending request with reference: DEBUG_TEST');
        const result = await getRatesEShipPlus(workingRequest);
        
        console.log('📥 Full Response received:');
        console.log(JSON.stringify(result.data, null, 2));
        
        console.log('\n🔍 Response Analysis:');
        console.log('- Response Success:', result.data.success);
        console.log('- Data Object Keys:', Object.keys(result.data.data || {}));
        console.log('- Available Rates Array:', result.data.data?.availableRates);
        console.log('- Available Rates Length:', result.data.data?.availableRates?.length);
        
        if (result.data.data?.availableRates?.length === 0) {
            console.log('\n❌ ISSUE IDENTIFIED: availableRates array is empty');
            console.log('This means the eShip Plus API is responding but not returning rate data.');
            console.log('Check the Firebase function logs for the raw eShip Plus response to see what fields it actually returns.');
        } else {
            console.log('\n✅ Rates found!', result.data.data.availableRates);
        }
        
    } catch (error) {
        console.log('❌ Test failed with error:', error.message);
        console.log('Error details:', error);
    }
}

// Run the test
testRawEShipResponse().catch(console.error); 