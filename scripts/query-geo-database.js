#!/usr/bin/env node

/**
 * Geographic Database Query Utility
 * 
 * This utility provides example queries for the geographic database
 * and helps test the imported data.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (admin.apps.length === 0) {
    const serviceAccount = require('../service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://solushipx.firebaseio.com'
    });
}

const db = admin.firestore();

/**
 * Query examples for the geographic database
 */
class GeoQueryUtility {
    
    /**
     * Get database statistics
     */
    async getDatabaseStats() {
        console.log('📊 Geographic Database Statistics');
        console.log('=================================');
        
        try {
            // Count total locations
            const locationsSnapshot = await db.collection('geoLocations').count().get();
            const totalLocations = locationsSnapshot.data().count;
            
            // Count cities
            const citiesSnapshot = await db.collection('geoCities').count().get();
            const totalCities = citiesSnapshot.data().count;
            
            // Count provinces/states
            const regionsSnapshot = await db.collection('geoProvincesStates').count().get();
            const totalRegions = regionsSnapshot.data().count;
            
            console.log(`📍 Total Locations: ${totalLocations.toLocaleString()}`);
            console.log(`🏙️  Total Cities: ${totalCities.toLocaleString()}`);
            console.log(`🗺️  Total Provinces/States: ${totalRegions}`);
            
            // Get breakdown by country
            const canadaSnapshot = await db.collection('geoLocations')
                .where('isCanada', '==', true)
                .count().get();
            const canadaCount = canadaSnapshot.data().count;
            
            const usSnapshot = await db.collection('geoLocations')
                .where('isUS', '==', true)
                .count().get();
            const usCount = usSnapshot.data().count;
            
            console.log(`🇨🇦 Canadian Locations: ${canadaCount.toLocaleString()}`);
            console.log(`🇺🇸 US Locations: ${usCount.toLocaleString()}`);
            
        } catch (error) {
            console.error('❌ Error getting statistics:', error);
        }
    }
    
    /**
     * Find cities by province/state
     */
    async findCitiesByRegion(regionKey) {
        console.log(`\n🔍 Cities in region: ${regionKey}`);
        console.log('================================');
        
        try {
            const citiesSnapshot = await db.collection('geoCities')
                .where('regionKey', '==', regionKey)
                .orderBy('city')
                .limit(20)
                .get();
            
            if (citiesSnapshot.empty) {
                console.log('❌ No cities found for this region');
                return;
            }
            
            console.log(`Found ${citiesSnapshot.size} cities (showing first 20):`);
            citiesSnapshot.forEach(doc => {
                const city = doc.data();
                console.log(`   📍 ${city.city} (${city.locationCount} postal/zip codes)`);
            });
            
        } catch (error) {
            console.error('❌ Error finding cities:', error);
        }
    }
    
    /**
     * Find locations by city
     */
    async findLocationsByCity(cityRegionKey) {
        console.log(`\n🔍 Locations in city: ${cityRegionKey}`);
        console.log('===================================');
        
        try {
            const locationsSnapshot = await db.collection('geoLocations')
                .where('cityRegionKey', '==', cityRegionKey)
                .limit(10)
                .get();
            
            if (locationsSnapshot.empty) {
                console.log('❌ No locations found for this city');
                return;
            }
            
            console.log(`Found ${locationsSnapshot.size} locations (showing first 10):`);
            locationsSnapshot.forEach(doc => {
                const location = doc.data();
                console.log(`   📮 ${location.postalZipCode} - ${location.city}, ${location.provinceStateName}`);
            });
            
        } catch (error) {
            console.error('❌ Error finding locations:', error);
        }
    }
    
    /**
     * Search cities by partial name
     */
    async searchCities(searchTerm) {
        console.log(`\n🔍 Searching cities: "${searchTerm}"`);
        console.log('=============================');
        
        try {
            const searchKey = searchTerm.toLowerCase();
            const citiesSnapshot = await db.collection('geoCities')
                .where('searchKey', '>=', searchKey)
                .where('searchKey', '<=', searchKey + '\uf8ff')
                .limit(10)
                .get();
            
            if (citiesSnapshot.empty) {
                console.log('❌ No cities found matching search term');
                return;
            }
            
            console.log(`Found ${citiesSnapshot.size} cities:`);
            citiesSnapshot.forEach(doc => {
                const city = doc.data();
                console.log(`   🏙️ ${city.city}, ${city.provinceStateName}, ${city.countryName}`);
            });
            
        } catch (error) {
            console.error('❌ Error searching cities:', error);
        }
    }
    
    /**
     * Get all provinces/states
     */
    async getAllRegions() {
        console.log('\n🗺️  All Provinces/States');
        console.log('========================');
        
        try {
            const regionsSnapshot = await db.collection('geoProvincesStates')
                .orderBy('countryName')
                .orderBy('provinceStateName')
                .get();
            
            let currentCountry = '';
            regionsSnapshot.forEach(doc => {
                const region = doc.data();
                
                if (region.countryName !== currentCountry) {
                    currentCountry = region.countryName;
                    console.log(`\n${region.countryName}:`);
                }
                
                console.log(`   📍 ${region.provinceStateName} (${region.provinceState}) - ${region.cityCount} cities, ${region.locationCount.toLocaleString()} locations`);
            });
            
        } catch (error) {
            console.error('❌ Error getting regions:', error);
        }
    }
    
