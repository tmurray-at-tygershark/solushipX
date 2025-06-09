const axios = require('axios');
const logger = require('firebase-functions/logger');
const functions = require('firebase-functions');
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getCarrierApiConfig, validateCarrierEndpoints } = require('../../utils');

/**
 * Polaris Transportation Status Codes Mapping
 * Map actual Polaris API status codes to universal status
 */
const POLARIS_STATUS_MAP = {
    // ACTUAL POLARIS API STATUS CODES (from real API)
    
    // Pre-shipment and Entry Phase
    'ENTERD/DR': 'pending',      // shipment entered in system
    'ENTERED': 'pending',        // shipment entered in system
    
    // Pickup and Transit Phase
    'SCHED PICK/DR': 'scheduled', // scheduled for pickup
    'SCHED FOR PICK.': 'scheduled', // scheduled for pickup
    'PICKED UP/DR': 'in_transit', // shipment picked up
    'PICKED UP': 'in_transit',    // shipment picked up
    
    // Arrival and Terminal Phases
    'ARRV_ORIG': 'in_transit',    // Arrival
    'ARRV_DEST': 'in_transit',    // Arrival at Destination
    
    // Transit Phases
    'IN TRANSIT': 'in_transit',   // shipment in transit
    'IN TRANSIT/DR': 'in_transit', // shipment in transit
    'IN TRNS/ON FILE': 'in_transit', // shipment in transit
    
    // Customs and Delays
    'IN BOND': 'in_transit',      // in bond
    'CUSTOMS HOLD': 'on_hold',    // customs is holding
    'CUSTOMS_CLEARED': 'in_transit', // cleared customs
    'VOLUME DELAY': 'on_hold',    // volume delay
    
    // Delivery Phases
    'SCHED FOR DELV': 'in_transit', // scheduled for delivery
    'OUT FOR DEL': 'in_transit',  // shipment in transit for delivery
    'DELIVERED': 'delivered',     // shipment delivered
    'DELVD/BILLED': 'delivered',  // shipment delivered and billed
    
    // Cancellation
    'CANCELLED': 'canceled',      // shipment cancelled and voided
    
    // Legacy mappings for backward compatibility
    'BOOKED': 'booked',
    'SCHEDULED': 'scheduled',
    'PICKUP_SCHEDULED': 'scheduled',
    'COMPLETED': 'delivered',
    'CANCELED': 'canceled',
    'ON_HOLD': 'on_hold',
    'DELAYED': 'on_hold',
    'EXCEPTION': 'on_hold'
};

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
        status: universalStatus,
        statusDisplay: getStatusDisplayName(universalStatus),
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
        }
    };
}

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
 * Transform Polaris Transportation history response to universal format
 * @param {Object} polarisData - Raw API response from Polaris Transportation
 * @param {string} trackingNumber - Original tracking number
 * @returns {Object} - Transformed history response
 */
