#!/usr/bin/env node

/**
 * Test script for geographic locations import
 * 
 * This script validates the data structure and tests the import process
 * with a small sample before running the full import.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Import the main functions
const {
    normalizeCanadianLocation,
    normalizeUSALocation,
    generateLocationId,
    generateSearchKey,
    cleanCityName
} = require('./import-geographic-locations');

// Initialize Firebase Admin (if not already initialized)
if (admin.apps.length === 0) {
    const serviceAccount = require('../service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://solushipx.firebaseio.com'
    });
}

const db = admin.firestore();

/**
 * Test data normalization functions
 */
function testDataNormalization() {
    console.log('🧪 Testing data normalization functions...');
    
    // Test Canadian location
    const sampleCanadianData = {
        "city": "Calgary",
        "province-code": "AB",
        "country-code": "CA",
        "postal-code": "T2E6M4",
        "latitude": 51.0478,
        "longitude": -114.0585
    };
    
    const normalizedCanadian = normalizeCanadianLocation(sampleCanadianData);
    console.log('📍 Canadian sample normalized:', JSON.stringify(normalizedCanadian, null, 2));
    
    // Test US location
    const sampleUSData = {
        "city": "Valdez",
        "state-code": "AK",
        "country-code": "US",
        "zipcode": 99686,
        "latitude": 61.1381,
        "longitude": -146.3572
    };
    
    const normalizedUS = normalizeUSALocation(sampleUSData);
    console.log('📍 US sample normalized:', JSON.stringify(normalizedUS, null, 2));
    
    // Test ID generation
    const canadianId = generateLocationId(normalizedCanadian);
    const usId = generateLocationId(normalizedUS);
    console.log('🆔 Generated IDs:');
    console.log('   Canadian:', canadianId);
    console.log('   US:', usId);
    
    // Test search key generation
    const canadianSearchKey = generateSearchKey(sampleCanadianData.city, sampleCanadianData['province-code'], sampleCanadianData['country-code']);
    const usSearchKey = generateSearchKey(sampleUSData.city, sampleUSData['state-code'], sampleUSData['country-code']);
    console.log('🔍 Search keys:');
    console.log('   Canadian:', canadianSearchKey);
    console.log('   US:', usSearchKey);
    
    console.log('✅ Data normalization tests completed');
}

/**
 * Test small batch import
 */
async function testSmallImport() {
    console.log('\n🧪 Testing small batch import...');
    
    try {
        // Read small samples from both files
        const canadaData = JSON.parse(fs.readFileSync('../postal-codes-canada.json', 'utf8'));
        const usaData = JSON.parse(fs.readFileSync('../postal-codes-usa.json', 'utf8'));
        
        console.log(`📊 Total available: ${canadaData.length.toLocaleString()} Canadian + ${usaData.length.toLocaleString()} US locations`);
        
        // Take small samples
        const canadaSample = canadaData.slice(0, 10);
        const usaSample = usaData.slice(0, 10);
        
        console.log(`📊 Testing with: ${canadaSample.length} Canadian + ${usaSample.length} US samples`);
        
        // Test import to a test collection
        const testCollectionName = 'testGeoLocations';
        const batch = db.batch();
        
        // Process Canadian samples
        for (const rawLocation of canadaSample) {
            const normalizedLocation = normalizeCanadianLocation(rawLocation);
            const docId = generateLocationId(normalizedLocation);
            const docRef = db.collection(testCollectionName).doc(docId);
            
            batch.set(docRef, {
                ...normalizedLocation,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                testImport: true
            });
        }
        
        // Process US samples
        for (const rawLocation of usaSample) {
            const normalizedLocation = normalizeUSALocation(rawLocation);
            const docId = generateLocationId(normalizedLocation);
            const docRef = db.collection(testCollectionName).doc(docId);
            
            batch.set(docRef, {
                ...normalizedLocation,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                testImport: true
            });
        }
        
        // Commit the test batch
        await batch.commit();
        console.log(`✅ Test import successful: ${canadaSample.length + usaSample.length} locations written to ${testCollectionName}`);
        
        // Verify the data
        const testSnapshot = await db.collection(testCollectionName).limit(5).get();
        console.log('\n📋 Sample imported documents:');
        testSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`   ${doc.id}: ${data.city}, ${data.provinceStateName}, ${data.countryName} (${data.postalZipCode})`);
        });
        
        // Clean up test data
        console.log('\n🧹 Cleaning up test data...');
        const deleteSnapshot = await db.collection(testCollectionName).get();
        const deleteBatch = db.batch();
        deleteSnapshot.forEach(doc => {
            deleteBatch.delete(doc.ref);
        });
        await deleteBatch.commit();
        console.log('✅ Test data cleaned up');
        
    } catch (error) {
        console.error('❌ Test import failed:', error);
        throw error;
    }
}

