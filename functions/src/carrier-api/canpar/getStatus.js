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
        
        // Construct the API URL
        const baseUrl = credentials.hostURL || 'https://ws.canpar.com';
        const endpoint = credentials.endpoints?.tracking || '/CanparAddonsService/trackByBarcode';
        const url = `${baseUrl}${endpoint}`;

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
        const trackingData = extractCanparTrackingData(xmlData);
        
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
    return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ws="http://ws.canparaddons.canpar.com"
                  xmlns:xsd="http://dto.canparaddons.canpar.com/xsd">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:trackByBarcode>
      <ws:request>
        <xsd:user_id>${credentials.username || credentials.userId}</xsd:user_id>
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
        const envelope = xmlData['soapenv:Envelope'] || xmlData.Envelope;
        const body = envelope['soapenv:Body'][0] || envelope.Body[0];
        const response = body['ns:trackByBarcodeResponse'][0] || body.trackByBarcodeResponse[0];
        const returnData = response['ns:return'][0] || response.return[0];
        
        // Check for error
        const error = returnData['ax21:error'] && returnData['ax21:error'][0];
        if (error && error._ && error._ !== 'nil') {
            return { error: error._ };
        }

        const result = returnData['ax21:result'][0];
        
        return {
            barcode: getXmlValue(result, 'ax23:barcode'),
            delivered: getXmlValue(result, 'ax23:delivered') === 'true',
            estimatedDeliveryDate: getXmlValue(result, 'ax23:estimated_delivery_date'),
            referenceNum: getXmlValue(result, 'ax23:reference_num'),
            serviceDescriptionEn: getXmlValue(result, 'ax23:service_description_en'),
            serviceDescriptionFr: getXmlValue(result, 'ax23:service_description_fr'),
            shippingDate: getXmlValue(result, 'ax23:shipping_date'),
            signature: getXmlValue(result, 'ax23:signature'),
            signatureUrl: getXmlValue(result, 'ax23:signature_url'),
            signedBy: getXmlValue(result, 'ax23:signed_by'),
            trackingUrlEn: getXmlValue(result, 'ax23:tracking_url_en'),
            trackingUrlFr: getXmlValue(result, 'ax23:tracking_url_fr'),
            consigneeAddress: getXmlValue(result, 'ax23:consignee_address')
        };
        
    } catch (error) {
        logger.error('Error extracting Canpar tracking data:', error);
        return { error: 'Failed to parse tracking response' };
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