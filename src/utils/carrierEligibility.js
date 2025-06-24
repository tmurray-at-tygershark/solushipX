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
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

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
        timeout: 50000, // 50 seconds - eShipPlus can be very slow for complex freight quotes, Firebase function has 45s timeout
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
 * Enhanced carrier service that combines database carriers with static config
 */
class CarrierEligibilityService {
    constructor() {
        this.databaseCarriers = new Map();
        this.lastFetch = null;
        this.cacheTimeout = 30 * 1000; // 30 seconds cache for faster admin updates
    }

    /**
     * Fetch and cache carriers from database
     */
    async fetchDatabaseCarriers() {
        const now = Date.now();
        if (this.lastFetch && (now - this.lastFetch) < this.cacheTimeout) {
            return; // Use cached data
        }

        try {
            console.log('🔄 Fetching carriers from database...');
            const carriersRef = collection(db, 'carriers');
            const q = query(carriersRef, where('enabled', '==', true));
            const querySnapshot = await getDocs(q);

            this.databaseCarriers.clear();
            querySnapshot.forEach((doc) => {
                const carrierData = { id: doc.id, ...doc.data() };
                this.databaseCarriers.set(carrierData.carrierID, carrierData);
            });

            this.lastFetch = now;
            console.log(`✅ Loaded ${this.databaseCarriers.size} carriers from database`);
        } catch (error) {
            console.error('❌ Failed to fetch carriers from database:', error);
            // Continue with static carriers if database fetch fails
        }
    }

    /**
     * Get all carriers (database + static) with proper eligibility structure
     */
    async getAllCarriers() {
        await this.fetchDatabaseCarriers();

        const allCarriers = [];

        // Add database carriers with enhanced eligibility rules
        for (const [carrierID, carrierData] of this.databaseCarriers) {
            const enhancedCarrier = this.convertDatabaseCarrierToEligibilityFormat(carrierData);
            allCarriers.push(enhancedCarrier);
        }

        // Add static carriers (for backward compatibility)
        const staticCarriers = Object.values(CARRIER_CONFIG);
        for (const staticCarrier of staticCarriers) {
            // Only add if not already in database carriers
            if (!this.databaseCarriers.has(staticCarrier.key)) {
                allCarriers.push(staticCarrier);
            }
        }

        return allCarriers;
    }

    /**
     * Convert database carrier to eligibility format
     */
    convertDatabaseCarrierToEligibilityFormat(carrierData) {
        const { 
            carrierID, 
            name, 
            type, 
            connectionType, 
            supportedServices, 
            eligibilityRules,
            apiCredentials 
        } = carrierData;

        // Build eligibility object from database structure
        const eligibility = this.buildEligibilityFromRules(carrierData);

        // Determine function name and system based on connection type
        let functionName = null;
        let system = null;
        let translator = null;

        if (connectionType === 'api' && apiCredentials) {
            // Map known API carriers to their functions
            const apiMappings = {
                'ESHIPPLUS': {
                    functionName: 'getRatesEShipPlus',
                    system: 'eshipplus',
                    translator: CARRIER_CONFIG.ESHIPPLUS?.translator
                },
                'CANPAR': {
                    functionName: 'getRatesCanpar',
                    system: 'canpar',
                    translator: CARRIER_CONFIG.CANPAR?.translator
                },
                'POLARISTRANSPORTATION': {
                    functionName: 'getRatesPolarisTransportation',
                    system: 'polaristransportation',
                    translator: CARRIER_CONFIG.POLARISTRANSPORTATION?.translator
                }
            };

            const mapping = apiMappings[carrierID];
            if (mapping) {
                functionName = mapping.functionName;
                system = mapping.system;
                translator = mapping.translator;
            }
        }

        return {
            key: carrierID,
            name: name,
            system: system,
            functionName: functionName,
            timeout: this.calculateTimeout(type, connectionType),
            translator: translator,
            eligibility: eligibility,
            priority: this.calculatePriority(carrierData),
            connectionType: connectionType,
            carrierType: type,
            databaseId: carrierData.id,
            isCustomCarrier: true
        };
    }

