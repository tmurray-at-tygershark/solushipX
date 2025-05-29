// Universal data mapping layer for carrier rate responses
// This ensures consistent data structure regardless of carrier

/**
 * Standard rate object structure that all carriers should map to
 */
export const STANDARD_RATE_STRUCTURE = {
    // Unique identifiers
    quoteId: '',
    rateId: '',
    
    // Carrier information
    carrierName: '',
    carrierCode: '', // SCAC code
    carrierKey: '',
    
    // Service information
    service: '',
    serviceType: '',
    serviceMode: '',
    serviceCode: '',
    
    // Pricing breakdown
    totalCharges: 0,
    freightCharges: 0,
    fuelCharges: 0,
    serviceCharges: 0,
    accessorialCharges: 0,
    guaranteeCharge: 0,
    
    // Currency and taxes
    currency: 'USD',
    taxCharges: 0,
    
    // Transit information
    transitTime: 0,
    transitDays: 0,
    estimatedDeliveryDate: null,
    
    // Service options
    guaranteed: false,
    guaranteedService: false,
    
    // Weight information
    billedWeight: 0,
    ratedWeight: 0,
    
    // Additional data
    billingDetails: [],
    guarOptions: [],
    accessorials: [],
    
    // Raw carrier data for reference
    rawCarrierData: {}
};

/**
 * Map eShipPlus rate data to standard format
 * @param {Object} eshipRate - Raw eShipPlus rate object
 * @returns {Object} - Standardized rate object
 */
export function mapEShipPlusRate(eshipRate) {
    return {
        quoteId: eshipRate.quoteId || eshipRate.rateId || '',
        rateId: eshipRate.quoteId || eshipRate.rateId || '',
        
        carrierName: eshipRate.carrierName || '',
        carrierCode: eshipRate.carrierScac || '',
        carrierKey: eshipRate.carrierKey || '',
        
        service: eshipRate.serviceType || eshipRate.serviceMode || '',
        serviceType: eshipRate.serviceType || eshipRate.serviceMode || '',
        serviceMode: eshipRate.serviceMode || '',
        serviceCode: eshipRate.serviceCode || '',
        
        totalCharges: parseFloat(eshipRate.totalCharges || 0),
        freightCharges: parseFloat(eshipRate.freightCharges || 0),
        fuelCharges: parseFloat(eshipRate.fuelCharges || 0),
        serviceCharges: parseFloat(eshipRate.serviceCharges || 0),
        accessorialCharges: parseFloat(eshipRate.accessorialCharges || 0),
        guaranteeCharge: parseFloat(eshipRate.guaranteeCharge || 0),
        
        currency: eshipRate.currency || 'USD',
        taxCharges: 0, // eShipPlus doesn't typically separate tax charges
        
        transitTime: parseInt(eshipRate.transitTime || eshipRate.transitDays || 0),
        transitDays: parseInt(eshipRate.transitTime || eshipRate.transitDays || 0),
        estimatedDeliveryDate: eshipRate.estimatedDeliveryDate || null,
        
        guaranteed: eshipRate.guaranteed || eshipRate.guaranteedService || false,
        guaranteedService: eshipRate.guaranteedService || false,
        
        billedWeight: parseFloat(eshipRate.billedWeight || 0),
        ratedWeight: parseFloat(eshipRate.ratedWeight || 0),
        
        billingDetails: eshipRate.billingDetails || [],
        guarOptions: eshipRate.guarOptions || [],
        accessorials: eshipRate.accessorials || [],
        
        rawCarrierData: {
            carrier: 'ESHIPPLUS',
            originalData: eshipRate
        }
    };
}

/**
 * Map Canpar rate data to standard format
 * @param {Object} canparRate - Raw Canpar rate object
 * @returns {Object} - Standardized rate object
 */
export function mapCanparRate(canparRate) {
    return {
        quoteId: canparRate.quoteId || '',
        rateId: canparRate.quoteId || '',
        
        carrierName: canparRate.carrierName || 'Canpar Express',
        carrierCode: canparRate.carrierScac || 'CANP',
        carrierKey: canparRate.carrierKey || 'CANPAR',
        
        service: canparRate.serviceType || canparRate.serviceMode || '',
        serviceType: canparRate.serviceType || canparRate.serviceMode || '',
        serviceMode: canparRate.serviceMode || '',
        serviceCode: canparRate.canparServiceType?.toString() || '',
        
        totalCharges: parseFloat(canparRate.totalCharges || 0),
        freightCharges: parseFloat(canparRate.freightCharges || 0),
        fuelCharges: parseFloat(canparRate.fuelCharges || 0),
        serviceCharges: parseFloat(canparRate.serviceCharges || 0),
        accessorialCharges: parseFloat(canparRate.accessorialCharges || 0),
        guaranteeCharge: parseFloat(canparRate.guaranteeCharge || 0),
        
        currency: canparRate.currency || 'CAD',
        taxCharges: parseFloat((canparRate.taxCharge1 || 0) + (canparRate.taxCharge2 || 0)),
        
        transitTime: parseInt(canparRate.transitTime || 0),
        transitDays: parseInt(canparRate.transitTime || 0),
        estimatedDeliveryDate: canparRate.estimatedDeliveryDate || null,
        
        guaranteed: canparRate.guaranteed || canparRate.guaranteedService || false,
        guaranteedService: canparRate.guaranteedService || false,
        
        billedWeight: parseFloat(canparRate.billedWeight || 0),
        ratedWeight: parseFloat(canparRate.ratedWeight || 0),
        
        billingDetails: canparRate.billingDetails || [],
        guarOptions: canparRate.guarOptions || [],
        accessorials: canparRate.accessorials || [],
        
        rawCarrierData: {
            carrier: 'CANPAR',
            canparServiceType: canparRate.canparServiceType,
            canparZone: canparRate.canparZone,
            canparTaxCode1: canparRate.canparTaxCode1,
            canparTaxCode2: canparRate.canparTaxCode2,
            originalData: canparRate
        }
    };
}

