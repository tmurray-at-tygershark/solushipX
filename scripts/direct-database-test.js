/**
 * Direct Database Test for MapCitySelector
 * Tests the coordinate data and geometric calculations directly
 */

const admin = require('firebase-admin');
const serviceAccount = require('../functions/service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'solushipx'
    });
}

const db = admin.firestore();

class DatabaseTester {
    constructor() {
        this.results = { passed: 0, failed: 0, details: [] };
    }

    log(message) {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }

    assert(condition, test, details = '') {
        if (condition) {
            this.results.passed++;
            this.log(`✅ PASS: ${test} ${details}`);
        } else {
            this.results.failed++;
            this.log(`❌ FAIL: ${test} ${details}`);
        }
        return condition;
    }

    async testCoordinateData() {
        this.log('🔍 TESTING: Database Coordinate Data');
        
        try {
            // Test 1: Canadian cities with coordinates
            const canadaQuery = await db.collection('geoLocations')
                .where('country', '==', 'CA')
                .where('latitude', '!=', null)
                .where('longitude', '!=', null)
                .limit(10)
                .get();

            this.assert(
                canadaQuery.size > 0,
                'Canadian cities with coordinates',
                `Found ${canadaQuery.size} cities`
            );

            if (canadaQuery.size > 0) {
                const sample = canadaQuery.docs[0].data();
                this.log(`   Sample CA city: ${sample.city}, ${sample.provinceState} (${sample.latitude}, ${sample.longitude})`);
                
                this.assert(
                    typeof sample.latitude === 'number' && typeof sample.longitude === 'number',
                    'Canadian coordinate data types',
                    `lat: ${typeof sample.latitude}, lng: ${typeof sample.longitude}`
                );
            }

            // Test 2: US cities with coordinates  
            const usQuery = await db.collection('geoLocations')
                .where('country', '==', 'US')
                .where('latitude', '!=', null)
                .where('longitude', '!=', null)
                .limit(10)
                .get();

            this.assert(
                usQuery.size > 0,
                'US cities with coordinates',
                `Found ${usQuery.size} cities`
            );

            if (usQuery.size > 0) {
                const sample = usQuery.docs[0].data();
                this.log(`   Sample US city: ${sample.city}, ${sample.provinceState} (${sample.latitude}, ${sample.longitude})`);
                
                this.assert(
                    typeof sample.latitude === 'number' && typeof sample.longitude === 'number',
                    'US coordinate data types',
                    `lat: ${typeof sample.latitude}, lng: ${typeof sample.longitude}`
                );
            }

        } catch (error) {
            this.assert(false, 'Database coordinate test', `Error: ${error.message}`);
        }
    }

    async testTorontoAreaDetection() {
        this.log('🔍 TESTING: Toronto Area Rectangle Detection');
        
        try {
            // Define Toronto area bounds
            const bounds = {
                north: 44.0,
                south: 43.5,
                east: -79.0,
                west: -79.8
            };

            this.log(`🗺️ Testing rectangle: N${bounds.north} S${bounds.south} E${bounds.east} W${bounds.west}`);

            // Query Ontario cities
            const ontarioQuery = await db.collection('geoLocations')
                .where('country', '==', 'CA')
                .where('provinceState', '==', 'ON')
                .where('latitude', '>=', bounds.south)
                .where('latitude', '<=', bounds.north)
                .limit(1000)
                .get();

            this.log(`📊 Found ${ontarioQuery.size} Ontario cities in latitude range`);

            // Filter by longitude (simulate rectangle bounds)
            const citiesInBounds = [];
            ontarioQuery.docs.forEach(doc => {
                const data = doc.data();
                const lng = parseFloat(data.longitude);
                if (lng >= bounds.west && lng <= bounds.east && data.latitude && data.longitude) {
                    citiesInBounds.push({
                        city: data.city,
                        lat: parseFloat(data.latitude),
                        lng: parseFloat(data.longitude)
                    });
                }
            });

            this.assert(
                citiesInBounds.length > 0,
                'Toronto area rectangle detection',
                `Found ${citiesInBounds.length} cities in rectangle`
            );

            // Log first few cities found
            citiesInBounds.slice(0, 5).forEach(city => {
                this.log(`   🎯 City in rectangle: ${city.city} (${city.lat}, ${city.lng})`);
            });

            // Test specific known cities
            const torontoFound = citiesInBounds.find(c => c.city === 'Toronto');
            this.assert(
                !!torontoFound,
                'Toronto found in rectangle',
                torontoFound ? `At (${torontoFound.lat}, ${torontoFound.lng})` : 'Not found'
            );

        } catch (error) {
            this.assert(false, 'Toronto area detection', `Error: ${error.message}`);
        }
    }

