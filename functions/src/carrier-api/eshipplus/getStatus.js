const axios = require('axios');
const logger = require('firebase-functions/logger');
const { createEShipPlusAuthHeader } = require('../../utils');

/**
 * eShip Plus Status Codes Mapping
 * 0 = Scheduled, 1 = InTransit, 2 = Delivered, 3 = Invoiced, 4 = Void
 */
const ESHIP_STATUS_MAP = {
    0: 'scheduled',      // Scheduled
    1: 'in_transit',     // InTransit  
    2: 'delivered',      // Delivered
    3: 'delivered',      // Invoiced (treat as delivered)
    4: 'void'           // Void
};

/**
 * eShip Plus Check Call Status Codes to Universal Status
 */
const CHECK_CALL_STATUS_MAP = {
    // Pickup/Loading Related
    'AF': 'in_transit',    // carrier departed pickup location with shipment
    'CP': 'in_transit',    // completed loading at pickup location
    'X3': 'in_transit',    // arrived at pickup location
    'X8': 'in_transit',    // arrived at pickup location loading dock
    'BA': 'in_transit',    // connecting line or cartage pick-up
    'L1': 'in_transit',    // loading
    
    // In Transit - General Movement
    'AN': 'in_transit',    // diverted to air carrier
    'AM': 'in_transit',    // loaded on truck
    'P1': 'in_transit',    // departed terminal location
    'X6': 'in_transit',    // en route to delivery location
    'X4': 'in_transit',    // arrived at terminal location
    'B6': 'in_transit',    // estimated to arrive at carrier terminal
    'C1': 'in_transit',    // estimated to depart terminal location
    'BC': 'in_transit',    // storage in transit
    'CD': 'in_transit',    // carrier departed delivery location
    'I1': 'in_transit',    // in-gate
    'K1': 'in_transit',    // arrived at customs
    'OA': 'in_transit',    // out-gate
    'R1': 'in_transit',    // received from prior carrier
    'AR': 'in_transit',    // rail arrival at destination intermodal ramp
    'RL': 'in_transit',    // rail departure from origin intermodal ramp
    'CL': 'in_transit',    // trailer closed out
    
    // Delivery Related
    'AG': 'in_transit',    // estimated delivery
    'AH': 'in_transit',    // attempted delivery
    'AJ': 'in_transit',    // tendered for delivery
    'AV': 'awaiting_shipment', // available for delivery
    'X1': 'in_transit',    // arrived at delivery location
    'X2': 'in_transit',    // estimated date/time of arrival at consignee
    'X5': 'in_transit',    // arrived at delivery location loading dock
    'S1': 'in_transit',    // trailer spotted at consignee's location
    'D1': 'delivered',     // completed unloading at delivery location
    'J1': 'delivered',     // delivered to connecting line
    
    // Issues/Exceptions/Holds
    'A3': 'on_hold',       // shipment returned to shipper
    'A7': 'on_hold',       // refused by consignee
    'A9': 'on_hold',       // shipment damaged
    'AP': 'on_hold',       // delivery not completed
    'SD': 'on_hold',       // shipment delayed
    'CA': 'canceled',      // shipment cancelled
    'PR': 'on_hold',       // U.S. customs hold at origin intermodal ramp
    'AI': 'on_hold',       // shipment has been reconsigned
    
    // Administrative/Processing
    'XB': 'scheduled',     // shipment acknowledged
    'OO': 'scheduled',     // paperwork received - did not receive shipment or equipment
    'AA': 'scheduled'      // shipment created
};

/**
 * Get shipment status from eShip Plus
 * @param {string} bookingReferenceNumber - The booking reference number
 * @param {Object} credentials - eShip Plus API credentials
 * @returns {Promise<Object>} - Formatted status response
 */
