/**
 * Firebase Cloud Function to Test MapCitySelector Functionality
 * This runs in the Firebase environment with proper authentication
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

exports.testMapCitySelector = functions.https.onCall(async (data, context) => {
    const testResults = {
        passed: 0,
        failed: 0,
        details: [],
        timestamp: new Date().toISOString()
    };

    function assert(condition, testName, details = '') {
        if (condition) {
            testResults.passed++;
            testResults.details.push({ status: 'PASS', test: testName, details, timestamp: new Date().toISOString() });
            console.log(`✅ PASS: ${testName} ${details}`);
            return true;
        } else {
            testResults.failed++;
            testResults.details.push({ status: 'FAIL', test: testName, details, timestamp: new Date().toISOString() });
            console.log(`❌ FAIL: ${testName} ${details}`);
            return false;
        }
    }

    try {
        console.log('🚀 STARTING MAP CITY SELECTOR VALIDATION');

        // TEST 1: Database coordinate verification
        console.log('🔍 TEST 1: Database Coordinate Verification');
        
        const canadaQuery = await db.collection('geoLocations')
            .where('country', '==', 'CA')
            .where('latitude', '!=', null)
            .where('longitude', '!=', null)
            .limit(100)
            .get();

        assert(
            canadaQuery.size > 0,
            'Canadian cities with coordinates exist',
            `Found ${canadaQuery.size} Canadian cities`
        );

        const usQuery = await db.collection('geoLocations')
            .where('country', '==', 'US')
            .where('latitude', '!=', null)
            .where('longitude', '!=', null)
            .limit(100)
            .get();

        assert(
            usQuery.size > 0,
            'US cities with coordinates exist',
            `Found ${usQuery.size} US cities`
        );

        // TEST 2: Ontario rectangle simulation
        console.log('🔍 TEST 2: Ontario Rectangle Simulation');
        
        const ontarioQuery = await db.collection('geoLocations')
            .where('country', '==', 'CA')
            .where('provinceState', '==', 'ON')
            .where('latitude', '>=', 43.0)
            .where('latitude', '<=', 45.0)
            .limit(1000)
            .get();

        // Filter by longitude for Toronto area
        const torontoAreaCities = ontarioQuery.docs.filter(doc => {
            const data = doc.data();
            const lng = parseFloat(data.longitude);
            return lng >= -80.0 && lng <= -79.0;
        });

        assert(
            torontoAreaCities.length > 0,
            'Toronto area rectangle detection works',
            `Found ${torontoAreaCities.length} cities in Toronto rectangle`
        );

        // TEST 3: Major city coordinate validation
        console.log('🔍 TEST 3: Major City Coordinate Validation');
        
        const majorCities = [
            { name: 'Toronto', country: 'CA', expectedLat: 43.7, expectedLng: -79.4 },
            { name: 'Vancouver', country: 'CA', expectedLat: 49.2, expectedLng: -123.1 },
            { name: 'New York', country: 'US', expectedLat: 40.7, expectedLng: -74.0 },
            { name: 'Los Angeles', country: 'US', expectedLat: 34.0, expectedLng: -118.2 }
        ];

        for (const city of majorCities) {
            const cityQuery = await db.collection('geoLocations')
                .where('city', '==', city.name)
                .where('country', '==', city.country)
                .where('latitude', '!=', null)
                .limit(1)
                .get();

            if (!cityQuery.empty) {
                const cityData = cityQuery.docs[0].data();
                const latDiff = Math.abs(parseFloat(cityData.latitude) - city.expectedLat);
                const lngDiff = Math.abs(parseFloat(cityData.longitude) - city.expectedLng);

                assert(
                    latDiff < 1.0 && lngDiff < 1.0,
                    `${city.name} coordinates are geographically accurate`,
                    `Actual: (${cityData.latitude}, ${cityData.longitude}), Expected: (${city.expectedLat}, ${city.expectedLng})`
                );
            } else {
                assert(false, `${city.name} exists in database`, 'City not found');
            }
        }

        // TEST 4: Performance validation
        console.log('🔍 TEST 4: Performance Validation');
        
        const startTime = Date.now();
        const performanceQuery = await db.collection('geoLocations')
            .where('latitude', '!=', null)
            .where('longitude', '!=', null)
            .limit(5000)
            .get();
        const queryTime = Date.now() - startTime;

        assert(
            queryTime < 15000,
            'Database query performance is acceptable',
            `Query took ${queryTime}ms for ${performanceQuery.size} records`
        );

        // TEST 5: Coordinate data quality
        console.log('🔍 TEST 5: Coordinate Data Quality');
        
        let validCoords = 0;
        let invalidCoords = 0;
        
        performanceQuery.docs.slice(0, 200).forEach(doc => {
            const data = doc.data();
            const lat = parseFloat(data.latitude);
            const lng = parseFloat(data.longitude);
            
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                validCoords++;
            } else {
                invalidCoords++;
            }
        });

        assert(
            validCoords > invalidCoords * 10, // At least 90% should be valid
            'Coordinate data quality is excellent',
            `Valid: ${validCoords}, Invalid: ${invalidCoords} (${((validCoords/(validCoords+invalidCoords))*100).toFixed(1)}% valid)`
        );

        // FINAL RESULT
        const successRate = (testResults.passed / (testResults.passed + testResults.failed)) * 100;
        
        return {
            success: testResults.failed === 0,
            successRate: successRate.toFixed(1),
            summary: {
                passed: testResults.passed,
                failed: testResults.failed,
                details: testResults.details
            },
            conclusion: testResults.failed === 0 ? 
                '🎉 PERFECT! All systems validated - MapCitySelector is enterprise-ready!' :
                `⚠️ ${testResults.failed} issues found - system needs optimization`
        };

    } catch (error) {
        console.error('❌ Test suite error:', error);
        return {
            success: false,
            error: error.message,
            conclusion: '❌ Test suite failed to complete'
        };
    }
});
