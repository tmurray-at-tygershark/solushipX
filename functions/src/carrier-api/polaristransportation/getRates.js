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
 * Transform Polaris Transportation response to internal format
 * @param {Object} apiResponse - Raw API response from Polaris Transportation
 * @returns {Object} - Transformed response in universal format
 */
function transformPolarisResponseToInternalFormat(apiResponse) {
    logger.info('🔄 transformPolarisResponseToInternalFormat started');
    logger.info('📥 Raw API Response:', JSON.stringify(apiResponse, null, 2));
    
    if (!apiResponse) {
        logger.warn('❌ No API response provided');
        return null;
    }

    // Handle the actual Polaris Transportation response format
    const responseData = apiResponse.Rate_API_Response || apiResponse;
    logger.info('🔍 Extracted responseData:', JSON.stringify(responseData, null, 2));
    
    // Check for API errors in the response - "Y" means error, "N" means success
    if (responseData.Error === 'Y' || responseData.Message === 'INVALID API KEY') {
        logger.error('❌ Polaris Transportation API returned error:', responseData);
        return {
            availableRates: [] // Return empty rates array for error cases
        };
    }

    // Extract rate information from the response
    const availableRates = [];
    
    logger.info('🧮 Checking rate data validity:', {
        errorStatus: responseData.Error,
        totalCharge: responseData.Total_Charge,
        totalChargeAsFloat: parseFloat(responseData.Total_Charge || '0'),
        hasValidCharge: responseData.Total_Charge && parseFloat(responseData.Total_Charge) > 0
    });
    
    // If we have valid rate data (Error is "N" and we have a total charge), create a rate object
    if (responseData.Error === 'N' && responseData.Total_Charge && parseFloat(responseData.Total_Charge) > 0) {
        logger.info('✅ Valid rate data found, creating rate object...');
        
        // Extract service days
        let transitDays = 5; // Default
        if (responseData.ServiceDays && parseInt(responseData.ServiceDays) > 0) {
            transitDays = parseInt(responseData.ServiceDays);
            logger.info('🚚 Transit days from ServiceDays:', transitDays);
        } else {
            logger.info('⚠️ Using default transit days:', transitDays);
        }

        // Extract pricing components
        const baseCharge = parseFloat(responseData.Base_Charge || '0');
        const fuelCharge = parseFloat(responseData.Fuel_Charge || '0');
        const borderCharge = parseFloat(responseData.Border_Charge || '0');
        const arbitraryChargeTotal = parseFloat(responseData.Arbitrary_Charge_Total || '0');
        
        logger.info('💰 Pricing components extracted:', {
            baseCharge,
            fuelCharge,
            borderCharge,
            arbitraryChargeTotal
        });
        
        // Calculate additional services total from the array if Additional_Services_Total is null
        let additionalServicesTotal = parseFloat(responseData.Additional_Services_Total || '0');
        logger.info('🔧 Additional_Services_Total from response:', responseData.Additional_Services_Total);
        
        if (additionalServicesTotal === 0 && responseData.Additional_Services) {
            logger.info('📋 Processing Additional_Services:', responseData.Additional_Services);
            
            if (Array.isArray(responseData.Additional_Services)) {
                // Handle array format
                logger.info('📋 Additional_Services is an array');
                additionalServicesTotal = responseData.Additional_Services.reduce((total, service) => {
                    const amount = parseFloat(service.Charge_Amount || '0');
                    logger.info(`  + ${service.Charge}: $${amount}`);
                    return total + amount;
                }, 0);
            } else if (typeof responseData.Additional_Services === 'object') {
                // Handle object format
                logger.info('📋 Additional_Services is an object');
                const amount = parseFloat(responseData.Additional_Services.Charge_Amount || '0');
                logger.info(`  + ${responseData.Additional_Services.Charge || 'Additional Service'}: $${amount}`);
                additionalServicesTotal = amount;
            }
            
            logger.info('💵 Calculated additionalServicesTotal:', additionalServicesTotal);
        }
        
        const totalCharge = parseFloat(responseData.Total_Charge || '0');
        logger.info('💸 Final totalCharge:', totalCharge);

        const rate = {
            quoteId: `polaris_${Date.now()}`,
            carrierName: 'Polaris Transportation',
            carrierScac: 'POLT',
            carrierKey: 'POLARISTRANSPORTATION',
            serviceMode: 'LTL',
            serviceType: 'Standard LTL',
            transitTime: transitDays,
            transitDays: transitDays,
            estimatedDeliveryDate: responseData.Delivery_Date || null,
            freightCharges: baseCharge,
            fuelCharges: fuelCharge,
            serviceCharges: additionalServicesTotal,
            accessorialCharges: arbitraryChargeTotal + borderCharge,
            totalCharges: totalCharge,
            currency: responseData.Currency || 'CAD',
            guaranteedService: false,
            guaranteeCharge: 0,
            billingDetails: [
                { label: 'Base Charge', amount: baseCharge },
                { label: 'Fuel Charge', amount: fuelCharge },
                { label: 'Border Charge', amount: borderCharge }
            ],
            guarOptions: [],
            billedWeight: parseFloat(responseData.Total_Weight_lbs || '0'),
            ratedWeight: parseFloat(responseData.Total_Weight_lbs || '0')
        };
        
        // Add additional services to billing details
        if (responseData.Additional_Services) {
            logger.info('📝 Adding additional services to billing details...');
            
            if (Array.isArray(responseData.Additional_Services)) {
                // Handle array format
                responseData.Additional_Services.forEach(service => {
                    const serviceDetail = {
                        label: service.Charge || 'Additional Service',
                        amount: parseFloat(service.Charge_Amount || '0')
                    };
                    logger.info('  📌 Adding service:', serviceDetail);
                    rate.billingDetails.push(serviceDetail);
                });
            } else if (typeof responseData.Additional_Services === 'object' && responseData.Additional_Services.Charge_Amount && parseFloat(responseData.Additional_Services.Charge_Amount) > 0) {
                // Handle object format (only add if charge amount > 0)
                const serviceDetail = {
                    label: responseData.Additional_Services.Charge || 'Additional Service',
                    amount: parseFloat(responseData.Additional_Services.Charge_Amount || '0')
                };
                logger.info('  📌 Adding service:', serviceDetail);
                rate.billingDetails.push(serviceDetail);
            }
        }
        
        logger.info('🎯 Created Polaris rate object:', {
            quoteId: rate.quoteId,
            totalCharge: rate.totalCharges,
            transitDays: rate.transitDays,
            currency: rate.currency,
            additionalServicesTotal: additionalServicesTotal,
            billingDetailsCount: rate.billingDetails.length,
            freightCharges: rate.freightCharges,
            fuelCharges: rate.fuelCharges,
            serviceCharges: rate.serviceCharges,
            accessorialCharges: rate.accessorialCharges
        });
        
        availableRates.push(rate);
    } else {
        logger.warn('❌ Polaris Transportation: No valid rate data found', {
            error: responseData.Error,
            totalCharge: responseData.Total_Charge,
            message: responseData.Message,
            hasError: responseData.Error === 'Y',
            hasInvalidApiKey: responseData.Message === 'INVALID API KEY',
            hasTotalCharge: !!responseData.Total_Charge,
            totalChargeValue: parseFloat(responseData.Total_Charge || '0')
        });
    }

    const transformed = {
        bookingReference: responseData.Bill_Number || '',
        bookingReferenceType: "Order",
        shipmentBillType: "Freight",
        shipmentDate: responseData.Pickup_Date || null,
        pickupWindow: {
            earliest: responseData.Pickup_Date,
            latest: responseData.Pickup_Date
        },
        deliveryWindow: {
            earliest: responseData.Delivery_Date,
            latest: responseData.Delivery_Date
        },
        origin: {
            postalCode: responseData.From_PC_ZIP || ''
        },
        destination: {
            postalCode: responseData.To_PC_ZIP || ''
        },
        items: [{
            description: responseData.Description || 'General Freight',
            weight: parseFloat(responseData.Total_Weight_lbs || '0'),
            packagingQuantity: parseInt(responseData.Pallets || '1')
        }],
        availableRates: availableRates
    };

    logger.info('✅ Final transformed object:', JSON.stringify(transformed, null, 2));
    return transformed;
}

