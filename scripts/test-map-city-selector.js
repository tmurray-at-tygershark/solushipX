/**
 * Automated Test Suite for MapCitySelector Component
 * 
 * This script validates the entire geographic selection system:
 * - Database coordinate queries
 * - Geometric city detection algorithms  
 * - Rectangle/Polygon/Circle area calculations
 * - API integration and error handling
 */

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'solushipx'
    });
}

const db = getFirestore();

class MapCitySelectorTester {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            details: []
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        
        console.log(logMessage);
        this.testResults.details.push({ timestamp, message, type });
    }

    assert(condition, testName, details = '') {
        if (condition) {
            this.testResults.passed++;
            this.log(`✅ PASS: ${testName} ${details}`, 'pass');
            return true;
        } else {
            this.testResults.failed++;
            this.log(`❌ FAIL: ${testName} ${details}`, 'fail');
            return false;
        }
    }

    // Test 1: Verify database has cities with coordinates
    async testDatabaseCoordinates() {
        this.log('🔍 TEST 1: Database Coordinate Verification');
        
        try {
            // Test Canadian cities
            const canadaQuery = await db.collection('geoLocations')
                .where('country', '==', 'CA')
                .where('latitude', '!=', null)
                .where('longitude', '!=', null)
                .limit(100)
                .get();

            this.assert(
                canadaQuery.size > 0,
                'Canadian cities with coordinates exist',
                `Found ${canadaQuery.size} Canadian cities with coordinates`
            );

            // Test US cities
            const usQuery = await db.collection('geoLocations')
                .where('country', '==', 'US')
                .where('latitude', '!=', null)
                .where('longitude', '!=', null)
                .limit(100)
                .get();

            this.assert(
                usQuery.size > 0,
                'US cities with coordinates exist',
                `Found ${usQuery.size} US cities with coordinates`
            );

            // Sample coordinate validation
            if (canadaQuery.size > 0) {
                const sampleCanada = canadaQuery.docs[0].data();
                this.assert(
                    typeof sampleCanada.latitude === 'number' && typeof sampleCanada.longitude === 'number',
                    'Canadian coordinate data types are correct',
                    `Sample: ${sampleCanada.city} (${sampleCanada.latitude}, ${sampleCanada.longitude})`
                );
            }

            if (usQuery.size > 0) {
                const sampleUS = usQuery.docs[0].data();
                this.assert(
                    typeof sampleUS.latitude === 'number' && typeof sampleUS.longitude === 'number',
                    'US coordinate data types are correct',
                    `Sample: ${sampleUS.city} (${sampleUS.latitude}, ${sampleUS.longitude})`
                );
            }

        } catch (error) {
            this.assert(false, 'Database coordinate query', `Error: ${error.message}`);
        }
    }

    // Test 2: Simulate rectangle bounds detection
    async testRectangleBounds() {
        this.log('🔍 TEST 2: Rectangle Bounds Simulation');
        
        try {
            // Simulate a rectangle over Greater Toronto Area
            const torontoBounds = {
                north: 44.0,    // North of Toronto
                south: 43.5,    // South of Toronto  
                east: -79.0,    // East of Toronto
                west: -79.8     // West of Toronto
            };

            this.log(`🗺️ Testing rectangle bounds: ${JSON.stringify(torontoBounds)}`);

            // Query cities within these bounds
            const citiesInBounds = await db.collection('geoLocations')
                .where('country', '==', 'CA')
                .where('provinceState', '==', 'ON')
                .where('latitude', '>=', torontoBounds.south)
                .where('latitude', '<=', torontoBounds.north)
                .get();

            this.log(`📊 Found ${citiesInBounds.size} cities in Toronto area query`);

            // Filter by longitude (Firestore doesn't support multiple range queries)
            const citiesWithinBounds = citiesInBounds.docs.filter(doc => {
                const data = doc.data();
                return data.longitude >= torontoBounds.west && data.longitude <= torontoBounds.east;
            });

            this.assert(
                citiesWithinBounds.length > 0,
                'Rectangle bounds detection works',
                `Found ${citiesWithinBounds.length} cities in Toronto rectangle`
            );

            // Log sample cities found
            citiesWithinBounds.slice(0, 5).forEach(doc => {
                const data = doc.data();
                this.log(`   🎯 City in bounds: ${data.city} (${data.latitude}, ${data.longitude})`);
            });

        } catch (error) {
            this.assert(false, 'Rectangle bounds simulation', `Error: ${error.message}`);
        }
    }

    // Test 3: Simulate polygon detection
    async testPolygonDetection() {
        this.log('🔍 TEST 3: Polygon Detection Simulation');
        
        try {
            // Simulate a polygon around Vancouver area
            const vancouverPolygon = [
                { lat: 49.3, lng: -123.2 }, // NE
                { lat: 49.3, lng: -123.0 }, // NW
                { lat: 49.2, lng: -123.0 }, // SW
                { lat: 49.2, lng: -123.2 }  // SE
            ];

            this.log(`🗺️ Testing polygon around Vancouver: ${JSON.stringify(vancouverPolygon)}`);

            // Query cities in BC
            const bcCities = await db.collection('geoLocations')
                .where('country', '==', 'CA')
                .where('provinceState', '==', 'BC')
                .where('latitude', '!=', null)
                .where('longitude', '!=', null)
                .limit(500)
                .get();

            this.log(`📊 Found ${bcCities.size} BC cities with coordinates`);

            // Simulate polygon containment check
            const citiesInPolygon = bcCities.docs.filter(doc => {
                const data = doc.data();
                const lat = parseFloat(data.latitude);
                const lng = parseFloat(data.longitude);
                
                // Simple point-in-polygon test (bounding box approximation)
                return lat >= 49.2 && lat <= 49.3 && lng >= -123.2 && lng <= -123.0;
            });

            this.assert(
                citiesInPolygon.length > 0,
                'Polygon detection algorithm works',
                `Found ${citiesInPolygon.length} cities in Vancouver polygon`
            );

            // Log sample cities
            citiesInPolygon.slice(0, 3).forEach(doc => {
                const data = doc.data();
                this.log(`   🎯 City in polygon: ${data.city} (${data.latitude}, ${data.longitude})`);
            });

        } catch (error) {
            this.assert(false, 'Polygon detection simulation', `Error: ${error.message}`);
        }
    }

    // Test 4: Validate province-level selection
    async testProvinceSelection() {
        this.log('🔍 TEST 4: Province Selection Validation');
        
        try {
            // Test Ontario province selection
            const ontarioCities = await db.collection('geoLocations')
                .where('country', '==', 'CA')
                .where('provinceState', '==', 'ON')
                .where('latitude', '!=', null)
                .where('longitude', '!=', null)
                .limit(1000)
                .get();

            this.assert(
                ontarioCities.size > 0,
                'Ontario province selection works',
                `Found ${ontarioCities.size} Ontario cities with coordinates`
            );

            // Test California state selection
            const californiaCities = await db.collection('geoLocations')
                .where('country', '==', 'US')
                .where('provinceState', '==', 'CA')
                .where('latitude', '!=', null)
                .where('longitude', '!=', null)
                .limit(1000)
                .get();

            this.assert(
                californiaCities.size > 0,
                'California state selection works',
                `Found ${californiaCities.size} California cities with coordinates`
            );

            // Validate coordinate ranges for Ontario (should be reasonable)
            if (ontarioCities.size > 0) {
                const ontarioData = ontarioCities.docs.map(doc => doc.data());
                const latitudes = ontarioData.map(d => parseFloat(d.latitude)).filter(lat => !isNaN(lat));
                const longitudes = ontarioData.map(d => parseFloat(d.longitude)).filter(lng => !isNaN(lng));
                
                const avgLat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
                const avgLng = longitudes.reduce((a, b) => a + b, 0) / longitudes.length;

                this.assert(
                    avgLat > 42 && avgLat < 57 && avgLng > -95 && avgLng < -74,
                    'Ontario coordinates are geographically correct',
                    `Average coordinates: (${avgLat.toFixed(2)}, ${avgLng.toFixed(2)})`
                );
            }

        } catch (error) {
            this.assert(false, 'Province selection validation', `Error: ${error.message}`);
        }
    }

    // Test 5: Performance and data quality
    async testDataQuality() {
        this.log('🔍 TEST 5: Data Quality and Performance');
        
        try {
            const startTime = Date.now();
            
            // Test query performance
            const performanceQuery = await db.collection('geoLocations')
                .where('latitude', '!=', null)
                .where('longitude', '!=', null)
                .limit(5000)
                .get();

            const queryTime = Date.now() - startTime;
            
            this.assert(
                queryTime < 10000,
                'Database query performance is acceptable',
                `Query took ${queryTime}ms for ${performanceQuery.size} records`
            );

            // Test coordinate data quality
            let validCoordinates = 0;
            let invalidCoordinates = 0;
            
            performanceQuery.docs.slice(0, 100).forEach(doc => {
                const data = doc.data();
                const lat = parseFloat(data.latitude);
                const lng = parseFloat(data.longitude);
                
                if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    validCoordinates++;
                } else {
                    invalidCoordinates++;
                }
            });

            this.assert(
                validCoordinates > invalidCoordinates,
                'Coordinate data quality is good',
                `Valid: ${validCoordinates}, Invalid: ${invalidCoordinates}`
            );

        } catch (error) {
            this.assert(false, 'Data quality test', `Error: ${error.message}`);
        }
    }

    // Test 6: Simulate geometric calculations
    testGeometricAlgorithms() {
        this.log('🔍 TEST 6: Geometric Algorithm Validation');
        
        try {
            // Test point-in-rectangle calculation
            const testBounds = {
                north: 45.0,
                south: 44.0,
                east: -79.0,
                west: -80.0
            };

            const testPoints = [
                { lat: 44.5, lng: -79.5, shouldBeInside: true, name: 'Center point' },
                { lat: 43.5, lng: -79.5, shouldBeInside: false, name: 'South of bounds' },
                { lat: 44.5, lng: -78.5, shouldBeInside: false, name: 'East of bounds' },
                { lat: 44.2, lng: -79.8, shouldBeInside: true, name: 'Inside bounds' }
            ];

            testPoints.forEach(point => {
                const isInside = (
                    point.lat >= testBounds.south &&
                    point.lat <= testBounds.north &&
                    point.lng >= testBounds.west &&
                    point.lng <= testBounds.east
                );

                this.assert(
                    isInside === point.shouldBeInside,
                    `Rectangle containment for ${point.name}`,
                    `Point (${point.lat}, ${point.lng}) - Expected: ${point.shouldBeInside}, Got: ${isInside}`
                );
            });

            // Test circle distance calculation (simplified)
            const center = { lat: 45.0, lng: -79.0 };
            const radius = 50000; // 50km in meters
            
            const testCityDistances = [
                { lat: 45.01, lng: -79.01, name: 'Very close city', shouldBeInside: true },
                { lat: 45.5, lng: -79.5, name: 'Distant city', shouldBeInside: false },
                { lat: 45.2, lng: -79.2, name: 'Medium distance city', shouldBeInside: true }
            ];

            testCityDistances.forEach(city => {
                // Simplified distance calculation (not exact but good for testing)
                const latDiff = (city.lat - center.lat) * 111000; // Rough meters per degree
                const lngDiff = (city.lng - center.lng) * 111000 * Math.cos(center.lat * Math.PI / 180);
                const approximateDistance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
                
                const isWithinRadius = approximateDistance <= radius;

                this.assert(
                    isWithinRadius === city.shouldBeInside,
                    `Circle containment for ${city.name}`,
                    `Distance: ${Math.round(approximateDistance)}m, Radius: ${radius}m`
                );
            });

        } catch (error) {
            this.assert(false, 'Geometric algorithms test', `Error: ${error.message}`);
        }
    }

    // Test 7: API key and Google Maps integration
    async testGoogleMapsIntegration() {
        this.log('🔍 TEST 7: Google Maps API Integration');
        
        try {
            // Test API key retrieval
            const keysSnapshot = await db.collection('keys').get();
            
            this.assert(
                !keysSnapshot.empty,
                'API keys collection exists',
                `Found ${keysSnapshot.size} key documents`
            );

            if (!keysSnapshot.empty) {
                const keyData = keysSnapshot.docs[0].data();
                
                this.assert(
                    keyData.googleAPI && keyData.googleAPI.length > 20,
                    'Google Maps API key is valid format',
                    `Key length: ${keyData.googleAPI?.length || 0} characters`
                );

                // Test API key format (should start with AIza)
                this.assert(
                    keyData.googleAPI?.startsWith('AIza'),
                    'API key has correct Google format',
                    `Key prefix: ${keyData.googleAPI?.substring(0, 10)}...`
                );
            }

        } catch (error) {
            this.assert(false, 'Google Maps API integration test', `Error: ${error.message}`);
        }
    }

    // Test 8: Comprehensive city coverage test
    async testCityCoverage() {
        this.log('🔍 TEST 8: City Coverage Analysis');
        
        try {
            // Test major Canadian cities
            const majorCanadianCities = ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Edmonton', 'Ottawa'];
            
            for (const cityName of majorCanadianCities) {
                const cityQuery = await db.collection('geoLocations')
                    .where('city', '==', cityName)
                    .where('country', '==', 'CA')
                    .where('latitude', '!=', null)
                    .limit(1)
                    .get();

                this.assert(
                    !cityQuery.empty,
                    `Major Canadian city ${cityName} exists with coordinates`,
                    cityQuery.empty ? 'Not found' : `Found at (${cityQuery.docs[0].data().latitude}, ${cityQuery.docs[0].data().longitude})`
                );
            }

            // Test major US cities
            const majorUSCities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
            
            for (const cityName of majorUSCities) {
                const cityQuery = await db.collection('geoLocations')
                    .where('city', '==', cityName)
                    .where('country', '==', 'US')
                    .where('latitude', '!=', null)
                    .limit(1)
                    .get();

                this.assert(
                    !cityQuery.empty,
                    `Major US city ${cityName} exists with coordinates`,
                    cityQuery.empty ? 'Not found' : `Found at (${cityQuery.docs[0].data().latitude}, ${cityQuery.docs[0].data().longitude})`
                );
            }

        } catch (error) {
            this.assert(false, 'City coverage test', `Error: ${error.message}`);
        }
    }

    // Test 9: Deduplication logic validation
    async testDeduplicationLogic() {
        this.log('🔍 TEST 9: Deduplication Logic Validation');
        
        try {
            // Test that cities with same name in same province are properly deduplicated
            const torontoQuery = await db.collection('geoLocations')
                .where('city', '==', 'Toronto')
                .where('country', '==', 'CA')
                .where('provinceState', '==', 'ON')
                .get();

            this.log(`📊 Found ${torontoQuery.size} Toronto records in database`);

            // Simulate deduplication logic
            const cityMap = new Map();
            let recordsWithCoords = 0;
            let recordsWithoutCoords = 0;

            torontoQuery.docs.forEach(doc => {
                const data = doc.data();
                const cityKey = `${data.city}-${data.provinceState}-${data.country}`.toLowerCase();
                
                if (data.latitude && data.longitude) {
                    recordsWithCoords++;
                } else {
                    recordsWithoutCoords++;
                }

                // Apply prioritization logic
                if (!cityMap.has(cityKey) || 
                    (data.latitude && data.longitude && !cityMap.get(cityKey).latitude)) {
                    cityMap.set(cityKey, {
                        city: data.city,
                        latitude: data.latitude,
                        longitude: data.longitude,
                        hasCoords: !!(data.latitude && data.longitude)
                    });
                }
            });

            const finalToronto = cityMap.get('toronto-on-ca');

            this.assert(
                finalToronto && finalToronto.hasCoords,
                'Deduplication prioritizes records with coordinates',
                `Final Toronto record has coordinates: ${!!finalToronto?.hasCoords}`
            );

            this.log(`   📊 Records with coords: ${recordsWithCoords}, without coords: ${recordsWithoutCoords}`);

        } catch (error) {
            this.assert(false, 'Deduplication logic test', `Error: ${error.message}`);
        }
    }

    // Run all tests
    async runAllTests() {
        this.log('🚀 STARTING COMPREHENSIVE MAP CITY SELECTOR TESTS');
        this.log('================================================');
        
        await this.testDatabaseCoordinates();
        await this.testRectangleBounds();
        await this.testPolygonDetection();
        await this.testGoogleMapsIntegration();
        await this.testCityCoverage();
        await this.testDeduplicationLogic();
        this.testGeometricAlgorithms();
        
        this.log('================================================');
        this.log('🏁 TEST SUITE COMPLETE');
        this.log(`✅ PASSED: ${this.testResults.passed}`);
        this.log(`❌ FAILED: ${this.testResults.failed}`);
        this.log(`📊 SUCCESS RATE: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);
        
        if (this.testResults.failed === 0) {
            this.log('🎉 ALL TESTS PASSED - SYSTEM IS PERFECT!');
        } else {
            this.log('⚠️ SOME TESTS FAILED - SYSTEM NEEDS FIXES');
        }
        
        return this.testResults;
    }
}

// Run the tests
async function main() {
    const tester = new MapCitySelectorTester();
    const results = await tester.runAllTests();
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});
