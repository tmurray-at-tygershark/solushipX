const { getCarrierApiConfig, validateCarrierEndpoints, sanitizePostalCode } = require('../../utils');
const admin = require('firebase-admin');

// Get Firestore instance
const db = admin.firestore();

/**
 * Books a shipment with Polaris Transportation using their OrderSubmittion API
 * @param {Object} rateRequestData - Original rate request data
 * @param {string} draftFirestoreDocId - Firestore document ID of the draft shipment
 * @param {string} selectedRateDocumentId - Document ID of the selected rate
 * @returns {Object} Booking confirmation data
 */
async function bookPolarisTransportationShipment(rateRequestData, draftFirestoreDocId, selectedRateDocumentId) {
    console.log('bookPolarisTransportationShipment: Starting Polaris Transportation booking process');
    console.log('bookPolarisTransportationShipment: rateRequestData:', JSON.stringify(rateRequestData, null, 2));
    console.log('bookPolarisTransportationShipment: draftFirestoreDocId:', draftFirestoreDocId);
    console.log('bookPolarisTransportationShipment: selectedRateDocumentId:', selectedRateDocumentId);

    try {
        // Get Polaris Transportation API configuration
        const polarisConfig = await getCarrierApiConfig('POLARISTRANSPORTATION', 'booking');
        console.log('bookPolarisTransportationShipment: Retrieved Polaris Transportation config');

        // Validate that booking endpoint exists
        validateCarrierEndpoints(polarisConfig.credentials, ['booking']);

        // Get the selected rate details
        const rateDoc = await db.collection('shipmentRates').doc(selectedRateDocumentId).get();
        if (!rateDoc.exists) {
            throw new Error(`Selected rate document ${selectedRateDocumentId} not found`);
        }
        const selectedRate = rateDoc.data();
        console.log('bookPolarisTransportationShipment: Retrieved selected rate:', JSON.stringify(selectedRate, null, 2));

        // Get the draft shipment details
        const shipmentDoc = await db.collection('shipments').doc(draftFirestoreDocId).get();
        if (!shipmentDoc.exists) {
            throw new Error(`Draft shipment ${draftFirestoreDocId} not found`);
        }
        const shipmentData = shipmentDoc.data();
        console.log('bookPolarisTransportationShipment: Retrieved shipment data');

        // Build the Polaris Transportation booking request
        const bookingRequest = buildPolarisTransportationBookingRequest(rateRequestData, selectedRate, polarisConfig, draftFirestoreDocId);
        console.log('bookPolarisTransportationShipment: Built booking request');

        // Make the API call
        const response = await makePolarisTransportationBookingRequest(bookingRequest, polarisConfig);
        console.log('bookPolarisTransportationShipment: Received API response');

        // Parse and validate the response
        const bookingResult = parsePolarisTransportationBookingResponse(response);
        console.log('bookPolarisTransportationShipment: Parsed booking result:', JSON.stringify(bookingResult, null, 2));

        // Update the shipment document with booking confirmation
        await updateShipmentWithBookingData(draftFirestoreDocId, bookingResult, selectedRate);

        // Record the status change event from draft to booked
        try {
            const { recordStatusChange } = require('../../utils/shipmentEvents');
            await recordStatusChange(
                draftFirestoreDocId,
                'draft',
                'booked',
                null,
                'Shipment successfully booked with Polaris Transportation carrier'
            );
            console.log(`Recorded status change event for shipment ${draftFirestoreDocId}: draft -> booked`);
        } catch (eventError) {
            console.error('Error recording status change event:', eventError);
            // Don't fail the booking process for event recording errors
        }

        // Update the rate document with booking status
        await db.collection('shipmentRates').doc(selectedRateDocumentId).update({
            status: 'booked',
            bookingConfirmation: bookingResult,
            bookedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('bookPolarisTransportationShipment: Successfully completed booking process');
        return {
            success: true,
            data: bookingResult
        };

    } catch (error) {
        console.error('bookPolarisTransportationShipment: Error during booking process:', error);
        
        // Update rate document with error status if possible
        if (selectedRateDocumentId) {
            try {
                await db.collection('shipmentRates').doc(selectedRateDocumentId).update({
                    status: 'booking_failed',
                    bookingError: error.message,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (updateError) {
                console.error('bookPolarisTransportationShipment: Failed to update rate document with error:', updateError);
            }
        }

        return {
            success: false,
            error: error.message,
            data: {
                messages: [{ text: error.message }]
            }
        };
    }
}

/**
 * Builds the Polaris Transportation booking request
 */
function buildPolarisTransportationBookingRequest(rateRequestData, selectedRate, polarisConfig, shipmentId) {
    console.log('buildPolarisTransportationBookingRequest: Building booking request');
    console.log('buildPolarisTransportationBookingRequest: rateRequestData structure:', JSON.stringify(rateRequestData, null, 2));

    // Handle multiple possible data structures
    let shipFrom, shipTo, packages, referenceNumber;
    
    // Try universal format first (pickup_address/delivery_address)
    if (rateRequestData.shipment) {
        const shipmentData = rateRequestData.shipment;
        shipFrom = shipmentData.pickup_address;
        shipTo = shipmentData.delivery_address;
        packages = shipmentData.packages;
        referenceNumber = shipmentData.reference || rateRequestData.referenceNumber;
    }
    // Try direct format (shipFrom/shipTo)
    else if (rateRequestData.shipFrom || rateRequestData.shipTo) {
        shipFrom = rateRequestData.shipFrom;
        shipTo = rateRequestData.shipTo;
        packages = rateRequestData.packages;
        referenceNumber = rateRequestData.referenceNumber;
    }
    // Try Origin/Destination format
    else if (rateRequestData.Origin || rateRequestData.Destination) {
        // Convert Origin/Destination to our expected format
        shipFrom = rateRequestData.Origin ? {
            name: rateRequestData.Origin.Description || rateRequestData.Origin.Company || '',
            address_line_1: rateRequestData.Origin.Street || '',
            address_line_2: rateRequestData.Origin.StreetExtra || '',
            city: rateRequestData.Origin.City || '',
            province: rateRequestData.Origin.State || '',
            postal_code: rateRequestData.Origin.PostalCode || '',
            country: rateRequestData.Origin.Country?.Code || rateRequestData.Origin.Country || 'CA',
            contact: rateRequestData.Origin.Contact || '',
            phone: rateRequestData.Origin.Phone || '',
            email: rateRequestData.Origin.Email || '',
            special_instructions: rateRequestData.Origin.SpecialInstructions || ''
        } : null;
        
        shipTo = rateRequestData.Destination ? {
            name: rateRequestData.Destination.Description || rateRequestData.Destination.Company || '',
            address_line_1: rateRequestData.Destination.Street || '',
            address_line_2: rateRequestData.Destination.StreetExtra || '',
            city: rateRequestData.Destination.City || '',
            province: rateRequestData.Destination.State || '',
            postal_code: rateRequestData.Destination.PostalCode || '',
            country: rateRequestData.Destination.Country?.Code || rateRequestData.Destination.Country || 'US',
            contact: rateRequestData.Destination.Contact || '',
            phone: rateRequestData.Destination.Phone || '',
            email: rateRequestData.Destination.Email || '',
            special_instructions: rateRequestData.Destination.SpecialInstructions || ''
        } : null;
        
        packages = rateRequestData.Items || [];
        referenceNumber = rateRequestData.ReferenceNumber || rateRequestData.referenceNumber;
    }
    else {
        throw new Error('Unable to extract shipment data from request. Expected shipment.pickup_address/delivery_address, shipFrom/shipTo, or Origin/Destination format.');
    }
    
    console.log('buildPolarisTransportationBookingRequest: Extracted shipFrom:', shipFrom);
    console.log('buildPolarisTransportationBookingRequest: Extracted shipTo:', shipTo);
    console.log('buildPolarisTransportationBookingRequest: Extracted packages:', packages);
    
    // Validate critical address information
    if (!shipFrom || !shipTo) {
        throw new Error('Both pickup (shipFrom) and delivery (shipTo) addresses are required for Polaris Transportation booking');
    }
    
    // Validate pickup address has minimum required fields (check multiple field name formats)
    const fromCity = shipFrom?.city;
    const fromPostalCode = shipFrom?.postal_code || shipFrom?.postalCode;
    console.log('buildPolarisTransportationBookingRequest: Pickup validation - city:', fromCity, 'postalCode:', fromPostalCode);
    console.log('buildPolarisTransportationBookingRequest: Pickup address fields available:', Object.keys(shipFrom || {}));
    if (!fromCity || !fromPostalCode) {
        throw new Error('Pickup address must have at least city and postal code for Polaris Transportation booking');
    }
    
    // Validate delivery address has minimum required fields (check multiple field name formats)
    const toCity = shipTo?.city;
    const toPostalCode = shipTo?.postal_code || shipTo?.postalCode;
    console.log('buildPolarisTransportationBookingRequest: Delivery validation - city:', toCity, 'postalCode:', toPostalCode);
    console.log('buildPolarisTransportationBookingRequest: Delivery address fields available:', Object.keys(shipTo || {}));
    if (!toCity || !toPostalCode) {
        throw new Error('Delivery address must have at least city and postal code for Polaris Transportation booking');
    }
    
    // Extract reference number from multiple possible sources
    if (!referenceNumber) {
        referenceNumber = rateRequestData.shipmentInfo?.shipperReferenceNumber || 
                         rateRequestData.shipmentID || 
                         shipmentId || 
                         `REF-${Date.now()}`;
    }
    
    // Extract contact information with multiple fallbacks
    const contactName = shipFrom?.contact || shipFrom?.name || 'Shipping Department';
    const contactEmail = shipFrom?.email || polarisConfig.credentials.defaultEmail || 'shipping@solushipx.com';
    
    // Format pickup and delivery dates
    const shipDate = rateRequestData.shipmentInfo?.shipmentDate || 
                    rateRequestData.shipmentDate || 
                    rateRequestData.ShipmentDate || 
                    new Date();
    const pickupDate = new Date(shipDate);
    const deliveryDate = new Date(shipDate);
    deliveryDate.setDate(deliveryDate.getDate() + (selectedRate?.transitDays || selectedRate?.transit?.days || 5));
    
    // Format times with proper timezone handling
    const formatDateTime = (date, time = '13:00') => {
        const [hours, minutes] = time.split(':');
        const formattedDate = new Date(date);
        formattedDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return formattedDate.toISOString();
    };
    
    // Pickup times (13:00-17:00 default)
    const pickupFromTime = formatDateTime(pickupDate, '13:00');
    const pickupToTime = formatDateTime(pickupDate, '17:00');
    
    // Delivery times (09:00-17:00 default)  
    const deliverFromTime = formatDateTime(deliveryDate, '09:00');
    const deliverToTime = formatDateTime(deliveryDate, '17:00');
    
    // Build driver notes from special instructions (as per user requirements)
    const buildDriverNotes = () => {
        // Extract pickup/origin special instructions from multiple possible sources
        const originInstructions = shipFrom?.special_instructions || 
                                  shipFrom?.specialInstructions || 
                                  shipFrom?.instructions || 
                                  shipFrom?.notes ||
                                  rateRequestData.shipFrom?.specialInstructions ||
                                  rateRequestData.Origin?.SpecialInstructions;
        
        // Extract delivery/destination special instructions from multiple possible sources
        const destInstructions = shipTo?.special_instructions || 
                                shipTo?.specialInstructions || 
                                shipTo?.instructions || 
                                shipTo?.notes ||
                                rateRequestData.shipTo?.specialInstructions ||
                                rateRequestData.Destination?.SpecialInstructions;
        
        // Clean and trim the instructions (remove empty strings, whitespace-only strings)
        const cleanOriginInstructions = originInstructions?.trim() || '';
        const cleanDestInstructions = destInstructions?.trim() || '';
        
        // If no instructions at all, return empty array
        if (!cleanOriginInstructions && !cleanDestInstructions) {
            return []; // Empty array if no instructions
        }
        
        // Build the combined note text with clear labels
        let noteText = '';
        
        if (cleanOriginInstructions) {
            noteText += `PICKUP SPECIAL INSTRUCTIONS: ${cleanOriginInstructions}`;
        }
        
        if (cleanDestInstructions) {
            if (noteText) {
                noteText += '.  '; // Use period and two spaces for better separation
            }
            noteText += `DELIVERY SPECIAL INSTRUCTIONS: ${cleanDestInstructions}`;
        }
        
        // Ensure the note ends with a period if it doesn't already
        if (noteText && !noteText.endsWith('.')) {
            noteText += '.';
        }
        
        console.log('buildDriverNotes: Combined instructions:', noteText);
        
        return [{
            Type: 'Driver_note',
            Text: noteText
        }];
    };
    
    // Build trace values for reference numbers (as per user requirements)
    const traceValues = referenceNumber ? [{
        Type: 'Ref No',
        Value: referenceNumber
    }] : [];
    
    // Map service features to ship instructions (using default values for now)
    const buildShipInstructions = () => {
        // TODO: Can enhance this based on shipment service requirements
        return {
            Inside_Pickup_YN: 'N',
            Residential_Pickup_YN: shipFrom?.residential ? 'Y' : 'N',
            Lifgate_Pickup_YN: 'N',
            Inside_Delivery_YN: 'N',
            Residential_Delivery_YN: shipTo?.residential ? 'Y' : 'N',
            Lifgate_Delivery_YN: 'N',
            Appointment_Delivery_YN: 'N',
            Call_Ahead_YN: 'N',
            Do_Not_Stack_YN: 'N',
            Fragile_YN: 'N',
            Straight_truck_Pickup_Required_YN: 'N',
            Straight_truck_Delivery_Required_YN: 'N',
            CSA_YN: 'N',
            Barn_Door_YN: 'N',
            In_Bond_YN: 'N',
            Limited_Access_Pickup_YN: 'N',
            Limited_Access_Delivery_YN: 'N'
        };
    };
    
    // Transform packages to detail lines
    const detailLines = packages.map((pkg, index) => ({
        Seq: (index + 1).toString(),
        Description: pkg.description || pkg.commodity_description || pkg.Description || 'General Freight',
        Pallets: parseInt(pkg.quantity || pkg.PackagingQuantity || 1),
        TotalWeight: parseFloat(pkg.weight || pkg.reported_weight || pkg.Weight || 0).toFixed(2),
        Skid_Dimension1: {
            Length: parseInt(pkg.length || pkg.Length || 48),
            Width: parseInt(pkg.width || pkg.Width || 40),
            Height: parseInt(pkg.height || pkg.Height || 48)
        }
    }));
    
    // Validate that we have at least one package with valid data
    if (!packages || packages.length === 0) {
        throw new Error('At least one package is required for Polaris Transportation booking');
    }
    
    // Validate each package has required minimum data
    for (let i = 0; i < detailLines.length; i++) {
        const detail = detailLines[i];
        if (!detail.Description || detail.Description.trim() === '') {
            throw new Error(`Package ${i + 1} is missing a description`);
        }
        if (detail.Pallets < 1) {
            throw new Error(`Package ${i + 1} must have at least 1 pallet/piece`);
        }
        if (parseFloat(detail.TotalWeight) <= 0) {
            throw new Error(`Package ${i + 1} must have a weight greater than 0`);
        }
    }
    
    // Build the complete Polaris Transportation booking request
    const bookingRequest = {
        OrderSubmittion: {
            Shipment_id: shipmentId, // Use the SolushipX shipment ID as per user requirements
            Contact_name: contactName,
            Contact_email: contactEmail,
            Pickup_FromTime: pickupFromTime,
            Pickup_ToTime: pickupToTime,
            Deliver_FromTime: deliverFromTime,
            Deliver_ToTime: deliverToTime,
            Shipper: {
                name: shipFrom?.name || shipFrom?.company || 'Unknown Shipper',
                street1: shipFrom?.address_line_1 || shipFrom?.street || shipFrom?.addressLine1 || '',
                street2: shipFrom?.address_line_2 || shipFrom?.street2 || shipFrom?.addressLine2 || '',
                city: shipFrom?.city || '',
                province: shipFrom?.province || shipFrom?.state || '',
                postalcode: sanitizePostalCode(shipFrom?.postal_code || shipFrom?.postalCode || ''),
                country: shipFrom?.country || 'CA',
                contact: shipFrom?.contact || shipFrom?.attention || contactName,
                phone: shipFrom?.phone || ''
            },
            Consignee: {
                name: shipTo?.name || shipTo?.company || 'Unknown Consignee',
                street1: shipTo?.address_line_1 || shipTo?.street || shipTo?.addressLine1 || '',
                street2: shipTo?.address_line_2 || shipTo?.street2 || shipTo?.addressLine2 || '',
                city: shipTo?.city || '',
                province: shipTo?.province || shipTo?.state || '',
                postalcode: sanitizePostalCode(shipTo?.postal_code || shipTo?.postalCode || ''),
                country: shipTo?.country || 'US',
                contact: shipTo?.contact || shipTo?.attention || 'Receiving Department',
                phone: shipTo?.phone || ''
            },
            CustomsBroker: {
                name: 'Vandergrift' // Default customs broker for Polaris Transportation
            },
            ShipInstructions: buildShipInstructions(),
            Notes: buildDriverNotes(),
            TraceValues: traceValues,
            DetailLines: detailLines
        }
    };

    console.log('buildPolarisTransportationBookingRequest: Request built successfully');
    console.log('buildPolarisTransportationBookingRequest: Final request summary:', {
        shipmentId: bookingRequest.OrderSubmittion.Shipment_id,
        contactName: bookingRequest.OrderSubmittion.Contact_name,
        detailLinesCount: bookingRequest.OrderSubmittion.DetailLines?.length || 0,
        hasShipper: !!bookingRequest.OrderSubmittion.Shipper,
        hasConsignee: !!bookingRequest.OrderSubmittion.Consignee,
        hasNotes: bookingRequest.OrderSubmittion.Notes?.length > 0,
        hasTraceValues: bookingRequest.OrderSubmittion.TraceValues?.length > 0
    });
    
    return bookingRequest;
}

/**
 * Makes the API request to Polaris Transportation booking endpoint
 */
async function makePolarisTransportationBookingRequest(bookingRequest, polarisConfig) {
    console.log('makePolarisTransportationBookingRequest: Making API call to Polaris Transportation');
    
    // Import axios for better timeout and error handling (consistent with eShipPlus)
    const axios = require('axios');
    
    // Validate credentials before proceeding
    if (!polarisConfig.credentials.secret) {
        throw new Error('Polaris Transportation is not properly configured. Missing API key (secret) in carrier settings. Please contact support to configure the API credentials.');
    }
    
    // Use the apiUrl from the carrier config and append API key as query parameter
    const apiUrlWithKey = `${polarisConfig.apiUrl}?APIKey=${polarisConfig.credentials.secret}`;
    console.log(`makePolarisTransportationBookingRequest: Using API URL: ${polarisConfig.apiUrl}?APIKey=***`);
    
    // Create request options for axios (better timeout handling than node-fetch)
    const requestConfig = {
        method: 'POST',
        url: apiUrlWithKey,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        data: bookingRequest,
        timeout: 60000, // 60 second timeout for booking requests (longer than rate requests)
        validateStatus: function (status) {
            return status >= 200 && status < 600; // Accept all status codes for better error handling
        }
    };

    console.log('makePolarisTransportationBookingRequest: Request configured with axios for reliable timeout handling');

    try {
        const response = await axios(requestConfig);
        
        console.log(`makePolarisTransportationBookingRequest: Received response with status: ${response.status}`);
        
        if (!response.status || response.status >= 400) {
            const errorData = response.data || 'No response data';
            console.error('makePolarisTransportationBookingRequest: API error response:', errorData);
            throw new Error(`Polaris Transportation API error: ${response.status} ${response.statusText} - ${typeof errorData === 'string' ? errorData : JSON.stringify(errorData)}`);
        }

        const responseData = response.data;
        console.log('makePolarisTransportationBookingRequest: Received response from Polaris Transportation API');
        
        // Log response in chunks to avoid truncation (similar to Canpar)
        const responseText = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
        const chunkSize = 800;
        for (let i = 0; i < responseText.length; i += chunkSize) {
            console.log(`makePolarisTransportationBookingRequest: Response chunk ${Math.floor(i/chunkSize) + 1}:`, responseText.slice(i, i + chunkSize));
        }
        
        return responseData;
        
    } catch (error) {
        console.error('makePolarisTransportationBookingRequest: Request failed:', error);
        
        // Handle different types of errors with better categorization
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            throw new Error('Polaris Transportation API request timed out after 60 seconds. The carrier API may be experiencing delays. Please try again in a few minutes.');
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            throw new Error('Unable to connect to Polaris Transportation API. Please check your network connection or try again later.');
        } else if (error.response && error.response.status === 401) {
            throw new Error('Polaris Transportation API authentication failed. Please check your API credentials in carrier settings.');
        } else if (error.response && error.response.status >= 500) {
            throw new Error('Polaris Transportation API is experiencing server issues. Please try again later.');
        } else if (error.response && error.response.data) {
            // API returned an error response
            const errorData = error.response.data;
            const errorMessage = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
            throw new Error(`Polaris Transportation API error: ${error.response.status} - ${errorMessage}`);
        } else {
            // Re-throw the original error if it's already formatted or unknown
            throw new Error(`Polaris Transportation booking failed: ${error.message}`);
        }
    }
}

/**
 * Parses the Polaris Transportation booking response
 */
function parsePolarisTransportationBookingResponse(apiResponse) {
    console.log('parsePolarisTransportationBookingResponse: Parsing response');
    console.log('parsePolarisTransportationBookingResponse: Response type:', typeof apiResponse);
    console.log('parsePolarisTransportationBookingResponse: Has OE_Response:', !!apiResponse?.OE_Response);

    try {
        const response = apiResponse.OE_Response;
        
        if (!response) {
            throw new Error('Invalid response format: Missing OE_Response');
        }
        
        // Check for errors (Error: "N" means no error, "Y" means error)
        if (response.Error === 'Y' || response.error === 'Y') {
            const errorMessage = response.Message || response.message || 'Unknown booking error';
            throw new Error(`Polaris Transportation booking failed: ${errorMessage}`);
        }
        
        // Extract booking confirmation data based on actual response structure
        const bookingData = {
            // Core booking information (using actual field names)
            // NOTE: Order_Number is the carrier confirmation number (like eShipPlus ProNumber/BolNumber)
            // This is different from Canpar which uses separate barcode for tracking
            confirmationNumber: response.Order_Number,
            trackingNumber: response.Order_Number, // Polaris uses same Order_Number for tracking (like eShipPlus)
            shipmentId: response.Order_Number,
            orderNumber: response.Order_Number,
            
            // Carrier information
            carrier: 'Polaris Transportation',
            carrierCode: 'POLARISTRANSPORTATION',
            carrierName: 'Polaris Transportation',
            customerName: response.Customer_Name,
            
            // Service information
            serviceType: 'LTL',
            
            // Dates (using actual field names)
            shippingDate: response.Pickup_Date,
            estimatedDeliveryDate: response.Delivery_Date,
            pickupDate: response.Pickup_Date,
            deliveryDate: response.Delivery_Date,
            
            // Transit information (using actual field names)
            transitTime: parseInt(response.Service_Days || 0),
            transitDays: parseInt(response.Service_Days || 0),
            transitTimeGuaranteed: false,
            
            // Charges breakdown (using actual field names from response)
            currency: response.Currency || 'CAD',
            freightCharge: parseFloat(response.Base_Charge || 0),
            fuelSurcharge: parseFloat(response.Fuel_Charge || 0),
            fuelCharge: parseFloat(response.Fuel_Charge || 0),
            fuelChargePercentage: parseFloat(response.Fuel_Charge_Percentage || 0),
            borderCharge: parseFloat(response.Border_Charge || 0),
            arbitraryChargeTotal: parseFloat(response.Arbitrary_Charge_Total || 0),
            additionalServicesTotal: parseFloat(response.Additional_Services_Total || 0),
            
            // Map to standard charge fields (similar to Canpar structure)
            taxCharge1: parseFloat(response.Border_Charge || 0), // Border charges as tax1
            taxCharge2: parseFloat(response.Additional_Services_Total || 0), // Additional services as tax2
            subtotal: parseFloat(response.Total_Charge || 0) - parseFloat(response.Additional_Services_Total || 0),
            total: parseFloat(response.Total_Charge || 0),
            totalCharges: parseFloat(response.Total_Charge || 0),
            
            // Weight and dimensions (using actual field names)
            billedWeight: parseFloat(response.Total_Weight_lbs || 0),
            totalWeight: parseFloat(response.Total_Weight_lbs || 0),
            billedWeightUnit: 'lbs', // Response shows "Total_Weight_lbs"
            
            // Package information (using actual field names)
            pallets: parseInt(response.Pallets || 0),
            freightClass: response.Class,
            
            // Address information (using actual field names)
            fromPostalCode: response.From_PC_ZIP,
            toPostalCode: response.To_PC_ZIP,
            zone: '',
            
            // Terms and conditions
            terms: response.Terms,
            
            // Status and message information
            status: 'confirmed',
            message: response.Message || 'Booking confirmed successfully',
            bookingSuccess: true,
            
            // Additional metadata
            bookingDate: new Date().toISOString(),
            bookedAt: new Date().toISOString(),
            bookingMethod: 'polaris_api',
            
            // Standard fields for compatibility with other carriers
            proNumber: response.Order_Number,
            bookingReferenceNumber: response.Order_Number,
            
            // Detailed billing breakdown (for compatibility with other carriers)
            billingDetails: [
                {
                    name: 'Base Charge',
                    amount: parseFloat(response.Base_Charge || 0),
                    description: 'Freight charges'
                },
                {
                    name: 'Fuel Charge',
                    amount: parseFloat(response.Fuel_Charge || 0),
                    description: `Fuel surcharge (${response.Fuel_Charge_Percentage || 0}%)`
                },
                {
                    name: 'Border Charge', 
                    amount: parseFloat(response.Border_Charge || 0),
                    description: 'Cross-border processing charges'
                },
                {
                    name: 'Additional Services',
                    amount: parseFloat(response.Additional_Services_Total || 0),
                    description: 'Additional service charges'
                }
            ].filter(item => item.amount > 0), // Only include charges that exist
            
            // Additional services breakdown
            additionalServices: response.Additional_Services || {},
            
            // Package information (normalized like other carriers)
            packages: [],
            
            // Addresses (normalized like other carriers)
            pickupAddress: null,
            deliveryAddress: null,
            
            // Raw response for debugging and auditing
            rawResponse: apiResponse
        };

        console.log('parsePolarisTransportationBookingResponse: Extracted booking summary:', {
            confirmationNumber: bookingData.confirmationNumber,
            orderNumber: bookingData.orderNumber,
            totalCharges: bookingData.totalCharges,
            currency: bookingData.currency,
            transitDays: bookingData.transitDays,
            billedWeight: bookingData.billedWeight,
            pallets: bookingData.pallets,
            success: bookingData.bookingSuccess
        });
        
        return bookingData;

    } catch (error) {
        console.error('parsePolarisTransportationBookingResponse: Error parsing response:', error);
        throw new Error(`Failed to parse Polaris Transportation booking response: ${error.message}`);
    }
}

/**
 * Updates the shipment document with booking confirmation data
 */
async function updateShipmentWithBookingData(draftFirestoreDocId, bookingResult, selectedRate) {
    console.log('updateShipmentWithBookingData: Updating shipment document');

    const updateData = {
        status: 'booked',
        
        carrierBookingConfirmation: {
            confirmationNumber: bookingResult.confirmationNumber,
            trackingNumber: bookingResult.trackingNumber,
            shipmentId: bookingResult.shipmentId,
            carrier: bookingResult.carrier,
            carrierCode: bookingResult.carrierCode,
            serviceType: bookingResult.serviceType,
            estimatedDeliveryDate: bookingResult.estimatedDeliveryDate,
            shippingDate: bookingResult.shippingDate,
            
            // Charges
            totalCharges: bookingResult.total,
            freightCharge: bookingResult.freightCharge,
            fuelSurcharge: bookingResult.fuelSurcharge,
            taxCharge1: bookingResult.taxCharge1,
            taxCharge2: bookingResult.taxCharge2,
            subtotal: bookingResult.subtotal,
            
            // Transit
            transitTime: bookingResult.transitTime,
            transitTimeGuaranteed: bookingResult.transitTimeGuaranteed,
            
            // Weight
            billedWeight: bookingResult.billedWeight,
            billedWeightUnit: bookingResult.billedWeightUnit,
            
            // Booking metadata
            bookedAt: admin.firestore.FieldValue.serverTimestamp(),
            bookingMethod: 'polaris_api'
        },
        
        // Update selected rate reference with booking confirmation
        selectedRateRef: {
            ...selectedRate,
            bookingConfirmation: bookingResult,
            status: 'booked'
        },
        
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };



    await db.collection('shipments').doc(draftFirestoreDocId).update(updateData);
    console.log('updateShipmentWithBookingData: Shipment document updated successfully');
}

module.exports = {
    bookPolarisTransportationShipment
}; 