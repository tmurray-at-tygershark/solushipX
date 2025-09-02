import { db } from '../firebase/db';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';

/**
 * Currency Conversion Service
 * Integrates with the existing currency API system to provide accurate profit calculations
 */

class CurrencyConversionService {
    constructor() {
        this.ratesCache = null;
        this.cacheTimestamp = null;
        this.cacheValidityMs = 60 * 60 * 1000; // 1 hour cache
    }

    /**
     * Get the latest currency rates from Firestore
     */
    async getLatestRates() {
        try {
            // Check cache first
            if (this.ratesCache && this.cacheTimestamp && 
                (Date.now() - this.cacheTimestamp) < this.cacheValidityMs) {
                return this.ratesCache;
            }

            // Query the most recent successful currency rates
            const ratesQuery = query(
                collection(db, 'currencyRates'),
                where('success', '==', true),
                orderBy('timestamp', 'desc'),
                limit(1)
            );

            const snapshot = await getDocs(ratesQuery);
            
            if (snapshot.empty) {
                console.warn('No currency rates found, using fallback rates');
                return this.getFallbackRates();
            }

            const rateData = snapshot.docs[0].data();
            const rates = {
                ...rateData.rates,
                baseCurrency: rateData.baseCurrency,
                timestamp: rateData.timestamp?.toDate(),
                provider: rateData.provider
            };

            // Update cache
            this.ratesCache = rates;
            this.cacheTimestamp = Date.now();

            console.log('📈 Currency rates loaded:', {
                baseCurrency: rates.baseCurrency,
                totalCurrencies: Object.keys(rates).length,
                timestamp: rates.timestamp
            });

            return rates;
        } catch (error) {
            console.error('Failed to load currency rates:', error);
            return this.getFallbackRates();
        }
    }

    /**
     * Get rates for a specific date (for historical shipments)
     */
    async getRatesForDate(targetDate) {
        try {
            // ✅ FIXED: Validate targetDate before using it
            if (!targetDate || isNaN(new Date(targetDate).getTime())) {
                console.warn('Invalid targetDate provided to getRatesForDate:', targetDate);
                return await this.getLatestRates();
            }

            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);

            // ✅ FIXED: Additional validation after date creation
            if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
                console.warn('Invalid date range created:', { startOfDay, endOfDay, originalDate: targetDate });
                return await this.getLatestRates();
            }

            // Query rates for the specific date
            const ratesQuery = query(
                collection(db, 'currencyRates'),
                where('success', '==', true),
                where('timestamp', '>=', startOfDay),
                where('timestamp', '<=', endOfDay),
                orderBy('timestamp', 'desc'),
                limit(1)
            );

            const snapshot = await getDocs(ratesQuery);
            
            if (!snapshot.empty) {
                const rateData = snapshot.docs[0].data();
                console.log(`📈 Historical rates found for ${targetDate.toDateString()}`);
                return {
                    ...rateData.rates,
                    baseCurrency: rateData.baseCurrency,
                    timestamp: rateData.timestamp?.toDate(),
                    provider: rateData.provider
                };
            }

            // If no rates for specific date, find closest previous date
            const closestQuery = query(
                collection(db, 'currencyRates'),
                where('success', '==', true),
                where('timestamp', '<=', endOfDay),
                orderBy('timestamp', 'desc'),
                limit(1)
            );

            const closestSnapshot = await getDocs(closestQuery);
            
            if (!closestSnapshot.empty) {
                const rateData = closestSnapshot.docs[0].data();
                console.log(`📈 Using closest available rates from ${rateData.timestamp?.toDate().toDateString()} for ${targetDate.toDateString()}`);
                return {
                    ...rateData.rates,
                    baseCurrency: rateData.baseCurrency,
                    timestamp: rateData.timestamp?.toDate(),
                    provider: rateData.provider
                };
            }

