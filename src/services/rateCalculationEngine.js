/**
 * Rate Calculation Engine
 * Handles automatic rate calculations for QuickShip carriers based on various pricing models
 */

import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import DIMCalculator from '../utils/dimCalculator';

export class RateCalculationEngine {
    /**
     * Calculate rates for a shipment using carrier rate cards
     * @param {Object} shipmentData - Shipment information
     * @param {string} carrierId - Carrier ID
     * @returns {Object} Rate calculation results
     */
    static async calculateRates(shipmentData, carrierId) {
        try {
            console.log('💰 Calculating rates for carrier:', carrierId);
            console.log('📦 Shipment data:', shipmentData);

            // Get carrier rate cards
            const rateCards = await this.getCarrierRateCards(carrierId);
            if (!rateCards || rateCards.length === 0) {
                console.log('⚠️ No rate cards found for carrier:', carrierId);
                return {
                    success: false,
                    error: 'No rate configuration found for this carrier',
                    rateBreakdown: []
                };
            }

            // Calculate volumetric weight
            const dimFactor = await DIMCalculator.getDIMFactor(carrierId);
            const weightCalculation = DIMCalculator.calculateVolumetricWeight(
                shipmentData.packages,
                dimFactor.dimFactor,
                shipmentData.unitSystem || 'imperial'
            );

            console.log('⚖️ Weight calculation:', weightCalculation);

            // Find the best rate card to use
            const bestRateCard = await this.selectBestRateCard(rateCards, shipmentData, weightCalculation);
            
            if (!bestRateCard) {
                return {
                    success: false,
                    error: 'No applicable rate card found for this shipment',
                    rateBreakdown: []
                };
            }

            console.log('📋 Using rate card:', bestRateCard.rateCardName);

            // Calculate rates based on rate card type
            let rateCalculation;
            switch (bestRateCard.rateType) {
                case 'skid_based':
                    rateCalculation = await this.calculateSkidBasedRates(shipmentData, bestRateCard, weightCalculation);
                    break;
                case 'weight_based':
                    rateCalculation = await this.calculateWeightBasedRates(shipmentData, bestRateCard, weightCalculation);
                    break;
                case 'zone_based':
                    rateCalculation = await this.calculateZoneBasedRates(shipmentData, bestRateCard, weightCalculation);
                    break;
                default:
                    rateCalculation = await this.calculateFlatRates(shipmentData, bestRateCard, weightCalculation);
            }

            // Add additional services charges
            const additionalServicesCharges = await this.calculateAdditionalServices(
                shipmentData.additionalServices || [],
                rateCalculation.baseTotal,
                bestRateCard
            );

            // Compile final rate breakdown
            const finalRateBreakdown = [
                ...rateCalculation.rateBreakdown,
                ...additionalServicesCharges
            ];

            const finalTotal = finalRateBreakdown.reduce((sum, rate) => sum + parseFloat(rate.charge || 0), 0);

            return {
                success: true,
                rateCard: bestRateCard,
                weightCalculation,
                rateBreakdown: finalRateBreakdown,
                baseTotal: rateCalculation.baseTotal,
                additionalServicesTotal: additionalServicesCharges.reduce((sum, rate) => sum + parseFloat(rate.charge || 0), 0),
                finalTotal,
                currency: bestRateCard.currency || 'CAD',
                alternateCarriers: rateCalculation.alternateCarriers || [],
                source: 'auto_calculated'
            };

        } catch (error) {
            console.error('❌ Error calculating rates:', error);
            return {
                success: false,
                error: error.message,
                rateBreakdown: []
            };
        }
    }

