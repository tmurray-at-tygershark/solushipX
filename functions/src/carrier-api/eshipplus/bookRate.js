console.log('LOG: bookRate.js - Top of file, imports starting.');
const functions = require('firebase-functions');
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const axios = require('axios');
const admin = require('firebase-admin');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const advancedFormat = require('dayjs/plugin/advancedFormat');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const { getCarrierApiConfig, createEShipPlusAuthHeader, validateCarrierEndpoints, sanitizePostalCode } = require('../../utils');
console.log('LOG: bookRate.js - Basic imports complete.');

// Remove hardcoded URL - now dynamically built from carrier credentials
// const ESHIPPLUS_BOOK_URL = "https://cloudstaging.eshipplus.com/services/rest/BookShipment.aspx";
console.log('LOG: bookRate.js - Dynamic API URL configuration enabled.');

// Constants
console.log('LOG: bookRate.js - Defining constants.');

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

// Import document manager
const { processCarrierDocuments } = require('../../shipment-documents/documentManager');

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);
dayjs.extend(customParseFormat);

const db = admin.firestore();

function transformBookingResponseToInternalFormat(apiResponse) {
    if (!apiResponse) return null;

    // Add detailed logging to understand the actual response structure
    logger.info('=== DEBUGGING eShipPlus Booking Response Structure ===');
    logger.info('Full API Response:', JSON.stringify(apiResponse, null, 2));
    logger.info('Response keys:', Object.keys(apiResponse));
    logger.info('BookedRate exists:', !!apiResponse.BookedRate);
    logger.info('SelectedRate exists:', !!apiResponse.SelectedRate);
    logger.info('ProNumber field:', apiResponse.ProNumber);
    logger.info('BolNumber field:', apiResponse.BolNumber);
    logger.info('CarrierName field:', apiResponse.CarrierName);
    logger.info('CarrierScac field:', apiResponse.CarrierScac);
    logger.info('ReturnConfirmations count:', (apiResponse.ReturnConfirmations || []).length);
    logger.info('=== END DEBUGGING ===');

    const bookedRateDetails = apiResponse.BookedRate || {}; // Use BookedRate if available or main response parts
    const selectedRateDetails = apiResponse.SelectedRate || {}; // Fallback if BookedRate is minimal

    // Determine the best confirmation number
    let confirmationNumber = apiResponse.ProNumber || apiResponse.BolNumber || apiResponse.BookingReferenceNumber || bookedRateDetails.ProNumber || bookedRateDetails.BolNumber;

    const transformed = {
        success: !apiResponse.ContainsErrorMessage,
        bookingReference: apiResponse.BookingReferenceNumber,
        confirmationNumber: confirmationNumber,
        proNumber: apiResponse.ProNumber || bookedRateDetails.ProNumber || null,
        bolNumber: apiResponse.BolNumber || bookedRateDetails.BolNumber || null,
        carrierName: bookedRateDetails.CarrierName || selectedRateDetails.CarrierName || apiResponse.CarrierName || null,
        carrierScac: bookedRateDetails.CarrierScac || selectedRateDetails.CarrierScac || apiResponse.CarrierScac || null,
        
        // Use BookedRate for financial details if available, otherwise SelectedRate from response
        totalCharges: bookedRateDetails.TotalCharges !== undefined ? parseFloat(bookedRateDetails.TotalCharges) : parseFloat(selectedRateDetails.TotalCharges || 0),
        freightCharges: parseFloat(bookedRateDetails.FreightCharges || selectedRateDetails.FreightCharges || 0),
        fuelCharges: parseFloat(bookedRateDetails.FuelCharges || selectedRateDetails.FuelCharges || 0),
        accessorialCharges: parseFloat(bookedRateDetails.AccessorialCharges || selectedRateDetails.AccessorialCharges || 0),
        serviceCharges: parseFloat(bookedRateDetails.ServiceCharges || selectedRateDetails.ServiceCharges || 0),
        
        // Add currency field with fallback to prevent undefined values
        currency: bookedRateDetails.Currency || selectedRateDetails.Currency || apiResponse.Currency || 'USD',
        
        transitTime: bookedRateDetails.TransitTime !== undefined ? parseInt(bookedRateDetails.TransitTime) : parseInt(selectedRateDetails.TransitTime || 0),
        estimatedDeliveryDate: bookedRateDetails.EstimatedDeliveryDate || selectedRateDetails.EstimatedDeliveryDate || null,
        
        // Keep raw documents for document manager processing
        rawShippingDocuments: apiResponse.ReturnConfirmations || [],
        
        // Legacy shipping documents structure (for backward compatibility)
        shippingDocuments: (apiResponse.ReturnConfirmations || []).map(doc => ({
            docType: doc.DocType, 
            name: doc.Name,
            hasImage: !!doc.DocImage, 
            imagePreview: doc.DocImage ? doc.DocImage.substring(0, 50) + '...' : null,
            // Note: Full DocImage is preserved in rawShippingDocuments
        })),
        
        messages: apiResponse.Messages || [],
        containsErrorMessage: apiResponse.ContainsErrorMessage || false,
        rawBookingResponse: apiResponse // Store the full raw response for auditing/debugging
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

    // Extract reference number from various possible locations
    const referenceNumber = safeAccess(rateRequestData, 'ReferenceNumber') || 
                           safeAccess(rateRequestData, 'referenceNumber') || 
                           safeAccess(rateRequestData, 'shipmentInfo.shipperReferenceNumber') || 
                           safeAccess(rateRequestData, 'shipmentID') || 
                           bookingReferenceNumber || 
                           "REF" + Date.now();

    // Defaulting to UTC for formatting if no timezone info is present.
    // The example shows "-04:00". If the input dates have timezone, dayjs should preserve it.
    // Otherwise, we format to ISO string, and the API might handle it or expect UTC.
    const shipmentDate = safeAccess(rateRequestData, 'ShipmentDate');
    const formattedShipmentDate = shipmentDate ? dayjs(shipmentDate).format('YYYY-MM-DDTHH:mm:ss-04:00').replace(/T\d{2}:\d{2}:\d{2}/, 'T00:00:00') : dayjs().format('YYYY-MM-DDTHH:mm:ss-04:00').replace(/T\d{2}:\d{2}:\d{2}/, 'T00:00:00');

    const estDeliveryDate = selectedRateFromFrontend.estimatedDeliveryDate;
    const formattedEstDeliveryDate = estDeliveryDate ? dayjs(estDeliveryDate).format('YYYY-MM-DDTHH:mm:ss') : null;


    const bookingPayload = {
        BookingReferenceNumber: bookingReferenceNumber,
        BookingReferenceNumberType: bookingReferenceNumberType,
        ShipmentBillType: 0, // Example: 0
        Origin: {
            Description: safeAccess(rateRequestData, 'Origin.Description') || safeAccess(rateRequestData, 'Origin.company') || "",
            Street: safeAccess(rateRequestData, 'Origin.Street') || safeAccess(rateRequestData, 'Origin.street') || "",
            StreetExtra: safeAccess(rateRequestData, 'Origin.StreetExtra') || safeAccess(rateRequestData, 'Origin.street2') || "",
            PostalCode: sanitizePostalCode(safeAccess(rateRequestData, 'Origin.PostalCode') || safeAccess(rateRequestData, 'Origin.postalCode') || ""),
            City: safeAccess(rateRequestData, 'Origin.City') || safeAccess(rateRequestData, 'Origin.city') || "",
            State: safeAccess(rateRequestData, 'Origin.State') || safeAccess(rateRequestData, 'Origin.state') || "",
            Country: getCountryDetails(safeAccess(rateRequestData, 'Origin.Country.Code') || safeAccess(rateRequestData, 'Origin.country') || "US"),
            SpecialInstructions: safeAccess(rateRequestData, 'Origin.SpecialInstructions') || safeAccess(rateRequestData, 'Origin.specialInstructions') || "none",
            
            
            Email: safeAccess(rateRequestData, 'Origin.Email') || safeAccess(rateRequestData, 'Origin.contactEmail') || "",
            Contact: safeAccess(rateRequestData, 'Origin.Contact') || safeAccess(rateRequestData, 'Origin.contactName') || "Shipping Dept",
            Phone: safeAccess(rateRequestData, 'Origin.Phone') || safeAccess(rateRequestData, 'Origin.contactPhone') || "",
            Fax: "", // Example: ""
            Mobile: "", // Example: ""
            
        },
        Destination: {
            Description: safeAccess(rateRequestData, 'Destination.Description') || safeAccess(rateRequestData, 'Destination.company') || "",
            Street: safeAccess(rateRequestData, 'Destination.Street') || safeAccess(rateRequestData, 'Destination.street') || "",
            StreetExtra: safeAccess(rateRequestData, 'Destination.StreetExtra') || safeAccess(rateRequestData, 'Destination.street2') || "",
            PostalCode: sanitizePostalCode(safeAccess(rateRequestData, 'Destination.PostalCode') || safeAccess(rateRequestData, 'Destination.postalCode') || ""),
            City: safeAccess(rateRequestData, 'Destination.City') || safeAccess(rateRequestData, 'Destination.city') || "",
            State: safeAccess(rateRequestData, 'Destination.State') || safeAccess(rateRequestData, 'Destination.state') || "",
            Country: getCountryDetails(safeAccess(rateRequestData, 'Destination.Country.Code') || safeAccess(rateRequestData, 'Destination.country') || "US"),
            SpecialInstructions: safeAccess(rateRequestData, 'Destination.SpecialInstructions') || safeAccess(rateRequestData, 'Destination.specialInstructions') || "None",
            
            
            Email: safeAccess(rateRequestData, 'Destination.Email') || safeAccess(rateRequestData, 'Destination.contactEmail') || "",
            Contact: safeAccess(rateRequestData, 'Destination.Contact') || safeAccess(rateRequestData, 'Destination.contactName') || "Receiving Dept",
            Phone: safeAccess(rateRequestData, 'Destination.Phone') || safeAccess(rateRequestData, 'Destination.contactPhone') || "",
            Fax: "", // Example: ""
            Mobile: "", // Example: ""
            
        },
        ReferenceNumber: referenceNumber,
        PurchaseOrder: safeAccess(rateRequestData, 'PurchaseOrder') || safeAccess(rateRequestData, 'Request.PurchaseOrder') || safeAccess(rateRequestData, 'BookingReferenceNumber') || "PO" + Date.now(),
        ShipperBOL: safeAccess(rateRequestData, 'ShipperBOL') || safeAccess(rateRequestData, 'Request.ShipperBOL') || "BOL" + Date.now(),
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
                Weight: parseFloat(parseFloat(item.Weight || '0').toFixed(1)),
                PackagingQuantity: parseInt(item.PackagingQuantity || '1'),
                SaidToContain: parseInt(item.SaidToContain || '1'),
                Height: parseFloat(parseFloat(item.Height || '0').toFixed(1)),
                Width: parseFloat(parseFloat(item.Width || '0').toFixed(1)),
                Length: parseFloat(parseFloat(item.Length || '0').toFixed(1)),
                Stackable: item.Stackable !== undefined ? item.Stackable : true,
                HazardousMaterial: false, // Example: false
                DeclaredValue: parseFloat(parseFloat(item.DeclaredValue || '0').toFixed(1)),
                Description: item.Description || "Goods",
                
                
                
                Packaging: {
                    Key: parseInt(item.Packaging?.Key || item.Packaging?.PackagingType || '258'), // Example: 258
                    PackageName: item.Packaging?.PackageName || "Pallets", // Example: "Pallets"
                    DefaultLength: parseFloat(parseFloat(item.Packaging?.DefaultLength || '0').toFixed(1)), // Example: 0.0
                    DefaultHeight: parseFloat(parseFloat(item.Packaging?.DefaultHeight || '0').toFixed(1)), // Example: 0.0
                    DefaultWidth: parseFloat(parseFloat(item.Packaging?.DefaultWidth || '0').toFixed(1))  // Example: 0.0
                },
                FreightClass: {
                    FreightClass: parseFloat(parseFloat(freightClassValue).toFixed(1)) // Example: 50.0
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
            CarrierScac: selectedRateFromFrontend.carrierScac || selectedRateFromFrontend.carrierCode || null,
            BilledWeight: parseFloat(parseFloat(selectedRateFromFrontend.billedWeight || '0').toFixed(1)),
            RatedWeight: parseFloat(parseFloat(selectedRateFromFrontend.ratedWeight || '0').toFixed(1)),
            RatedCubicFeet: parseFloat(parseFloat(selectedRateFromFrontend.ratedCubicFeet || '0').toFixed(4)),
            TransitTime: parseInt(selectedRateFromFrontend.transitTime || selectedRateFromFrontend.transitDays || '0'),
            EstimatedDeliveryDate: formattedEstDeliveryDate, // Example: "2025-06-03T00:00:00"
            ServiceMode: 0, // CRITICAL: eShipPlus requires 0, not null
            FreightCharges: parseFloat(parseFloat(selectedRateFromFrontend.freightCharges || selectedRateFromFrontend.freightCharge || '0').toFixed(4)),
            FuelCharges: parseFloat(parseFloat(selectedRateFromFrontend.fuelCharges || selectedRateFromFrontend.fuelCharge || '0').toFixed(4)),
            AccessorialCharges: parseFloat(parseFloat(selectedRateFromFrontend.accessorialCharges || '0').toFixed(4)),
            ServiceCharges: parseFloat(parseFloat(selectedRateFromFrontend.serviceCharges || '0').toFixed(4)),
            TotalCharges: parseFloat(parseFloat(selectedRateFromFrontend.totalCharges || '0').toFixed(2)),
            Mileage: parseFloat(parseFloat(selectedRateFromFrontend.mileage || '0').toFixed(1)), // Example: 0.0
            MileageSourceKey: parseInt(selectedRateFromFrontend.mileageSourceKey || '0'), // Example: 0
            MileageSourceDescription: selectedRateFromFrontend.mileageSourceDescription || null, // Example: null
            BillingDetails: (selectedRateFromFrontend.billingDetails || []).map(detail => ({ ReferenceNumber: detail.ReferenceNumber || "", ReferenceType: detail.ReferenceType || 2, BillingCode: detail.BillingCode || "", Description: detail.Description || "", Category: detail.Category || 0, AmountDue: parseFloat(detail.AmountDue || 0) })),
            
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
    logger.info('LOG: processBookingRequest - INFO: Function invoked with data keys:', data ? Object.keys(data) : 'No data');
    // logger.info('LOG: processBookingRequest - Full incoming data:', JSON.stringify(data, null, 2)); // Be cautious with logging full PII
    
    const db = admin.firestore(); // Ensure Firestore admin is initialized if not already global

    try {
        const skipApiKeyValidation = process.env.NODE_ENV === 'development' || process.env.SKIP_API_KEY_VALIDATION === 'true';
        const clientApiKey = data.apiKey; // This is the SolushipX client API key for calling this function
        
        if (!skipApiKeyValidation) {
            if (!clientApiKey) {
                logger.warn('API key validation: No API key provided for SolushipX function call');
                throw new functions.https.HttpsError('unauthenticated', 'SolushipX API key is required');
            }
            const isValidApiKey = await validateApiKey(clientApiKey); 
            if (!isValidApiKey) {
                logger.warn('API key validation: Invalid SolushipX API key provided');
                throw new functions.https.HttpsError('unauthenticated', 'Invalid SolushipX API key');
            }
            logger.info('API key validation: Valid SolushipX API key');
        } else {
            logger.info('API key validation for SolushipX function call: Skipped');
        }

        // Extract the booking data and necessary IDs
        const { 
            // apiKey is handled above
            rateRequestData, 
            draftFirestoreDocId, 
            selectedRateDocumentId 
            // Removed selectedRate and ...additionalData as they are no longer sent from client for this
        } = data;

        // Validate required fields
        if (!rateRequestData || !draftFirestoreDocId || !selectedRateDocumentId) {
            logger.error('processBookingRequest: Missing one or more required fields.', { 
                hasRateRequestData: !!rateRequestData, 
                hasDraftFirestoreDocId: !!draftFirestoreDocId,
                hasSelectedRateDocumentId: !!selectedRateDocumentId
            });
            throw new functions.https.HttpsError('invalid-argument', 'rateRequestData, draftFirestoreDocId, and selectedRateDocumentId are all required for booking.');
        }
        logger.info('processBookingRequest: All required IDs present.', { draftFirestoreDocId, selectedRateDocumentId });

        // Fetch the selected rate details from Firestore
        const rateDocRef = db.collection('shipmentRates').doc(selectedRateDocumentId);
        const rateDocSnapshot = await rateDocRef.get();

        if (!rateDocSnapshot.exists) {
            logger.error(`Selected rate document ${selectedRateDocumentId} not found in shipmentRates.`);
            throw new functions.https.HttpsError('not-found', `Selected rate details (ID: ${selectedRateDocumentId}) not found.`);
        }
        const selectedRateDataFromFirestore = rateDocSnapshot.data();
        // Expecting rawRateDetails to contain the object structure previously sent as 'selectedRate' from client
        const rateObjectForTransformer = selectedRateDataFromFirestore.rawRateDetails || selectedRateDataFromFirestore; 

        // Add detailed logging to understand what data we're working with
        logger.info('=== DEBUGGING Rate Data from Firestore ===');
        logger.info('Full selectedRateDataFromFirestore:', JSON.stringify(selectedRateDataFromFirestore, null, 2));
        logger.info('selectedRateDataFromFirestore keys:', Object.keys(selectedRateDataFromFirestore));
        logger.info('rawRateDetails exists:', !!selectedRateDataFromFirestore.rawRateDetails);
        logger.info('rateObjectForTransformer:', JSON.stringify(rateObjectForTransformer, null, 2));
        logger.info('rateObjectForTransformer keys:', Object.keys(rateObjectForTransformer));
        logger.info('=== END DEBUGGING Rate Data ===');

        // Helper function to normalize rate data from both old and new structures
        const normalizeRateDataForBooking = (rateData) => {
            logger.info('=== NORMALIZING RATE DATA FOR BOOKING ===');
            logger.info('Input rate data keys:', Object.keys(rateData));
            
            // CRITICAL FIX: Handle nested rate data structure from CreateShipmentX
            // If the data has a nested 'rateData' field, extract it
            let actualRateData = rateData;
            if (rateData.rateData && typeof rateData.rateData === 'object') {
                logger.info('Found nested rateData structure, extracting...');
                actualRateData = rateData.rateData;
                logger.info('Extracted rate data keys:', Object.keys(actualRateData));
            }
            
            // Check if this is already in universal format
            if (actualRateData.carrier && actualRateData.pricing && actualRateData.transit) {
                logger.info('Rate data is in universal format');
                return {
                    // Map universal format to eShipPlus booking format
                    carrierKey: actualRateData.carrier.key,
                    carrierName: actualRateData.carrier.name,
                    carrierScac: actualRateData.carrier.scac,
                    
                    freightCharges: actualRateData.pricing.freight,
                    fuelCharges: actualRateData.pricing.fuel,
                    accessorialCharges: actualRateData.pricing.accessorial,
                    serviceCharges: actualRateData.pricing.service,
                    totalCharges: actualRateData.pricing.total,
                    
                    transitTime: actualRateData.transit.days,
                    transitDays: actualRateData.transit.days,
                    estimatedDeliveryDate: actualRateData.transit.estimatedDelivery,
                    
                    billedWeight: actualRateData.weight.billed,
                    ratedWeight: actualRateData.weight.rated,
                    ratedCubicFeet: actualRateData.dimensions.cubicFeet,
                    
                    serviceMode: 0, // Always 0 for eShipPlus
                    serviceType: actualRateData.service.type,
                    
                    rateId: actualRateData.rateId,
                    quoteId: actualRateData.quoteId,
                    
                    billingDetails: actualRateData.pricing.breakdown,
                    guarOptions: actualRateData.transit.guaranteeOptions,
                    selectedGuarOption: null,
                    mileage: 0,
                    mileageSourceKey: 0,
                    mileageSourceDescription: null,
                    
                    _isUniversalFormat: true,
                    _originalData: actualRateData
                };
            }
            
            // Check if this is in old eShipPlus format
            if (actualRateData.carrierKey || actualRateData.carrierName || actualRateData.freightCharges) {
                logger.info('Rate data appears to be in old eShipPlus format, using as-is');
                return {
                    ...actualRateData,
                    _isOldFormat: true
                };
            }
            
            // Check if this is in the standardized format from Rates.jsx
            if (actualRateData.carrierCode || actualRateData.totalCharges || actualRateData.freightCharge) {
                logger.info('Rate data appears to be in standardized format, converting to eShipPlus format');
                return {
                    // Map standardized fields to eShipPlus format
                    carrierKey: actualRateData.carrierKey || null,
                    carrierName: actualRateData.carrierName || actualRateData.carrier || null,
                    carrierScac: actualRateData.carrierScac || actualRateData.carrierCode || null,
                    
                    // Financial fields - handle both old and new naming
                    freightCharges: actualRateData.freightCharges || actualRateData.freightCharge || 0,
                    fuelCharges: actualRateData.fuelCharges || actualRateData.fuelCharge || 0,
                    serviceCharges: actualRateData.serviceCharges || 0,
                    accessorialCharges: actualRateData.accessorialCharges || 0,
                    totalCharges: actualRateData.totalCharges || 0,
                    
                    // Transit and delivery
                    transitTime: actualRateData.transitTime || actualRateData.transitDays || 0,
                    transitDays: actualRateData.transitDays || actualRateData.transitTime || 0,
                    estimatedDeliveryDate: actualRateData.estimatedDeliveryDate || null,
                    
                    // Weight and dimensions
                    billedWeight: actualRateData.billedWeight || 0,
                    ratedWeight: actualRateData.ratedWeight || 0,
                    ratedCubicFeet: actualRateData.ratedCubicFeet || 0,
                    
                    // Service details
                    serviceMode: 0, // Always 0 for eShipPlus
                    serviceType: actualRateData.serviceType || actualRateData.serviceMode || '',
                    
                    // IDs and references
                    rateId: actualRateData.rateId || actualRateData.quoteId || null,
                    quoteId: actualRateData.quoteId || actualRateData.rateId || null,
                    
                    // Additional fields
                    billingDetails: actualRateData.billingDetails || [],
                    guarOptions: actualRateData.guarOptions || [],
                    selectedGuarOption: actualRateData.selectedGuarOption || null,
                    mileage: actualRateData.mileage || 0,
                    mileageSourceKey: actualRateData.mileageSourceKey || 0,
                    mileageSourceDescription: actualRateData.mileageSourceDescription || null,
                    
                    _isStandardizedFormat: true,
                    _originalData: actualRateData
                };
            }
            
            // If we can't determine the format, log a warning and return as-is
            logger.warn('Could not determine rate data format, using as-is:', Object.keys(actualRateData));
            return {
                ...actualRateData,
                _isUnknownFormat: true
            };
        };

        const normalizedRateData = normalizeRateDataForBooking(rateObjectForTransformer);
        logger.info('Normalized rate data for booking:', JSON.stringify(normalizedRateData, null, 2));

        if (!rateObjectForTransformer || typeof rateObjectForTransformer !== 'object' || Object.keys(rateObjectForTransformer).length === 0) {
            logger.error(`Fetched rate document ${selectedRateDocumentId} does not contain valid rate details (e.g., in rawRateDetails or at root).`, { fetchedDataStructure: Object.keys(selectedRateDataFromFirestore) });
            throw new functions.https.HttpsError('internal', `Fetched rate data (ID: ${selectedRateDocumentId}) is incomplete or invalid. Ensure 'rawRateDetails' or equivalent is populated in the shipmentRates document.`);
        }
        logger.info('Successfully fetched selected rate details from Firestore for transformation.');
            
        const eShipPlusBookingPayload = transformRateDataToBookingRequest(rateRequestData, normalizedRateData);

        const validationError = validateBookingRequest(eShipPlusBookingPayload); 
        if (validationError) {
            logger.error('Booking Payload Validation Error:', validationError, { payload: eShipPlusBookingPayload });
            throw new functions.https.HttpsError('invalid-argument', validationError);
        }

        logger.info('eShipPlus Booking request payload (to be sent):', JSON.stringify(eShipPlusBookingPayload, null, 2));

        // Get carrier API configuration
        const carrierConfig = await getCarrierApiConfig('ESHIPPLUS', 'booking');
        const { apiUrl, credentials } = carrierConfig;
        
        // Validate that the carrier has the required endpoints
        if (!validateCarrierEndpoints(credentials, ['booking'])) {
            throw new functions.https.HttpsError('internal', 'eShipPlus carrier missing required booking endpoint configuration');
        }
        
        logger.info(`Using eShipPlus Booking API URL: ${apiUrl}`);

        // Create auth header using dynamic credentials
        const eShipPlusAuthHeader = createEShipPlusAuthHeader(credentials);
        logger.info('eShipPlusAuth Header generated from Firestore credentials for booking.');
        
        // Log the full request details for debugging
        logger.info('=== FULL BOOKING REQUEST DETAILS ===');
        logger.info('API URL:', apiUrl);
        logger.info('Credentials used:', {
            username: credentials.username,
            accountNumber: credentials.accountNumber,
            hostURL: credentials.hostURL,
            endpoints: credentials.endpoints
        });
        logger.info('Auth Header (Base64):', eShipPlusAuthHeader);
        logger.info('Auth Header (Decoded):', Buffer.from(eShipPlusAuthHeader, 'base64').toString());
        logger.info('Request Headers:', {
            'Content-Type': 'application/json',
            'eShipPlusAuth': eShipPlusAuthHeader,
        });
        logger.info('Request Payload Size:', JSON.stringify(eShipPlusBookingPayload).length);
        logger.info('=== END REQUEST DETAILS ===');
        
        const response = await axios.post(apiUrl, eShipPlusBookingPayload, { 
            headers: {
                'Content-Type': 'application/json',
                'eShipPlusAuth': eShipPlusAuthHeader,
            },
            validateStatus: function (status) {
                return status >= 200 && status < 600; 
            }
        });

        logger.info(`eShipPlus Booking API Response Status: ${response.status}`);
        
        // Log comprehensive response details for debugging
        logger.info('=== FULL BOOKING RESPONSE DETAILS ===');
        logger.info('Response Status:', response.status);
        logger.info('Response Status Text:', response.statusText);
        logger.info('Response Headers:', response.headers);
        logger.info('Response Data Type:', typeof response.data);
        logger.info('Response Data Length:', typeof response.data === 'string' ? response.data.length : 'N/A');
        if (typeof response.data === 'string') {
            logger.info('Response Data (first 500 chars):', response.data.substring(0, 500));
            if (response.data.includes('<!doctype html>') || response.data.includes('<html')) {
                logger.info('HTML Response detected - likely authentication failure');
            }
        } else {
            logger.info('Response Data (JSON):', JSON.stringify(response.data, null, 2));
        }
        logger.info('=== END RESPONSE DETAILS ===');
        
        // Check if we got HTML instead of JSON (authentication failure)
        if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
            logger.error('Received HTML login page instead of JSON response - authentication failed for booking endpoint');
            logger.error('This suggests the booking endpoint requires different authentication than the rates endpoint');
            throw new functions.https.HttpsError('unauthenticated', 'eShipPlus booking endpoint authentication failed - received login page instead of booking response');
        }
        
        if (response.status >= 300) {
            logger.warn('eShipPlus Booking API Raw Response Data (Status >= 300):' , typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data);
        } else {
            logger.debug('eShipPlus Booking API Raw Response Data (Status 2xx):' , typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data);
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

        if (response.data && response.data.ContainsErrorMessage === true) {
            let errorMessage = `EShipPlus Booking API indicated an error in the response despite HTTP ${response.status} status.`;
            if (response.data.Messages && Array.isArray(response.data.Messages) && response.data.Messages.length > 0) {
                errorMessage += ` Messages: ${response.data.Messages.map(m => m.Text || JSON.stringify(m)).join('; ')}`;
            }
            logger.error(errorMessage, { fullEShipPlusResponse: response.data });
            throw new functions.https.HttpsError('failed-precondition', errorMessage, response.data);
        }

        const bookingConfirmationResult = transformBookingResponseToInternalFormat(response.data);
        
        if (!bookingConfirmationResult || !bookingConfirmationResult.success) {
            logger.error('Failed to transform eShipPlus booking response or booking indicated failure:', { bookingConfirmationResult, rawResponse: response.data });
            throw new functions.https.HttpsError('internal', 'Failed to process booking confirmation from eShipPlus API.', bookingConfirmationResult);
        }

        logger.info('Successfully processed booking with eShipPlus REST API. Transformed Confirmation:', JSON.stringify(bookingConfirmationResult, null, 2));

        // Process ALL shipping documents normally (including API BOL - we'll overwrite it later)
        let processedDocuments = [];
        let documentProcessingError = null;
        let apiBolDocumentId = null; // Track API BOL document ID for overwriting
        
        if (bookingConfirmationResult.rawShippingDocuments && bookingConfirmationResult.rawShippingDocuments.length > 0) {
            try {
                logger.info(`📄 Processing ${bookingConfirmationResult.rawShippingDocuments.length} documents for shipment ${draftFirestoreDocId}`);
                
                // Find the API BOL document so we can overwrite it later
                const apiBolDocument = bookingConfirmationResult.rawShippingDocuments.find(doc => {
                    const docType = doc.docType || doc.documentType || doc.type || '';
                    const fileName = (doc.filename || doc.name || '').toLowerCase();
                    
                    return docType === 1 || 
                           docType === 3 ||
                           docType === 'bol' || 
                           fileName.includes('bol') ||
                           fileName.includes('bill');
                });
                
                if (apiBolDocument) {
                    // Use a predictable document ID that we can overwrite
                    apiBolDocumentId = `${draftFirestoreDocId}_bol_generated`;
                    logger.info(`📋 Found API BOL: ${apiBolDocument.filename || apiBolDocument.name} - will be overwritten with our generated BOL`);
                }
                
                const bookingContext = {
                    proNumber: bookingConfirmationResult.proNumber,
                    confirmationNumber: bookingConfirmationResult.confirmationNumber,
                    carrierName: bookingConfirmationResult.carrierName,
                    shipmentId: draftFirestoreDocId
                };
                
                processedDocuments = await processCarrierDocuments(
                    draftFirestoreDocId,
                    'eshipplus',
                    bookingConfirmationResult.rawShippingDocuments, // Process ALL documents normally
                    bookingContext
                );
                
                logger.info(`✅ Successfully processed ${processedDocuments.length} documents`);
            } catch (docError) {
                logger.error('Error processing shipping documents:', docError);
                documentProcessingError = docError.message;
            }
        }

        // Generate eShipPlus BOL to replace API BOL
        let bolGenerationResult = null;
        try {
            logger.info('🚀 Generating eShipPlus BOL to replace API BOL...');
            
            // Import the internal BOL generation function
            const { generateEShipPlusBOLInternal } = require('./generateBOL');
            
            const shipmentId = bookingConfirmationResult.confirmationNumber || bookingConfirmationResult.proNumber || draftFirestoreDocId;
            
            logger.info('📋 BOL generation parameters:', {
                shipmentId,
                firebaseDocId: draftFirestoreDocId,
                overwriteDocumentId: apiBolDocumentId
            });
            
            // Call BOL generation internal function directly
            const bolGenerationResponse = await generateEShipPlusBOLInternal(
                shipmentId,
                draftFirestoreDocId,
                apiBolDocumentId
            );
            
            if (bolGenerationResponse && bolGenerationResponse.success) {
                bolGenerationResult = bolGenerationResponse.data;
                logger.info('✅ Successfully generated eShipPlus BOL - API BOL has been overwritten:', {
                    documentId: bolGenerationResult.documentId,
                    fileName: bolGenerationResult.fileName,
                    overwrittenApiDoc: !!apiBolDocumentId
                });
            } else {
                logger.warn('⚠️ eShipPlus BOL generation failed:', {
                    error: bolGenerationResponse?.error || 'Unknown error'
                });
            }
            
        } catch (bolError) {
            logger.error('❌ Error generating eShipPlus BOL:', {
                error: bolError.message,
                shipmentId: draftFirestoreDocId
            });
        }

        // Firestore updates
        const batch = db.batch();

        // CRITICAL FIX: Fetch existing shipment data to preserve shipmentInfo
        const existingShipmentDoc = await db.collection('shipments').doc(draftFirestoreDocId).get();
        const existingShipmentData = existingShipmentDoc.data();
        
        logger.info('eShipPlus Booking: Preserving existing shipmentInfo:', existingShipmentData?.shipmentInfo);

        // 1. Update the main shipment document
        const shipmentDocRef = db.collection('shipments').doc(draftFirestoreDocId);
        const shipmentUpdateData = {
            status: 'booked',
            
            carrierBookingConfirmation: {
                confirmationNumber: bookingConfirmationResult.confirmationNumber,
                proNumber: bookingConfirmationResult.proNumber,
                bolNumber: bookingConfirmationResult.bolNumber,
                carrierName: bookingConfirmationResult.carrierName,
                carrierScac: bookingConfirmationResult.carrierScac,
                totalCharges: bookingConfirmationResult.totalCharges, 
                freightCharges: bookingConfirmationResult.freightCharges,
                fuelCharges: bookingConfirmationResult.fuelCharges,
                accessorialCharges: bookingConfirmationResult.accessorialCharges,
                serviceCharges: bookingConfirmationResult.serviceCharges,
                currency: bookingConfirmationResult.currency,
                estimatedDeliveryDate: bookingConfirmationResult.estimatedDeliveryDate,
                shippingDocuments: bookingConfirmationResult.shippingDocuments || null, 
            },
            
            // Preserve existing shipmentInfo data
            shipmentInfo: {
                ...existingShipmentData?.shipmentInfo
            },
            
            shipmentStatus: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        

        logger.info(`LOG: Updating shipment document ${draftFirestoreDocId} with:`, shipmentUpdateData);
        await shipmentDocRef.update(shipmentUpdateData);
        logger.info(`LOG: Shipment document ${draftFirestoreDocId} successfully updated.`);

        // Record the status change event from draft to booked
        try {
            const { recordStatusChange, EVENT_TYPES, EVENT_SOURCES } = require('../../utils/shipmentEvents');
            await recordStatusChange(
                draftFirestoreDocId,
                'draft',
                'booked',
                null,
                'Shipment successfully booked with eShipPlus carrier'
            );
            logger.info(`Recorded status change event for shipment ${draftFirestoreDocId}: draft -> booked`);
        } catch (eventError) {
            logger.error('Error recording status change event:', eventError);
            // Don't fail the booking process for event recording errors
        }

        // 2. Update the selected rate document in shipmentRates collection
        if (selectedRateDocumentId) { // Should always be true due to earlier validation
            const rateDocRefToUpdate = db.collection('shipmentRates').doc(selectedRateDocumentId);
            const rateUpdateData = {
                status: 'booked',
                bookingConfirmation: {
                    confirmationNumber: bookingConfirmationResult.confirmationNumber,
                    proNumber: bookingConfirmationResult.proNumber,
                    bolNumber: bookingConfirmationResult.bolNumber,
                    carrierName: bookingConfirmationResult.carrierName,
                    totalCharges: bookingConfirmationResult.totalCharges,
                    shippingDocuments: bookingConfirmationResult.shippingDocuments || null,
                    estimatedDeliveryDate: bookingConfirmationResult.estimatedDeliveryDate,
                    currency: bookingConfirmationResult.currency,
                    bookedAt: admin.firestore.FieldValue.serverTimestamp(),
                    // Storing the full raw response here might be too much if already in shipmentDoc.
                    // rawBookingResponseSnippet: JSON.stringify(bookingConfirmationResult.rawBookingResponse).substring(0, 500) + '...'
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                // Add raw request and response for booking - top level in shipmentRates doc
                rawBookingRequestPayload: eShipPlusBookingPayload || null,
                rawBookingAPIResponse: response.data || null,
            };
            batch.update(rateDocRefToUpdate, rateUpdateData);
            logger.info('Prepared update for shipmentRates document with booking confirmation:', selectedRateDocumentId, JSON.stringify(rateUpdateData, null, 2));
        } else {
            // This case should ideally not be reached if validation is correct
            logger.warn('selectedRateDocumentId was missing during Firestore update phase, cannot update status in shipmentRates collection. This indicates an issue with control flow.');
        }

        await batch.commit();
        logger.info('Successfully committed Firestore updates for booking confirmation.');

        return {
            success: true,
            data: bookingConfirmationResult // Return the transformed booking confirmation to the client
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

/**
 * Wrapper function for universal booking compatibility
 * @param {Object} rateRequestData - Original rate request data
 * @param {string} draftFirestoreDocId - Firestore document ID of the draft shipment
 * @param {string} selectedRateDocumentId - Document ID of the selected rate
 * @returns {Object} Booking confirmation data
 */
async function bookEShipPlusShipment(rateRequestData, draftFirestoreDocId, selectedRateDocumentId) {
    console.log('bookEShipPlusShipment: Wrapper function called for universal booking compatibility');
    
    const requestData = {
        apiKey: 'development-api-key', // Use development key for internal calls
        rateRequestData,
        draftFirestoreDocId,
        selectedRateDocumentId
    };
    
    return await processBookingRequest(requestData);
}

// Export both functions
module.exports = {
    bookEShipPlusShipment
};