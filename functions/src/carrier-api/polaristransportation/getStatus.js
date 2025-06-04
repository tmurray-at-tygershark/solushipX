const axios = require('axios');
const logger = require('firebase-functions/logger');
const functions = require('firebase-functions');
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getCarrierApiConfig, validateCarrierEndpoints } = require('../../utils');

/**
 * Polaris Transportation Status Codes Mapping
 * Map common status codes to universal status
 */
const POLARIS_STATUS_MAP = {
    'BOOKED': 'booked',
    'SCHEDULED': 'scheduled',
    'PICKUP_SCHEDULED': 'scheduled',
    'PICKED_UP': 'in_transit',
    'IN_TRANSIT': 'in_transit',
    'OUT_FOR_DELIVERY': 'in_transit',
    'DELIVERED': 'delivered',
    'COMPLETED': 'delivered',
    'CANCELLED': 'canceled',
    'CANCELED': 'canceled',
    'ON_HOLD': 'on_hold',
    'DELAYED': 'on_hold',
    'EXCEPTION': 'on_hold'
};

/**
 * Helper to safely access nested properties
 */
const safeAccess = (obj, path, defaultValue = null) => {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return defaultValue;
        }
    }
    return current;
};

/**
 * Create Polaris Transportation auth headers
 * @param {Object} credentials - Carrier credentials
 * @returns {Object} - Headers object
 */
function createPolarisAuthHeaders(credentials) {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Username': credentials.username || '',
        'Authorization': `Bearer ${credentials.accountNumber || ''}`,
    };
}

/**
 * Get shipment status from Polaris Transportation
 * @param {string} trackingNumber - The tracking/booking reference number
 * @param {Object} credentials - Polaris Transportation API credentials
 * @returns {Promise<Object>} - Formatted status response
 */