    /**
     * Get rate cards for a carrier
     * @param {string} carrierId - Carrier ID
     * @returns {Array} Array of rate cards
     */
    static async getCarrierRateCards(carrierId) {
        try {
            const rateCardsQuery = query(
                collection(db, 'carrierRateCards'),
                where('carrierId', '==', carrierId),
                where('enabled', '==', true),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(rateCardsQuery);
            const rateCards = [];

            querySnapshot.forEach(doc => {
                rateCards.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log(`📋 Found ${rateCards.length} rate cards for carrier ${carrierId}`);
            return rateCards;

        } catch (error) {
            console.error('❌ Error getting carrier rate cards:', error);
            return [];
        }
    }

    /**
     * Select the best rate card for a shipment
     * @param {Array} rateCards - Available rate cards
     * @param {Object} shipmentData - Shipment data
     * @param {Object} weightCalculation - Weight calculation results
     * @returns {Object} Best rate card
     */
    static async selectBestRateCard(rateCards, shipmentData, weightCalculation) {
        // For now, select the first enabled rate card
        // TODO: Add logic to select based on shipment characteristics
        return rateCards.find(card => card.enabled) || null;
    }

    /**
     * Calculate skid-based rates
     * @param {Object} shipmentData - Shipment data
     * @param {Object} rateCard - Rate card configuration
     * @param {Object} weightCalculation - Weight calculation results
     * @returns {Object} Rate calculation results
     */
    static async calculateSkidBasedRates(shipmentData, rateCard, weightCalculation) {
        console.log('📦 Calculating skid-based rates');

        // Count total skids/pallets from packages
        const totalSkids = shipmentData.packages.reduce((sum, pkg) => {
            // Look for packaging types that indicate skids/pallets
            const isSkid = pkg.packagingType && (
                pkg.packagingType.toLowerCase().includes('pallet') ||
                pkg.packagingType.toLowerCase().includes('skid') ||
                pkg.packagingType === '245' || // PALLET code
                pkg.packagingType === '246'    // SKID code
            );
            return sum + (isSkid ? parseInt(pkg.quantity || 1) : 0);
        });

        console.log('📦 Total skids/pallets:', totalSkids);

        if (totalSkids === 0) {
            return {
                success: false,
                error: 'No skids/pallets found in shipment for skid-based pricing',
                rateBreakdown: [],
                baseTotal: 0
            };
        }

        // Find applicable skid rate
        const skidRates = rateCard.skidRates || [];
        const applicableRate = skidRates.find(rate => rate.skidCount === totalSkids) ||
                              skidRates.find(rate => rate.skidCount >= totalSkids);

        if (!applicableRate) {
            return {
                success: false,
                error: `No rate found for ${totalSkids} skids`,
                rateBreakdown: [],
                baseTotal: 0
            };
        }

        console.log('💰 Using skid rate:', applicableRate);

        // Build rate breakdown
        const rateBreakdown = [
            {
                id: 1,
                carrier: rateCard.carrierName || 'Auto',
                code: 'FRT',
                chargeName: `Freight - ${totalSkids} Skid${totalSkids > 1 ? 's' : ''}`,
                cost: applicableRate.ourCost?.toString() || '0',
                costCurrency: rateCard.currency || 'CAD',
                charge: applicableRate.retailPrice?.toString() || '0',
                chargeCurrency: rateCard.currency || 'CAD',
                source: 'auto_calculated'
            }
        ];

        // Check for rush service
        let alternateCarriers = [];
        if (applicableRate.rushAvailable && shipmentData.isRushService) {
            rateBreakdown.push({
                id: 2,
                carrier: rateCard.carrierName || 'Auto',
                code: 'RUSH',
                chargeName: 'Rush Service',
                cost: '0',
                costCurrency: rateCard.currency || 'CAD',
                charge: '25.00', // Standard rush fee
                chargeCurrency: rateCard.currency || 'CAD',
                source: 'auto_calculated'
            });
        }

        // Add alternate carrier option if available
        if (applicableRate.alternateCarrier) {
            alternateCarriers.push({
                name: applicableRate.alternateCarrier.name,
                cost: applicableRate.alternateCarrier.cost,
                savings: applicableRate.ourCost - applicableRate.alternateCarrier.cost
            });
        }

        const baseTotal = rateBreakdown.reduce((sum, rate) => sum + parseFloat(rate.charge), 0);

        return {
            success: true,
            rateBreakdown,
            baseTotal,
            alternateCarriers,
            notes: applicableRate.notes
        };
    }

    /**
     * Calculate weight-based rates
     * @param {Object} shipmentData - Shipment data
     * @param {Object} rateCard - Rate card configuration
     * @param {Object} weightCalculation - Weight calculation results
     * @returns {Object} Rate calculation results
     */
    static async calculateWeightBasedRates(shipmentData, rateCard, weightCalculation) {
        console.log('⚖️ Calculating weight-based rates');

        const chargeableWeight = weightCalculation.chargeableWeight;
        const weightBreaks = rateCard.weightBreaks || [];

        // Find applicable weight break
        const applicableBreak = weightBreaks
            .filter(wb => chargeableWeight >= wb.minWeight && chargeableWeight <= wb.maxWeight)
            .sort((a, b) => a.minWeight - b.minWeight)[0];

        if (!applicableBreak) {
            return {
                success: false,
                error: `No rate found for weight ${chargeableWeight} lbs`,
                rateBreakdown: [],
                baseTotal: 0
            };
        }

        console.log('💰 Using weight break:', applicableBreak);

        // Calculate freight charge
        const freightCharge = Math.max(
            chargeableWeight * applicableBreak.rate,
            applicableBreak.minimumCharge || 0
        );

        const rateBreakdown = [
            {
                id: 1,
                carrier: rateCard.carrierName || 'Auto',
                code: 'FRT',
                chargeName: `Freight - ${weightCalculation.formatWeight(chargeableWeight)}`,
                cost: (freightCharge * 0.7).toFixed(2), // Assume 30% markup
                costCurrency: rateCard.currency || 'CAD',
                charge: freightCharge.toFixed(2),
                chargeCurrency: rateCard.currency || 'CAD',
                source: 'auto_calculated'
            }
        ];

        // Add volumetric weight info if applicable
        if (weightCalculation.usingVolumetricWeight) {
            rateBreakdown[0].chargeName += ` (Volumetric: ${DIMCalculator.formatWeight(weightCalculation.volumetricWeight)})`;
        }

        const baseTotal = freightCharge;

        return {
            success: true,
            rateBreakdown,
            baseTotal,
            alternateCarriers: []
        };
    }

    /**
     * Calculate zone-based rates
     * @param {Object} shipmentData - Shipment data
     * @param {Object} rateCard - Rate card configuration
     * @param {Object} weightCalculation - Weight calculation results
     * @returns {Object} Rate calculation results
     */
    static async calculateZoneBasedRates(shipmentData, rateCard, weightCalculation) {
        console.log('🗺️ Calculating zone-based rates');

        const originPostal = shipmentData.origin?.postalCode?.substring(0, 3);
        const destPostal = shipmentData.destination?.postalCode?.substring(0, 3);

        if (!originPostal || !destPostal) {
            return {
                success: false,
                error: 'Origin and destination postal codes required for zone-based pricing',
                rateBreakdown: [],
                baseTotal: 0
            };
        }

        // Find applicable zone
        const zones = rateCard.zones || [];
        const applicableZone = zones.find(zone => 
            zone.fromPostalCode === originPostal && zone.toPostalCode === destPostal
        );

        if (!applicableZone) {
            return {
                success: false,
                error: `No rate found for route ${originPostal} to ${destPostal}`,
                rateBreakdown: [],
                baseTotal: 0
            };
        }

        console.log('💰 Using zone rate:', applicableZone);

        const chargeableWeight = weightCalculation.chargeableWeight;
        const freightCharge = Math.max(
            applicableZone.baseRate + (chargeableWeight * applicableZone.perKgRate),
            applicableZone.minimumCharge || 0
        );

        const rateBreakdown = [
            {
                id: 1,
                carrier: rateCard.carrierName || 'Auto',
                code: 'FRT',
                chargeName: `Freight - ${originPostal} to ${destPostal}`,
                cost: (freightCharge * 0.7).toFixed(2), // Assume 30% markup
                costCurrency: rateCard.currency || 'CAD',
                charge: freightCharge.toFixed(2),
                chargeCurrency: rateCard.currency || 'CAD',
                source: 'auto_calculated'
            }
        ];

        return {
            success: true,
            rateBreakdown,
            baseTotal: freightCharge,
            alternateCarriers: []
        };
    }

    /**
     * Calculate flat rates (fallback method)
     * @param {Object} shipmentData - Shipment data
     * @param {Object} rateCard - Rate card configuration
     * @param {Object} weightCalculation - Weight calculation results
     * @returns {Object} Rate calculation results
     */
    static async calculateFlatRates(shipmentData, rateCard, weightCalculation) {
        console.log('💰 Calculating flat rates');

        const flatRate = rateCard.flatRate || 100; // Default flat rate

        const rateBreakdown = [
            {
                id: 1,
                carrier: rateCard.carrierName || 'Auto',
                code: 'FRT',
                chargeName: 'Freight - Flat Rate',
                cost: (flatRate * 0.7).toFixed(2),
                costCurrency: rateCard.currency || 'CAD',
                charge: flatRate.toFixed(2),
                chargeCurrency: rateCard.currency || 'CAD',
                source: 'auto_calculated'
            }
        ];

        return {
            success: true,
            rateBreakdown,
            baseTotal: flatRate,
            alternateCarriers: []
        };
    }

    /**
     * Calculate additional services charges
     * @param {Array} additionalServices - Selected additional services
     * @param {number} baseTotal - Base freight total
     * @param {Object} rateCard - Rate card configuration
     * @returns {Array} Additional service charges
     */
    static async calculateAdditionalServices(additionalServices, baseTotal, rateCard) {
        const serviceCharges = [];

        // Standard additional service rates (can be moved to configuration)
        const serviceRates = {
            'signature_required': { rate: 5.00, type: 'flat' },
            'saturday_delivery': { rate: 15.00, type: 'flat' },
            'residential_delivery': { rate: 0.05, type: 'percentage' },
            'fuel_surcharge': { rate: 0.15, type: 'percentage' },
            'insurance': { rate: 0.02, type: 'percentage' }
        };

        additionalServices.forEach((service, index) => {
            const serviceConfig = serviceRates[service.code] || serviceRates[service];
            if (serviceConfig) {
                let charge = 0;
                if (serviceConfig.type === 'flat') {
                    charge = serviceConfig.rate;
                } else if (serviceConfig.type === 'percentage') {
                    charge = baseTotal * serviceConfig.rate;
                }

                serviceCharges.push({
                    id: 100 + index,
                    carrier: rateCard.carrierName || 'Auto',
                    code: service.code || service,
                    chargeName: service.name || service,
                    cost: (charge * 0.8).toFixed(2), // Assume 20% markup on services
                    costCurrency: rateCard.currency || 'CAD',
                    charge: charge.toFixed(2),
                    chargeCurrency: rateCard.currency || 'CAD',
                    source: 'auto_calculated'
                });
            }
        });

        return serviceCharges;
    }

    /**
     * Format rate breakdown for QuickShip manual rates table
     * @param {Array} rateBreakdown - Rate breakdown from calculation
     * @returns {Array} Formatted rates for QuickShip
     */
    static formatForQuickShip(rateBreakdown) {
        return rateBreakdown.map(rate => ({
            id: rate.id,
            carrier: rate.carrier,
            code: rate.code,
            chargeName: rate.chargeName,
            cost: rate.cost,
            costCurrency: rate.costCurrency,
            charge: rate.charge,
            chargeCurrency: rate.chargeCurrency,
            isAutoCalculated: true,
            source: rate.source
        }));
    }
}

export default RateCalculationEngine;
