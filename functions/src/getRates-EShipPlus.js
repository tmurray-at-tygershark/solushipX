// Import only v2 functions API
const functions = require('firebase-functions');
const { onCall } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const axios = require('axios');
// const { parseStringPromise } = require("xml2js"); // No longer needed for JSON API
const admin = require('firebase-admin');
const dayjs = require('dayjs');

// Initialize Firebase Admin with default credentials
if (!admin.apps.length) {
  admin.initializeApp();
  console.log('Firebase Admin initialized with default credentials');
}

// Constants
const ESHIPPLUS_API_URL = process.env.ESHIPPLUS_URL || "https://cloudstaging.eshipplus.com/services/rest/RateShipment.aspx";

// Helper to safely access nested properties, especially for arrays that might be missing or empty
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
        bookingReferenceType: apiResponse.BookingReferenceNumberType === 2 ? "Shipment" : String(apiResponse.BookingReferenceNumberType), // Map 2 to "Shipment" or keep as is
        shipmentBillType: apiResponse.ShipmentBillType === 0 ? "DefaultLogisticsPlus" : String(apiResponse.ShipmentBillType), // Example mapping, adjust as needed
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
            serviceMode: rate.ServiceMode, // Assuming 0 might mean LTL, etc. Needs mapping if string is expected
            serviceType: rate.CarrierName, // Placeholder, might need better logic for Service Type String from ServiceMode or CarrierName
            transitTime: parseInt(rate.TransitTime || '0'),
            estimatedDeliveryDate: rate.EstimatedDeliveryDate ? dayjs(rate.EstimatedDeliveryDate).format('YYYY-MM-DD') : null,
            // Direct charges from the rate object
            freightCharges: parseFloat(rate.FreightCharges || '0'),
            fuelCharges: parseFloat(rate.FuelCharges || '0'),
            serviceCharges: parseFloat(rate.ServiceCharges || '0'),
            accessorialCharges: parseFloat(rate.AccessorialCharges || '0'),
            totalCharges: parseFloat(rate.TotalCharges || '0'),
            currency: rate.Currency || 'USD',
            guaranteedService: rate.GuaranteedService === true,
            guaranteeCharge: parseFloat(rate.GuaranteeCharge || '0'),
            // Map BillingDetails to a simpler accessorials array or a structured costs object
            // For now, let's keep it simple and just pass BillingDetails as is, or create a basic costs object
            billingDetails: rate.BillingDetails, // Pass through for now, can be refined
            costs: {
                 // Attempt to map common charges from BillingDetails or direct fields
                freight: parseFloat(rate.FreightCharges || '0'),
                fuel: parseFloat(rate.FuelCharges || '0'),
                // You might iterate through BillingDetails to populate more specific costs if needed
            },
            accessorials: (rate.BillingDetails || []).filter(bd => bd.Category !== 0 && bd.Category !== 1) // Filter out freight and fuel if already direct
                .map(acc => ({
                    description: acc.Description,
                    amount: parseFloat(acc.AmountDue || '0'),
                    category: acc.Category, // Or map to a string like "Accessorial", "Tax", etc.
                    code: acc.BillingCode
                }))
        }))
    };
    return transformed;
}

// Shared function logic to process rate requests
async function processRateRequest(data) {
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
        const typeMap = {"SHIPMENT": 2, "ProNumber": 1, "BillOfLading": 3 }; // Example mapping
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

    // Validate required fields in the rate request data against the new JSON structure
    const validationError = validateJsonRateRequest(eShipPlusRequestData);
    if (validationError) {
      logger.error('Validation Error:', validationError);
      throw new functions.https.HttpsError('invalid-argument', validationError);
    }

    logger.info('eShipPlus JSON Rate request payload:', eShipPlusRequestData);

    // Prepare eShipPlusAuth Header
    const esAccessCode = process.env.ESHIPPLUS_ACCESS_CODE || functions.config().eshipplus?.access_code;
    const esUserName = process.env.ESHIPPLUS_USERNAME || functions.config().eshipplus?.username;
    const esPassword = process.env.ESHIPPLUS_PASSWORD || functions.config().eshipplus?.password;
    const esAccessKey = process.env.ESHIPPLUS_ACCESS_KEY || functions.config().eshipplus?.access_key;

    if (!esUserName || !esPassword || !esAccessKey || !esAccessCode) {
        logger.error('eShipPlus API credentials missing in environment/config.');
        throw new functions.https.HttpsError('internal', 'Server configuration error for eShipPlus credentials.');
    }

    const authPayload = {
        UserName: esUserName,
        Password: esPassword,
        AccessKey: esAccessKey,
        AccessCode: esAccessCode
    };
    const eShipPlusAuthHeader = Buffer.from(JSON.stringify(authPayload)).toString('base64');
    logger.info('eShipPlusAuth Header generated.');

    // Make the JSON request to eShipPlus REST API
    const response = await axios.post(ESHIPPLUS_API_URL, eShipPlusRequestData, {
      headers: {
        'Content-Type': 'application/json',
        'eShipPlusAuth': eShipPlusAuthHeader,
        // 'Accept': 'application/json' // Usually good practice
      },
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Process responses even with client/server errors
      }
    });

    logger.info(`eShipPlus API Response Status: ${response.status}`);
    logger.debug('eShipPlus API Raw Response Data:', response.data);

    if (response.status >= 400 || response.data.ContainsErrorMessage === true || (response.data.Messages && response.data.Messages.length > 0) ) {
        let errorMessage = `eShipPlus API Error: Status ${response.status}`;
        let errorDetails = response.data;
        if (response.data) {
            if (response.data.Messages && Array.isArray(response.data.Messages) && response.data.Messages.length > 0) {
                 errorMessage += ` - ${response.data.Messages.map(m => m.Text || JSON.stringify(m)).join('; ')}`;
            } else if (typeof response.data === 'string') {
                errorMessage += ` - ${response.data}`;
            } else if (response.data.message) {
                 errorMessage += ` - ${response.data.message}`;
            } else if (response.data.error) {
                 errorMessage += ` - ${response.data.error}`;
            }            
        }
        logger.error(errorMessage, errorDetails);
        // Determine a more specific error code if possible from eShipPlus response
        const errorCode = response.data.ContainsErrorMessage ? 'failed-precondition' : 'internal';
        throw new functions.https.HttpsError(errorCode, errorMessage, errorDetails);
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

/**
 * Export v2 callable function 
 */
exports.getRatesEShipPlus = onCall({
  cors: true,
  timeoutSeconds: 60,
  memory: "256MiB",
  // enforceAppCheck: true, // Consider enabling App Check for v2 functions
}, async (request) => {
  // request.app will be undefined in v2. Use environment variables or predefined config for app check.
  // if (request.app == undefined && process.env.NODE_ENV !== 'development') {
  //   throw new functions.https.HttpsError(
  //     'failed-precondition',
  //     'The function must be called from an App Check verified app.'
  //   );
  // }
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

/**
 * Validates the API key against stored valid keys
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<boolean>} - Whether the API key is valid
 */
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

// TODO: Update this function to validate against the new JSON structure
function validateJsonRateRequest(data) {
  logger.info('Validating JSON rate request:', data);
  if (!data) return 'Request body is required';

  const requiredTopLevel = [
    'BookingReferenceNumber', 
    //'BookingReferenceNumberType', // As per your example, it is 2. We might enforce or default this.
    'ShipmentBillType',
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