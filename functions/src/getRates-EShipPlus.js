// Import only v2 functions API
const functions = require('firebase-functions');
const { onCall } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const axios = require('axios');
const { parseStringPromise } = require("xml2js");
const admin = require('firebase-admin');

// Initialize Firebase Admin with default credentials
if (!admin.apps.length) {
  admin.initializeApp();
  console.log('Firebase Admin initialized with default credentials');
}

// Constants
const ESHIPPLUS_API_URL = process.env.ESHIPPLUS_URL || "http://www.eshipplus.com/services/eShipPlusWSv4.asmx";

// Shared function logic to process rate requests
async function processRateRequest(data) {
  try {
    // In development or when explicitly disabled, skip API key validation
    const skipApiKeyValidation = process.env.NODE_ENV === 'development' || process.env.SKIP_API_KEY_VALIDATION === 'true';
    
    // Extract the API key from the request data (if provided)
    const apiKey = data.apiKey;
    
    // Only validate API key if not in development and validation is not skipped
    if (!skipApiKeyValidation) {
      // Check if API key exists
      if (!apiKey) {
        logger.warn('API key validation: No API key provided');
        throw new Error('API key is required');
      }
      
      // Validate API key against stored keys
      const isValidApiKey = await validateApiKey(apiKey);
      if (!isValidApiKey) {
        logger.warn('API key validation: Invalid API key provided');
        throw new Error('Invalid API key');
      }
      
      logger.info('API key validation: Valid API key');
    } else {
      logger.info('API key validation: Skipped (development mode)');
    }

    // Validate required fields in the rate request data
    const rateRequestData = data;
    
    // Always ensure bookingReferenceNumber and bookingReferenceNumberType are set properly
    rateRequestData.bookingReferenceNumber = rateRequestData.bookingReferenceNumber || "123456";
    rateRequestData.bookingReferenceNumberType = "Shipment"; // Always use "Shipment" as the type
    
    // If shipmentInfo exists, ensure its values are also set properly
    if (rateRequestData.shipmentInfo) {
      rateRequestData.shipmentInfo.bookingRef = rateRequestData.shipmentInfo.bookingRef || "123456";
      rateRequestData.shipmentInfo.bookingReferenceNumberType = "Shipment";
    }
    
    const validationError = validateRateRequest(rateRequestData);
    if (validationError) {
      throw new Error(validationError);
    }

    // Log request (for debugging and analytics)
    logger.info('Rate request:', rateRequestData);

    // Build SOAP request
    const soapRequest = buildRateRequest(rateRequestData);
    
    logger.debug('SOAP Request:', soapRequest);

    // Make the SOAP request to eShipPlus API
    const response = await axios.post(ESHIPPLUS_API_URL, soapRequest, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.eshipplus.com/Rate',
        'Accept': 'text/xml'
      },
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Accept any status less than 500
      }
    });

    logger.debug('API Response:', response.data);

    // Parse XML response
    const result = await parseStringPromise(response.data);
    logger.debug('Parsed Response:', JSON.stringify(result, null, 2));

    // Check for SOAP fault
    if (result['soap:Envelope']['soap:Body'][0]['soap:Fault']) {
      const fault = result['soap:Envelope']['soap:Body'][0]['soap:Fault'][0];
      throw new Error(`SOAP Fault: ${fault.faultstring[0]}`);
    }

    // Helper function to safely get array values
    const getValue = (obj, path, defaultValue = null) => {
      try {
        return path.split('.').reduce((o, key) => {
          if (o && o[key] && Array.isArray(o[key]) && o[key].length > 0) {
            return o[key][0];
          }
          return o && o[key];
        }, obj) || defaultValue;
      } catch (e) {
        return defaultValue;
      }
    };

    // Extract rates from response
    const rateResponse = result['soap:Envelope']['soap:Body'][0]['RateResponse'][0];
    const rateResult = rateResponse['RateResult'][0];
    
    // Transform the response into a cleaner format
    const transformedRates = {
      bookingReference: getValue(rateResult, 'BookingReferenceNumber'),
      bookingReferenceType: getValue(rateResult, 'BookingReferenceNumberType'),
      shipmentBillType: getValue(rateResult, 'ShipmentBillType'),
      shipmentDate: getValue(rateResult, 'ShipmentDate'),
      pickupWindow: {
        earliest: getValue(rateResult, 'EarliestPickup.Time'),
        latest: getValue(rateResult, 'LatestPickup.Time')
      },
      deliveryWindow: {
        earliest: getValue(rateResult, 'EarliestDelivery.Time'),
        latest: getValue(rateResult, 'LatestDelivery.Time')
      },
      origin: {
        company: getValue(rateResult, 'Origin.Description'),
        street: getValue(rateResult, 'Origin.Street'),
        street2: getValue(rateResult, 'Origin.StreetExtra'),
        postalCode: getValue(rateResult, 'Origin.PostalCode'),
        city: getValue(rateResult, 'Origin.City'),
        state: getValue(rateResult, 'Origin.State'),
        country: getValue(rateResult, 'Origin.Country.Code'),
        contact: getValue(rateResult, 'Origin.Contact'),
        phone: getValue(rateResult, 'Origin.Phone'),
        email: getValue(rateResult, 'Origin.Email'),
        specialInstructions: getValue(rateResult, 'Origin.SpecialInstructions')
      },
      destination: {
        company: getValue(rateResult, 'Destination.Description'),
        street: getValue(rateResult, 'Destination.Street'),
        street2: getValue(rateResult, 'Destination.StreetExtra'),
        postalCode: getValue(rateResult, 'Destination.PostalCode'),
        city: getValue(rateResult, 'Destination.City'),
        state: getValue(rateResult, 'Destination.State'),
        country: getValue(rateResult, 'Destination.Country.Code'),
        contact: getValue(rateResult, 'Destination.Contact'),
        phone: getValue(rateResult, 'Destination.Phone'),
        email: getValue(rateResult, 'Destination.Email'),
        specialInstructions: getValue(rateResult, 'Destination.SpecialInstructions')
      },
      items: (rateResult.Items?.[0]?.WSItem2 || []).map(item => ({
        description: getValue(item, 'Description'),
        weight: parseFloat(getValue(item, 'Weight', '0')),
        dimensions: {
          length: parseInt(getValue(item, 'Length', '0')),
          width: parseInt(getValue(item, 'Width', '0')),
          height: parseInt(getValue(item, 'Height', '0'))
        },
        packagingQuantity: parseInt(getValue(item, 'PackagingQuantity', '0')),
        freightClass: getValue(item, 'FreightClass.FreightClass'),
        declaredValue: parseFloat(getValue(item, 'DeclaredValue', '0')),
        stackable: getValue(item, 'Stackable') === 'true'
      })),
      availableRates: (rateResult.AvailableRates?.[0]?.WSRate2 || []).map(rate => ({
        quoteId: getValue(rate, 'QuoteId'),
        carrierName: getValue(rate, 'CarrierName'),
        carrierScac: getValue(rate, 'CarrierScac'),
        serviceMode: getValue(rate, 'ServiceMode'),
        transitTime: parseInt(getValue(rate, 'TransitTime', '0')),
        estimatedDeliveryDate: getValue(rate, 'EstimatedDeliveryDate'),
        freightCharges: parseFloat(getValue(rate, 'FreightCharges', '0')),
        fuelCharges: parseFloat(getValue(rate, 'FuelCharges', '0')),
        serviceCharges: parseFloat(getValue(rate, 'ServiceCharges', '0')),
        accessorialCharges: parseFloat(getValue(rate, 'AccessorialCharges', '0')),
        totalCharges: parseFloat(getValue(rate, 'TotalCharges', '0')),
        currency: getValue(rate, 'Currency', 'USD'),
        guaranteedService: getValue(rate, 'GuaranteedService') === 'true',
        guaranteeCharge: parseFloat(getValue(rate, 'GuaranteeCharge', '0')),
        accessorials: (rate.Accessorials?.[0]?.WSAccessorial || []).map(accessorial => ({
          description: getValue(accessorial, 'Description'),
          amount: parseFloat(getValue(accessorial, 'Amount', '0')),
          category: getValue(accessorial, 'Category')
        }))
      }))
    };
    
    // Return the transformed rates
    return {
      success: true,
      data: transformedRates
    };
  } catch (error) {
    logger.error('Error in getRatesEShipPlus:', error);
    throw error;
  }
}

