const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const axios = require('axios');

// Import carrier-specific status checkers
const { getEShipPlusStatus } = require('./carrier-api/eshipplus/getStatus');
const { getCanparStatus } = require('./carrier-api/canpar/getStatus');

// Initialize Firebase Admin if not already initialized
try {
    initializeApp();
} catch (error) {
    // App already initialized
}

const db = getFirestore();

/**
 * Check shipment status across different carriers
 */
exports.checkShipmentStatus = onRequest(
    {
        cors: true,
        timeoutSeconds: 540,
        memory: '1GiB'
    },
    async (req, res) => {
        try {
            const { trackingNumber, shipmentId, carrier, bookingReferenceNumber } = req.body;

            if (!trackingNumber && !shipmentId) {
                return res.status(400).json({
                    success: false,
                    error: 'Either trackingNumber or shipmentId is required'
                });
            }

            let shipmentData = null;
            let carrierInfo = null;

            // If shipmentId is provided, get shipment data from Firestore
            if (shipmentId) {
                const shipmentRef = db.collection('shipments').doc(shipmentId);
                const shipmentDoc = await shipmentRef.get();
                
                if (!shipmentDoc.exists) {
                    return res.status(404).json({
                        success: false,
                        error: 'Shipment not found'
                    });
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
                return res.status(400).json({
                    success: false,
                    error: 'Could not determine carrier'
                });
            }

            // Get carrier configuration
            const carrierConfig = await getCarrierConfig(carrierInfo.name);
            if (!carrierConfig) {
                return res.status(404).json({
                    success: false,
                    error: `Carrier configuration not found for: ${carrierInfo.name}`
                });
            }

            // Determine the correct tracking identifier
            let trackingIdentifier = trackingNumber;
            
            // For eShip Plus, use booking reference number if available
            if (carrierInfo.name.toLowerCase().includes('eshipplus') || carrierInfo.name.toLowerCase().includes('eship')) {
                trackingIdentifier = bookingReferenceNumber || 
                                   shipmentData?.selectedRate?.BookingReferenceNumber || 
                                   shipmentData?.bookingReferenceNumber ||
                                   trackingNumber;
                
                logger.info(`Using eShip Plus booking reference: ${trackingIdentifier}`);
            }
            // For Canpar, use barcode from selected rate
            else if (carrierInfo.name.toLowerCase().includes('canpar')) {
                trackingIdentifier = shipmentData?.selectedRate?.TrackingNumber ||
                                   shipmentData?.selectedRate?.Barcode ||
                                   shipmentData?.trackingNumber ||
                                   trackingNumber;
                
                logger.info(`Using Canpar barcode: ${trackingIdentifier}`);
            }

            // Check status based on carrier
            let statusResult;
            const carrierName = carrierInfo.name.toLowerCase();

            if (carrierName.includes('eshipplus') || carrierName.includes('eship')) {
                statusResult = await checkEShipPlusStatus(trackingIdentifier, carrierConfig);
            } else if (carrierName.includes('canpar')) {
                statusResult = await checkCanparStatus(trackingIdentifier, carrierConfig);
            } else if (carrierName.includes('fedex')) {
                statusResult = await checkFedExStatus(trackingIdentifier, carrierConfig);
            } else if (carrierName.includes('ups')) {
                statusResult = await checkUPSStatus(trackingIdentifier, carrierConfig);
            } else {
                return res.status(400).json({
                    success: false,
                    error: `Unsupported carrier: ${carrierInfo.name}`
                });
            }

            // Update shipment status in Firestore if shipmentId provided
            if (shipmentId && statusResult.success) {
                const updateData = {
                    status: statusResult.status,
                    statusLastChecked: new Date(),
                    carrierTrackingData: statusResult
                };

                // Add estimated delivery if available
                if (statusResult.estimatedDelivery) {
                    updateData.estimatedDelivery = new Date(statusResult.estimatedDelivery);
                }

                // Add actual delivery if available
                if (statusResult.actualDelivery) {
                    updateData.actualDelivery = new Date(statusResult.actualDelivery);
                }

                await db.collection('shipments').doc(shipmentId).update(updateData);
                logger.info(`Updated shipment ${shipmentId} with new status: ${statusResult.status}`);
            }

            return res.status(200).json(statusResult);

        } catch (error) {
            logger.error('Error in checkShipmentStatus:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * Get carrier configuration from Firestore
 */
async function getCarrierConfig(carrierKey) {
    try {
        const carriersRef = db.collection('carriers');
        const snapshot = await carriersRef
            .where('carrierKey', '==', carrierKey.toUpperCase())
            .where('enabled', '==', true)
            .limit(1)
            .get();

        if (snapshot.empty) {
            logger.warn(`No enabled carrier found for key: ${carrierKey}`);
            return null;
        }

        const carrierDoc = snapshot.docs[0];
        const carrierData = carrierDoc.data();

        logger.info(`Found carrier config for: ${carrierKey}`);
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

        return {
            success: true,
            carrier: 'eshipplus',
            trackingNumber,
            ...statusResult
        };

    } catch (error) {
        logger.error(`Error checking eShip Plus status:`, error);
        return {
            success: false,
            carrier: 'eshipplus',
            trackingNumber,
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