/**
 * Create Polaris Transportation auth headers (no auth needed - uses URL parameter)
 * @param {Object} credentials - Carrier credentials
 * @returns {Object} - Headers object
 */
function createPolarisAuthHeaders(credentials) {
    // Polaris Transportation uses API key in URL, not headers
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
}

/**
 * Process rate request for Polaris Transportation
 * @param {Object} data - Rate request data
 * @returns {Promise<Object>} - Rate response
 */
async function processRateRequest(data) {
    logger.info('🚀 Polaris Transportation processRateRequest invoked with data keys:', data ? Object.keys(data) : 'No data');
    logger.info('📋 Full input data:', JSON.stringify(data, null, 2));
    
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
        const { apiKey: userApiKey, ...polarisRequestData } = data;

        // Validate required fields
        const validationError = validatePolarisRateRequest(polarisRequestData);
        if (validationError) {
            logger.error('❌ Validation Error:', validationError);
            throw new functions.https.HttpsError('invalid-argument', validationError);
        }

        logger.info('✅ Polaris Transportation rate request payload:', JSON.stringify(polarisRequestData, null, 2));

        // Get carrier API configuration
        const carrierConfig = await getCarrierApiConfig('POLARISTRANSPORTATION', 'rate');
        const { apiUrl, credentials } = carrierConfig;
        
        logger.info('🔧 Carrier config loaded:', {
            apiUrl: apiUrl,
            hasCredentials: !!credentials,
            hasSecret: !!credentials?.secret
        });
        
        // Validate that the carrier has the required endpoints
        if (!validateCarrierEndpoints(credentials, ['rate'])) {
            throw new functions.https.HttpsError('internal', 'Polaris Transportation carrier missing required rate endpoint configuration');
        }
        
        // Validate credentials before proceeding - Polaris needs API key in secret field
        if (!credentials.secret) {
            throw new functions.https.HttpsError('failed-precondition', 
                'Polaris Transportation is not properly configured. Missing API key (secret) in carrier settings. Please contact support to configure the API credentials.');
        }
        
        // Append API key to the URL as query parameter
        const apiUrlWithKey = `${apiUrl}?APIKey=${credentials.secret}`;
        logger.info(`🌐 Using Polaris Transportation Rate API URL: ${apiUrl}?APIKey=***`);

        // Create basic headers (no auth needed - using URL parameter)
        const headers = createPolarisAuthHeaders(credentials);
        logger.info('📋 Request headers:', JSON.stringify(headers, null, 2));

        // Transform request data to Polaris Transportation format
        const polarisFormattedRequest = transformToPolarisRateFormat(polarisRequestData);
        logger.info('📤 POLARIS REQUEST PAYLOAD:', JSON.stringify(polarisFormattedRequest, null, 2));

        // Make the API request with API key in URL
        const response = await axios.post(apiUrlWithKey, polarisFormattedRequest, {
            headers: headers,
            timeout: 30000,
            validateStatus: function (status) {
                return status >= 200 && status < 600; // Accept all statuses to inspect body
            }
        });

        logger.info(`📬 Polaris Transportation API Response Status: ${response.status}`);
        logger.info('📥 POLARIS RAW RESPONSE:', JSON.stringify(response.data, null, 2));
        
        if (response.status >= 400) {
            let errorMessage = `Polaris Transportation API Error: HTTP Status ${response.status}`;
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
            
            logger.error("❌ Full Polaris Transportation Error Response: ", errorMessage, { fullResponse: response.data });
            throw new functions.https.HttpsError('internal', errorMessage, errorDetailsForClient);
        }

        // Check for API-level errors in successful response
        const responseData = response.data?.Rate_API_Response || response.data;
        logger.info('🔍 Extracted response data:', JSON.stringify(responseData, null, 2));
        
        if (responseData && (responseData.Error === 'Y' || response.data.Success === false)) {
            let errorMessage = 'Polaris Transportation API Error';
            
            // Check for specific authentication errors
            if (responseData.Message && responseData.Message.includes('INVALID API KEY')) {
                errorMessage = 'Polaris Transportation authentication failed: Invalid API credentials. Please check the password/secret in the carrier configuration.';
            } else if (responseData.Error || responseData.ErrorMessage) {
                errorMessage = `Polaris Transportation API Error: ${responseData.Error || responseData.ErrorMessage}`;
            } else if (responseData.Message) {
                errorMessage = `Polaris Transportation API Error: ${responseData.Message}`;
            }
            
            logger.error('❌ API Error:', errorMessage, { fullResponse: response.data });
            throw new functions.https.HttpsError('failed-precondition', errorMessage, response.data);
        }

        logger.info('🔄 Starting transformation of Polaris response...');
        const transformedData = transformPolarisResponseToInternalFormat(response.data);
        logger.info('🎯 TRANSFORMED DATA:', JSON.stringify(transformedData, null, 2));
        
        if (!transformedData || !transformedData.availableRates) {
            logger.error('❌ Failed to transform Polaris Transportation response or no rates available:', response.data);
            throw new functions.https.HttpsError('internal', 'Failed to process rates from Polaris Transportation API.');
        }

        logger.info('✅ Successfully transformed rates from Polaris Transportation API');
        logger.info('📊 Final return data:', JSON.stringify({
            success: true,
            data: transformedData
        }, null, 2));

        return {
            success: true,
            data: transformedData
        };

    } catch (error) {
        logger.error('💥 Error in Polaris Transportation processRateRequest:', error.message, error.stack);
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'An internal error occurred while processing the rate request.');
    }
}

