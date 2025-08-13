/**
 * Tax Calculator Utility
 * Handles tax calculations and integration with shipment data
 */

import { 
    isCanadianDomesticShipment, 
    generateTaxLineItems, 
    removeTaxCharges, 
    calculateTaxableAmount,
    isTaxCharge
} from '../services/canadianTaxService';

/**
 * Recalculate taxes for a shipment when rates or destination changes
 */
export const recalculateShipmentTaxes = (shipmentData, chargeTypes) => {
    console.log('🍁 Canadian Tax: recalculateShipmentTaxes called', {
        shipFrom: shipmentData.shipFrom?.country,
        shipTo: shipmentData.shipTo?.country,
        province: shipmentData.shipTo?.state,
        manualRatesCount: shipmentData.manualRates?.length || 0,
        chargeTypesCount: chargeTypes?.length || 0
    });

    // Check if this is a Canadian domestic shipment
    if (!isCanadianDomesticShipment(shipmentData.shipFrom, shipmentData.shipTo)) {
        console.log('🍁 Canadian Tax: Not a Canadian domestic shipment, removing any existing taxes');
        // Remove any existing tax charges for non-Canadian shipments
        return removeAllTaxCharges(shipmentData);
    }

    const province = shipmentData.shipTo?.state;
    if (!province) {
        console.log('🍁 Canadian Tax: No destination province, removing any existing taxes');
        return removeAllTaxCharges(shipmentData);
    }

    console.log('🍁 Canadian Tax: Processing Canadian domestic shipment', {
        province: province,
        hasManualRates: !!(shipmentData.manualRates && Array.isArray(shipmentData.manualRates))
    });

    // Update manual rates
    if (shipmentData.manualRates && Array.isArray(shipmentData.manualRates)) {
        const originalCount = shipmentData.manualRates.length;
        shipmentData.manualRates = recalculateRateArrayTaxes(
            shipmentData.manualRates, 
            province, 
            chargeTypes,
            { shipmentType: shipmentData?.shipmentInfo?.shipmentType || shipmentData?.shipmentType }
        );
        console.log('🍁 Canadian Tax: Manual rates updated', {
            originalCount: originalCount,
            newCount: shipmentData.manualRates.length
        });
    }

    // Update carrier confirmation rates
    if (shipmentData.carrierConfirmationRates && Array.isArray(shipmentData.carrierConfirmationRates)) {
        const originalCount = shipmentData.carrierConfirmationRates.length;
        shipmentData.carrierConfirmationRates = recalculateRateArrayTaxes(
            shipmentData.carrierConfirmationRates, 
            province, 
            chargeTypes,
            { shipmentType: shipmentData?.shipmentInfo?.shipmentType || shipmentData?.shipmentType }
        );
        console.log('🍁 Canadian Tax: Carrier confirmation rates updated', {
            originalCount: originalCount,
            newCount: shipmentData.carrierConfirmationRates.length
        });
    }

    return shipmentData;
};

/**
 * Recalculate taxes for a rate array
 */
export const recalculateRateArrayTaxes = (rateArray, province, chargeTypes, options = {}) => {
    if (!rateArray || !Array.isArray(rateArray)) return [];

    // Capture existing tax metadata (invoice/edi) so we can preserve it across recalculations
    const existingTaxMetaByCode = (rateArray || [])
        .filter(rate => rate.isTax || isTaxCharge(rate.code))
        .reduce((map, rate) => {
            const code = String(rate.code || '').toUpperCase();
            if (!code) return map;
            map[code] = {
                invoiceNumber: rate.invoiceNumber ?? '-',
                ediNumber: rate.ediNumber ?? '-'
            };
            return map;
        }, {});

    // Remove existing tax charges
    const nonTaxRates = removeTaxCharges(rateArray);

    // Calculate next numeric ID for new tax items (ignore non-numeric IDs)
    const numericIds = nonTaxRates
        .map(r => {
            const n = Number(r.id);
            return Number.isFinite(n) ? n : null;
        })
        .filter(n => n != null);
    const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
    const nextId = maxId + 1;

    // Generate new tax line items (will return rows even when taxable base is zero)
    let taxLineItems = generateTaxLineItems(nonTaxRates, province, chargeTypes, { nextId, shipmentType: options.shipmentType });

    // Merge preserved invoice/edi numbers from previously existing tax rows
    taxLineItems = taxLineItems.map(item => {
        const code = String(item.code || '').toUpperCase();
        const preserved = existingTaxMetaByCode[code];
        return preserved ? { ...item, invoiceNumber: preserved.invoiceNumber, ediNumber: preserved.ediNumber } : { ...item, invoiceNumber: item.invoiceNumber ?? '-', ediNumber: item.ediNumber ?? '-' };
    });

    // Return combined rates
    return [...nonTaxRates, ...taxLineItems];
};