async function getEShipPlusStatus(bookingReferenceNumber, credentials) {
    try {
        logger.info(`Getting eShip Plus status for booking: ${bookingReferenceNumber}`);

        // Get URL components from credentials only - no hardcoded defaults
        const baseUrl = credentials.hostURL;
        const endpoint = credentials.endpoints?.status;
        
        if (!baseUrl) {
            throw new Error('eShip Plus hostURL not configured in carrier settings');
        }
        
        if (!endpoint) {
            throw new Error('eShip Plus status endpoint not configured in carrier settings');
        }
        
        // Remove trailing slash from baseUrl
        const cleanBaseUrl = baseUrl.replace(/\/$/, '');
        
        // Ensure endpoint starts with /
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        
        // Build full URL
        const url = `${cleanBaseUrl}${cleanEndpoint}`;

        logger.info(`eShip Plus status URL: ${url}`);
        logger.info(`Using credentials:`, {
            username: credentials.username,
            hasPassword: !!credentials.password,
            hasSecret: !!credentials.secret,
            hasAccountNumber: !!credentials.accountNumber,
            hasEndpoints: !!credentials.endpoints,
            statusEndpoint: credentials.endpoints?.status
        });

        // Create eShipPlus auth header using the same method as getRates
        const eShipPlusAuthHeader = createEShipPlusAuthHeader(credentials);
        
        logger.info('eShipPlusAuth header created successfully');

        // Make the API call - body is just the booking reference number as a string
        const response = await axios.post(url, `"${bookingReferenceNumber}"`, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'eShipPlusAuth': eShipPlusAuthHeader
            },
            timeout: 30000, // 30 second timeout
            validateStatus: function (status) {
                // Accept any status code to handle errors properly
                return status < 600;
            }
        });

        logger.info(`eShip Plus response status: ${response.status}`);
        
        // Check if we got an HTML response (likely login page)
        if (response.headers['content-type']?.includes('text/html')) {
            logger.error('Received HTML response instead of JSON - likely authentication failure');
            throw new Error('Authentication failed - received login page instead of API response');
        }

        // Check for 401/403 authentication errors
        if (response.status === 401 || response.status === 403) {
            throw new Error(`Authentication failed - ${response.status} ${response.statusText}`);
        }

        // Check for other HTTP errors
        if (response.status >= 400) {
            throw new Error(`API request failed - ${response.status} ${response.statusText}`);
        }

        const statusData = response.data;
        logger.info(`eShip Plus status response:`, { 
            statusData: typeof statusData === 'string' ? statusData.substring(0, 200) : statusData 
        });

        // If response is a string and contains HTML, it's likely an error
        if (typeof statusData === 'string' && statusData.includes('<!doctype html>')) {
            throw new Error('Received HTML response instead of JSON - authentication or endpoint issue');
        }

        // If no data or empty response
        if (!statusData) {
            logger.warn('Empty response from eShip Plus API');
            return {
                success: true,
                status: 'unknown',
                statusDisplay: 'Unknown',
                lastUpdated: new Date().toISOString(),
                trackingEvents: [],
                rawData: {
                    carrier: 'eshipplus',
                    statusSource: 'empty_response',
                    checkCallsCount: 0
                }
            };
        }

        // Check for API errors in the response
        if (statusData.ContainsErrorMessage) {
            const errorMessages = statusData.Messages?.filter(m => m.Type === 0).map(m => m.Value) || ['Unknown error'];
            throw new Error(`eShip Plus API Error: ${errorMessages.join(', ')}`);
        }

        // Map to universal format
        const universalStatus = mapEShipPlusStatusToUniversal(statusData);
        
        logger.info(`Mapped to universal status:`, { universalStatus });
        return universalStatus;

    } catch (error) {
        logger.error(`Error getting eShip Plus status for ${bookingReferenceNumber}:`, error.message);
        
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
        
        throw new Error(`Failed to get eShip Plus status: ${error.message}`);
    }
}

/**
 * Map eShip Plus status response to universal format
 * @param {Object} eshipData - eShip Plus status response
 * @returns {Object} - Universal status format
 */
