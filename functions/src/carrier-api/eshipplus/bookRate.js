console.log('LOG: bookRate.js - Top of file, imports starting.');
const functions = require('firebase-functions');
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const axios = require('axios');
const admin = require('firebase-admin');
const dayjs = require('dayjs');
console.log('LOG: bookRate.js - Basic imports complete.');

// Constants
console.log('LOG: bookRate.js - Defining constants.');
const ESHIPPLUS_BOOK_URL = "https://cloudstaging.eshipplus.com/services/rest/BookShipment.aspx";
console.log(`LOG: bookRate.js - ESHIPPLUS_BOOK_URL: ${ESHIPPLUS_BOOK_URL}`);

// Helper to safely access nested properties
console.log('LOG: bookRate.js - safeAccess helper defined.');
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

function transformBookingResponseToInternalFormat(apiResponse) {
    if (!apiResponse) return null;

    const bookedRate = apiResponse.BookedRate || {}; // Use BookedRate if available

    const transformed = {
        success: !apiResponse.ContainsErrorMessage, // Success if no error message
        bookingReference: apiResponse.BookingReferenceNumber,
        // Key confirmation details from the main response or BookedRate
        confirmationNumber: apiResponse.ProNumber || apiResponse.BolNumber || apiResponse.BookingReferenceNumber, // Prefer ProNumber or BOL if available
        proNumber: apiResponse.ProNumber,
        bolNumber: apiResponse.BolNumber,
        carrierName: bookedRate.CarrierName || safeAccess(apiResponse, 'SelectedRate.CarrierName'),
        carrierScac: bookedRate.CarrierScac || safeAccess(apiResponse, 'SelectedRate.CarrierScac'),
        totalCharges: bookedRate.TotalCharges !== undefined ? parseFloat(bookedRate.TotalCharges) : safeAccess(apiResponse, 'SelectedRate.TotalCharges', 0),
        transitTime: bookedRate.TransitTime !== undefined ? parseInt(bookedRate.TransitTime) : safeAccess(apiResponse, 'SelectedRate.TransitTime', 0),
        estimatedDeliveryDate: bookedRate.EstimatedDeliveryDate || safeAccess(apiResponse, 'SelectedRate.EstimatedDeliveryDate'),
        
        // Full BookedRate object from the response
        bookedRateDetails: bookedRate,

        // Charge breakdown from BookedRate
        charges: {
            freightCharges: parseFloat(bookedRate.FreightCharges || 0),
            fuelCharges: parseFloat(bookedRate.FuelCharges || 0),
            accessorialCharges: parseFloat(bookedRate.AccessorialCharges || 0),
            serviceCharges: parseFloat(bookedRate.ServiceCharges || 0),
            totalCharges: parseFloat(bookedRate.TotalCharges || 0),
        },

        // Shipping documents
        documents: (apiResponse.ReturnConfirmations || []).map(doc => ({
            docType: doc.DocType, // 0 seems to be a common type, might need mapping
            name: doc.Name,
            // docImage is Base64 encoded PDF data, handle appropriately on client-side
            // For now, just indicate its presence or a snippet if it's too long
            hasImage: !!doc.DocImage, 
            imagePreview: doc.DocImage ? doc.DocImage.substring(0, 50) + '...' : null
        })),
        
        // Raw response for debugging or further use
        rawResponse: apiResponse,
        messages: apiResponse.Messages || [],
        containsErrorMessage: apiResponse.ContainsErrorMessage || false,
    };
    return transformed;
}
console.log('LOG: bookRate.js - transformBookingResponseToInternalFormat defined.');

