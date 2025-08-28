/**
 * Universal Rating Engine Integration for Frontend
 * Provides unified interface for carrier rate calculations
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const calculateUniversalRates = httpsCallable(functions, 'calculateUniversalRates');
const calculateCarrierRates = httpsCallable(functions, 'calculateCarrierRates');

/**
 * Calculate rates for a specific carrier using the universal engine
 */
export async function calculateCarrierRate(carrierId, shipmentData) {
    try {
        console.log('🌍 Calculating universal rates for carrier:', carrierId);
        
        // Transform QuickShip data to universal format
        const universalShipmentData = transformQuickShipToUniversal(shipmentData);
        
        // Try universal engine first
        const result = await calculateUniversalRates({
            carrierId,
            shipmentData: universalShipmentData
        });

        if (result.data.success) {
            console.log('✅ Universal rate calculation successful:', result.data);
            return {
                success: true,
                carrier: result.data.carrier,
                rateBreakdown: result.data.rateBreakdown,
                totalCharges: result.data.finalTotal,
                currency: result.data.currency,
                transitTime: result.data.transitTime,
                serviceLevel: result.data.serviceLevel,
                metrics: result.data.shipmentMetrics,
                source: 'universal_engine'
            };
        } else {
            console.warn('⚠️ Universal engine not eligible/available, falling back to legacy system');
            
            // Fallback to existing carrier calculation
            const fallbackResult = await calculateCarrierRates({
                carrierId,
                shipmentData: universalShipmentData
            });

            if (fallbackResult.data.success) {
                return {
                    success: true,
                    carrier: fallbackResult.data.carrier,
                    rateBreakdown: fallbackResult.data.rateBreakdown,
                    totalCharges: fallbackResult.data.finalTotal,
                    currency: fallbackResult.data.currency,
                    transitTime: fallbackResult.data.transitTime,
                    source: 'legacy_engine'
                };
            }
        }

        return {
            success: false,
            error: result.data.error || 'Rate calculation failed'
        };

    } catch (error) {
        console.error('❌ Rate calculation error:', error);
        return {
            success: false,
            error: error.message || 'Failed to calculate rates'
        };
    }
}

/**
 * Calculate rates for multiple carriers
 */
export async function calculateMultiCarrierRates(carrierIds, shipmentData) {
    const results = await Promise.allSettled(
        carrierIds.map(carrierId => calculateCarrierRate(carrierId, shipmentData))
    );

    const successfulRates = [];
    const failedCarriers = [];

    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
            successfulRates.push({
                carrierId: carrierIds[index],
                ...result.value
            });
        } else {
            failedCarriers.push({
                carrierId: carrierIds[index],
                error: result.reason?.message || result.value?.error || 'Unknown error'
            });
        }
    });

    return {
        successfulRates: successfulRates.sort((a, b) => a.totalCharges - b.totalCharges), // Sort by price
        failedCarriers,
        totalCarriers: carrierIds.length,
        successCount: successfulRates.length
    };
}

/**
 * Transform QuickShip form data to universal shipment format
 */
function transformQuickShipToUniversal(quickShipData) {
    const {
        shipmentInfo = {},
        packages = [],
        shipFrom = {},
        shipTo = {},
        selectedCarrier = null,
        unitSystem = 'imperial',
        additionalServices = []
    } = quickShipData;

    // Transform packages to universal format
    const universalPackages = packages.map(pkg => ({
        quantity: parseInt(pkg.quantity) || 1,
        weight: parseFloat(pkg.weight) || 0,
        length: parseFloat(pkg.length) || 0,
        width: parseFloat(pkg.width) || 0,
        height: parseFloat(pkg.height) || 0,
        packagingType: pkg.packageType || 'BOX',
        description: pkg.description || 'Package'
    }));

    // Transform addresses
    const origin = {
        street: shipFrom.street || shipFrom.address,
        city: shipFrom.city,
        state: shipFrom.state || shipFrom.province,
        province: shipFrom.province || shipFrom.state,
        postalCode: shipFrom.postalCode,
        country: shipFrom.country || 'CA',
        latitude: shipFrom.latitude,
        longitude: shipFrom.longitude
    };

    const destination = {
        street: shipTo.street || shipTo.address,
        city: shipTo.city,
        state: shipTo.state || shipTo.province,
        province: shipTo.province || shipTo.state,
        postalCode: shipTo.postalCode,
        country: shipTo.country || 'CA',
        latitude: shipTo.latitude,
        longitude: shipTo.longitude
    };

    // Determine shipment type
    const shipmentType = getShipmentTypeFromCarrier(selectedCarrier) || 'freight';
    
    // Determine service level
    const serviceLevel = getServiceLevelFromShipment(shipmentInfo, selectedCarrier) || 'Standard';

    return {
        packages: universalPackages,
        origin,
        destination,
        shipmentType,
        serviceLevel,
        unitSystem,
        additionalServices: transformAdditionalServices(additionalServices),
        shipmentDate: shipmentInfo.shipmentDate || new Date().toISOString(),
        specialInstructions: shipmentInfo.specialInstructions,
        referenceNumbers: extractReferenceNumbers(shipmentInfo)
    };
}

