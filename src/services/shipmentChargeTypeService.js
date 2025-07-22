import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Shipment Charge Type Service
 * Provides dynamic charge types for shipment forms with backward compatibility
 * and fallback to static charge codes for reliability
 */

// Static fallback charge codes (preserved from QuickShip.jsx)
const STATIC_CHARGE_CODES = [
    { value: 'FRT', label: 'FRT', description: 'Freight', category: 'freight' },
    { value: 'ACC', label: 'ACC', description: 'Accessorial', category: 'accessorial' },
    { value: 'FUE', label: 'FUE', description: 'Fuel Surcharge', category: 'fuel' },
    { value: 'MSC', label: 'MSC', description: 'Miscellaneous', category: 'miscellaneous' },
    { value: 'LOG', label: 'LOG', description: 'Logistics Service', category: 'logistics' },
    { value: 'IC LOG', label: 'IC LOG', description: 'Logistics Service', category: 'logistics' },
    { value: 'SUR', label: 'SUR', description: 'Surcharge', category: 'surcharges' },
    { value: 'IC SUR', label: 'IC SUR', description: 'Surcharge', category: 'surcharges' },
    { value: 'HST', label: 'HST', description: 'Harmonized Sales Tax', category: 'taxes' },
    { value: 'HST ON', label: 'HST ON', description: 'Harmonized Sales Tax - ON', category: 'taxes' },
    { value: 'HST BC', label: 'HST BC', description: 'Harmonized Sales Tax - BC', category: 'taxes' },
    { value: 'HST NB', label: 'HST NB', description: 'Harmonized Sales Tax - NB', category: 'taxes' },
    { value: 'HST NF', label: 'HST NF', description: 'Harmonized Sales Tax - NF', category: 'taxes' },
    { value: 'HST NS', label: 'HST NS', description: 'Harmonized Sales Tax - NS', category: 'taxes' },
    { value: 'GST', label: 'GST', description: 'Goods and Sales Tax', category: 'taxes' },
    { value: 'QST', label: 'QST', description: 'Quebec Sales Tax', category: 'taxes' },
    { value: 'HST PE', label: 'HST PE', description: 'Harmonized Sales Tax - PEI', category: 'taxes' },
    { value: 'GOVT', label: 'GOVT', description: 'Customs Taxes', category: 'government' },
    { value: 'GOVD', label: 'GOVD', description: 'Customs Duty', category: 'government' },
    { value: 'GSTIMP', label: 'GSTIMP', description: 'Customs Taxes', category: 'government' },
    { value: 'CLAIMS', label: 'CLAIMS', description: 'Claims Refund', category: 'miscellaneous' }
];

class ShipmentChargeTypeService {
    constructor() {
        this.cache = new Map();
        this.lastFetch = null;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.isLoading = false;
        this.loadPromise = null;
    }

    /**
     * Get all available charge types (dynamic + static fallback)
     * @returns {Promise<Array>} Array of charge type objects
     */
    async getChargeTypes() {
        // Check cache first
        const cached = this.getCachedChargeTypes();
        if (cached) {
            return cached;
        }

        // Prevent multiple simultaneous loads
        if (this.isLoading && this.loadPromise) {
            return await this.loadPromise;
        }

        this.isLoading = true;
        this.loadPromise = this._loadChargeTypes();

        try {
            const result = await this.loadPromise;
            return result;
        } finally {
            this.isLoading = false;
            this.loadPromise = null;
        }
    }

    /**
     * Get cached charge types if available and valid
     * @returns {Array|null} Cached charge types or null
     */
    getCachedChargeTypes() {
        if (this.cache.has('chargeTypes') && this.lastFetch) {
            const timeSinceLastFetch = Date.now() - this.lastFetch;
            if (timeSinceLastFetch < this.cacheTimeout) {
                return this.cache.get('chargeTypes');
            }
        }
        return null;
    }