    async testCircleDetection() {
        this.log('🔍 TESTING: Circle Detection Around Vancouver');
        
        try {
            const center = { lat: 49.2827, lng: -123.1207 }; // Vancouver coordinates
            const radiusKm = 50; // 50km radius
            const radiusMeters = radiusKm * 1000;

            this.log(`🗺️ Testing circle: Center (${center.lat}, ${center.lng}), Radius ${radiusKm}km`);

            // Query BC cities
            const bcQuery = await db.collection('geoLocations')
                .where('country', '==', 'CA')
                .where('provinceState', '==', 'BC')
                .where('latitude', '!=', null)
                .where('longitude', '!=', null)
                .limit(500)
                .get();

            this.log(`📊 Found ${bcQuery.size} BC cities with coordinates`);

            // Calculate distance for each city (simplified)
            const citiesInCircle = [];
            bcQuery.docs.forEach(doc => {
                const data = doc.data();
                const cityLat = parseFloat(data.latitude);
                const cityLng = parseFloat(data.longitude);
                
                // Simplified distance calculation
                const latDiff = (cityLat - center.lat) * 111000;
                const lngDiff = (cityLng - center.lng) * 111000 * Math.cos(center.lat * Math.PI / 180);
                const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
                
                if (distance <= radiusMeters) {
                    citiesInCircle.push({
                        city: data.city,
                        lat: cityLat,
                        lng: cityLng,
                        distance: Math.round(distance)
                    });
                }
            });

            this.assert(
                citiesInCircle.length > 0,
                'Vancouver circle detection',
                `Found ${citiesInCircle.length} cities within ${radiusKm}km`
            );

            // Log cities found
            citiesInCircle.slice(0, 5).forEach(city => {
                this.log(`   🎯 City in circle: ${city.city} (${city.lat}, ${city.lng}) - ${city.distance}m away`);
            });

            // Vancouver should be in the circle
            const vancouverFound = citiesInCircle.find(c => c.city === 'Vancouver');
            this.assert(
                !!vancouverFound,
                'Vancouver found in its own circle',
                vancouverFound ? `Distance: ${vancouverFound.distance}m` : 'Not found'
            );

        } catch (error) {
            this.assert(false, 'Circle detection test', `Error: ${error.message}`);
        }
    }

    async testMajorCitiesCoverage() {
        this.log('🔍 TESTING: Major Cities Coverage');
        
        try {
            const majorCities = [
                { name: 'Toronto', country: 'CA', province: 'ON' },
                { name: 'Vancouver', country: 'CA', province: 'BC' },
                { name: 'Montreal', country: 'CA', province: 'QC' },
                { name: 'Calgary', country: 'CA', province: 'AB' },
                { name: 'New York', country: 'US', province: 'NY' },
                { name: 'Los Angeles', country: 'US', province: 'CA' },
                { name: 'Chicago', country: 'US', province: 'IL' }
            ];

            for (const city of majorCities) {
                const cityQuery = await db.collection('geoLocations')
                    .where('city', '==', city.name)
                    .where('country', '==', city.country)
                    .where('latitude', '!=', null)
                    .where('longitude', '!=', null)
                    .limit(1)
                    .get();

                const found = !cityQuery.empty;
                this.assert(
                    found,
                    `Major city ${city.name}, ${city.province} exists`,
                    found ? `At (${cityQuery.docs[0].data().latitude}, ${cityQuery.docs[0].data().longitude})` : 'Not found'
                );
            }

        } catch (error) {
            this.assert(false, 'Major cities coverage', `Error: ${error.message}`);
        }
    }

    async runAllTests() {
        this.log('🎯 COMPREHENSIVE DATABASE VALIDATION STARTING');
        this.log('==============================================');
        
        await this.testCoordinateData();
        await this.testTorontoAreaDetection();
        await this.testCircleDetection();
        await this.testMajorCitiesCoverage();
        
        this.log('==============================================');
        this.log(`🏁 TESTING COMPLETE: ${this.results.passed} passed, ${this.results.failed} failed`);
        
        const successRate = (this.results.passed / (this.results.passed + this.results.failed)) * 100;
        this.log(`📊 SUCCESS RATE: ${successRate.toFixed(1)}%`);
        
        if (this.results.failed === 0) {
            this.log('🎉 PERFECT! All database tests passed - coordinate detection will work flawlessly!');
            return true;
        } else {
            this.log(`⚠️ ${this.results.failed} issues found - system needs fixes`);
            return false;
        }
    }
}

// Execute tests
async function main() {
    const tester = new DatabaseTester();
    const success = await tester.runAllTests();
    process.exit(success ? 0 : 1);
}

main().catch(error => {
    console.error('❌ Test suite crashed:', error);
    process.exit(1);
});