function transformPolarisHistoryToUniversal(polarisData, trackingNumber) {
    logger.info('Transforming Polaris Transportation history response:', polarisData);

    // Get the shipment info (could be in different structures)
    const shipmentInfo = polarisData.Shipments?.[0] || 
                        polarisData.TrackingResults?.[0] || 
                        polarisData;

    // Extract tracking events with enhanced processing
    const trackingEvents = [];
    
    if (shipmentInfo.History || shipmentInfo.TrackingHistory || shipmentInfo.Events) {
        const events = shipmentInfo.History || shipmentInfo.TrackingHistory || shipmentInfo.Events;
        
        events.forEach((event, index) => {
            const eventDate = event.Date || event.EventDate || event.DateTime || event.Timestamp;
            
            if (eventDate) {
                trackingEvents.push({
                    id: `polaris_${index}`,
                    date: new Date(eventDate).toISOString(),
                    location: [
                        event.Location,
                        event.City,
                        event.State,
                        event.Province
                    ].filter(Boolean).join(', ') || '',
                    description: event.Description || 
                               event.Activity || 
                               event.Status || 
                               event.Message || 
                               'Status update',
                    statusCode: event.StatusCode || event.Code || '',
                    carrierCode: event.StatusCode || event.Code || '',
                    eventType: event.EventType || event.Type || 'UPDATE',
                    facility: event.Facility || event.Terminal || '',
                    comments: event.Comments || event.Notes || '',
                    carrier: 'Polaris Transportation',
                    rawEvent: event
                });
            }
        });
    }

    // Sort events by date (newest first)
    trackingEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Get current status using the same logic as getStatus
    const currentStatusInfo = mapPolarisStatusToUniversal(polarisData, trackingNumber);

    return {
        success: true,
        trackingNumber: shipmentInfo.TrackingNumber || trackingNumber,
        status: currentStatusInfo.status,
        statusDisplay: currentStatusInfo.statusDisplay,
        lastUpdated: new Date().toISOString(),
        
        // Shipment information
        shipmentInfo: {
            orderNumber: shipmentInfo.OrderNumber || shipmentInfo.BookingReference || '',
            proNumber: shipmentInfo.ProNumber || shipmentInfo.PRO || '',
            bookingDate: shipmentInfo.BookingDate || shipmentInfo.OrderDate || null,
            service: shipmentInfo.ServiceType || 'Standard LTL',
            weight: shipmentInfo.TotalWeight || 0,
            pieces: shipmentInfo.TotalPieces || 0
        },
        
        // Address information
        origin: {
            company: safeAccess(shipmentInfo, 'Shipper.Company') || safeAccess(shipmentInfo, 'Origin.Company'),
            address: safeAccess(shipmentInfo, 'Shipper.Address') || safeAccess(shipmentInfo, 'Origin.Address'),
            city: safeAccess(shipmentInfo, 'Shipper.City') || safeAccess(shipmentInfo, 'Origin.City'),
            state: safeAccess(shipmentInfo, 'Shipper.State') || safeAccess(shipmentInfo, 'Origin.State'),
            postalCode: safeAccess(shipmentInfo, 'Shipper.PostalCode') || safeAccess(shipmentInfo, 'Origin.PostalCode'),
            country: safeAccess(shipmentInfo, 'Shipper.Country') || safeAccess(shipmentInfo, 'Origin.Country')
        },
        
        destination: {
            company: safeAccess(shipmentInfo, 'Consignee.Company') || safeAccess(shipmentInfo, 'Destination.Company'),
            address: safeAccess(shipmentInfo, 'Consignee.Address') || safeAccess(shipmentInfo, 'Destination.Address'),
            city: safeAccess(shipmentInfo, 'Consignee.City') || safeAccess(shipmentInfo, 'Destination.City'),
            state: safeAccess(shipmentInfo, 'Consignee.State') || safeAccess(shipmentInfo, 'Destination.State'),
            postalCode: safeAccess(shipmentInfo, 'Consignee.PostalCode') || safeAccess(shipmentInfo, 'Destination.PostalCode'),
            country: safeAccess(shipmentInfo, 'Consignee.Country') || safeAccess(shipmentInfo, 'Destination.Country')
        },
        
        // Timeline/events
        events: trackingEvents,
        
        // Key dates
        dates: currentStatusInfo.shipmentDates,
        
        // Carrier information
        carrierInfo: currentStatusInfo.carrierInfo,
        
        // Estimated delivery (if available)
        estimatedDelivery: currentStatusInfo.estimatedDelivery,
        actualDelivery: currentStatusInfo.actualDelivery,
        
        // Raw data for debugging
        rawData: {
            carrier: 'polaristransportation',
            source: 'history_api',
            eventsCount: trackingEvents.length,
            rawResponse: polarisData
        }
    };
}

/**
 * Fetch shipment history from Polaris Transportation
 * @param {string} trackingNumber - The tracking/booking reference number
 * @param {Object} credentials - Polaris Transportation API credentials
 * @returns {Promise<Object>} - Formatted history response
 */
