//Includes
const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors");
const axios = require("axios");
const { parseStringPromise } = require("xml2js");

//Config Vars
const config = require("./config");
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = config.openai.api_key;
const ESHIPPLUS_URL = "http://www.eshipplus.com/services/eShipPlusWSv4.asmx";
const corsMiddleware = cors({ origin: true });

//Shipment Detail Array
const rawShipmentData = {
    shipmentInfo: {
        shipmentType: "courier",
        internationalShipment: false,
        shipperReferenceNumber: "TFM0228",
        bookingReferenceNumber: "TFM-0228",
        bookingReferenceType: "Shipment", 
        shipmentBillType: "DefaultLogisticsPlus", 
        shipmentDate: "2025-03-12T13:41:08.6590611-05:00",
        earliestPickupTime: "05:00",
        latestPickupTime: "17:00",
        earliestDeliveryTime: "09:00",
        latestDeliveryTime: "22:00",
        dangerousGoodsType: "none",
        signatureServiceType: "none",
        holdForPickup: false,
        saturdayDelivery: false,
        dutibleAmount: 0.00,
        dutibleCurrency: "CDN",
        numberOfPackages: 1,
    },
    origin: { 
        company: "Tyger Shark Inc.",
        attentionName: "Tyler Murray",
        street: "123 Main Street",
        street2: "Unit A",
        postalCode: "53151",
        city: "New Berlin",
        state: "WI",
        country: "US",
        contactName: "Tyler Murray",
        contactPhone: "647-262-1493",
        contactEmail: "tyler@tygershark.com",
        contactFax: "647-262-1493",
        specialInstructions: "Pickup at Bay 1" 
    },
    destination: {
        company: "Fantom Inc.",
        attentionName: "Tyler Murray",
        street: "321 King Street",
        street2: "Unit B",
        postalCode: "L4W 1N7",
        city: "Mississauga",
        state: "ON",
        country: "CA",
        contactName: "Tyler Murray",
        contactPhone: "647-262-1493",
        contactEmail: "tyler@tygershark.com",
        contactFax: "647-262-1493",
        specialInstructions: "Deliver to Bay 3"
    },
    items: [
        { 
            itemDescription: "metal shavings",
            packagingType: 258,
            packagingQuantity: 1,
            stackable: true,
            weight: 100.00,
            height: 10,
            width: 10,
            length: 10,
            freightClass: 50,
            declaredValue: 0.00
        },
        { 
            itemDescription: "steel rods",
            packagingType: 258,
            packagingQuantity: 1,
            stackable: true,
            weight: 250.00,
            height: 15,
            width: 15,
            length: 50,
            freightClass: 70,
            declaredValue: 0.00
        },
        { 
            itemDescription: "industrial bolts",
            packagingType: 258,
            packagingQuantity: 1,
            stackable: true,
            weight: 50.00,
            height: 5,
            width: 5,
            length: 5,
            freightClass: 60,
            declaredValue: 0.00
        }
    ]
};

