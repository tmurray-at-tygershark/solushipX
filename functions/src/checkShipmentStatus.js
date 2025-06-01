const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const axios = require('axios');

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
            const { trackingNumber, shipmentId, carrier } = req.body;

            if (!trackingNumber || !carrier) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required parameters: trackingNumber and carrier'
                });
            }

            logger.info(`Checking status for ${carrier} shipment: ${trackingNumber}`);

            // Get carrier configuration
            const carrierConfig = await getCarrierConfig(carrier);
            if (!carrierConfig) {
                return res.status(404).json({
                    success: false,
                    error: `Carrier configuration not found for: ${carrier}`
                });
            }

            // Check status based on carrier
            let statusData;
            switch (carrier.toUpperCase()) {
                case 'ESHIPPLUS':
                case 'ESHIP':
                    statusData = await checkEShipPlusStatus(trackingNumber, carrierConfig);
                    break;
                case 'CANPAR':
                    statusData = await checkCanparStatus(trackingNumber, carrierConfig);
                    break;
                case 'FEDEX':
                    statusData = await checkFedExStatus(trackingNumber, carrierConfig);
                    break;
                case 'UPS':
                    statusData = await checkUPSStatus(trackingNumber, carrierConfig);
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        error: `Status checking not implemented for carrier: ${carrier}`
                    });
            }

            // Return the status data
            res.json({
                success: true,
                shipmentId,
                trackingNumber,
                carrier,
                ...statusData
            });

        } catch (error) {
            logger.error('Error in checkShipmentStatus:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
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
        const snapshot = await carriersRef.where('carrierKey', '==', carrierKey.toUpperCase()).get();

        if (snapshot.empty) {
            logger.warn(`No carrier configuration found for: ${carrierKey}`);
            return null;
        }

        const carrierDoc = snapshot.docs[0];
        const config = carrierDoc.data();

        if (!config.apiCredentials || !config.apiCredentials.endpoints?.status) {
            logger.warn(`Status endpoint not configured for carrier: ${carrierKey}`);
            return null;
        }

        return config;
    } catch (error) {
        logger.error(`Error fetching carrier config for ${carrierKey}:`, error);
        return null;
    }
}

/**
 * Check eShip Plus shipment status
 */
async function checkEShipPlusStatus(trackingNumber, carrierConfig) {
    try {
        const { apiCredentials } = carrierConfig;
        const statusEndpoint = apiCredentials.endpoints.status;
        const hostURL = apiCredentials.hostURL;

        if (!statusEndpoint) {
            throw new Error('eShip Plus status endpoint not configured');
        }

        // Construct full URL
        const fullURL = `${hostURL}${statusEndpoint}`;

        // Prepare request data (adjust based on eShip Plus API requirements)
        const requestData = {
            TrackingNumber: trackingNumber,
            Username: apiCredentials.username,
            Password: apiCredentials.password,
            AccountNumber: apiCredentials.accountNumber
        };

        logger.info(`Making eShip Plus status request to: ${fullURL}`);

        const response = await axios.post(fullURL, requestData, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000,
            validateStatus: (status) => status >= 200 && status < 600
        });

        if (response.status >= 400) {
            throw new Error(`eShip Plus API error: ${response.status} - ${response.statusText}`);
        }

        // Parse eShip Plus response
        const statusData = parseEShipPlusStatusResponse(response.data, trackingNumber);
        
        logger.info(`eShip Plus status check successful for: ${trackingNumber}`);
        return statusData;

    } catch (error) {
        logger.error(`eShip Plus status check failed for ${trackingNumber}:`, error.message);
        throw new Error(`eShip Plus status check failed: ${error.message}`);
    }
}

/**
 * Parse eShip Plus status response
 */
function parseEShipPlusStatusResponse(responseData, trackingNumber) {
    try {
        // Handle different response formats from eShip Plus
        let statusInfo;
        
        if (responseData.TrackingResults) {
            statusInfo = responseData.TrackingResults;
        } else if (responseData.Results) {
            statusInfo = responseData.Results;
        } else if (Array.isArray(responseData)) {
            statusInfo = responseData[0];
        } else {
            statusInfo = responseData;
        }

        // Extract status information
        const status = statusInfo.Status || statusInfo.CurrentStatus || statusInfo.ShipmentStatus || 'Unknown';
        const location = statusInfo.Location || statusInfo.CurrentLocation || '';
        const timestamp = statusInfo.Timestamp || statusInfo.StatusDate || statusInfo.LastUpdate || new Date().toISOString();

        // Build status history
        const statusHistory = [];
        if (statusInfo.StatusHistory && Array.isArray(statusInfo.StatusHistory)) {
            statusHistory.push(...statusInfo.StatusHistory.map(item => ({
                status: item.Status || item.StatusDescription,
                timestamp: item.Timestamp || item.Date,
                location: item.Location || item.City,
                description: item.Description || item.Comments || ''
            })));
        } else {
            // Add current status to history
            statusHistory.push({
                status,
                timestamp,
                location,
                description: statusInfo.Description || statusInfo.Comments || ''
            });
        }

        // Extract delivery information if delivered
        let deliveryInfo = {};
        if (status.toLowerCase().includes('delivered')) {
            deliveryInfo = {
                deliveredAt: timestamp,
                deliveryLocation: location,
                signedBy: statusInfo.SignedBy || statusInfo.ReceivedBy || ''
            };
        }

        return {
            status: status,
            location: location,
            timestamp: timestamp,
            statusHistory: statusHistory,
            trackingUpdates: statusHistory,
            carrier: 'ESHIPPLUS',
            ...deliveryInfo
        };

    } catch (error) {
        logger.error('Error parsing eShip Plus status response:', error);
        throw new Error('Failed to parse status response');
    }
}

/**
 * Placeholder for Canpar status checking
 */
async function checkCanparStatus(trackingNumber, carrierConfig) {
    // TODO: Implement Canpar status checking
    logger.info(`Canpar status check requested for: ${trackingNumber}`);
    
    return {
        status: 'Unknown',
        location: '',
        timestamp: new Date().toISOString(),
        statusHistory: [],
        trackingUpdates: [],
        carrier: 'CANPAR',
        message: 'Canpar status checking not yet implemented'
    };
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