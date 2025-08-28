/**
 * DIM Factor Calculator for Volumetric Weight Calculations
 * Handles dimensional weight calculations for various carriers and services
 */

import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';

export class DIMCalculator {
    /**
     * Calculate volumetric weight for packages
     * @param {Array} packages - Array of package objects with dimensions
     * @param {number} dimFactor - DIM factor to use for calculation
     * @param {string} unit - Unit system ('imperial' or 'metric')
     * @returns {Object} Calculation results
     */
    static calculateVolumetricWeight(packages, dimFactor = 166, unit = 'imperial') {
        if (!packages || packages.length === 0) {
            return {
                actualWeight: 0,
                volumetricWeight: 0,
                chargeableWeight: 0,
                totalVolume: 0,
                dimFactor,
                unit,
                calculations: []
            };
        }

        let totalActualWeight = 0;
        let totalVolume = 0;
        const calculations = [];

        // Calculate for each package
        packages.forEach((pkg, index) => {
            const weight = parseFloat(pkg.weight) || 0;
            const quantity = parseInt(pkg.quantity) || 1;
            const length = parseFloat(pkg.length) || 0;
            const width = parseFloat(pkg.width) || 0;
            const height = parseFloat(pkg.height) || 0;

            // Package weight (actual weight × quantity)
            const packageActualWeight = weight * quantity;
            totalActualWeight += packageActualWeight;

            // Package volume (L × W × H × quantity)
            const packageVolume = length * width * height * quantity;
            totalVolume += packageVolume;

            // Volumetric weight for this package
            const packageVolumetricWeight = packageVolume / dimFactor;

            calculations.push({
                packageNumber: index + 1,
                dimensions: { length, width, height },
                quantity,
                actualWeight: weight,
                packageActualWeight,
                packageVolume,
                packageVolumetricWeight,
                chargeableWeight: Math.max(packageActualWeight, packageVolumetricWeight)
            });
        });

        // Total volumetric weight
        const totalVolumetricWeight = totalVolume / dimFactor;
        
        // Chargeable weight (higher of actual vs volumetric)
        const chargeableWeight = Math.max(totalActualWeight, totalVolumetricWeight);

        // Round up to nearest billing unit
        const billingUnit = unit === 'metric' ? 0.5 : 1; // 0.5 kg or 1 lb
        const roundedChargeableWeight = Math.ceil(chargeableWeight / billingUnit) * billingUnit;

        return {
            actualWeight: Math.round(totalActualWeight * 100) / 100,
            volumetricWeight: Math.round(totalVolumetricWeight * 100) / 100,
            chargeableWeight: Math.round(chargeableWeight * 100) / 100,
            roundedChargeableWeight,
            totalVolume: Math.round(totalVolume * 100) / 100,
            dimFactor,
            unit,
            calculations,
            usingVolumetricWeight: totalVolumetricWeight > totalActualWeight
        };
    }

