console.log('LOG: getRates.js - Top of file, imports starting.');
const functions = require('firebase-functions'); // Changed to v1 for consistency if onRequest is v1 style
const { onCall, HttpsError } = require("firebase-functions/v2/https"); // Keeping v2 for onCall
const logger = require("firebase-functions/logger");
const axios = require('axios');
// const { parseStringPromise } = require("xml2js"); // No longer needed for JSON API
const admin = require('firebase-admin');
const dayjs = require('dayjs');
const { getCarrierApiConfig, createEShipPlusAuthHeader, validateCarrierEndpoints } = require('../../utils');
console.log('LOG: getRates.js - Basic imports complete.');

// Remove hardcoded URL - now dynamically built from carrier credentials
// const ESHIPPLUS_API_URL = "https://cloudstaging.eshipplus.com/services/rest/RateShipment.aspx";
console.log('LOG: getRates.js - Dynamic API URL configuration enabled.');

// Helper to safely access nested properties, especially for arrays that might be missing or empty
console.log('LOG: getRates.js - safeAccess helper defined.');
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

function transformRestResponseToInternalFormat(apiResponse) {
    if (!apiResponse) return null;

    const transformed = {
        bookingReference: apiResponse.BookingReferenceNumber,
        bookingReferenceType: apiResponse.BookingReferenceNumberType === 2 ? "Shipment" : String(apiResponse.BookingReferenceNumberType),
        shipmentBillType: apiResponse.ShipmentBillType === 0 ? "DefaultLogisticsPlus" : String(apiResponse.ShipmentBillType),
        shipmentDate: apiResponse.ShipmentDate ? dayjs(apiResponse.ShipmentDate).format('YYYY-MM-DD') : null,
        pickupWindow: {
            earliest: safeAccess(apiResponse, 'EarliestPickup.Time'),
            latest: safeAccess(apiResponse, 'LatestPickup.Time')
        },
        deliveryWindow: {
            earliest: safeAccess(apiResponse, 'EarliestDelivery.Time'),
            latest: safeAccess(apiResponse, 'LatestDelivery.Time')
        },
        origin: {
            company: safeAccess(apiResponse, 'Origin.Description'),
            street: safeAccess(apiResponse, 'Origin.Street'),
            street2: safeAccess(apiResponse, 'Origin.StreetExtra'),
            postalCode: safeAccess(apiResponse, 'Origin.PostalCode'),
            city: safeAccess(apiResponse, 'Origin.City'),
            state: safeAccess(apiResponse, 'Origin.State'),
            country: safeAccess(apiResponse, 'Origin.Country.Code'),
            contact: safeAccess(apiResponse, 'Origin.Contact'),
            phone: safeAccess(apiResponse, 'Origin.Phone'),
            email: safeAccess(apiResponse, 'Origin.Email'),
            specialInstructions: safeAccess(apiResponse, 'Origin.SpecialInstructions')
        },
        destination: {
            company: safeAccess(apiResponse, 'Destination.Description'),
            street: safeAccess(apiResponse, 'Destination.Street'),
            street2: safeAccess(apiResponse, 'Destination.StreetExtra'),
            postalCode: safeAccess(apiResponse, 'Destination.PostalCode'),
            city: safeAccess(apiResponse, 'Destination.City'),
            state: safeAccess(apiResponse, 'Destination.State'),
            country: safeAccess(apiResponse, 'Destination.Country.Code'),
            contact: safeAccess(apiResponse, 'Destination.Contact'),
            phone: safeAccess(apiResponse, 'Destination.Phone'),
            email: safeAccess(apiResponse, 'Destination.Email'),
            specialInstructions: safeAccess(apiResponse, 'Destination.SpecialInstructions')
        },
        items: (apiResponse.Items || []).map(item => ({
            description: item.Description,
            weight: parseFloat(item.Weight || '0'),
            dimensions: {
                length: parseInt(item.Length || '0'),
                width: parseInt(item.Width || '0'),
                height: parseInt(item.Height || '0')
            },
            packagingQuantity: parseInt(item.PackagingQuantity || '0'),
            freightClass: safeAccess(item, 'FreightClass.FreightClass', null),
            declaredValue: parseFloat(item.DeclaredValue || '0'),
            stackable: item.Stackable === true
        })),
        availableRates: (apiResponse.AvailableRates || []).map(rate => ({
            quoteId: rate.QuoteId,
            carrierName: rate.CarrierName,
            carrierScac: rate.CarrierScac,
            carrierKey: rate.CarrierKey,
            serviceMode: rate.ServiceMode,
            serviceType: rate.CarrierName,
            transitTime: parseInt(rate.TransitTime || '0'),
            estimatedDeliveryDate: rate.EstimatedDeliveryDate ? dayjs(rate.EstimatedDeliveryDate).format('YYYY-MM-DD') : null,
            freightCharges: parseFloat(rate.FreightCharges || safeAccess(rate, 'Costs.FreightCharges') || '0'),
            fuelCharges: parseFloat(rate.FuelCharges || safeAccess(rate, 'Costs.FuelCharges') || '0'),
            serviceCharges: parseFloat(rate.ServiceCharges || safeAccess(rate, 'Costs.ServiceCharges') || '0'),
            accessorialCharges: parseFloat(rate.AccessorialCharges || safeAccess(rate, 'Costs.AccessorialCharges') || '0'),
            totalCharges: parseFloat(rate.TotalCharges || safeAccess(rate, 'Costs.TotalCharges') || '0'),
            currency: rate.Currency || 'USD',
            guaranteedService: rate.GuaranteedService === true,
            guaranteeCharge: parseFloat(rate.GuaranteeCharge || safeAccess(rate, 'Costs.GuaranteeCharge') || '0'),
            billingDetails: rate.BillingDetails || [],
            guarOptions: rate.GuarOptions || [],
            billedWeight: parseFloat(rate.BilledWeight || '0'),
            ratedWeight: parseFloat(rate.RatedWeight || '0')
        }))
    };
    return transformed;
}
console.log('LOG: getRates.js - transformRestResponseToInternalFormat defined.');