/**
 * Transform request data to Polaris Transportation format
 * @param {Object} data - Universal format request data
 * @returns {Object} - Polaris Transportation formatted request
 */
function transformToPolarisRateFormat(data) {
    return {
        RATE_API: {
            From_PC_ZIP: data.Origin?.PostalCode || '',
            To_PC_ZIP: data.Destination?.PostalCode || '',
            Class: "", // Empty as per API example
            Total_Weight_lbs: (data.Items || []).reduce((total, item) => 
                total + parseFloat(item.Weight || 0), 0).toString(),
            Number_of_Pieces: (data.Items || []).reduce((total, item) => 
                total + parseInt(item.PackagingQuantity || 1), 0).toString(),
            Description: data.Items?.[0]?.Description || "TEST",
            ShipInstructions: {
                Inside_Pickup: "N",
                Residential_Pickup: "N",
                Lifgate_Pickup: "N",
                Inside_Delivery: "N",
                Residential_Delivery: "N",
                Lifgate_Delivery: "N",
                Appointment_Delivery: "N",
                OverSizeFreight: "N",
                LimitedAccess: "N",
                Do_Not_Stack: "N",
                In_Bond: "N",
                Limited_Access_Pickup: "N",
                Limited_Access_Delivery: "N"
            },
            Number_of_Skids: (data.Items || []).length.toString(),
            SkidDimensions: (data.Items || []).map((item, index) => ({
                Skid: (index + 1).toString(),
                Length: (item.Length || 48).toString(),
                Width: (item.Width || 48).toString(),
                Height: (item.Height || 40).toString()
            }))
        }
    };
}

