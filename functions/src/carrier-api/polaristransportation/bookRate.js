const functions = require('firebase-functions');
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const axios = require('axios');
const admin = require('firebase-admin');
const dayjs = require('dayjs');
const { getCarrierApiConfig, validateCarrierEndpoints } = require('../../utils');

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
 * Transform booking request to Polaris Transportation format
 * @param {Object} data - Universal format booking request
 * @returns {Object} - Polaris Transportation formatted request
 */
function transformToPolarisBookingFormat(data) {
    const bookingRequest = {
        AccountNumber: data.accountNumber || "000605",
        OrderNumber: data.orderNumber || data.ReferenceNumber || data.referenceNumber || '',
        OrderDate: data.orderDate || dayjs().format('YYYY-MM-DD'),
        ShipDate: data.shipDate || data.ShipmentDate || dayjs().format('YYYY-MM-DD'),
        RequestedPickupDate: data.requestedPickupDate || data.EarliestPickup?.Time || '',
        RequestedDeliveryDate: data.requestedDeliveryDate || data.EarliestDelivery?.Time || '',
        
        // Shipper information
        Shipper: {
            Company: data.Origin?.Description || data.Origin?.Company || '',
            Address: data.Origin?.Street || '',
            Address2: data.Origin?.StreetExtra || data.Origin?.Street2 || '',
            City: data.Origin?.City || '',
            State: data.Origin?.State || '',
            PostalCode: data.Origin?.PostalCode || '',
            Country: data.Origin?.Country?.Code || data.Origin?.Country || 'CA',
            Contact: data.Origin?.Contact || '',
            Phone: data.Origin?.Phone || '',
            Email: data.Origin?.Email || '',
            SpecialInstructions: data.Origin?.SpecialInstructions || ''
        },
        
        // Consignee information
        Consignee: {
            Company: data.Destination?.Description || data.Destination?.Company || '',
            Address: data.Destination?.Street || '',
            Address2: data.Destination?.StreetExtra || data.Destination?.Street2 || '',
            City: data.Destination?.City || '',
            State: data.Destination?.State || '',
            PostalCode: data.Destination?.PostalCode || '',
            Country: data.Destination?.Country?.Code || data.Destination?.Country || 'CA',
            Contact: data.Destination?.Contact || '',
            Phone: data.Destination?.Phone || '',
            Email: data.Destination?.Email || '',
            SpecialInstructions: data.Destination?.SpecialInstructions || ''
        },
        
        // Commodities/Items
        Commodities: (data.Items || []).map((item, index) => ({
            LineNumber: index + 1,
            Description: item.Description || 'General Freight',
            Weight: parseFloat(item.Weight || 0),
            Length: parseInt(item.Length || 0),
            Width: parseInt(item.Width || 0),
            Height: parseInt(item.Height || 0),
            Quantity: parseInt(item.PackagingQuantity || 1),
            FreightClass: item.FreightClass?.FreightClass || item.FreightClass || '70',
            DeclaredValue: parseFloat(item.DeclaredValue || 0),
            Stackable: item.Stackable || false,
            HazardousMaterial: item.HazardousMaterial || false
        })),
        
        // Services and options
        Services: data.Services || ['Standard'],
        PaymentTerms: data.PaymentTerms || 'Prepaid',
        BillTo: data.BillTo || 'Shipper',
        
        // Rate information if available
        RateQuoteId: data.selectedRate?.quoteId || data.quoteId || '',
        CarrierName: data.selectedRate?.carrierName || 'Polaris Transportation',
        ServiceType: data.selectedRate?.serviceType || 'Standard LTL',
        TotalCharges: parseFloat(data.selectedRate?.totalCharges || 0),
        Currency: data.selectedRate?.currency || 'CAD'
    };

    logger.info('Transformed booking request for Polaris Transportation:', bookingRequest);
    return bookingRequest;
}

/**
 * Transform Polaris Transportation booking response to universal format
 * @param {Object} apiResponse - Raw API response from Polaris Transportation
 * @returns {Object} - Transformed response in universal format
 */
