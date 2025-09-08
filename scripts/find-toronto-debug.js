/**
 * Debug Script to Find Toronto and Fix Rectangle Detection
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

async function findToronto() {
    console.log('🔍 SEARCHING FOR TORONTO IN DATABASE...');
    
    try {
        // Search for Toronto specifically
        const torontoQuery = await db.collection('geoLocations')
            .where('city', '==', 'Toronto')
            .where('country', '==', 'CA')
            .limit(10)
            .get();

        console.log(`📊 Found ${torontoQuery.size} Toronto records`);

        if (torontoQuery.size > 0) {
            torontoQuery.docs.forEach((doc, index) => {
                const data = doc.data();
                console.log(`   ${index + 1}. Toronto record:`, {
                    city: data.city,
                    province: data.provinceState,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    postalCode: data.postalZipCode
                });

                // Check if this Toronto is in our test rectangle
                const bounds = { north: 44.0, south: 43.5, east: -79.0, west: -79.8 };
                const lat = parseFloat(data.latitude);
                const lng = parseFloat(data.longitude);
                
                const inBounds = lat >= bounds.south && lat <= bounds.north && 
                                lng >= bounds.west && lng <= bounds.east;
                
                console.log(`      In test rectangle: ${inBounds} (lat: ${lat}, lng: ${lng})`);
            });
        } else {
            console.log('❌ No Toronto records found - checking alternate spellings...');
            
            // Try case variations
            const variations = ['toronto', 'TORONTO', 'Toronto'];
            for (const variation of variations) {
                const varQuery = await db.collection('geoLocations')
                    .where('city', '==', variation)
                    .where('country', '==', 'CA')
                    .limit(5)
                    .get();
                
                console.log(`   Variation "${variation}": ${varQuery.size} results`);
            }
        }

        // Also check what cities ARE in the Toronto rectangle
        console.log('\n🗺️ CHECKING WHAT CITIES ARE IN TORONTO RECTANGLE...');
        
        const ontarioQuery = await db.collection('geoLocations')
            .where('country', '==', 'CA')
            .where('provinceState', '==', 'ON')
            .limit(2000)
            .get();

        const bounds = { north: 44.0, south: 43.5, east: -79.0, west: -79.8 };
        const citiesInBounds = [];

        ontarioQuery.docs.forEach(doc => {
            const data = doc.data();
            if (data.latitude && data.longitude) {
                const lat = parseFloat(data.latitude);
                const lng = parseFloat(data.longitude);
                
                if (lat >= bounds.south && lat <= bounds.north &&
                    lng >= bounds.west && lng <= bounds.east) {
                    
                    const existing = citiesInBounds.find(c => c.city === data.city);
                    if (!existing) {
                        citiesInBounds.push({
                            city: data.city,
                            lat: lat,
                            lng: lng,
                            distance: Math.sqrt(Math.pow(lat - 43.6532, 2) + Math.pow(lng - (-79.3832), 2))
                        });
                    }
                }
            }
        });

        console.log(`📊 Found ${citiesInBounds.length} cities in Toronto rectangle bounds`);
        
        // Sort by distance from Toronto center
        citiesInBounds.sort((a, b) => a.distance - b.distance);
        
        console.log('   🎯 Cities in rectangle (sorted by distance from Toronto):');
        citiesInBounds.slice(0, 15).forEach((city, index) => {
            console.log(`      ${index + 1}. ${city.city} (${city.lat}, ${city.lng})`);
        });

        // Check if the bounds are reasonable for Toronto
        console.log('\n🎯 TORONTO COORDINATE ANALYSIS:');
        console.log(`   Expected Toronto coordinates: ~(43.6532, -79.3832)`);
        console.log(`   Test rectangle bounds: N${bounds.north} S${bounds.south} E${bounds.east} W${bounds.west}`);
        console.log(`   Toronto should be in bounds: ${43.6532 >= bounds.south && 43.6532 <= bounds.north && -79.3832 >= bounds.west && -79.3832 <= bounds.east}`);

    } catch (error) {
        console.error('❌ Toronto search failed:', error);
    }
}

findToronto();
