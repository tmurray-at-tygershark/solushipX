/**
 * Carrier Hierarchy Management System
 * 
 * This module handles the relationship between master carriers and their sub-carriers,
 * providing a scalable way to manage carrier relationships without static mappings.
 */

// Master carrier definitions - these are the actual service providers
export const MASTER_CARRIERS = {
    ESHIPPLUS: {
        id: 'ESHIPPLUS',
        name: 'eShipPlus',
        displayName: 'eShipPlus',
        type: 'integration_platform',
        supportedServices: ['freight', 'ltl'],
        api: {
            booking: 'bookRateEShipPlus',
            rates: 'getRatesEShipPlus',
            tracking: 'getTrackingEShipPlus',
            cancel: 'cancelShipmentEShipPlus'
        },
        trackingIdentifier: 'bookingReferenceNumber'
    },
    CANPAR: {
        id: 'CANPAR',
        name: 'Canpar',
        displayName: 'Canpar Express',
        type: 'direct_carrier',
        supportedServices: ['courier', 'express'],
        api: {
            booking: 'bookRateCanpar',
            rates: 'getRatesCanpar',
            tracking: 'getTrackingCanpar',
            cancel: 'cancelShipmentCanpar'
        },
        trackingIdentifier: 'trackingNumber'
    },
    POLARIS: {
        id: 'POLARIS',
        name: 'Polaris Transportation',
        displayName: 'Polaris Transportation',
        type: 'direct_carrier',
        supportedServices: ['freight', 'ltl'],
        api: {
            booking: 'bookRatePolarisTransportation',
            rates: 'getRatesPolarisTransportation',
            tracking: 'getTrackingPolarisTransportation',
            cancel: null // Manual cancellation required
        },
        trackingIdentifier: 'trackingNumber'
    },
    FEDEX: {
        id: 'FEDEX',
        name: 'FedEx',
        displayName: 'FedEx',
        type: 'direct_carrier',
        supportedServices: ['courier', 'express', 'freight'],
        api: {
            booking: 'bookRateFedEx',
            rates: 'getRatesFedEx',
            tracking: 'getTrackingFedEx',
            cancel: null // Manual cancellation required
        },
        trackingIdentifier: 'trackingNumber'
    },
    UPS: {
        id: 'UPS',
        name: 'UPS',
        displayName: 'UPS',
        type: 'direct_carrier',
        supportedServices: ['courier', 'express', 'freight'],
        api: {
            booking: 'bookRateUPS',
            rates: 'getRatesUPS',
            tracking: 'getTrackingUPS',
            cancel: null // Manual cancellation required
        },
        trackingIdentifier: 'trackingNumber'
    }
};

/**
 * Detects the master carrier from shipment data
 * @param {Object} shipment - Shipment object
 * @returns {Object} Master carrier information
 */
export const detectMasterCarrier = (shipment) => {
    // Priority 1: Check for explicit source carrier information
    if (shipment.selectedRate?.sourceCarrierName) {
        const sourceCarrier = shipment.selectedRate.sourceCarrierName.toLowerCase();
        if (sourceCarrier.includes('eshipplus')) {
            return MASTER_CARRIERS.ESHIPPLUS;
        }
        if (sourceCarrier.includes('canpar')) {
            return MASTER_CARRIERS.CANPAR;
        }
        if (sourceCarrier.includes('polaris')) {
            return MASTER_CARRIERS.POLARIS;
        }
    }

    // Priority 2: Check displayCarrierId
    const displayCarrierId = shipment.selectedRate?.displayCarrierId || 
                           shipment.selectedRateRef?.displayCarrierId;
    
    if (displayCarrierId) {
        const masterCarrier = Object.values(MASTER_CARRIERS).find(
            carrier => carrier.id === displayCarrierId.toUpperCase()
        );
        if (masterCarrier) {
            return masterCarrier;
        }
    }

    // Priority 3: Check displayCarrierScac for Polaris
    const displayCarrierScac = shipment.selectedRate?.displayCarrierScac || 
                              shipment.selectedRateRef?.displayCarrierScac;
    
    if (displayCarrierScac === 'POLT') {
        return MASTER_CARRIERS.POLARIS;
    }

    // Priority 4: Analyze carrier name patterns
    const carrierName = shipment.selectedRate?.carrier ||
                       shipment.selectedRateRef?.carrier ||
                       shipment.carrier || '';
    
    const lowerCarrierName = carrierName.toLowerCase();

    // Check for freight patterns (likely eShipPlus)
    const freightPatterns = [
        'freight', 'ltl', 'fedex freight', 'road runner', 'roadrunner',
        'estes', 'yrc', 'xpo', 'old dominion', 'odfl', 'saia', 'ward'
    ];
    
    if (freightPatterns.some(pattern => lowerCarrierName.includes(pattern))) {
        return MASTER_CARRIERS.ESHIPPLUS;
    }

    // Check for direct carrier patterns
    if (lowerCarrierName.includes('canpar')) {
        return MASTER_CARRIERS.CANPAR;
    }
    
    if (lowerCarrierName.includes('polaris')) {
        return MASTER_CARRIERS.POLARIS;
    }
    
    if (lowerCarrierName.includes('fedex') && !lowerCarrierName.includes('freight')) {
        return MASTER_CARRIERS.FEDEX;
    }
    
    if (lowerCarrierName.includes('ups')) {
        return MASTER_CARRIERS.UPS;
    }

    // Fallback: Return unknown carrier structure
    return {
        id: 'UNKNOWN',
        name: carrierName || 'Unknown',
        displayName: carrierName || 'Unknown Carrier',
        type: 'unknown',
        supportedServices: [],
        api: {},
        trackingIdentifier: 'trackingNumber'
    };
};