/**
 * Universal rate mapper that detects carrier and applies appropriate mapping
 * @param {Object} rateData - Raw rate data from any carrier
 * @param {string} carrierType - Optional carrier type hint
 * @returns {Object} - Standardized rate object
 */
export function mapCarrierRate(rateData, carrierType = null) {
    // Auto-detect carrier if not specified
    if (!carrierType) {
        if (rateData.carrierScac || rateData.carrierKey === 'ESHIPPLUS' || rateData.quoteId) {
            carrierType = 'ESHIPPLUS';
        } else if (rateData.carrierKey === 'CANPAR' || rateData.canparServiceType !== undefined) {
            carrierType = 'CANPAR';
        }
    }
    
    switch (carrierType?.toUpperCase()) {
        case 'ESHIPPLUS':
            return mapEShipPlusRate(rateData);
        case 'CANPAR':
            return mapCanparRate(rateData);
        default:
            console.warn('Unknown carrier type, returning raw data with basic structure');
            return {
                ...STANDARD_RATE_STRUCTURE,
                ...rateData,
                rawCarrierData: {
                    carrier: 'UNKNOWN',
                    originalData: rateData
                }
            };
    }
}

/**
 * Map an array of rates from any carrier to standard format
 * @param {Array} rates - Array of raw rate objects
 * @param {string} carrierType - Optional carrier type hint
 * @returns {Array} - Array of standardized rate objects
 */
export function mapCarrierRates(rates, carrierType = null) {
    if (!Array.isArray(rates)) {
        return [];
    }
    
    return rates.map(rate => mapCarrierRate(rate, carrierType));
}

/**
 * Validate that a rate object has all required fields
 * @param {Object} rate - Rate object to validate
 * @returns {Object} - Validation result with isValid boolean and errors array
 */
export function validateStandardRate(rate) {
    const errors = [];
    const requiredFields = [
        'carrierName',
        'service',
        'totalCharges',
        'transitTime',
        'currency'
    ];
    
    requiredFields.forEach(field => {
        if (!rate[field] && rate[field] !== 0) {
            errors.push(`Missing required field: ${field}`);
        }
    });
    
    // Validate numeric fields
    const numericFields = ['totalCharges', 'freightCharges', 'fuelCharges', 'transitTime'];
    numericFields.forEach(field => {
        if (rate[field] !== undefined && (isNaN(rate[field]) || rate[field] < 0)) {
            errors.push(`Invalid numeric value for field: ${field}`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Sort rates by different criteria
 * @param {Array} rates - Array of standardized rate objects
 * @param {string} sortBy - Sort criteria: 'price', 'transit', 'carrier'
 * @returns {Array} - Sorted array of rates
 */
export function sortStandardRates(rates, sortBy = 'price') {
    const sortedRates = [...rates];
    
    switch (sortBy) {
        case 'price':
            return sortedRates.sort((a, b) => (a.totalCharges || 0) - (b.totalCharges || 0));
        case 'transit':
            return sortedRates.sort((a, b) => (a.transitTime || 0) - (b.transitTime || 0));
        case 'carrier':
            return sortedRates.sort((a, b) => (a.carrierName || '').localeCompare(b.carrierName || ''));
        default:
            return sortedRates;
    }
}

/**
 * Filter rates by various criteria
 * @param {Array} rates - Array of standardized rate objects
 * @param {Object} filters - Filter criteria
 * @returns {Array} - Filtered array of rates
 */
export function filterStandardRates(rates, filters = {}) {
    let filteredRates = [...rates];
    
    if (filters.maxPrice) {
        filteredRates = filteredRates.filter(rate => rate.totalCharges <= filters.maxPrice);
    }
    
    if (filters.maxTransitTime) {
        filteredRates = filteredRates.filter(rate => rate.transitTime <= filters.maxTransitTime);
    }
    
    if (filters.carrier) {
        filteredRates = filteredRates.filter(rate => 
            rate.carrierName.toLowerCase().includes(filters.carrier.toLowerCase())
        );
    }
    
    if (filters.guaranteedOnly) {
        filteredRates = filteredRates.filter(rate => rate.guaranteed);
    }
    
    if (filters.currency) {
        filteredRates = filteredRates.filter(rate => rate.currency === filters.currency);
    }
    
    return filteredRates;
} 