// Function to transform rate request data to booking request format
function transformRateDataToBookingRequest(rateRequestData, selectedRateFromFrontend) {
    // Log the received selectedRateFromFrontend to check its structure
    console.log("transformRateDataToBookingRequest - selectedRateFromFrontend:", JSON.stringify(selectedRateFromFrontend, null, 2));
    // Log the full original rateRequestData
    console.log("transformRateDataToBookingRequest - rateRequestData (full original):", JSON.stringify(rateRequestData, null, 2));

    const getCountryDetails = (code) => {
        if (code === "US") return { Code: "US", Name: "United States", UsesPostalCode: true };
        if (code === "CA") return { Code: "CA", Name: "Canada", UsesPostalCode: true };
        return { Code: code, Name: code, UsesPostalCode: true }; // Default
    };

    let bookingReferenceNumberType = safeAccess(rateRequestData, 'BookingReferenceNumberType', 2); // Path from example
    if (typeof bookingReferenceNumberType === 'string') {
        const typeMap = {"SHIPMENT": 2, "PRONUMBER": 1, "BILLOFLADING": 3, "PO": 4};
        bookingReferenceNumberType = typeMap[bookingReferenceNumberType.toUpperCase()] || 2;
    } else if (typeof bookingReferenceNumberType !== 'number') {
        bookingReferenceNumberType = 2;
    }

    const bookingReferenceNumber = safeAccess(rateRequestData, 'BookingReferenceNumber') ||
                                 selectedRateFromFrontend.bookingReferenceNumber ||
                                 "TFM_MISSING"; // Fallback like example

    // Defaulting to UTC for formatting if no timezone info is present.
    // The example shows "-04:00". If the input dates have timezone, dayjs should preserve it.
    // Otherwise, we format to ISO string, and the API might handle it or expect UTC.
    const shipmentDate = safeAccess(rateRequestData, 'ShipmentDate');
    const formattedShipmentDate = shipmentDate ? dayjs(shipmentDate).format() : dayjs().format(); // dayjs().format() is ISO 8601

    const estDeliveryDate = selectedRateFromFrontend.estimatedDeliveryDate;
    const formattedEstDeliveryDate = estDeliveryDate ? dayjs(estDeliveryDate).format() : null;


    const bookingPayload = {
        BookingReferenceNumber: bookingReferenceNumber,
        BookingReferenceNumberType: bookingReferenceNumberType,
        ShipmentBillType: 0, // Example: 0
        Origin: {
            Description: safeAccess(rateRequestData, 'Origin.Description') || safeAccess(rateRequestData, 'Origin.company') || "",
            Street: safeAccess(rateRequestData, 'Origin.Street') || safeAccess(rateRequestData, 'Origin.street') || "",
            StreetExtra: safeAccess(rateRequestData, 'Origin.StreetExtra') || safeAccess(rateRequestData, 'Origin.street2') || "",
            PostalCode: safeAccess(rateRequestData, 'Origin.PostalCode') || safeAccess(rateRequestData, 'Origin.postalCode') || "",
            City: safeAccess(rateRequestData, 'Origin.City') || safeAccess(rateRequestData, 'Origin.city') || "",
            State: safeAccess(rateRequestData, 'Origin.State') || safeAccess(rateRequestData, 'Origin.state') || "",
            Country: getCountryDetails(safeAccess(rateRequestData, 'Origin.Country.Code') || safeAccess(rateRequestData, 'Origin.country') || "US"),
            SpecialInstructions: safeAccess(rateRequestData, 'Origin.SpecialInstructions') || safeAccess(rateRequestData, 'Origin.specialInstructions') || "none",
            GeneralInfo: null, // Example: null
            Direction: null,   // Example: null
            Email: safeAccess(rateRequestData, 'Origin.Email') || safeAccess(rateRequestData, 'Origin.contactEmail') || "",
            Contact: safeAccess(rateRequestData, 'Origin.Contact') || safeAccess(rateRequestData, 'Origin.contactName') || "Shipping Dept",
            Phone: safeAccess(rateRequestData, 'Origin.Phone') || safeAccess(rateRequestData, 'Origin.contactPhone') || "",
            Fax: "", // Example: ""
            Mobile: "", // Example: ""
            ContactComment: null // Example: null
        },
        Destination: {
            Description: safeAccess(rateRequestData, 'Destination.Description') || safeAccess(rateRequestData, 'Destination.company') || "",
            Street: safeAccess(rateRequestData, 'Destination.Street') || safeAccess(rateRequestData, 'Destination.street') || "",
            StreetExtra: safeAccess(rateRequestData, 'Destination.StreetExtra') || safeAccess(rateRequestData, 'Destination.street2') || "",
            PostalCode: safeAccess(rateRequestData, 'Destination.PostalCode') || safeAccess(rateRequestData, 'Destination.postalCode') || "",
            City: safeAccess(rateRequestData, 'Destination.City') || safeAccess(rateRequestData, 'Destination.city') || "",
            State: safeAccess(rateRequestData, 'Destination.State') || safeAccess(rateRequestData, 'Destination.state') || "",
            Country: getCountryDetails(safeAccess(rateRequestData, 'Destination.Country.Code') || safeAccess(rateRequestData, 'Destination.country') || "US"),
            SpecialInstructions: safeAccess(rateRequestData, 'Destination.SpecialInstructions') || safeAccess(rateRequestData, 'Destination.specialInstructions') || "None",
            GeneralInfo: null, // Example: null
            Direction: null,   // Example: null
            Email: safeAccess(rateRequestData, 'Destination.Email') || safeAccess(rateRequestData, 'Destination.contactEmail') || "",
            Contact: safeAccess(rateRequestData, 'Destination.Contact') || safeAccess(rateRequestData, 'Destination.contactName') || "Receiving Dept",
            Phone: safeAccess(rateRequestData, 'Destination.Phone') || safeAccess(rateRequestData, 'Destination.contactPhone') || "",
            Fax: "", // Example: ""
            Mobile: "", // Example: ""
            ContactComment: null // Example: null
        },
        ReferenceNumber: safeAccess(rateRequestData, 'ReferenceNumber') || safeAccess(rateRequestData, 'Request.ReferenceNumber') || "TS_MISSING",
        PurchaseOrder: safeAccess(rateRequestData, 'PurchaseOrder') || safeAccess(rateRequestData, 'Request.PurchaseOrder') || "PO_MISSING",
        ShipperBOL: safeAccess(rateRequestData, 'ShipperBOL') || safeAccess(rateRequestData, 'Request.ShipperBOL') || "BOL_MISSING",
        OverrideApiRatingDates: false, // Example: false
        DisableApiBookingNotifications: false, // Example: false
        ShipmentDate: formattedShipmentDate, // Example: "2025-05-28T00:00:00-04:00"
        EarliestPickup: { Time: safeAccess(rateRequestData, 'EarliestPickup.Time') || safeAccess(rateRequestData, 'Request.EarliestPickup.Time') || "09:00" },
        LatestPickup: { Time: safeAccess(rateRequestData, 'LatestPickup.Time') || safeAccess(rateRequestData, 'Request.LatestPickup.Time') || "17:00" },
        Items: (safeAccess(rateRequestData, 'Items') || safeAccess(rateRequestData, 'Request.Items') || []).map(item => {
            let freightClassValue = 50.0; // Default
            const fcSource = item.FreightClass?.FreightClass || item.FreightClass;
            if (fcSource) {
                const parsedFc = parseFloat(String(fcSource));
                if (!isNaN(parsedFc)) {
                    freightClassValue = parsedFc;
                }
            }
            return {
                Weight: parseFloat(item.Weight || '0'),
                PackagingQuantity: parseInt(item.PackagingQuantity || '1'),
                SaidToContain: parseInt(item.SaidToContain || '1'),
                Height: parseFloat(item.Height || '0'),
                Width: parseFloat(item.Width || '0'),
                Length: parseFloat(item.Length || '0'),
                Stackable: item.Stackable !== undefined ? item.Stackable : true,
                HazardousMaterial: false, // Example: false
                DeclaredValue: parseFloat(item.DeclaredValue || '0'),
                Description: item.Description || "Goods",
                Comment: "", // Example: ""
                NationalMotorFreightClassification: "", // Example: ""
                HarmonizedTariffSchedule: "", // Example: ""
                Packaging: {
                    Key: parseInt(item.Packaging?.Key || item.Packaging?.PackagingType || '258'), // Example: 258
                    PackageName: item.Packaging?.PackageName || "Pallets", // Example: "Pallets"
                    DefaultLength: parseFloat(item.Packaging?.DefaultLength || '0'), // Example: 0.0
                    DefaultHeight: parseFloat(item.Packaging?.DefaultHeight || '0'), // Example: 0.0
                    DefaultWidth: parseFloat(item.Packaging?.DefaultWidth || '0')  // Example: 0.0
                },
                FreightClass: {
                    FreightClass: freightClassValue // Example: 50.0
                }
            };
        }),
        Accessorials: null, // Example: null
        DeclineAdditionalInsuranceIfApplicable: true, // Example: true
        HazardousMaterialShipment: false, // Example: false
        BrokerName: "", // Example: ""
        BrokerPhone: "", // Example: ""
        BrokerMobile: "", // Example: ""
        BrokerEmail: "", // Example: ""
        BrokerInstructions: "", // Example: ""
        BrokerInfoAddedBy: 0, // Example: 0
        BrokerAgreement: true, // Example: true
        IsBrokerAvailable: false, // Example: false
        SelectedRate: {
            CarrierKey: selectedRateFromFrontend.carrierKey || null,
            CarrierName: selectedRateFromFrontend.carrierName || selectedRateFromFrontend.carrier || "Unknown Carrier",
            CarrierScac: selectedRateFromFrontend.carrierScac || null,
            BilledWeight: parseFloat(selectedRateFromFrontend.billedWeight || '0'),
            RatedWeight: parseFloat(selectedRateFromFrontend.ratedWeight || '0'),
            RatedCubicFeet: parseFloat(selectedRateFromFrontend.ratedCubicFeet || '0'),
            TransitTime: parseInt(selectedRateFromFrontend.transitTime || selectedRateFromFrontend.transitDays || '0'),
            EstimatedDeliveryDate: formattedEstDeliveryDate, // Example: "2025-06-03T00:00:00"
            ServiceMode: selectedRateFromFrontend.serviceMode !== undefined ? parseInt(selectedRateFromFrontend.serviceMode) : 0, // Example: 0
            FreightCharges: parseFloat(selectedRateFromFrontend.freightCharges || selectedRateFromFrontend.freightCharge || '0'),
            FuelCharges: parseFloat(selectedRateFromFrontend.fuelCharges || selectedRateFromFrontend.fuelCharge || '0'),
            AccessorialCharges: parseFloat(selectedRateFromFrontend.accessorialCharges || '0'),
            ServiceCharges: parseFloat(selectedRateFromFrontend.serviceCharges || '0'),
            TotalCharges: parseFloat(selectedRateFromFrontend.totalCharges || '0'),
            Mileage: parseFloat(selectedRateFromFrontend.mileage || '0'), // Example: 0.0
            MileageSourceKey: parseInt(selectedRateFromFrontend.mileageSourceKey || '0'), // Example: 0
            MileageSourceDescription: selectedRateFromFrontend.mileageSourceDescription || null, // Example: null
            BillingDetails: selectedRateFromFrontend.billingDetails || [],
            GuarOptions: selectedRateFromFrontend.guarOptions || [],
            SelectedGuarOption: selectedRateFromFrontend.selectedGuarOption || null, // Example: null
            // Fields from user example not directly in current selectedRateFromFrontend structure - need to ensure these are sourced if available
            // For now, adding them as null or default if not found.
            QuoteId: selectedRateFromFrontend.rateId || selectedRateFromFrontend.quoteId || null, // Make sure this is mapped
        },
        // These fields appear in the example at the root, but seem like response fields.
        // For now, I will add them as null as per the example, if they are truly expected in the request.
        // Usually, a request wouldn't contain fields like "BookedRate" or "ContainsErrorMessage".
        // This implies the user's example might be a complete eShipPlus object that can represent both request and response states.
        // For a *booking request*, these would typically be omitted or explicitly null.
        BookedRate: null,
        ReturnConfirmations: null,
        Messages: null,
        ContainsErrorMessage: false // Assuming 'false' for a request
    };
    
    // Remove ServiceProviderType, top-level Accessorials, and top-level Currency from previous versions.
    // The entire structure is now based on the user's comprehensive example.

    logger.info("Final Transformed Booking Payload:", JSON.stringify(bookingPayload, null, 2));
    return bookingPayload;
}