/**
 * Gets the display carrier name (sub-carrier for eShipPlus, master carrier for others)
 * @param {Object} shipment - Shipment object
 * @returns {string} Display carrier name
 */
export const getDisplayCarrierName = (shipment) => {
    const masterCarrier = detectMasterCarrier(shipment);
    
    // For eShipPlus, show the sub-carrier name
    if (masterCarrier.id === 'ESHIPPLUS') {
        const subCarrierName = shipment.selectedRate?.carrier ||
                              shipment.selectedRateRef?.carrier ||
                              shipment.carrier;
        
        if (subCarrierName && subCarrierName !== 'eShipPlus') {
            return subCarrierName;
        }
    }
    
    // For all other carriers, show the master carrier name
    return masterCarrier.displayName;
};

/**
 * Gets the master carrier name for business logic
 * @param {Object} shipment - Shipment object
 * @returns {string} Master carrier name
 */
export const getMasterCarrierName = (shipment) => {
    return detectMasterCarrier(shipment).name;
};

/**
 * Gets the appropriate tracking identifier for a shipment
 * @param {Object} shipment - Shipment object
 * @returns {string|null} Tracking identifier
 */
export const getTrackingIdentifier = (shipment) => {
    const masterCarrier = detectMasterCarrier(shipment);
    
    if (masterCarrier.trackingIdentifier === 'bookingReferenceNumber') {
        // For eShipPlus-style carriers, use booking reference
        return shipment.carrierBookingConfirmation?.proNumber ||
               shipment.carrierBookingConfirmation?.confirmationNumber ||
               shipment.carrierBookingConfirmation?.bookingReferenceNumber ||
               shipment.selectedRate?.BookingReferenceNumber ||
               shipment.selectedRateRef?.BookingReferenceNumber ||
               shipment.bookingReferenceNumber;
    } else {
        // For traditional carriers, use tracking number
        return shipment.trackingNumber ||
               shipment.selectedRate?.TrackingNumber ||
               shipment.selectedRate?.Barcode ||
               shipment.selectedRateRef?.TrackingNumber ||
               shipment.selectedRateRef?.Barcode ||
               shipment.carrierTrackingData?.trackingNumber ||
               shipment.carrierBookingConfirmation?.trackingNumber;
    }
};

/**
 * Gets the appropriate API function name for a carrier operation
 * @param {Object} shipment - Shipment object
 * @param {string} operation - Operation type (booking, rates, tracking, cancel)
 * @returns {string|null} Function name
 */
export const getCarrierApiFunction = (shipment, operation) => {
    const masterCarrier = detectMasterCarrier(shipment);
    return masterCarrier.api[operation] || null;
};

/**
 * Checks if a carrier supports a specific service type
 * @param {Object} shipment - Shipment object
 * @param {string} serviceType - Service type to check
 * @returns {boolean} Whether the carrier supports the service
 */
export const carrierSupportsService = (shipment, serviceType) => {
    const masterCarrier = detectMasterCarrier(shipment);
    return masterCarrier.supportedServices.includes(serviceType);
};

/**
 * Gets carrier hierarchy information for display purposes
 * @param {Object} shipment - Shipment object
 * @returns {Object} Hierarchy information
 */
export const getCarrierHierarchy = (shipment) => {
    const masterCarrier = detectMasterCarrier(shipment);
    const displayName = getDisplayCarrierName(shipment);
    
    return {
        masterCarrier: {
            id: masterCarrier.id,
            name: masterCarrier.name,
            displayName: masterCarrier.displayName,
            type: masterCarrier.type
        },
        displayCarrier: {
            name: displayName,
            isSubCarrier: masterCarrier.id === 'ESHIPPLUS' && displayName !== masterCarrier.displayName
        },
        trackingIdentifier: masterCarrier.trackingIdentifier,
        apiOperations: masterCarrier.api
    };
};

/**
 * Normalizes carrier data for consistent handling
 * @param {Object} shipment - Shipment object
 * @returns {Object} Normalized carrier data
 */
export const normalizeCarrierData = (shipment) => {
    const hierarchy = getCarrierHierarchy(shipment);
    const trackingId = getTrackingIdentifier(shipment);
    
    return {
        masterCarrierId: hierarchy.masterCarrier.id,
        masterCarrierName: hierarchy.masterCarrier.name,
        displayCarrierName: hierarchy.displayCarrier.name,
        carrierType: hierarchy.masterCarrier.type,
        isSubCarrier: hierarchy.displayCarrier.isSubCarrier,
        trackingIdentifier: trackingId,
        trackingIdentifierType: hierarchy.trackingIdentifier,
        supportedOperations: hierarchy.apiOperations
    };
};

/**
 * Gets eligible master carriers for a shipment type
 * @param {string} shipmentType - Type of shipment (courier, freight, etc.)
 * @returns {Array} Array of eligible master carriers
 */
export const getEligibleMasterCarriers = (shipmentType) => {
    return Object.values(MASTER_CARRIERS).filter(carrier => 
        carrier.supportedServices.includes(shipmentType)
    );
}; 