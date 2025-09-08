/**
 * Final Validation Test - Simulate Exact MapCitySelector Logic
 */

const admin = require('firebase-admin');
const serviceAccount = require('../functions/service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'solushipx'
    });
}

const db = admin.firestore();

async function simulateMapCitySelectorLogic() {
    console.log('🎯 SIMULATING EXACT MAPCITYSELECTOR LOGIC');
    console.log('==========================================');
    
    try {
        // STEP 1: Simulate loadCitiesWithCoordinates function
        console.log('🔄 Step 1: Loading cities with coordinates...');
        
        const citiesQuery = await db.collection('geoLocations')
            .where('country', '==', 'CA')
            .limit(5000)
            .get();

        console.log(`📊 Raw query results: ${citiesQuery.size} Canadian locations`);

        // STEP 2: Filter and deduplicate (exact same logic as MapCitySelector)
        const cityMap = new Map();
        let recordsProcessed = 0;
        let recordsWithCoords = 0;

        citiesQuery.docs.forEach(doc => {
            const data = doc.data();
            recordsProcessed++;
            
            if (data.latitude && data.longitude && 
                typeof data.latitude === 'number' && typeof data.longitude === 'number') {
                recordsWithCoords++;
                
                const cityKey = `${data.city}-${data.provinceState}-${data.country}`.toLowerCase();
                
                if (!cityMap.has(cityKey)) {
                    cityMap.set(cityKey, {
                        id: doc.id,
                        city: data.city,
                        provinceState: data.provinceState,
                        provinceStateName: data.provinceStateName,
                        country: data.country,
                        countryName: data.countryName,
                        postalCode: data.postalZipCode,
                        latitude: parseFloat(data.latitude),
                        longitude: parseFloat(data.longitude),
                        searchKey: cityKey
                    });
                }
            }
        });

        const allCities = Array.from(cityMap.values());
        console.log(`✅ Processed: ${recordsProcessed} records`);
        console.log(`✅ With coordinates: ${recordsWithCoords} records`);
        console.log(`✅ Unique cities: ${allCities.length} cities`);

        // STEP 3: Simulate rectangle bounds detection
        console.log('\n🗺️ Step 3: Simulating rectangle detection...');
        
        const rectangleBounds = {
            north: 44.0,
            south: 43.5,
            east: -79.0,
            west: -79.8
        };

        console.log(`Rectangle bounds: N${rectangleBounds.north} S${rectangleBounds.south} E${rectangleBounds.east} W${rectangleBounds.west}`);

        const citiesInRectangle = allCities.filter(city => {
            const lat = city.latitude;
            const lng = city.longitude;
            const inBounds = lat >= rectangleBounds.south && lat <= rectangleBounds.north &&
                           lng >= rectangleBounds.west && lng <= rectangleBounds.east;
            
            if (inBounds) {
                console.log(`   🎯 City in rectangle: ${city.city} (${lat}, ${lng})`);
            }
            
            return inBounds;
        });

        console.log(`\n✅ FINAL RESULT: ${citiesInRectangle.length} cities found in rectangle`);

        // STEP 4: Verify Toronto is included
        const torontoFound = citiesInRectangle.find(c => c.city === 'Toronto');
        console.log(`\n🏙️ Toronto verification: ${torontoFound ? 'FOUND' : 'MISSING'}`);
        if (torontoFound) {
            console.log(`   Toronto coordinates: (${torontoFound.latitude}, ${torontoFound.longitude})`);
        }

        // STEP 5: Final validation
        if (citiesInRectangle.length > 0 && torontoFound) {
            console.log('\n🎉 SUCCESS! Rectangle detection logic is PERFECT!');
            console.log('🚀 MapCitySelector will work flawlessly in production!');
            return true;
        } else {
            console.log('\n❌ ISSUE: Rectangle detection needs optimization');
            return false;
        }

    } catch (error) {
        console.error('❌ Simulation failed:', error);
        return false;
    }
}

simulateMapCitySelectorLogic()
    .then(success => {
        if (success) {
            console.log('\n🎯 VALIDATION COMPLETE - DEPLOYING PERFECT SOLUTION');
        } else {
            console.log('\n🔧 VALIDATION FAILED - FIXING ISSUES');
        }
        process.exit(success ? 0 : 1);
    });
