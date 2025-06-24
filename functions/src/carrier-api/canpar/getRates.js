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

// Enhanced service mapping with proper service levels (moved to global scope)
const getServiceInfo = (serviceType) => {
    const serviceMap = {
        1: { name: 'Canpar Ground', level: 'economy', category: 'domestic' },
        2: { name: 'Canpar Select', level: 'express', category: 'domestic' },
        3: { name: 'Canpar Select Letter', level: 'express', category: 'domestic' },
        4: { name: 'Canpar Select Pak', level: 'express', category: 'domestic' },
        5: { name: 'Canpar Overnight', level: 'priority', category: 'domestic' },
        6: { name: 'Canpar Overnight Letter', level: 'priority', category: 'domestic' },
        7: { name: 'Canpar Overnight Pak', level: 'priority', category: 'domestic' },
        8: { name: 'Canpar USA', level: 'economy', category: 'international' },
        9: { name: 'Canpar USA Letter', level: 'economy', category: 'international' },
        10: { name: 'Canpar USA Pak', level: 'economy', category: 'international' },
        11: { name: 'Canpar Select USA', level: 'express', category: 'international' },
        12: { name: 'Canpar International', level: 'economy', category: 'international' }
    };
    return serviceMap[serviceType] || { name: `Service ${serviceType}`, level: 'economy', category: 'domestic' };
};