/**
 * Remove all tax charges from shipment data
 */
export const removeAllTaxCharges = (shipmentData) => {
    if (shipmentData.manualRates && Array.isArray(shipmentData.manualRates)) {
        shipmentData.manualRates = removeTaxCharges(shipmentData.manualRates);
    }

    if (shipmentData.carrierConfirmationRates && Array.isArray(shipmentData.carrierConfirmationRates)) {
        shipmentData.carrierConfirmationRates = removeTaxCharges(shipmentData.carrierConfirmationRates);
    }

    return shipmentData;
};

/**
 * Calculate tax-exclusive total for carrier confirmations
 * (Taxes should not appear in carrier confirmation totals)
 */
export const calculateCarrierConfirmationTotal = (rateArray) => {
    if (!rateArray || !Array.isArray(rateArray)) return 0;

    return rateArray
        .filter(rate => !rate.isTax && !isTaxCharge(rate.code))
        .reduce((total, rate) => {
            const charge = parseFloat(rate.actualCharge || rate.charge || 0);
            return total + charge;
        }, 0);
};

/**
 * Calculate customer total including taxes
 */
export const calculateCustomerTotal = (rateArray) => {
    if (!rateArray || !Array.isArray(rateArray)) return 0;

    return rateArray.reduce((total, rate) => {
        const charge = parseFloat(rate.actualCharge || rate.charge || 0);
        return total + charge;
    }, 0);
};

/**
 * Get tax summary for display
 */
export const getTaxSummary = (rateArray) => {
    if (!rateArray || !Array.isArray(rateArray)) return null;

    const taxCharges = rateArray.filter(rate => rate.isTax || isTaxCharge(rate.code));
    
    if (taxCharges.length === 0) return null;

    const totalTax = taxCharges.reduce((total, tax) => {
        const charge = parseFloat(tax.actualCharge || tax.charge || 0);
        return total + charge;
    }, 0);

    return {
        taxCharges,
        totalTax,
        hasMultipleTaxes: taxCharges.length > 1
    };
};

/**
 * Validate tax calculation logic
 */
export const validateTaxCalculation = (shipmentData, chargeTypes) => {
    const errors = [];

    // Check if Canadian domestic shipment has destination province
    if (isCanadianDomesticShipment(shipmentData.shipFrom, shipmentData.shipTo)) {
        if (!shipmentData.shipTo?.state) {
            errors.push('Canadian domestic shipment missing destination province for tax calculation');
        }
    }

    // Check for duplicate tax codes
    if (shipmentData.manualRates) {
        const taxCodes = shipmentData.manualRates
            .filter(rate => rate.isTax || isTaxCharge(rate.code))
            .map(rate => rate.code);
        
        const duplicates = taxCodes.filter((code, index) => taxCodes.indexOf(code) !== index);
        if (duplicates.length > 0) {
            errors.push(`Duplicate tax codes found: ${duplicates.join(', ')}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Helper function to update a single rate item and recalculate taxes
 */
export const updateRateAndRecalculateTaxes = (rateArray, updatedRate, province, chargeTypes) => {
    // Update the specific rate
    const updatedRates = rateArray.map(rate => 
        rate.id === updatedRate.id ? { ...rate, ...updatedRate } : rate
    );

    // If this was a tax charge, don't recalculate (user is editing tax directly)
    if (updatedRate.isTax || isTaxCharge(updatedRate.code)) {
        return updatedRates;
    }

    // Recalculate taxes for the updated rates
    return recalculateRateArrayTaxes(updatedRates, province, chargeTypes);
};

/**
 * Add a new rate item and recalculate taxes
 */
export const addRateAndRecalculateTaxes = (rateArray, newRate, province, chargeTypes) => {
    // Add the new rate
    const updatedRates = [...rateArray, newRate];

    // If this was a tax charge, don't recalculate
    if (newRate.isTax || isTaxCharge(newRate.code)) {
        return updatedRates;
    }

    // Recalculate taxes
    return recalculateRateArrayTaxes(updatedRates, province, chargeTypes);
};

/**
 * Remove a rate item and recalculate taxes
 */
export const removeRateAndRecalculateTaxes = (rateArray, rateId, province, chargeTypes) => {
    // Find the rate being removed
    const rateToRemove = rateArray.find(rate => rate.id === rateId);
    
    // Remove the rate
    const updatedRates = rateArray.filter(rate => rate.id !== rateId);

    // If this was a tax charge, don't recalculate (just remove it)
    if (rateToRemove && (rateToRemove.isTax || isTaxCharge(rateToRemove.code))) {
        return updatedRates;
    }

    // Recalculate taxes
    return recalculateRateArrayTaxes(updatedRates, province, chargeTypes);
}; 