/**
 * Export v2 callable function 
 */
exports.getRatesEShipPlus = onCall({
  cors: true,
  timeoutSeconds: 60,
  memory: "256MiB",
}, async (request) => {
  try {
    return await processRateRequest(request.data);
  } catch (error) {
    throw new Error(error.message || 'Internal server error');
  }
});

/**
 * Validates the API key against stored valid keys
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<boolean>} - Whether the API key is valid
 */
async function validateApiKey(apiKey) {
  try {
    // Get configured API key from Firebase config
    const configApiKey = functions.config().eshipplus?.api_key;
    
    // For development, always accept the development API key
    if (process.env.NODE_ENV === 'development' && apiKey === 'development-api-key') {
      return true;
    }
    
    // Check if the API key matches our config
    if (configApiKey && apiKey === configApiKey) {
      return true;
    }
    
    // Check in Firestore for API key
    const db = admin.firestore();
    const apiKeysRef = db.collection('apiKeys');
    const snapshot = await apiKeysRef.where('key', '==', apiKey).where('active', '==', true).get();
    
    if (!snapshot.empty) {
      // Valid API key found in Firestore
      return true;
    }
    
    // No valid API key found
    return false;
  } catch (error) {
    logger.error('Error validating API key:', error);
    return false;
  }
}

