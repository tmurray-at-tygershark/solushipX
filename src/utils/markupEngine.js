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
                    calculatedAmount: markupResult.amount,
                    carrier: markup.carrierName || 'ALL',
                    company: markup.fromBusinessName || 'ALL',
                    // Only include variable if it's defined
                    ...(markup.variable !== undefined && { variable: markup.variable })
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
            baseAmount,
            // Only include variable if it's defined
            ...(markup.variable !== undefined && { variable: markup.variable })
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

    // Enhanced freight-only markup application
    const freightChargeNames = ['freight', 'base', 'linehaul', 'transportation', 'shipping'];
    let freightChargeFound = false;
    let freightBaseAmount = 0;

    // If billingDetails doesn't exist, create it from existing pricing structure
    if (!rate.billingDetails || !Array.isArray(rate.billingDetails)) {
        console.log('📋 Creating billingDetails structure from existing pricing');
        rate.billingDetails = [];
        
        // Create billing details from the pricing structure
        if (rate.pricing) {
            // Standard breakdown from pricing object
            if (rate.pricing.freight || rate.pricing.freightCharge) {
                rate.billingDetails.push({
                    name: 'Freight Charges',
                    amount: rate.pricing.freight || rate.pricing.freightCharge || 0,
                    category: 'freight'
                });
            }
            
            if (rate.pricing.fuel || rate.pricing.fuelSurcharge) {
                rate.billingDetails.push({
                    name: 'Fuel Surcharge', 
                    amount: rate.pricing.fuel || rate.pricing.fuelSurcharge || 0,
                    category: 'fuel'
                });
            }
            
            if (rate.pricing.service || rate.pricing.serviceCharge) {
                rate.billingDetails.push({
                    name: 'Service Charges',
                    amount: rate.pricing.service || rate.pricing.serviceCharge || 0,
                    category: 'service'
                });
            }
            
            // Add other common charges if they exist
            if (rate.pricing.accessorial) {
                rate.billingDetails.push({
                    name: 'Accessorial Charges',
                    amount: rate.pricing.accessorial || 0,
                    category: 'accessorial'
                });
            }
            
            if (rate.pricing.insurance) {
                rate.billingDetails.push({
                    name: 'Insurance',
                    amount: rate.pricing.insurance || 0,
                    category: 'insurance'
                });
            }
        }
        
        console.log(`📋 Created ${rate.billingDetails.length} billing detail entries from pricing structure`);
    }

    // Find and apply markup to freight charges only
    if (rate.billingDetails && Array.isArray(rate.billingDetails)) {
        for (let detail of rate.billingDetails) {
            const chargeName = (detail.name || '').toLowerCase();
            const chargeCategory = (detail.category || '').toLowerCase();
            const isFreightCharge = freightChargeNames.some(freightName => 
                chargeName.includes(freightName)
            ) || chargeCategory === 'freight';

            if (isFreightCharge) {
                freightBaseAmount = detail.amount || 0;
                const markupAmount = freightBaseAmount * (markupResult.value / 100); // Apply percentage to freight only
                
                // Store original amount as actualAmount
                detail.actualAmount = detail.amount;
                
                // Update the charge amount with markup
                detail.amount = detail.actualAmount + markupAmount;
                
                // Mark this charge as having markup applied
                detail.hasMarkup = true;
                detail.markupPercentage = markupResult.value;
                detail.markupAmount = markupAmount;
                
                freightChargeFound = true;
                console.log(`✅ Applied ${markupResult.value}% markup to ${detail.name}: $${detail.actualAmount} → $${detail.amount}`);
                break; // Only apply to first freight charge found
            }
        }
    }

    // If no freight charge found in billingDetails, apply to total (fallback)
    if (!freightChargeFound) {
        console.log('⚠️ No freight charge found in billingDetails, applying markup to total');
        
        // Store original total
        const originalTotal = rate.pricing?.total || rate.totalCharges || 0;
        
        // Apply markup to total
        if (rate.pricing?.total !== undefined) {
            rate.pricing.total += markupResult.amount;
        } else if (rate.totalCharges !== undefined) {
            rate.totalCharges += markupResult.amount;
        }
        
        // Add markup line item to breakdown
        if (!rate.pricing) rate.pricing = {};
        if (!rate.pricing.breakdown) rate.pricing.breakdown = [];
        
        rate.pricing.breakdown.push({
            name: 'Platform Markup',
            amount: markupResult.amount,
            type: markupResult.type,
            value: markupResult.value,
            actualAmount: 0, // No actual amount for platform markup
            hasMarkup: true
        });
    } else {
        // Recalculate total from billingDetails
        const newTotal = rate.billingDetails.reduce((sum, detail) => sum + (detail.amount || 0), 0);
        
        if (rate.pricing?.total !== undefined) {
            rate.pricing.total = newTotal;
        } else if (rate.totalCharges !== undefined) {
            rate.totalCharges = newTotal;
        }
    }

    // Update markup-specific fields
    if (!rate.pricing) rate.pricing = {};
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

/**
 * Apply markups to a single rate (convenience wrapper)
 * @param {Object} rate - Single rate object
 * @param {string} companyId - Company ID for company-specific markups
 * @param {Object} shipmentData - Optional shipment data for context matching
 * @returns {Promise<Object>} Single marked up rate
 */
export async function applyMarkupToRate(rate, companyId, shipmentData = null) {
    try {
        // Create minimal shipment data if not provided
        const defaultShipmentData = {
            shipmentInfo: { shipmentType: 'freight' },
            packages: [{ weight: 100, packagingQuantity: 1 }],
            shipFrom: { country: 'CA' },
            shipTo: { country: 'CA' }
        };
        
        const dataToUse = shipmentData || defaultShipmentData;
        
        // Call the main function with array of one rate
        const result = await applyMarkupsToRates([rate], companyId, dataToUse);
        
        // Return the single processed rate
        return result.markupRates[0] || rate; // Fallback to original rate if processing fails
        
    } catch (error) {
        console.error('❌ Error in applyMarkupToRate wrapper:', error);
        return rate; // Return original rate on error
    }
}

export default {
    applyMarkupsToRates,
    getMarkupSummary,
    canSeeActualRates,
    filterRatesByUserRole,
    applyMarkupToRate
}; 