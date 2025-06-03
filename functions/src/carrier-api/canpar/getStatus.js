const axios = require('axios');
const logger = require('firebase-functions/logger');
const { parseStringPromise } = require('xml2js');

/**
 * Canpar Status Mapping - based on delivered flag and other indicators
 * Since Canpar doesn't provide detailed status codes, we infer from available data
 */
const CANPAR_STATUS_MAP = {
    // Will be determined based on response fields
    'shipped': 'in_transit',
    'delivered': 'delivered',
    'pending': 'scheduled'
};

/**
 * Get shipment status from Canpar
 * @param {string} barcode - The Canpar barcode/tracking number
 * @param {Object} credentials - Canpar API credentials
 * @returns {Promise<Object>} - Formatted status response
 */
async function getCanparStatus(barcode, credentials) {
    try {
        logger.info(`Getting Canpar status for barcode: ${barcode}`);

        // Construct the SOAP envelope
        const soapEnvelope = buildCanparSoapRequest(barcode, credentials);
        
        // Use the dynamic URL from carrier configuration
        const baseUrl = credentials.hostURL;
        const endpoint = credentials.endpoints?.tracking;
        
        // Ensure proper URL construction
        if (!baseUrl) {
            throw new Error('Canpar hostURL not configured in carrier settings');
        }
        
        if (!endpoint) {
            throw new Error('Canpar tracking endpoint not configured in carrier settings');
        }
        
        // Remove trailing slash from baseUrl if present
        let url = baseUrl;
        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }
        
        // Add leading slash to endpoint if not present
        if (!endpoint.startsWith('/')) {
            url += '/';
        }
        
        url += endpoint;
        
        logger.info(`Making Canpar tracking request to: ${url}`);

        // Make the SOAP API call
        const response = await axios.post(url, soapEnvelope, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'trackByBarcode'
            },
            timeout: 30000 // 30 second timeout
        });

        logger.info(`Canpar status response received for barcode: ${barcode}`);

        // Parse XML response
        const xmlData = await parseStringPromise(response.data);
        
        // Log the raw XML response for debugging
        logger.info('Raw Canpar XML response:', JSON.stringify(response.data).substring(0, 1000));
        logger.info('Parsed XML structure:', JSON.stringify(xmlData).substring(0, 2000));
        
        const trackingData = extractCanparTrackingData(xmlData);
        
        // Log extracted data
        logger.info('Extracted tracking data:', trackingData);
        
        // Check for errors
        if (trackingData.error) {
            throw new Error(`Canpar API Error: ${trackingData.error}`);
        }

        // Map to universal format
        const universalStatus = mapCanparStatusToUniversal(trackingData);
        
        logger.info(`Mapped Canpar status to universal format:`, { universalStatus });
        return universalStatus;

    } catch (error) {
        logger.error(`Error getting Canpar status for ${barcode}:`, error);
        
        if (error.response) {
            logger.error(`Canpar API Response Error:`, {
                status: error.response.status,
                data: error.response.data
            });
        }
        
        throw new Error(`Failed to get Canpar status: ${error.message}`);
    }
}

/**
 * Build SOAP request envelope for Canpar trackByBarcode
 * @param {string} barcode - The barcode to track
 * @param {Object} credentials - API credentials
 * @returns {string} - SOAP XML envelope
 */