/**
 * Build SOAP request for Rate operation
 * @param {object} shipmentData - The shipment data
 * @returns {string} - The SOAP request XML
 */
function buildRateRequest(shipmentData) {
  // Get eShipPlus credentials from environment variables first, then fall back to Firebase config
  const accessCode = process.env.ESHIPPLUS_ACCESS_CODE || functions.config().eshipplus?.access_code;
  const username = process.env.ESHIPPLUS_USERNAME || functions.config().eshipplus?.username;
  const password = process.env.ESHIPPLUS_PASSWORD || functions.config().eshipplus?.password;
  const accessKey = process.env.ESHIPPLUS_ACCESS_KEY || functions.config().eshipplus?.access_key;
  
  return `<?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                 xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
      <AuthenticationToken xmlns="http://www.eshipplus.com/">
    <AccessCode>${accessCode}</AccessCode>
    <Username>${username}</Username>
    <Password>${password}</Password>
    <AccessKey>${accessKey}</AccessKey>
      </AuthenticationToken>
    </soap:Header>
    <soap:Body>
      <Rate xmlns="http://www.eshipplus.com/">
        <shipment>
      <BookingReferenceNumber>${shipmentData.bookingReferenceNumber}</BookingReferenceNumber>
      <BookingReferenceNumberType>Shipment</BookingReferenceNumberType>
      <ShipmentBillType>DefaultLogisticsPlus</ShipmentBillType>
      <ShipmentDate>${shipmentData.shipmentDate}</ShipmentDate>
          <EarliestPickup>
        <Time>${shipmentData.pickupWindow.earliest}</Time>
          </EarliestPickup>
          <LatestPickup>
        <Time>${shipmentData.pickupWindow.latest}</Time>
          </LatestPickup>
          <EarliestDelivery>
        <Time>${shipmentData.deliveryWindow.earliest}</Time>
          </EarliestDelivery>
          <LatestDelivery>
        <Time>${shipmentData.deliveryWindow.latest}</Time>
          </LatestDelivery>

      <!-- Origin -->
      <Origin>
        <Description>${shipmentData.fromAddress.company}</Description>
        <Street>${shipmentData.fromAddress.street}</Street>
        <StreetExtra>${shipmentData.fromAddress.street2 || ''}</StreetExtra>
        <PostalCode>${shipmentData.fromAddress.postalCode}</PostalCode>
        <City>${shipmentData.fromAddress.city}</City>
        <State>${shipmentData.fromAddress.state}</State>
        <Country>
          <Code>${shipmentData.fromAddress.country}</Code>
        </Country>
        <Contact>${shipmentData.fromAddress.contactName}</Contact>
        <Phone>${shipmentData.fromAddress.contactPhone}</Phone>
        <Email>${shipmentData.fromAddress.contactEmail}</Email>
        <SpecialInstructions>${shipmentData.fromAddress.specialInstructions}</SpecialInstructions>
      </Origin>

      <!-- Destination -->
      <Destination>
        <Description>${shipmentData.toAddress.company}</Description>
        <Street>${shipmentData.toAddress.street}</Street>
        <StreetExtra>${shipmentData.toAddress.street2 || ''}</StreetExtra>
        <PostalCode>${shipmentData.toAddress.postalCode}</PostalCode>
        <City>${shipmentData.toAddress.city}</City>
        <State>${shipmentData.toAddress.state}</State>
        <Country>
          <Code>${shipmentData.toAddress.country}</Code>
        </Country>
        <Contact>${shipmentData.toAddress.contactName}</Contact>
        <Phone>${shipmentData.toAddress.contactPhone}</Phone>
        <Email>${shipmentData.toAddress.contactEmail}</Email>
        <SpecialInstructions>${shipmentData.toAddress.specialInstructions}</SpecialInstructions>
      </Destination>

      <!-- Items / Packages -->
          <Items>
        ${shipmentData.items.map(item => `
            <WSItem2>
          <Description>${item.name}</Description>
              <Weight>${typeof item.weight === 'number' ? item.weight.toFixed(2) : parseFloat(item.weight).toFixed(2)}</Weight>
          <PackagingQuantity>${item.quantity}</PackagingQuantity>
              <Height>${item.height}</Height>
              <Width>${item.width}</Width>
              <Length>${item.length}</Length>
              <FreightClass>
                <FreightClass>${item.freightClass}</FreightClass>
              </FreightClass>
          <DeclaredValue>${typeof item.value === 'number' ? item.value.toFixed(2) : parseFloat(item.value).toFixed(2)}</DeclaredValue>
          <Stackable>${item.stackable}</Stackable>
        </WSItem2>`).join('\n')}
          </Items>

      <DeclineAdditionalInsuranceIfApplicable>false</DeclineAdditionalInsuranceIfApplicable>
      <HazardousMaterialShipment>false</HazardousMaterialShipment>
        </shipment>
      </Rate>
    </soap:Body>
  </soap:Envelope>`;
}

