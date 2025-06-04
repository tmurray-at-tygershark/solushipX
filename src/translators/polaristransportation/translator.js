/**
 * Polaris Transportation API Translator
 * Converts between universal format and Polaris Transportation API format
 */

/**
 * Convert universal shipment format to Polaris Transportation rate request format
 * @param {Object} universalData - Universal shipment data format
 * @returns {Object} - Polaris Transportation formatted request
 */
export function toPolarisTransportationRequest(universalData) {
    const { shipFrom, shipTo, packages, shipmentInfo } = universalData;

    // Transform packages to commodities/items
    const items = (packages || []).map((pkg, index) => ({
        Description: pkg.description || 'General Freight',
        Weight: parseFloat(pkg.weight || 0),
        Length: parseInt(pkg.length || 48),
        Width: parseInt(pkg.width || 48),
        Height: parseInt(pkg.height || 40),
        PackagingQuantity: parseInt(pkg.packagingQuantity || pkg.quantity || 1),
        FreightClass: pkg.freightClass || '70',
        DeclaredValue: parseFloat(pkg.declaredValue || pkg.value || 0),
        Stackable: pkg.stackable === true || pkg.stackable === 'true'
    }));

    // Build the request - only postal codes are required for Polaris Transportation
    const request = {
        Origin: {
            PostalCode: shipFrom?.postalCode || '',
            Company: shipFrom?.company || '',
            Contact: shipFrom?.contact || shipFrom?.attention || 'Shipping Department',
            Phone: shipFrom?.phone || '',
            Email: shipFrom?.email || ''
        },
        Destination: {
            PostalCode: shipTo?.postalCode || '',
            Company: shipTo?.company || '',
            Contact: shipTo?.contact || shipTo?.attention || 'Receiving Department',
            Phone: shipTo?.phone || '',
            Email: shipTo?.email || ''
        },
        Items: items,
        ReferenceNumber: shipmentInfo?.shipperReferenceNumber || shipmentInfo?.referenceNumber || '',
        ShipmentDate: shipmentInfo?.shipmentDate || new Date().toISOString().split('T')[0],
        Services: ['Standard']
    };

    console.log('Polaris Transportation request generated (postal codes only):', request);
    return request;
}

/**
 * Convert Polaris Transportation rate response to universal format
 * @param {Object} polarisResponse - Raw response from Polaris Transportation API
 * @returns {Array} - Array of universal rate objects
 */