// Shared function logic to process booking requests
console.log('LOG: bookRate.js - processBookingRequest defined.');
async function processBookingRequest(data) {
    console.log('LOG: processBookingRequest - Function invoked.');
    logger.info('LOG: processBookingRequest - INFO: Function invoked with data:', data ? Object.keys(data) : 'No data');
    
    try {
        const skipApiKeyValidation = process.env.NODE_ENV === 'development' || process.env.SKIP_API_KEY_VALIDATION === 'true';
        const apiKey = data.apiKey; // This is the SolushipX client API key
        
        if (!skipApiKeyValidation) {
            if (!apiKey) {
                logger.warn('API key validation: No API key provided for SolushipX function call');
                throw new functions.https.HttpsError('unauthenticated', 'SolushipX API key is required');
            }
            const isValidApiKey = await validateApiKey(apiKey); // Validates SolushipX client API key
            if (!isValidApiKey) {
                logger.warn('API key validation: Invalid SolushipX API key provided');
                throw new functions.https.HttpsError('unauthenticated', 'Invalid SolushipX API key');
            }
            logger.info('API key validation: Valid SolushipX API key');
        } else {
            logger.info('API key validation for SolushipX function call: Skipped');
        }

        // Extract the booking data
        const { apiKey: clientApiKey, rateRequestData, selectedRate, ...additionalData } = data;

        if (!rateRequestData || !selectedRate) {
            logger.error('processBookingRequest: Missing rateRequestData or selectedRate in input data.', { hasRateRequestData: !!rateRequestData, hasSelectedRate: !!selectedRate });
            throw new functions.https.HttpsError('invalid-argument', 'Both rateRequestData and selectedRate are required for booking');
        }
        
        // Transform the rate request data into the new booking request format
        // The transformRateDataToBookingRequest now produces the entire payload
        const eShipPlusBookingPayload = transformRateDataToBookingRequest(rateRequestData, { ...selectedRate, ...additionalData });

        // Validate required fields for booking against the new structure
        const validationError = validateBookingRequest(eShipPlusBookingPayload); // Pass the whole payload
        if (validationError) {
            logger.error('Booking Payload Validation Error:', validationError, { payload: eShipPlusBookingPayload });
            throw new functions.https.HttpsError('invalid-argument', validationError);
        }

        logger.info('eShipPlus Booking request payload (to be sent):', JSON.stringify(eShipPlusBookingPayload, null, 2));

        // Prepare eShipPlusAuth Header using environment variables
        const esAccessCode = process.env.ESHIPPLUS_ACCESS_CODE;
        const esUserName = process.env.ESHIPPLUS_USERNAME;
        const esPassword = process.env.ESHIPPLUS_PASSWORD;
        const esAccessKey = process.env.ESHIPPLUS_ACCESS_KEY;

        if (!esUserName || !esPassword || !esAccessKey || !esAccessCode) {
            logger.error('eShipPlus API credentials (ESHIPPLUS_USERNAME, ESHIPPLUS_PASSWORD, ESHIPPLUS_ACCESS_KEY, ESHIPPLUS_ACCESS_CODE) missing in environment variables.');
            throw new functions.https.HttpsError('internal', 'Server configuration error for eShipPlus credentials.');
        }

        const authPayload = {
            UserName: esUserName,
            Password: esPassword,
            AccessKey: esAccessKey,
            AccessCode: esAccessCode
        };
        const eShipPlusAuthHeader = Buffer.from(JSON.stringify(authPayload)).toString('base64');
        logger.info('eShipPlusAuth Header generated for booking.');
        
        // Make the booking request to eShipPlus REST API
        const response = await axios.post(ESHIPPLUS_BOOK_URL, eShipPlusBookingPayload, { // Send the new payload directly
            headers: {
                'Content-Type': 'application/json',
                'eShipPlusAuth': eShipPlusAuthHeader,
            },
            validateStatus: function (status) {
                return status >= 200 && status < 600; 
            }
        });

        logger.info(`eShipPlus Booking API Response Status: ${response.status}`);
        
        if (response.status >= 300) {
            logger.warn('eShipPlus Booking API Raw Response Data (Status >= 300):', response.data);
        } else {
            logger.debug('eShipPlus Booking API Raw Response Data (Status 2xx):', response.data);
        }

        if (response.status >= 400) {
            let errorMessage = `EShipPlus Booking API Error: HTTP Status ${response.status}.`;
            let errorDetailsForClient = { rawResponse: 'See function logs for full details.' };

            if (response.data) {
                if (typeof response.data === 'object') {
                    errorDetailsForClient = response.data;
                    if (response.data.Messages && Array.isArray(response.data.Messages) && response.data.Messages.length > 0) {
                        errorMessage += ` Messages: ${response.data.Messages.map(m => m.Text || JSON.stringify(m)).join('; ')}`;
                    } else if (response.data.ErrorMessage) {
                        errorMessage += ` ErrorMessage: ${response.data.ErrorMessage}`;
                    } else if (response.data.message) {
                        errorMessage += ` Message: ${response.data.message}`;
                    } else if (response.data.error) {
                        errorMessage += ` Error: ${response.data.error}`;
                    }
                } else if (typeof response.data === 'string' && response.data.length < 1024) {
                    errorMessage += ` Response: ${response.data}`;
                    errorDetailsForClient = { rawResponse: response.data };
                }
            }
            
            logger.error("Full EShipPlus Booking Error Response: ", errorMessage, { fullEShipPlusResponse: response.data });
            
            const f_error_code = response.data?.ContainsErrorMessage || response.status === 503 ? 'unavailable' : 'internal';
            throw new functions.https.HttpsError(f_error_code, errorMessage, errorDetailsForClient);
        }

        // Check for business logic errors even on 2xx status
        if (response.data && response.data.ContainsErrorMessage === true) {
            let errorMessage = `EShipPlus Booking API indicated an error in the response despite HTTP ${response.status} status.`;
            if (response.data.Messages && Array.isArray(response.data.Messages) && response.data.Messages.length > 0) {
                errorMessage += ` Messages: ${response.data.Messages.map(m => m.Text || JSON.stringify(m)).join('; ')}`;
            }
            logger.error(errorMessage, { fullEShipPlusResponse: response.data });
            throw new functions.https.HttpsError('failed-precondition', errorMessage, response.data);
        }

        const transformedData = transformBookingResponseToInternalFormat(response.data);
        
        if (!transformedData) {
            logger.error('Failed to transform eShipPlus booking response:', response.data);
            throw new functions.https.HttpsError('internal', 'Failed to process booking response from eShipPlus API.');
        }

        logger.info('Successfully processed booking with eShipPlus REST API.');

        return {
            success: true,
            data: transformedData
        };
    } catch (error) {
        logger.error('Error in processBookingRequest:', error.message, error.stack, error.details);
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'An internal error occurred while processing the booking request.');
    }
}
console.log('LOG: bookRate.js - processBookingRequest defined.');

