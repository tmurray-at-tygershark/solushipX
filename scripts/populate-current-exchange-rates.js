#!/usr/bin/env node

/**
 * Populate Current Exchange Rates
 * 
 * This script fetches current exchange rates and populates them for recent dates
 * to ensure the currency conversion system has data to work with.
 * 
 * Usage: node scripts/populate-current-exchange-rates.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fetch = require('node-fetch');

// Initialize Firebase Admin using the same pattern as existing scripts
const serviceAccount = require('../functions/service-account.json');

initializeApp({
    credential: cert(serviceAccount),
    projectId: 'solushipx'
});

const db = getFirestore();
console.log('✅ Firebase Admin initialized successfully');

// Configuration
const BASE_CURRENCY = 'CAD';

/**
 * Fetch current exchange rates and populate for recent dates
 */
async function populateCurrentRates() {
    console.log('🚀 POPULATING CURRENT EXCHANGE RATES');
    console.log('===================================');
    
    try {
        // Fetch current rates
        console.log('🌐 Fetching current exchange rates...');
        const apiUrl = `https://api.exchangerate-api.com/v4/latest/${BASE_CURRENCY}`;
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.rates) {
            throw new Error('Invalid API response: missing rates data');
        }
        
        console.log(`✅ Current rates fetched successfully!`);
        console.log(`💱 USD rate: ${data.rates.USD}`);
        console.log(`💱 EUR rate: ${data.rates.EUR}`);
        console.log(`💱 GBP rate: ${data.rates.GBP}`);
        console.log(`📊 Total currencies: ${Object.keys(data.rates).length}`);
        
        // Populate rates for today and past 7 days
        const datesToPopulate = [];
        for (let i = 0; i <= 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            datesToPopulate.push(date);
        }
        
        console.log(`📅 Populating rates for ${datesToPopulate.length} dates...`);
        
        let successCount = 0;
        let skippedCount = 0;
        
        for (const date of datesToPopulate) {
            const dateString = date.toISOString().split('T')[0];
            
            // Check if rates already exist for this date
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            
            const existingRatesQuery = await db.collection('currencyRates')
                .where('timestamp', '>=', startOfDay)
                .where('timestamp', '<=', endOfDay)
                .where('success', '==', true)
                .limit(1)
                .get();
                
            if (!existingRatesQuery.empty) {
                console.log(`⏭️  ${dateString} - Already exists, skipping`);
                skippedCount++;
                continue;
            }
            
            // Create currency document for this date
            const currencyDocument = {
                baseCurrency: BASE_CURRENCY,
                provider: 'exchangerate-api',
                rates: data.rates,
                success: true,
                timestamp: date,
                totalCurrencies: Object.keys(data.rates).length,
                fetchedAt: new Date(),
                source: 'current-rates-backfill',
                metadata: {
                    apiEndpoint: apiUrl,
                    backfillDate: dateString,
                    rateSample: {
                        USD: data.rates.USD,
                        EUR: data.rates.EUR,
                        GBP: data.rates.GBP
                    }
                }
            };
            
            // Save to Firestore
            const docRef = await db.collection('currencyRates').add(currencyDocument);
            
            console.log(`✅ ${dateString} - Saved (USD: ${data.rates.USD})`);
            successCount++;
        }
        
        console.log('');
        console.log('🎉 POPULATION COMPLETE!');
        console.log('======================');
        console.log(`✅ Successfully added: ${successCount}`);
        console.log(`⏭️  Skipped (existed): ${skippedCount}`);
        
        if (successCount > 0) {
            console.log('');
            console.log('🎯 NEXT STEPS:');
            console.log('1. Check Firebase Console: https://console.firebase.google.com/project/solushipx/firestore/data/currencyRates');
            console.log('2. Refresh the shipment page to see updated exchange rates');
            console.log('3. Look for console logs showing actual rates instead of fallback 0.733');
        }
        
        // Test the query to make sure it works
        console.log('');
        console.log('🔍 TESTING CURRENCY QUERY...');
        const testDate = new Date();
        testDate.setDate(testDate.getDate() - 1); // Yesterday
        
        const testStartOfDay = new Date(testDate);
        testStartOfDay.setHours(0, 0, 0, 0);
        
        const testEndOfDay = new Date(testDate);
        testEndOfDay.setHours(23, 59, 59, 999);
        
        const testQuery = await db.collection('currencyRates')
            .where('success', '==', true)
            .where('timestamp', '>=', testStartOfDay)
            .where('timestamp', '<=', testEndOfDay)
            .limit(1)
            .get();
            
        if (!testQuery.empty) {
            const testDoc = testQuery.docs[0].data();
            console.log(`✅ Query test successful - Found rate for ${testDate.toDateString()}: USD=${testDoc.rates.USD}`);
        } else {
            console.log(`⚠️  Query test failed - No rates found for ${testDate.toDateString()}`);
        }
        
    } catch (error) {
        console.error('❌ Error populating current rates:', error);
        throw error;
    }
}

// Run the population
if (require.main === module) {
    populateCurrentRates()
        .then(() => {
            console.log('✅ Population process completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Population process failed:', error);
            process.exit(1);
        });
}
