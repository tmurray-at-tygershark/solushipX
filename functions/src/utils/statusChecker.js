const logger = require('firebase-functions/logger');
const { getFirestore } = require('firebase-admin/firestore');

// Import carrier-specific status checkers
const { getEShipPlusStatus } = require('../carrier-api/eshipplus/getStatus');
const { getCanparStatus } = require('../carrier-api/canpar/getStatus');

const db = getFirestore();

/**
 * Core status checking logic that can be shared between functions
 */
async function checkStatus(params) {
    const { trackingNumber, shipmentId, carrier, bookingReferenceNumber } = params;

    try {
        if (!trackingNumber && !shipmentId && !bookingReferenceNumber) {
            throw new Error('Either trackingNumber, bookingReferenceNumber, or shipmentId is required');
        }

        let shipmentData = null;
        let carrierInfo = null;

        // If shipmentId is provided, get shipment data from Firestore
        if (shipmentId) {
            const shipmentRef = db.collection('shipments').doc(shipmentId);
            const shipmentDoc = await shipmentRef.get();
            
            if (!shipmentDoc.exists) {
                throw new Error('Shipment not found');
            }
            
            shipmentData = shipmentDoc.data();
            
            // Determine carrier from shipment data if not provided
            if (!carrier) {
                carrierInfo = getShipmentCarrier(shipmentData);
            } else {
                carrierInfo = { name: carrier, type: carrier };
            }
        } else {
            // Use provided carrier
            carrierInfo = { name: carrier, type: carrier };
        }

        if (!carrierInfo || !carrierInfo.name) {
            throw new Error('Could not determine carrier');
        }

        // Get carrier configuration
        const carrierConfig = await getCarrierConfig(carrierInfo.name);
        if (!carrierConfig) {
            throw new Error(`Carrier configuration not found for: ${carrierInfo.name}`);
        }

        // Determine the correct tracking identifier
        let trackingIdentifier = trackingNumber || bookingReferenceNumber;
        
        // For eShip Plus, use booking reference number if available
        if (carrierInfo.name.toLowerCase().includes('eshipplus') || carrierInfo.name.includes('eship')) {
            // Match the logic from ShipmentDetail.jsx - prioritize proNumber/confirmationNumber
            trackingIdentifier = shipmentData?.carrierBookingConfirmation?.proNumber ||
                               shipmentData?.carrierBookingConfirmation?.confirmationNumber ||
                               bookingReferenceNumber || 
                               shipmentData?.selectedRate?.BookingReferenceNumber || 
                               shipmentData?.bookingReferenceNumber ||
                               trackingNumber;
            
            logger.info(`Using eShip Plus identifier: ${trackingIdentifier} (type: ${
                shipmentData?.carrierBookingConfirmation?.proNumber ? 'proNumber' :
                shipmentData?.carrierBookingConfirmation?.confirmationNumber ? 'confirmationNumber' :
                bookingReferenceNumber ? 'bookingReferenceNumber from request' :
                'other'
            })`);
        }
        // For Canpar, use barcode from selected rate
        else if (carrierInfo.name.toLowerCase().includes('canpar')) {
            trackingIdentifier = shipmentData?.selectedRate?.TrackingNumber ||
                               shipmentData?.selectedRate?.Barcode ||
                               shipmentData?.trackingNumber ||
                               trackingNumber;
            
            logger.info(`Using Canpar barcode: ${trackingIdentifier}`);
        }

        if (!trackingIdentifier) {
            throw new Error('No tracking identifier available for status check');
        }

        // Check status based on carrier
        let statusResult;
        const carrierName = carrierInfo.name.toLowerCase();

        logger.info(`Checking status for carrier: "${carrierInfo.name}" (normalized: "${carrierName}") with tracking identifier: ${trackingIdentifier}`);

        if (carrierName.includes('eshipplus') || carrierName.includes('eship') || carrierName.includes('e-ship')) {
            statusResult = await checkEShipPlusStatus(trackingIdentifier, carrierConfig);
        } else if (carrierName.includes('canpar')) {
            statusResult = await checkCanparStatus(trackingIdentifier, carrierConfig);
        } else if (carrierName.includes('fedex')) {
            statusResult = await checkFedExStatus(trackingIdentifier, carrierConfig);
        } else if (carrierName.includes('ups')) {
            statusResult = await checkUPSStatus(trackingIdentifier, carrierConfig);
        } else if (carrierName.includes('polaris') || carrierInfo.name.includes('POLARISTRANSPORTATION') || carrierConfig?.carrierID === 'POLARISTRANSPORTATION') {
            logger.info(`Detected Polaris Transportation shipment - calling checkPolarisTransportationStatus`);
            statusResult = await checkPolarisTransportationStatus(trackingIdentifier, carrierConfig);
        } else {
            logger.error(`Unsupported carrier detected: "${carrierInfo.name}" (normalized: "${carrierName}")`);
            throw new Error(`Unsupported carrier: ${carrierInfo.name}`);
        }

        return {
            success: true,
            ...statusResult,
            trackingIdentifier,
            carrierName: carrierInfo.name
        };

    } catch (error) {
        logger.error('Error in checkStatus:', error);
        return {
            success: false,
            error: error.message,
            trackingIdentifier: trackingNumber || bookingReferenceNumber,
            carrierName: carrier
        };
    }
}

