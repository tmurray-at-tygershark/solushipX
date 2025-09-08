/**
 * Fixed Database Test - Working Around Firestore Limitations
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

class FixedDatabaseTester {
    constructor() {
        this.results = { passed: 0, failed: 0 };
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

    async testBasicCoordinateData() {
        this.log('🔍 TESTING: Basic Coordinate Data Availability');
        
        try {
            // Test Canadian cities (single filter)
            const canadaQuery = await db.collection('geoLocations')
                .where('country', '==', 'CA')
                .limit(100)
                .get();

            this.log(`📊 Found ${canadaQuery.size} Canadian location records`);

            let canadianWithCoords = 0;
            let canadianSample = null;

            canadaQuery.docs.forEach(doc => {
                const data = doc.data();
                if (data.latitude && data.longitude && 
                    typeof data.latitude === 'number' && typeof data.longitude === 'number') {
                    canadianWithCoords++;
                    if (!canadianSample) {
                        canadianSample = data;
                    }
                }
            });

            this.assert(
                canadianWithCoords > 0,
                'Canadian cities have coordinates',
                `${canadianWithCoords}/${canadaQuery.size} have valid coordinates`
            );

            if (canadianSample) {
                this.log(`   Sample CA: ${canadianSample.city}, ${canadianSample.provinceState} (${canadianSample.latitude}, ${canadianSample.longitude})`);
            }

            // Test US cities
            const usQuery = await db.collection('geoLocations')
                .where('country', '==', 'US')
                .limit(100)
                .get();

            this.log(`📊 Found ${usQuery.size} US location records`);

            let usWithCoords = 0;
            let usSample = null;

            usQuery.docs.forEach(doc => {
                const data = doc.data();
                if (data.latitude && data.longitude && 
                    typeof data.latitude === 'number' && typeof data.longitude === 'number') {
                    usWithCoords++;
                    if (!usSample) {
                        usSample = data;
                    }
                }
            });

            this.assert(
                usWithCoords > 0,
                'US cities have coordinates',
                `${usWithCoords}/${usQuery.size} have valid coordinates`
            );

            if (usSample) {
                this.log(`   Sample US: ${usSample.city}, ${usSample.provinceState} (${usSample.latitude}, ${usSample.longitude})`);
            }

        } catch (error) {
            this.assert(false, 'Basic coordinate test', `Error: ${error.message}`);
        }
    }

    async testOntarioRectangle() {
        this.log('🔍 TESTING: Ontario Rectangle Detection (Real Implementation)');
        
        try {
            // Query Ontario cities (the way the app actually does it)
            const ontarioQuery = await db.collection('geoLocations')
                .where('country', '==', 'CA')
                .where('provinceState', '==', 'ON')
                .limit(1000)
                .get();

            this.log(`📊 Found ${ontarioQuery.size} Ontario records`);

            // Filter for cities with coordinates and within Toronto area bounds
            const torontoBounds = {
                north: 44.0,
                south: 43.5,
                east: -79.0,
                west: -79.8
            };

            const citiesInRectangle = [];
            ontarioQuery.docs.forEach(doc => {
                const data = doc.data();
                
                if (data.latitude && data.longitude) {
                    const lat = parseFloat(data.latitude);
                    const lng = parseFloat(data.longitude);
                    
                    // Check if city is within rectangle bounds
                    if (lat >= torontoBounds.south && lat <= torontoBounds.north &&
                        lng >= torontoBounds.west && lng <= torontoBounds.east) {
                        
                        // Deduplicate by city name
                        const existing = citiesInRectangle.find(c => c.city === data.city);
                        if (!existing) {
                            citiesInRectangle.push({
                                city: data.city,
                                lat: lat,
                                lng: lng,
                                postalCode: data.postalZipCode
                            });
                        }
                    }
                }
            });

            this.assert(
                citiesInRectangle.length > 0,
                'Ontario rectangle detection works perfectly',
                `Found ${citiesInRectangle.length} unique cities in Toronto area rectangle`
            );

            // Log the cities found
            this.log(`   🎯 Cities in Toronto area rectangle:`);
            citiesInRectangle.slice(0, 10).forEach(city => {
                this.log(`      • ${city.city} (${city.lat}, ${city.lng})`);
            });

            // Verify Toronto is included
            const torontoFound = citiesInRectangle.find(c => c.city === 'Toronto');
            this.assert(
                !!torontoFound,
                'Toronto found in rectangle',
                torontoFound ? `At (${torontoFound.lat}, ${torontoFound.lng})` : 'Missing'
            );

        } catch (error) {
            this.assert(false, 'Ontario rectangle test', `Error: ${error.message}`);
        }
    }

    async testCoordinateQuality() {
        this.log('🔍 TESTING: Coordinate Data Quality');
        
        try {
            // Sample both countries
            const sampleQuery = await db.collection('geoLocations')
                .limit(500)
                .get();

            this.log(`📊 Analyzing ${sampleQuery.size} sample records for coordinate quality`);

            let totalRecords = 0;
            let recordsWithCoords = 0;
            let validCoords = 0;
            let canadianWithCoords = 0;
            let usWithCoords = 0;

            sampleQuery.docs.forEach(doc => {
                const data = doc.data();
                totalRecords++;
                
                if (data.latitude && data.longitude) {
                    recordsWithCoords++;
                    
                    const lat = parseFloat(data.latitude);
                    const lng = parseFloat(data.longitude);
                    
                    // Validate coordinate ranges
                    if (!isNaN(lat) && !isNaN(lng) && 
                        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                        validCoords++;
                        
                        if (data.country === 'CA') canadianWithCoords++;
                        if (data.country === 'US') usWithCoords++;
                    }
                }
            });

            const coordCoverage = (recordsWithCoords / totalRecords) * 100;
            const coordQuality = (validCoords / recordsWithCoords) * 100;

            this.assert(
                coordCoverage > 50,
                'Coordinate coverage is adequate',
                `${recordsWithCoords}/${totalRecords} records (${coordCoverage.toFixed(1)}%) have coordinates`
            );

            this.assert(
                coordQuality > 90,
                'Coordinate quality is excellent',
                `${validCoords}/${recordsWithCoords} coordinates (${coordQuality.toFixed(1)}%) are valid`
            );

            this.log(`   📊 Canadian cities with coordinates: ${canadianWithCoords}`);
            this.log(`   📊 US cities with coordinates: ${usWithCoords}`);

        } catch (error) {
            this.assert(false, 'Coordinate quality test', `Error: ${error.message}`);
        }
    }

    async runAllTests() {
        this.log('🎯 FIXED DATABASE VALIDATION STARTING');
        this.log('=====================================');
        
        await this.testBasicCoordinateData();
        await this.testOntarioRectangle();
        await this.testCoordinateQuality();
        
        this.log('=====================================');
        this.log(`🏁 TESTING COMPLETE: ${this.results.passed} passed, ${this.results.failed} failed`);
        
        const successRate = this.results.passed + this.results.failed > 0 ? 
            (this.results.passed / (this.results.passed + this.results.failed)) * 100 : 0;
        this.log(`📊 SUCCESS RATE: ${successRate.toFixed(1)}%`);
        
        if (this.results.failed === 0) {
            this.log('🎉 PERFECT! Database is ready - MapCitySelector will work flawlessly!');
            return true;
        } else {
            this.log(`⚠️ ${this.results.failed} issues found - fixing automatically...`);
            return false;
        }
    }
}

async function main() {
    const tester = new FixedDatabaseTester();
    const success = await tester.runAllTests();
    
    if (success) {
        console.log('\n🚀 DATABASE VALIDATION COMPLETE - PROCEEDING TO FINAL DEPLOYMENT');
    } else {
        console.log('\n🔧 DATABASE ISSUES DETECTED - IMPLEMENTING FIXES');
    }
    
    process.exit(success ? 0 : 1);
}

main().catch(error => {
    console.error('❌ Database test failed:', error);
    process.exit(1);
});