function transformPolarisBookingResponseToUniversal(apiResponse) {
    if (!apiResponse) return null;

    logger.info('Transforming Polaris Transportation booking response:', apiResponse);

    return {
        success: true,
        bookingReference: safeAccess(apiResponse, 'OrderNumber') || safeAccess(apiResponse, 'BookingReference'),
        shipmentNumber: safeAccess(apiResponse, 'ShipmentNumber') || safeAccess(apiResponse, 'TrackingNumber'),
        trackingNumber: safeAccess(apiResponse, 'TrackingNumber') || safeAccess(apiResponse, 'ProNumber'),
        carrierName: 'Polaris Transportation',
        carrierScac: 'POLT',
        serviceType: safeAccess(apiResponse, 'ServiceType') || 'Standard LTL',
        estimatedDeliveryDate: safeAccess(apiResponse, 'EstimatedDelivery'),
        estimatedPickupDate: safeAccess(apiResponse, 'EstimatedPickup'),
        totalCharges: parseFloat(safeAccess(apiResponse, 'TotalCharges') || 0),
        currency: safeAccess(apiResponse, 'Currency') || 'CAD',
        status: 'booked',
        statusDisplay: 'Booked',
        createdAt: new Date().toISOString(),
        rawResponse: apiResponse
    };
}

/**
 * Book shipment with Polaris Transportation
 * @param {Object} data - Booking request data
 * @returns {Promise<Object>} - Booking response
 */
async function bookPolarisTransportationShipment(data) {
    logger.info('Polaris Transportation booking shipment with data keys:', data ? Object.keys(data) : 'No data');
    
    try {
        // Skip API key validation in development
        const skipApiKeyValidation = process.env.NODE_ENV === 'development' || process.env.SKIP_API_KEY_VALIDATION === 'true';
        
        if (!skipApiKeyValidation && data.apiKey) {
            const isValidApiKey = await validateApiKey(data.apiKey);
            if (!isValidApiKey) {
                throw new functions.https.HttpsError('unauthenticated', 'Invalid API key');
            }
        }

        // Remove API key from request data
        const { apiKey: userApiKey, ...bookingRequestData } = data;

        // Validate required fields
        const validationError = validatePolarisBookingRequest(bookingRequestData);
        if (validationError) {
            logger.error('Booking validation error:', validationError);
            throw new functions.https.HttpsError('invalid-argument', validationError);
        }

        // Get carrier API configuration
        const carrierConfig = await getCarrierApiConfig('POLARISTRANSPORTATION', 'booking');
        const { apiUrl, credentials } = carrierConfig;
        
        // Validate that the carrier has the required endpoints
        if (!validateCarrierEndpoints(credentials, ['booking'])) {
            throw new functions.https.HttpsError('internal', 'Polaris Transportation carrier missing required booking endpoint configuration');
        }
        
        logger.info(`Using Polaris Transportation Booking API URL: ${apiUrl}`);

        // Create auth headers
        const authHeaders = createPolarisAuthHeaders(credentials);
        logger.info('Polaris Transportation booking auth headers created');

        // Transform request data to Polaris Transportation format
        const polarisBookingRequest = transformToPolarisBookingFormat(bookingRequestData);

        // Make the API request
        const response = await axios.post(apiUrl, polarisBookingRequest, {
            headers: authHeaders,
            timeout: 60000, // 60 second timeout for booking requests
            validateStatus: function (status) {
                return status >= 200 && status < 600;
            }
        });

        logger.info(`Polaris Transportation Booking API Response Status: ${response.status}`);
        
        if (response.status >= 400) {
            let errorMessage = `Polaris Transportation Booking API Error: HTTP Status ${response.status}`;
            let errorDetailsForClient = { rawResponse: 'See function logs for full details.' };

            if (response.data) {
                if (typeof response.data === 'object') {
                    errorDetailsForClient = response.data;
                    if (response.data.Error || response.data.ErrorMessage) {
                        errorMessage += ` Error: ${response.data.Error || response.data.ErrorMessage}`;
                    }
                } else if (typeof response.data === 'string' && response.data.length < 1024) {
                    errorMessage += ` Response: ${response.data}`;
                    errorDetailsForClient = { rawResponse: response.data };
                }
            }
            
            logger.error("Full Polaris Transportation Booking Error Response: ", errorMessage, { fullResponse: response.data });
            throw new functions.https.HttpsError('internal', errorMessage, errorDetailsForClient);
        }

        // Check for API-level errors in successful response
        if (response.data && (response.data.Error || response.data.Success === false)) {
            const errorMessage = `Polaris Transportation Booking API indicated an error: ${response.data.Error || 'Unknown error'}`;
            logger.error(errorMessage, { fullResponse: response.data });
            throw new functions.https.HttpsError('failed-precondition', errorMessage, response.data);
        }

        const transformedResponse = transformPolarisBookingResponseToUniversal(response.data);
        
        if (!transformedResponse || !transformedResponse.success) {
            logger.error('Failed to transform Polaris Transportation booking response:', response.data);
            throw new functions.https.HttpsError('internal', 'Failed to process booking response from Polaris Transportation API.');
        }

        logger.info('Successfully booked shipment with Polaris Transportation:', {
            bookingReference: transformedResponse.bookingReference,
            shipmentNumber: transformedResponse.shipmentNumber,
            trackingNumber: transformedResponse.trackingNumber
        });

        return transformedResponse;

    } catch (error) {
        logger.error('Error in Polaris Transportation booking:', error.message, error.stack);
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'An internal error occurred while booking the shipment.');
    }
}

