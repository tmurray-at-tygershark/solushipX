/**
 * Canadian Tax Service
 * Handles Canadian provincial tax calculations for domestic shipments
 */

// Provincial tax configuration based on current Canadian tax rates
export const CANADIAN_TAX_CONFIG = {
    // HST Provinces (single tax)
    'ON': {
        taxes: [
            { code: 'HST ON', name: 'HST Ontario', rate: 13.0, type: 'HST' }
        ],
        totalRate: 13.0
    },
    'NB': {
        taxes: [
            { code: 'HST NB', name: 'HST New Brunswick', rate: 15.0, type: 'HST' }
        ],
        totalRate: 15.0
    },
    'NL': {
        taxes: [
            { code: 'HST NL', name: 'HST Newfoundland and Labrador', rate: 15.0, type: 'HST' }
        ],
        totalRate: 15.0
    },
    'PE': {
        taxes: [
            { code: 'HST PE', name: 'HST Prince Edward Island', rate: 15.0, type: 'HST' }
        ],
        totalRate: 15.0
    },
    'NS': {
        taxes: [
            { code: 'HST NS', name: 'HST Nova Scotia', rate: 14.0, type: 'HST' }
        ],
        totalRate: 14.0
    },
    
    // GST + PST Provinces (dual tax)
    'BC': {
        taxes: [
            { code: 'GST', name: 'GST British Columbia', rate: 5.0, type: 'GST' },
            { code: 'PST BC', name: 'PST British Columbia', rate: 7.0, type: 'PST' }
        ],
        totalRate: 12.0
    },
    'MB': {
        taxes: [
            { code: 'GST', name: 'GST Manitoba', rate: 5.0, type: 'GST' },
            { code: 'PST MB', name: 'PST Manitoba', rate: 7.0, type: 'PST' }
        ],
        totalRate: 12.0
    },
    'SK': {
        taxes: [
            { code: 'GST', name: 'GST Saskatchewan', rate: 5.0, type: 'GST' },
            { code: 'PST SK', name: 'PST Saskatchewan', rate: 6.0, type: 'PST' }
        ],
        totalRate: 11.0
    },
    
    // GST + QST (Quebec special case)
    'QC': {
        taxes: [
            { code: 'GST', name: 'GST Quebec', rate: 5.0, type: 'GST' },
            { code: 'QST', name: 'QST Quebec', rate: 9.975, type: 'QST' }
        ],
        totalRate: 14.975
    },
    
    // GST Only Provinces/Territories
    'AB': {
        taxes: [
            { code: 'GST', name: 'GST Alberta', rate: 5.0, type: 'GST' }
        ],
        totalRate: 5.0
    },
    'NT': {
        taxes: [
            { code: 'GST', name: 'GST Northwest Territories', rate: 5.0, type: 'GST' }
        ],
        totalRate: 5.0
    },
    'NU': {
        taxes: [
            { code: 'GST', name: 'GST Nunavut', rate: 5.0, type: 'GST' }
        ],
        totalRate: 5.0
    },
    'YT': {
        taxes: [
            { code: 'GST', name: 'GST Yukon', rate: 5.0, type: 'GST' }
        ],
        totalRate: 5.0
    }
};

/**
 * Check if shipment qualifies for Canadian taxes
 */
export const isCanadianDomesticShipment = (shipFrom, shipTo) => {
    if (!shipFrom || !shipTo) return false;
    
    const fromCountry = shipFrom.country?.toUpperCase();
    const toCountry = shipTo.country?.toUpperCase();
    
    return fromCountry === 'CA' && toCountry === 'CA';
};

/**
 * Get tax configuration for a province
 */
export const getTaxConfigForProvince = (province) => {
    if (!province) return null;
    
    const normalizedProvince = province.toUpperCase();
    return CANADIAN_TAX_CONFIG[normalizedProvince] || null;
};

/**
 * Calculate taxes for given amount and province
 */
export const calculateTaxes = (taxableAmount, province) => {
    const taxConfig = getTaxConfigForProvince(province);
    if (!taxConfig) return [];
    
    const taxes = [];
    
    taxConfig.taxes.forEach(tax => {
        const taxAmount = (taxableAmount * tax.rate) / 100;
        
        taxes.push({
            code: tax.code,
            chargeName: tax.name,
            rate: tax.rate,
            amount: taxAmount,
            type: tax.type,
            cost: 0.00, // Taxes have no cost
            charge: taxAmount, // Full tax amount is the charge
            costCurrency: 'CAD',
            chargeCurrency: 'CAD',
            isTax: true,
            taxable: false // Taxes are not taxable
        });
    });
    
    return taxes;
};

/**
 * Calculate total taxable amount from rate breakdown
 */
