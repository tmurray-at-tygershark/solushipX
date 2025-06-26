/**
 * Currency formatting utilities for the billing system
 */

export const CURRENCIES = {
    CAD: {
        code: 'CAD',
        symbol: '$',
        name: 'Canadian Dollar'
    },
    USD: {
        code: 'USD', 
        symbol: '$',
        name: 'US Dollar'
    }
};

/**
 * Format currency with thousand separators and currency prefix
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (USD, CAD)
 * @param {boolean} showPrefix - Whether to show currency prefix
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'CAD', showPrefix = true, decimals = 2) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return showPrefix ? `${currency} $0.00` : '$0.00';
    }

    const numericAmount = parseFloat(amount);
    const formatted = numericAmount.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });

    if (showPrefix) {
        return `${currency} $${formatted}`;
    }
    
    return `$${formatted}`;
};

/**
 * Format currency for invoice display (matches the provided invoice design)
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted currency for invoices
 */
export const formatInvoiceCurrency = (amount, currency = 'USD') => {
    return formatCurrency(amount, currency, false, 2);
};

/**
 * Format currency with prefix for admin displays
 * @param {number} amount - The amount to format  
 * @param {string} currency - Currency code
 * @returns {string} Formatted currency with prefix
 */
export const formatCurrencyWithPrefix = (amount, currency = 'CAD') => {
    return formatCurrency(amount, currency, true, 2);
};

/**
 * Parse currency string back to number
 * @param {string} currencyString - Formatted currency string
 * @returns {number} Numeric value
 */
export const parseCurrency = (currencyString) => {
    if (!currencyString) return 0;
    
    // Remove currency symbols and letters, keep numbers, decimals, and minus
    const cleaned = currencyString.replace(/[^-0-9.]/g, '');
    return parseFloat(cleaned) || 0;
};

/**
 * Get currency info by code
 * @param {string} code - Currency code
 * @returns {object} Currency information
 */
export const getCurrencyInfo = (code) => {
    return CURRENCIES[code] || CURRENCIES.CAD;
};

/**
 * Format percentage with proper decimals
 * @param {number} percentage - Percentage value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
export const formatPercentage = (percentage, decimals = 1) => {
    if (percentage === null || percentage === undefined || isNaN(percentage)) {
        return '0.0%';
    }
    
    return `${parseFloat(percentage).toFixed(decimals)}%`;
};

/**
 * Calculate and format tax amount
 * @param {number} subtotal - Subtotal amount
 * @param {number} taxRate - Tax rate (e.g., 0.13 for 13%)
 * @param {string} currency - Currency code
 * @returns {object} Tax calculation with formatted values
 */
export const calculateTax = (subtotal, taxRate = 0.13, currency = 'CAD') => {
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    
    return {
        subtotal: parseFloat(subtotal),
        tax: parseFloat(tax),
        total: parseFloat(total),
        formatted: {
            subtotal: formatCurrency(subtotal, currency, false),
            tax: formatCurrency(tax, currency, false),
            total: formatCurrency(total, currency, false),
            taxRate: formatPercentage(taxRate * 100)
        }
    };
};

/**
 * Format amounts for display in tables with proper alignment
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @param {boolean} compact - Whether to use compact display
 * @returns {string} Formatted amount for tables
 */
export const formatTableAmount = (amount, currency = 'CAD', compact = false) => {
    if (compact && amount >= 1000000) {
        return `${currency} $${(amount / 1000000).toFixed(1)}M`;
    } else if (compact && amount >= 1000) {
        return `${currency} $${(amount / 1000).toFixed(1)}K`;
    }
    
    return formatCurrency(amount, currency, true);
};

export default {
    formatCurrency,
    formatInvoiceCurrency,
    formatCurrencyWithPrefix,
    parseCurrency,
    getCurrencyInfo,
    formatPercentage,
    calculateTax,
    formatTableAmount,
    CURRENCIES
}; 