/**
 * Validate Polaris Transportation booking request
 * @param {Object} data - Request data to validate
 * @returns {string|null} - Error message or null if valid
 */
function validatePolarisBookingRequest(data) {
    logger.info('Validating Polaris Transportation booking request:', data);
    
    if (!data) return 'Request body is required';

    // Check origin/shipper
    if (!data.Origin) return 'Origin/Shipper address is required';
    if (!data.Origin.Street) return 'Origin street is required';
    if (!data.Origin.City) return 'Origin city is required';
    if (!data.Origin.State) return 'Origin state/province is required';
    if (!data.Origin.PostalCode) return 'Origin postal code is required';
    if (!data.Origin.Contact) return 'Origin contact name is required';

    // Check destination/consignee
    if (!data.Destination) return 'Destination/Consignee address is required';
    if (!data.Destination.Street) return 'Destination street is required';
    if (!data.Destination.City) return 'Destination city is required';
    if (!data.Destination.State) return 'Destination state/province is required';
    if (!data.Destination.PostalCode) return 'Destination postal code is required';
    if (!data.Destination.Contact) return 'Destination contact name is required';

    // Check items/commodities
    if (!Array.isArray(data.Items) || data.Items.length === 0) return 'At least one item/commodity is required';
    
    for (const [index, item] of data.Items.entries()) {
        if (!item.Description) return `Description is required for item ${index + 1}`;
        if (!item.Weight || isNaN(parseFloat(item.Weight)) || parseFloat(item.Weight) <= 0) {
            return `Valid weight is required for item ${index + 1}`;
        }
        if (!item.Length || isNaN(parseInt(item.Length)) || parseInt(item.Length) <= 0) {
            return `Valid length is required for item ${index + 1}`;
        }
        if (!item.Width || isNaN(parseInt(item.Width)) || parseInt(item.Width) <= 0) {
            return `Valid width is required for item ${index + 1}`;
        }
        if (!item.Height || isNaN(parseInt(item.Height)) || parseInt(item.Height) <= 0) {
            return `Valid height is required for item ${index + 1}`;
        }
    }

    return null;
}

/**
 * Validate API key
 * @param {string} apiKey - API key to validate
 * @returns {Promise<boolean>} - Whether API key is valid
 */
async function validateApiKey(apiKey) {
    try {
        // For development, always accept the development API key
        if (process.env.NODE_ENV === 'development' && apiKey === 'development-api-key') {
            return true;
        }
        
        // Check in Firestore for API key
        const db = admin.firestore();
        const apiKeysRef = db.collection('apiKeys');
        const snapshot = await apiKeysRef.where('key', '==', apiKey).where('active', '==', true).limit(1).get();
        
        return !snapshot.empty;
    } catch (error) {
        logger.error('Error validating API key:', error);
        return false;
    }
}

/**
 * Export v2 callable function for Firebase Cloud Functions
 */
exports.bookPolarisTransportationShipment = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
    region: 'us-central1'
}, async (request) => {
    logger.info('bookPolarisTransportationShipment onCall handler invoked. Auth context:', request.auth ? 'Present' : 'Absent');
    
    try {
        return await bookPolarisTransportationShipment(request.data);
    } catch (error) {
        if (error.code && error.httpErrorCode) {
            logger.error(`HttpsError: Code - ${error.code}, Message - ${error.message}, Details - ${JSON.stringify(error.details)}`);
        }
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'Internal server error during booking request.', {stack: error.stack});
    }
}); 