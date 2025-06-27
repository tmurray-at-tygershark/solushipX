const {onCall} = require('firebase-functions/v2/https');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {setGlobalOptions} = require('firebase-functions/v2');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Set global options
setGlobalOptions({maxInstances: 10});

// Initialize admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const syncCurrencyRates = onCall(async (request) => {
    try {
        // Verify the request is from an authenticated admin
        if (!request.auth) {
            throw new Error('Must be logged in');
        }

        const { data } = request;

        const { provider, apiKey, baseCurrency = 'CAD' } = data;
        
        console.log('Syncing currency rates:', { provider, baseCurrency });

        let rates = {};
        let apiUrl = '';

        // Configure API based on provider
        switch (provider) {
            case 'exchangerate-api':
                // Free tier - no API key required
                apiUrl = `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`;
                break;
                
            case 'fixer':
                if (!apiKey) {
                    throw new Error('API key required for Fixer.io');
                }
                apiUrl = `http://data.fixer.io/api/latest?access_key=${apiKey}&base=${baseCurrency}`;
                break;
                
            case 'currencylayer':
                if (!apiKey) {
                    throw new Error('API key required for CurrencyLayer');
                }
                apiUrl = `http://api.currencylayer.com/live?access_key=${apiKey}&source=${baseCurrency}`;
                break;
                
            default:
                throw new Error('Unsupported currency provider');
        }

        // Fetch rates from API
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const apiData = await response.json();
        console.log('API Response:', apiData);

        // Parse response based on provider
        switch (provider) {
            case 'exchangerate-api':
                if (!apiData.rates) {
                    throw new Error('Invalid response from ExchangeRate-API');
                }
                rates = apiData.rates;
                break;
                
            case 'fixer':
                if (!apiData.success || !apiData.rates) {
                    throw new Error(apiData.error?.info || 'Invalid response from Fixer.io');
                }
                rates = apiData.rates;
                break;
                
            case 'currencylayer':
                if (!apiData.success || !apiData.quotes) {
                    throw new Error(apiData.error?.info || 'Invalid response from CurrencyLayer');
                }
                // CurrencyLayer returns quotes in format "USDCAD", need to convert to just "CAD"
                rates = {};
                Object.keys(apiData.quotes).forEach(key => {
                    const currency = key.slice(3); // Remove the source currency prefix
                    rates[currency] = apiData.quotes[key];
                });
                break;
        }

        // Ensure we have critical currencies for North American shipping
        const requiredCurrencies = ['USD', 'CAD', 'EUR', 'GBP'];
        const missingCurrencies = requiredCurrencies.filter(curr => !rates[curr] && curr !== baseCurrency);
        
        if (missingCurrencies.length > 0) {
            console.warn('Missing required currencies:', missingCurrencies);
        }

        // Store rates in Firestore
        const rateRecord = {
            provider,
            baseCurrency,
            rates,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            success: true,
            totalCurrencies: Object.keys(rates).length
        };

        await db.collection('currencyRates').add(rateRecord);

        // Update system settings with last sync info
        await db.collection('systemSettings').doc('global').set({
            lastCurrencySync: admin.firestore.FieldValue.serverTimestamp(),
            currencyProvider: provider,
            baseCurrency
        }, { merge: true });

        console.log(`Successfully synced ${Object.keys(rates).length} currency rates`);

        return {
            success: true,
            rates,
            baseCurrency,
            totalCurrencies: Object.keys(rates).length,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error syncing currency rates:', error);
        
        // Store error record
        await db.collection('currencyRates').add({
            provider: data.provider,
            baseCurrency: data.baseCurrency || 'CAD',
            error: error.message,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            success: false
        });

        throw new Error(`Failed to sync currency rates: ${error.message}`);
    }
});

// Scheduled function to auto-sync rates daily  
const scheduledCurrencySync = onSchedule('0 9 * * *', async (event) => {
        try {
            console.log('Running scheduled currency sync...');

            // Get system settings to check if auto-sync is enabled
            const settingsDoc = await db.collection('systemSettings').doc('global').get();
            
            if (!settingsDoc.exists) {
                console.log('No system settings found, skipping auto-sync');
                return;
            }

            const settings = settingsDoc.data();
            
            if (!settings.autoSyncRates) {
                console.log('Auto-sync disabled, skipping');
                return;
            }

            // Use system settings for sync
            const syncData = {
                provider: settings.currencyProvider || 'exchangerate-api',
                apiKey: settings.currencyApiKey || '',
                baseCurrency: settings.defaultCurrency || 'CAD'
            };

            // Create a mock request for the callable function
            const mockRequest = {
                auth: { uid: 'system-scheduler' },
                data: syncData
            };

            // Call the sync function
            const result = await syncCurrencyRates(mockRequest);
            
            console.log('Scheduled currency sync completed:', result);
            
        } catch (error) {
            console.error('Scheduled currency sync failed:', error);
        }
    });

module.exports = {
    syncCurrencyRates,
    scheduledCurrencySync
}; 