export function fromPolarisTransportationResponse(polarisResponse) {
    if (!polarisResponse || !polarisResponse.data) {
        console.warn('No Polaris Transportation response data provided');
        return [];
    }

    const { data } = polarisResponse;
    const rates = data.availableRates || data.Rates || data.QuoteDetails || [];

    if (!Array.isArray(rates)) {
        console.warn('Polaris Transportation rates is not an array:', rates);
        return [];
    }

    return rates.map((rate, index) => {
        // Generate a unique rate ID - prioritize backend quoteId
        const rateId = rate.quoteId || rate.QuoteId || rate.RateId || `polaris_${Date.now()}_${index}`;
        
        // Extract pricing information - match backend field names
        const freightCharges = parseFloat(rate.freightCharges || rate.FreightCharges || rate.LineHaul || 0);
        const fuelCharges = parseFloat(rate.fuelCharges || rate.FuelSurcharge || rate.Fuel || 0);
        const serviceCharges = parseFloat(rate.serviceCharges || rate.AccessorialCharges || rate.Accessorials || 0);
        const accessorialCharges = parseFloat(rate.accessorialCharges || rate.OtherCharges || rate.Misc || 0);
        const totalCharges = parseFloat(rate.totalCharges || rate.TotalCharges || rate.Total || 0);

        // Extract transit information - match backend field names
        const transitDays = parseInt(rate.transitDays || rate.transitTime || rate.TransitDays || rate.TransitTime || 0);
        const estimatedDelivery = rate.estimatedDeliveryDate || rate.EstimatedDelivery || null;

        // Build universal rate object
        const universalRate = {
            // Core identification
            id: rateId,
            quoteId: rateId,
            rateId: rateId,

            // CRITICAL: Source carrier information for booking routing
            sourceCarrier: {
                key: 'POLARISTRANSPORTATION',
                name: 'Polaris Transportation',
                system: 'polaristransportation'
            },

            // Display carrier information (what user sees)
            displayCarrier: {
                name: 'Polaris Transportation',
                id: 'POLARISTRANSPORTATION',
                scac: 'POLT'
            },

            // Legacy carrier fields for backward compatibility
            carrier: {
                name: 'Polaris Transportation',
                id: 'POLARISTRANSPORTATION',
                scac: 'POLT',
                key: 'POLARISTRANSPORTATION'
            },
            carrierName: 'Polaris Transportation',
            carrierId: 'POLARISTRANSPORTATION',
            carrierScac: 'POLT',

            // Service information
            service: {
                name: rate.serviceType || rate.ServiceType || 'Standard LTL',
                code: rate.serviceCode || rate.ServiceCode || 'STD',
                type: 'LTL',
                mode: rate.serviceMode || rate.ServiceMode || 'LTL'
            },
            serviceType: rate.serviceType || rate.ServiceType || 'Standard LTL',
            serviceMode: rate.serviceMode || rate.ServiceMode || 'LTL',

            // Pricing information
            pricing: {
                total: totalCharges,
                freight: freightCharges,
                fuel: fuelCharges,
                service: serviceCharges,
                accessorial: accessorialCharges,
                insurance: parseFloat(rate.InsuranceCharges || 0),
                tax: parseFloat(rate.TaxCharges || 0),
                discount: parseFloat(rate.DiscountAmount || 0),
                guarantee: parseFloat(rate.guaranteeCharge || rate.GuaranteeCharge || 0),
                currency: rate.currency || rate.Currency || 'CAD',
                breakdown: rate.billingDetails || [] // Use backend billing details
            },
            totalCharges: totalCharges,
            freightCharges: freightCharges,
            fuelCharges: fuelCharges,
            serviceCharges: serviceCharges,
            accessorialCharges: accessorialCharges,
            currency: rate.currency || rate.Currency || 'CAD',

            // Transit information
            transit: {
                days: transitDays,
                hours: transitDays * 24,
                businessDays: transitDays,
                estimatedDelivery: estimatedDelivery,
                guaranteed: rate.guaranteedService === true || rate.GuaranteedService === true,
                guaranteeOptions: rate.guarOptions || rate.GuarOptions || []
            },
            transitTime: transitDays,
            transitDays: transitDays,
            estimatedDeliveryDate: estimatedDelivery,
            guaranteed: rate.guaranteedService === true || rate.GuaranteedService === true,
            guaranteedService: rate.guaranteedService === true || rate.GuaranteedService === true,
            guaranteeCharge: parseFloat(rate.guaranteeCharge || rate.GuaranteeCharge || 0),

            // Weight and dimensions - match backend field names
            weight: {
                billed: parseFloat(rate.billedWeight || rate.BilledWeight || rate.ChargeableWeight || 0),
                rated: parseFloat(rate.ratedWeight || rate.RatedWeight || rate.ChargeableWeight || 0),
                actual: parseFloat(rate.ActualWeight || 0),
                dimensional: parseFloat(rate.DimensionalWeight || 0),
                unit: 'LBS'
            },
            billedWeight: parseFloat(rate.billedWeight || rate.BilledWeight || rate.ChargeableWeight || 0),
            ratedWeight: parseFloat(rate.ratedWeight || rate.RatedWeight || rate.ChargeableWeight || 0),

            dimensions: {
                length: parseInt(rate.Length || 0),
                width: parseInt(rate.Width || 0),
                height: parseInt(rate.Height || 0),
                cubicFeet: parseFloat(rate.CubicFeet || 0),
                unit: 'IN'
            },

            // Service features
            features: {
                residential: rate.Residential === true,
                liftgate: rate.Liftgate === true,
                insideDelivery: rate.InsideDelivery === true,
                appointmentDelivery: rate.AppointmentDelivery === true,
                signatureRequired: rate.SignatureRequired === true,
                hazmat: rate.HazardousMaterial === true,
                freezable: rate.Freezable === true
            },

            // Additional fields for compatibility
            billingDetails: rate.billingDetails || rate.BillingDetails || [],
            guarOptions: rate.guarOptions || rate.GuarOptions || [],

            // Raw data for debugging and booking
            raw: rate,
            rawRateDetails: rate,

            // Metadata
            timestamp: new Date().toISOString(),
            _source: 'polaristransportation'
        };

        console.log(`Converted Polaris Transportation rate ${rateId}:`, universalRate);
        return universalRate;
    });
}

/**
 * Map Polaris Transportation rate to universal format (alias for backward compatibility)
 * @param {Object} polarisRate - Single rate from Polaris Transportation
 * @returns {Object} - Universal rate object
 */
export function mapPolarisTransportationToUniversal(polarisRate) {
    return fromPolarisTransportationResponse({ data: { availableRates: [polarisRate] } })[0];
} 