async function fetchPolarisTransportationHistory(trackingNumber, credentials) {
    try {
        logger.info(`Fetching Polaris Transportation history for tracking: ${trackingNumber}`);

        // Get URL components from credentials
        const baseUrl = credentials.hostURL;
        const endpoint = credentials.endpoints?.tracking; // Same endpoint as status
        
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

        logger.info(`Polaris Transportation history URL: ${url}`);

        // Create auth headers
        const authHeaders = createPolarisAuthHeaders(credentials);
        
        logger.info('Polaris Transportation auth headers created successfully');

        // Prepare tracking request with detailed history
        const trackingRequest = {
            AccountNumber: credentials.accountNumber || "000605",
            TrackingNumbers: [trackingNumber],
            IncludeHistory: true,
            IncludeDetails: true,
            IncludeEvents: true
        };

        // Make the API call
        const response = await axios.post(url, trackingRequest, {
            headers: authHeaders,
            timeout: 30000,
            validateStatus: function (status) {
                return status < 600;
            }
        });

        logger.info(`Polaris Transportation history response status: ${response.status}`);
        
        // Check for HTTP errors
        if (response.status >= 400) {
            throw new Error(`API request failed - ${response.status} ${response.statusText}`);
        }

        const historyData = response.data;
        logger.info(`Polaris Transportation history response data available`);

        // If no data or empty response
        if (!historyData) {
            logger.warn('Empty response from Polaris Transportation history API');
            return {
                success: false,
                error: 'No history data available',
                trackingNumber,
                events: []
            };
        }

        // Check for API errors in the response
        if (historyData.Error || historyData.Success === false) {
            throw new Error(`Polaris Transportation API Error: ${historyData.Error || 'Unknown error'}`);
        }

        // Transform to universal format
        const transformedHistory = transformPolarisHistoryToUniversal(historyData, trackingNumber);
        
        logger.info(`Successfully transformed Polaris Transportation history for ${trackingNumber}`, {
            eventsCount: transformedHistory.events?.length || 0,
            status: transformedHistory.status
        });
        
        return transformedHistory;

    } catch (error) {
        logger.error(`Error fetching Polaris Transportation history for ${trackingNumber}:`, error.message);
        
        if (error.response) {
            logger.error(`API Response Error:`, {
                status: error.response.status,
                statusText: error.response.statusText,
                data: typeof error.response.data === 'string' 
                    ? error.response.data.substring(0, 500) 
                    : error.response.data
            });
        }
        
        throw new Error(`Failed to get Polaris Transportation history: ${error.message}`);
    }
}

/**
 * Main history function that can be called by the carrier API
 * @param {string} trackingNumber - Tracking number to look up
 * @returns {Promise<Object>} - History response
 */
async function getHistoryPolarisTransportation(trackingNumber) {
    try {
        logger.info(`Getting Polaris Transportation history for: ${trackingNumber}`);
        
        // Get carrier API configuration
        const carrierConfig = await getCarrierApiConfig('POLARISTRANSPORTATION', 'tracking');
        const { credentials } = carrierConfig;
        
        // Validate that the carrier has the required endpoints
        if (!validateCarrierEndpoints(credentials, ['tracking'])) {
            throw new Error('Polaris Transportation carrier missing required tracking endpoint configuration');
        }
        
        return await fetchPolarisTransportationHistory(trackingNumber, credentials);
        
    } catch (error) {
        logger.error(`Error in getHistoryPolarisTransportation:`, error.message);
        throw error;
    }
}

/**
 * Export v2 callable function for Firebase Cloud Functions
 */
exports.getHistoryPolarisTransportation = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
    region: 'us-central1'
}, async (request) => {
    logger.info('getHistoryPolarisTransportation onCall handler invoked. Auth context:', request.auth ? 'Present' : 'Absent');
    
    try {
        const trackingNumber = request.data?.trackingNumber;
        if (!trackingNumber) {
            throw new functions.https.HttpsError('invalid-argument', 'Tracking number is required');
        }
        
        return await getHistoryPolarisTransportation(trackingNumber);
    } catch (error) {
        if (error.code && error.httpErrorCode) {
            logger.error(`HttpsError: Code - ${error.code}, Message - ${error.message}, Details - ${JSON.stringify(error.details)}`);
        }
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'Internal server error during history request.', {stack: error.stack});
    }
}); 