    /**
     * Build eligibility rules from database carrier configuration
     */
    buildEligibilityFromRules(carrierData) {
        const { type, supportedServices, eligibilityRules } = carrierData;
        
        // Determine supported shipment types from services
        const shipmentTypes = [];
        if (supportedServices?.courier?.length > 0) {
            shipmentTypes.push('courier');
        }
        if (supportedServices?.freight?.length > 0) {
            shipmentTypes.push('freight');
        }

        // Build countries from geographic routing
        const countries = new Set();
        if (eligibilityRules?.geographicRouting?.domesticCanada) {
            countries.add('CA');
        }
        if (eligibilityRules?.geographicRouting?.domesticUS) {
            countries.add('US');
        }

        // Add countries from specific routing rules
        const geoRouting = eligibilityRules?.geographicRouting || {};
        
        // From province/state routing
        [
            ...(geoRouting.provinceProvinceRouting || []),
            ...(geoRouting.stateStateRouting || []),
            ...(geoRouting.provinceStateRouting || [])
        ].forEach(route => {
            if (route.from) {
                // Determine country from province/state code
                countries.add(this.getCountryFromProvinceState(route.from));
            }
            if (route.to) {
                countries.add(this.getCountryFromProvinceState(route.to));
            }
        });

        // From country-to-country routing
        (geoRouting.countryCountryRouting || []).forEach(route => {
            if (route.from) countries.add(route.from);
            if (route.to) countries.add(route.to);
        });

        // From city routing (extract countries from complete address info)
        [
            ...(geoRouting.provinceStateCityRouting || []),
            ...(geoRouting.cityPairRouting || [])
        ].forEach(route => {
            if (route.fromCountry) countries.add(route.fromCountry);
            if (route.toCountry) countries.add(route.toCountry);
        });

        // Determine route types
        const routeTypes = [];
        const countriesArray = Array.from(countries);
        
        if (countriesArray.length === 1) {
            routeTypes.push('domestic');
        } else if (countriesArray.length > 1) {
            routeTypes.push('domestic', 'international');
        }

        // Calculate weight limits from weight restrictions
        let minWeight = 0;
        let maxWeight = 50000; // Default max

        const weightRestrictions = eligibilityRules?.weightRanges?.weightRestrictions || 
                                   eligibilityRules?.weightRanges || [];
        
        if (weightRestrictions.totalWeight?.length > 0) {
            const weights = weightRestrictions.totalWeight.map(w => ({
                min: parseFloat(w.minWeight) || 0,
                max: parseFloat(w.maxWeight) || 50000
            }));
            minWeight = Math.min(...weights.map(w => w.min));
            maxWeight = Math.max(...weights.map(w => w.max));
        }

        // Build modes from supported services
        const modes = [];
        if (supportedServices?.courier?.length > 0) {
            modes.push('Ground', 'Express', 'Air');
        }
        if (supportedServices?.freight?.length > 0) {
            modes.push('LTL', 'FTL');
        }

        return {
            shipmentTypes: shipmentTypes,
            countries: Array.from(countries),
            modes: modes,
            minWeight: minWeight,
            maxWeight: maxWeight,
            routeTypes: routeTypes
        };
    }

    /**
     * Get country from province/state code
     */
    getCountryFromProvinceState(code) {
        const canadianProvinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
        const usStates = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];
        
