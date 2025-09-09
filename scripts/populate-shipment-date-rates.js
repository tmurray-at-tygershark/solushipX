#!/usr/bin/env node

/**
 * Populate Exchange Rates for Specific Shipment Date
 * 
 * This script populates exchange rates for August 28, 2025 (the shipment date)
 * so the currency conversion will work properly.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fetch = require('node-fetch');

// Initialize Firebase Admin
const serviceAccount = require('../functions/service-account.json');

initializeApp({
    credential: cert(serviceAccount),
    projectId: 'solushipx'
});

const db = getFirestore();

async function populateShipmentDateRates() {
    console.log('🚀 POPULATING EXCHANGE RATES FOR SHIPMENT DATE');
    console.log('==============================================');
    
    try {
        // Fetch current rates
        const apiUrl = `https://api.exchangerate-api.com/v4/latest/CAD`;
        console.log('🌐 Fetching current exchange rates...');
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log(`✅ Current rates: USD=${data.rates.USD}, EUR=${data.rates.EUR}, GBP=${data.rates.GBP}`);
        
        // Target date: August 28, 2025 (your shipment date)
        const targetDate = new Date('2025-08-28');
        const dateString = '2025-08-28';
        
        console.log(`📅 Populating rates for shipment date: ${targetDate.toDateString()}`);
        
        // Check if rates already exist
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const existingRatesQuery = await db.collection('currencyRates')
            .where('timestamp', '>=', startOfDay)
            .where('timestamp', '<=', endOfDay)
            .where('success', '==', true)
            .limit(1)
            .get();
            
        if (!existingRatesQuery.empty) {
            console.log('✅ Rates already exist for this date');
            const existing = existingRatesQuery.docs[0].data();
            console.log(`💱 Existing USD rate: ${existing.rates.USD}`);
            return;
        }
        
        // Create currency document for August 28, 2025
        const currencyDocument = {
            baseCurrency: 'CAD',
            provider: 'exchangerate-api',
            rates: data.rates,
            success: true,
            timestamp: targetDate,
            totalCurrencies: Object.keys(data.rates).length,
            fetchedAt: new Date(),
            source: 'shipment-date-backfill',
            metadata: {
                apiEndpoint: apiUrl,
                backfillDate: dateString,
                note: 'Populated for shipment ICAL-24DOTN currency conversion',
                rateSample: {
                    USD: data.rates.USD,
                    EUR: data.rates.EUR,
                    GBP: data.rates.GBP
                }
            }
        };
        
        // Save to Firestore
        const docRef = await db.collection('currencyRates').add(currencyDocument);
        
        console.log(`✅ Exchange rates saved for ${dateString}!`);
        console.log(`📄 Document ID: ${docRef.id}`);
        console.log(`💱 USD rate: ${data.rates.USD}`);
        console.log('');
        
        // Test the query immediately
        console.log('🔍 TESTING QUERY FOR SHIPMENT DATE...');
        
        const testQuery = await db.collection('currencyRates')
            .where('success', '==', true)
            .where('timestamp', '>=', startOfDay)
            .where('timestamp', '<=', endOfDay)
            .limit(1)
            .get();
            
        if (!testQuery.empty) {
            const testDoc = testQuery.docs[0].data();
            console.log(`✅ Query successful - USD rate for ${dateString}: ${testDoc.rates.USD}`);
            console.log('');
            console.log('🎯 NEXT STEPS:');
            console.log('1. Refresh your shipment page (hard refresh: Ctrl+F5)');
            console.log('2. Check browser console for currency conversion logs');
            console.log('3. The profit should now show the correct exchange rate');
            console.log(`4. Expected: "Converted @ ${data.rates.USD.toFixed(3)}" instead of "Converted @ 0.733"`);
        } else {
            console.log('❌ Query test failed - rates not found after saving');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

// Run the script
if (require.main === module) {
    populateShipmentDateRates()
        .then(() => {
            console.log('✅ Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}
