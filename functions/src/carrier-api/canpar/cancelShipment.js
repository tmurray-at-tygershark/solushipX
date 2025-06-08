const axios = require('axios');
const logger = require('firebase-functions/logger');
const functions = require('firebase-functions');
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { parseStringPromise } = require('xml2js');
const { getCarrierCredentials, getCarrierApiConfig } = require('../../utils');

/**
 * Cancel shipment with CanPar
 * @param {string} bookingReferenceNumber - The booking reference number to cancel (shipment ID)
 * @param {Object} credentials - CanPar API credentials
 * @returns {Promise<Object>} - Formatted cancel response
 */
async function cancelCanparShipment(bookingReferenceNumber, credentials) {
    try {
        logger.info(`Cancelling CanPar shipment: ${bookingReferenceNumber}`);

        // Use getCarrierApiConfig to get the proper URL like other CanPar functions
        const carrierConfig = await getCarrierApiConfig('CANPAR', 'cancel');
        const { apiUrl, credentials: configCredentials } = carrierConfig;
        
        // Use the credentials passed in or fall back to config credentials
        const finalCredentials = credentials || configCredentials;
        
        if (!apiUrl) {
            throw new Error('CanPar cancel endpoint not configured in carrier settings');
        }

        logger.info(`CanPar cancel URL: ${apiUrl}`);
        logger.info(`Using credentials:`, {
            username: finalCredentials.username,
            hasPassword: !!finalCredentials.password,
            hasAccountNumber: !!finalCredentials.accountNumber
        });

        // Log the complete request details
        console.log('Canpar Void Shipment Request Details:', {
            apiUrl,
            username: finalCredentials.username,
            bookingReferenceNumber,
            timestamp: new Date().toISOString()
        });

        // Build SOAP request for CanPar void shipment
        const soapRequest = buildCanparVoidSoapEnvelope(bookingReferenceNumber, finalCredentials);
        
        logger.info('CanPar SOAP request created successfully');

        // Log the complete SOAP request
        console.log('Canpar Void Shipment SOAP Request:', {
            soapRequest,
            timestamp: new Date().toISOString()
        });

        // Make the API call
        const response = await axios.post(apiUrl, soapRequest, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://ws.business.canshipws.canpar.com/voidShipment',
                'Accept': 'text/xml'
            },
            timeout: 30000, // 30 second timeout
            validateStatus: function (status) {
                // Accept any status code to handle errors properly
                return status < 600;
            }
        });

        logger.info(`CanPar cancel response status: ${response.status}`);
        
        // Log the complete response
        console.log('Canpar Void Shipment Response:', {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data,
            timestamp: new Date().toISOString()
        });

        // Check for HTTP errors
        if (response.status >= 400) {
            throw new Error(`API request failed - ${response.status} ${response.statusText}`);
        }

        const cancelResponseXml = response.data;
        logger.info(`CanPar cancel response XML:`, { 
            xml: typeof cancelResponseXml === 'string' ? cancelResponseXml.substring(0, 500) : cancelResponseXml 
        });

        // Parse XML response
        const parsedResponse = await parseStringPromise(cancelResponseXml);
        logger.info(`CanPar parsed response:`, JSON.stringify(parsedResponse, null, 2));

        // Log the parsed response
        console.log('Canpar Void Shipment Parsed Response:', {
            parsedResult: parsedResponse,
            timestamp: new Date().toISOString()
        });

        // Map to universal format
        const universalResponse = mapCanparCancelToUniversal(parsedResponse, bookingReferenceNumber);
        
        logger.info(`Mapped to universal cancel response:`, { universalResponse });

        // Log the mapped response
        console.log('Canpar Void Shipment Mapped Response:', {
            mappedResponse: universalResponse,
            timestamp: new Date().toISOString()
        });

        return universalResponse;

    } catch (error) {
        logger.error(`Error cancelling CanPar shipment ${bookingReferenceNumber}:`, error.message);
        throw error;
    }
}

/**
 * Build SOAP envelope for CanPar void shipment request
 * @param {string} shipmentId - The shipment ID to void
 * @param {Object} credentials - CanPar credentials
 * @returns {string} - SOAP XML request
 */
