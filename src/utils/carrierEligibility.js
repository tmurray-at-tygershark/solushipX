/**
 * Carrier Eligibility and Multi-Carrier Rate Fetching System
 * Determines eligible carriers for shipments and fetches rates from multiple carriers
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { toEShipPlusRequest } from '../translators/eshipplus/translator';
import { toCanparRequest } from '../translators/canpar/translator';
import { toPolarisTransportationRequest } from '../translators/polaristransportation/translator';
import { mapEShipPlusToUniversal, mapCanparToUniversal } from './universalDataModel';
import { mapPolarisTransportationToUniversal } from '../translators/polaristransportation/translator';

/**
 * Simple mapping function to normalize shipment types
 * @param {string} shipmentType - Raw shipment type
 * @returns {string} - Normalized shipment type (freight or courier)
 */
function normalizeShipmentType(shipmentType) {
    if (!shipmentType) return 'freight';
    
    const type = shipmentType.toLowerCase();
    
    // Map LTL, FTL, etc. to freight
    if (type.includes('ltl') || type.includes('ftl') || type === 'freight') {
        return 'freight';
    }
    
    // Map parcel, express, ground to courier
    if (type.includes('courier') || type.includes('parcel') || type.includes('express') || type.includes('ground')) {
        return 'courier';
    }
    
    // Default to freight for anything else
    return 'freight';
}

/**
 * Carrier configuration with eligibility rules
 */
const CARRIER_CONFIG = {
    ESHIPPLUS: {
        key: 'ESHIPPLUS',
        name: 'eShipPlus',
        system: 'eshipplus',
        functionName: 'getRatesEShipPlus',
        timeout: 28000, // 28 seconds - eShipPlus can be very slow for complex freight quotes
        translator: {
            toRequest: toEShipPlusRequest,
            fromResponse: mapEShipPlusToUniversal
        },
        eligibility: {
            shipmentTypes: ['freight'],
            countries: ['US', 'CA'],
            modes: ['LTL', 'FTL', 'Air'],
            minWeight: 0,
            maxWeight: 50000,
            routeTypes: ['domestic', 'international'] // Handles both domestic and international
        },
        priority: 1 // Higher priority = preferred carrier
    },
    POLARISTRANSPORTATION: {
        key: 'POLARISTRANSPORTATION',
        name: 'Polaris Transportation',
        system: 'polaristransportation',
        functionName: 'getRatesPolarisTransportation',
        timeout: 25000, // 25 seconds - LTL freight quotes
        translator: {
            toRequest: toPolarisTransportationRequest,
            fromResponse: mapPolarisTransportationToUniversal
        },
        eligibility: {
            shipmentTypes: ['freight'],
            countries: ['US', 'CA'],
            modes: ['LTL'],
            minWeight: 0,
            maxWeight: 45000,
            routeTypes: ['international'] // ONLY international shipments
        },
        priority: 2
    },
    CANPAR: {
        key: 'CANPAR',
        name: 'Canpar',
        system: 'canpar',
        functionName: 'getRatesCanpar',
        timeout: 20000, // 20 seconds - courier/parcel typically faster
        translator: {
            toRequest: toCanparRequest,
            fromResponse: mapCanparToUniversal
        },
        eligibility: {
            shipmentTypes: ['courier', 'freight'],
            countries: ['CA'],
            modes: ['Ground', 'Express', 'LTL'],
            minWeight: 0,
            maxWeight: 10000,
            routeTypes: ['domestic'] // Primarily domestic CA shipments
        },
        priority: 3
    }
};

/**
 * Determine eligible carriers for a shipment
 * @param {Object} shipmentData - Universal shipment data
 * @returns {Array} - Array of eligible carrier configurations
 */