/**
 * Validate Polaris Transportation rate request
 * @param {Object} data - Request data to validate
 * @returns {string|null} - Error message or null if valid
 */
function validatePolarisRateRequest(data) {
    logger.info('Validating Polaris Transportation rate request:', data);
    
    if (!data) return 'Request body is required';

    // Check origin - Polaris Transportation only requires postal code
    if (!data.Origin) return 'Origin address is required';
    if (!data.Origin.PostalCode) return 'Origin postal code is required';

    // Check destination - Polaris Transportation only requires postal code
    if (!data.Destination) return 'Destination address is required';
    if (!data.Destination.PostalCode) return 'Destination postal code is required';

    // Check items
    if (!Array.isArray(data.Items) || data.Items.length === 0) return 'At least one item is required';
    
    for (const [index, item] of data.Items.entries()) {
        if (!item.Weight || isNaN(parseFloat(item.Weight))) return `Invalid weight for item ${index + 1}`;
        if (!item.Length || isNaN(parseInt(item.Length))) return `Invalid length for item ${index + 1}`;
        if (!item.Width || isNaN(parseInt(item.Width))) return `Invalid width for item ${index + 1}`;
        if (!item.Height || isNaN(parseInt(item.Height))) return `Invalid height for item ${index + 1}`;
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
 * Export v2 callable function
 */
exports.getRatesPolarisTransportation = onCall({
    cors: true,
    timeoutSeconds: 45, // Increased timeout for better reliability
    memory: "512MiB", // Increased memory for better performance
    region: 'us-central1',
    minInstances: 1, // Keep 1 instance warm to prevent cold starts
    maxInstances: 10 // Allow scaling for high demand
}, async (request) => {
    logger.info('getRatesPolarisTransportation onCall handler invoked. Auth context:', request.auth ? 'Present' : 'Absent');
    
    try {
        // Check if this is a warmup request from keep-alive system
        if (request.data && request.data._isWarmupRequest) {
            logger.info('🔥 Polaris Transportation warmup request detected - returning quick response');
            return {
                success: true,
                message: 'Polaris Transportation function is warm',
                timestamp: new Date().toISOString(),
                warmup: true
            };
        }

        // Check if this is a keep-alive system call
        if (request.auth && (request.auth.uid === 'keepalive-system' || request.auth.uid === 'health-check' || request.auth.uid?.includes('warmup'))) {
            logger.info('🔥 Keep-alive system request detected - returning quick response');
            return {
                success: true,
                message: 'Polaris Transportation function is responding',
                timestamp: new Date().toISOString(),
                keepalive: true
            };
        }
        
        return await processRateRequest(request.data);
    } catch (error) {
        if (error.code && error.httpErrorCode) {
            logger.error(`HttpsError: Code - ${error.code}, Message - ${error.message}, Details - ${JSON.stringify(error.details)}`);
        }
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'Internal server error during rate request.', {stack: error.stack});
    }
}); 