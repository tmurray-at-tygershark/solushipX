const functions = require('firebase-functions/v2');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { parseStringPromise } = require("xml2js");
require('dotenv').config();

// Create Express app
const app = express();

// Constants
const ESHIPPLUS_API_URL = "http://www.eshipplus.com/services/eShipPlusWSv4.asmx";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

// Middleware
app.use(cors({
    origin: ['https://solushipx.web.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Input validation
function validateShipmentData(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid shipment data format');
    }

    const requiredFields = [
        'items', 'fromAddress', 'toAddress',
        'bookingReferenceNumber', 'bookingReferenceNumberType',
        'shipmentBillType', 'shipmentDate',
        'pickupWindow', 'deliveryWindow'
    ];

    for (const field of requiredFields) {
        if (!data[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }

    // Validate pickup and delivery windows
    validateTimeWindow(data.pickupWindow, 'pickup');
    validateTimeWindow(data.deliveryWindow, 'delivery');

    // Validate items
    if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new Error('Items must be a non-empty array');
    }

    data.items.forEach((item, index) => {
        const requiredFields = [
            'name', 'quantity', 'weight', 'value',
            'length', 'width', 'height', 'freightClass',
            'stackable'
        ];
        for (const field of requiredFields) {
            if (item[field] === undefined) {
                throw new Error(`Missing required field in item ${index + 1}: ${field}`);
            }
        }

        if (typeof item.weight !== 'number' || item.weight <= 0) {
            throw new Error(`Invalid weight in item ${index + 1}: must be a positive number`);
        }

        if (typeof item.quantity !== 'number' || item.quantity <= 0) {
            throw new Error(`Invalid quantity in item ${index + 1}: must be a positive number`);
        }

        if (typeof item.value !== 'number' || item.value < 0) {
            throw new Error(`Invalid value in item ${index + 1}: must be a non-negative number`);
        }

        if (typeof item.length !== 'number' || item.length <= 0) {
            throw new Error(`Invalid length in item ${index + 1}: must be a positive number`);
        }

        if (typeof item.width !== 'number' || item.width <= 0) {
            throw new Error(`Invalid width in item ${index + 1}: must be a positive number`);
        }

        if (typeof item.height !== 'number' || item.height <= 0) {
            throw new Error(`Invalid height in item ${index + 1}: must be a positive number`);
        }

        if (typeof item.freightClass !== 'string') {
            throw new Error(`Invalid freightClass in item ${index + 1}: must be a string`);
        }

        if (typeof item.stackable !== 'boolean') {
            throw new Error(`Invalid stackable in item ${index + 1}: must be a boolean`);
        }
    });

    // Validate addresses
    validateAddress(data.fromAddress, 'origin');
    validateAddress(data.toAddress, 'destination');
}

function validateTimeWindow(window, type) {
    if (!window.earliest || !window.latest) {
        throw new Error(`Missing required time in ${type} window`);
    }
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(window.earliest)) {
        throw new Error(`Invalid earliest time format in ${type} window: ${window.earliest}`);
    }
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(window.latest)) {
        throw new Error(`Invalid latest time format in ${type} window: ${window.latest}`);
    }
}

function validateAddress(address, type) {
    const requiredFields = [
        'company', 'street', 'postalCode', 'city', 'state', 'country',
        'contactName', 'contactPhone', 'contactEmail', 'specialInstructions'
    ];

    for (const field of requiredFields) {
        if (!address[field] || typeof address[field] !== 'string') {
            throw new Error(`Missing or invalid ${field} in ${type} address`);
        }
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.contactEmail)) {
        throw new Error(`Invalid email format in ${type} address: ${address.contactEmail}`);
    }

    // Validate phone format (basic check for numbers, spaces, dashes, and parentheses)
    if (!/^[\d\s\-()]+$/.test(address.contactPhone)) {
        throw new Error(`Invalid phone format in ${type} address: ${address.contactPhone}`);
    }
}

// Build SOAP request for Rate operation
function buildRateRequest(shipmentData) {
    return `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                   xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                   xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Header>
        <AuthenticationToken xmlns="http://www.eshipplus.com/">
      <AccessCode>${process.env.ESHIPPLUS_ACCESS_CODE}</AccessCode>
      <Username>${process.env.ESHIPPLUS_USERNAME}</Username>
      <Password>${process.env.ESHIPPLUS_PASSWORD}</Password>
      <AccessKey>${process.env.ESHIPPLUS_ACCESS_KEY}</AccessKey>
        </AuthenticationToken>
      </soap:Header>
      <soap:Body>
        <Rate xmlns="http://www.eshipplus.com/">
          <shipment>
        <BookingReferenceNumber>${shipmentData.bookingReferenceNumber}</BookingReferenceNumber>
        <BookingReferenceNumberType>${shipmentData.bookingReferenceNumberType}</BookingReferenceNumberType>
        <ShipmentBillType>${shipmentData.shipmentBillType}</ShipmentBillType>
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
          <StreetExtra>${shipmentData.fromAddress.street2}</StreetExtra>
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
          <StreetExtra>${shipmentData.toAddress.street2}</StreetExtra>
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
                <Weight>${item.weight.toFixed(2)}</Weight>
            <PackagingQuantity>${item.quantity}</PackagingQuantity>
                <Height>${item.height}</Height>
                <Width>${item.width}</Width>
                <Length>${item.length}</Length>
                <FreightClass>
                  <FreightClass>${item.freightClass}</FreightClass>
                </FreightClass>
            <DeclaredValue>${item.value.toFixed(2)}</DeclaredValue>
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

// Routes
app.post("/rates", async (req, res) => {
    try {
        // Validate input
        validateShipmentData(req.body);

        // Build SOAP request
        const soapRequest = buildRateRequest(req.body);
        
        console.log('SOAP Request:', soapRequest);

        // Call eShipPlus API
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

        console.log('API Response:', response.data);

        // Parse XML response
        const result = await parseStringPromise(response.data);
        console.log('Parsed Response:', JSON.stringify(result, null, 2));

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
                carrierKey: getValue(rate, 'CarrierKey'),
                carrierName: getValue(rate, 'CarrierName'),
                carrierScac: getValue(rate, 'CarrierScac'),
                billedWeight: parseFloat(getValue(rate, 'BilledWeight', '0')),
                ratedWeight: parseFloat(getValue(rate, 'RatedWeight', '0')),
                ratedCubicFeet: parseFloat(getValue(rate, 'RatedCubicFeet', '0')),
                transitTime: parseInt(getValue(rate, 'TransitTime', '0')),
                estimatedDeliveryDate: getValue(rate, 'EstimatedDeliveryDate'),
                serviceMode: getValue(rate, 'ServiceMode'),
                freightCharges: parseFloat(getValue(rate, 'FreightCharges', '0')),
                fuelCharges: parseFloat(getValue(rate, 'FuelCharges', '0')),
                accessorialCharges: parseFloat(getValue(rate, 'AccessorialCharges', '0')),
                serviceCharges: parseFloat(getValue(rate, 'ServiceCharges', '0')),
                totalCharges: parseFloat(getValue(rate, 'TotalCharges', '0')),
                quoteId: getValue(rate, 'QuoteId'),
                quoteExpirationDateTime: getValue(rate, 'QuoteExpirationDateTime'),
                billingDetails: (rate.BillingDetails?.[0]?.WSBillingDetail || []).map(detail => ({
                    referenceNumber: getValue(detail, 'ReferenceNumber'),
                    referenceType: getValue(detail, 'ReferenceType'),
                    billingCode: getValue(detail, 'BillingCode'),
                    description: getValue(detail, 'Description'),
                    category: getValue(detail, 'Category'),
                    amountDue: parseFloat(getValue(detail, 'AmountDue', '0'))
                })),
                guarOptions: (rate.GuarOptions?.[0]?.WSBillingDetail || []).map(option => ({
                    referenceNumber: getValue(option, 'ReferenceNumber'),
                    referenceType: getValue(option, 'ReferenceType'),
                    billingCode: getValue(option, 'BillingCode'),
                    description: getValue(option, 'Description'),
                    category: getValue(option, 'Category'),
                    amountDue: parseFloat(getValue(option, 'AmountDue', '0'))
                }))
            }))
        };
        
        res.json({
            success: true,
            data: transformedRates
        });
        } catch (error) {
        console.error('Error:', error);
        res.status(400).json({
            success: false,
            error: {
                message: error.message,
                code: error.response ? "API_ERROR" : "VALIDATION_ERROR"
            }
        });
    }
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "healthy" });
});

// Endpoint to get Google Maps API key
app.get('/api/config/maps-key', (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not found in environment variables');
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }
    res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.json({ key: apiKey });
  } catch (error) {
    console.error('Error serving Google Maps API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to calculate route
app.post('/route', async (req, res) => {
    try {
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) {
            console.error('Google Maps API key not found in environment variables');
            return res.status(500).json({ error: 'Google Maps API key not configured' });
        }

        const response = await axios.post(`https://routes.googleapis.com/maps/v2/computeRoutes?key=${apiKey}`, req.body, {
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error calculating route:', error);
        res.status(500).json({ error: 'Failed to calculate route' });
    }
});

