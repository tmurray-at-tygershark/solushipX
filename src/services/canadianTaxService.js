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
// Normalize province input to 2-letter code (handles full names and casing)
const PROVINCE_NAME_TO_CODE = {
    'ONTARIO': 'ON',
    'BRITISH COLUMBIA': 'BC',
    'ALBERTA': 'AB',
    'SASKATCHEWAN': 'SK',
    'MANITOBA': 'MB',
    'QUEBEC': 'QC',
    'NOVA SCOTIA': 'NS',
    'NEW BRUNSWICK': 'NB',
    'NEWFOUNDLAND AND LABRADOR': 'NL',
    'NEWFOUNDLAND': 'NL',
    'PRINCE EDWARD ISLAND': 'PE',
    'YUKON': 'YT',
    'NORTHWEST TERRITORIES': 'NT',
    'NUNAVUT': 'NU'
};

export const getTaxConfigForProvince = (province) => {
    if (!province) return null;

    const raw = String(province).trim();
    const upper = raw.toUpperCase();

    // If already a known 2-letter code
    if (CANADIAN_TAX_CONFIG[upper]) {
        return CANADIAN_TAX_CONFIG[upper];
    }

    // Try mapping a full province name to code
    const code = PROVINCE_NAME_TO_CODE[upper];
    if (code && CANADIAN_TAX_CONFIG[code]) {
        return CANADIAN_TAX_CONFIG[code];
    }

    // Last resort: strip non-letters and re-check (handles cases like "ON ")
    const lettersOnly = upper.replace(/[^A-Z]/g, '');
    if (CANADIAN_TAX_CONFIG[lettersOnly]) {
        return CANADIAN_TAX_CONFIG[lettersOnly];
    }

    return null;
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
 * Calculate total taxable amount from rate breakdown (legacy - based on actual with quoted fallback)
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
        
        const chargeAmount = parseFloat(
            (rate.actualCharge ?? rate.actualAmount ?? null) != null
                ? (rate.actualCharge ?? rate.actualAmount)
                : (rate.quotedCharge ?? rate.charge ?? 0)
        );
        
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
 * Calculate taxable amounts for both quoted and actual columns
 * - quotedTaxable: sum of quotedCharge (or charge) for taxable, non-tax lines
 * - actualTaxable: sum of actualCharge when provided, otherwise quotedCharge (or charge)
 */
export const calculateTaxableAmounts = (rateBreakdown, chargeTypes) => {
    if (!rateBreakdown || !Array.isArray(rateBreakdown)) {
        return { quotedTaxable: 0, actualTaxable: 0 };
    }

    let quotedTaxable = 0;
    let actualTaxable = 0;

    rateBreakdown.forEach(rate => {
        if (rate.isTax || isTaxCharge(rate.code)) return;

        const chargeType = chargeTypes.find(ct => ct.code === rate.code || ct.value === rate.code);
        // Default to taxable when charge type metadata is missing
        const isTaxable = chargeType ? (chargeType.taxable ?? true) : true;
        if (!isTaxable) return;

        const safeParse = (v) => {
            const n = parseFloat(v);
            return Number.isFinite(n) ? n : 0;
        };

        const quoted = safeParse((rate.quotedCharge ?? rate.charge ?? 0));
        const actual = safeParse((rate.actualCharge ?? rate.actualAmount ?? null) != null ? (rate.actualCharge ?? rate.actualAmount) : quoted);

        quotedTaxable += quoted;
        actualTaxable += actual;
    });

    return { quotedTaxable, actualTaxable };
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
    // Calculate taxable bases for quoted and actual
    const { quotedTaxable, actualTaxable } = calculateTaxableAmounts(rateBreakdown, chargeTypes);

    // Determine tax definitions (always return rows for domestic provinces, even if amount is 0)
    const taxDefs = getTaxConfigForProvince(province)?.taxes || [];

    // Build tax line items with both quoted and actual columns populated
    return taxDefs.map((tax, index) => {
        const baseQuoted = Number.isFinite(quotedTaxable) ? quotedTaxable : 0;
        const baseActual = Number.isFinite(actualTaxable) ? actualTaxable : 0;
        const quotedTax = (baseQuoted * tax.rate) / 100;
        const actualTax = (baseActual * tax.rate) / 100;

        return {
            id: nextId + index,
            carrier: '',
            code: tax.code,
            // Provide multiple friendly name fields so all UIs can render label
            chargeName: tax.name,
            description: tax.name,
            name: tax.name,
            // Legacy fields
            // Taxes now populate both cost and charge so quoted/actual columns can each display values
            cost: Number.isFinite(quotedTax) ? quotedTax.toFixed(2) : '0.00',
            costCurrency: 'CAD',
            charge: Number.isFinite(quotedTax) ? quotedTax.toFixed(2) : '0.00',
            chargeCurrency: 'CAD',
            currency: 'CAD',
            // New explicit columns
            quotedCharge: Number.isFinite(quotedTax) ? quotedTax : 0,
            actualCharge: Number.isFinite(actualTax) ? actualTax : 0,
            quotedCost: Number.isFinite(quotedTax) ? quotedTax : 0,
            actualCost: Number.isFinite(actualTax) ? actualTax : 0,
            isTax: true,
            taxable: false,
            // Enable persistence/editing of identifiers on tax lines
            invoiceNumber: '-',
            ediNumber: '-'
        };
    });
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