    /**
     * Get DIM factor for a specific carrier and service
     * @param {string} carrierId - Carrier ID
     * @param {string} serviceType - Service type (Express, Ground, etc.)
     * @param {string} zone - Zone (All, Domestic, International)
     * @param {Date} effectiveDate - Date to check factor validity
     * @returns {Object} DIM factor data
     */
    static async getDIMFactor(carrierId, serviceType = 'All', zone = 'All', effectiveDate = new Date()) {
        try {
            console.log('🔍 Getting DIM factor for:', { carrierId, serviceType, zone, effectiveDate });

            // Query DIM factors collection
            const dimFactorsQuery = query(
                collection(db, 'dimFactors'),
                where('carrierId', '==', carrierId),
                where('serviceType', '==', serviceType),
                where('zone', '==', zone),
                where('enabled', '==', true),
                where('effectiveDate', '<=', effectiveDate),
                orderBy('effectiveDate', 'desc'),
                limit(1)
            );

            const querySnapshot = await getDocs(dimFactorsQuery);

            if (!querySnapshot.empty) {
                const dimFactorDoc = querySnapshot.docs[0];
                const dimFactorData = { id: dimFactorDoc.id, ...dimFactorDoc.data() };
                
                console.log('✅ Found DIM factor:', dimFactorData);
                return dimFactorData;
            }

            // Fallback: Try to find factor for 'All' service types
            if (serviceType !== 'All') {
                console.log('🔄 Trying fallback with serviceType: All');
                return await this.getDIMFactor(carrierId, 'All', zone, effectiveDate);
            }

            // Fallback: Try to find factor for 'All' zones
            if (zone !== 'All') {
                console.log('🔄 Trying fallback with zone: All');
                return await this.getDIMFactor(carrierId, serviceType, 'All', effectiveDate);
            }

            // Final fallback: Use default factors based on carrier name patterns
            const defaultFactors = this.getDefaultDIMFactors();
            const carrierName = carrierId.toLowerCase();
            
            for (const [pattern, factor] of Object.entries(defaultFactors)) {
                if (carrierName.includes(pattern)) {
                    console.log('📋 Using default DIM factor:', factor);
                    return {
                        dimFactor: factor.dimFactor,
                        unit: factor.unit,
                        carrierName: factor.carrierName,
                        serviceType: 'All',
                        zone: 'All',
                        source: 'default'
                    };
                }
            }

            // Ultimate fallback
            console.log('⚠️ No DIM factor found, using default 166 in³/lb');
            return {
                dimFactor: 166,
                unit: 'in³/lb',
                carrierName: 'Default',
                serviceType: 'All',
                zone: 'All',
                source: 'fallback'
            };

        } catch (error) {
            console.error('❌ Error getting DIM factor:', error);
            // Return safe fallback
            return {
                dimFactor: 166,
                unit: 'in³/lb',
                carrierName: 'Default',
                serviceType: 'All',
                zone: 'All',
                source: 'error_fallback'
            };
        }
    }

    /**
     * Get default DIM factors for common carriers
     * @returns {Object} Default DIM factors mapping
     */
    static getDefaultDIMFactors() {
        return {
            'fedex': {
                dimFactor: 139,
                unit: 'in³/lb',
                carrierName: 'FedEx'
            },
            'ups': {
                dimFactor: 166,
                unit: 'in³/lb',
                carrierName: 'UPS'
            },
            'purolator': {
                dimFactor: 139,
                unit: 'in³/lb',
                carrierName: 'Purolator'
            },
            'canpar': {
                dimFactor: 166,
                unit: 'in³/lb',
                carrierName: 'Canpar'
            },
            'dhl': {
                dimFactor: 139,
                unit: 'in³/lb',
                carrierName: 'DHL'
            }
        };
    }

    /**
     * Convert between imperial and metric units
     * @param {number} value - Value to convert
     * @param {string} fromUnit - Source unit ('imperial' or 'metric')
     * @param {string} toUnit - Target unit ('imperial' or 'metric')
     * @param {string} type - Type of conversion ('weight', 'dimension', 'volume')
     * @returns {number} Converted value
     */
    static convertUnits(value, fromUnit, toUnit, type = 'weight') {
        if (fromUnit === toUnit) return value;

        const conversions = {
            weight: {
                imperial_to_metric: value * 0.453592, // lb to kg
                metric_to_imperial: value * 2.20462   // kg to lb
            },
            dimension: {
                imperial_to_metric: value * 2.54,     // in to cm
                metric_to_imperial: value * 0.393701  // cm to in
            },
            volume: {
                imperial_to_metric: value * 16.387,   // in³ to cm³
                metric_to_imperial: value * 0.0610237 // cm³ to in³
            }
        };

        const conversionKey = `${fromUnit}_to_${toUnit}`;
        return conversions[type][conversionKey] || value;
    }

    /**
     * Format weight for display
     * @param {number} weight - Weight value
     * @param {string} unit - Unit system ('imperial' or 'metric')
     * @returns {string} Formatted weight string
     */
    static formatWeight(weight, unit = 'imperial') {
        const unitLabel = unit === 'metric' ? 'kg' : 'lbs';
        return `${Math.round(weight * 100) / 100} ${unitLabel}`;
    }

    /**
     * Format dimensions for display
     * @param {Object} dimensions - Dimensions object {length, width, height}
     * @param {string} unit - Unit system ('imperial' or 'metric')
     * @returns {string} Formatted dimensions string
     */
    static formatDimensions(dimensions, unit = 'imperial') {
        const unitLabel = unit === 'metric' ? 'cm' : 'in';
        const { length, width, height } = dimensions;
        return `${length} x ${width} x ${height} ${unitLabel}`;
    }
}

export default DIMCalculator;