function buildCanparVoidSoapEnvelope(shipmentId, credentials) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns:ws="http://ws.business.canshipws.canpar.com"
                       xmlns:xsd="http://dto.canshipws.canpar.com/xsd">
        <soapenv:Header/>
        <soapenv:Body>
          <ws:voidShipment>
            <ws:request>
              <xsd:user_id>${credentials.username}</xsd:user_id>
              <xsd:password>${credentials.password}</xsd:password>
              <xsd:id>${shipmentId}</xsd:id>
            </ws:request>
          </ws:voidShipment>
        </soapenv:Body>
      </soapenv:Envelope>`;
}

/**
 * Map CanPar cancel response to universal format
 * @param {Object} canparData - CanPar cancel response (parsed XML)
 * @param {string} bookingReferenceNumber - Original booking reference number
 * @returns {Object} - Universal cancel response format
 */
function mapCanparCancelToUniversal(canparData, bookingReferenceNumber) {
    try {
        // Default response structure
        const universalResponse = {
            success: false,
            cancelled: false,
            canCancel: false,
            bookingReferenceNumber,
            message: 'Unknown response',
            timestamp: new Date().toISOString(),
            rawData: {
                carrier: 'canpar',
                originalResponse: canparData
            }
        };

        // If no data, assume failure
        if (!canparData) {
            universalResponse.message = 'No response received from carrier';
            return universalResponse;
        }

        // Navigate to the response data based on CanPar SOAP structure
        const voidResponse = canparData?.['soapenv:Envelope']?.['soapenv:Body']?.[0]?.['ns:voidShipmentResponse']?.[0]?.['ns:return']?.[0];
        
        if (!voidResponse) {
            universalResponse.message = 'Invalid response structure from CanPar';
            return universalResponse;
        }

        // Check for errors in the response
        const error = voidResponse?.['ax29:error'];
        
        // If error is null (xsi:nil="true"), it means success
        if (error && error[0] && error[0].$ && error[0].$['xsi:nil'] === 'true') {
            universalResponse.success = true;
            universalResponse.cancelled = true;
            universalResponse.message = 'Shipment successfully cancelled with CanPar';
            return universalResponse;
        }
        
        // If there is an error (xsi:nil="false" or error message present)
        if (error && error[0] && error[0].$ && error[0].$['xsi:nil'] !== 'true') {
            universalResponse.success = true; // API call succeeded
            universalResponse.cancelled = false;
            universalResponse.canCancel = false;
            
            // Extract error message if available
            const errorMessage = error[0]?._ || error[0] || 'Shipment could not be cancelled';
            universalResponse.message = typeof errorMessage === 'string' ? errorMessage : 'Shipment cancellation failed';
            
            return universalResponse;
        }

        // If we can't determine the error status clearly, check for other success indicators
        // In some cases, the absence of error node might indicate success
        if (!error || error.length === 0) {
            universalResponse.success = true;
            universalResponse.cancelled = true;
            universalResponse.message = 'Shipment successfully cancelled with CanPar';
            return universalResponse;
        }

        // Fallback - if we reach here, we couldn't determine the status
        universalResponse.success = true; // API call succeeded
        universalResponse.cancelled = false;
        universalResponse.message = 'Cancellation status unclear - please verify manually';
        
        return universalResponse;

    } catch (error) {
        logger.error('Error mapping CanPar cancel response:', error);
        return {
            success: false,
            cancelled: false,
            canCancel: false,
            bookingReferenceNumber,
            message: 'Error processing cancellation response',
            timestamp: new Date().toISOString(),
            rawData: {
                carrier: 'canpar',
                originalResponse: canparData,
                error: error.message
            }
        };
    }
}

/**
 * Process cancel shipment request
 * @param {Object} data - Request data containing bookingReferenceNumber
 * @returns {Promise<Object>} - Cancel response
 */
async function processCancelRequest(data) {
    try {
        logger.info('Processing CanPar cancel request:', data);

        // Validate request data
        const validationError = validateCancelRequest(data);
        if (validationError) {
            throw new functions.https.HttpsError('invalid-argument', validationError);
        }

        // Get carrier credentials using the utils function (same as other CanPar functions)
        const credentials = await getCarrierCredentials('CANPAR');
        
        if (!credentials) {
            throw new functions.https.HttpsError('not-found', 'CanPar carrier configuration not found');
        }
        
        // Validate credentials
        if (!credentials.username || !credentials.password) {
            throw new functions.https.HttpsError('failed-precondition', 'CanPar credentials are incomplete');
        }

        // Call the cancel function
        const cancelResult = await cancelCanparShipment(data.bookingReferenceNumber, credentials);

        logger.info('Successfully processed cancel request for CanPar.');

        return {
            success: true,
            data: cancelResult
        };

    } catch (error) {
        logger.error('Error in processCancelRequest:', error.message, error.stack);
        
        // Ensure HttpsError is thrown for client
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'An internal error occurred while processing the cancel request.');
    }
}

/**
 * Validate cancel request data
 * @param {Object} data - Request data
 * @returns {string|null} - Error message or null if valid
 */
function validateCancelRequest(data) {
    if (!data) return 'Request body is required';
    
    if (!data.bookingReferenceNumber || typeof data.bookingReferenceNumber !== 'string') {
        return 'bookingReferenceNumber is required and must be a string';
    }
    
    if (data.bookingReferenceNumber.trim().length === 0) {
        return 'bookingReferenceNumber cannot be empty';
    }
    
    return null;
}

/**
 * Export v2 callable function 
 * Updated to force deployment
 */
exports.cancelShipmentCanpar = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
    region: 'us-central1'
}, async (request) => {
    logger.info('cancelShipmentCanpar onCall handler invoked. Auth context:', request.auth ? 'Present' : 'Absent');
    
    try {
        // request.data already contains the JSON payload from the client
        return await processCancelRequest(request.data);
    } catch (error) {
        // Log the error with details if it's an HttpsError
        if (error.code && error.httpErrorCode) {
            logger.error(`HttpsError: Code - ${error.code}, Message - ${error.message}, Details - ${JSON.stringify(error.details)}`);
        }
        
        // Re-throw HttpsError or convert other errors to HttpsError
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'Internal server error during cancel request.', {stack: error.stack});
    }
});

// Export the main function for use in other modules
module.exports = {
    cancelCanparShipment,
    processCancelRequest,
    cancelShipmentCanpar: exports.cancelShipmentCanpar
}; 