function buildCanparSoapRequest(barcode, credentials) {
    // Use uppercase for user_id if it's an email
    const userId = (credentials.username || credentials.userId || '').toUpperCase();
    
    return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ws="http://ws.canparaddons.canpar.com"
                  xmlns:xsd="http://dto.canparaddons.canpar.com/xsd">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:trackByBarcode>
      <ws:request>
        <xsd:user_id>${userId}</xsd:user_id>
        <xsd:password>${credentials.password}</xsd:password>
        <xsd:barcode>${barcode}</xsd:barcode>
      </ws:request>
    </ws:trackByBarcode>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Extract tracking data from Canpar XML response
 * @param {Object} xmlData - Parsed XML data
 * @returns {Object} - Extracted tracking data
 */
function extractCanparTrackingData(xmlData) {
    try {
        // Handle different envelope namespace variations
        const envelope = xmlData['soapenv:Envelope'] || xmlData['soap:Envelope'] || xmlData.Envelope;
        if (!envelope) {
            logger.error('No SOAP envelope found in response');
            return { error: 'Invalid SOAP response structure' };
        }
        
        // Get body - handle array or object
        const bodyWrapper = envelope['soapenv:Body'] || envelope['soap:Body'] || envelope.Body;
        const body = Array.isArray(bodyWrapper) ? bodyWrapper[0] : bodyWrapper;
        if (!body) {
            logger.error('No SOAP body found in response');
            return { error: 'Invalid SOAP body structure' };
        }
        
        // Log body structure for debugging
        logger.info('SOAP Body structure:', JSON.stringify(body).substring(0, 1000));
        
        // Find the trackByBarcodeResponse - try different namespace variations
        const responseWrapper = body['ns:trackByBarcodeResponse'] || 
                               body['trackByBarcodeResponse'] ||
                               body['ns2:trackByBarcodeResponse'] ||
                               Object.values(body).find(val => {
                                   const key = Object.keys(body).find(k => k.includes('trackByBarcodeResponse'));
                                   return key ? body[key] : null;
                               });
        
        const response = Array.isArray(responseWrapper) ? responseWrapper[0] : responseWrapper;
        if (!response) {
            logger.error('No trackByBarcodeResponse found in body');
            return { error: 'No tracking response found' };
        }
        
        // Get return data - try different namespace variations
        const returnWrapper = response['ns:return'] || 
                             response['return'] ||
                             response['ns2:return'] ||
                             Object.values(response).find(val => {
                                 const key = Object.keys(response).find(k => k.includes('return'));
                                 return key ? response[key] : null;
                             });
        
        const returnData = Array.isArray(returnWrapper) ? returnWrapper[0] : returnWrapper;
        if (!returnData) {
            logger.error('No return data found in response');
            return { error: 'No return data in tracking response' };
        }
        
        // Check for error - try different namespace variations
        const errorKey = Object.keys(returnData).find(k => k.includes('error'));
        const error = errorKey ? returnData[errorKey] : null;
        if (error) {
            const errorValue = Array.isArray(error) ? error[0] : error;
            if (errorValue && errorValue._ && errorValue._ !== 'nil') {
                return { error: errorValue._ };
        }
        }

        // Get result - try different namespace variations
        const resultKey = Object.keys(returnData).find(k => k.includes('result'));
        const resultWrapper = resultKey ? returnData[resultKey] : null;
        const result = Array.isArray(resultWrapper) ? resultWrapper[0] : resultWrapper;
        
        if (!result) {
            logger.error('No result found in return data');
            return { error: 'No result in tracking response' };
        }
        
        // Log result structure
        logger.info('Result structure:', JSON.stringify(result).substring(0, 1000));
        
        // Extract fields with flexible namespace handling
        const extractField = (fieldName) => {
            const key = Object.keys(result).find(k => k.includes(fieldName));
            return key ? getXmlValue(result, key) : null;
        };
        
        return {
            barcode: extractField('barcode'),
            delivered: extractField('delivered') === 'true',
            estimatedDeliveryDate: extractField('estimated_delivery_date'),
            referenceNum: extractField('reference_num'),
            serviceDescriptionEn: extractField('service_description_en'),
            serviceDescriptionFr: extractField('service_description_fr'),
            shippingDate: extractField('shipping_date'),
            signature: extractField('signature'),
            signatureUrl: extractField('signature_url'),
            signedBy: extractField('signed_by'),
            trackingUrlEn: extractField('tracking_url_en'),
            trackingUrlFr: extractField('tracking_url_fr'),
            consigneeAddress: extractField('consignee_address')
        };
        
    } catch (error) {
        logger.error('Error extracting Canpar tracking data:', error);
        logger.error('Error stack:', error.stack);
        return { error: 'Failed to parse tracking response: ' + error.message };
    }
}

/**
 * Helper function to safely extract XML values
 * @param {Object} obj - XML object
 * @param {string} key - Key to extract
 * @returns {string|null} - Extracted value or null
 */
function getXmlValue(obj, key) {
    if (!obj || !obj[key] || !obj[key][0]) return null;
    
    const value = obj[key][0];
    
    // Check if it's marked as nil
    if (value.$ && value.$['xsi:nil'] === 'true') return null;
    
    // Return the text content
    return typeof value === 'string' ? value : (value._ || value);
}

/**
 * Map Canpar status response to universal format
 * @param {Object} canparData - Canpar tracking response
 * @returns {Object} - Universal status format
 */
function mapCanparStatusToUniversal(canparData) {
    // Determine status based on available information
    let universalStatus = 'unknown';
    let statusSource = 'default';

    if (canparData.delivered === true) {
        universalStatus = 'delivered';
        statusSource = 'delivered_flag';
    } else if (canparData.shippingDate) {
        universalStatus = 'in_transit';
        statusSource = 'shipping_date';
    } else if (canparData.barcode) {
        universalStatus = 'scheduled';
        statusSource = 'barcode_exists';
    }

    // Prepare tracking events
    const trackingEvents = [];
    
    if (canparData.shippingDate) {
        trackingEvents.push({
            date: canparData.shippingDate,
            location: '',
            description: 'Shipment picked up by Canpar',
            statusCode: 'PICKUP',
            carrierCode: 'PICKUP'
        });
    }
    
    if (canparData.delivered) {
        trackingEvents.push({
            date: new Date().toISOString(), // Canpar doesn't provide delivery timestamp
            location: canparData.consigneeAddress || '',
            description: canparData.signedBy ? `Delivered - Signed by: ${canparData.signedBy}` : 'Delivered',
            statusCode: 'DELIVERED',
            carrierCode: 'DELIVERED'
        });
    }

    // Calculate estimated delivery
    let estimatedDelivery = null;
    if (canparData.estimatedDeliveryDate) {
        estimatedDelivery = new Date(canparData.estimatedDeliveryDate).toISOString();
    }

    // Calculate actual delivery (if delivered but no specific date provided)
    let actualDelivery = null;
    if (canparData.delivered) {
        actualDelivery = new Date().toISOString(); // Use current time as fallback
    }

    return {
        success: true,
        trackingNumber: canparData.barcode,
        status: universalStatus,
        statusDisplay: getStatusDisplayName(universalStatus),
        lastUpdated: new Date().toISOString(),
        estimatedDelivery,
        actualDelivery,
        carrierInfo: {
            carrierName: 'Canpar',
            carrierCode: 'CANPAR',
            serviceType: canparData.serviceDescriptionEn || 'Standard Service',
            trackingNumber: canparData.barcode,
            trackingUrl: canparData.trackingUrlEn
        },
        shipmentDates: {
            created: null,
            estimatedPickup: null,
            actualPickup: canparData.shippingDate ? new Date(canparData.shippingDate).toISOString() : null,
            estimatedDelivery,
            actualDelivery
        },
        trackingEvents: trackingEvents.sort((a, b) => new Date(b.date) - new Date(a.date)),
        deliveryInfo: canparData.delivered ? {
            signedBy: canparData.signedBy,
            signature: canparData.signature,
            signatureUrl: canparData.signatureUrl,
            deliveryAddress: canparData.consigneeAddress
        } : null,
        rawData: {
            carrier: 'canpar',
            statusSource,
            barcode: canparData.barcode,
            delivered: canparData.delivered,
            referenceNum: canparData.referenceNum,
            trackingUrls: {
                en: canparData.trackingUrlEn,
                fr: canparData.trackingUrlFr
            }
        }
    };
}

/**
 * Get display name for universal status
 */
function getStatusDisplayName(status) {
    const displayNames = {
        'draft': 'Draft',
        'pending': 'Pending',
        'scheduled': 'Scheduled',
        'booked': 'Booked',
        'awaiting_shipment': 'Awaiting Shipment',
        'in_transit': 'In Transit',
        'delivered': 'Delivered',
        'on_hold': 'On Hold',
        'canceled': 'Canceled',
        'cancelled': 'Cancelled',
        'void': 'Void',
        'unknown': 'Unknown'
    };
    return displayNames[status?.toLowerCase()] || status || 'Unknown';
}

module.exports = {
    getCanparStatus,
    mapCanparStatusToUniversal,
    buildCanparSoapRequest,
    extractCanparTrackingData
}; 