/**
 * Validates the rate request data
 * @param {object} data - The rate request data
 * @returns {string|null} - Validation error message or null if valid
 */
function validateRateRequest(data) {
  // Check for required fields
  if (!data) {
    return 'Request body is required';
  }

  // Validate required fields
  const requiredFields = [
    'bookingReferenceNumber',
    'bookingReferenceNumberType',
    'shipmentBillType',
    'shipmentDate',
    'pickupWindow',
    'deliveryWindow',
    'fromAddress',
    'toAddress',
    'items'
  ];

  for (const field of requiredFields) {
    if (!data[field]) {
      return `Missing required field: ${field}`;
    }
  }

  // Validate pickup and delivery windows
  if (!data.pickupWindow.earliest || !data.pickupWindow.latest) {
    return 'Pickup window must include earliest and latest times';
  }

  if (!data.deliveryWindow.earliest || !data.deliveryWindow.latest) {
    return 'Delivery window must include earliest and latest times';
  }

  // Validate addresses
  const fromAddress = data.fromAddress;
  if (!fromAddress.postalCode || fromAddress.postalCode.trim() === '') {
    return 'Origin postal code is required';
  }
  
  if (!fromAddress.contactName || fromAddress.contactName.trim() === '') {
    return 'Origin contact name is required';
  }

  const toAddress = data.toAddress;
  if (!toAddress.postalCode || toAddress.postalCode.trim() === '') {
    return 'Destination postal code is required';
  }
  
  if (!toAddress.contactName || toAddress.contactName.trim() === '') {
    return 'Destination contact name is required';
  }

  // Validate items/packages
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return 'At least one package/item is required';
  }

  // Each item should have weight, dimensions
  for (const [index, item] of data.items.entries()) {
    if (!item.weight || isNaN(parseFloat(item.weight))) {
      return `Invalid weight for package ${index + 1}`;
    }
    
    if (!item.length || !item.width || !item.height || 
        isNaN(parseInt(item.length)) || isNaN(parseInt(item.width)) || isNaN(parseInt(item.height))) {
      return `Invalid dimensions for package ${index + 1}`;
    }
  }

  return null;
} 