/**
 * Determine shipment type from carrier information
 */
function getShipmentTypeFromCarrier(carrier) {
    if (!carrier) return 'freight';
    
    const carrierName = carrier.name?.toLowerCase() || '';
    
    // Check carrier type indicators
    if (carrierName.includes('courier') || carrierName.includes('express')) {
        return 'courier';
    }
    
    if (carrierName.includes('freight') || carrierName.includes('ltl')) {
        return 'freight';
    }
    
    // Default to freight for QuickShip
    return 'freight';
}

/**
 * Determine service level from shipment data
 */
function getServiceLevelFromShipment(shipmentInfo, carrier) {
    // Check if service level is explicitly set
    if (shipmentInfo.serviceLevel) {
        return shipmentInfo.serviceLevel;
    }
    
    // Infer from carrier name or type
    if (carrier) {
        const carrierName = carrier.name?.toLowerCase() || '';
        
        if (carrierName.includes('express') || carrierName.includes('overnight')) {
            return 'Express';
        }
        
        if (carrierName.includes('economy')) {
            return 'Economy';
        }
    }
    
    // Check if delivery date suggests express service
    if (shipmentInfo.deliveryDate) {
        const deliveryDate = new Date(shipmentInfo.deliveryDate);
        const shipDate = new Date(shipmentInfo.shipmentDate || Date.now());
        const daysDiff = Math.ceil((deliveryDate - shipDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 1) {
            return 'Express';
        }
    }
    
    return 'Standard';
}

/**
 * Transform additional services to universal format
 */
function transformAdditionalServices(services) {
    if (!Array.isArray(services)) return [];
    
    return services.map(service => {
        if (typeof service === 'string') {
            return service;
        }
        
        if (service.name) {
            return service.name;
        }
        
        if (service.code) {
            return service.code;
        }
        
        return 'additional_service';
    });
}

/**
 * Extract reference numbers from shipment info
 */
function extractReferenceNumbers(shipmentInfo) {
    const references = [];
    
    if (shipmentInfo.referenceNumber) {
        references.push(shipmentInfo.referenceNumber);
    }
    
    if (shipmentInfo.customerReferenceNumber) {
        references.push(shipmentInfo.customerReferenceNumber);
    }
    
    if (shipmentInfo.poNumber) {
        references.push(shipmentInfo.poNumber);
    }
    
    if (shipmentInfo.jobNumber) {
        references.push(shipmentInfo.jobNumber);
    }
    
    return references;
}

/**
 * Transform universal rate result back to QuickShip format
 */
export function transformUniversalToQuickShip(universalResult) {
    if (!universalResult.success) {
        return {
            success: false,
            error: universalResult.error
        };
    }

    // Transform rate breakdown to QuickShip manual rates format
    const manualRates = universalResult.rateBreakdown.map((rate, index) => ({
        id: rate.id || index + 1,
        carrier: rate.carrier || 'Auto',
        code: rate.code || 'FRT',
        chargeName: rate.chargeName || 'Freight',
        cost: parseFloat(rate.cost || 0),
        costCurrency: rate.costCurrency || 'CAD',
        charge: parseFloat(rate.charge || 0),
        chargeCurrency: rate.chargeCurrency || 'CAD',
        source: rate.source || 'auto_calculated'
    }));

    // Calculate totals
    const totalCost = manualRates.reduce((sum, rate) => sum + rate.cost, 0);
    const totalCharge = manualRates.reduce((sum, rate) => sum + rate.charge, 0);

    return {
        success: true,
        manualRates,
        totalCost: Math.round(totalCost * 100) / 100,
        totalCharge: Math.round(totalCharge * 100) / 100,
        currency: universalResult.currency || 'CAD',
        transitTime: universalResult.transitTime,
        serviceLevel: universalResult.serviceLevel,
        carrier: universalResult.carrier,
        metrics: universalResult.metrics,
        source: universalResult.source
    };
}

/**
 * Auto-populate QuickShip rates table with carrier rates
 */
export async function autoPopulateQuickShipRates(carrierId, formData, setManualRates, setFormData) {
    try {
        console.log('🔄 Auto-populating rates for carrier:', carrierId);
        
        const result = await calculateCarrierRate(carrierId, formData);
        
        if (result.success) {
            const quickShipResult = transformUniversalToQuickShip(result);
            
            if (quickShipResult.success) {
                // Update manual rates table
                setManualRates(quickShipResult.manualRates);
                
                // Update form data with calculated metrics
                setFormData(prev => ({
                    ...prev,
                    calculatedMetrics: quickShipResult.metrics,
                    autoRateSource: quickShipResult.source,
                    lastRateCalculation: new Date().toISOString()
                }));
                
                return {
                    success: true,
                    message: `Rates automatically calculated using ${quickShipResult.source}`,
                    rateCount: quickShipResult.manualRates.length,
                    totalCharge: quickShipResult.totalCharge,
                    currency: quickShipResult.currency
                };
            }
        }
        
        return {
            success: false,
            error: result.error || 'Failed to calculate rates'
        };
        
    } catch (error) {
        console.error('❌ Auto-populate rates error:', error);
        return {
            success: false,
            error: error.message || 'Auto-population failed'
        };
    }
}

/**
 * Enhanced rate calculation with smart carrier selection
 */
export async function calculateSmartRates(formData, availableCarriers = []) {
    try {
        console.log('🧠 Smart rate calculation for', availableCarriers.length, 'carriers');
        
        if (availableCarriers.length === 0) {
            return {
                success: false,
                error: 'No carriers available for rate calculation'
            };
        }
        
        // Calculate rates for all available carriers
        const carrierIds = availableCarriers.map(carrier => carrier.id);
        const multiCarrierResult = await calculateMultiCarrierRates(carrierIds, formData);
        
        if (multiCarrierResult.successfulRates.length === 0) {
            return {
                success: false,
                error: 'No carriers returned valid rates',
                failedCarriers: multiCarrierResult.failedCarriers
            };
        }
        
        // Return best rate (lowest cost) with all options
        const bestRate = multiCarrierResult.successfulRates[0]; // Already sorted by price
        
        return {
            success: true,
            bestRate: transformUniversalToQuickShip(bestRate),
            allRates: multiCarrierResult.successfulRates.map(transformUniversalToQuickShip),
            comparison: {
                cheapest: multiCarrierResult.successfulRates[0],
                fastest: findFastestRate(multiCarrierResult.successfulRates),
                recommended: findRecommendedRate(multiCarrierResult.successfulRates)
            },
            statistics: {
                totalCarriers: multiCarrierResult.totalCarriers,
                successfulCarriers: multiCarrierResult.successCount,
                failedCarriers: multiCarrierResult.failedCarriers.length,
                priceRange: {
                    min: Math.min(...multiCarrierResult.successfulRates.map(r => r.totalCharges)),
                    max: Math.max(...multiCarrierResult.successfulRates.map(r => r.totalCharges)),
                    average: multiCarrierResult.successfulRates.reduce((sum, r) => sum + r.totalCharges, 0) / multiCarrierResult.successfulRates.length
                }
            }
        };
        
    } catch (error) {
        console.error('❌ Smart rate calculation error:', error);
        return {
            success: false,
            error: error.message || 'Smart rate calculation failed'
        };
    }
}

/**
 * Find fastest transit time
 */
function findFastestRate(rates) {
    return rates.reduce((fastest, current) => {
        const currentDays = parseTransitDays(current.transitTime);
        const fastestDays = parseTransitDays(fastest.transitTime);
        return currentDays < fastestDays ? current : fastest;
    });
}

/**
 * Find recommended rate (balance of price and speed)
 */
function findRecommendedRate(rates) {
    // Score each rate based on price (40%) and speed (60%)
    const scoredRates = rates.map(rate => {
        const priceScore = 1 - (rate.totalCharges - Math.min(...rates.map(r => r.totalCharges))) / 
                          (Math.max(...rates.map(r => r.totalCharges)) - Math.min(...rates.map(r => r.totalCharges)) || 1);
        
        const transitDays = parseTransitDays(rate.transitTime);
        const minDays = Math.min(...rates.map(r => parseTransitDays(r.transitTime)));
        const maxDays = Math.max(...rates.map(r => parseTransitDays(r.transitTime)));
        const speedScore = 1 - (transitDays - minDays) / (maxDays - minDays || 1);
        
        const totalScore = priceScore * 0.4 + speedScore * 0.6;
        
        return { ...rate, score: totalScore };
    });
    
    return scoredRates.sort((a, b) => b.score - a.score)[0];
}

/**
 * Parse transit time string to days
 */
function parseTransitDays(transitTime) {
    if (!transitTime) return 5; // Default assumption
    
    const match = transitTime.match(/(\d+)/);
    return match ? parseInt(match[1]) : 5;
}

/**
 * Validate shipment data for rate calculation
 */
export function validateShipmentForRating(formData) {
    const errors = [];
    
    // Check required addresses
    if (!formData.shipFrom?.postalCode) {
        errors.push('Ship From postal code is required');
    }
    
    if (!formData.shipTo?.postalCode) {
        errors.push('Ship To postal code is required');
    }
    
    // Check packages
    if (!formData.packages || formData.packages.length === 0) {
        errors.push('At least one package is required');
    } else {
        formData.packages.forEach((pkg, index) => {
            if (!pkg.weight || parseFloat(pkg.weight) <= 0) {
                errors.push(`Package ${index + 1}: Weight is required`);
            }
            if (!pkg.length || parseFloat(pkg.length) <= 0) {
                errors.push(`Package ${index + 1}: Length is required`);
            }
            if (!pkg.width || parseFloat(pkg.width) <= 0) {
                errors.push(`Package ${index + 1}: Width is required`);
            }
            if (!pkg.height || parseFloat(pkg.height) <= 0) {
                errors.push(`Package ${index + 1}: Height is required`);
            }
        });
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}
