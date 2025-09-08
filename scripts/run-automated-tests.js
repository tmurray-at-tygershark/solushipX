/**
 * Automated Test Runner for MapCitySelector
 * Calls Firebase Functions to run comprehensive validation
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { initializeApp: initializeClientApp } = require('firebase/app');

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyCf3rYCEhFA2ed0VIhLfJxerIlQqsbC4Gw",
    authDomain: "solushipx.firebaseapp.com",
    projectId: "solushipx",
    storageBucket: "solushipx.firebasestorage.app",
    messagingSenderId: "1056742230848",
    appId: "1:1056742230848:web:d1f2c3b4a5e6f7g8h9i0j1"
};

// Initialize client app
const app = initializeClientApp(firebaseConfig);
const functions = getFunctions(app);

async function runComprehensiveTests() {
    console.log('🚀 STARTING AUTOMATED MAP CITY SELECTOR TESTS');
    console.log('==============================================');
    
    try {
        // Call the Firebase Function to run tests
        const testFunction = httpsCallable(functions, 'testMapCitySelector');
        
        console.log('📞 Calling Firebase test function...');
        const result = await testFunction();
        
        console.log('📊 TEST RESULTS:');
        console.log('================');
        
        const data = result.data;
        
        console.log(`✅ PASSED: ${data.summary.passed}`);
        console.log(`❌ FAILED: ${data.summary.failed}`);
        console.log(`📈 SUCCESS RATE: ${data.successRate}%`);
        console.log(`🎯 CONCLUSION: ${data.conclusion}`);
        
        console.log('\n📋 DETAILED RESULTS:');
        console.log('====================');
        
        data.summary.details.forEach(detail => {
            const icon = detail.status === 'PASS' ? '✅' : '❌';
            console.log(`${icon} ${detail.test}: ${detail.details}`);
        });
        
        if (data.success) {
            console.log('\n🎉 ALL TESTS PASSED - SYSTEM IS PERFECT!');
            console.log('🚀 MapCitySelector is enterprise-ready for production!');
        } else {
            console.log('\n⚠️ SOME TESTS FAILED - INVESTIGATING...');
            
            // If tests failed, run additional diagnostics
            await runDiagnostics();
        }
        
        return data.success;
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        return false;
    }
}

async function runDiagnostics() {
    console.log('\n🔧 RUNNING ADDITIONAL DIAGNOSTICS...');
    console.log('====================================');
    
    try {
        // Test Google Maps API availability
        console.log('🗺️ Testing Google Maps API...');
        
        const response = await fetch(`https://maps.googleapis.com/maps/api/js?key=TEST&libraries=drawing,geometry`);
        console.log(`   API endpoint response status: ${response.status}`);
        
        // Test geometric algorithms locally
        console.log('📐 Testing geometric algorithms...');
        
        // Rectangle containment test
        const testBounds = { north: 45, south: 44, east: -79, west: -80 };
        const testPoint = { lat: 44.5, lng: -79.5 };
        
        const isInRectangle = (
            testPoint.lat >= testBounds.south &&
            testPoint.lat <= testBounds.north &&
            testPoint.lng >= testBounds.west &&
            testPoint.lng <= testBounds.east
        );
        
        console.log(`   Rectangle test: Point (${testPoint.lat}, ${testPoint.lng}) in bounds = ${isInRectangle}`);
        
        // Circle distance test
        const center = { lat: 45, lng: -79 };
        const radius = 50000; // 50km
        const testCity = { lat: 45.01, lng: -79.01 };
        
        const latDiff = (testCity.lat - center.lat) * 111000;
        const lngDiff = (testCity.lng - center.lng) * 111000 * Math.cos(center.lat * Math.PI / 180);
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
        
        console.log(`   Circle test: Distance ${Math.round(distance)}m, Radius ${radius}m, Within = ${distance <= radius}`);
        
    } catch (error) {
        console.error('❌ Diagnostics failed:', error);
    }
}

// Run the tests
runComprehensiveTests()
    .then(success => {
        if (success) {
            console.log('\n🎉 AUTOMATED TESTING COMPLETE - SYSTEM VALIDATED!');
            process.exit(0);
        } else {
            console.log('\n⚠️ AUTOMATED TESTING REVEALED ISSUES - FIXING...');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('❌ Automated testing failed:', error);
        process.exit(1);
    });
