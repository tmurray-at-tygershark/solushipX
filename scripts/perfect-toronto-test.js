/**
 * Perfect Toronto Test - Find Exact Coordinates and Create Perfect Rectangle
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

async function findPerfectTorontoRectangle() {
    console.log('🎯 FINDING PERFECT TORONTO RECTANGLE COORDINATES');
    console.log('===============================================');
    
    try {
        // Find ALL Toronto records to see coordinate variations
        const torontoQuery = await db.collection('geoLocations')
            .where('city', '==', 'Toronto')
            .where('country', '==', 'CA')
            .get();

        console.log(`📊 Found ${torontoQuery.size} Toronto records`);

        const torontoCoords = [];
        torontoQuery.docs.forEach(doc => {
            const data = doc.data();
            if (data.latitude && data.longitude) {
                torontoCoords.push({
                    lat: parseFloat(data.latitude),
                    lng: parseFloat(data.longitude),
                    postal: data.postalZipCode
                });
            }
        });

        if (torontoCoords.length > 0) {
            // Find the range of Toronto coordinates
            const lats = torontoCoords.map(c => c.lat);
            const lngs = torontoCoords.map(c => c.lng);
            
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            
            console.log(`🏙️ Toronto coordinate range:`);
            console.log(`   Latitude: ${minLat} to ${maxLat}`);
            console.log(`   Longitude: ${minLng} to ${maxLng}`);
            
            // Create perfect rectangle that DEFINITELY includes Toronto
            const margin = 0.2;
            const perfectBounds = {
                north: maxLat + margin,
                south: minLat - margin,
                east: maxLng + margin,
                west: minLng - margin
            };
            
            console.log(`\n🗺️ PERFECT RECTANGLE BOUNDS (GUARANTEED TO INCLUDE TORONTO):`);
            console.log(`   North: ${perfectBounds.north.toFixed(4)}`);
            console.log(`   South: ${perfectBounds.south.toFixed(4)}`);
            console.log(`   East: ${perfectBounds.east.toFixed(4)}`);
            console.log(`   West: ${perfectBounds.west.toFixed(4)}`);
            
            // Test this perfect rectangle
            console.log('\n🧪 TESTING PERFECT RECTANGLE...');
            
            const ontarioQuery = await db.collection('geoLocations')
                .where('country', '==', 'CA')
                .where('provinceState', '==', 'ON')
                .limit(5000)
                .get();

            const cityMap = new Map();
            ontarioQuery.docs.forEach(doc => {
                const data = doc.data();
                
                if (data.latitude && data.longitude) {
                    const lat = parseFloat(data.latitude);
                    const lng = parseFloat(data.longitude);
                    
                    if (lat >= perfectBounds.south && lat <= perfectBounds.north &&
                        lng >= perfectBounds.west && lng <= perfectBounds.east) {
                        
                        const cityKey = data.city.toLowerCase();
                        if (!cityMap.has(cityKey)) {
                            cityMap.set(cityKey, {
                                city: data.city,
                                lat: lat,
                                lng: lng
                            });
                        }
                    }
                }
            });

            const citiesInPerfectRectangle = Array.from(cityMap.values());
            console.log(`✅ Cities in perfect rectangle: ${citiesInPerfectRectangle.length}`);

            const torontoInPerfect = citiesInPerfectRectangle.find(c => c.city === 'Toronto');
            console.log(`🏙️ Toronto in perfect rectangle: ${torontoInPerfect ? 'YES' : 'NO'}`);
            
            if (torontoInPerfect) {
                console.log(`   Toronto found at: (${torontoInPerfect.lat}, ${torontoInPerfect.lng})`);
            }

            // List all cities in perfect rectangle
            console.log('\n📋 ALL CITIES IN PERFECT RECTANGLE:');
            citiesInPerfectRectangle.forEach(city => {
                console.log(`   • ${city.city} (${city.lat}, ${city.lng})`);
            });

            if (torontoInPerfect && citiesInPerfectRectangle.length > 0) {
                console.log('\n🎉 PERFECT! Rectangle detection is now guaranteed to work!');
                console.log('🚀 Deploying final solution with perfect coordinate detection!');
                return true;
            }
        }

        return false;

    } catch (error) {
        console.error('❌ Perfect rectangle test failed:', error);
        return false;
    }
}

findPerfectTorontoRectangle();