// Shared function logic to process rate requests
console.log('LOG: getRates.js - processRateRequest defined.');
async function processRateRequest(data) {
  console.log('LOG: processRateRequest - Function invoked.');
  logger.info('LOG: processRateRequest - INFO: Function invoked with data:', data ? Object.keys(data) : 'No data');
  try {
    const skipApiKeyValidation = process.env.NODE_ENV === 'development' || process.env.SKIP_API_KEY_VALIDATION === 'true';
    const apiKey = data.apiKey;
    
    if (!skipApiKeyValidation) {
      if (!apiKey) {
        logger.warn('API key validation: No API key provided');
        throw new functions.https.HttpsError('unauthenticated', 'API key is required');
      }
      const isValidApiKey = await validateApiKey(apiKey);
      if (!isValidApiKey) {
        logger.warn('API key validation: Invalid API key provided');
        throw new functions.https.HttpsError('unauthenticated', 'Invalid API key');
      }
      logger.info('API key validation: Valid API key');
    } else {
      logger.info('API key validation: Skipped (development mode or explicitly disabled)');
    }

    // Prepare the request data for eShipPlus JSON API
    // The incoming 'data' from the frontend should already be structured closely to the required JSON body.
    // We might remove the 'apiKey' field before sending it to eShipPlus.
    const { apiKey: userApiKey, ...eShipPlusRequestData } = data;

    // Example: Ensure BookingReferenceNumberType is an integer if API expects it.
    // This depends on what the frontend sends vs what the API strictly needs.
    if (eShipPlusRequestData.BookingReferenceNumberType && typeof eShipPlusRequestData.BookingReferenceNumberType === 'string') {
        const typeMap = {"SHIPMENT": 2, "PRONUMBER": 1, "BILLOFLADING": 3 }; // Example mapping
        if (typeMap[eShipPlusRequestData.BookingReferenceNumberType.toUpperCase()]){
            eShipPlusRequestData.BookingReferenceNumberType = typeMap[eShipPlusRequestData.BookingReferenceNumberType.toUpperCase()];
        } else {
            // Default or error if string is not recognized and number is needed
            logger.warn('Unrecognized BookingReferenceNumberType string, defaulting or remove if API handles string.');
            // eShipPlusRequestData.BookingReferenceNumberType = 2; // Default if necessary
        }
    } else if (eShipPlusRequestData.BookingReferenceNumberType === undefined) {
         eShipPlusRequestData.BookingReferenceNumberType = 2; // Default based on your sample
    }

    // Validate required fields in the rate request data
    const validationError = validateJsonRateRequest(eShipPlusRequestData);
    if (validationError) {
      logger.error('Validation Error:', validationError);
      throw new functions.https.HttpsError('invalid-argument', validationError);
    }

    logger.info('eShipPlus JSON Rate request payload:', eShipPlusRequestData);

    // Get carrier API configuration
    const carrierConfig = await getCarrierApiConfig('ESHIPPLUS', 'rate');
    const { apiUrl, credentials } = carrierConfig;
    
    // Validate that the carrier has the required endpoints
    if (!validateCarrierEndpoints(credentials, ['rate'])) {
      throw new functions.https.HttpsError('internal', 'eShipPlus carrier missing required rate endpoint configuration');
    }
    
    logger.info(`Using eShipPlus Rate API URL: ${apiUrl}`);

    // Create auth header using dynamic credentials
    const eShipPlusAuthHeader = createEShipPlusAuthHeader(credentials);
    logger.info('eShipPlusAuth Header generated from Firestore credentials.');

    // Make the JSON request to eShipPlus REST API
    const response = await axios.post(apiUrl, eShipPlusRequestData, {
      headers: {
        'Content-Type': 'application/json',
        'eShipPlusAuth': eShipPlusAuthHeader,
        // 'Accept': 'application/json' // Usually good practice
      },
      validateStatus: function (status) {
        return status >= 200 && status < 600; // Accept all statuses to inspect body
      }
    });

    logger.info(`eShipPlus API Response Status: ${response.status}`);
    // Log the raw response body, especially for non-2xx statuses
    if (response.status >= 300) { 
        logger.warn('eShipPlus API Raw Response Data (Status >= 300):', response.data);
    } else {
        logger.debug('eShipPlus API Raw Response Data (Status 2xx):', response.data);
    }

    if (response.status >= 400) { // Covers 4xx and 5xx client or server errors from EShipPlus
        let errorMessage = `EShipPlus API Error: HTTP Status ${response.status}.`;
        let errorDetailsForClient = { rawResponse: 'See function logs for full details.' }; // Default client detail

        if (response.data) {
            if (typeof response.data === 'object') {
                errorDetailsForClient = response.data; // Send structured error if available
                if (response.data.Messages && Array.isArray(response.data.Messages) && response.data.Messages.length > 0) {
                     errorMessage += ` Messages: ${response.data.Messages.map(m => m.Text || JSON.stringify(m)).join('; ')}`;
                } else if (response.data.ErrorMessage) { 
                     errorMessage += ` ErrorMessage: ${response.data.ErrorMessage}`;
                } else if (response.data.message) { 
                     errorMessage += ` Message: ${response.data.message}`;
                } else if (response.data.error) {
                     errorMessage += ` Error: ${response.data.error}`;
                } 
                // If it's an object but no specific error message fields, it will be logged fully below
            } else if (typeof response.data === 'string' && response.data.length < 1024) { // Limit string length for client
                errorMessage += ` Response: ${response.data}`;
                errorDetailsForClient = { rawResponse: response.data };
            }
        }
        // Log the full response data for server-side debugging, regardless of its type/size
        logger.error("Full EShipPlus Error Response: ", errorMessage, { fullEShipPlusResponse: response.data });
        
        const f_error_code = response.data?.ContainsErrorMessage || response.status === 503 ? 'unavailable' : 'internal';
        throw new functions.https.HttpsError(f_error_code, errorMessage, errorDetailsForClient);
    }
    
    // Specific check for ContainsErrorMessage even on 2xx (as per original logic), this indicates business logic error
    if (response.data && response.data.ContainsErrorMessage === true) {
        let errorMessage = `EShipPlus API indicated an error in the response despite HTTP ${response.status} status.`;
        if (response.data.Messages && Array.isArray(response.data.Messages) && response.data.Messages.length > 0) {
            errorMessage += ` Messages: ${response.data.Messages.map(m => m.Text || JSON.stringify(m)).join('; ')}`;
        }
        logger.error(errorMessage, { fullEShipPlusResponse: response.data });
        throw new functions.https.HttpsError('failed-precondition', errorMessage, response.data);
    }

    const transformedData = transformRestResponseToInternalFormat(response.data);
    
    if (!transformedData || !transformedData.availableRates) {
        logger.error('Failed to transform eShipPlus response or no rates available:', response.data);
        throw new functions.https.HttpsError('internal', 'Failed to process rates from eShipPlus API.');
    }

    logger.info('Successfully transformed rates from eShipPlus REST API.');

    return {
      success: true,
      data: transformedData 
    };
  } catch (error) {
    logger.error('Error in processRateRequest:', error.message, error.stack, error.details);
    // Ensure HttpsError is thrown for client
    if (error instanceof functions.https.HttpsError) {
        throw error;
    }
    throw new functions.https.HttpsError('internal', error.message || 'An internal error occurred while processing the rate request.');
  }
}
console.log('LOG: getRates.js - processRateRequest defined.');