export const calculateTaxableAmount = (rateBreakdown, chargeTypes) => {
    if (!rateBreakdown || !Array.isArray(rateBreakdown)) {
        console.log('🍁 Canadian Tax: No rate breakdown provided', { rateBreakdown });
        return 0;
    }
    
    let taxableAmount = 0;
    const debugInfo = {
        totalRates: rateBreakdown.length,
        chargeTypesCount: chargeTypes.length,
        rateDetails: [],
        taxableRates: []
    };
    
    rateBreakdown.forEach(rate => {
        // Skip existing tax charges
        if (rate.isTax || isTaxCharge(rate.code)) {
            debugInfo.rateDetails.push({
                code: rate.code,
                chargeName: rate.chargeName,
                amount: rate.charge || rate.actualCharge,
                skipped: 'tax charge'
            });
            return;
        }
        
        // Find charge type to check if taxable
        const chargeType = chargeTypes.find(ct => ct.code === rate.code || ct.value === rate.code);
        const isTaxable = chargeType?.taxable || false;
        
        const chargeAmount = parseFloat(rate.actualCharge || rate.charge || 0);
        
        debugInfo.rateDetails.push({
            code: rate.code,
            chargeName: rate.chargeName,
            amount: chargeAmount,
            chargeTypeFound: !!chargeType,
            chargeTypeTaxable: chargeType?.taxable,
            isTaxable: isTaxable,
            included: isTaxable && chargeAmount > 0
        });
        
        if (isTaxable) {
            taxableAmount += chargeAmount;
            debugInfo.taxableRates.push({
                code: rate.code,
                amount: chargeAmount
            });
        }
    });
    
    console.log('🍁 Canadian Tax: Taxable amount calculation', {
        ...debugInfo,
        finalTaxableAmount: taxableAmount
    });
    
    return taxableAmount;
};

/**
 * Remove existing tax charges from rate breakdown
 */
export const removeTaxCharges = (rateBreakdown) => {
    if (!rateBreakdown || !Array.isArray(rateBreakdown)) return [];
    
    return rateBreakdown.filter(rate => !rate.isTax && !isTaxCharge(rate.code));
};

/**
 * Check if a charge code is a tax charge
 */
export const isTaxCharge = (code) => {
    if (!code) return false;
    
    const taxCodes = [
        'HST', 'GST', 'QST', 'QGST', 'HST ON', 'HST BC', 'HST NB', 
        'HST NS', 'HST NL', 'HST PE', 'PST BC', 'PST SK', 'PST MB'
    ];
    
    return taxCodes.includes(code.toUpperCase());
};

/**
 * Generate tax line items for shipment
 */
export const generateTaxLineItems = (rateBreakdown, province, chargeTypes, nextId = 1) => {
    // Calculate taxable amount
    const taxableAmount = calculateTaxableAmount(rateBreakdown, chargeTypes);
    
    if (taxableAmount <= 0) return [];
    
    // Get taxes for province
    const taxes = calculateTaxes(taxableAmount, province);
    
    // Convert to rate breakdown format
    return taxes.map((tax, index) => ({
        id: nextId + index,
        carrier: '', // Taxes have no carrier
        code: tax.code,
        chargeName: tax.chargeName,
        cost: tax.cost.toFixed(2),
        costCurrency: tax.costCurrency,
        charge: tax.charge.toFixed(2),
        chargeCurrency: tax.chargeCurrency,
        isTax: true,
        taxable: false
    }));
};

/**
 * Update shipment with Canadian taxes
 */
export const updateShipmentWithTaxes = (shipmentData, chargeTypes) => {
    // Check if this is a Canadian domestic shipment
    if (!isCanadianDomesticShipment(shipmentData.shipFrom, shipmentData.shipTo)) {
        return shipmentData;
    }
    
    const province = shipmentData.shipTo?.state;
    if (!province) return shipmentData;
    
    // Process manual rates (QuickShip)
    if (shipmentData.manualRates && Array.isArray(shipmentData.manualRates)) {
        // Remove existing tax charges
        const nonTaxRates = removeTaxCharges(shipmentData.manualRates);
        
        // Calculate next ID
        const nextId = Math.max(...nonTaxRates.map(r => r.id || 0), 0) + 1;
        
        // Generate new tax line items
        const taxLineItems = generateTaxLineItems(nonTaxRates, province, chargeTypes, nextId);
        
        // Update manual rates
        shipmentData.manualRates = [...nonTaxRates, ...taxLineItems];
    }
    
    // Process carrier confirmation rates (if exists)
    if (shipmentData.carrierConfirmationRates && Array.isArray(shipmentData.carrierConfirmationRates)) {
        // Remove existing tax charges
        const nonTaxRates = removeTaxCharges(shipmentData.carrierConfirmationRates);
        
        // Calculate next ID
        const nextId = Math.max(...nonTaxRates.map(r => r.id || 0), 0) + 1;
        
        // Generate new tax line items
        const taxLineItems = generateTaxLineItems(nonTaxRates, province, chargeTypes, nextId);
        
        // Update carrier confirmation rates
        shipmentData.carrierConfirmationRates = [...nonTaxRates, ...taxLineItems];
    }
    
    return shipmentData;
};

/**
 * Validate that all required tax charge types exist in the system
 */
export const validateTaxChargeTypes = (chargeTypes) => {
    const requiredTaxCodes = [
        'HST', 'GST', 'QST', 'HST ON', 'HST BC', 'HST NB', 
        'HST NS', 'HST NL', 'HST PE', 'PST BC', 'PST SK', 'PST MB'
    ];
    
    const existingCodes = chargeTypes.map(ct => ct.code.toUpperCase());
    const missingCodes = requiredTaxCodes.filter(code => !existingCodes.includes(code));
    
    return {
        isValid: missingCodes.length === 0,
        missingCodes
    };
}; 