            // Fallback to latest rates
            console.warn(`No historical rates found for ${targetDate.toDateString()}, using latest rates`);
            return await this.getLatestRates();

        } catch (error) {
            console.error('Failed to load historical currency rates:', error);
            return await this.getLatestRates();
        }
    }

    /**
     * Convert amount from one currency to another
     */
    convertCurrency(amount, fromCurrency, toCurrency, rates) {
        if (!amount || amount === 0) return 0;
        if (fromCurrency === toCurrency) return amount;

        const baseCurrency = rates.baseCurrency || 'CAD';

        // If converting from base currency
        if (fromCurrency === baseCurrency) {
            const rate = rates[toCurrency];
            if (!rate) {
                console.warn(`Exchange rate not found for ${toCurrency}, returning original amount`);
                return amount;
            }
            return amount * rate;
        }

        // If converting to base currency
        if (toCurrency === baseCurrency) {
            const rate = rates[fromCurrency];
            if (!rate) {
                console.warn(`Exchange rate not found for ${fromCurrency}, returning original amount`);
                return amount;
            }
            return amount / rate;
        }

        // Convert via base currency (fromCurrency -> baseCurrency -> toCurrency)
        const fromRate = rates[fromCurrency];
        const toRate = rates[toCurrency];
        
        if (!fromRate || !toRate) {
            console.warn(`Exchange rates not found for ${fromCurrency} or ${toCurrency}, returning original amount`);
            return amount;
        }

        // Convert to base currency first, then to target currency
        const baseAmount = amount / fromRate;
        return baseAmount * toRate;
    }

    /**
     * Convert amounts with detailed logging for debugging
     */
    convertWithLogging(amount, fromCurrency, toCurrency, rates, description = '') {
        const converted = this.convertCurrency(amount, fromCurrency, toCurrency, rates);
        
        if (fromCurrency !== toCurrency) {
            console.log(`💱 Currency conversion ${description}: ${amount} ${fromCurrency} → ${converted.toFixed(2)} ${toCurrency}`);
        }
        
        return converted;
    }

    /**
     * Fallback rates if API is unavailable
     */
    getFallbackRates() {
        return {
            baseCurrency: 'CAD',
            USD: 0.73,  // 1 CAD = 0.73 USD (approximate)
            EUR: 0.68,  // 1 CAD = 0.68 EUR (approximate)
            GBP: 0.58,  // 1 CAD = 0.58 GBP (approximate)
            timestamp: new Date(),
            provider: 'fallback',
            isFallback: true
        };
    }

    /**
     * Calculate profit with proper currency conversion - ALWAYS convert to base currency (CAD)
     */
    async calculateProfitWithConversion(costAmount, costCurrency, chargeAmount, chargeCurrency, shipmentDate = null, baseCurrency = 'CAD') {
        try {
            // Get exchange rates for the shipment date or latest
            const rates = shipmentDate 
                ? await this.getRatesForDate(new Date(shipmentDate))
                : await this.getLatestRates();

            // ALWAYS convert to base currency for consistent calculations
            const targetCurrency = baseCurrency;

            // Convert both amounts to the base currency (CAD)
            const convertedCost = this.convertWithLogging(
                costAmount, 
                costCurrency, 
                targetCurrency, 
                rates, 
                `cost conversion (${costCurrency} → ${targetCurrency})`
            );

            const convertedCharge = this.convertWithLogging(
                chargeAmount, 
                chargeCurrency, 
                targetCurrency, 
                rates, 
                `charge conversion (${chargeCurrency} → ${targetCurrency})`
            );

            const profit = convertedCharge - convertedCost;

            // Store exchange rates used for audit trail
            const exchangeRatesUsed = {
                costRate: costCurrency === targetCurrency ? 1 : (costCurrency === rates.baseCurrency ? 1 : rates[costCurrency]),
                chargeRate: chargeCurrency === targetCurrency ? 1 : (chargeCurrency === rates.baseCurrency ? 1 : rates[chargeCurrency]),
                rateDate: rates.timestamp,
                provider: rates.provider
            };

            // ✅ FIXED: Only show conversion applied if actual conversion happened (not same currency)
            const actualConversionApplied = (costCurrency !== targetCurrency && costAmount > 0) || 
                                          (chargeCurrency !== targetCurrency && chargeAmount > 0);

            return {
                profit,
                currency: targetCurrency, // Always CAD
                costConverted: convertedCost,
                chargeConverted: convertedCharge,
                exchangeRateUsed: rates.timestamp,
                exchangeRatesUsed, // Detailed rate info for audit
                conversionApplied: actualConversionApplied, // ✅ FIXED: Only true if actual conversion occurred
                originalCostCurrency: costCurrency,
                originalChargeCurrency: chargeCurrency
            };

        } catch (error) {
            console.error('Error calculating profit with currency conversion:', error);
            // Fallback to simple calculation in base currency
            return {
                profit: chargeAmount - costAmount,
                currency: baseCurrency,
                costConverted: costAmount,
                chargeConverted: chargeAmount,
                exchangeRateUsed: null,
                conversionApplied: false,
                error: error.message,
                originalCostCurrency: costCurrency,
                originalChargeCurrency: chargeCurrency
            };
        }
    }

    /**
     * Clear the rates cache (useful for testing or force refresh)
     */
    clearCache() {
        this.ratesCache = null;
        this.cacheTimestamp = null;
    }
}

// Export singleton instance
const currencyConversionService = new CurrencyConversionService();
export default currencyConversionService;