/**
 * Export v2 callable function 
 */
console.log('LOG: getRates.js - Setting up exports.getRatesEShipPlus.');
exports.getRatesEShipPlus = onCall({
  cors: true,
  timeoutSeconds: 60,
  memory: "256MiB",
  region: 'us-central1' // Explicitly set region
}, async (request) => {
  console.log('LOG: exports.getRatesEShipPlus - onCall handler invoked.');
  logger.info('LOG: exports.getRatesEShipPlus - INFO: onCall handler invoked. Auth context:', request.auth ? 'Present' : 'Absent');
  try {
    // request.data already contains the JSON payload from the client
    return await processRateRequest(request.data);
  } catch (error) {
    // Log the error with details if it's an HttpsError, otherwise log the generic error
    if (error.code && error.httpErrorCode) {
        logger.error(`HttpsError: Code - ${error.code}, Message - ${error.message}, Details - ${JSON.stringify(error.details)}`);
    }
    // Re-throw HttpsError or convert other errors to HttpsError
    if (error instanceof functions.https.HttpsError) {
        throw error;
    }
    throw new functions.https.HttpsError('internal', error.message || 'Internal server error during rate request.', {stack: error.stack});
  }
});
console.log('LOG: getRates.js - exports.getRatesEShipPlus defined and exported. File loading complete.');

