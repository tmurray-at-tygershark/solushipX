#!/usr/bin/env node

/**
 * Geographic Locations Import Script for Firebase
 * 
 * This script imports Canadian postal codes and US zip codes into Firebase
 * for use in the QuickShip zone mapping system.
 * 
 * Features:
 * - Imports ~500K Canadian locations + ~3M US locations
 * - Creates unified data structure for both countries
 * - Batch imports for efficiency (500 records per batch)
 * - Creates summary collections for cities and provinces/states
 * - Adds proper indexing for fast zone-based queries
 * - Progress tracking and error handling
 * 
 * Usage: node scripts/import-geographic-locations.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://solushipx.firebaseio.com'
});

const db = admin.firestore();

// Configuration
const BATCH_SIZE = 500; // Firestore batch limit
const CANADA_FILE = path.join(__dirname, '../postal-codes-canada.json');
const USA_FILE = path.join(__dirname, '../postal-codes-usa.json');

// Collections
const GEO_LOCATIONS_COLLECTION = 'geoLocations';
const CITIES_COLLECTION = 'geoCities';
const PROVINCES_STATES_COLLECTION = 'geoProvincesStates';

/**
 * Main import function
 */
async function importGeographicLocations() {
    console.log('🗺️  Starting Geographic Locations Import...');
    console.log('===============================================');
    
    try {
        // Step 1: Clear existing data (optional - comment out to keep existing data)
        await clearExistingData();
        
        // Step 2: Import Canadian postal codes
        console.log('\n📍 Importing Canadian postal codes...');
        const canadaStats = await importCanadianLocations();
        
        // Step 3: Import US zip codes  
        console.log('\n📍 Importing US zip codes...');
        const usaStats = await importUSALocations();
        
        // Step 4: Create summary collections
        console.log('\n📊 Creating summary collections...');
        await createSummaryCollections();
        
        // Step 5: Create indexes
        console.log('\n🔍 Creating database indexes...');
        await createIndexes();
        
        // Final summary
        console.log('\n✅ Import Complete!');
        console.log('===============================================');
        console.log(`🇨🇦 Canada: ${canadaStats.imported.toLocaleString()} locations imported`);
        console.log(`🇺🇸 USA: ${usaStats.imported.toLocaleString()} locations imported`);
        console.log(`📊 Total: ${(canadaStats.imported + usaStats.imported).toLocaleString()} locations`);
        console.log(`❌ Errors: ${(canadaStats.errors + usaStats.errors)} records failed`);
        console.log('\n🔥 Database collections created:');
        console.log(`   - ${GEO_LOCATIONS_COLLECTION}: All postal/zip code data`);
        console.log(`   - ${CITIES_COLLECTION}: Unique cities summary`);
        console.log(`   - ${PROVINCES_STATES_COLLECTION}: Provinces/states summary`);
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    }
}

/**
 * Clear existing geographic data (optional)
 */
async function clearExistingData() {
    console.log('🧹 Clearing existing geographic data...');
    
    const collections = [GEO_LOCATIONS_COLLECTION, CITIES_COLLECTION, PROVINCES_STATES_COLLECTION];
    
    for (const collectionName of collections) {
        const collectionRef = db.collection(collectionName);
        await deleteCollection(collectionRef, BATCH_SIZE);
        console.log(`   ✅ Cleared ${collectionName}`);
    }
}

/**
 * Delete a collection in batches
 */
async function deleteCollection(collectionRef, batchSize) {
    const query = collectionRef.limit(batchSize);
    
    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(query, resolve) {
    const snapshot = await query.get();
    
    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }
    
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    // Recurse on the next batch
    process.nextTick(() => {
        deleteQueryBatch(query, resolve);
    });
}

/**
 * Import Canadian postal codes
 */
async function importCanadianLocations() {
    console.log('📖 Reading Canadian postal codes file...');
    
    if (!fs.existsSync(CANADA_FILE)) {
        throw new Error(`Canadian postal codes file not found: ${CANADA_FILE}`);
    }
    
    const canadaData = JSON.parse(fs.readFileSync(CANADA_FILE, 'utf8'));
    console.log(`   📊 Found ${canadaData.length.toLocaleString()} Canadian locations`);
    
    return await importLocationsBatch(canadaData, 'Canada', normalizeCanadianLocation);
}

/**
 * Import US zip codes
 */
async function importUSALocations() {
    console.log('📖 Reading US zip codes file...');
    
    if (!fs.existsSync(USA_FILE)) {
        throw new Error(`US zip codes file not found: ${USA_FILE}`);
    }
    
    const usaData = JSON.parse(fs.readFileSync(USA_FILE, 'utf8'));
    console.log(`   📊 Found ${usaData.length.toLocaleString()} US locations`);
    
    return await importLocationsBatch(usaData, 'USA', normalizeUSALocation);
}

/**
 * Import locations in batches
 */
