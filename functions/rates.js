const functions = require('firebase-functions');
const { makeSoapRequest } = require('./utils/soap');
const { validateAddress, validateDimensions } = require('./utils/validation');
const config = require('./config/config');

/**
 * Gets shipping rates for a package using EShipPlus API
 */
exports.getShippingRates = functions.https.onCall(async (data, context) => {
    try {
        // Validate input data
        validateAddress(data.fromAddress);
        validateAddress(data.toAddress);
        validateDimensions(data.package);

        // Build SOAP request body
        const requestBody = `
            <AccessCode>${config.eshipplus.access_code}</AccessCode>
            <Username>${config.eshipplus.username}</Username>
            <Password>${config.eshipplus.password}</Password>
            <AccessKey>${config.eshipplus.access_key}</AccessKey>
            <FromAddress>
                <Street1>${data.fromAddress.street1}</Street1>
                <City>${data.fromAddress.city}</City>
                <State>${data.fromAddress.state}</State>
                <PostalCode>${data.fromAddress.postalCode}</PostalCode>
                <Country>${data.fromAddress.country}</Country>
            </FromAddress>
            <ToAddress>
                <Street1>${data.toAddress.street1}</Street1>
                <City>${data.toAddress.city}</City>
                <State>${data.toAddress.state}</State>
                <PostalCode>${data.toAddress.postalCode}</PostalCode>
                <Country>${data.toAddress.country}</Country>
            </ToAddress>
            <Package>
                <Length>${data.package.length}</Length>
                <Width>${data.package.width}</Width>
                <Height>${data.package.height}</Height>
                <Weight>${data.package.weight}</Weight>
            </Package>
            <Services>${data.services ? data.services.join(',') : ''}</Services>`;

        const response = await makeSoapRequest('GetShippingRates', requestBody);
        return response;
    } catch (error) {
        console.error('Get Shipping Rates Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
}); 