    /**
     * Test zone mapping queries
     */
    async testZoneMappingQueries() {
        console.log('\n🎯 Zone Mapping Query Examples');
        console.log('==============================');
        
        try {
            // Example 1: Province-to-Province (Ontario to Alberta)
            console.log('\n1. Province-to-Province Zone: Ontario → Alberta');
            const onCities = await db.collection('geoCities')
                .where('regionKey', '==', 'CA-ON')
                .count().get();
            const abCities = await db.collection('geoCities')
                .where('regionKey', '==', 'CA-AB')
                .count().get();
            
            console.log(`   📍 Ontario cities: ${onCities.data().count}`);
            console.log(`   📍 Alberta cities: ${abCities.data().count}`);
            
            // Example 2: City-to-City (Toronto to Vancouver)
            console.log('\n2. City-to-City Zone: Toronto → Vancouver');
            const torontoSnapshot = await db.collection('geoCities')
                .where('cityRegionKey', '==', 'Toronto-ON-CA')
                .get();
            const vancouverSnapshot = await db.collection('geoCities')
                .where('cityRegionKey', '==', 'Vancouver-BC-CA')
                .get();
            
            if (!torontoSnapshot.empty && !vancouverSnapshot.empty) {
                const toronto = torontoSnapshot.docs[0].data();
                const vancouver = vancouverSnapshot.docs[0].data();
                console.log(`   📍 Toronto: ${toronto.locationCount} postal codes`);
                console.log(`   📍 Vancouver: ${vancouver.locationCount} postal codes`);
            } else {
                console.log('   ❌ Toronto or Vancouver not found');
            }
            
            // Example 3: Cross-border (Canada to US)
            console.log('\n3. Cross-border Zone: Canada → United States');
            const canadaRegions = await db.collection('geoProvincesStates')
                .where('isCanada', '==', true)
                .count().get();
            const usRegions = await db.collection('geoProvincesStates')
                .where('isUS', '==', true)
                .count().get();
            
            console.log(`   📍 Canadian provinces: ${canadaRegions.data().count}`);
            console.log(`   📍 US states: ${usRegions.data().count}`);
            
        } catch (error) {
            console.error('❌ Error testing zone queries:', error);
        }
    }
}

/**
 * Main function with command line interface
 */
async function main() {
    const geoQuery = new GeoQueryUtility();
    
    const args = process.argv.slice(2);
    const command = args[0];
    
    console.log('🗺️  Geographic Database Query Utility');
    console.log('======================================');
    
    try {
        switch (command) {
            case 'stats':
                await geoQuery.getDatabaseStats();
                break;
                
            case 'cities':
                const regionKey = args[1];
                if (!regionKey) {
                    console.log('❌ Please provide a region key (e.g., CA-ON, US-CA)');
                    return;
                }
                await geoQuery.findCitiesByRegion(regionKey);
                break;
                
            case 'locations':
                const cityRegionKey = args[1];
                if (!cityRegionKey) {
                    console.log('❌ Please provide a city region key (e.g., Toronto-ON-CA)');
                    return;
                }
                await geoQuery.findLocationsByCity(cityRegionKey);
                break;
                
            case 'search':
                const searchTerm = args[1];
                if (!searchTerm) {
                    console.log('❌ Please provide a search term');
                    return;
                }
                await geoQuery.searchCities(searchTerm);
                break;
                
            case 'regions':
                await geoQuery.getAllRegions();
                break;
                
            case 'zones':
                await geoQuery.testZoneMappingQueries();
                break;
                
            case 'all':
                await geoQuery.getDatabaseStats();
                await geoQuery.getAllRegions();
                await geoQuery.findCitiesByRegion('CA-ON');
                await geoQuery.findLocationsByCity('Toronto-ON-CA');
                await geoQuery.searchCities('calgary');
                await geoQuery.testZoneMappingQueries();
                break;
                
            default:
                console.log('\nUsage: node query-geo-database.js <command> [args]');
                console.log('\nCommands:');
                console.log('  stats                     - Show database statistics');
                console.log('  cities <regionKey>        - Find cities in region (e.g., CA-ON)');
                console.log('  locations <cityRegionKey> - Find locations in city (e.g., Toronto-ON-CA)');
                console.log('  search <searchTerm>       - Search cities by name');
                console.log('  regions                   - List all provinces/states');
                console.log('  zones                     - Test zone mapping queries');
                console.log('  all                       - Run all example queries');
                console.log('\nExamples:');
                console.log('  node query-geo-database.js stats');
                console.log('  node query-geo-database.js cities CA-ON');
                console.log('  node query-geo-database.js search toronto');
                console.log('  node query-geo-database.js zones');
                break;
        }
        
    } catch (error) {
        console.error('\n❌ Query failed:', error);
        process.exit(1);
    }
    
    console.log('\n✅ Query completed successfully!');
    process.exit(0);
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { GeoQueryUtility };