/**
 * Export v2 callable function for booking
 */
console.log('LOG: bookRate.js - Setting up exports.bookRateEShipPlus.');
exports.bookRateEShipPlus = onCall({
    cors: true,
    timeoutSeconds: 120, // Longer timeout for booking operations
    memory: "256MiB",
    region: 'us-central1'
}, async (request) => {
    console.log('LOG: exports.bookRateEShipPlus - onCall handler invoked.');
    logger.info('LOG: exports.bookRateEShipPlus - INFO: onCall handler invoked. Auth context:', request.auth ? 'Present' : 'Absent');
    logger.info(`LOG: exports.bookRateEShipPlus - Value of process.env.ESHIPPLUS_API_KEY: ${process.env.ESHIPPLUS_API_KEY}`);
    
    try {
        return await processBookingRequest(request.data);
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
console.log('LOG: bookRate.js - exports.bookRateEShipPlus defined and exported. File loading complete.');

/**
 * Validates the API key against stored valid keys
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<boolean>} - Whether the API key is valid
 */
console.log('LOG: bookRate.js - validateApiKey defined.');
async function validateApiKey(apiKey) {
    try {
        // Get configured API key from Firebase config - THIS IS FOR SOLUSHIPX BACKEND KEY, NOT ESHIPPLUS
        // For v2, this config API key should also be in an env var if not using `development-api-key`
        const configApiKey = process.env.SOLUSHIPX_BACKEND_API_KEY; 
        
        if (process.env.NODE_ENV === 'development' && apiKey === 'development-api-key') {
            return true;
        }
        
        if (configApiKey && apiKey === configApiKey) {
            return true;
        }
        
        const db = admin.firestore();
        const apiKeysRef = db.collection('apiKeys');
        const snapshot = await apiKeysRef.where('key', '==', apiKey).where('active', '==', true).limit(1).get();
        
        return !snapshot.empty;
    } catch (error) {
        logger.error('Error validating API key:', error);
        return false;
    }
}
console.log('LOG: bookRate.js - validateApiKey defined.');

// Helper function to validate address structure (copied from getRates.js)
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

/**
 * Validates the booking request data
 * @param {Object} data - The booking request data
 * @returns {string|null} - Error message if validation fails, null if valid
 */
console.log('LOG: bookRate.js - validateBookingRequest defined.');
function validateBookingRequest(payload) { // payload is now the entire request object
    logger.info('Validating Full Booking Payload:', JSON.stringify(payload, null, 2));

    // Check for essential top-level fields from the example
    if (payload.BookingReferenceNumber === undefined) return 'Missing BookingReferenceNumber at root';
    if (payload.BookingReferenceNumberType === undefined) return 'Missing BookingReferenceNumberType at root';
    if (payload.ShipmentBillType === undefined) return 'Missing ShipmentBillType at root';
    if (!payload.Origin) return 'Missing Origin object at root';
    if (!payload.Destination) return 'Missing Destination object at root';
    if (!payload.Items || !Array.isArray(payload.Items) || payload.Items.length === 0) return 'Missing or empty Items array at root';
    if (!payload.SelectedRate) return 'Missing SelectedRate object at root'; // SelectedRate is direct child of payload

    // Validate Origin and Destination (basic checks, can be expanded)
    const validateAddressStructure = (address, type) => {
        if (!address.Street) return `Missing ${type}.Street`;
        if (!address.City) return `Missing ${type}.City`;
        if (!address.State) return `Missing ${type}.State`;
        if (!address.PostalCode) return `Missing ${type}.PostalCode`;
        if (!address.Country || !address.Country.Code) return `Missing ${type}.Country.Code`;
        if (address.Contact === undefined) return `Missing ${type}.Contact`; // Check for undefined, as "" is valid
        return null;
    };

    let err = validateAddressStructure(payload.Origin, 'Origin');
    if (err) return err;
    err = validateAddressStructure(payload.Destination, 'Destination');
    if (err) return err;

    // Validate Items (basic checks)
    for (const [index, item] of payload.Items.entries()) {
        if (item.Weight === undefined || isNaN(parseFloat(item.Weight))) return `Invalid or missing Weight for item ${index + 1}`;
        if (!item.Packaging || item.Packaging.Key === undefined) return `Missing Packaging.Key for item ${index + 1}`;
        if (!item.FreightClass || item.FreightClass.FreightClass === undefined || isNaN(parseFloat(item.FreightClass.FreightClass))) return `Invalid or missing FreightClass.FreightClass for item ${index + 1}`;
    }

    // Validate SelectedRate (basic checks)
    const selectedRate = payload.SelectedRate;
    if (!selectedRate.CarrierKey) return 'Missing SelectedRate.CarrierKey';
    if (selectedRate.TotalCharges === undefined || isNaN(parseFloat(selectedRate.TotalCharges))) return 'Invalid or missing SelectedRate.TotalCharges';

    // Validate other required fields from example
    if (payload.OverrideApiRatingDates === undefined) return 'Missing OverrideApiRatingDates flag';
    if (payload.DisableApiBookingNotifications === undefined) return 'Missing DisableApiBookingNotifications flag';
    if (!payload.ShipmentDate) return 'Missing ShipmentDate';
    if (!payload.EarliestPickup || !payload.EarliestPickup.Time) return 'Missing EarliestPickup.Time';
    if (!payload.LatestPickup || !payload.LatestPickup.Time) return 'Missing LatestPickup.Time';
    if (payload.DeclineAdditionalInsuranceIfApplicable === undefined) return 'Missing DeclineAdditionalInsuranceIfApplicable flag';
    if (payload.HazardousMaterialShipment === undefined) return 'Missing HazardousMaterialShipment flag';
    if (payload.BrokerAgreement === undefined) return 'Missing BrokerAgreement flag';
    if (payload.IsBrokerAvailable === undefined) return 'Missing IsBrokerAvailable flag';
    if (payload.Accessorials !== null && !Array.isArray(payload.Accessorials)) return 'Accessorials must be null or an array';


    // Fields that might seem like response fields but are in the user's request example structure
    // For a request, these should ideally be `false` or `null` as appropriate.
    if (payload.ContainsErrorMessage !== false && payload.ContainsErrorMessage !== undefined) {
        logger.warn(`ContainsErrorMessage is present and not false in the request payload: ${payload.ContainsErrorMessage}`);
        // Not returning error, but logging as it's unusual for a request.
    }
    if (payload.BookedRate !== null && payload.BookedRate !== undefined) {
         logger.warn(`BookedRate is present and not null in the request payload.`);
    }
     if (payload.ReturnConfirmations !== null && payload.ReturnConfirmations !== undefined) {
         logger.warn(`ReturnConfirmations is present and not null in the request payload.`);
    }
     if (payload.Messages !== null && payload.Messages !== undefined && (!Array.isArray(payload.Messages) || payload.Messages.length > 0)) {
         logger.warn(`Messages field is present and not null/empty in the request payload.`);
    }


    logger.info('Booking Payload Validation Passed (based on new comprehensive example).');
    return null;
}
console.log('LOG: bookRate.js - validateBookingRequest defined.'); 