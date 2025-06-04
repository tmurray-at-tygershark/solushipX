const axios = require('axios');
const logger = require('firebase-functions/logger');
const functions = require('firebase-functions');
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { createEShipPlusAuthHeader, getCarrierCredentials, getCarrierApiConfig } = require('../../utils');

/**
 * Cancel shipment with eShip Plus
 * @param {string} bookingReferenceNumber - The booking reference number to cancel
 * @param {Object} credentials - eShip Plus API credentials
 * @returns {Promise<Object>} - Formatted cancel response
 */
async function cancelEShipPlusShipment(bookingReferenceNumber, credentials) {
    try {
        logger.info(`Cancelling eShip Plus shipment: ${bookingReferenceNumber}`);

        // Use getCarrierApiConfig to get the proper URL like other eShipPlus functions
        const carrierConfig = await getCarrierApiConfig('ESHIPPLUS', 'cancel');
        const { apiUrl, credentials: configCredentials } = carrierConfig;
        
        // Use the credentials passed in or fall back to config credentials
        const finalCredentials = credentials || configCredentials;
        
        if (!apiUrl) {
            throw new Error('eShip Plus cancel endpoint not configured in carrier settings');
        }

        logger.info(`eShip Plus cancel URL: ${apiUrl}`);
        logger.info(`Using credentials:`, {
            username: finalCredentials.username,
            hasPassword: !!finalCredentials.password,
            hasSecret: !!finalCredentials.secret,
            hasAccountNumber: !!finalCredentials.accountNumber,
            hasEndpoints: !!finalCredentials.endpoints
        });

        // Create eShipPlus auth header using the same method as other modules
        const eShipPlusAuthHeader = createEShipPlusAuthHeader(finalCredentials);
        
        logger.info('eShipPlusAuth header created successfully');

        // Make the API call - payload is just the booking reference number as a JSON string
        const response = await axios.post(apiUrl, `"${bookingReferenceNumber}"`, {
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

        logger.info(`eShip Plus cancel response status: ${response.status}`);
        
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

        const cancelData = response.data;
        logger.info(`eShip Plus cancel response:`, { 
            cancelData: typeof cancelData === 'string' ? cancelData.substring(0, 200) : cancelData 
        });

        // If response is a string and contains HTML, it's likely an error
        if (typeof cancelData === 'string' && cancelData.includes('<!doctype html>')) {
            throw new Error('Received HTML response instead of JSON - authentication or endpoint issue');
        }

        // Map to universal format
        const universalResponse = mapEShipPlusCancelToUniversal(cancelData, bookingReferenceNumber);
        
        logger.info(`Mapped to universal cancel response:`, { universalResponse });
        return universalResponse;

    } catch (error) {
        logger.error(`Error cancelling eShip Plus shipment ${bookingReferenceNumber}:`, error.message);
        throw error;
    }
}

/**
 * Map eShip Plus cancel response to universal format
 * @param {Object} eshipData - eShip Plus cancel response
 * @param {string} bookingReferenceNumber - Original booking reference number
 * @returns {Object} - Universal cancel response format
 */
function mapEShipPlusCancelToUniversal(eshipData, bookingReferenceNumber) {
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
                carrier: 'eshipplus',
                originalResponse: eshipData
            }
        };

        // If no data, assume failure
        if (!eshipData) {
            universalResponse.message = 'No response received from carrier';
            return universalResponse;
        }

        // Handle eShipPlus specific response format
        if (typeof eshipData === 'object' && eshipData.Messages && Array.isArray(eshipData.Messages)) {
            // Check ContainsErrorMessage first
            const hasError = eshipData.ContainsErrorMessage === true;
            
            if (!hasError) {
                // No errors - check for success messages
                const infoMessages = eshipData.Messages.filter(msg => msg.Type === 1); // Type 1 = Information
                const successMessage = infoMessages.find(msg => 
                    msg.Value && (
                        msg.Value.toLowerCase().includes('complete') ||
                        msg.Value.toLowerCase().includes('success') ||
                        msg.Value.toLowerCase().includes('cancel')
                    )
                );
                
                if (successMessage) {
                    universalResponse.success = true;
                    universalResponse.cancelled = true;
                    universalResponse.message = successMessage.Value;
                } else if (infoMessages.length > 0) {
                    // Has info messages but not clearly success
                    universalResponse.success = true;
                    universalResponse.cancelled = true;
                    universalResponse.message = infoMessages[0].Value;
                } else {
                    // No error but no clear success either
                    universalResponse.success = true;
                    universalResponse.cancelled = false;
                    universalResponse.message = 'Request processed but status unclear';
                }
            } else {
                // Has errors
                const errorMessages = eshipData.Messages.filter(msg => msg.Type === 0); // Type 0 = Error
                const warningMessages = eshipData.Messages.filter(msg => msg.Type === 2); // Type 2 = Warning
                
                universalResponse.success = true; // API call succeeded
                universalResponse.cancelled = false;
                universalResponse.canCancel = false;
                
                if (errorMessages.length > 0) {
                    universalResponse.message = errorMessages.map(msg => msg.Value).join('; ');
                } else if (warningMessages.length > 0) {
                    universalResponse.message = warningMessages.map(msg => msg.Value).join('; ');
                } else {
                    universalResponse.message = 'Cancellation request failed';
                }
            }
            
            return universalResponse;
        }

        // Handle string responses (fallback)
        if (typeof eshipData === 'string') {
            const responseText = eshipData.toLowerCase();
            
            if (responseText.includes('complete') || responseText.includes('success') || responseText.includes('cancelled')) {
                universalResponse.success = true;
                universalResponse.cancelled = true;
                universalResponse.message = eshipData;
            } else if (responseText.includes('cannot') || responseText.includes('unable') || responseText.includes('not allowed')) {
                universalResponse.success = true; // API call succeeded
                universalResponse.cancelled = false;
                universalResponse.canCancel = false;
                universalResponse.message = eshipData;
            } else {
                universalResponse.message = eshipData;
            }
            
            return universalResponse;
        }

        // Handle other object responses (legacy fallback)
        if (typeof eshipData === 'object') {
            // Check for success indicators
            if (eshipData.Success === true || eshipData.success === true) {
                universalResponse.success = true;
                universalResponse.cancelled = true;
                universalResponse.message = eshipData.Message || eshipData.message || 'Shipment successfully cancelled';
            } 
            // Check for failure indicators
            else if (eshipData.Success === false || eshipData.success === false) {
                universalResponse.success = true; // API call succeeded
                universalResponse.cancelled = false;
                universalResponse.canCancel = false;
                universalResponse.message = eshipData.Message || eshipData.message || 'Shipment cannot be cancelled';
            }
            // Default for unrecognized object responses
            else {
                universalResponse.message = 'Received response but unable to determine cancellation status';
            }
        }

        return universalResponse;

    } catch (error) {
        logger.error('Error mapping eShip Plus cancel response:', error);
        return {
            success: false,
            cancelled: false,
            canCancel: false,
            bookingReferenceNumber,
            message: 'Error processing cancellation response',
            timestamp: new Date().toISOString(),
            rawData: {
                carrier: 'eshipplus',
                originalResponse: eshipData,
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
        logger.info('Processing eShip Plus cancel request:', data);

        // Validate request data
        const validationError = validateCancelRequest(data);
        if (validationError) {
            throw new functions.https.HttpsError('invalid-argument', validationError);
        }

        // Get carrier credentials using the utils function (same as other eShipPlus functions)
        const credentials = await getCarrierCredentials('ESHIPPLUS');
        
        if (!credentials) {
            throw new functions.https.HttpsError('not-found', 'eShip Plus carrier configuration not found');
        }
        
        // Validate credentials
        if (!credentials.username || !credentials.password || !credentials.secret || !credentials.hostURL) {
            throw new functions.https.HttpsError('failed-precondition', 'eShip Plus credentials are incomplete');
        }

        // Call the cancel function
        const cancelResult = await cancelEShipPlusShipment(data.bookingReferenceNumber, credentials);

        logger.info('Successfully processed cancel request for eShip Plus.');

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
 */
exports.cancelShipmentEShipPlus = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
    region: 'us-central1'
}, async (request) => {
    logger.info('cancelShipmentEShipPlus onCall handler invoked. Auth context:', request.auth ? 'Present' : 'Absent');
    
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
    cancelEShipPlusShipment,
    processCancelRequest,
    cancelShipmentEShipPlus: exports.cancelShipmentEShipPlus
}; 