// EShipPlus SOAP Request Builder
function buildSOAPRequest(shipmentData = rawShipmentData) {
    if (!shipmentData.items || !Array.isArray(shipmentData.items) || shipmentData.items.length === 0) {
        throw new Error("Invalid shipment data: 'items' must be a non-empty array.");
    }

    // Helper function to safely escape XML characters
    function escapeXML(str) {
        if (typeof str !== "string") return str;
        return str.replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/"/g, "&quot;")
                  .replace(/'/g, "&apos;");
    }

    return `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                   xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                   xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Header>
        <AuthenticationToken xmlns="http://www.eshipplus.com/">
          <AccessCode>${escapeXML(config.eshipplus.access_code)}</AccessCode>
          <Username>${escapeXML(config.eshipplus.username)}</Username>
          <Password>${escapeXML(config.eshipplus.password)}</Password>
          <AccessKey>${escapeXML(config.eshipplus.access_key)}</AccessKey>
        </AuthenticationToken>
      </soap:Header>
      <soap:Body>
        <Rate xmlns="http://www.eshipplus.com/">
          <shipment>
            <ReferenceNumber>${escapeXML(shipmentData.shipmentInfo.shipperReferenceNumber)}</ReferenceNumber>
            <BookingReferenceNumber>${escapeXML(shipmentData.shipmentInfo.bookingReferenceNumber)}</BookingReferenceNumber>
            <BookingReferenceNumberType>${escapeXML(shipmentData.shipmentInfo.bookingReferenceType)}</BookingReferenceNumberType>
            <ShipmentBillType>${escapeXML(shipmentData.shipmentInfo.shipmentBillType)}</ShipmentBillType>
            <ShipmentType>${escapeXML(shipmentData.shipmentInfo.shipmentType)}</ShipmentType>
            <Origin>
              <Description>${escapeXML(shipmentData.origin.company)}</Description>
              <Street>${escapeXML(shipmentData.origin.street)}</Street>
              <StreetExtra>${escapeXML(shipmentData.origin.street2 || "")}</StreetExtra>
              <PostalCode>${escapeXML(shipmentData.origin.postalCode)}</PostalCode>
              <City>${escapeXML(shipmentData.origin.city)}</City>
              <State>${escapeXML(shipmentData.origin.state)}</State>
              <Country>
                <Code>${escapeXML(shipmentData.origin.country)}</Code>
              </Country>
              <Contact>${escapeXML(shipmentData.origin.contactName)}</Contact>
              <Phone>${escapeXML(shipmentData.origin.contactPhone)}</Phone>
              <Email>${escapeXML(shipmentData.origin.contactEmail)}</Email>
              <Fax>${escapeXML(shipmentData.origin.contactFax)}</Fax>
              <SpecialInstructions>${escapeXML(shipmentData.origin.specialInstructions)}</SpecialInstructions>
            </Origin>

            <Destination>
              <Description>${escapeXML(shipmentData.destination.company)}</Description>
              <Street>${escapeXML(shipmentData.destination.street)}</Street>
              <StreetExtra>${escapeXML(shipmentData.destination.street2 || "")}</StreetExtra>
              <PostalCode>${escapeXML(shipmentData.destination.postalCode)}</PostalCode>
              <City>${escapeXML(shipmentData.destination.city)}</City>
              <State>${escapeXML(shipmentData.destination.state)}</State>
              <Country>
                <Code>${escapeXML(shipmentData.destination.country)}</Code>
              </Country>
              <Contact>${escapeXML(shipmentData.destination.contactName)}</Contact>
              <Phone>${escapeXML(shipmentData.destination.contactPhone)}</Phone>
              <Email>${escapeXML(shipmentData.destination.contactEmail)}</Email>
              <Fax>${escapeXML(shipmentData.destination.contactFax)}</Fax>
              <SpecialInstructions>${escapeXML(shipmentData.destination.specialInstructions)}</SpecialInstructions>
            </Destination>

            <ShipmentDate>${escapeXML(shipmentData.shipmentInfo.shipmentDate)}</ShipmentDate>
            <EarliestPickup>
              <Time>${escapeXML(shipmentData.shipmentInfo.earliestPickupTime)}</Time>
            </EarliestPickup>
            <LatestPickup>
              <Time>${escapeXML(shipmentData.shipmentInfo.latestPickupTime)}</Time>
            </LatestPickup>
            <EarliestDelivery>
              <Time>${escapeXML(shipmentData.shipmentInfo.earliestDeliveryTime)}</Time>
            </EarliestDelivery>
            <LatestDelivery>
              <Time>${escapeXML(shipmentData.shipmentInfo.latestDeliveryTime)}</Time>
            </LatestDelivery>

            <Items>
              ${shipmentData.items.map((item, index) => `
              <WSItem2>
                <ItemNumber>${index + 1}</ItemNumber>
                <Description>${escapeXML(item.itemDescription)}</Description>
                <PackagingType>${item.packagingType}</PackagingType>
                <PackagingQuantity>${item.packagingQuantity}</PackagingQuantity>
                <Stackable>${item.stackable}</Stackable>
                <Weight>${item.weight.toFixed(2)}</Weight>
                <Height>${item.height}</Height>
                <Width>${item.width}</Width>
                <Length>${item.length}</Length>
                <FreightClass>
                  <FreightClass>${item.freightClass}</FreightClass>
                </FreightClass>
                <DeclaredValue>${item.declaredValue.toFixed(2)}</DeclaredValue>
              </WSItem2>`).join("\n")}
            </Items>

          </shipment>
        </Rate>
      </soap:Body>
    </soap:Envelope>`;
}

// Get Shipping Rates
exports.getShippingRates = onRequest(async (req, res) => {
    corsMiddleware(req, res, async () => {
        console.log("🚀 Requesting shipping rates...");

        const shipmentData = req.body?.shipmentData || rawShipmentData;
        const soapRequest = buildSOAPRequest(shipmentData);
        const headers = { "Content-Type": "text/xml", "SOAPAction": "http://www.eshipplus.com/Rate" };

        try {
            console.log("📡 Sending SOAP request...");
            const response = await axios.post(ESHIPPLUS_URL, soapRequest, { headers });
            const jsonResponse = await parseStringPromise(response.data);

            console.log("🛠 Rates Received:", JSON.stringify(jsonResponse, null, 2));

            res.json({ success: true, rates: jsonResponse }); // Send rates immediately

        } catch (error) {
            console.error("❌ Error fetching rates:", error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    });
});

// 🚀 AI Analysis Route
exports.analyzeRatesWithAI = onRequest(async (req, res) => {
    corsMiddleware(req, res, async () => {
        const ratesData = req.body.rates;

        if (!ratesData) {
            return res.status(400).json({ success: false, message: "No rates data provided for AI analysis." });
        }

        try {
            console.log("🤖 Sending rates to AI...");

            const payload = {
                model: "gpt-4o",
                temperature: 0.1, 
                messages: [{ role: "user", content: `Analyze these shipping rates: ${JSON.stringify(ratesData, null, 2)}` }]
            };

            const response = await axios.post(OPENAI_API_URL, payload, {
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` }
            });

            res.json({ success: true, analysis: response.data.choices[0]?.message?.content || "AI analysis failed." });

        } catch (error) {
            console.error("❌ AI Processing Error:", error.message);
            res.status(500).json({ success: false, message: "AI processing failed." });
        }
    });
});
