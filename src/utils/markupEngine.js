/**
 * Markup Application Engine
 * 
 * This module handles the application of markups to carrier rates.
 * It supports both carrier-wide baseline markups and company-specific overrides.
 * 
 * Rate Calculation Flow:
 * 1. Fetch raw rates from carriers (actualRates)
 * 2. Apply carrier-wide baseline markups
 * 3. Apply company-specific markup overrides
 * 4. Return both actualRates and markupRates
 */

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Apply markups to a rate array
 * @param {Array} rates - Array of raw carrier rates
 * @param {string} companyId - Company ID for company-specific markups
 * @param {Object} shipmentData - Shipment data for context matching
 * @returns {Promise<Object>} Object containing actualRates and markupRates
 */
export async function applyMarkupsToRates(rates, companyId, shipmentData) {
    console.log('🎯 Starting markup application process...', {
        rateCount: rates.length,
        companyId,
        shipmentType: shipmentData.shipmentInfo?.shipmentType
    });

    try {
        // Fetch all applicable markups
        const markupRules = await fetchApplicableMarkups(companyId, shipmentData);
        
        console.log(`📋 Found ${markupRules.length} applicable markup rules`);

        const results = {
            actualRates: [...rates], // Preserve original rates
            markupRates: [],
            markupApplicationLog: []
        };

        // Apply markups to each rate
        for (const rate of rates) {
            const { markedUpRate, applicationLog } = await applyMarkupsToSingleRate(
                rate, 
                markupRules, 
                companyId, 
                shipmentData
            );
            
            results.markupRates.push(markedUpRate);
            results.markupApplicationLog.push(...applicationLog);
        }

        console.log(`✅ Markup application completed. ${results.markupRates.length} rates processed`);
        
        return results;

    } catch (error) {
        console.error('❌ Error applying markups:', error);
        // Return original rates if markup application fails
        return {
            actualRates: [...rates],
            markupRates: [...rates], // Fallback to actual rates
            markupApplicationLog: [{
                error: error.message,
                timestamp: new Date().toISOString(),
                fallbackApplied: true
            }]
        };
    }
}

/**
 * Apply markups to a single rate
 * @param {Object} rate - Single rate object
 * @param {Array} markupRules - Array of applicable markup rules
 * @param {string} companyId - Company ID
 * @param {Object} shipmentData - Shipment data
 * @returns {Object} Marked up rate and application log
 */
async function applyMarkupsToSingleRate(rate, markupRules, companyId, shipmentData) {
    const markedUpRate = JSON.parse(JSON.stringify(rate)); // Deep clone
    const applicationLog = [];

    try {
        // Get carrier name for markup matching
        const carrierName = rate.sourceCarrier?.name || rate.carrier?.name || rate.displayCarrier?.name;
        const service = rate.service?.name || rate.service || 'ANY';
        
        console.log(`🔍 Processing rate from ${carrierName} - ${service}`);

        // Find applicable markups for this rate (company-specific first, then carrier-wide)
        const applicableMarkups = findApplicableMarkupsForRate(
            markupRules, 
            carrierName, 
            service, 
            companyId, 
            shipmentData
        );

        console.log(`📊 Found ${applicableMarkups.length} applicable markups for this rate`);

        let totalMarkupPercentage = 0;
        let totalMarkupFixed = 0;
        let appliedMarkups = [];

        // Apply each markup in priority order (company-specific overrides carrier-wide)
        for (const markup of applicableMarkups) {
            const markupResult = calculateMarkupAmount(markedUpRate, markup, shipmentData);
            
            if (markupResult.amount > 0) {
                // Apply the markup to the rate pricing
                applyMarkupToRatePricing(markedUpRate, markupResult);
                
                appliedMarkups.push({
                    markupId: markup.id,
                    markupScope: markup.markupScope,
                    type: markup.type,
                    value: markup.value,
                    variable: markup.variable,
                    calculatedAmount: markupResult.amount,
                    carrier: markup.carrierName || 'ALL',
                    company: markup.fromBusinessName || 'ALL'
                });

                if (markup.type === 'PERCENTAGE') {
                    totalMarkupPercentage += markup.value;
                } else {
                    totalMarkupFixed += markupResult.amount;
                }

                console.log(`✅ Applied ${markup.type} markup: ${markup.value}${markup.type === 'PERCENTAGE' ? '%' : ''} = $${markupResult.amount.toFixed(2)}`);
            }
        }

        // Add markup metadata to the rate
        markedUpRate.markupMetadata = {
            originalTotal: rate.pricing?.total || rate.totalCharges || 0,
            markupTotal: markedUpRate.pricing?.total || markedUpRate.totalCharges || 0,
            totalMarkupAmount: (markedUpRate.pricing?.total || markedUpRate.totalCharges || 0) - (rate.pricing?.total || rate.totalCharges || 0),
            totalMarkupPercentage,
            totalMarkupFixed,
            appliedMarkups,
            companyId,
            processedAt: new Date().toISOString()
        };

        applicationLog.push({
            rateId: rate.id || rate.quoteId,
            carrier: carrierName,
            service,
            originalAmount: rate.pricing?.total || rate.totalCharges || 0,
            markupAmount: markedUpRate.markupMetadata.totalMarkupAmount,
            finalAmount: markedUpRate.pricing?.total || markedUpRate.totalCharges || 0,
            appliedMarkups: appliedMarkups.length,
            timestamp: new Date().toISOString()
        });

        return { markedUpRate, applicationLog };

    } catch (error) {
        console.error('❌ Error applying markup to single rate:', error);
        
        applicationLog.push({
            rateId: rate.id || rate.quoteId,
            error: error.message,
            timestamp: new Date().toISOString()
        });

        return { markedUpRate: rate, applicationLog }; // Return original rate on error
    }
}