    /**
     * Load charge types from database with fallback to static codes
     * @private
     */
    async _loadChargeTypes() {
        try {
            console.log('📦 Loading dynamic charge types from database...');
            
            const chargeTypesQuery = query(
                collection(db, 'chargeTypes'),
                where('enabled', '==', true),
                orderBy('displayOrder'),
                orderBy('code')
            );

            const snapshot = await getDocs(chargeTypesQuery);
            const dynamicChargeTypes = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                dynamicChargeTypes.push({
                    value: data.code,
                    label: data.label, // Use the human-readable label
                    description: data.label, // Same as label for consistency
                    category: data.category,
                    taxable: data.taxable,
                    commissionable: data.commissionable,
                    isDynamic: true,
                    displayOrder: data.displayOrder
                });
            });

            console.log(`📦 Loaded ${dynamicChargeTypes.length} dynamic charge types`);

            // Merge dynamic types with static fallbacks
            const mergedChargeTypes = this._mergeChargeTypes(dynamicChargeTypes, STATIC_CHARGE_CODES);

            // Cache the result
            this.cache.set('chargeTypes', mergedChargeTypes);
            this.lastFetch = Date.now();

            return mergedChargeTypes;

        } catch (error) {
            console.error('❌ Failed to load dynamic charge types, using static fallback:', error);
            
            // Return static codes with fallback flag
            const staticWithFallback = STATIC_CHARGE_CODES.map(code => ({
                ...code,
                isDynamic: false,
                isFallback: true
            }));

            // Cache the fallback result temporarily
            this.cache.set('chargeTypes', staticWithFallback);
            this.lastFetch = Date.now();

            return staticWithFallback;
        }
    }

    /**
     * Merge dynamic charge types with static fallbacks
     * @param {Array} dynamicTypes Dynamic charge types from database
     * @param {Array} staticTypes Static fallback charge types
     * @returns {Array} Merged and deduplicated charge types
     */
    _mergeChargeTypes(dynamicTypes, staticTypes) {
        const merged = [...dynamicTypes];
        const dynamicCodes = new Set(dynamicTypes.map(t => t.value));

        // Add static types that don't exist in dynamic types
        staticTypes.forEach(staticType => {
            if (!dynamicCodes.has(staticType.value)) {
                merged.push({
                    ...staticType,
                    isDynamic: false,
                    isLegacy: true
                });
            }
        });

        // Sort by display order, then by code
        return merged.sort((a, b) => {
            if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
                return a.displayOrder - b.displayOrder;
            }
            if (a.displayOrder !== undefined) return -1;
            if (b.displayOrder !== undefined) return 1;
            return a.value.localeCompare(b.value);
        });
    }

    /**
     * Get charge type by code with fallback
     * @param {string} code Charge type code
     * @returns {Promise<Object|null>} Charge type object or null
     */
    async getChargeTypeByCode(code) {
        if (!code) return null;

        const chargeTypes = await this.getChargeTypes();
        return chargeTypes.find(ct => ct.value === code) || null;
    }

    /**
     * Get charge type label/description by code
     * @param {string} code Charge type code
     * @returns {Promise<string>} Charge type label
     */
    async getChargeTypeLabel(code) {
        const chargeType = await this.getChargeTypeByCode(code);
        return chargeType ? (chargeType.label || chargeType.description || chargeType.code) : code || 'Unknown';
    }

    /**
     * Validate charge type code
     * @param {string} code Charge type code to validate
     * @returns {Promise<boolean>} True if valid
     */
    async isValidChargeTypeCode(code) {
        if (!code) return false;

        const chargeTypes = await this.getChargeTypes();
        return chargeTypes.some(ct => ct.value === code);
    }

    /**
     * Get all valid charge type codes
     * @returns {Promise<Array>} Array of valid codes
     */
    async getValidCodes() {
        const chargeTypes = await this.getChargeTypes();
        return chargeTypes.map(ct => ct.value);
    }

    /**
     * Map billing category to charge type code
     * @param {string} category Billing category (freight, fuel, service, etc.)
     * @returns {Promise<string>} Best matching charge type code
     */
    async mapCategoryToChargeType(category) {
        const chargeTypes = await this.getChargeTypes();
        
        // Category mapping priority
        const categoryMappings = {
            'freight': ['FRT'],
            'fuel': ['FUE'],
            'service': ['SUR', 'LOG'],
            'accessorial': ['ACC'],
            'taxes': ['HST', 'GST', 'QST'],
            'government': ['GOVT', 'GOVD'],
            'surcharges': ['SUR'],
            'insurance': ['ACC'],
            'logistics': ['LOG'],
            'miscellaneous': ['MSC']
        };

        const preferredCodes = categoryMappings[category] || ['MSC'];
        
        // Find first available code from preferences
        for (const code of preferredCodes) {
            const chargeType = chargeTypes.find(ct => ct.value === code);
            if (chargeType) {
                return code;
            }
        }

        // Fallback to MSC or first available
        return chargeTypes.find(ct => ct.value === 'MSC')?.value || 
               chargeTypes[0]?.value || 
               'MSC';
    }

    /**
     * Auto-populate charge name based on code selection
     * @param {string} code Selected charge type code
     * @param {string} currentName Current charge name
     * @returns {Promise<string>} Appropriate charge name
     */
    async autoPopulateChargeName(code, currentName = '') {
        const chargeType = await this.getChargeTypeByCode(code);
        
        if (!chargeType) {
            return currentName; // Keep existing name if code not found
        }

        // Check if current name is empty or was auto-populated
        const isCurrentNameEmpty = !currentName.trim();
        const isCurrentNameAutopopulated = await this._isAutopopulatedName(currentName);

        // Only update if name is empty or was previously auto-populated
        if (isCurrentNameEmpty || isCurrentNameAutopopulated) {
            return chargeType.label || chargeType.description || chargeType.code;
        }

        return currentName; // Keep user's custom name
    }

    /**
     * Check if a name was auto-populated (matches any charge type label or description)
     * @param {string} name Name to check
     * @returns {Promise<boolean>} True if auto-populated
     * @private
     */
    async _isAutopopulatedName(name) {
        if (!name) return false;

        const chargeTypes = await this.getChargeTypes();
        return chargeTypes.some(ct => 
            ct.label === name || 
            ct.description === name ||
            (ct.label || ct.description || ct.code) === name
        );
    }

    /**
     * Convert selected rate billing details to manual rates
     * @param {Array} billingDetails Billing details from selected rate
     * @param {string} carrierName Carrier name
     * @param {string} currency Currency code
     * @returns {Promise<Array>} Manual rates array
     */
    async convertBillingDetailsToManualRates(billingDetails, carrierName = '', currency = 'CAD') {
        if (!billingDetails || !Array.isArray(billingDetails)) {
            return [];
        }

        const manualRates = [];
        let rateId = 1;

        for (const detail of billingDetails) {
            if (detail.amount && detail.amount > 0) {
                const chargeCode = await this.mapCategoryToChargeType(detail.category || 'miscellaneous');
                
                manualRates.push({
                    id: rateId++,
                    carrier: carrierName,
                    code: chargeCode,
                    chargeName: detail.name || 'Unknown Charge',
                    cost: detail.actualAmount ? detail.actualAmount.toString() : detail.amount.toString(),
                    costCurrency: currency,
                    charge: detail.amount.toString(),
                    chargeCurrency: currency
                });
            }
        }

        return manualRates;
    }

    /**
     * Clear cache (useful for testing or force refresh)
     */
    clearCache() {
        this.cache.clear();
        this.lastFetch = null;
        console.log('📦 Charge types cache cleared');
    }

    /**
     * Get cache statistics for debugging
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            hasCachedData: this.cache.has('chargeTypes'),
            lastFetch: this.lastFetch,
            cacheAge: this.lastFetch ? Date.now() - this.lastFetch : null,
            isLoading: this.isLoading
        };
    }
}

// Create singleton instance
const shipmentChargeTypeService = new ShipmentChargeTypeService();

export default shipmentChargeTypeService; 