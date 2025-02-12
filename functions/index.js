const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const cors = require("cors");
const axios = require("axios");
const { parseStringPromise } = require("xml2js");

// Import credentials from config.js
const config = require("./config");

// Enable CORS for frontend
const corsMiddleware = cors({ origin: "https://solushipx.web.app" });

const ESHIPPLUS_URL = "http://www.eshipplus.com/services/eShipPlusWSv4.asmx"; // Replace if needed

exports.getShippingRates = onRequest(async (req, res) => {
    corsMiddleware(req, res, async () => {
        logger.info("🚀 Sending rate lookup request to eShipPlus...");

        // Construct the SOAP request exactly as provided
        const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                       xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                       xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Header>
            <AuthenticationToken xmlns="http://www.eshipplus.com/">
              <AccessCode>${config.eshipplus.access_code}</AccessCode>
              <Username>${config.eshipplus.username}</Username>
              <Password>${config.eshipplus.password}</Password>
              <AccessKey>${config.eshipplus.access_key}</AccessKey>
            </AuthenticationToken>
          </soap:Header>
          <soap:Body>
            <Rate xmlns="http://www.eshipplus.com/">
              <shipment>
                <Origin>
                  <PostalCode>53151</PostalCode>
                  <City>New Berlin</City>
                  <State>WI</State>
                  <Country>
                    <Code>US</Code>
                    <UsesPostalCode>true</UsesPostalCode>
                  </Country>
                </Origin>
                <Destination>
                  <Description>Unabridged Bookstore</Description>
                  <Street></Street>
                  <PostalCode>L4W 1N7</PostalCode>
                  <City>Mississauga</City>
                  <State>ON</State>
                  <Country>
                    <Code>CA</Code>
                    <UsesPostalCode>true</UsesPostalCode>
                  </Country>
                  <Contact>Harikrishnan</Contact>
                  <Phone>9789891402</Phone>
                </Destination>
                <EarliestPickup><Time>05:00</Time></EarliestPickup>
                <LatestPickup><Time>17:00</Time></LatestPickup>
                <EarliestDelivery><Time>09:30</Time></EarliestDelivery>
                <LatestDelivery><Time>17:30</Time></LatestDelivery>
                <Items>
                  <WSItem2>
                    <Weight>386.00</Weight>
                    <PackagingQuantity>1</PackagingQuantity>
                    <Height>10</Height>
                    <Width>10</Width>
                    <Length>10</Length>
                    <Packaging><Key>242</Key></Packaging>
                    <FreightClass><FreightClass>50</FreightClass></FreightClass>
                  </WSItem2>
                </Items>
                <DeclineAdditionalInsuranceIfApplicable>false</DeclineAdditionalInsuranceIfApplicable>
                <HazardousMaterialShipment>false</HazardousMaterialShipment>
              </shipment>
            </Rate>
          </soap:Body>
        </soap:Envelope>`;

        const headers = {
            "Content-Type": "text/xml",
            "SOAPAction": "http://www.eshipplus.com/Rate", // This might be required based on WSDL
        };

        try {
            logger.info("📡 Sending SOAP request...");
            const response = await axios.post(ESHIPPLUS_URL, soapRequest, { headers });

            // Convert XML response to JSON
            const jsonResponse = await parseStringPromise(response.data);

            logger.info("✅ Received rates from eShipPlus", jsonResponse);

            // Extract relevant rate details
            res.json({
                success: true,
                rates: jsonResponse
            });
        } catch (error) {
            logger.error("❌ Error fetching rates:", error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    });
});