// Get service name for backward compatibility
const getServiceName = (serviceType) => {
    return getServiceInfo(serviceType).name;
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



    // Get service info for proper classification
    const serviceInfo = getServiceInfo(serviceType);
    
    // Create a single rate object (Canpar typically returns one rate per service type)
    const rate = {
        quoteId: `CANPAR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        carrierName: 'Canpar Express',
        carrierScac: 'CANP',
        carrierKey: 'CANPAR',
        serviceMode: serviceInfo.name,
        serviceType: serviceInfo.name,
        serviceLevel: serviceInfo.level, // Add proper service level mapping
        serviceCategory: serviceInfo.category, // domestic vs international
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
        taxCharge2: taxCharge2,
        // Enhanced service metadata
        canparServiceInfo: serviceInfo
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
    
    // Extract reference number from shipment data
    // Extract signature service - nsr is REVERSE logic for Canpar
    const signatureRequired = requestData.shipmentInfo?.signatureRequired !== undefined ? requestData.shipmentInfo.signatureRequired : true;
    const nsr = !signatureRequired;

    const referenceNumber = shipment.reference || 
                           requestData.referenceNumber || 
                           requestData.shipmentInfo?.shipperReferenceNumber || 
                           shipment.shipmentID || 
                           '';
    
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
          <xsd:nsr>${nsr}</xsd:nsr>
          <xsd:dimention_unit>I</xsd:dimention_unit>
          ${referenceNumber ? `<xsd:reference>${referenceNumber}</xsd:reference>` : ''}

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

/**
 * Map courier service levels to Canpar service types
 * @param {Array} serviceLevels - Array of service levels (e.g., ['economy', 'express', 'priority'])
 * @param {boolean} isInternational - Whether this is an international shipment
 * @returns {Array} - Array of Canpar service types to request
 */
function mapServiceLevelsToCanparTypes(serviceLevels, isInternational = false) {
    if (!serviceLevels || serviceLevels.length === 0) {
        // Default to ground/economy if no specific service levels requested
        return isInternational ? [8] : [1]; // USA or Ground
    }

    const serviceMapping = {
        domestic: {
            economy: [1], // Ground
            express: [2, 3, 4], // Select, Select Letter, Select Pak
            priority: [5, 6, 7] // Overnight, Overnight Letter, Overnight Pak
        },
        international: {
            economy: [8, 9, 10, 12], // USA, USA Letter, USA Pak, International
            express: [11], // Select USA
            priority: [] // No priority international services available
        }
    };

    const category = isInternational ? 'international' : 'domestic';
    const availableServices = serviceMapping[category];
    
    const canparServiceTypes = [];
    
    serviceLevels.forEach(level => {
        if (availableServices[level]) {
            canparServiceTypes.push(...availableServices[level]);
        }
    });

    // Remove duplicates and return
    return [...new Set(canparServiceTypes)];
}

/**
 * Make a single Canpar API call for a specific service type
 * @param {Object} data - Request data
 * @param {Object} credentials - API credentials
 * @param {string} apiUrl - API URL
 * @param {number} serviceType - Canpar service type
 * @returns {Promise<Object>} - Single rate response
 */
async function fetchCanparSingleServiceRate(data, credentials, apiUrl, serviceType) {
    // Clone the data and set the specific service type
    const serviceData = JSON.parse(JSON.stringify(data));
    serviceData.shipment = serviceData.shipment || {};
    serviceData.shipment.service_type = serviceType;

    logger.info(`Fetching Canpar rate for service type ${serviceType}`);

    // Build SOAP envelope for this specific service
    const soapEnvelope = buildCanparSoapEnvelope(serviceData, credentials);

    // Make SOAP request to Canpar
    const response = await axios.post(apiUrl, soapEnvelope, {
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'rateShipment'
        },
        validateStatus: function (status) {
            return status >= 200 && status < 600;
        }
    });

    if (response.status >= 400) {
        throw new Error(`Canpar API Error for service ${serviceType}: HTTP Status ${response.status}`);
    }

    // Parse XML response
    const parsedResponse = await parseStringPromise(response.data, {
        explicitArray: true,
        ignoreAttrs: false
    });

    // Check for SOAP faults or errors
    const soapFault = safeAccess(parsedResponse, 'soapenv:Envelope.soapenv:Body.0.soapenv:Fault');
    if (soapFault) {
        const faultString = safeAccess(soapFault, '0.faultstring.0', 'Unknown SOAP fault');
        throw new Error(`Canpar SOAP Fault for service ${serviceType}: ${faultString}`);
    }

    // Check for application errors
    const error = safeAccess(parsedResponse, 'soapenv:Envelope.soapenv:Body.0.ns:rateShipmentResponse.0.ns:return.0.ax25:error.0');
    if (error && error !== null) {
        if (!(error.$ && error.$.hasOwnProperty('xsi:nil') && error.$['xsi:nil'] === 'true')) {
            throw new Error(`Canpar application error for service ${serviceType}: ${JSON.stringify(error, null, 2)}`);
        }
    }

    // Check for successful response structure
    const rateResponse = safeAccess(parsedResponse, 'soapenv:Envelope.soapenv:Body.0.ns:rateShipmentResponse.0.ns:return.0');
    if (!rateResponse) {
        throw new Error(`Invalid response structure from Canpar API for service ${serviceType}`);
    }

    // Check for shipment data
    const shipmentResult = safeAccess(rateResponse, 'ax25:processShipmentResult.0.ax27:shipment.0');
    if (!shipmentResult) {
        throw new Error(`No shipment data found in Canpar API response for service ${serviceType}`);
    }

    // Transform response to internal format
    const transformedData = transformCanparResponseToInternalFormat(parsedResponse);
    
    if (!transformedData || !transformedData.availableRates || transformedData.availableRates.length === 0) {
        throw new Error(`Failed to process rates from Canpar API for service ${serviceType}`);
    }

    return transformedData.availableRates[0]; // Return the single rate
}

// Main rate processing function with multi-service support
async function processCanparRateRequest(data) {
    logger.info('Processing Canpar rate request with multi-service support');
    
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
        
        // Determine if this is an international shipment
        const isInternational = data.shipment?.pickup_address?.country !== data.shipment?.delivery_address?.country;
        
        // Extract requested service levels from the request data
        let requestedServiceLevels = data.serviceLevels || data.shipmentInfo?.serviceLevels || ['economy'];
        
        // Handle "any" service level - expand to all available service levels for courier shipments
        if (requestedServiceLevels.includes('any') || (data.shipmentInfo?.serviceLevel === 'any')) {
            if (data.shipmentInfo?.shipmentType === 'courier') {
                requestedServiceLevels = ['economy', 'express', 'priority'];
            } else {
                requestedServiceLevels = ['economy']; // For freight, just use economy
            }
        }
        
        logger.info('Original service levels:', data.serviceLevels);
        logger.info('Shipment info service level:', data.shipmentInfo?.serviceLevel);
        logger.info('Final requested service levels:', requestedServiceLevels);
        logger.info('Is international shipment:', isInternational);
        
        // Map service levels to Canpar service types
        const canparServiceTypes = mapServiceLevelsToCanparTypes(requestedServiceLevels, isInternational);
        logger.info('Mapped Canpar service types:', canparServiceTypes);
        
        // Add detailed mapping info for debugging
        logger.info('Service mapping details:', {
            isInternational,
            requestedServiceLevels,
            canparServiceTypes: canparServiceTypes.map(type => ({
                type,
                serviceName: getServiceInfo(type).name,
                serviceLevel: getServiceInfo(type).level
            }))
        });
        
        if (canparServiceTypes.length === 0) {
            logger.warn('No applicable Canpar service types found for requested service levels');
            return {
                success: true,
                data: {
                    bookingReference: `CANPAR_${Date.now()}`,
                    availableRates: []
                }
            };
        }
        
        // Fetch rates for all service types in parallel
        logger.info(`🚀 Fetching rates for ${canparServiceTypes.length} Canpar service types in parallel...`);
        const startTime = Date.now();
        
        const ratePromises = canparServiceTypes.map(async (serviceType) => {
            try {
                logger.info(`🔄 Requesting Canpar service type ${serviceType} (${getServiceInfo(serviceType).name})`);
                const rate = await fetchCanparSingleServiceRate(data, credentials, apiUrl, serviceType);
                logger.info(`✅ Service type ${serviceType} returned: ${rate.serviceMode} (${rate.serviceLevel}) - $${rate.totalCharges}`);
                logger.info(`📝 Rate details:`, {
                    requestedServiceType: serviceType,
                    returnedServiceMode: rate.serviceMode,
                    returnedServiceLevel: rate.serviceLevel,
                    canparServiceType: rate.canparServiceType,
                    totalCharges: rate.totalCharges
                });
                return { success: true, rate, serviceType };
            } catch (error) {
                logger.warn(`❌ Failed to fetch rate for service type ${serviceType}: ${error.message}`);
                return { success: false, error: error.message, serviceType };
            }
        });
        
        // Wait for all rate requests to complete
        const results = await Promise.allSettled(ratePromises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        // Process results
        const successfulRates = [];
        const failedServices = [];
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.success) {
                successfulRates.push(result.value.rate);
            } else {
                const serviceType = canparServiceTypes[index];
                const error = result.status === 'rejected' ? result.reason.message : result.value.error;
                failedServices.push({ serviceType, error });
            }
        });
        
        logger.info(`📊 Canpar multi-service fetch completed in ${totalTime}ms:`);
        logger.info(`  ✅ Successful rates: ${successfulRates.length}`);
        logger.info(`  ❌ Failed services: ${failedServices.length}`);
        
        if (failedServices.length > 0) {
            logger.warn('Failed services:', failedServices);
        }
        
        // Remove duplicates based on service type and total charges
        const uniqueRates = [];
        const seenCombinations = new Set();
        
        successfulRates.forEach(rate => {
            const key = `${rate.serviceMode}-${rate.totalCharges}-${rate.serviceLevel}`;
            if (!seenCombinations.has(key)) {
                seenCombinations.add(key);
                uniqueRates.push(rate);
            } else {
                logger.info(`🔄 Removing duplicate rate: ${rate.serviceMode} - $${rate.totalCharges}`);
            }
        });
        
        // Sort rates by total charges (lowest first)
        uniqueRates.sort((a, b) => (a.totalCharges || 0) - (b.totalCharges || 0));
        
        logger.info(`📊 Rate deduplication: ${successfulRates.length} → ${uniqueRates.length} rates`);
        
        const transformedData = {
            bookingReference: `CANPAR_${Date.now()}`,
            bookingReferenceType: "Shipment",
            shipmentBillType: "Prepaid",
            shipmentDate: new Date().toISOString().split('T')[0],
            pickupWindow: {
                earliest: "09:00",
                latest: "17:00"
            },
            deliveryWindow: {
                earliest: "09:00", 
                latest: "17:00"
            },
            origin: uniqueRates[0]?.origin || {},
            destination: uniqueRates[0]?.destination || {},
            items: [],
            availableRates: uniqueRates,
            // Add metadata about the multi-service fetch
            fetchMetadata: {
                requestedServiceLevels,
                canparServiceTypes,
                originalRatesCount: successfulRates.length,
                uniqueRatesCount: uniqueRates.length,
                failedServices: failedServices.length,
                totalFetchTime: totalTime,
                isInternational,
                duplicatesRemoved: successfulRates.length - uniqueRates.length
            }
        };
        
        logger.info(`🎯 Successfully retrieved ${uniqueRates.length} unique Canpar rates (${successfulRates.length} total fetched) across ${canparServiceTypes.length} service types`);
        
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
exports.getRatesCanpar = onCall({
    cors: true,
    timeoutSeconds: 45, // Increased timeout for better reliability
    memory: "512MiB", // Increased memory for better performance
    region: 'us-central1',
    minInstances: 1, // Keep 1 instance warm to prevent cold starts
    maxInstances: 10 // Allow scaling for high demand
}, async (request) => {
    try {
        const data = request.data;
        logger.info('getRatesCanpar function called');
        
        // Check if this is a warmup request from keep-alive system
        if (data && data._isWarmupRequest) {
            logger.info('🔥 Canpar warmup request detected - returning quick response');
            return {
                success: true,
                message: 'Canpar function is warm',
                timestamp: new Date().toISOString(),
                warmup: true
            };
        }

        // Check if this is a keep-alive system call
        if (request.auth && (request.auth.uid === 'keepalive-system' || request.auth.uid === 'health-check' || request.auth.uid?.includes('warmup'))) {
            logger.info('🔥 Keep-alive system request detected - returning quick response');
            return {
                success: true,
                message: 'Canpar function is responding',
                timestamp: new Date().toISOString(),
                keepalive: true
            };
        }
        
        return await processCanparRateRequest(data);
        
    } catch (error) {
        logger.error('Error in getRatesCanpar function:', error);
        throw new Error(error.message || 'An internal error occurred while processing the Canpar rate request.');
    }
}); 