/**
 * Get carrier configuration from Firestore
 */
async function getCarrierConfig(carrierKey) {
    try {
        // Normalize carrier key to handle variations
        const normalizeCarrierKey = (key) => {
            const normalized = key.toUpperCase();
            // Handle common variations
            if (normalized.includes('CANPAR')) return 'CANPAR';
            if (normalized.includes('ESHIP') || normalized.includes('E-SHIP')) return 'ESHIPPLUS';
            if (normalized.includes('FEDEX')) return 'FEDEX';
            if (normalized.includes('UPS')) return 'UPS';
            if (normalized.includes('DHL')) return 'DHL';
            if (normalized.includes('PUROLATOR')) return 'PUROLATOR';
            if (normalized.includes('CANADA POST')) return 'CANADAPOST';
            if (normalized.includes('USPS')) return 'USPS';
            if (normalized.includes('POLARIS')) return 'POLARISTRANSPORTATION';
            return normalized;
        };

        const normalizedKey = normalizeCarrierKey(carrierKey);
        logger.info(`Looking for carrier config with key: ${normalizedKey} (original: ${carrierKey})`);

        const carriersRef = db.collection('carriers');
        
        // First try with carrierKey
        let snapshot = await carriersRef
            .where('carrierKey', '==', normalizedKey)
            .where('enabled', '==', true)
            .limit(1)
            .get();

        // If not found, try with carrierID
        if (snapshot.empty) {
            logger.info(`No carrier found with carrierKey, trying carrierID: ${normalizedKey}`);
            snapshot = await carriersRef
                .where('carrierID', '==', normalizedKey)
                .where('enabled', '==', true)
                .limit(1)
                .get();
        }

        if (snapshot.empty) {
            logger.warn(`No enabled carrier found for key/ID: ${normalizedKey} (original: ${carrierKey})`);
            return null;
        }

        const carrierDoc = snapshot.docs[0];
        const carrierData = carrierDoc.data();

        logger.info(`Found carrier config for: ${normalizedKey} (original: ${carrierKey})`);
        
        return carrierData;

    } catch (error) {
        logger.error(`Error getting carrier config for ${carrierKey}:`, error);
        return null;
    }
}

/**
 * Determine carrier from shipment data
 */
function getShipmentCarrier(shipmentData) {
    try {
        // Try to get carrier from selected rate
        if (shipmentData.selectedRate?.CarrierName) {
            return {
                name: shipmentData.selectedRate.CarrierName,
                type: shipmentData.selectedRate.CarrierName.toLowerCase()
            };
        }
        
        // Try to get from carrier field
        if (shipmentData.carrier) {
            return {
                name: shipmentData.carrier,
                type: shipmentData.carrier.toLowerCase()
            };
        }
        
        // Try to get from rate data
        if (shipmentData.rates && shipmentData.rates.length > 0) {
            const firstRate = shipmentData.rates[0];
            if (firstRate.CarrierName) {
                return {
                    name: firstRate.CarrierName,
                    type: firstRate.CarrierName.toLowerCase()
                };
            }
        }
        
        logger.warn('Could not determine carrier from shipment data');
        return null;
        
    } catch (error) {
        logger.error('Error determining carrier from shipment data:', error);
        return null;
    }
}

/**
 * Check eShip Plus shipment status
 */
