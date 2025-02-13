const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors");
const axios = require("axios");
const { parseStringPromise } = require("xml2js");

// Import credentials from config
const config = require("./config");

// OpenAI API Key
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = config.openai.api_key; // Use OpenAI key from config

const ESHIPPLUS_URL = "http://www.eshipplus.com/services/eShipPlusWSv4.asmx"; // Adjust endpoint if needed

// Enable CORS for frontend
const corsMiddleware = cors({ origin: true });

// Default shipment data
const defaultShipmentData = {
    origin: {
        postalCode: "53151",
        city: "New Berlin",
        state: "WI",
        country: "US"
    },
    destination: {
        postalCode: "07072",
        city: "Carlstadt",
        state: "NJ",
        country: "US"
    },
    items: [
        {
            weight: 100.00,
            packagingQuantity: 1,
            height: 10,
            width: 10,
            length: 10,
            packagingKey: 242,
            freightClass: 50
        }
    ]
};

// 🛠 Function to Build a SOAP Request Dynamically
function buildSOAPRequest(shipmentData = defaultShipmentData) {
    return `<?xml version="1.0" encoding="utf-8"?>
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
              <PostalCode>${shipmentData.origin.postalCode}</PostalCode>
              <City>${shipmentData.origin.city}</City>
              <State>${shipmentData.origin.state}</State>
              <Country><Code>${shipmentData.origin.country}</Code></Country>
            </Origin>
            <Destination>
              <PostalCode>${shipmentData.destination.postalCode}</PostalCode>
              <City>${shipmentData.destination.city}</City>
              <State>${shipmentData.destination.state}</State>
              <Country><Code>${shipmentData.destination.country}</Code></Country>
            </Destination>
            <Items>
              ${shipmentData.items.map(item => `
              <WSItem2>
                <Weight>${item.weight}</Weight>
                <PackagingQuantity>${item.packagingQuantity}</PackagingQuantity>
                <Height>${item.height}</Height>
                <Width>${item.width}</Width>
                <Length>${item.length}</Length>
                <Packaging><Key>${item.packagingKey}</Key></Packaging>
                <FreightClass><FreightClass>${item.freightClass}</FreightClass></FreightClass>
              </WSItem2>`).join("\n")}
            </Items>
          </shipment>
        </Rate>
      </soap:Body>
    </soap:Envelope>`;
}

// 🚀 Cloud Function to Get Shipping Rates
exports.getShippingRates = onRequest(async (req, res) => {
    corsMiddleware(req, res, async () => {
        console.log("🚀 Requesting shipping rates from eShipPlus...");

        // Allow custom shipment data from frontend request or fallback to default
        const shipmentData = req.body?.shipmentData || defaultShipmentData;

        // Generate SOAP Request Dynamically
        const soapRequest = buildSOAPRequest(shipmentData);
        
        const headers = { "Content-Type": "text/xml", "SOAPAction": "http://www.eshipplus.com/Rate" };

        try {
            console.log("📡 Sending SOAP request...");
            const response = await axios.post(ESHIPPLUS_URL, soapRequest, { headers });
            const jsonResponse = await parseStringPromise(response.data);

            console.log("🛠 SOAP Response Structure:", JSON.stringify(jsonResponse, null, 2));

            // Analyze rates using AI
            const aiAnalysis = await analyzeRatesWithAI(jsonResponse);

            res.json({ success: true, rates: jsonResponse, aiAnalysis });
        } catch (error) {
            console.error("❌ Error fetching rates:", error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    });
});

// 🚀 Get AI Logic
async function analyzeRatesWithAI(ratesData) {
    try {
        console.log("🤖 Sending rates to AI for dynamic analysis...");

        const payload = {
            model: "gpt-4o-mini",
            temperature: 0.1, 
            top_p: 1, 
            messages: [
                { 
                    role: "system", 
                    content: `You are an expert logistics AI assistant. Your goal is to analyze the provided shipping rate response **without any fixed structure**. Extract all carrier data** options while ensuring clarity and completeness. Prioritize the best combo of PRICE + SPEED as best available option. If transit time is 0 it is an error and you can eliminate this carrier data from your output.

                    **Example Output:**
                    - 📦 **Package Details**: [Auto-Extracted]
                    - 📍 **Origin & Destination**: [Auto-Extracted]
                    - 🚚 **Carrier Options**: [Auto-Extracted]
                    - 🏆 **Best Recommendation**: [Auto-Extracted]`
                },
                { 
                    role: "user", 
                    content: `Analyze the following shipping rate response and extract only the most relevant details:

\n\n**Raw Data:**\n${JSON.stringify(ratesData, null, 2)}`
                }
            ]
        };

        const response = await axios.post(OPENAI_API_URL, payload, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            }
        });

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return response.data.choices[0].message.content;
        } else {
            return "AI analysis failed: No valid response.";
        }
    } catch (error) {
        console.error("❌ AI Processing Error:", error.message);
        return "AI processing failed.";
    }
}