/**
 * Fetch applicable markup rules from database
 * @param {string} companyId - Company ID
 * @param {Object} shipmentData - Shipment data for context matching
 * @returns {Promise<Array>} Array of markup rules
 */
async function fetchApplicableMarkups(companyId, shipmentData) {
    try {
        const markupRules = [];

        // Fetch carrier-wide baseline markups
        const carrierMarkupsQuery = query(
            collection(db, 'markups'),
            where('markupScope', '==', 'carrier')
        );
        const carrierMarkupsSnapshot = await getDocs(carrierMarkupsQuery);
        carrierMarkupsSnapshot.docs.forEach(doc => {
            markupRules.push({ id: doc.id, ...doc.data() });
        });

        // Fetch company-specific markups (these override carrier markups)
        const companyMarkupsQuery = query(
            collection(db, 'markups'),
            where('markupScope', '==', 'company'), // Updated from 'business'
            where('fromBusinessId', '==', companyId)
        );
        const companyMarkupsSnapshot = await getDocs(companyMarkupsQuery);
        companyMarkupsSnapshot.docs.forEach(doc => {
            markupRules.push({ id: doc.id, ...doc.data() });
        });

        // Fetch fixed rates that might apply
        const fixedRatesQuery = query(
            collection(db, 'markups'),
            where('markupScope', '==', 'fixedRate')
        );
        const fixedRatesSnapshot = await getDocs(fixedRatesQuery);
        fixedRatesSnapshot.docs.forEach(doc => {
            markupRules.push({ id: doc.id, ...doc.data() });
        });

        // Filter out expired markups
        const currentDate = new Date();
        const activeMarkups = markupRules.filter(markup => {
            if (markup.expiryDate) {
                const expiryDate = new Date(markup.expiryDate);
                return expiryDate > currentDate;
            }
            return true; // No expiry date means active
        });

        console.log(`📋 Fetched ${markupRules.length} total markups, ${activeMarkups.length} active`);
        
        return activeMarkups;

    } catch (error) {
        console.error('❌ Error fetching markup rules:', error);
        return [];
    }
}

/**
 * Find applicable markups for a specific rate
 * @param {Array} markupRules - All markup rules
 * @param {string} carrierName - Carrier name
 * @param {string} service - Service level
 * @param {string} companyId - Company ID
 * @param {Object} shipmentData - Shipment data
 * @returns {Array} Filtered and prioritized markup rules
 */
function findApplicableMarkupsForRate(markupRules, carrierName, service, companyId, shipmentData) {
    const applicableMarkups = markupRules.filter(markup => {
        // Check carrier match
        if (markup.carrierId && markup.carrierId !== 'ANY') {
            const markupCarrierName = markup.carrierName || '';
            if (markupCarrierName.toLowerCase() !== carrierName.toLowerCase()) {
                return false;
            }
        }

        // Check service match
        if (markup.service && markup.service !== 'ANY') {
            if (markup.service.toLowerCase() !== service.toLowerCase()) {
                return false;
            }
        }

        // Check company match for company-specific markups
        if (markup.markupScope === 'company') {
            if (markup.fromBusinessId !== companyId) {
                return false;
            }
        }

        // Check weight ranges if specified
        if (markup.fromWeight || markup.toWeight) {
            const totalWeight = shipmentData.packages?.reduce((sum, pkg) => {
                return sum + (parseFloat(pkg.weight || 0) * parseInt(pkg.packagingQuantity || 1));
            }, 0) || 0;

            if (markup.fromWeight && totalWeight < markup.fromWeight) return false;
            if (markup.toWeight && totalWeight > markup.toWeight) return false;
        }

        // Check geographic conditions if specified
        if (markup.fromCountry || markup.toCountry) {
            const fromCountry = shipmentData.shipFrom?.country || 'CA';
            const toCountry = shipmentData.shipTo?.country || 'CA';

            if (markup.fromCountry && markup.fromCountry !== 'ANY' && markup.fromCountry !== fromCountry) return false;
            if (markup.toCountry && markup.toCountry !== 'ANY' && markup.toCountry !== toCountry) return false;
        }

        return true;
    });

    // Sort by priority: company-specific markups first, then carrier-wide
    return applicableMarkups.sort((a, b) => {
        if (a.markupScope === 'company' && b.markupScope === 'carrier') return -1;
        if (a.markupScope === 'carrier' && b.markupScope === 'company') return 1;
        return 0;
    });
}

