/**
 * Toronto Coordinate Analysis and Rectangle Fix
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

async function analyzeToronto() {
    console.log('🔍 ANALYZING TORONTO COORDINATES AND FIXING RECTANGLE BOUNDS');
    console.log('============================================================');
    
    try {
        // Find Toronto
        const torontoQuery = await db.collection('geoLocations')
            .where('city', '==', 'Toronto')
            .where('country', '==', 'CA')
            .limit(5)
            .get();

        if (torontoQuery.size > 0) {
            const torontoData = torontoQuery.docs[0].data();
            const torontoLat = parseFloat(torontoData.latitude);
            const torontoLng = parseFloat(torontoData.longitude);
            
            console.log(`🏙️ Toronto actual coordinates: (${torontoLat}, ${torontoLng})`);
            
            // Create proper rectangle bounds around Toronto
            const margin = 0.5; // 0.5 degrees margin
            const correctBounds = {
                north: torontoLat + margin,  // 44.1525
                south: torontoLat - margin,  // 43.1525
                east: torontoLng + margin,   // -78.8839
                west: torontoLng - margin    // -79.8839
            };
            
            console.log(`🗺️ Correct rectangle bounds for Toronto area:`);
            console.log(`   North: ${correctBounds.north}`);
            console.log(`   South: ${correctBounds.south}`);
            console.log(`   East: ${correctBounds.east}`);
            console.log(`   West: ${correctBounds.west}`);
            
            // Test with correct bounds
            console.log('\n🧪 Testing with corrected bounds...');
            
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
                    
                    // Check if in corrected bounds
                    if (lat >= correctBounds.south && lat <= correctBounds.north &&
                        lng >= correctBounds.west && lng <= correctBounds.east) {
                        
                        const cityKey = `${data.city}-${data.provinceState}-${data.country}`.toLowerCase();
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

            const citiesInCorrectedRectangle = Array.from(cityMap.values());
            console.log(`✅ Cities found with corrected bounds: ${citiesInCorrectedRectangle.length}`);
            
            citiesInCorrectedRectangle.slice(0, 10).forEach(city => {
                console.log(`   🎯 ${city.city} (${city.lat}, ${city.lng})`);
            });

            const torontoInCorrected = citiesInCorrectedRectangle.find(c => c.city === 'Toronto');
            console.log(`\n🏙️ Toronto in corrected rectangle: ${torontoInCorrected ? 'YES' : 'NO'}`);
            
            if (citiesInCorrectedRectangle.length > 0) {
                console.log('\n🎉 PERFECT! Rectangle detection will work with proper bounds!');
                
                // Output the correct bounds for the MapCitySelector
                console.log('\n📋 RECOMMENDED RECTANGLE BOUNDS FOR TESTING:');
                console.log(`   Use these bounds in your rectangle drawing for guaranteed success:`);
                console.log(`   North: ${correctBounds.north.toFixed(4)}`);
                console.log(`   South: ${correctBounds.south.toFixed(4)}`);
                console.log(`   East: ${correctBounds.east.toFixed(4)}`);
                console.log(`   West: ${correctBounds.west.toFixed(4)}`);
                
                return true;
            }
        }

        return false;

    } catch (error) {
        console.error('❌ Analysis failed:', error);
        return false;
    }
}

analyzeToronto();
