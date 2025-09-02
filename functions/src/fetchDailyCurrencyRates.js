const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const fetch = require('node-fetch');

const db = getFirestore();

/**
 * ✅ AUTOMATED DAILY CURRENCY RATE FETCHING
 * Runs daily at 6 AM EST to fetch fresh exchange rates
 * Uses the same provider and structure as existing rates
 */
exports.fetchDailyCurrencyRates = onSchedule({
    schedule: '0 6 * * *', // Daily at 6 AM EST
    timeZone: 'America/Toronto',
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB'
}, async (event) => {
    console.log('💱 STARTING DAILY CURRENCY RATE FETCH');
    console.log('====================================');
    
    try {
        // Check if we already have rates for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        console.log(`📅 Checking for existing rates for ${today.toISOString().split('T')[0]}`);
        
        const existingRatesQuery = await db.collection('currencyRates')
            .where('timestamp', '>=', today)
            .where('timestamp', '<', tomorrow)
            .where('success', '==', true)
            .limit(1)
            .get();
            
        if (!existingRatesQuery.empty) {
            console.log('✅ Currency rates already exist for today, skipping fetch');
            return { success: true, message: 'Rates already exist for today' };
        }
        
        // Fetch fresh rates from exchangerate-api (matching your existing provider)
        console.log('🌐 Fetching fresh currency rates from exchangerate-api...');
        
        const API_KEY = process.env.EXCHANGE_RATE_API_KEY; // You'll need to set this
        const BASE_CURRENCY = 'CAD'; // Matching your existing base currency
        
        // Use the same API endpoint format as your existing data
        const apiUrl = API_KEY 
            ? `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${BASE_CURRENCY}`
            : `https://api.exchangerate-api.com/v4/latest/${BASE_CURRENCY}`; // Free tier fallback
            
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.rates) {
            throw new Error('Invalid API response: missing rates data');
        }
        
        console.log(`📊 Received rates for ${Object.keys(data.rates).length} currencies`);
        
        // Structure the data to match your existing format
        const currencyDocument = {
            baseCurrency: BASE_CURRENCY,
            provider: 'exchangerate-api',
            rates: data.rates,
            success: true,
            timestamp: new Date(),
            totalCurrencies: Object.keys(data.rates).length,
            fetchedAt: new Date(),
            source: 'automated-daily-fetch',
            // Add metadata for debugging
            metadata: {
                apiEndpoint: apiUrl.replace(API_KEY || '', 'HIDDEN'),
                responseTime: Date.now(),
                rateSample: {
                    USD: data.rates.USD,
                    EUR: data.rates.EUR,
                    GBP: data.rates.GBP
                }
            }
        };
        
        // Save to Firestore
        console.log('💾 Saving currency rates to Firestore...');
        
        const docRef = await db.collection('currencyRates').add(currencyDocument);
        
        console.log(`✅ Currency rates saved successfully!`);
        console.log(`   Document ID: ${docRef.id}`);
        console.log(`   Base Currency: ${BASE_CURRENCY}`);
        console.log(`   Total Currencies: ${currencyDocument.totalCurrencies}`);
        console.log(`   Sample Rates:`);
        console.log(`     USD: ${data.rates.USD}`);
        console.log(`     EUR: ${data.rates.EUR}`);
        console.log(`     GBP: ${data.rates.GBP}`);
        
        return {
            success: true,
            message: 'Daily currency rates fetched successfully',
            documentId: docRef.id,
            totalCurrencies: currencyDocument.totalCurrencies,
            timestamp: currencyDocument.timestamp
        };
        
    } catch (error) {
        console.error('❌ Error fetching daily currency rates:', error);
        
        // Save error record for debugging
        try {
            await db.collection('currencyRates').add({
                success: false,
                error: error.message,
                timestamp: new Date(),
                source: 'automated-daily-fetch',
                fetchAttempt: true
            });
        } catch (saveError) {
            console.error('Failed to save error record:', saveError);
        }
        
        throw new Error(`Daily currency fetch failed: ${error.message}`);
    }
});

/**
 * ✅ MANUAL CURRENCY RATE FETCH (for testing and backfill)
 * Can be called manually or used for backfilling missing dates
 */
exports.fetchCurrencyRatesManual = onSchedule({
    schedule: '0 0 1 1 *', // Runs Jan 1st only (manual trigger)
    timeZone: 'America/Toronto',
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB'
}, async (event) => {
    console.log('💱 MANUAL CURRENCY RATE FETCH');
    console.log('=============================');
    
    // This function can be triggered manually via Firebase console
    // or modified for backfill operations
    
    try {
        const API_KEY = process.env.EXCHANGE_RATE_API_KEY;
        const BASE_CURRENCY = 'CAD';
        
        const apiUrl = API_KEY 
            ? `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${BASE_CURRENCY}`
            : `https://api.exchangerate-api.com/v4/latest/${BASE_CURRENCY}`;
            
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        const currencyDocument = {
            baseCurrency: BASE_CURRENCY,
            provider: 'exchangerate-api',
            rates: data.rates,
            success: true,
            timestamp: new Date(),
            totalCurrencies: Object.keys(data.rates).length,
            fetchedAt: new Date(),
            source: 'manual-fetch'
        };
        
        const docRef = await db.collection('currencyRates').add(currencyDocument);
        
        console.log(`✅ Manual fetch completed: ${docRef.id}`);
        
        return {
            success: true,
            documentId: docRef.id,
            totalCurrencies: currencyDocument.totalCurrencies
        };
        
    } catch (error) {
        console.error('❌ Manual fetch failed:', error);
        throw error;
    }
});