/**
 * Calculate markup amount based on markup rule
 * @param {Object} rate - Rate object
 * @param {Object} markup - Markup rule
 * @param {Object} shipmentData - Shipment data
 * @returns {Object} Calculated markup amount and details
 */
function calculateMarkupAmount(rate, markup, shipmentData) {
    const baseAmount = rate.pricing?.total || rate.totalCharges || 0;
    let markupAmount = 0;

    try {
        switch (markup.type) {
            case 'PERCENTAGE':
                markupAmount = baseAmount * (markup.value / 100);
                break;
                
            case 'FIXED_AMOUNT':
                markupAmount = markup.value;
                break;
                
            case 'PER_POUND':
                const totalWeight = shipmentData.packages?.reduce((sum, pkg) => {
                    return sum + (parseFloat(pkg.weight || 0) * parseInt(pkg.packagingQuantity || 1));
                }, 0) || 0;
                markupAmount = totalWeight * markup.value;
                break;
                
            case 'PER_PACKAGE':
                const totalPackages = shipmentData.packages?.reduce((sum, pkg) => {
                    return sum + parseInt(pkg.packagingQuantity || 1);
                }, 0) || 0;
                markupAmount = totalPackages * markup.value;
                break;
                
            default:
                console.warn(`Unknown markup type: ${markup.type}`);
                markupAmount = 0;
        }

        return {
            amount: Math.max(0, markupAmount), // Ensure non-negative
            type: markup.type,
            value: markup.value,
            variable: markup.variable,
            baseAmount
        };

    } catch (error) {
        console.error('Error calculating markup amount:', error);
        return { amount: 0, error: error.message };
    }
}

/**
 * Apply calculated markup to rate pricing structure
 * @param {Object} rate - Rate object to modify
 * @param {Object} markupResult - Calculated markup result
 */
function applyMarkupToRatePricing(rate, markupResult) {
    if (markupResult.amount <= 0) return;

    // Update total charges
    if (rate.pricing?.total !== undefined) {
        rate.pricing.total += markupResult.amount;
    } else if (rate.totalCharges !== undefined) {
        rate.totalCharges += markupResult.amount;
    }

    // Add markup as a separate line item in pricing breakdown
    if (!rate.pricing) rate.pricing = {};
    if (!rate.pricing.breakdown) rate.pricing.breakdown = [];
    
    rate.pricing.breakdown.push({
        name: 'Platform Markup',
        amount: markupResult.amount,
        type: markupResult.type,
        value: markupResult.value
    });

    // Update markup-specific fields
    if (!rate.pricing.markup) rate.pricing.markup = 0;
    rate.pricing.markup += markupResult.amount;
}

/**
 * Get markup summary for a rate
 * @param {Object} rate - Rate with markup metadata
 * @returns {Object} Markup summary
 */
export function getMarkupSummary(rate) {
    if (!rate.markupMetadata) {
        return {
            hasMarkup: false,
            originalAmount: rate.pricing?.total || rate.totalCharges || 0,
            markupAmount: 0,
            finalAmount: rate.pricing?.total || rate.totalCharges || 0,
            markupPercentage: 0
        };
    }

    const { originalTotal, markupTotal, totalMarkupAmount } = rate.markupMetadata;
    
    return {
        hasMarkup: true,
        originalAmount: originalTotal,
        markupAmount: totalMarkupAmount,
        finalAmount: markupTotal,
        markupPercentage: originalTotal > 0 ? (totalMarkupAmount / originalTotal) * 100 : 0,
        appliedMarkups: rate.markupMetadata.appliedMarkups || []
    };
}

/**
 * Check if user can see actual rates (cost)
 * @param {Object} user - User object with role information
 * @returns {boolean} True if user can see actual rates
 */
export function canSeeActualRates(user) {
    const adminRoles = ['admin', 'superadmin', 'super_admin'];
    return adminRoles.includes(user?.role?.toLowerCase());
}

/**
 * Filter rates based on user role
 * @param {Object} rateResults - Results from applyMarkupsToRates
 * @param {Object} user - User object
 * @returns {Array} Filtered rates based on user role
 */
export function filterRatesByUserRole(rateResults, user) {
    if (canSeeActualRates(user)) {
        // Admin users get both actual and markup rates for comparison
        return rateResults.markupRates.map(rate => ({
            ...rate,
            _adminMetadata: {
                actualRate: rateResults.actualRates.find(r => 
                    (r.id || r.quoteId) === (rate.id || rate.quoteId)
                ),
                markupSummary: getMarkupSummary(rate)
            }
        }));
    } else {
        // Regular users only see markup rates
        return rateResults.markupRates;
    }
}

export default {
    applyMarkupsToRates,
    getMarkupSummary,
    canSeeActualRates,
    filterRatesByUserRole
}; 