export function getEligibleCarriers(shipmentData) {
    const { shipFrom, shipTo, packages, shipmentInfo } = shipmentData;
    
    // Determine shipment characteristics
    const shipmentType = normalizeShipmentType(shipmentInfo?.shipmentType);
    const originCountry = shipFrom?.country || 'CA';
    const destinationCountry = shipTo?.country || 'CA';
    const totalWeight = packages?.reduce((sum, pkg) => sum + (parseFloat(pkg.weight) || 0), 0) || 0;
    
    // Determine route type (domestic vs international)
    const isInternational = originCountry !== destinationCountry;
    const routeType = isInternational ? 'international' : 'domestic';
    
    console.log('🔍 Multi-Carrier Eligibility Check:', {
        shipmentType,
        route: `${originCountry} → ${destinationCountry}`,
        routeType: routeType + (isInternational ? ' (cross-border)' : ' (same country)'),
        totalWeight: `${totalWeight} lbs`,
        packagesCount: packages?.length || 0
    });
    
    // Filter carriers based on eligibility
    const eligibleCarriers = Object.values(CARRIER_CONFIG).filter(carrier => {
        const { eligibility } = carrier;
        console.log(`\n🧪 Checking ${carrier.name}:`);
        
        // Check shipment type
        if (!eligibility.shipmentTypes.includes(shipmentType)) {
            console.log(`  ❌ Shipment type: ${shipmentType} not in [${eligibility.shipmentTypes.join(', ')}]`);
            return false;
        }
        console.log(`  ✅ Shipment type: ${shipmentType} supported`);
        
        // Check countries
        if (!eligibility.countries.includes(originCountry) || !eligibility.countries.includes(destinationCountry)) {
            console.log(`  ❌ Countries: ${originCountry}->${destinationCountry} not supported by [${eligibility.countries.join(', ')}]`);
            return false;
        }
        console.log(`  ✅ Countries: ${originCountry}->${destinationCountry} supported`);
        
        // Check route type (domestic vs international)
        if (eligibility.routeTypes && !eligibility.routeTypes.includes(routeType)) {
            console.log(`  ❌ Route type: ${routeType} not in [${eligibility.routeTypes.join(', ')}]`);
            return false;
        }
        console.log(`  ✅ Route type: ${routeType} supported`);
        
        // Check weight limits
        if (totalWeight < eligibility.minWeight || totalWeight > eligibility.maxWeight) {
            console.log(`  ❌ Weight: ${totalWeight}lbs outside limits [${eligibility.minWeight}-${eligibility.maxWeight} lbs]`);
            return false;
        }
        console.log(`  ✅ Weight: ${totalWeight}lbs within limits [${eligibility.minWeight}-${eligibility.maxWeight} lbs]`);
        
        console.log(`  🎯 ${carrier.name} is ELIGIBLE (Priority: ${carrier.priority})`);
        return true;
    });
    
    // Sort by priority
    eligibleCarriers.sort((a, b) => a.priority - b.priority);
    
    console.log(`\n🌟 Final Results: ${eligibleCarriers.length} eligible carriers:`, 
        eligibleCarriers.map(c => `${c.name} (P${c.priority})`));
    
    if (eligibleCarriers.length === 0) {
        console.warn('🚨 NO ELIGIBLE CARRIERS FOUND! This will prevent multi-carrier rate fetching.');
        console.log('Troubleshooting info:', {
            shipmentType,
            originCountry,
            destinationCountry,
            routeType,
            totalWeight,
            allCarriers: Object.values(CARRIER_CONFIG).map(c => ({
                name: c.name,
                shipmentTypes: c.eligibility.shipmentTypes,
                countries: c.eligibility.countries,
                routeTypes: c.eligibility.routeTypes || ['any'],
                weightRange: `${c.eligibility.minWeight}-${c.eligibility.maxWeight} lbs`
            }))
        });
    }
    
    return eligibleCarriers;
}

/**
 * Fetch rates from a single carrier
 * @param {Object} carrier - Carrier configuration
 * @param {Object} shipmentData - Universal shipment data
 * @returns {Promise<Object>} - Rate fetch result
 */
