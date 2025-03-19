const axios = require('axios');
const config = require('../config/config');

/**
 * Builds a SOAP request envelope for EShipPlus API calls
 * @param {string} method - The SOAP method to call
 * @param {Object} body - The request body
 * @returns {string} The complete SOAP envelope
 */
function buildSoapEnvelope(method, body) {
    return `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                      xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                      xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
                <${method} xmlns="http://www.eshipplus.com/">
                    ${body}
                </${method}>
            </soap:Body>
        </soap:Envelope>`;
}

/**
 * Makes a SOAP request to the EShipPlus API
 * @param {string} method - The SOAP method to call
 * @param {string} body - The request body XML
 * @returns {Promise<Object>} The response data
 */
async function makeSoapRequest(method, body) {
    const envelope = buildSoapEnvelope(method, body);
    
    try {
        const response = await axios({
            method: 'post',
            url: config.eshipplus.url,
            headers: {
                'Content-Type': 'text/xml',
                'SOAPAction': `http://www.eshipplus.com/${method}`
            },
            data: envelope
        });

        return response.data;
    } catch (error) {
        console.error('SOAP Request Error:', error);
        throw new Error(`Failed to make SOAP request: ${error.message}`);
    }
}

module.exports = {
    buildSoapEnvelope,
    makeSoapRequest
}; 