/**
 * Validates the API key against stored valid keys
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<boolean>} - Whether the API key is valid
 */
console.log('LOG: getRates.js - validateApiKey defined.');
async function validateApiKey(apiKey) {
  try {
    // Get configured API key from Firebase config
    const configApiKey = functions.config().eshipplus?.api_key;
    
    // For development, always accept the development API key
    if (process.env.NODE_ENV === 'development' && apiKey === 'development-api-key') {
      return true;
    }
    
    // Check if the API key matches our config
    if (configApiKey && apiKey === configApiKey) {
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
console.log('LOG: getRates.js - validateApiKey defined.');

// TODO: Update this function to validate against the new JSON structure
console.log('LOG: getRates.js - validateJsonRateRequest defined.');
function validateJsonRateRequest(data) {
  logger.info('Validating JSON rate request:', data);
  if (!data) return 'Request body is required';

  const requiredTopLevel = [
    'BookingReferenceNumber', 
    // 'BookingReferenceNumberType', // Now defaulted/mapped in calling code
    'ShipmentDate',
    'EarliestPickup', 'LatestPickup',
    'EarliestDelivery', 'LatestDelivery',
    'Origin', 'Destination', 'Items'
  ];
  for (const field of requiredTopLevel) {
    if (data[field] === undefined || data[field] === null) return `Missing required field: ${field}`;
  }

  if (!data.EarliestPickup.Time || !data.LatestPickup.Time) return 'Pickup window times are required';
  if (!data.EarliestDelivery.Time || !data.LatestDelivery.Time) return 'Delivery window times are required';

  const validateAddress = (address, type) => {
    if (!address) return `${type} address is required`;
    if (!address.Street) return `${type} street is required`;
    if (!address.City) return `${type} city is required`;
    if (!address.State) return `${type} state/province is required`;
    if (!address.PostalCode) return `${type} postal code is required`;
    if (!address.Country || !address.Country.Code) return `${type} country code is required`;
    if (!address.Contact) return `${type} contact name is required`;
    return null;
  };

  let err = validateAddress(data.Origin, 'Origin');
  if (err) return err;
  err = validateAddress(data.Destination, 'Destination');
  if (err) return err;

  if (!Array.isArray(data.Items) || data.Items.length === 0) return 'At least one item is required';
  for (const [index, item] of data.Items.entries()) {
    if (item.Weight === undefined || item.Weight === null || isNaN(parseFloat(item.Weight))) return `Invalid Weight for item ${index + 1}`;
    if (item.Length === undefined || isNaN(parseInt(item.Length))) return `Invalid Length for item ${index + 1}`;
    if (item.Width === undefined || isNaN(parseInt(item.Width))) return `Invalid Width for item ${index + 1}`;
    if (item.Height === undefined || isNaN(parseInt(item.Height))) return `Invalid Height for item ${index + 1}`;
    if (item.PackagingQuantity === undefined || isNaN(parseInt(item.PackagingQuantity))) return `Invalid Packaging Quantity for item ${index + 1}`;
    // FreightClass might be optional or have a default
    // if (!item.FreightClass || !item.FreightClass.FreightClass) return `FreightClass is required for item ${index + 1}`;
  }
  return null;
}
console.log('LOG: getRates.js - validateJsonRateRequest defined.'); 