async function fetchCarrierRates(carrier, shipmentData) {
    const startTime = Date.now();
    
    try {
        console.log(`🚀 Fetching rates from ${carrier.name}...`);
        
        // Transform request to carrier format
        const carrierRequest = carrier.translator.toRequest(shipmentData);
        
        // Auto-fix missing fields for eShipPlus
        if (carrier.key === 'ESHIPPLUS') {
            if (!carrierRequest.Origin.Contact || carrierRequest.Origin.Contact.trim() === '') {
                carrierRequest.Origin.Contact = 
                    carrierRequest.Origin.Attention || 
                    carrierRequest.Origin.Name || 
                    carrierRequest.Origin.Company || 
                    "Shipping Department";
            }
            
            if (!carrierRequest.Destination.Contact || carrierRequest.Destination.Contact.trim() === '') {
                carrierRequest.Destination.Contact = 
                    carrierRequest.Destination.Attention || 
                    carrierRequest.Destination.Name || 
                    carrierRequest.Destination.Company || 
                    "Receiving Department";
            }
            
            if (!carrierRequest.Origin.SpecialInstructions) {
                carrierRequest.Origin.SpecialInstructions = 'none';
            }
            
            if (!carrierRequest.Destination.SpecialInstructions) {
                carrierRequest.Destination.SpecialInstructions = 'none';
            }
        }
        
        // Call Firebase function with carrier-specific timeout protection
        const functions = getFunctions();
        const getRatesFunction = httpsCallable(functions, carrier.functionName);
        
        // Add timeout protection at Firebase SDK level using carrier-specific timeout
        const firebaseCallPromise = getRatesFunction(carrierRequest);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Firebase function ${carrier.functionName} timeout`)), carrier.timeout)
        );
        
        const result = await Promise.race([firebaseCallPromise, timeoutPromise]);
        
        const responseTime = Date.now() - startTime;
        console.log(`✅ ${carrier.name} responded in ${responseTime}ms`);
        
        const data = result.data;
        
        if (!data) {
            throw new Error(`No data returned from ${carrier.name} API`);
        }
        
        if (data.success && data.data) {
            const availableRates = data.data.availableRates || [];
            
            if (!Array.isArray(availableRates)) {
                throw new Error('Invalid rate data format from server');
            }
            
            // Transform rates to universal format
            const standardizedRates = availableRates.map(rate => {
                let standardizedRate;
                
                try {
                    // Apply carrier-specific mapping
                    if (carrier.key === 'ESHIPPLUS') {
                        standardizedRate = mapEShipPlusToUniversal(rate);
                    } else if (carrier.key === 'CANPAR') {
                        standardizedRate = mapCanparToUniversal(rate);
                    } else if (carrier.key === 'POLARISTRANSPORTATION') {
                        standardizedRate = mapPolarisTransportationToUniversal(rate);
                    } else {
                        // Generic mapping
                        standardizedRate = rate;
                    }
                    
                    // CRITICAL: Add source carrier metadata for proper booking routing
                    standardizedRate.sourceCarrier = {
                        key: carrier.key,
                        name: carrier.name,
                        system: carrier.system
                    };
                    
                    // Preserve original carrier info for display
                    standardizedRate.displayCarrier = {
                        name: standardizedRate.carrier?.name || carrier.name,
                        id: standardizedRate.carrier?.id || carrier.key,
                        scac: standardizedRate.carrier?.scac
                    };
                    
                    return standardizedRate;
                } catch (transformError) {
                    console.warn(`Error transforming rate from ${carrier.name}:`, transformError.message);
                    return null;
                }
            }).filter(Boolean); // Remove null entries
            
            return {
                success: true,
                carrier: carrier.name,
                carrierKey: carrier.key,
                rates: standardizedRates,
                responseTime,
                originalRequest: carrierRequest,
                originalResponse: data.data
            };
        } else {
            const errorMessage = data.error || 
                data?.data?.messages?.map(m => m.Text || m.text).join('; ') || 
                'Unknown API error';
            
            return {
                success: false,
                carrier: carrier.name,
                carrierKey: carrier.key,
                error: errorMessage,
                responseTime,
                rates: []
            };
        }
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`❌ ${carrier.name} failed in ${responseTime}ms:`, error);
        
        // Check for specific Firebase errors
        let errorMessage = error.message;
        if (error.code === 'functions/timeout' || error.message.includes('timeout')) {
            errorMessage = `${carrier.name} request timed out`;
        } else if (error.code === 'functions/unavailable') {
            errorMessage = `${carrier.name} service temporarily unavailable`;
        } else if (error.code === 'functions/internal') {
            errorMessage = `${carrier.name} internal error`;
        }
        
        return {
            success: false,
            carrier: carrier.name,
            carrierKey: carrier.key,
            error: errorMessage,
            responseTime,
            rates: []
        };
    }
}

/**
 * Smart parallel carrier rate fetching with progressive results
 * @param {Object} shipmentData - Universal shipment data
 * @param {Object} options - Fetching options
 * @returns {Promise<Object>} - Combined rate results
 */
export async function fetchMultiCarrierRates(shipmentData, options = {}) {
    console.log('🌟 Starting smart multi-carrier rate fetch...');
    const startTime = Date.now();
    
    // Extract custom eligible carriers from options, or use default eligibility check
    const { customEligibleCarriers, ...otherOptions } = options;
    
    // Get eligible carriers - either custom provided or calculate using system rules
    let eligibleCarriers;
    if (customEligibleCarriers && Array.isArray(customEligibleCarriers)) {
        console.log('🏢 Using custom eligible carriers provided by company filtering:', 
            customEligibleCarriers.map(c => c.name));
        eligibleCarriers = customEligibleCarriers;
    } else {
        console.log('🌐 Using system-wide carrier eligibility rules');
        eligibleCarriers = getEligibleCarriers(shipmentData);
    }
    
    if (eligibleCarriers.length === 0) {
        const errorMessage = customEligibleCarriers 
            ? 'No eligible carriers found for this company - please contact your administrator to configure carriers'
            : 'No eligible carriers found for this shipment';
            
        return {
            success: false,
            error: errorMessage,
            results: [],
            rates: [],
            summary: {
                totalCarriers: 0,
                successfulCarriers: 0,
                failedCarriers: 0,
                totalRates: 0,
                executionTime: Date.now() - startTime
            }
        };
    }
    
    // Calculate realistic timeouts based on eligible carriers
    const maxCarrierTimeout = Math.max(...eligibleCarriers.map(c => c.timeout));
    const avgCarrierTimeout = eligibleCarriers.reduce((sum, c) => sum + c.timeout, 0) / eligibleCarriers.length;
    
    const {
        maxConcurrent = 3,
        individualTimeout = null,           // Will use carrier-specific timeouts
        minResultsTimeout = 8000,           // Wait at least 8 seconds for fast carriers
        maxWaitTime = maxCarrierTimeout + 5000, // Slowest carrier + 5 second buffer (up to 33 seconds for eShipPlus)
        includeFailures = true,
        progressiveResults = true           // Return results as they arrive
    } = otherOptions;
    
    console.log(`🚀 Launching ${eligibleCarriers.length} carrier requests in parallel...`);
    console.log(`⏰ Timeout Strategy: Individual timeouts range from ${Math.min(...eligibleCarriers.map(c => c.timeout))}ms to ${maxCarrierTimeout}ms, max wait: ${maxWaitTime}ms`);
    
    // Create individual carrier fetch promises with carrier-specific timeout handling
    const carrierPromises = eligibleCarriers.map(carrier => {
        return Promise.race([
            fetchCarrierRates(carrier, shipmentData),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`${carrier.name} individual timeout (${carrier.timeout}ms)`)), carrier.timeout)
            )
        ]).catch(error => {
            console.warn(`⚠️ ${carrier.name} failed:`, error.message);
            return {
                success: false,
                carrier: carrier.name,
                carrierKey: carrier.key,
                error: error.message.includes('timeout') ? `${carrier.name} request timed out (${carrier.timeout}ms)` : error.message,
                rates: [],
                responseTime: carrier.timeout
            };
        });
    });
    
    // Use Promise.allSettled to handle partial failures gracefully
    console.log('⚡ Using Promise.allSettled for resilient parallel processing...');
    let results;
    
    try {
        // Set up progressive result handling
        const progressivePromise = Promise.allSettled(carrierPromises);
        const maxWaitPromise = new Promise((resolve) => 
            setTimeout(() => {
                console.log(`⏰ Max wait time (${maxWaitTime}ms) reached, returning partial results...`);
                resolve([]);
            }, maxWaitTime)
        );
        
        // Wait for either all carriers or max wait time
        const settledResults = await Promise.race([progressivePromise, maxWaitPromise]);
        
        if (Array.isArray(settledResults) && settledResults.length > 0) {
            // Extract actual results from Promise.allSettled format
            results = settledResults.map(result => 
                result.status === 'fulfilled' ? result.value : {
                    success: false,
                    carrier: 'Unknown',
                    carrierKey: 'UNKNOWN',
                    error: result.reason?.message || 'Promise rejected',
                    rates: [],
                    responseTime: maxWaitTime
                }
            );
        } else {
            // Max wait time reached, get partial results
            console.log('🔄 Collecting partial results from completed carriers...');
            results = [];
            
            // Check which promises have completed
            for (let i = 0; i < carrierPromises.length; i++) {
                const carrier = eligibleCarriers[i];
                try {
                    // Use Promise.race with immediate timeout to check if promise resolved
                    const partialResult = await Promise.race([
                        carrierPromises[i],
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Still pending')), 100))
                    ]);
                    results.push(partialResult);
                    console.log(`✅ Got partial result from ${carrier.name}`);
                } catch (error) {
                    // Promise still pending or failed
                    results.push({
                        success: false,
                        carrier: carrier.name,
                        carrierKey: carrier.key,
                        error: 'Request still pending or failed',
                        rates: [],
                        responseTime: Date.now() - startTime
                    });
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Smart multi-carrier fetch system error:', error.message);
        return {
            success: false,
            error: 'Multi-carrier system error. Please try again.',
            results: [],
            rates: [],
            summary: {
                totalCarriers: eligibleCarriers.length,
                successfulCarriers: 0,
                failedCarriers: eligibleCarriers.length,
                totalRates: 0,
                executionTime: Date.now() - startTime
            }
        };
    }
    
    // Process results - separate successful from failed
    const allRates = [];
    const successfulResults = [];
    const failedResults = [];
    
    results.forEach(result => {
        if (result && result.success && result.rates && result.rates.length > 0) {
            successfulResults.push(result);
            allRates.push(...result.rates);
            console.log(`✅ SUCCESS: ${result.carrier} returned ${result.rates.length} rates in ${result.responseTime}ms`);
        } else {
            failedResults.push(result);
            const responseTime = result?.responseTime || 'unknown';
            const error = result?.error || 'unknown error';
            console.log(`❌ FAILED: ${result?.carrier || 'Unknown'} - ${error} (${responseTime}ms)`);
        }
    });
    
    // Sort rates by price (lowest first)
    allRates.sort((a, b) => {
        const priceA = a.pricing?.total || a.totalCharges || a.price || 0;
        const priceB = b.pricing?.total || b.totalCharges || b.price || 0;
        return priceA - priceB;
    });
    
    const executionTime = Date.now() - startTime;
    
    // Create enhanced summary
    const summary = {
        totalCarriers: eligibleCarriers.length,
        successfulCarriers: successfulResults.length,
        failedCarriers: failedResults.length,
        totalRates: allRates.length,
        executionTime,
        averageResponseTime: results.length > 0 ? 
            results.reduce((sum, r) => sum + (r?.responseTime || 0), 0) / results.length : 0,
        fastestCarrier: successfulResults.length > 0 ? 
            successfulResults.reduce((fastest, current) => 
                (current.responseTime || Infinity) < (fastest.responseTime || Infinity) ? current : fastest
            ) : null,
        slowestCarrier: successfulResults.length > 0 ? 
            successfulResults.reduce((slowest, current) => 
                (current.responseTime || 0) > (slowest.responseTime || 0) ? current : slowest
            ) : null
    };
    
    console.log(`🎯 Smart multi-carrier fetch completed in ${executionTime}ms:`, summary);
    
    // Enhanced logging with performance metrics
    console.log('\n📊 Carrier Performance Report:');
    results.forEach(result => {
        if (result && result.success) {
            console.log(`✅ ${result.carrier}: ${result.rates.length} rates in ${result.responseTime}ms`);
            if (result.rates.length > 0) {
                const cheapestRate = result.rates.reduce((min, rate) => {
                    const price = rate.pricing?.total || rate.totalCharges || 0;
                    const minPrice = min.pricing?.total || min.totalCharges || Infinity;
                    return price < minPrice ? rate : min;
                }, result.rates[0]);
                const price = cheapestRate.pricing?.total || cheapestRate.totalCharges || 0;
                console.log(`   💰 Best rate: ${cheapestRate.displayCarrier?.name || cheapestRate.carrier?.name} - $${price}`);
            }
        } else if (result) {
            const timeoutIndicator = result.error?.includes('timeout') ? '⏰' : '❌';
            console.log(`${timeoutIndicator} ${result.carrier}: ${result.error} (${result.responseTime}ms)`);
        }
    });
    
    // Enhanced rate blending summary
    if (allRates.length > 0) {
        console.log('\n🔄 Rate Blending Summary:');
        const ratesBySourceCarrier = {};
        allRates.forEach(rate => {
            const sourceCarrier = rate.sourceCarrier?.name || 'Unknown';
            if (!ratesBySourceCarrier[sourceCarrier]) {
                ratesBySourceCarrier[sourceCarrier] = [];
            }
            ratesBySourceCarrier[sourceCarrier].push(rate);
        });

        Object.entries(ratesBySourceCarrier).forEach(([sourceCarrier, rates]) => {
            console.log(`  🏢 ${sourceCarrier}: ${rates.length} rates`);
            rates.slice(0, 3).forEach((rate, index) => { // Show top 3 rates per carrier
                const displayCarrier = rate.displayCarrier?.name || rate.carrier?.name || 'Unknown';
                const price = rate.pricing?.total || rate.totalCharges || 0;
                const transitDays = rate.transit?.days || rate.transitDays || 'N/A';
                console.log(`     ${index + 1}. ${displayCarrier} - $${price} (${transitDays} days)`);
            });
        });
    }

    const isSuccess = allRates.length > 0;
    const errorMessage = !isSuccess ? 
        (failedResults.length > 0 ? 
            `No rates available. Errors: ${failedResults.map(r => `${r.carrier}: ${r.error}`).join('; ')}` : 
            'No rates available from any carrier'
        ) : null;

    return {
        success: isSuccess,
        rates: allRates,
        results: includeFailures ? results : successfulResults,
        summary,
        eligibleCarriers: eligibleCarriers.map(c => ({ key: c.key, name: c.name })),
        error: errorMessage,
        performance: {
            parallelProcessing: true,
            progressiveResults: progressiveResults,
            timeoutStrategy: 'carrier-specific',
            carrierTimeouts: eligibleCarriers.map(c => `${c.name}: ${c.timeout}ms`).join(', '),
            maxWaitTime: `${maxWaitTime}ms total`,
            avgCarrierTimeout: `${Math.round(avgCarrierTimeout)}ms average`,
            slowestCarrierTimeout: `${maxCarrierTimeout}ms (${eligibleCarriers.find(c => c.timeout === maxCarrierTimeout)?.name})`
        }
    };
}

/**
 * Get carrier configuration by key
 * @param {String} carrierKey - Carrier key (e.g., 'ESHIPPLUS')
 * @returns {Object|null} - Carrier configuration
 */
export function getCarrierConfig(carrierKey) {
    return CARRIER_CONFIG[carrierKey] || null;
}

/**
 * Get all available carriers
 * @returns {Array} - Array of all carrier configurations
 */
export function getAllCarriers() {
    return Object.values(CARRIER_CONFIG);
} 