// 🚀 AI Analysis Route
exports.analyzeRatesWithAI = functions.https.onRequest({
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
    minInstances: 0,
    maxInstances: 5,
    cors: ['https://solushipx.web.app', 'http://localhost:3000']
}, async (req, res) => {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    console.log("Received request body:", JSON.stringify(req.body, null, 2));

    const ratesData = req.body.rates;

    if (!ratesData || !Array.isArray(ratesData) || ratesData.length === 0) {
        console.log("Invalid or empty rates data provided");
        return res.status(400).json({ 
            success: false, 
            message: "Invalid or empty rates data provided for AI analysis." 
        });
    }

    try {
        console.log("🤖 Sending rates to AI...");
        
        // Transform rates data into a cleaner format
        const transformedRates = ratesData.map(rate => ({
            carrier: rate.carrier,
            totalRate: rate.rate.toFixed(2),
            transitDays: rate.transitDays,
            deliveryDate: rate.deliveryDate,
            breakdown: {
                freight: rate.freightCharges.toFixed(2),
                fuel: rate.fuelCharges.toFixed(2),
                service: rate.serviceCharges.toFixed(2),
                accessorial: rate.accessorialCharges.toFixed(2)
            },
            isGuaranteed: rate.guaranteed,
            isExpress: rate.express
        }));

        // Use the OpenAI API key directly
        const apiKey = "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";

        const payload = {
            model: "gpt-4",
            temperature: 0.1,
            messages: [
                {
                    role: "system",
                    content: "You are a shipping rate analysis expert. Provide concise, formatted analysis using markdown. Focus on key metrics and recommendations."
                },
                {
                    role: "user",
                    content: `Analyze these shipping rates and provide a formatted response:

**Best Value Option:**
- Carrier & Service
- Cost & Transit Time
- Why it's the best value

**Fastest Delivery:**
- Carrier & Service
- Delivery Time
- Cost Premium

**Most Economical:**
- Carrier & Service
- Cost Savings
- Trade-offs

**Key Considerations:**
- Special Notes
- Recommendations

Rates: ${JSON.stringify(transformedRates, null, 2)}`
                }
            ]
        };

        console.log("OpenAI Request payload:", JSON.stringify(payload, null, 2));

        const response = await axios.post(OPENAI_API_URL, payload, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            }
        });

        console.log("OpenAI API Response:", JSON.stringify(response.data, null, 2));

        if (!response.data.choices || !response.data.choices[0]?.message?.content) {
            throw new Error("Invalid response format from OpenAI API");
        }

        res.json({
            success: true,
            analysis: response.data.choices[0].message.content
        });

    } catch (error) {
        console.error("❌ AI Processing Error:", error.message);
        console.error("Error details:", {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            headers: error.response?.headers
        });

        res.status(500).json({
            success: false,
            message: "AI processing failed.",
            error: error.message,
            details: error.response?.data || "No additional details available"
        });
    }
});

// Export the functions with v2 configuration
exports.getShippingRates = functions.https.onRequest({
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
    minInstances: 0,
    maxInstances: 10,
    cors: ['https://solushipx.web.app', 'http://localhost:3000']
}, app);

exports.getMapsApiKey = functions.https.onRequest({
    region: 'us-central1',
    memory: '128MiB',
    timeoutSeconds: 10,
    minInstances: 0,
    maxInstances: 5,
    cors: ['https://solushipx.web.app', 'http://localhost:3000']
}, async (req, res) => {
    try {
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) {
            console.error('Google Maps API key not found in environment variables');
            return res.status(500).json({ error: 'Google Maps API key not configured' });
        }
        res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
        res.json({ key: apiKey });
    } catch (error) {
        console.error('Error serving Google Maps API key:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