async function checkEShipPlusStatus(trackingNumber, carrierConfig) {
    try {
        logger.info(`Checking eShip Plus status for tracking number: ${trackingNumber}`);

        if (!carrierConfig.apiCredentials) {
            throw new Error('eShip Plus API credentials not configured');
        }

        // Use the new eShip Plus status checker
        const statusResult = await getEShipPlusStatus(trackingNumber, carrierConfig.apiCredentials);

        // Make sure trackingNumber is not undefined - use the booking reference we passed in
        return {
            success: true,
            carrier: 'eshipplus',
            trackingNumber: statusResult.trackingNumber || trackingNumber, // Fallback to input tracking number
            bookingReferenceNumber: trackingNumber, // Store the booking reference
            ...statusResult
        };

    } catch (error) {
        logger.error(`Error checking eShip Plus status:`, error);
        return {
            success: false,
            carrier: 'eshipplus',
            trackingNumber: trackingNumber, // Use the input tracking number
            bookingReferenceNumber: trackingNumber,
            error: error.message,
            status: 'unknown',
            statusDisplay: 'Unknown'
        };
    }
}

/**
 * Check Canpar shipment status
 */
async function checkCanparStatus(trackingNumber, carrierConfig) {
    try {
        logger.info(`Checking Canpar status for tracking number: ${trackingNumber}`);

        if (!carrierConfig.apiCredentials) {
            throw new Error('Canpar API credentials not configured');
        }

        // Use the new Canpar status checker
        const statusResult = await getCanparStatus(trackingNumber, carrierConfig.apiCredentials);

        return {
            success: true,
            carrier: 'canpar',
            trackingNumber,
            ...statusResult
        };

    } catch (error) {
        logger.error(`Error checking Canpar status:`, error);
        return {
            success: false,
            carrier: 'canpar',
            trackingNumber,
            error: error.message,
            status: 'unknown',
            statusDisplay: 'Unknown'
        };
    }
}

/**
 * Placeholder for FedEx status checking
 */
async function checkFedExStatus(trackingNumber, carrierConfig) {
    // TODO: Implement FedEx status checking
    logger.info(`FedEx status check requested for: ${trackingNumber}`);
    
    return {
        status: 'Unknown',
        location: '',
        timestamp: new Date().toISOString(),
        statusHistory: [],
        trackingUpdates: [],
        carrier: 'FEDEX',
        message: 'FedEx status checking not yet implemented'
    };
}

/**
 * Placeholder for UPS status checking
 */
async function checkUPSStatus(trackingNumber, carrierConfig) {
    // TODO: Implement UPS status checking
    logger.info(`UPS status check requested for: ${trackingNumber}`);
    
    return {
        status: 'Unknown',
        location: '',
        timestamp: new Date().toISOString(),
        statusHistory: [],
        trackingUpdates: [],
        carrier: 'UPS',
        message: 'UPS status checking not yet implemented'
    };
}

/**
 * Check Polaris Transportation shipment status
 */
async function checkPolarisTransportationStatus(trackingNumber, carrierConfig) {
    try {
        logger.info(`Checking Polaris Transportation status for tracking number: ${trackingNumber}`);

        if (!carrierConfig || !carrierConfig.apiCredentials) {
            throw new Error('Polaris Transportation API credentials not configured');
        }

        const credentials = carrierConfig.apiCredentials;
        const baseUrl = credentials.hostURL;
        const endpoint = credentials.endpoints?.tracking;
        const apiKey = credentials.secret;
        
        if (!baseUrl || !endpoint || !apiKey) {
            throw new Error('Polaris Transportation API configuration incomplete');
        }
        
        // Build URL and make API call (implementation would be similar to checkShipmentStatus.js)
        // For now, return a placeholder
        return {
            status: 'Unknown',
            location: '',
            timestamp: new Date().toISOString(),
            statusHistory: [],
            trackingUpdates: [],
            carrier: 'POLARISTRANSPORTATION',
            message: 'Polaris Transportation status checking - placeholder implementation'
        };

    } catch (error) {
        logger.error(`Error checking Polaris Transportation status:`, error);
        return {
            success: false,
            carrier: 'POLARISTRANSPORTATION',
            trackingNumber,
            error: error.message,
            status: 'unknown',
            statusDisplay: 'Unknown'
        };
    }
}

module.exports = {
    checkStatus
}; 