        if (canadianProvinces.includes(code)) return 'CA';
        if (usStates.includes(code)) return 'US';
        return 'CA'; // Default fallback
    }

    /**
     * Calculate timeout based on carrier type and connection
     */
    calculateTimeout(type, connectionType) {
        if (connectionType === 'manual') return 5000; // Manual carriers don't need API timeouts
        
        // API carriers - adjust based on type
        switch (type) {
            case 'courier': return 20000; // 20 seconds for courier
            case 'freight': return 45000; // 45 seconds for freight
            case 'hybrid': return 35000;  // 35 seconds for hybrid
            default: return 25000;
        }
    }

    /**
     * Calculate priority (lower = higher priority)
     */
    calculatePriority(carrierData) {
        // Database carriers get priority based on type and order
        switch (carrierData.type) {
            case 'courier': return 10;
            case 'freight': return 20;
            case 'hybrid': return 15;
            default: return 30;
        }
    }

    /**
     * Enhanced eligibility check for database carriers
     */
    async checkCarrierEligibility(carrierData, shipmentData) {
        const { shipFrom, shipTo, packages, shipmentInfo } = shipmentData;
        const { eligibilityRules, supportedServices, type } = carrierData;

        // Basic shipment characteristics
        const shipmentType = normalizeShipmentType(shipmentInfo?.shipmentType);
        const originCountry = shipFrom?.country || 'CA';
        const destinationCountry = shipTo?.country || 'CA';
        const totalWeight = packages?.reduce((sum, pkg) => sum + (parseFloat(pkg.weight) || 0), 0) || 0;
        const isInternational = originCountry !== destinationCountry;

        console.log(`\n🔍 Checking ${carrierData.name} eligibility (Database Carrier):`);

        // 1. Check supported services
        const hasCompatibleServices = this.checkServiceCompatibility(supportedServices, shipmentType);
        if (!hasCompatibleServices) {
            console.log(`  ❌ Services: ${shipmentType} not supported`);
            return false;
        }
        console.log(`  ✅ Services: ${shipmentType} supported`);

        // 2. Check geographic eligibility
        const isGeographicallyEligible = this.checkGeographicEligibility(eligibilityRules?.geographicRouting, shipFrom, shipTo, isInternational);
        if (!isGeographicallyEligible) {
            console.log(`  ❌ Geography: Route not supported`);
            return false;
        }
        console.log(`  ✅ Geography: Route supported`);

        // 3. Check weight restrictions
        const isWeightEligible = this.checkWeightEligibility(eligibilityRules?.weightRanges, totalWeight, packages);
        if (!isWeightEligible) {
            console.log(`  ❌ Weight: ${totalWeight}lbs not within limits`);
            return false;
        }
        console.log(`  ✅ Weight: ${totalWeight}lbs within limits`);

        // 4. Check dimension restrictions
        const isDimensionEligible = this.checkDimensionEligibility(eligibilityRules?.dimensionRestrictions, packages);
        if (!isDimensionEligible) {
            console.log(`  ❌ Dimensions: Package dimensions exceed limits`);
            return false;
        }
        console.log(`  ✅ Dimensions: Within limits`);

        console.log(`  🎯 ${carrierData.name} is ELIGIBLE (Database Carrier)`);
        return true;
    }

    /**
     * Check service compatibility
     */
    checkServiceCompatibility(supportedServices, shipmentType) {
        console.log('    📦 Service compatibility check:', {
            shipmentType,
            hasServices: !!supportedServices,
            courierServices: supportedServices?.courier?.length || 0,
            freightServices: supportedServices?.freight?.length || 0
        });

        if (!supportedServices) {
            console.log('    ❌ No supported services defined');
            return false;
        }
        
        switch (shipmentType) {
            case 'courier':
                const hasCourierServices = supportedServices.courier && supportedServices.courier.length > 0;
                console.log(`    📮 Courier check: ${hasCourierServices ? '✅' : '❌'} (${supportedServices.courier?.length || 0} services)`);
                if (supportedServices.courier) {
                    console.log('    📋 Available courier services:', supportedServices.courier);
                }
                return hasCourierServices;
            case 'freight':
                const hasFreightServices = supportedServices.freight && supportedServices.freight.length > 0;
                console.log(`    🚛 Freight check: ${hasFreightServices ? '✅' : '❌'} (${supportedServices.freight?.length || 0} services)`);
                if (supportedServices.freight) {
                    console.log('    📋 Available freight services:', supportedServices.freight.slice(0, 5), supportedServices.freight.length > 5 ? `... and ${supportedServices.freight.length - 5} more` : '');
                }
                return hasFreightServices;
            default:
                console.log(`    ❌ Unknown shipment type: ${shipmentType}`);
                return false;
        }
    }

    /**
     * Normalize country codes to standard 2-letter format
     */
    normalizeCountryCode(country) {
        if (!country) return 'CA'; // Default to Canada
        
        const countryUpper = country.toString().toUpperCase();
        
        // Handle various formats for Canada
        if (['CA', 'CAN', 'CANADA'].includes(countryUpper)) {
            return 'CA';
        }
        
        // Handle various formats for USA
        if (['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(countryUpper)) {
            return 'US';
        }
        
        // Handle various formats for Mexico
        if (['MX', 'MEX', 'MEXICO'].includes(countryUpper)) {
            return 'MX';
        }
        
        // Return as-is if already 2-letter code or unknown
        return countryUpper.length === 2 ? countryUpper : country;
    }

    /**
     * Check geographic eligibility
     */
    checkGeographicEligibility(geographicRouting, shipFrom, shipTo, isInternational) {
        console.log('    🗺️ Geographic eligibility check:', {
            hasRouting: !!geographicRouting,
            isInternational,
            rawOriginCountry: shipFrom?.country,
            rawDestinationCountry: shipTo?.country
        });

        if (!geographicRouting) {
            console.log('    ✅ No geographic restrictions = eligible');
            return true; // No restrictions = eligible
        }

        // Normalize country codes to standard format
        const originCountry = this.normalizeCountryCode(shipFrom?.country);
        const destinationCountry = this.normalizeCountryCode(shipTo?.country);
        
        console.log('    🔄 Country normalization:', {
            origin: `${shipFrom?.country} → ${originCountry}`,
            destination: `${shipTo?.country} → ${destinationCountry}`
        });
        const originProvState = shipFrom?.state || shipFrom?.province;
        const destinationProvState = shipTo?.state || shipTo?.province;
        const originCity = shipFrom?.city;
        const destinationCity = shipTo?.city;

        console.log('    📍 Route details:', {
            route: `${originCountry} → ${destinationCountry}`,
            isInternational,
            originProvState,
            destinationProvState
        });

        // Check domestic country support
        if (!isInternational) {
            console.log('    🏠 Checking domestic routing...');
            if (originCountry === 'CA' && geographicRouting.domesticCanada) {
                console.log('    ✅ Domestic Canada supported');
                return true;
            }
            if (originCountry === 'US' && geographicRouting.domesticUS) {
                console.log('    ✅ Domestic US supported');
                return true;
            }
            console.log('    ❌ Domestic routing not supported for', originCountry);
        }

        // Check specific routing rules
        console.log('    🌍 Checking country-to-country routing...');
        console.log('    📋 Geographic routing config:', JSON.stringify(geographicRouting, null, 2));
        
        if (geographicRouting.countryToCountry && geographicRouting.countryCountryRouting?.length > 0) {
            console.log('    🔍 Country-to-country routes available:', geographicRouting.countryCountryRouting);
            
            const countryRouteMatch = geographicRouting.countryCountryRouting.some(route => {
                const matches = route.from === originCountry && route.to === destinationCountry;
                console.log(`    📊 Route check: ${route.from} → ${route.to} vs ${originCountry} → ${destinationCountry} = ${matches}`);
                return matches;
            });
            
            if (countryRouteMatch) {
                console.log('    ✅ Country route match found!');
                return true;
            } else {
                console.log('    ❌ No matching country route found');
            }
        } else {
            console.log('    ⚠️ No country-to-country routing configured');
        }

        // Check province/state routing
        if (originProvState && destinationProvState) {
            // Province to Province
            if (geographicRouting.provinceToProvince && geographicRouting.provinceProvinceRouting?.length > 0) {
                const provRouteMatch = geographicRouting.provinceProvinceRouting.some(route =>
                    route.from === originProvState && route.to === destinationProvState
                );
                if (provRouteMatch) return true;
            }

            // State to State
            if (geographicRouting.stateToState && geographicRouting.stateStateRouting?.length > 0) {
                const stateRouteMatch = geographicRouting.stateStateRouting.some(route =>
                    route.from === originProvState && route.to === destinationProvState
                );
                if (stateRouteMatch) return true;
            }

            // Province to State (cross-border)
            if (geographicRouting.provinceToState && geographicRouting.provinceStateRouting?.length > 0) {
                const crossBorderMatch = geographicRouting.provinceStateRouting.some(route =>
                    route.from === originProvState && route.to === destinationProvState
                );
                if (crossBorderMatch) return true;
            }
        }

        // Check city routing
        if (originCity && destinationCity) {
            if (geographicRouting.cityToCity && geographicRouting.cityPairRouting?.length > 0) {
                const cityRouteMatch = geographicRouting.cityPairRouting.some(route =>
                    route.fromCity === originCity && route.toCity === destinationCity &&
                    route.fromProvState === originProvState && route.toProvState === destinationProvState &&
                    route.fromCountry === originCountry && route.toCountry === destinationCountry
                );
                if (cityRouteMatch) return true;
            }

            // Province/State to City routing
            if (geographicRouting.provinceStateToCity && geographicRouting.provinceStateCityRouting?.length > 0) {
                const provStateCityMatch = geographicRouting.provinceStateCityRouting.some(route =>
                    route.from === originProvState && 
                    route.toCity === destinationCity &&
                    route.toProvState === destinationProvState &&
                    route.toCountry === destinationCountry
                );
                if (provStateCityMatch) return true;
            }
        }

        // If no specific rules match and no general domestic support, reject
        return false;
    }

    /**
     * Check weight eligibility
     */
    checkWeightEligibility(weightRanges, totalWeight, packages) {
        if (!weightRanges) return true; // No restrictions = eligible

        const weightRestrictions = weightRanges.weightRestrictions || weightRanges;

        // Check total weight restrictions
        if (weightRestrictions.totalWeight?.length > 0) {
            const totalWeightMatch = weightRestrictions.totalWeight.some(range => {
                const minWeight = parseFloat(range.minWeight) || 0;
                const maxWeight = parseFloat(range.maxWeight) || Infinity;
                return totalWeight >= minWeight && totalWeight <= maxWeight;
            });
            if (!totalWeightMatch) return false;
        }

        // Check weight per skid restrictions
        if (weightRestrictions.weightPerSkid?.length > 0 && packages) {
            const weightPerSkidMatch = packages.every(pkg => {
                const packageWeight = parseFloat(pkg.weight) || 0;
                return weightRestrictions.weightPerSkid.some(range => {
                    const minWeight = parseFloat(range.minWeightPerSkid) || 0;
                    const maxWeight = parseFloat(range.maxWeightPerSkid) || Infinity;
                    return packageWeight >= minWeight && packageWeight <= maxWeight;
                });
            });
            if (!weightPerSkidMatch) return false;
        }

        // Check cubic weight restrictions (if applicable)
        if (weightRestrictions.cubicWeight?.length > 0 && packages) {
            // Calculate cubic weight for each package
            const cubicWeightMatch = packages.every(pkg => {
                const length = parseFloat(pkg.length) || 0;
                const width = parseFloat(pkg.width) || 0;
                const height = parseFloat(pkg.height) || 0;
                const actualWeight = parseFloat(pkg.weight) || 0;
                
                // Calculate cubic weight (L * W * H / density factor)
                const cubicWeight = (length * width * height) / 166; // Standard density factor
                
                return weightRestrictions.cubicWeight.some(range => {
                    const minCubicWeight = parseFloat(range.minCubicWeight) || 0;
                    const maxCubicWeight = parseFloat(range.maxCubicWeight) || Infinity;
                    const densityThreshold = parseFloat(range.densityThreshold) || 6;
                    
                    // Check if cubic weight rule applies (low density)
                    const density = actualWeight / ((length * width * height) / 1728); // lbs per cubic foot
                    if (density < densityThreshold) {
                        return cubicWeight >= minCubicWeight && cubicWeight <= maxCubicWeight;
                    }
                    return true; // Not applicable for high-density shipments
                });
            });
            if (!cubicWeightMatch) return false;
        }

        return true;
    }

    /**
     * Check dimension eligibility
     */
    checkDimensionEligibility(dimensionRestrictions, packages) {
        if (!dimensionRestrictions || dimensionRestrictions.length === 0) return true;
        if (!packages || packages.length === 0) return true;

        return packages.every(pkg => {
            const length = parseFloat(pkg.length) || 0;
            const width = parseFloat(pkg.width) || 0;
            const height = parseFloat(pkg.height) || 0;

            return dimensionRestrictions.some(restriction => {
                const maxLength = parseFloat(restriction.maxLength) || Infinity;
                const maxWidth = parseFloat(restriction.maxWidth) || Infinity;
                const maxHeight = parseFloat(restriction.maxHeight) || Infinity;

                return length <= maxLength && width <= maxWidth && height <= maxHeight;
            });
        });
    }
}

