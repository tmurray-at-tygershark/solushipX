const { getCarrierApiConfig, validateCarrierEndpoints, sanitizePostalCode } = require('../../utils');
const admin = require('firebase-admin');
const xml2js = require('xml2js');

// Get Firestore instance
const db = admin.firestore();

/**
 * Books a shipment with Canpar using their processShipment SOAP API
 * @param {Object} rateRequestData - Original rate request data
 * @param {string} draftFirestoreDocId - Firestore document ID of the draft shipment
 * @param {string} selectedRateDocumentId - Document ID of the selected rate
 * @returns {Object} Booking confirmation data
 */
async function bookCanparShipment(rateRequestData, draftFirestoreDocId, selectedRateDocumentId) {
    console.log('bookCanparShipment: Starting Canpar booking process');
    console.log('bookCanparShipment: rateRequestData:', JSON.stringify(rateRequestData, null, 2));
    console.log('bookCanparShipment: draftFirestoreDocId:', draftFirestoreDocId);
    console.log('bookCanparShipment: selectedRateDocumentId:', selectedRateDocumentId);

    try {
        // Get Canpar API configuration
        const canparConfig = await getCarrierApiConfig('CANPAR', 'booking');
        console.log('bookCanparShipment: Retrieved Canpar config');

        // Validate that booking endpoint exists
        validateCarrierEndpoints(canparConfig.credentials, ['booking']);

        // Get the selected rate details
        const rateDoc = await db.collection('shipmentRates').doc(selectedRateDocumentId).get();
        if (!rateDoc.exists) {
            throw new Error(`Selected rate document ${selectedRateDocumentId} not found`);
        }
        const selectedRate = rateDoc.data();
        console.log('bookCanparShipment: Retrieved selected rate:', JSON.stringify(selectedRate, null, 2));

        // Get the draft shipment details
        const shipmentDoc = await db.collection('shipments').doc(draftFirestoreDocId).get();
        if (!shipmentDoc.exists) {
            throw new Error(`Draft shipment ${draftFirestoreDocId} not found`);
        }
        const shipmentData = shipmentDoc.data();
        console.log('bookCanparShipment: Retrieved shipment data');

        // Build the SOAP request
        const soapRequest = buildCanparBookingRequest(rateRequestData, selectedRate, canparConfig);
        console.log('bookCanparShipment: Built SOAP request');

        // Make the API call
        const response = await makeCanparBookingRequest(soapRequest, canparConfig);
        console.log('bookCanparShipment: Received API response');

        // Parse and validate the response
        const bookingResult = await parseCanparBookingResponse(response);
        console.log('bookCanparShipment: Parsed booking result:', JSON.stringify(bookingResult, null, 2));

        // Update the shipment document with booking confirmation
        await updateShipmentWithBookingData(draftFirestoreDocId, bookingResult, selectedRate, rateRequestData);

        // Record the status change event from draft to booked
        try {
            const { recordStatusChange } = require('../../utils/shipmentEvents');
            await recordStatusChange(
                draftFirestoreDocId,
                'draft',
                'pending',
                null,
                'Shipment successfully booked with Canpar carrier'
            );
            console.log(`Recorded status change event for shipment ${draftFirestoreDocId}: draft -> pending`);
        } catch (eventError) {
            console.error('Error recording status change event:', eventError);
            // Don't fail the booking process for event recording errors
        }

        // Update the rate document with booking status
        await db.collection('shipmentRates').doc(selectedRateDocumentId).update({
            status: 'pending',
            bookingConfirmation: bookingResult,
            bookedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // DEBUG: Confirm new code is deployed
        console.log('bookCanparShipment: DEBUG - New label generation code is deployed and running');

        // CRITICAL: Generate shipping labels for courier shipments
        const shipmentType = rateRequestData.shipmentInfo?.shipmentType || 'freight';
        console.log('bookCanparShipment: Shipment type:', shipmentType);
        
        if (shipmentType === 'courier') {
            console.log('bookCanparShipment: Generating shipping labels for courier shipment...');
            
            try {
                // Import the internal label generation function
                const { generateCanparLabelInternal } = require('./generateLabel');
                
                // Call the internal label generation function directly
                const labelResult = await generateCanparLabelInternal(
                    bookingResult.shipmentId, // Use Canpar's shipment ID
                    draftFirestoreDocId,
                    false // Standard format (not thermal)
                );
                
                console.log('bookCanparShipment: Label generation result:', JSON.stringify(labelResult, null, 2));
                
                if (labelResult.success && labelResult.data) {
                    // Add shipping documents to booking result
                    bookingResult.shippingDocuments = [{
                        type: 'shipping_label',
                        documentId: labelResult.data.documentId,
                        downloadUrl: labelResult.data.downloadUrl,
                        fileName: labelResult.data.fileName,
                        storagePath: labelResult.data.storagePath
                    }];
                    console.log('bookCanparShipment: Successfully generated shipping label');
                } else {
                    console.error('bookCanparShipment: Failed to generate label:', labelResult.error);
                    // Don't fail the booking - just log the error
                }
            } catch (labelError) {
                console.error('bookCanparShipment: Error generating shipping labels:', labelError);
                // Don't fail the booking process for label generation errors
                // The booking itself was successful
            }
        }

        console.log('bookCanparShipment: Successfully completed booking process');
        return {
            success: true,
            data: bookingResult
        };

    } catch (error) {
        console.error('bookCanparShipment: Error during booking process:', error);
        
        // Update rate document with error status if possible
        if (selectedRateDocumentId) {
            try {
                await db.collection('shipmentRates').doc(selectedRateDocumentId).update({
                    status: 'booking_failed',
                    bookingError: error.message,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (updateError) {
                console.error('bookCanparShipment: Failed to update rate document with error:', updateError);
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
 * Builds the SOAP request for Canpar booking
 */
function buildCanparBookingRequest(rateRequestData, selectedRate, canparConfig) {
    console.log('buildCanparBookingRequest: Building SOAP request');
    console.log('buildCanparBookingRequest: rateRequestData structure:', JSON.stringify(rateRequestData, null, 2));

    // Extract shipment data from the correct structure
    const shipmentData = rateRequestData.shipment || rateRequestData;
    
    // Support multiple data formats: Origin/Destination (eShipPlus), shipFrom/shipTo (standard), pickup_address/delivery_address (legacy)
    const shipFrom = shipmentData.pickup_address || 
                    rateRequestData.pickup_address || 
                    shipmentData.shipFrom || 
                    rateRequestData.shipFrom ||
                    // NEW: Support Origin format from CreateShipmentX
                    (rateRequestData.Origin ? {
                        name: rateRequestData.Origin.Description || '',
                        street: rateRequestData.Origin.Street || '',
                        street2: rateRequestData.Origin.StreetExtra || '',
                        city: rateRequestData.Origin.City || '',
                        state: rateRequestData.Origin.State || '',
                        province: rateRequestData.Origin.State || '',
                        postalCode: rateRequestData.Origin.PostalCode || '',
                        postal_code: rateRequestData.Origin.PostalCode || '',
                        country: rateRequestData.Origin.Country?.Code || 'CA',
                        phone: rateRequestData.Origin.Phone || '',
                        email: rateRequestData.Origin.Email || '',
                        contactName: rateRequestData.Origin.Contact || ''
                    } : null);
                    
    const shipTo = shipmentData.delivery_address || 
                  rateRequestData.delivery_address || 
                  shipmentData.shipTo || 
                  rateRequestData.shipTo ||
                  // NEW: Support Destination format from CreateShipmentX
                  (rateRequestData.Destination ? {
                      name: rateRequestData.Destination.Description || '',
                      street: rateRequestData.Destination.Street || '',
                      street2: rateRequestData.Destination.StreetExtra || '',
                      city: rateRequestData.Destination.City || '',
                      state: rateRequestData.Destination.State || '',
                      province: rateRequestData.Destination.State || '',
                      postalCode: rateRequestData.Destination.PostalCode || '',
                      postal_code: rateRequestData.Destination.PostalCode || '',
                      country: rateRequestData.Destination.Country?.Code || 'CA',
                      phone: rateRequestData.Destination.Phone || '',
                      email: rateRequestData.Destination.Email || '',
                      contactName: rateRequestData.Destination.Contact || ''
                  } : null);
                  
    const packages = shipmentData.packages || rateRequestData.packages;
    
    console.log('buildCanparBookingRequest: Extracted shipFrom:', shipFrom);
    console.log('buildCanparBookingRequest: Extracted shipTo:', shipTo);
    console.log('buildCanparBookingRequest: Extracted packages:', packages);
    
    // Extract reference number from shipment data
    const referenceNumber = shipmentData.reference || 
                           rateRequestData.referenceNumber || 
                           rateRequestData.shipmentInfo?.shipperReferenceNumber || 
                           shipmentData.shipmentID || 
                           '';
    
    // Extract signature service - nsr is REVERSE logic for Canpar
    const signatureRequired = rateRequestData.shipmentInfo?.signatureRequired !== undefined ? rateRequestData.shipmentInfo.signatureRequired : true;
    const nsr = !signatureRequired;
    
    // Sanitize postal codes - handle both camelCase and snake_case formats
    const fromPostalCode = sanitizePostalCode(shipFrom.postal_code || shipFrom.postalCode || shipFrom.zipPostal);
    const toPostalCode = sanitizePostalCode(shipTo.postal_code || shipTo.postalCode || shipTo.zipPostal);

    // Format shipping date (today if not specified)
    const shippingDate = shipmentData.shipping_date ? 
        new Date(shipmentData.shipping_date).toISOString().split('T')[0] : 
        new Date().toISOString().split('T')[0];
    const formattedShippingDate = `${shippingDate}T00:00:00`;

    // Map service type from selected rate
    const serviceType = mapCanparServiceType(selectedRate);

    // Build packages XML
    const packagesXml = packages.map((pkg, index) => `
        <xsd:packages>
            <xsd:package_num>${index + 1}</xsd:package_num>
            <xsd:reported_weight>${pkg.reported_weight || pkg.weight || 1}</xsd:reported_weight>
            <xsd:length>${pkg.length || 1}</xsd:length>
            <xsd:width>${pkg.width || 1}</xsd:width>
            <xsd:height>${pkg.height || 1}</xsd:height>
            <xsd:declared_value>${pkg.declared_value || pkg.declaredValue || 0}</xsd:declared_value>
        </xsd:packages>`).join('');

    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ws="http://ws.business.canshipws.canpar.com"
                  xmlns:xsd="http://dto.canshipws.canpar.com/xsd">
   <soapenv:Header/>
   <soapenv:Body>
      <ws:processShipment>
         <ws:request>
            <xsd:user_id>${canparConfig.credentials.username}</xsd:user_id>
            <xsd:password>${canparConfig.credentials.password}</xsd:password>
            <xsd:shipment>
               <xsd:shipper_num>${canparConfig.credentials.accountNumber}</xsd:shipper_num>
               <xsd:user_id>${canparConfig.credentials.username}</xsd:user_id>
               <xsd:shipping_date>${formattedShippingDate}</xsd:shipping_date>
               <xsd:service_type>${serviceType}</xsd:service_type>
               <xsd:shipment_status>R</xsd:shipment_status>
               <xsd:reported_weight_unit>L</xsd:reported_weight_unit>
               <xsd:nsr>${nsr}</xsd:nsr>
               <xsd:dimention_unit>I</xsd:dimention_unit>
               <xsd:print_format>PDF</xsd:print_format>
               <xsd:thermal>false</xsd:thermal>
               ${referenceNumber ? `<xsd:reference>${referenceNumber}</xsd:reference>` : ''}

               <xsd:pickup_address>
                  <xsd:name>${shipFrom.name || ''}</xsd:name>
                  <xsd:address_line_1>${shipFrom.address_line_1 || shipFrom.street || ''}</xsd:address_line_1>
                  <xsd:address_line_2>${shipFrom.address_line_2 || shipFrom.street2 || ''}</xsd:address_line_2>
                  <xsd:city>${shipFrom.city || ''}</xsd:city>
                  <xsd:province>${shipFrom.province || shipFrom.state || ''}</xsd:province>
                  <xsd:country>${shipFrom.country || 'CA'}</xsd:country>
                  <xsd:postal_code>${fromPostalCode}</xsd:postal_code>
                  <xsd:phone>${shipFrom.phone || ''}</xsd:phone>
                  <xsd:residential>false</xsd:residential>
               </xsd:pickup_address>

               <xsd:delivery_address>
                  <xsd:name>${shipTo.name || ''}</xsd:name>
                  <xsd:address_line_1>${shipTo.address_line_1 || shipTo.street || ''}</xsd:address_line_1>
                  <xsd:address_line_2>${shipTo.address_line_2 || shipTo.street2 || ''}</xsd:address_line_2>
                  <xsd:city>${shipTo.city || ''}</xsd:city>
                  <xsd:province>${shipTo.province || shipTo.state || ''}</xsd:province>
                  <xsd:country>${shipTo.country || 'CA'}</xsd:country>
                  <xsd:postal_code>${toPostalCode}</xsd:postal_code>
                  <xsd:phone>${shipTo.phone || ''}</xsd:phone>
                  <xsd:residential>false</xsd:residential>
               </xsd:delivery_address>

               ${packagesXml}
            </xsd:shipment>
         </ws:request>
      </ws:processShipment>
   </soapenv:Body>
</soapenv:Envelope>`;

    console.log('buildCanparBookingRequest: SOAP request built successfully');
    return soapRequest;
}

/**
 * Maps service type from selected rate to Canpar service type code
 */
function mapCanparServiceType(selectedRate) {
    // Default to Ground service (1) if no specific mapping found
    let serviceType = '1';

    if (selectedRate.service || selectedRate.serviceCode) {
        const service = (selectedRate.service || selectedRate.serviceCode).toLowerCase();
        
        if (service.includes('ground') || service.includes('standard')) {
            serviceType = '1';
        } else if (service.includes('express') || service.includes('priority')) {
            serviceType = '2';
        } else if (service.includes('overnight') || service.includes('next day')) {
            serviceType = '3';
        }
    }

    console.log('mapCanparServiceType: Mapped service type:', serviceType);
    return serviceType;
}

/**
 * Makes the SOAP request to Canpar API
 */
async function makeCanparBookingRequest(soapRequest, canparConfig) {
    console.log('makeCanparBookingRequest: Making API call to Canpar');

    const url = canparConfig.apiUrl;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'processShipment'
        },
        body: soapRequest
    });

    if (!response.ok) {
        throw new Error(`Canpar API request failed: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    console.log('makeCanparBookingRequest: Received response from Canpar API');
    
    // Log response in chunks to avoid truncation
    const chunkSize = 800;
    for (let i = 0; i < responseText.length; i += chunkSize) {
        console.log(`makeCanparBookingRequest: Response chunk ${Math.floor(i/chunkSize) + 1}:`, responseText.slice(i, i + chunkSize));
    }

    return responseText;
}

/**
 * Parses the Canpar SOAP response
 */
async function parseCanparBookingResponse(responseXml) {
    console.log('parseCanparBookingResponse: Parsing SOAP response');

    const parser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: false,
        tagNameProcessors: [xml2js.processors.stripPrefix]
    });

    try {
        const result = await parser.parseStringPromise(responseXml);
        console.log('parseCanparBookingResponse: XML parsed successfully');
        console.log('parseCanparBookingResponse: Full parsed result:', JSON.stringify(result, null, 2));

        // Navigate to the response data
        const envelope = result.Envelope;
        const body = envelope.Body;
        const processShipmentResponse = body.processShipmentResponse;
        const returnData = processShipmentResponse.return;

        console.log('parseCanparBookingResponse: returnData:', JSON.stringify(returnData, null, 2));
        
        // Check for errors
        console.log('parseCanparBookingResponse: Checking for errors...');
        console.log('parseCanparBookingResponse: returnData.error:', JSON.stringify(returnData.error, null, 2));
        
        if (returnData.error) {
            console.log('parseCanparBookingResponse: Error element exists');
            console.log('parseCanparBookingResponse: returnData.error.$:', JSON.stringify(returnData.error.$, null, 2));
            
            if (returnData.error.$) {
                console.log('parseCanparBookingResponse: Error attributes exist');
                console.log('parseCanparBookingResponse: xsi:nil value:', returnData.error.$['xsi:nil']);
                console.log('parseCanparBookingResponse: nil value:', returnData.error.$.nil);
                
                // Only throw error if it's not marked as nil
                if (returnData.error.$['xsi:nil'] !== 'true' && returnData.error.$.nil !== 'true') {
                    console.log('parseCanparBookingResponse: Error is not nil, throwing error');
                    throw new Error(`Canpar booking error: ${JSON.stringify(returnData.error)}`);
                } else {
                    console.log('parseCanparBookingResponse: Error is nil, ignoring');
                }
            }
        }

        // Also check if the error element has any actual content (not just null attributes)
        if (returnData.error && typeof returnData.error === 'string' && returnData.error.trim() !== '') {
            console.log('parseCanparBookingResponse: Error has string content, throwing error');
            throw new Error(`Canpar booking error: ${returnData.error}`);
        }

        // Extract shipment data
        const shipmentResult = returnData.processShipmentResult;
        const shipment = shipmentResult.shipment;

        if (!shipment) {
            throw new Error('No shipment data in Canpar response');
        }

        // Extract key booking information
        const bookingData = {
            confirmationNumber: shipment.id || '',
            trackingNumber: shipment.packages?.barcode || shipment.id || '',
            shipmentId: shipment.id || '',
            
            // Carrier information
            carrier: 'Canpar',
            carrierCode: 'CANPAR',
            
            // Service information
            serviceType: shipment.service_type || '',
            
            // Dates
            shippingDate: shipment.shipping_date || '',
            estimatedDeliveryDate: shipment.estimated_delivery_date || '',
            
            // Charges breakdown
            freightCharge: parseFloat(shipment.freight_charge || 0),
            fuelSurcharge: parseFloat(shipment.fuel_surcharge || 0),
            taxCharge1: parseFloat(shipment.tax_charge_1 || 0),
            taxCharge2: parseFloat(shipment.tax_charge_2 || 0),
            taxCode1: shipment.tax_code_1 || '',
            taxCode2: shipment.tax_code_2 || '',
            subtotal: parseFloat(shipment.subtotal || 0),
            total: parseFloat(shipment.total || 0),
            
            // Weight and dimensions
            billedWeight: parseFloat(shipment.billed_weight || 0),
            billedWeightUnit: shipment.billed_weight_unit || 'L',
            
            // Transit information
            transitTime: parseInt(shipment.transit_time || 0),
            transitTimeGuaranteed: shipment.transit_time_guaranteed === 'true',
            zone: shipment.zone || '',
            
            // Package information
            packages: shipment.packages ? (Array.isArray(shipment.packages) ? shipment.packages : [shipment.packages]) : [],
            
            // Addresses (normalized)
            pickupAddress: normalizeCanparAddress(shipment.pickup_address),
            deliveryAddress: normalizeCanparAddress(shipment.delivery_address),
            
            // Check if label data is included in packages
            shippingDocuments: [],
            
            // Raw response for debugging
            rawResponse: shipment
        };

        // Check if packages contain label data
        if (bookingData.packages && bookingData.packages.length > 0) {
            console.log('parseCanparBookingResponse: Checking packages for label data...');
            
            bookingData.packages.forEach((pkg, index) => {
                console.log(`parseCanparBookingResponse: Package ${index + 1}:`, JSON.stringify(pkg, null, 2));
                
                // Check for label data in various possible fields
                if (pkg.label || pkg.labelData || pkg.pdf || pkg.pdfData || pkg.document) {
                    console.log(`parseCanparBookingResponse: Found label data in package ${index + 1}`);
                    bookingData.shippingDocuments.push({
                        type: 'shipping_label',
                        packageIndex: index,
                        data: pkg.label || pkg.labelData || pkg.pdf || pkg.pdfData || pkg.document,
                        barcode: pkg.barcode
                    });
                }
            });
        }

        console.log('parseCanparBookingResponse: Extracted booking data:', JSON.stringify(bookingData, null, 2));
        console.log('parseCanparBookingResponse: Found shipping documents:', bookingData.shippingDocuments.length);
        
        return bookingData;

    } catch (error) {
        console.error('parseCanparBookingResponse: Error parsing XML response:', error);
        throw new Error(`Failed to parse Canpar booking response: ${error.message}`);
    }
}

/**
 * Normalizes Canpar address format
 */
function normalizeCanparAddress(address) {
    if (!address) return null;

    return {
        name: address.name || '',
        addressLine1: address.address_line_1 || '',
        addressLine2: address.address_line_2 || '',
        addressLine3: address.address_line_3 || '',
        city: address.city || '',
        province: address.province || '',
        country: address.country || '',
        postalCode: address.postal_code || '',
        phone: address.phone || '',
        residential: address.residential === 'true'
    };
}

/**
 * Updates the shipment document with booking confirmation data
 */
async function updateShipmentWithBookingData(draftFirestoreDocId, bookingResult, selectedRate, rateRequestData) {
    console.log('updateShipmentWithBookingData: Updating shipment document');

    // Extract address information from the rate request data
    const shipFromAddress = {
        company: rateRequestData.shipFrom?.name || rateRequestData.Origin?.Description || '',
        street: rateRequestData.shipFrom?.street || rateRequestData.Origin?.Street || '',
        street2: rateRequestData.shipFrom?.street2 || rateRequestData.Origin?.StreetExtra || '',
        city: rateRequestData.shipFrom?.city || rateRequestData.Origin?.City || '',
        state: rateRequestData.shipFrom?.state || rateRequestData.Origin?.State || '',
        postalCode: rateRequestData.shipFrom?.postalCode || rateRequestData.Origin?.PostalCode || '',
        country: rateRequestData.shipFrom?.country || rateRequestData.Origin?.Country?.Code || 'CA',
        phone: rateRequestData.shipFrom?.phone || rateRequestData.Origin?.Phone || '',
        email: rateRequestData.shipFrom?.email || rateRequestData.Origin?.Email || '',
        contactName: rateRequestData.shipFrom?.contactName || rateRequestData.Origin?.Contact || '',
        specialInstructions: rateRequestData.shipFrom?.specialInstructions || rateRequestData.Origin?.SpecialInstructions || ''
    };

    const shipToAddress = {
        company: rateRequestData.shipTo?.name || rateRequestData.Destination?.Description || '',
        street: rateRequestData.shipTo?.street || rateRequestData.Destination?.Street || '',
        street2: rateRequestData.shipTo?.street2 || rateRequestData.Destination?.StreetExtra || '',
        city: rateRequestData.shipTo?.city || rateRequestData.Destination?.City || '',
        state: rateRequestData.shipTo?.state || rateRequestData.Destination?.State || '',
        postalCode: rateRequestData.shipTo?.postalCode || rateRequestData.Destination?.PostalCode || '',
        country: rateRequestData.shipTo?.country || rateRequestData.Destination?.Country?.Code || 'CA',
        phone: rateRequestData.shipTo?.phone || rateRequestData.Destination?.Phone || '',
        email: rateRequestData.shipTo?.email || rateRequestData.Destination?.Email || '',
        contactName: rateRequestData.shipTo?.contactName || rateRequestData.Destination?.Contact || '',
        specialInstructions: rateRequestData.shipTo?.specialInstructions || rateRequestData.Destination?.SpecialInstructions || ''
    };

    console.log('updateShipmentWithBookingData: Ship from address:', shipFromAddress);
    console.log('updateShipmentWithBookingData: Ship to address:', shipToAddress);

    const updateData = {
        status: 'pending',
        
        // CRITICAL: Add ship from and ship to address information
        shipFrom: shipFromAddress,
        shipTo: shipToAddress,
        
        // Add carrier information
        carrier: bookingResult.carrier || 'Canpar Express',
        trackingNumber: bookingResult.trackingNumber,
        
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
            bookingMethod: 'canpar_api'
        },
        
        // Update selected rate reference with booking confirmation
        selectedRateRef: {
            ...selectedRate,
            bookingConfirmation: bookingResult,
            status: 'pending'
        },
        
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('shipments').doc(draftFirestoreDocId).update(updateData);
    console.log('updateShipmentWithBookingData: Shipment document updated successfully');
}

module.exports = {
    bookCanparShipment
}; 