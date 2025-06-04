const functions = require("firebase-functions");
const axios = require('axios');
const { getCarrierApiConfig, createEShipPlusAuthHeader } = require('../../utils');
const { getCheckCallDescription } = require('./getStatus');

/**
 * Parses location information from eShipPlus CallNotes.
 * This is a placeholder and needs to be made more robust based on actual CallNotes patterns.
 * @param {string} notes - The CallNotes string.
 * @return {object|null} Parsed location object or null.
 */
const parseLocationFromNotes = (notes) => {
  if (!notes || typeof notes !== 'string') return null;
  // Placeholder: robust parsing is complex without more data/patterns.
  return null;
};

/**
 * Fetches and transforms eShipPlus shipment history (CheckCalls) into a standardized format.
 * @param {string} shipmentNumber - The eShipPlus ShipmentNumber.
 * @return {Promise<Array<object>>} A promise that resolves to an array of tracking update objects.
 */
const fetchAndTransformEShipPlusHistory = async (shipmentNumber) => {
  if (!shipmentNumber) {
    // Using HttpsError for consistency in error handling by the caller (Cloud Function)
    throw new functions.https.HttpsError("invalid-argument", "ShipmentNumber is required to fetch eShipPlus history.");
  }

  let carrierConfig;
  try {
    // Assuming 'status' endpoint config is used, as CheckCalls are often part of status payload
    carrierConfig = await getCarrierApiConfig('ESHIPPLUS', 'status'); 
  } catch (err) {
    functions.logger.error("Error fetching eShipPlus carrier config for history:", err);
    throw new functions.https.HttpsError("internal", `Failed to retrieve eShipPlus API configuration for history: ${err.message}`);
  }

  // carrierConfig.apiUrl should be the complete URL from getCarrierApiConfig
  const { apiUrl: fullEndpointUrlFromConfig, credentials } = carrierConfig; 

  if (!fullEndpointUrlFromConfig) {
    throw new functions.https.HttpsError("internal", "eShipPlus API URL not configured in carrier settings for history");
  }
  if (!credentials) {
    functions.logger.error("eShipPlus config incomplete for history. Missing credentials.", { carrierConfig });
    throw new functions.https.HttpsError("internal", "eShipPlus API credentials are not configured for history.");
  }
  // Optional: Check if credentials.endpoints.status exists if other parts of the code expect it directly from credentials
  // if (!credentials?.endpoints?.status) {
  //   functions.logger.warn("eShipPlus status endpoint path not found in credentials.endpoints for history. This might be an issue if used elsewhere.");
  // }

  functions.logger.info("Credentials object passed to createEShipPlusAuthHeader for history:", {
    hasUsername: !!credentials.username,
    usernameType: typeof credentials.username,
    hasPassword: !!credentials.password, 
    passwordLength: typeof credentials.password === 'string' ? credentials.password.length : 'N/A',
    hasSecret: !!credentials.secret,
    secretType: typeof credentials.secret,
    hasAccountNumber: !!credentials.accountNumber,
    accountNumberType: typeof credentials.accountNumber,
    allCredentialKeys: Object.keys(credentials)
  });

  // CORRECTED: Directly use the apiUrl from config (now named fullEndpointUrlFromConfig)
  const fullEndpointUrl = fullEndpointUrlFromConfig; 
  
  const authHeader = createEShipPlusAuthHeader(credentials);

  try {
    // Updated log to show the final URL being used
    functions.logger.info(`Fetching eShipPlus history. Final URL: ${fullEndpointUrl}, ShipmentNumber: ${shipmentNumber}`);
    
    const response = await axios.post(fullEndpointUrl, `"${shipmentNumber}"`, {
      headers: {
        'eShipPlusAuth': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000, 
      validateStatus: function (status) {
        return status < 600; 
      }
    });
    
    functions.logger.info(`eShipPlus History API Response Status: ${response.status} for ${shipmentNumber}`);

    if (response.headers['content-type']?.includes('text/html')) {
        functions.logger.error('Received HTML response instead of JSON from eShipPlus - likely authentication failure.', { shipmentNumber, url: fullEndpointUrl });
        throw new functions.https.HttpsError('unauthenticated', 'Authentication failed with eShipPlus: received login page.');
    }
    if (response.status === 401 || response.status === 403) {
        functions.logger.error(`eShipPlus Authentication failed: ${response.status} ${response.statusText}`, { shipmentNumber, url: fullEndpointUrl });
        throw new functions.https.HttpsError('unauthenticated', `eShipPlus authentication failed: ${response.status} ${response.statusText}`);
    }
    if (response.status >= 400) {
        let apiErrorMessage = `eShipPlus History API Error: HTTP ${response.status} ${response.statusText}.`;
        if (response.data && typeof response.data === 'object' && response.data.Messages) {
            apiErrorMessage += ` Messages: ${response.data.Messages.map(m => m.Text || JSON.stringify(m)).join('; ')}`;
        } else if (response.data && typeof response.data === 'string') {
            apiErrorMessage += ` Response: ${response.data.substring(0, 200)}`;
        }
        functions.logger.error(apiErrorMessage, { shipmentNumber, responseStatus: response.status, responseData: response.data, url: fullEndpointUrl });
        throw new functions.https.HttpsError('internal', apiErrorMessage);
    }

    const data = response.data;

    if (typeof data === 'string' && data.toLowerCase().includes('<!doctype html>')) {
        functions.logger.error('Received HTML content in eShipPlus response data (string) - auth/endpoint issue.', { shipmentNumber, url: fullEndpointUrl });
        throw new functions.https.HttpsError('unauthenticated', 'eShipPlus endpoint returned HTML - check authentication or endpoint URL.');
    }

    if (!data) {
        functions.logger.warn('Empty response data from eShipPlus API for history.', { shipmentNumber, url: fullEndpointUrl });
        return []; 
    }

    if (data && data.ContainsErrorMessage) {
      const errorMessages = data.Messages?.filter(m => m.Type === 0).map(m => m.Value) || ['Unknown eShipPlus API error'];
      
      // Check if this is a "not found" error which should be handled gracefully
      const isNotFoundError = errorMessages.some(msg => 
        msg && (
          msg.includes('not found') ||
          msg.includes('Not Found') ||
          msg.includes('NOT FOUND') ||
          msg.includes('does not exist') ||
          msg.includes('not exist')
        )
      );
      
      if (isNotFoundError) {
        functions.logger.info(`eShipPlus shipment not found: ${shipmentNumber}`, { errorMessages, url: fullEndpointUrl });
        return []; // Return empty array for not found cases
      }
      
      // For other errors, throw as before
      const errorMessage = `eShipPlus API Error for history: ${errorMessages.join(', ')}`;
      functions.logger.error(errorMessage, { shipmentNumber, apiResponse: data, url: fullEndpointUrl });
      throw new functions.https.HttpsError('internal', errorMessage);
    }

    if (!data.CheckCalls || !Array.isArray(data.CheckCalls)) {
      functions.logger.warn(`No CheckCalls found or unexpected format for eShipPlus shipment ${shipmentNumber} history`, { data, url: fullEndpointUrl });
      return [];
    }

    const trackingUpdates = data.CheckCalls.map((call) => {
      const eventDateStr = call.EventDate;
      const callDateStr = call.CallDate;
      let ts;

      const parseEShipDate = (dateStr) => {
        if (!dateStr || dateStr.startsWith("0001-01-01") || dateStr.startsWith("1753-01-01")) {
          return null;
        }
        const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s(\d{2}):(\d{2}):(\d{2})/);
        if (parts) {
          const month = parseInt(parts[1], 10);
          const day = parseInt(parts[2], 10);
          const year = parseInt(parts[3], 10);
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}T${parts[4]}:${parts[5]}:${parts[6]}`);
          }
        }
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
      };

      const eventDate = parseEShipDate(eventDateStr);
      const callDate = parseEShipDate(callDateStr);
      ts = eventDate || callDate || new Date();

      // Use the proper getCheckCallDescription function from getStatus.js
      const properDescription = getCheckCallDescription(call.StatusCode, call.CallNotes);

      return {
        timestamp: ts.toISOString(),
        status: properDescription, // Use the human-readable description
        description: call.CallNotes || properDescription,
        location: parseLocationFromNotes(call.CallNotes),
        rawStatusCode: call.StatusCode,
        rawCallDate: call.CallDate,
        rawEventDate: call.EventDate,
      };
    });

    trackingUpdates.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    functions.logger.info(`Transformed ${trackingUpdates.length} eShipPlus history events for ${shipmentNumber}.`);
    return trackingUpdates;

  } catch (error) {
    functions.logger.error(`Error in fetchAndTransformEShipPlusHistory for ${shipmentNumber}:`, {
        message: error.message,
        stack: error.stack,
        code: error.code, 
        details: error.details,
        url: fullEndpointUrl // Also log URL in final catch
    });
    if (error instanceof functions.https.HttpsError) {
        throw error;
    }
    throw new functions.https.HttpsError('internal', `Failed to process eShipPlus history. ${error.message}`);
  }
};

module.exports = { fetchAndTransformEShipPlusHistory }; 