// Create singleton instance
const carrierEligibilityService = new CarrierEligibilityService();

/**
 * Enhanced function to determine eligible carriers for a shipment using database + static carriers
 * @param {Object} shipmentData - Universal shipment data
 * @returns {Array} - Array of eligible carrier configurations
 */
export async function getEligibleCarriers(shipmentData) {
    console.log('🌟 Enhanced Multi-Carrier Eligibility Check with Database Integration');
    
    try {
        // Get all carriers (database + static)
        const allCarriers = await carrierEligibilityService.getAllCarriers();
        
        if (allCarriers.length === 0) {
            console.log('❌ No carriers available in system');
            return [];
        }

        console.log(`📋 Checking ${allCarriers.length} total carriers (database + static)`);

    const { shipFrom, shipTo, packages, shipmentInfo } = shipmentData;
    
    // Determine shipment characteristics
    const shipmentType = normalizeShipmentType(shipmentInfo?.shipmentType);
        const originCountry = carrierEligibilityService.normalizeCountryCode(shipFrom?.country);
        const destinationCountry = carrierEligibilityService.normalizeCountryCode(shipTo?.country);
    const totalWeight = packages?.reduce((sum, pkg) => sum + (parseFloat(pkg.weight) || 0), 0) || 0;
    
    // Determine route type (domestic vs international)
    const isInternational = originCountry !== destinationCountry;
    const routeType = isInternational ? 'international' : 'domestic';
    
        console.log('🔍 Enhanced Eligibility Check:', {
            shipmentType,
            route: `${originCountry} → ${destinationCountry}`,
            routeType: routeType + (isInternational ? ' (cross-border)' : ' (same country)'),
            totalWeight: `${totalWeight} lbs`,
            packagesCount: packages?.length || 0
        });
        
        const eligibleCarriers = [];
        
        for (const carrier of allCarriers) {
            if (carrier.isCustomCarrier) {
                // Database carrier - use enhanced eligibility check
                const isEligible = await carrierEligibilityService.checkCarrierEligibility(
                    carrierEligibilityService.databaseCarriers.get(carrier.key), 
                    shipmentData
                );
                if (isEligible) {
                    eligibleCarriers.push(carrier);
                }
            } else {
                // Static carrier - use original logic
                const { eligibility } = carrier;
                console.log(`\n🧪 Checking ${carrier.name} (Static):`);
                
                // Check shipment type
                if (!eligibility.shipmentTypes.includes(shipmentType)) {
                    console.log(`  ❌ Shipment type: ${shipmentType} not in [${eligibility.shipmentTypes.join(', ')}]`);
                    continue;
                }
                console.log(`  ✅ Shipment type: ${shipmentType} supported`);
                
                // Check countries
                if (!eligibility.countries.includes(originCountry) || !eligibility.countries.includes(destinationCountry)) {
                    console.log(`  ❌ Countries: ${originCountry}->${destinationCountry} not supported by [${eligibility.countries.join(', ')}]`);
                    continue;
                }
                console.log(`  ✅ Countries: ${originCountry}->${destinationCountry} supported`);
                
                // Check route type (domestic vs international)
                if (eligibility.routeTypes && !eligibility.routeTypes.includes(routeType)) {
                    console.log(`  ❌ Route type: ${routeType} not in [${eligibility.routeTypes.join(', ')}]`);
                    continue;
                }
                console.log(`  ✅ Route type: ${routeType} supported`);
                
                // Check weight limits
                if (totalWeight < eligibility.minWeight || totalWeight > eligibility.maxWeight) {
                    console.log(`  ❌ Weight: ${totalWeight}lbs outside limits [${eligibility.minWeight}-${eligibility.maxWeight} lbs]`);
                    continue;
                }
                console.log(`  ✅ Weight: ${totalWeight}lbs within limits [${eligibility.minWeight}-${eligibility.maxWeight} lbs]`);
                
                console.log(`  🎯 ${carrier.name} is ELIGIBLE (Priority: ${carrier.priority})`);
                eligibleCarriers.push(carrier);
            }
        }
        
        // Sort by priority
        eligibleCarriers.sort((a, b) => a.priority - b.priority);
        
        console.log(`\n🌟 Final Eligible Carriers: ${eligibleCarriers.length} carriers:`,
            eligibleCarriers.map(c => `${c.name} (P${c.priority}, ${c.isCustomCarrier ? 'DB' : 'Static'})`));
        
        return eligibleCarriers;
        
    } catch (error) {
        console.error('❌ Error in enhanced eligibility check:', error);
        
        // Fallback to static carriers only
        console.log('🔄 Falling back to static carrier eligibility check');
        return getStaticEligibleCarriers(shipmentData);
    }
}