async function getPolarisTransportationStatus(trackingNumber, credentials) {
    try {
        logger.info(`Getting Polaris Transportation status for tracking: ${trackingNumber}`);

        // Get URL components from credentials
        const baseUrl = credentials.hostURL;
        const endpoint = credentials.endpoints?.tracking;
        
        if (!baseUrl) {
            throw new Error('Polaris Transportation hostURL not configured in carrier settings');
        }
        
        if (!endpoint) {
            throw new Error('Polaris Transportation tracking endpoint not configured in carrier settings');
        }
        
        // Build full URL
        const cleanBaseUrl = baseUrl.replace(/\/$/, '');
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${cleanBaseUrl}${cleanEndpoint}`;

        logger.info(`Polaris Transportation tracking URL: ${url}`);

        // Create auth headers
        const authHeaders = createPolarisAuthHeaders(credentials);
        
        logger.info('Polaris Transportation auth headers created successfully');

        // Prepare tracking request
        const trackingRequest = {
            AccountNumber: credentials.accountNumber || "000605",
            TrackingNumbers: [trackingNumber],
            IncludeHistory: true
        };

        // Make the API call
        const response = await axios.post(url, trackingRequest, {
            headers: authHeaders,
            timeout: 30000,
            validateStatus: function (status) {
                return status < 600;
            }
        });

        logger.info(`Polaris Transportation response status: ${response.status}`);
        
        // Check for HTTP errors
        if (response.status >= 400) {
            throw new Error(`API request failed - ${response.status} ${response.statusText}`);
        }

        const statusData = response.data;
        logger.info(`Polaris Transportation status response:`, { 
            statusData: typeof statusData === 'string' ? statusData.substring(0, 200) : statusData 
        });

        // If no data or empty response
        if (!statusData) {
            logger.warn('Empty response from Polaris Transportation API');
            return {
                success: true,
                status: 'unknown',
                statusDisplay: 'Unknown',
                lastUpdated: new Date().toISOString(),
                trackingEvents: [],
                rawData: {
                    carrier: 'polaristransportation',
                    statusSource: 'empty_response'
                }
            };
        }

        // Check for API errors in the response
        if (statusData.Error || statusData.Success === false) {
            throw new Error(`Polaris Transportation API Error: ${statusData.Error || 'Unknown error'}`);
        }

        // Map to universal format
        const universalStatus = mapPolarisStatusToUniversal(statusData, trackingNumber);
        
        logger.info(`Mapped to universal status:`, { universalStatus });
        return universalStatus;

    } catch (error) {
        logger.error(`Error getting Polaris Transportation status for ${trackingNumber}:`, error.message);
        
        if (error.response) {
            logger.error(`API Response Error:`, {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers,
                data: typeof error.response.data === 'string' 
                    ? error.response.data.substring(0, 500) 
                    : error.response.data
            });
        }
        
        throw new Error(`Failed to get Polaris Transportation status: ${error.message}`);
    }
}

/**
 * Map Polaris Transportation status response to universal format
 * @param {Object} polarisData - Polaris Transportation status response
 * @param {string} trackingNumber - Original tracking number
 * @returns {Object} - Universal status format
 */
function mapPolarisStatusToUniversal(polarisData, trackingNumber) {
    // Get the shipment info (could be in different structures)
    const shipmentInfo = polarisData.Shipments?.[0] || 
                        polarisData.TrackingResults?.[0] || 
                        polarisData;

    let universalStatus = 'unknown';
    let statusSource = 'default';

    // Determine status from multiple sources
    if (shipmentInfo.Status) {
        const normalizedStatus = shipmentInfo.Status.toUpperCase();
        if (POLARIS_STATUS_MAP[normalizedStatus]) {
            universalStatus = POLARIS_STATUS_MAP[normalizedStatus];
            statusSource = 'main_status';
        }
    } else if (shipmentInfo.CurrentStatus) {
        const normalizedStatus = shipmentInfo.CurrentStatus.toUpperCase();
        if (POLARIS_STATUS_MAP[normalizedStatus]) {
            universalStatus = POLARIS_STATUS_MAP[normalizedStatus];
            statusSource = 'current_status';
        }
    }

    // Check for delivery confirmation
    if (shipmentInfo.DeliveredDate || shipmentInfo.ActualDeliveryDate) {
        universalStatus = 'delivered';
        statusSource = 'delivery_date';
    } else if (shipmentInfo.PickupDate || shipmentInfo.ActualPickupDate) {
        if (universalStatus === 'unknown' || universalStatus === 'scheduled') {
            universalStatus = 'in_transit';
            statusSource = 'pickup_date';
        }
    }

    // Prepare tracking events from history
    const trackingEvents = [];
    
    if (shipmentInfo.History || shipmentInfo.TrackingHistory) {
        const events = shipmentInfo.History || shipmentInfo.TrackingHistory;
        events.forEach(event => {
            if (event.Date || event.EventDate) {
                trackingEvents.push({
                    date: event.Date || event.EventDate,
                    location: event.Location || event.City || '',
                    description: event.Description || event.Activity || event.Status || '',
                    statusCode: event.StatusCode || event.Code || '',
                    carrierCode: event.StatusCode || event.Code || ''
                });
            }
        });
    }

    // Sort events by date (newest first)
    trackingEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate dates
    const estimatedDelivery = shipmentInfo.EstimatedDeliveryDate || 
                             shipmentInfo.EstDeliveryDate || 
                             null;
    
    const actualDelivery = shipmentInfo.DeliveredDate || 
                          shipmentInfo.ActualDeliveryDate || 
                          null;

    const estimatedPickup = shipmentInfo.EstimatedPickupDate || 
                           shipmentInfo.EstPickupDate || 
                           null;

    const actualPickup = shipmentInfo.PickupDate || 
                        shipmentInfo.ActualPickupDate || 
                        null;

    return {
        success: true,
        trackingNumber: shipmentInfo.TrackingNumber || trackingNumber,
        status: universalStatus,
        statusDisplay: getStatusDisplayName(universalStatus),
        lastUpdated: new Date().toISOString(),
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery).toISOString() : null,
        actualDelivery: actualDelivery ? new Date(actualDelivery).toISOString() : null,
        carrierInfo: {
            carrierName: 'Polaris Transportation',
            carrierCode: 'POLT',
            serviceType: shipmentInfo.ServiceType || 'Standard LTL',
            trackingNumber: shipmentInfo.TrackingNumber || trackingNumber,
            proNumber: shipmentInfo.ProNumber || shipmentInfo.PRO || ''
        },
        shipmentDates: {
            created: shipmentInfo.BookingDate || shipmentInfo.OrderDate || null,
            estimatedPickup: estimatedPickup ? new Date(estimatedPickup).toISOString() : null,
            actualPickup: actualPickup ? new Date(actualPickup).toISOString() : null,
            estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery).toISOString() : null,
            actualDelivery: actualDelivery ? new Date(actualDelivery).toISOString() : null
        },
        trackingEvents,
        rawData: {
            carrier: 'polaristransportation',
            statusSource,
            originalStatus: shipmentInfo.Status || shipmentInfo.CurrentStatus,
            eventsCount: trackingEvents.length
        }
    };
}

/**
 * Get display name for universal status
 */
function getStatusDisplayName(status) {
    const displayNames = {
        'draft': 'Draft',
        'pending': 'Pending',
        'scheduled': 'Scheduled',
        'booked': 'Booked',
        'awaiting_shipment': 'Awaiting Shipment',
        'in_transit': 'In Transit',
        'delivered': 'Delivered',
        'on_hold': 'On Hold',
        'canceled': 'Canceled',
        'cancelled': 'Cancelled',
        'void': 'Void',
        'unknown': 'Unknown'
    };
    return displayNames[status] || status;
}

/**
 * Main status function that can be called by the carrier API
 * @param {string} trackingNumber - Tracking number to look up
 * @returns {Promise<Object>} - Status response
 */
async function getStatusPolarisTransportation(trackingNumber) {
    try {
        logger.info(`Getting Polaris Transportation status for: ${trackingNumber}`);
        
        // Get carrier API configuration
        const carrierConfig = await getCarrierApiConfig('POLARISTRANSPORTATION', 'tracking');
        const { credentials } = carrierConfig;
        
        // Validate that the carrier has the required endpoints
        if (!validateCarrierEndpoints(credentials, ['tracking'])) {
            throw new Error('Polaris Transportation carrier missing required tracking endpoint configuration');
        }
        
        return await getPolarisTransportationStatus(trackingNumber, credentials);
        
    } catch (error) {
        logger.error(`Error in getStatusPolarisTransportation:`, error.message);
        throw error;
    }
}

/**
 * Export v2 callable function for Firebase Cloud Functions
 */
exports.getStatusPolarisTransportation = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
    region: 'us-central1'
}, async (request) => {
    logger.info('getStatusPolarisTransportation onCall handler invoked. Auth context:', request.auth ? 'Present' : 'Absent');
    
    try {
        const trackingNumber = request.data?.trackingNumber;
        if (!trackingNumber) {
            throw new functions.https.HttpsError('invalid-argument', 'Tracking number is required');
        }
        
        return await getStatusPolarisTransportation(trackingNumber);
    } catch (error) {
        if (error.code && error.httpErrorCode) {
            logger.error(`HttpsError: Code - ${error.code}, Message - ${error.message}, Details - ${JSON.stringify(error.details)}`);
        }
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'Internal server error during status request.', {stack: error.stack});
    }
}); 