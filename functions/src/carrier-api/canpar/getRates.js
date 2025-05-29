const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const dayjs = require('dayjs');
const { getCarrierApiConfig, validateCarrierEndpoints } = require('../../utils');

// Helper function for safe property access
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

// Transform Canpar SOAP response to internal format
function transformCanparResponseToInternalFormat(canparResponse) {
    if (!canparResponse) return null;

    // Extract shipment data from the nested response structure
    const shipment = safeAccess(canparResponse, 'soapenv:Envelope.soapenv:Body.0.ns:rateShipmentResponse.0.ns:return.0.ax25:processShipmentResult.0.ax27:shipment.0');
    
    if (!shipment) {
        logger.error('No shipment data found in Canpar response');
        return null;
    }

    // Extract rate information
    const freightCharge = parseFloat(safeAccess(shipment, 'ax27:freight_charge.0', '0'));
    const fuelSurcharge = parseFloat(safeAccess(shipment, 'ax27:fuel_surcharge.0', '0'));
    const taxCharge1 = parseFloat(safeAccess(shipment, 'ax27:tax_charge_1.0', '0'));
    const taxCharge2 = parseFloat(safeAccess(shipment, 'ax27:tax_charge_2.0', '0'));
    const total = parseFloat(safeAccess(shipment, 'ax27:total.0', '0'));
    const subtotal = parseFloat(safeAccess(shipment, 'ax27:subtotal.0', '0'));
    
    // Extract all additional charges and surcharges
    const carbonSurcharge = parseFloat(safeAccess(shipment, 'ax27:carbon_surcharge.0', '0'));
    const codCharge = parseFloat(safeAccess(shipment, 'ax27:cod_charge.0', '0'));
    const cosCharge = parseFloat(safeAccess(shipment, 'ax27:cos_charge.0', '0')); // Chain of Signature
    const dgCharge = parseFloat(safeAccess(shipment, 'ax27:dg_charge.0', '0')); // Dangerous Goods
    const dvCharge = parseFloat(safeAccess(shipment, 'ax27:dv_charge.0', '0')); // Declared Value
    const eaCharge = parseFloat(safeAccess(shipment, 'ax27:ea_charge.0', '0')); // Extended Area
    const handling = parseFloat(safeAccess(shipment, 'ax27:handling.0', '0'));
    const lgCharge = parseFloat(safeAccess(shipment, 'ax27:lg_charge.0', '0')); // Liftgate
    const overLengthCharge = parseFloat(safeAccess(shipment, 'ax27:over_length_charge.0', '0'));
    const overSizeCharge = parseFloat(safeAccess(shipment, 'ax27:over_size_charge.0', '0'));
    const overWeightCharge = parseFloat(safeAccess(shipment, 'ax27:over_weight_charge.0', '0'));
    const premiumCharge = parseFloat(safeAccess(shipment, 'ax27:premium_charge.0', '0'));
    const raCharge = parseFloat(safeAccess(shipment, 'ax27:ra_charge.0', '0')); // Residential Area
    const ruralCharge = parseFloat(safeAccess(shipment, 'ax27:rural_charge.0', '0'));
    const saCharge = parseFloat(safeAccess(shipment, 'ax27:sa_charge.0', '0')); // Signature Required
    const srCharge = parseFloat(safeAccess(shipment, 'ax27:sr_charge.0', '0'));
    const xcCharge = parseFloat(safeAccess(shipment, 'ax27:xc_charge.0', '0'));
    
    // Get tax codes for reference
    const taxCode1 = safeAccess(shipment, 'ax27:tax_code_1.0', '');
    const taxCode2 = safeAccess(shipment, 'ax27:tax_code_2.0', '');
    
    const transitTime = parseInt(safeAccess(shipment, 'ax27:transit_time.0', '0'));
    const estimatedDeliveryDate = safeAccess(shipment, 'ax27:estimated_delivery_date.0');
    const serviceType = parseInt(safeAccess(shipment, 'ax27:service_type.0', '5'));
    const billedWeight = parseFloat(safeAccess(shipment, 'ax27:billed_weight.0', '0'));
    const isGuaranteed = safeAccess(shipment, 'ax27:transit_time_guaranteed.0') === 'true';

    // Calculate total accessorial charges (all non-freight, non-fuel, non-tax charges)
    const totalAccessorialCharges = carbonSurcharge + codCharge + cosCharge + dgCharge + dvCharge + 
                                   eaCharge + handling + lgCharge + overLengthCharge + overSizeCharge + 
                                   overWeightCharge + premiumCharge + raCharge + ruralCharge + 
                                   saCharge + srCharge + xcCharge;

    // Create detailed billing breakdown
    const billingDetails = [];
    
    // Add base charges
    if (freightCharge > 0) {
        billingDetails.push({
            name: 'Freight Charge',
            amount: freightCharge,
            type: 'freight'
        });
    }
    
    if (fuelSurcharge > 0) {
        billingDetails.push({
            name: 'Fuel Surcharge',
            amount: fuelSurcharge,
            type: 'fuel'
        });
    }
    
    // Add accessorial charges (only if > 0)
    if (carbonSurcharge > 0) {
        billingDetails.push({
            name: 'Carbon Surcharge',
            amount: carbonSurcharge,
            type: 'accessorial'
        });
    }
    
    if (codCharge > 0) {
        billingDetails.push({
            name: 'COD Charge',
            amount: codCharge,
            type: 'accessorial'
        });
    }
    
    if (cosCharge > 0) {
        billingDetails.push({
            name: 'Chain of Signature',
            amount: cosCharge,
            type: 'accessorial'
        });
    }
    
    if (dgCharge > 0) {
        billingDetails.push({
            name: 'Dangerous Goods',
            amount: dgCharge,
            type: 'accessorial'
        });
    }
    
    if (dvCharge > 0) {
        billingDetails.push({
            name: 'Declared Value',
            amount: dvCharge,
            type: 'accessorial'
        });
    }
    
    if (eaCharge > 0) {
        billingDetails.push({
            name: 'Extended Area',
            amount: eaCharge,
            type: 'accessorial'
        });
    }
    
    if (handling > 0) {
        billingDetails.push({
            name: 'Handling',
            amount: handling,
            type: 'accessorial'
        });
    }
    
    if (lgCharge > 0) {
        billingDetails.push({
            name: 'Liftgate',
            amount: lgCharge,
            type: 'accessorial'
        });
    }
    
    if (overLengthCharge > 0) {
        billingDetails.push({
            name: 'Over Length',
            amount: overLengthCharge,
            type: 'accessorial'
        });
    }
    
    if (overSizeCharge > 0) {
        billingDetails.push({
            name: 'Over Size',
            amount: overSizeCharge,
            type: 'accessorial'
        });
    }
    
    if (overWeightCharge > 0) {
        billingDetails.push({
            name: 'Over Weight',
            amount: overWeightCharge,
            type: 'accessorial'
        });
    }
    
    if (premiumCharge > 0) {
        billingDetails.push({
            name: 'Premium Service',
            amount: premiumCharge,
            type: 'accessorial'
        });
    }
    
    if (raCharge > 0) {
        billingDetails.push({
            name: 'Residential Area',
            amount: raCharge,
            type: 'accessorial'
        });
    }
    
    if (ruralCharge > 0) {
        billingDetails.push({
            name: 'Rural Charge',
            amount: ruralCharge,
            type: 'accessorial'
        });
    }
    
    if (saCharge > 0) {
        billingDetails.push({
            name: 'Signature Required',
            amount: saCharge,
            type: 'accessorial'
        });
    }
    
    if (srCharge > 0) {
        billingDetails.push({
            name: 'SR Charge',
            amount: srCharge,
            type: 'accessorial'
        });
    }
    
    if (xcCharge > 0) {
        billingDetails.push({
            name: 'XC Charge',
            amount: xcCharge,
            type: 'accessorial'
        });
    }
    
    // Add taxes
    if (taxCharge1 > 0) {
        billingDetails.push({
            name: `Tax (${taxCode1 || 'Tax 1'})`,
            amount: taxCharge1,
            type: 'tax'
        });
    }
    
    if (taxCharge2 > 0) {
        billingDetails.push({
            name: `Tax (${taxCode2 || 'Tax 2'})`,
            amount: taxCharge2,
            type: 'tax'
        });
    }

    // Log extracted values for debugging
    logger.info('Canpar extracted values:', {
        freightCharge,
        fuelSurcharge,
        taxCharge1,
        taxCharge2,
        total,
        subtotal,
        totalAccessorialCharges,
        billingDetailsCount: billingDetails.length
    });

    // Map service type to service name
    const getServiceName = (serviceType) => {
        const serviceMap = {
            1: 'Canpar Ground',
            2: 'Canpar Select', 
            3: 'Canpar Overnight',
            4: 'Canpar USA',
            5: 'Canpar Ground',
            6: 'Canpar International'
        };
        return serviceMap[serviceType] || `Service ${serviceType}`;
    };

    // Create a single rate object (Canpar typically returns one rate per service type)
    const rate = {
        quoteId: `CANPAR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        carrierName: 'Canpar Express',
        carrierScac: 'CANP',
        carrierKey: 'CANPAR',
        serviceMode: getServiceName(serviceType),
        serviceType: getServiceName(serviceType),
        transitTime: transitTime,
        estimatedDeliveryDate: estimatedDeliveryDate ? dayjs(estimatedDeliveryDate).format('YYYY-MM-DD') : null,
        freightCharges: freightCharge,
        fuelCharges: fuelSurcharge,
        serviceCharges: 0, // Canpar doesn't separate service charges
        accessorialCharges: totalAccessorialCharges,
        totalCharges: total,
        currency: 'CAD', // Canpar is Canadian, typically CAD
        guaranteedService: isGuaranteed,
        guaranteeCharge: 0, // Would need separate calculation if guarantee is selected
        billingDetails: billingDetails,
        guarOptions: [],
        billedWeight: billedWeight,
        ratedWeight: billedWeight,
        // Store raw Canpar response data for reference
        canparServiceType: serviceType,
        canparZone: safeAccess(shipment, 'ax27:zone.0'),
        canparTaxCode1: safeAccess(shipment, 'ax27:tax_code_1.0'),
        canparTaxCode2: safeAccess(shipment, 'ax27:tax_code_2.0'),
        // Add tax charges for proper mapping
        taxCharge1: taxCharge1,
        taxCharge2: taxCharge2
    };

    // Log the final rate object for debugging
    logger.info('Canpar final rate object:', JSON.stringify(rate, null, 2));

    const transformed = {
        bookingReference: `CANPAR_${Date.now()}`,
        bookingReferenceType: "Shipment",
        shipmentBillType: "Prepaid",
        shipmentDate: safeAccess(shipment, 'ax27:shipping_date.0') ? dayjs(safeAccess(shipment, 'ax27:shipping_date.0')).format('YYYY-MM-DD') : null,
        pickupWindow: {
            earliest: "09:00",
            latest: "17:00"
        },
        deliveryWindow: {
            earliest: "09:00", 
            latest: "17:00"
        },
        origin: {
            company: safeAccess(shipment, 'ax27:pickup_address.0.ax27:name.0'),
            street: safeAccess(shipment, 'ax27:pickup_address.0.ax27:address_line_1.0'),
            street2: safeAccess(shipment, 'ax27:pickup_address.0.ax27:address_line_2.0'),
            postalCode: safeAccess(shipment, 'ax27:pickup_address.0.ax27:postal_code.0'),
            city: safeAccess(shipment, 'ax27:pickup_address.0.ax27:city.0'),
            state: safeAccess(shipment, 'ax27:pickup_address.0.ax27:province.0'),
            country: safeAccess(shipment, 'ax27:pickup_address.0.ax27:country.0'),
            contact: safeAccess(shipment, 'ax27:pickup_address.0.ax27:name.0'),
            phone: safeAccess(shipment, 'ax27:pickup_address.0.ax27:phone.0'),
            email: '',
            specialInstructions: 'none'
        },
        destination: {
            company: safeAccess(shipment, 'ax27:delivery_address.0.ax27:name.0'),
            street: safeAccess(shipment, 'ax27:delivery_address.0.ax27:address_line_1.0'),
            street2: safeAccess(shipment, 'ax27:delivery_address.0.ax27:address_line_2.0'),
            postalCode: safeAccess(shipment, 'ax27:delivery_address.0.ax27:postal_code.0'),
            city: safeAccess(shipment, 'ax27:delivery_address.0.ax27:city.0'),
            state: safeAccess(shipment, 'ax27:delivery_address.0.ax27:province.0'),
            country: safeAccess(shipment, 'ax27:delivery_address.0.ax27:country.0'),
            contact: safeAccess(shipment, 'ax27:delivery_address.0.ax27:name.0'),
            phone: safeAccess(shipment, 'ax27:delivery_address.0.ax27:phone.0'),
            email: '',
            specialInstructions: 'none'
        },
        items: [], // Would need to extract package information if needed
        availableRates: [rate] // Canpar typically returns one rate per request
    };

    return transformed;
}

// Build SOAP envelope for Canpar API
function buildCanparSoapEnvelope(requestData, credentials) {
    // Ensure we have required fields with defaults
    const shipment = requestData.shipment || {};
    const packages = shipment.packages || [];
    const pickupAddress = shipment.pickup_address || {};
    const deliveryAddress = shipment.delivery_address || {};
    
    // Build packages XML
    const packagesXml = packages.map(pkg => `
        <xsd:packages>
            <xsd:reported_weight>${parseFloat(pkg.reported_weight || 1).toFixed(1)}</xsd:reported_weight>
            <xsd:length>${parseFloat(pkg.length || 10).toFixed(1)}</xsd:length>
            <xsd:width>${parseFloat(pkg.width || 10).toFixed(1)}</xsd:width>
            <xsd:height>${parseFloat(pkg.height || 10).toFixed(1)}</xsd:height>
            <xsd:declared_value>${parseFloat(pkg.declared_value || 0).toFixed(2)}</xsd:declared_value>
        </xsd:packages>
    `).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ws="http://ws.onlinerating.canshipws.canpar.com"
                  xmlns:xsd="http://ws.dto.canshipws.canpar.com/xsd">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:rateShipment>
      <ws:request>
        <xsd:user_id>${credentials.username}</xsd:user_id>
        <xsd:password>${credentials.password}</xsd:password>
        <xsd:apply_association_discount>false</xsd:apply_association_discount>
        <xsd:apply_individual_discount>false</xsd:apply_individual_discount>
        <xsd:apply_invoice_discount>false</xsd:apply_invoice_discount>

        <xsd:shipment>
          <xsd:shipper_num>${credentials.accountNumber}</xsd:shipper_num>
          <xsd:shipping_date>${(shipment.shipping_date || new Date().toISOString()).replace(/T.*$/, "T00:00:00")}</xsd:shipping_date>
          <xsd:service_type>${shipment.service_type || 1}</xsd:service_type>
          <xsd:shipment_status>R</xsd:shipment_status>
          <xsd:reported_weight_unit>L</xsd:reported_weight_unit>
          <xsd:dimention_unit>I</xsd:dimention_unit>

          ${packagesXml}

          <xsd:pickup_address>
            <xsd:name>${pickupAddress.name || 'Test Shipper'}</xsd:name>
            <xsd:address_line_1>${pickupAddress.address_line_1 || '123 Test St'}</xsd:address_line_1>
            ${pickupAddress.address_line_2 ? `<xsd:address_line_2>${pickupAddress.address_line_2}</xsd:address_line_2>` : ""}
            <xsd:city>${pickupAddress.city || 'Toronto'}</xsd:city>
            <xsd:province>${pickupAddress.province || 'ON'}</xsd:province>
            <xsd:country>${pickupAddress.country || 'CA'}</xsd:country>
            <xsd:postal_code>${pickupAddress.postal_code || 'M5V3A8'}</xsd:postal_code>
            <xsd:phone>${pickupAddress.phone || '4165551234'}</xsd:phone>
            <xsd:residential>false</xsd:residential>
          </xsd:pickup_address>

          <xsd:delivery_address>
            <xsd:name>${deliveryAddress.name || 'Test Recipient'}</xsd:name>
            <xsd:address_line_1>${deliveryAddress.address_line_1 || '456 Test Ave'}</xsd:address_line_1>
            ${deliveryAddress.address_line_2 ? `<xsd:address_line_2>${deliveryAddress.address_line_2}</xsd:address_line_2>` : ""}
            <xsd:city>${deliveryAddress.city || 'Vancouver'}</xsd:city>
            <xsd:province>${deliveryAddress.province || 'BC'}</xsd:province>
            <xsd:country>${deliveryAddress.country || 'CA'}</xsd:country>
            <xsd:postal_code>${deliveryAddress.postal_code || 'V6B1A1'}</xsd:postal_code>
            <xsd:phone>${deliveryAddress.phone || '6045551234'}</xsd:phone>
            <xsd:residential>false</xsd:residential>
          </xsd:delivery_address>
        </xsd:shipment>
      </ws:request>
    </ws:rateShipment>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Validate Canpar rate request
function validateCanparRateRequest(data) {
    if (!data) return 'Request body is required';
    
    // Helper to sanitize postal codes for Canpar (remove spaces, uppercase)
    const sanitizePostalCode = (postalCode) => {
        if (!postalCode) return '';
        return postalCode.replace(/\s+/g, '').toUpperCase();
    };
    
    // Create default shipment structure if missing
    if (!data.shipment) {
        data.shipment = {};
    }
    
    const shipment = data.shipment;
    
    // Set default shipping date if not provided
    if (!shipment.shipping_date) {
        shipment.shipping_date = new Date().toISOString();
    }
    
    // Ensure packages array exists with at least one package
    if (!shipment.packages || !Array.isArray(shipment.packages) || shipment.packages.length === 0) {
        shipment.packages = [{
            reported_weight: 1,
            length: 10,
            width: 10,
            height: 10,
            declared_value: 0
        }];
    }
    
    // Ensure pickup address exists with defaults and sanitize postal code
    if (!shipment.pickup_address) {
        shipment.pickup_address = {
            name: 'Test Shipper',
            address_line_1: '123 Test St',
            city: 'Toronto',
            province: 'ON',
            country: 'CA',
            postal_code: 'M5V3A8',
            phone: '4165551234'
        };
    } else {
        // Sanitize postal code if it exists
        if (shipment.pickup_address.postal_code) {
            shipment.pickup_address.postal_code = sanitizePostalCode(shipment.pickup_address.postal_code);
        }
    }
    
    // Ensure delivery address exists with defaults and sanitize postal code
    if (!shipment.delivery_address) {
        shipment.delivery_address = {
            name: 'Test Recipient',
            address_line_1: '456 Test Ave',
            city: 'Vancouver',
            province: 'BC',
            country: 'CA',
            postal_code: 'V6B1A1',
            phone: '6045551234'
        };
    } else {
        // Sanitize postal code if it exists
        if (shipment.delivery_address.postal_code) {
            shipment.delivery_address.postal_code = sanitizePostalCode(shipment.delivery_address.postal_code);
        }
    }
    
    // Set default service type if not provided
    if (!shipment.service_type) {
        shipment.service_type = 1; // Canpar Ground
    }
    
    // Validate packages have minimum required fields
    for (const [index, pkg] of shipment.packages.entries()) {
        if (!pkg.reported_weight || pkg.reported_weight <= 0) {
            pkg.reported_weight = 1; // Default to 1 lb
        }
        if (!pkg.length || pkg.length <= 0) pkg.length = 10;
        if (!pkg.width || pkg.width <= 0) pkg.width = 10;
        if (!pkg.height || pkg.height <= 0) pkg.height = 10;
        if (!pkg.declared_value) pkg.declared_value = 0;
    }
    
    // Log sanitized postal codes for debugging
    logger.info('Canpar postal codes after sanitization:', {
        pickup: shipment.pickup_address.postal_code,
        delivery: shipment.delivery_address.postal_code
    });
    
    return null; // No validation errors
}

// Main rate processing function
async function processCanparRateRequest(data) {
    logger.info('Processing Canpar rate request');
    
    try {
        // Validate the request
        const validationError = validateCanparRateRequest(data);
        if (validationError) {
            logger.error('Canpar validation error:', validationError);
            throw new Error(validationError);
        }
        
        logger.info('Canpar rate request data:', JSON.stringify(data, null, 2));
        
        // Get carrier API configuration
        const carrierConfig = await getCarrierApiConfig('CANPAR', 'rate');
        const { apiUrl, credentials } = carrierConfig;
        
        // Validate that the carrier has the required endpoints
        if (!validateCarrierEndpoints(credentials, ['rate'])) {
            throw new Error('Canpar carrier missing required rate endpoint configuration');
        }
        
        logger.info(`Using Canpar Rate API URL: ${apiUrl}`);
        logger.info(`Canpar credentials retrieved - username: ${credentials.username || "MISSING"}, accountNumber: ${credentials.accountNumber || "MISSING"}, hasPassword: ${!!credentials.password}`);
        
        // Build SOAP envelope
        const soapEnvelope = buildCanparSoapEnvelope(data, credentials);
        logger.info('Canpar SOAP request envelope built');
        
        // Log the full SOAP envelope in chunks to avoid truncation
        const chunkSize = 800; // Safe size for Firebase logs
        const soapLength = soapEnvelope.length;
        logger.info(`Full SOAP Envelope (${soapLength} characters total):`);
        
        for (let i = 0; i < soapLength; i += chunkSize) {
            const chunk = soapEnvelope.substring(i, i + chunkSize);
            const chunkNumber = Math.floor(i / chunkSize) + 1;
            const totalChunks = Math.ceil(soapLength / chunkSize);
            logger.info(`SOAP Chunk ${chunkNumber}/${totalChunks}: ${chunk}`);
        }
        
        logger.info('=== END OF SOAP ENVELOPE ===');
        
        // Make SOAP request to Canpar
        const response = await axios.post(apiUrl, soapEnvelope, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'rateShipment'
            },
            validateStatus: function (status) {
                return status >= 200 && status < 600; // Accept all statuses to inspect body
            }
        });
        
        logger.info(`Canpar API Response Status: ${response.status}`);
        
        // Log the full response in chunks for debugging
        const responseData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        const responseLength = responseData.length;
        logger.info(`Full Canpar Response (${responseLength} characters total):`);
        
        for (let i = 0; i < responseLength; i += chunkSize) {
            const chunk = responseData.substring(i, i + chunkSize);
            const chunkNumber = Math.floor(i / chunkSize) + 1;
            const totalChunks = Math.ceil(responseLength / chunkSize);
            logger.info(`Response Chunk ${chunkNumber}/${totalChunks}: ${chunk}`);
        }
        
        logger.info('=== END OF CANPAR RESPONSE ===');
        
        if (response.status >= 400) {
            logger.error('Canpar API Error Response:', response.data);
            throw new Error(`Canpar API Error: HTTP Status ${response.status}`);
        }
        
        // Parse XML response
        const parsedResponse = await parseStringPromise(response.data, {
            explicitArray: true,
            ignoreAttrs: false
        });
        
        logger.info('Canpar XML response parsed successfully');
        
        // Check for SOAP faults or errors
        const soapFault = safeAccess(parsedResponse, 'soapenv:Envelope.soapenv:Body.0.soapenv:Fault');
        if (soapFault) {
            const faultString = safeAccess(soapFault, '0.faultstring.0', 'Unknown SOAP fault');
            logger.error('Canpar SOAP Fault:', faultString);
            throw new Error(`Canpar SOAP Fault: ${faultString}`);
        }
        
        // Check for application errors
        const error = safeAccess(parsedResponse, 'soapenv:Envelope.soapenv:Body.0.ns:rateShipmentResponse.0.ns:return.0.ax25:error.0');
        if (error && error !== null) {
            // Check if it's a null error (which means NO error occurred)
            if (error.$ && error.$.hasOwnProperty('xsi:nil') && error.$['xsi:nil'] === 'true') {
                logger.info('Canpar error element is null (xsi:nil="true") - this means NO error occurred, proceeding with response processing');
            } else {
                // This is an actual error
                logger.error('Canpar application error:', JSON.stringify(error, null, 2));
                throw new Error(`Canpar application error: ${JSON.stringify(error, null, 2)}`);
            }
        }
        
        // Check for successful response structure
        const rateResponse = safeAccess(parsedResponse, 'soapenv:Envelope.soapenv:Body.0.ns:rateShipmentResponse.0.ns:return.0');
        if (!rateResponse) {
            logger.error('No rate response found in Canpar API response');
            logger.error('Full parsed response:', JSON.stringify(parsedResponse, null, 2));
            throw new Error('Invalid response structure from Canpar API - no rate data found');
        }
        
        // Log successful response structure for debugging
        logger.info('Canpar rate response structure found:', Object.keys(rateResponse));
        
        // Check for shipment data
        const shipmentResult = safeAccess(rateResponse, 'ax25:processShipmentResult.0.ax27:shipment.0');
        if (!shipmentResult) {
            logger.error('No shipment result found in Canpar response');
            logger.error('Available response keys:', Object.keys(rateResponse));
            throw new Error('No shipment data found in Canpar API response');
        }
        
        // Transform response to internal format
        const transformedData = transformCanparResponseToInternalFormat(parsedResponse);
        
        if (!transformedData || !transformedData.availableRates || transformedData.availableRates.length === 0) {
            logger.error('Failed to transform Canpar response or no rates available');
            logger.error('Transformed data:', JSON.stringify(transformedData, null, 2));
            throw new Error('Failed to process rates from Canpar API or no rates available');
        }
        
        logger.info('Successfully transformed rates from Canpar SOAP API');
        logger.info('Number of rates found:', transformedData.availableRates.length);
        logger.info('Transformed data summary:', {
            bookingReference: transformedData.bookingReference,
            ratesCount: transformedData.availableRates.length,
            firstRateTotal: transformedData.availableRates[0]?.totalCharges,
            firstRateCarrier: transformedData.availableRates[0]?.carrierName
        });
        
        return {
            success: true,
            data: transformedData
        };
        
    } catch (error) {
        logger.error('Error in processCanparRateRequest:', error.message, error.stack);
        throw error;
    }
}

// Export the Cloud Function
// Force deployment update
exports.getRatesCanpar = onCall(async (request) => {
    try {
        const data = request.data;
        logger.info('getRatesCanpar function called');
        
        return await processCanparRateRequest(data);
        
    } catch (error) {
        logger.error('Error in getRatesCanpar function:', error);
        throw new Error(error.message || 'An internal error occurred while processing the Canpar rate request.');
    }
}); 