/**
 * Fallback function for static carrier eligibility (original logic)
 */
function getStaticEligibleCarriers(shipmentData) {
    const { shipFrom, shipTo, packages, shipmentInfo } = shipmentData;
    
    // Determine shipment characteristics
    const shipmentType = normalizeShipmentType(shipmentInfo?.shipmentType);
    const originCountry = carrierEligibilityService.normalizeCountryCode(shipFrom?.country);
    const destinationCountry = carrierEligibilityService.normalizeCountryCode(shipTo?.country);
    const totalWeight = packages?.reduce((sum, pkg) => sum + (parseFloat(pkg.weight) || 0), 0) || 0;
    
    // Determine route type (domestic vs international)
    const isInternational = originCountry !== destinationCountry;
    const routeType = isInternational ? 'international' : 'domestic';
    
    console.log('🔍 Static Multi-Carrier Eligibility Check:', {
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
    
    console.log(`\n🌟 Static Eligible Carriers: ${eligibleCarriers.length} carriers:`,
        eligibleCarriers.map(c => `${c.name} (P${c.priority})`));
    
    return eligibleCarriers;
}

/**
 * Enhanced getAllCarriers that includes database carriers
 * @returns {Array} - Array of all carrier configurations
 */
export async function getAllCarriers() {
    try {
        return await carrierEligibilityService.getAllCarriers();
    } catch (error) {
        console.error('❌ Error fetching all carriers, falling back to static:', error);
        return Object.values(CARRIER_CONFIG);
    }
}

/**
 * Get static carriers only (for backward compatibility)
 * @returns {Array} - Array of static carrier configurations
 */
export function getStaticCarriers() {
    return Object.values(CARRIER_CONFIG);
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
        console.log(`🔍 ${carrier.name} shipmentData being passed to translator:`, JSON.stringify(shipmentData, null, 2));
        const carrierRequest = carrier.translator.toRequest(shipmentData);
        console.log(`🔍 ${carrier.name} carrierRequest after translation:`, JSON.stringify(carrierRequest, null, 2));
        
        // Add service level information for multi-service carriers
        if (shipmentData.shipmentInfo?.serviceLevel && shipmentData.shipmentInfo.serviceLevel !== 'any') {
            // Convert single service level to array for consistency
            carrierRequest.serviceLevels = [shipmentData.shipmentInfo.serviceLevel];
        } else {
            // Default service levels based on shipment type
            if (shipmentData.shipmentInfo?.shipmentType === 'courier') {
                carrierRequest.serviceLevels = ['economy', 'express', 'priority'];
            } else if (shipmentData.shipmentInfo?.shipmentType === 'freight') {
                carrierRequest.serviceLevels = ['economy']; // Default to economy for freight
            } else {
                carrierRequest.serviceLevels = ['economy']; // Safe default
            }
        }
        
        // Also pass shipmentInfo for context
        carrierRequest.shipmentInfo = shipmentData.shipmentInfo;
        
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