async function importLocationsBatch(data, countryName, normalizeFunction) {
    const total = data.length;
    let imported = 0;
    let errors = 0;
    
    console.log(`🚀 Starting batch import of ${total.toLocaleString()} ${countryName} locations...`);
    
    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = db.batch();
        const endIndex = Math.min(i + BATCH_SIZE, total);
        const batchData = data.slice(i, endIndex);
        
        for (const rawLocation of batchData) {
            try {
                const normalizedLocation = normalizeFunction(rawLocation);
                const docId = generateLocationId(normalizedLocation);
                const docRef = db.collection(GEO_LOCATIONS_COLLECTION).doc(docId);
                
                batch.set(docRef, {
                    ...normalizedLocation,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                imported++;
            } catch (error) {
                console.error(`   ❌ Error processing location:`, rawLocation, error);
                errors++;
            }
        }
        
        try {
            await batch.commit();
            const progress = ((endIndex / total) * 100).toFixed(1);
            console.log(`   ⏳ ${countryName}: ${endIndex.toLocaleString()}/${total.toLocaleString()} (${progress}%) - Batch ${Math.ceil(endIndex / BATCH_SIZE)} committed`);
        } catch (error) {
            console.error(`   ❌ Batch commit failed for batch starting at index ${i}:`, error);
            errors += batchData.length;
        }
    }
    
    console.log(`✅ ${countryName} import complete: ${imported.toLocaleString()} imported, ${errors} errors`);
    return { imported, errors };
}

/**
 * Normalize Canadian location data
 */
function normalizeCanadianLocation(rawLocation) {
    return {
        // Location identification
        city: cleanCityName(rawLocation.city),
        provinceState: rawLocation['province-code'],
        provinceStateName: getProvinceName(rawLocation['province-code']),
        country: rawLocation['country-code'],
        countryName: 'Canada',
        
        // Postal/Zip code
        postalZipCode: rawLocation['postal-code'],
        postalZipType: 'postal',
        
        // Geographic coordinates
        latitude: parseFloat(rawLocation.latitude),
        longitude: parseFloat(rawLocation.longitude),
        
        // Search and filtering fields
        searchKey: generateSearchKey(rawLocation.city, rawLocation['province-code'], rawLocation['country-code']),
        regionKey: `${rawLocation['country-code']}-${rawLocation['province-code']}`,
        cityRegionKey: `${cleanCityName(rawLocation.city)}-${rawLocation['province-code']}-${rawLocation['country-code']}`,
        
        // Zone mapping fields
        isCanada: true,
        isUS: false,
        isDomesticCanada: true,
        isDomesticUS: false,
        
        // Data source
        dataSource: 'canada-postal-codes',
        importedAt: new Date().toISOString()
    };
}

/**
 * Normalize US location data
 */
function normalizeUSALocation(rawLocation) {
    return {
        // Location identification
        city: cleanCityName(rawLocation.city),
        provinceState: rawLocation['state-code'],
        provinceStateName: getStateName(rawLocation['state-code']),
        country: rawLocation['country-code'],
        countryName: 'United States',
        
        // Postal/Zip code
        postalZipCode: rawLocation.zipcode.toString(),
        postalZipType: 'zip',
        
        // Geographic coordinates
        latitude: parseFloat(rawLocation.latitude),
        longitude: parseFloat(rawLocation.longitude),
        
        // Search and filtering fields
        searchKey: generateSearchKey(rawLocation.city, rawLocation['state-code'], rawLocation['country-code']),
        regionKey: `${rawLocation['country-code']}-${rawLocation['state-code']}`,
        cityRegionKey: `${cleanCityName(rawLocation.city)}-${rawLocation['state-code']}-${rawLocation['country-code']}`,
        
        // Zone mapping fields
        isCanada: false,
        isUS: true,
        isDomesticCanada: false,
        isDomesticUS: true,
        
        // Data source
        dataSource: 'usa-zip-codes',
        importedAt: new Date().toISOString()
    };
}

/**
 * Generate unique document ID for location
 */
function generateLocationId(location) {
    // Format: {country}-{provinceState}-{city}-{postalZip}
    const cleanCity = location.city.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanPostal = location.postalZipCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${location.country}-${location.provinceState}-${cleanCity}-${cleanPostal}`;
}

/**
 * Generate search key for efficient lookups
 */
function generateSearchKey(city, provinceState, country) {
    return `${cleanCityName(city).toLowerCase()}-${provinceState.toLowerCase()}-${country.toLowerCase()}`;
}

/**
 * Clean city name for consistency
 */
function cleanCityName(city) {
    return city
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/[^\w\s-']/g, '') // Remove special characters except hyphens and apostrophes
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Get full province name from code
 */
function getProvinceName(code) {
    const provinces = {
        'AB': 'Alberta',
        'BC': 'British Columbia',
        'MB': 'Manitoba',
        'NB': 'New Brunswick',
        'NL': 'Newfoundland and Labrador',
        'NS': 'Nova Scotia',
        'NT': 'Northwest Territories',
        'NU': 'Nunavut',
        'ON': 'Ontario',
        'PE': 'Prince Edward Island',
        'QC': 'Quebec',
        'SK': 'Saskatchewan',
        'YT': 'Yukon'
    };
    return provinces[code] || code;
}

/**
 * Get full state name from code
 */
function getStateName(code) {
    const states = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
        'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
        'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
        'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
        'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
        'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
        'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
        'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
        'DC': 'District of Columbia', 'PR': 'Puerto Rico', 'VI': 'Virgin Islands', 'GU': 'Guam',
        'AS': 'American Samoa', 'MP': 'Northern Mariana Islands'
    };
    return states[code] || code;
}

/**
 * Create summary collections for faster lookups
 */
async function createSummaryCollections() {
    console.log('📊 Creating cities summary collection...');
    await createCitiesSummary();
    
    console.log('📊 Creating provinces/states summary collection...');
    await createProvincesStatesSummary();
}

/**
 * Create cities summary collection
 */
async function createCitiesSummary() {
    const cities = new Map();
    
    // Query all locations and aggregate by city
    const locationsRef = db.collection(GEO_LOCATIONS_COLLECTION);
    const snapshot = await locationsRef.get();
    
    snapshot.forEach(doc => {
        const location = doc.data();
        const cityKey = location.cityRegionKey;
        
        if (!cities.has(cityKey)) {
            cities.set(cityKey, {
                city: location.city,
                provinceState: location.provinceState,
                provinceStateName: location.provinceStateName,
                country: location.country,
                countryName: location.countryName,
                regionKey: location.regionKey,
                cityRegionKey: location.cityRegionKey,
                isCanada: location.isCanada,
                isUS: location.isUS,
                postalZipCodes: [location.postalZipCode],
                locationCount: 1,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            const cityData = cities.get(cityKey);
            cityData.postalZipCodes.push(location.postalZipCode);
            cityData.locationCount++;
            cities.set(cityKey, cityData);
        }
    });
    
    // Batch write cities
    const citiesArray = Array.from(cities.entries());
    for (let i = 0; i < citiesArray.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const batchData = citiesArray.slice(i, i + BATCH_SIZE);
        
        for (const [cityKey, cityData] of batchData) {
            const docRef = db.collection(CITIES_COLLECTION).doc(cityKey);
            batch.set(docRef, cityData);
        }
        
        await batch.commit();
        console.log(`   ✅ Cities batch ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE)} committed`);
    }
    
    console.log(`✅ Created ${cities.size.toLocaleString()} unique cities`);
}

/**
 * Create provinces/states summary collection
 */
async function createProvincesStatesSummary() {
    const regions = new Map();
    
    // Query all locations and aggregate by province/state
    const locationsRef = db.collection(GEO_LOCATIONS_COLLECTION);
    const snapshot = await locationsRef.get();
    
    snapshot.forEach(doc => {
        const location = doc.data();
        const regionKey = location.regionKey;
        
        if (!regions.has(regionKey)) {
            regions.set(regionKey, {
                provinceState: location.provinceState,
                provinceStateName: location.provinceStateName,
                country: location.country,
                countryName: location.countryName,
                regionKey: location.regionKey,
                isCanada: location.isCanada,
                isUS: location.isUS,
                cities: new Set([location.city]),
                locationCount: 1,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            const regionData = regions.get(regionKey);
            regionData.cities.add(location.city);
            regionData.locationCount++;
            regions.set(regionKey, regionData);
        }
    });
    
    // Convert cities Set to Array and batch write regions
    const regionsArray = Array.from(regions.entries()).map(([key, data]) => [
        key,
        {
            ...data,
            cities: Array.from(data.cities),
            cityCount: data.cities.size
        }
    ]);
    
    for (let i = 0; i < regionsArray.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const batchData = regionsArray.slice(i, i + BATCH_SIZE);
        
        for (const [regionKey, regionData] of batchData) {
            const docRef = db.collection(PROVINCES_STATES_COLLECTION).doc(regionKey);
            batch.set(docRef, regionData);
        }
        
        await batch.commit();
        console.log(`   ✅ Regions batch ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE)} committed`);
    }
    
    console.log(`✅ Created ${regions.size} provinces/states`);
}

/**
 * Create database indexes for optimal query performance
 */
async function createIndexes() {
    console.log('🔍 Database indexes will be created automatically by Firestore');
    console.log('   Recommended indexes for optimal performance:');
    console.log('   - geoLocations: country, provinceState, city');
    console.log('   - geoLocations: regionKey, city');
    console.log('   - geoLocations: cityRegionKey');
    console.log('   - geoLocations: searchKey');
    console.log('   - geoLocations: isCanada, isDomesticCanada');
    console.log('   - geoLocations: isUS, isDomesticUS');
    console.log('   ✅ Indexes will be auto-created on first queries');
}

// Run the import
if (require.main === module) {
    importGeographicLocations()
        .then(() => {
            console.log('\n🎉 Geographic locations import completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Import failed:', error);
            process.exit(1);
        });
}

module.exports = {
    importGeographicLocations,
    normalizeCanadianLocation,
    normalizeUSALocation,
    generateLocationId,
    generateSearchKey,
    cleanCityName
};