function mapEShipPlusStatusToUniversal(eshipData) {
    // Determine status from multiple sources
    let universalStatus = 'unknown';
    let statusSource = 'default';

    // 1. Check actual delivery/pickup dates first (most reliable)
    if (eshipData.IsDelivered && eshipData.ActualDeliveryDate !== '1753-01-01T00:00:00') {
        universalStatus = 'delivered';
        statusSource = 'actual_delivery_date';
    } else if (eshipData.IsPickedUp && eshipData.ActualPickupDate !== '1753-01-01T00:00:00') {
        universalStatus = 'in_transit';
        statusSource = 'actual_pickup_date';
    } 
    // 2. Check the main status code
    else if (eshipData.Status !== undefined && ESHIP_STATUS_MAP[eshipData.Status]) {
        universalStatus = ESHIP_STATUS_MAP[eshipData.Status];
        statusSource = 'main_status';
    }
    // 3. Check the latest check call for more specific status
    else if (eshipData.CheckCalls && eshipData.CheckCalls.length > 0) {
        // Get the most recent check call
        const latestCheckCall = eshipData.CheckCalls
            .sort((a, b) => new Date(b.CallDate) - new Date(a.CallDate))[0];
        
        if (latestCheckCall.StatusCode && CHECK_CALL_STATUS_MAP[latestCheckCall.StatusCode]) {
            universalStatus = CHECK_CALL_STATUS_MAP[latestCheckCall.StatusCode];
            statusSource = 'check_call';
        }
    }

    // Prepare tracking events from check calls
    const trackingEvents = (eshipData.CheckCalls || []).map(call => ({
        date: call.EventDate || call.CallDate,
        location: '', // eShip Plus doesn't provide location in check calls
        description: getCheckCallDescription(call.StatusCode, call.CallNotes),
        statusCode: call.StatusCode,
        carrierCode: call.StatusCode
    })).filter(event => event.date && event.date !== '')
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate estimated delivery (use estimate if no actual delivery)
    let estimatedDelivery = null;
    if (eshipData.EstimateDeliveryDate && eshipData.EstimateDeliveryDate !== '1753-01-01T00:00:00') {
        estimatedDelivery = new Date(eshipData.EstimateDeliveryDate).toISOString();
    }

    // Calculate actual delivery
    let actualDelivery = null;
    if (eshipData.ActualDeliveryDate && eshipData.ActualDeliveryDate !== '1753-01-01T00:00:00') {
        actualDelivery = new Date(eshipData.ActualDeliveryDate).toISOString();
    }

    return {
        success: true,
        trackingNumber: eshipData.ShipmentNumber,
        status: universalStatus,
        statusDisplay: getStatusDisplayName(universalStatus),
        lastUpdated: new Date().toISOString(),
        estimatedDelivery,
        actualDelivery,
        carrierInfo: {
            carrierName: eshipData.VendorName || 'eShip Plus',
            carrierCode: eshipData.VendorScac || '',
            serviceType: getServiceModeDescription(eshipData.Mode),
            trackingNumber: eshipData.Pro || eshipData.ShipmentNumber
        },
        shipmentDates: {
            created: eshipData.DateCreated ? new Date(eshipData.DateCreated).toISOString() : null,
            estimatedPickup: eshipData.EstimatePickupDate && eshipData.EstimatePickupDate !== '1753-01-01T00:00:00' 
                ? new Date(eshipData.EstimatePickupDate).toISOString() : null,
            actualPickup: eshipData.ActualPickupDate && eshipData.ActualPickupDate !== '1753-01-01T00:00:00'
                ? new Date(eshipData.ActualPickupDate).toISOString() : null,
            estimatedDelivery,
            actualDelivery
        },
        trackingEvents,
        rawData: {
            carrier: 'eshipplus',
            statusSource,
            originalStatus: eshipData.Status,
            isPickedUp: eshipData.IsPickedUp,
            isDelivered: eshipData.IsDelivered,
            vendorKey: eshipData.VendorKey,
            checkCallsCount: eshipData.CheckCalls?.length || 0
        }
    };
}

/**
 * Get human-readable description for check call status codes
 */
function getCheckCallDescription(statusCode, callNotes) {
    const descriptions = {
        'A3': 'Shipment returned to shipper',
        'A7': 'Refused by consignee',
        'A9': 'Shipment damaged',
        'AF': 'Carrier departed pickup location with shipment',
        'AG': 'Estimated delivery',
        'AH': 'Attempted delivery',
        'AI': 'Shipment has been reconsigned',
        'AJ': 'Tendered for delivery',
        'AM': 'Loaded on truck',
        'AN': 'Diverted to air carrier',
        'AP': 'Delivery not completed',
        'AR': 'Rail arrival at destination intermodal ramp',
        'AV': 'Available for delivery',
        'B6': 'Estimated to arrive at carrier terminal',
        'BA': 'Connecting line or cartage pick-up',
        'BC': 'Storage in transit',
        'C1': 'Estimated to depart terminal location',
        'CA': 'Shipment cancelled',
        'CD': 'Carrier departed delivery location',
        'CL': 'Trailer closed out',
        'CP': 'Completed loading at pick-up location',
        'D1': 'Completed unloading at delivery location',
        'I1': 'In-gate',
        'J1': 'Delivered to connecting line',
        'K1': 'Arrived at customs',
        'L1': 'Loading',
        'OA': 'Out-gate',
        'OO': 'Paperwork received - did not receive shipment or equipment',
        'P1': 'Departed terminal location',
        'PR': 'U.S. customs hold at origin intermodal ramp',
        'R1': 'Received from prior carrier',
        'RL': 'Rail departure from origin intermodal ramp',
        'S1': 'Trailer spotted at consignee\'s location',
        'SD': 'Shipment delayed',
        'X1': 'Arrived at delivery location',
        'X2': 'Estimated date and/or time of arrival at consignee\'s location',
        'X3': 'Arrived at pick-up location',
        'X4': 'Arrived at terminal location',
        'X5': 'Arrived at delivery location loading dock',
        'X6': 'En route to delivery location',
        'X8': 'Arrived at pick-up location loading dock',
        'XB': 'Shipment acknowledged',
        'AA': 'Shipment created'
    };

    const description = descriptions[statusCode] || `Status code: ${statusCode}`;
    return callNotes ? `${description} - ${callNotes}` : description;
}

/**
 * Get service mode description
 */
function getServiceModeDescription(mode) {
    const modes = {
        0: 'Less Than Truckload',
        1: 'Truckload',
        2: 'Air',
        3: 'Rail',
        4: 'Small Package',
        5: 'Not Applicable'
    };
    return modes[mode] || 'Unknown';
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

module.exports = {
    getEShipPlusStatus,
    mapEShipPlusStatusToUniversal,
    getCheckCallDescription,
    ESHIP_STATUS_MAP,
    CHECK_CALL_STATUS_MAP
}; 