/**
 * Analyze file structure and provide import estimates
 */
function analyzeImportRequirements() {
    console.log('\n📊 Analyzing import requirements...');
    
    try {
        // Get file stats
        const canadaStats = fs.statSync('../postal-codes-canada.json');
        const usaStats = fs.statSync('../postal-codes-usa.json');
        
        console.log(`📁 File sizes:`);
        console.log(`   Canada: ${(canadaStats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   USA: ${(usaStats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Total: ${((canadaStats.size + usaStats.size) / 1024 / 1024).toFixed(2)} MB`);
        
        // Read small samples to count records
        const canadaSample = fs.readFileSync('../postal-codes-canada.json', 'utf8');
        const usaSample = fs.readFileSync('../postal-codes-usa.json', 'utf8');
        
        const canadaCount = (canadaSample.match(/\{/g) || []).length;
        const usaCount = (usaSample.match(/\{/g) || []).length;
        
        console.log(`📊 Estimated record counts:`);
        console.log(`   Canada: ~${canadaCount.toLocaleString()} locations`);
        console.log(`   USA: ~${usaCount.toLocaleString()} locations`);
        console.log(`   Total: ~${(canadaCount + usaCount).toLocaleString()} locations`);
        
        // Estimate import time (500 records per batch, ~1 second per batch)
        const totalRecords = canadaCount + usaCount;
        const estimatedBatches = Math.ceil(totalRecords / 500);
        const estimatedTimeMinutes = Math.ceil(estimatedBatches / 60); // Assuming 1 batch per second
        
        console.log(`⏱️  Import estimates:`);
        console.log(`   Estimated batches: ${estimatedBatches.toLocaleString()}`);
        console.log(`   Estimated time: ${estimatedTimeMinutes} minutes`);
        console.log(`   Firestore write operations: ${totalRecords.toLocaleString()}`);
        
        // Storage estimates
        const avgDocSize = 500; // bytes per document (estimated)
        const totalStorageMB = (totalRecords * avgDocSize) / 1024 / 1024;
        
        console.log(`💾 Storage estimates:`);
        console.log(`   Main collection: ~${totalStorageMB.toFixed(2)} MB`);
        console.log(`   Summary collections: ~${(totalStorageMB * 0.1).toFixed(2)} MB`);
        console.log(`   Total Firestore storage: ~${(totalStorageMB * 1.1).toFixed(2)} MB`);
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
    }
}

/**
 * Main test function
 */
async function runTests() {
    console.log('🧪 Geographic Locations Import - Testing Suite');
    console.log('===============================================');
    
    try {
        // Test 1: Data normalization
        testDataNormalization();
        
        // Test 2: File analysis
        analyzeImportRequirements();
        
        // Test 3: Small batch import
        await testSmallImport();
        
        console.log('\n✅ All tests passed! Ready for full import.');
        console.log('\n🚀 To run the full import:');
        console.log('   node scripts/import-geographic-locations.js');
        
    } catch (error) {
        console.error('\n❌ Tests failed:', error);
        throw error;
    }
}

// Run tests if this script is called directly
if (require.main === module) {
    runTests()
        .then(() => {
            console.log('\n🎉 Testing completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Testing failed:', error);
            process.exit(1);
        });
}

module.exports = {
    testDataNormalization,
    testSmallImport,
    analyzeImportRequirements,
    runTests
};
