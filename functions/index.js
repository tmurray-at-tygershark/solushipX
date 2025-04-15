const functions = require('firebase-functions/v2');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { parseStringPromise } = require("xml2js");
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin SDK with service account
const admin = require('firebase-admin');
const serviceAccountPath = path.resolve(__dirname, './solushipx-firebase-adminsdk-fbsvc-d7f5dccc04.json');

// Initialize with service account file
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath)
    });
    console.log('Firebase Admin initialized with service account');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    // Fallback to default credentials if service account fails
    admin.initializeApp();
    console.log('Firebase Admin initialized with default credentials');
  }
}

// Import GenKit dependencies
const { gemini20Flash, googleAI } = require('@genkit-ai/googleai');
const { genkit } = require('genkit');

// Initialize GenKit with Gemini
// Using GEMINI_API_KEY from .env file
const ai = genkit({
  plugins: [googleAI({
    apiKey: process.env.GEMINI_API_KEY
  })],
  model: gemini20Flash,
  stream: true // Enable streaming by default
});

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

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log("Received request body:", JSON.stringify(req.body, null, 2));

    const ratesData = req.body.rates;

    if (!ratesData || !Array.isArray(ratesData) || ratesData.length === 0) {
        console.log("Invalid or empty rates data provided");
        res.write(`data: ${JSON.stringify({ 
            success: false, 
            message: "Invalid or empty rates data provided for AI analysis." 
        })}\n\n`);
        res.end();
        return;
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

        // Set up the prompt for analysis
        let systemPrompt = `You are a helpful shipping assistant for SolushipX. 
        Help users with their shipping needs by providing information about shipping options, 
        rates, and best practices.
        
        IMPORTANT INSTRUCTIONS:
        1. NEVER reintroduce yourself if the user has already started a conversation
        2. NEVER ask if they want to ship a package if they've already indicated they do
        3. NEVER repeat questions you've already asked
        4. Keep track of what information you've already collected
        5. Be concise and direct in your responses
        6. Focus on collecting ONE piece of information at a time
        7. If you have partial information, acknowledge it and ask ONLY for what's missing
        8. If the user provides information, acknowledge it and ask for the next missing piece
        9. If the user repeats information, acknowledge that you already have it and ask for the next missing piece
        10. Use AI to understand the context of the user's message and respond appropriately
        11. NEVER repeat the entire context after each piece of information
        12. If the user corrects information, acknowledge the correction and continue
        13. If the user provides multiple pieces of information, acknowledge each one separately
        14. If the user provides information in an unexpected format, ask for clarification

        HANDLING AMBIGUOUS RESPONSES:
        1. When a user expresses uncertainty (e.g., "I'm not sure", "maybe", "perhaps"):
           - Acknowledge their uncertainty
           - Provide clear, specific options
           - Include relevant context (dates, times, etc.)
           - Offer examples or suggestions
           - Ask for clarification in a supportive way

        2. For scheduling-related uncertainty:
           - Show actual dates (today, tomorrow, next week)
           - Explain the implications of each choice
           - Offer flexibility where possible
           - Provide clear next steps

        3. For address-related uncertainty:
           - Break down the address components
           - Explain what information is required
           - Offer to help with format
           - Provide examples of valid formats

        4. For package-related uncertainty:
           - Explain common package types
           - Provide measurement guidance
           - Offer to help with calculations
           - Suggest standard sizes if applicable

        RESPONSE STRUCTURE:
        1. Acknowledge the user's input or uncertainty
        2. Provide context and options
        3. Give clear, actionable next steps
        4. Include relevant suggestions or examples
        5. End with a specific question or prompt

        CONVERSATION FLOW:
        1. Maintain a natural, helpful tone
        2. Use the user's previous responses to inform next questions
        3. Adapt the level of detail based on user expertise
        4. Provide progressive guidance (start simple, add detail as needed)
        5. Keep the conversation focused on the current task`;

        // Determine the current step in the conversation
        let currentStep = 'initial';
        
        // Check if we're in the address collection phase
        if (userContext.fromAddress && !isAddressComplete(userContext.fromAddress)) {
            currentStep = 'originAddress';
        } else if (userContext.fromAddress && isAddressComplete(userContext.fromAddress) && 
                  (!userContext.toAddress || !isAddressComplete(userContext.toAddress))) {
            currentStep = 'destinationAddress';
        } else if (userContext.fromAddress && isAddressComplete(userContext.fromAddress) && 
                  userContext.toAddress && isAddressComplete(userContext.toAddress) && 
                  !userContext.packageDetails) {
            currentStep = 'packageDetails';
        } else if (userContext.fromAddress && isAddressComplete(userContext.fromAddress) && 
                  userContext.toAddress && isAddressComplete(userContext.toAddress) && 
                  userContext.packageDetails && !isShipmentSetupComplete(userContext)) {
            currentStep = 'shipmentSetup';
        } else if (isShipmentSetupComplete(userContext) && 
                  userContext.fromAddress && isAddressComplete(userContext.fromAddress) && 
                  userContext.toAddress && isAddressComplete(userContext.toAddress) && 
                  userContext.packageDetails) {
            currentStep = 'complete';
        }

        // Add step-specific instructions
        switch (currentStep) {
            case 'initial':
                systemPrompt += `\n\nCURRENT STEP: Initial greeting
                - If the user mentions shipping a package, acknowledge it and ask for the origin address
                - If the user just says hello or similar, ask what they would like to ship`;
                break;
            case 'originAddress':
                systemPrompt += `\n\nCURRENT STEP: Collecting origin address
                - Ask for the next missing piece of the origin address
                - If the user provides multiple pieces of information, acknowledge each one
                - If the user corrects information, acknowledge the correction
                - If the user provides information in an unexpected format, ask for clarification`;
                break;
            case 'destinationAddress':
                systemPrompt += `\n\nCURRENT STEP: Collecting destination address
                - Ask for the next missing piece of the destination address
                - If the user provides multiple pieces of information, acknowledge each one
                - If the user corrects information, acknowledge the correction
                - If the user provides information in an unexpected format, ask for clarification`;
                break;
            case 'packageDetails':
                systemPrompt += `\n\nCURRENT STEP: Collecting package details
                - Ask for the weight of the package
                - If the user provides the weight, ask for dimensions (length, width, height)
                - If the user provides dimensions, ask for the value of the package
                - If the user provides the value, ask for any special handling requirements`;
                break;
            case 'shipmentSetup':
                systemPrompt += `\n\nCURRENT STEP: Setting up shipment
                - Ask for the next missing piece of shipment setup information
                - If the user provides multiple pieces of information, acknowledge each one
                - If the user corrects information, acknowledge the correction
                - If the user provides information in an unexpected format, ask for clarification`;
                break;
            case 'complete':
                systemPrompt += `\n\nCURRENT STEP: Confirming shipment details
                - Summarize all collected information
                - Ask if everything is correct
                - If the user confirms, proceed to the next phase
                - If the user wants to change anything, ask what needs to be changed`;
                break;
        }

        // Create the full prompt with context and conversation history
        const fullPrompt = `${systemPrompt}\n\nUser context: ${JSON.stringify(userContext)}\n\nPrevious messages: ${JSON.stringify(previousMessages)}\n\nUser message: ${messageText}`;

        // Call GenKit with the structured prompt
        const response = await ai.generate(fullPrompt);
        
        // Extract response text
        let responseText = '';
        
        try {
            if (response && response.message && response.message.content) {
                responseText = response.message.content
                    .map(part => part.text || '')
                    .join('\n');
            } else if (typeof response === 'string') {
                responseText = response;
            } else if (response?.text) {
                responseText = response.text;
            } else if (response?.content) {
                responseText = response.content;
            } else {
                responseText = JSON.stringify(response);
            }
        } catch (error) {
            console.error('Error parsing response:', error);
            responseText = 'I apologize, but I encountered an error processing your message.';
        }

        // Extract any new information from the user's message
        const locationInfo = extractLocationInfo(messageText);

        // Update context with any new information
        if (locationInfo.city || locationInfo.state || locationInfo.country || locationInfo.postalCode || locationInfo.street) {
            // If we don't have an origin address yet, or if the user is providing origin information
            if (!userContext.fromAddress || 
                (userContext.fromAddress && 
                 (!userContext.fromAddress.city || 
                  !userContext.fromAddress.state || 
                  !userContext.fromAddress.country || 
                  !userContext.fromAddress.postalCode || 
                  !userContext.fromAddress.street))) {
                
                // Check if the user is correcting information
                if (messageText.toLowerCase().includes('street') || messageText.toLowerCase().includes('address')) {
                    userContext.fromAddress = {
                        ...userContext.fromAddress,
                        street: locationInfo.street || userContext.fromAddress?.street
                    };
                } else if (messageText.toLowerCase().includes('city')) {
                    userContext.fromAddress = {
                        ...userContext.fromAddress,
                        city: locationInfo.city || userContext.fromAddress?.city
                    };
                } else if (messageText.toLowerCase().includes('state') || messageText.toLowerCase().includes('province')) {
                    userContext.fromAddress = {
                        ...userContext.fromAddress,
                        state: locationInfo.state || userContext.fromAddress?.state
                    };
                } else if (messageText.toLowerCase().includes('country')) {
                    userContext.fromAddress = {
                        ...userContext.fromAddress,
                        country: locationInfo.country || userContext.fromAddress?.country
                    };
                } else if (messageText.toLowerCase().includes('postal') || messageText.toLowerCase().includes('zip')) {
                    userContext.fromAddress = {
                        ...userContext.fromAddress,
                        postalCode: locationInfo.postalCode || userContext.fromAddress?.postalCode
                    };
                } else {
                    // If no specific field is mentioned, update all provided fields
                    userContext.fromAddress = {
                        ...userContext.fromAddress,
                        ...locationInfo
                    };
                }
                
                // Format postal code if present
                if (userContext.fromAddress.postalCode && userContext.fromAddress.country) {
                    userContext.fromAddress.postalCode = formatPostalCode(
                        userContext.fromAddress.postalCode, 
                        userContext.fromAddress.country
                    );
                }
            } 
            // If we have a complete origin address but no destination address yet
            else if (isAddressComplete(userContext.fromAddress) && 
                    (!userContext.toAddress || 
                     (userContext.toAddress && 
                      (!userContext.toAddress.city || 
                       !userContext.toAddress.state || 
                       !userContext.toAddress.country || 
                       !userContext.toAddress.postalCode || 
                       !userContext.toAddress.street)))) {
                
                // Check if the user is correcting information
                if (messageText.toLowerCase().includes('street') || messageText.toLowerCase().includes('address')) {
                    userContext.toAddress = {
                        ...userContext.toAddress,
                        street: locationInfo.street || userContext.toAddress?.street
                    };
                } else if (messageText.toLowerCase().includes('city')) {
                    userContext.toAddress = {
                        ...userContext.toAddress,
                        city: locationInfo.city || userContext.toAddress?.city
                    };
                } else if (messageText.toLowerCase().includes('state') || messageText.toLowerCase().includes('province')) {
                    userContext.toAddress = {
                        ...userContext.toAddress,
                        state: locationInfo.state || userContext.toAddress?.state
                    };
                } else if (messageText.toLowerCase().includes('country')) {
                    userContext.toAddress = {
                        ...userContext.toAddress,
                        country: locationInfo.country || userContext.toAddress?.country
                    };
                } else if (messageText.toLowerCase().includes('postal') || messageText.toLowerCase().includes('zip')) {
                    userContext.toAddress = {
                        ...userContext.toAddress,
                        postalCode: locationInfo.postalCode || userContext.toAddress?.postalCode
                    };
                } else {
                    // If no specific field is mentioned, update all provided fields
                    userContext.toAddress = {
                        ...userContext.toAddress,
                        ...locationInfo
                    };
                }
                
                // Format postal code if present
                if (userContext.toAddress.postalCode && userContext.toAddress.country) {
                    userContext.toAddress.postalCode = formatPostalCode(
                        userContext.toAddress.postalCode, 
                        userContext.toAddress.country
                    );
                }
            }
        }

        // Extract package details
        if (messageText.toLowerCase().includes('weight') || messageText.toLowerCase().includes('lbs') || messageText.toLowerCase().includes('kg')) {
            const weightMatch = messageText.match(/(\d+(?:\.\d+)?)\s*(lbs|kg|pounds|kilograms)/i);
            if (weightMatch && validateWeight(weightMatch[0])) {
                userContext.packageDetails = {
                    ...userContext.packageDetails,
                    weight: formatWeight(weightMatch[0])
                };
            }
        }

        // Extract and update shipment setup information
        if (messageText.toLowerCase().includes('reference') || messageText.toLowerCase().includes('shipment') || messageText.toLowerCase().includes('order')) {
            const referenceMatch = messageText.match(/(?:reference|shipment|order)\s+(?:number|name|id)?\s*[:#]?\s*([^\s,]+)/i);
            if (referenceMatch && !userContext.bookingReference) {
                userContext.bookingReference = referenceMatch[1].trim();
            }
        }

        if (messageText.toLowerCase().includes('type') || messageText.toLowerCase().includes('kind')) {
            const typeMatch = messageText.match(/(?:type|kind)\s+(?:is|of)?\s*[:#]?\s*([^\s,]+)/i);
            if (typeMatch && !userContext.bookingReferenceType) {
                userContext.bookingReferenceType = typeMatch[1].trim();
            }
        }

        if (messageText.toLowerCase().includes('bill') || messageText.toLowerCase().includes('payment')) {
            const billMatch = messageText.match(/(?:bill|payment)\s+(?:type|method)?\s*[:#]?\s*([^\s,]+)/i);
            if (billMatch && !userContext.shipmentBillType) {
                userContext.shipmentBillType = billMatch[1].trim();
            }
        }

        if (messageText.toLowerCase().includes('date') || messageText.toLowerCase().includes('when')) {
            const dateMatch = messageText.match(/(?:date|when)\s+(?:is|should)?\s*[:#]?\s*([^\s,]+)/i);
            if (dateMatch && !userContext.shipmentDate) {
                userContext.shipmentDate = dateMatch[1].trim();
            }
        }

        if (messageText.toLowerCase().includes('pickup') || messageText.toLowerCase().includes('pick up')) {
            const pickupMatch = messageText.match(/(?:pickup|pick up)\s+(?:window|time)?\s*[:#]?\s*([^\s,]+)/i);
            if (pickupMatch && !userContext.pickupWindow) {
                userContext.pickupWindow = pickupMatch[1].trim();
            }
        }

        if (messageText.toLowerCase().includes('delivery') || messageText.toLowerCase().includes('drop off')) {
            const deliveryMatch = messageText.match(/(?:delivery|drop off)\s+(?:window|time)?\s*[:#]?\s*([^\s,]+)/i);
            if (deliveryMatch && !userContext.deliveryWindow) {
                userContext.deliveryWindow = deliveryMatch[1].trim();
            }
        }

        // Return response with updated context
        return {
            message: {
                role: 'model',
                content: responseText
            },
            userContext: userContext
        };
    } catch (error) {
        console.error("Error in AI analysis:", error);
        res.write(`data: ${JSON.stringify({
            success: false,
            message: "Failed to analyze rates with AI",
            error: error.message
        })}\n\n`);
        res.end();
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

exports.getMapsApiKey = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    // Fetch API key from Firestore
    const db = admin.firestore();
    const keysRef = db.collection('keys');
    const keysSnapshot = await keysRef.limit(1).get();
    
    if (keysSnapshot.empty) {
      console.error('No documents found in keys collection');
      res.status(500).json({
        error: 'Google Maps API key not configured in Firestore'
      });
      return;
    }
    
    const firstDoc = keysSnapshot.docs[0];
    const apiKey = firstDoc.data().googleAPI;
    
    if (!apiKey) {
      console.error('Google Maps API key is empty in Firestore');
      res.status(500).json({
        error: 'Google Maps API key is empty in Firestore'
      });
      return;
    }
    
    console.log('Retrieved Google Maps API key from Firestore');
    
    // Return the API key with cache headers
    res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.json({
      key: apiKey
    });
  } catch (error) {
    console.error('Error in getMapsApiKey:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// Helper function to check if an address is complete
const isAddressComplete = (address) => {
    return address && 
           address.street && 
           address.city && 
           address.state && 
           address.country &&
           address.postalCode;
};

// Helper function to extract location information
const extractLocationInfo = (text) => {
    const locationInfo = {};
    
    // Skip if the text is too short or contains common phrases
    if (text.length < 5 || 
        text.toLowerCase().includes('need to ship') || 
        text.toLowerCase().includes('want to ship') ||
        text.toLowerCase().includes('would like to ship')) {
        return locationInfo;
    }
    
    // Extract postal/zip code first (various formats)
    const postalCode = text.match(/([A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d)|(\d{5}(-\d{4})?)/i);
    if (postalCode) {
        locationInfo.postalCode = postalCode[0].trim().toUpperCase();
    }

    // Extract street address - look for patterns like "is my street" or "street address is"
    const streetPatterns = [
        /^([^,]+)\s+is\s+my\s+street/i,
        /^([^,]+)\s+street\s+address\s+is/i,
        /^([^,]+)\s+is\s+my\s+address/i,
        /^([^,]+)\s+address\s+is/i,
        /^([^,]+)$/i  // Fallback for just a street name
    ];
    
    for (const pattern of streetPatterns) {
        const streetMatch = text.match(pattern);
        if (streetMatch && 
            !streetMatch[1].toLowerCase().includes('ship') && 
            !streetMatch[1].toLowerCase().includes('package') &&
            !streetMatch[1].toLowerCase().includes('need') &&
            !streetMatch[1].toLowerCase().includes('want')) {
            locationInfo.street = streetMatch[1].trim();
            break;
        }
    }

    // Extract city, state/province, country
    const cityStateCountry = text.match(/([^,]+),\s*([^,]+),\s*([^,]+)/i);
    if (cityStateCountry) {
        locationInfo.city = cityStateCountry[1].trim();
        locationInfo.state = cityStateCountry[2].trim();
        locationInfo.country = cityStateCountry[3].trim();
    } else {
        // Try to extract city and state/province without country
        const cityState = text.match(/([^,]+),\s*([^,]+)/i);
        if (cityState) {
            locationInfo.city = cityState[1].trim();
            locationInfo.state = cityState[2].trim();
        } else {
            // Try to extract just city - only if it looks like a city name
            const city = text.match(/^([^,]+)$/i);
            if (city && 
                !city[1].toLowerCase().includes('ship') && 
                !city[1].toLowerCase().includes('package') &&
                !city[1].toLowerCase().includes('need') &&
                !city[1].toLowerCase().includes('want') &&
                !city[1].toLowerCase().includes('street') &&
                !city[1].toLowerCase().includes('address')) {
                locationInfo.city = city[1].trim();
            }
        }
    }

    return locationInfo;
};

// Helper function to determine what address field to ask for next
const getNextAddressField = (address) => {
    if (!address) return 'basic';
    if (!address.street) return 'street';
    if (!address.city || !address.state || !address.country) return 'location';
    if (!address.postalCode) return 'postal';
    return 'complete';
};

// Helper function to check if a shipment setup is complete
const isShipmentSetupComplete = (context) => {
    return context.bookingReference &&
           context.bookingReferenceType &&
           context.shipmentBillType &&
           context.shipmentDate &&
           context.pickupWindow &&
           context.deliveryWindow;
};

// Helper function to get the next shipment setup field to ask for
const getNextShipmentSetupField = (context) => {
    if (!context.bookingReference) return 'bookingReference';
    if (!context.bookingReferenceType) return 'bookingReferenceType';
    if (!context.shipmentBillType) return 'shipmentBillType';
    if (!context.shipmentDate) return 'shipmentDate';
    if (!context.pickupWindow) return 'pickupWindow';
    if (!context.deliveryWindow) return 'deliveryWindow';
    return 'complete';
};

// Helper function to validate postal code
const validatePostalCode = (postalCode, country) => {
    if (!postalCode) return false;
    
    // Canadian postal code format: A1A 1A1
    if (country === 'Canada' || country === 'CA') {
        return /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(postalCode);
    }
    
    // US ZIP code format: 12345 or 12345-6789
    if (country === 'United States' || country === 'US') {
        return /^\d{5}(-\d{4})?$/.test(postalCode);
    }
    
    // For other countries, just check if it's not empty
    return postalCode.length > 0;
};

// Helper function to format postal code
const formatPostalCode = (postalCode, country) => {
    if (!postalCode) return '';
    
    // Canadian postal code format: A1A 1A1
    if (country === 'Canada' || country === 'CA') {
        const cleaned = postalCode.replace(/\s+/g, '').toUpperCase();
        if (cleaned.length === 6) {
            return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
        }
        return postalCode.toUpperCase();
    }
    
    // US ZIP code format: 12345 or 12345-6789
    if (country === 'United States' || country === 'US') {
        return postalCode.replace(/\s+/g, '');
    }
    
    return postalCode;
};

// Helper function to validate weight
const validateWeight = (weight) => {
    if (!weight) return false;
    
    // Extract numeric value from string (e.g., "100lbs" -> 100)
    const numericWeight = parseFloat(weight.replace(/[^\d.]/g, ''));
    
    // Check if it's a positive number
    return !isNaN(numericWeight) && numericWeight > 0;
};

// Helper function to format weight
const formatWeight = (weight) => {
    if (!weight) return '';
    
    // Extract numeric value from string (e.g., "100lbs" -> 100)
    const numericWeight = parseFloat(weight.replace(/[^\d.]/g, ''));
    
    // Extract unit if present
    const unit = weight.replace(/[\d.]/g, '').trim() || 'lbs';
    
    return `${numericWeight} ${unit}`;
};

// Chat with Gemini function
exports.chatWithGemini = functions.https.onCall(async (data, context) => {
    try {
        // Validate input
        if (!data.data || !data.data.message || !data.data.message.content) {
            throw new Error('Message content is required');
        }

        const messageText = data.data.message.content;
        const userContext = data.data.userContext || {};
        const previousMessages = data.data.previousMessages || [];

        // Build the system prompt
        let systemPrompt = `You are a helpful shipping assistant for SolushipX. 
        Help users with their shipping needs by providing information about shipping options, 
        rates, and best practices.
        
        IMPORTANT INSTRUCTIONS:
        1. NEVER reintroduce yourself if the user has already started a conversation
        2. NEVER ask if they want to ship a package if they've already indicated they do
        3. NEVER repeat questions you've already asked
        4. Keep track of what information you've already collected
        5. Be concise and direct in your responses
        6. Focus on collecting ONE piece of information at a time
        7. If you have partial information, acknowledge it and ask ONLY for what's missing
        8. If the user provides information, acknowledge it and ask for the next missing piece
        9. If the user repeats information, acknowledge that you already have it and ask for the next missing piece
        10. Use AI to understand the context of the user's message and respond appropriately
        11. NEVER repeat the entire context after each piece of information
        12. If the user corrects information, acknowledge the correction and continue
        13. If the user provides multiple pieces of information, acknowledge each one separately
        14. If the user provides information in an unexpected format, ask for clarification

        HANDLING AMBIGUOUS RESPONSES:
        1. When a user expresses uncertainty (e.g., "I'm not sure", "maybe", "perhaps"):
           - Acknowledge their uncertainty
           - Provide clear, specific options
           - Include relevant context (dates, times, etc.)
           - Offer examples or suggestions
           - Ask for clarification in a supportive way

        2. For scheduling-related uncertainty:
           - Show actual dates (today, tomorrow, next week)
           - Explain the implications of each choice
           - Offer flexibility where possible
           - Provide clear next steps

        3. For address-related uncertainty:
           - Break down the address components
           - Explain what information is required
           - Offer to help with format
           - Provide examples of valid formats

        4. For package-related uncertainty:
           - Explain common package types
           - Provide measurement guidance
           - Offer to help with calculations
           - Suggest standard sizes if applicable

        RESPONSE STRUCTURE:
        1. Acknowledge the user's input or uncertainty
        2. Provide context and options
        3. Give clear, actionable next steps
        4. Include relevant suggestions or examples
        5. End with a specific question or prompt

        CONVERSATION FLOW:
        1. Maintain a natural, helpful tone
        2. Use the user's previous responses to inform next questions
        3. Adapt the level of detail based on user expertise
        4. Provide progressive guidance (start simple, add detail as needed)
        5. Keep the conversation focused on the current task`;

        // Determine the current step in the conversation
        let currentStep = 'initial';
        
        // Check if we're in the address collection phase
        if (userContext.fromAddress && !isAddressComplete(userContext.fromAddress)) {
            currentStep = 'originAddress';
        } else if (userContext.fromAddress && isAddressComplete(userContext.fromAddress) && 
                  (!userContext.toAddress || !isAddressComplete(userContext.toAddress))) {
            currentStep = 'destinationAddress';
        } else if (userContext.fromAddress && isAddressComplete(userContext.fromAddress) && 
                  userContext.toAddress && isAddressComplete(userContext.toAddress) && 
                  !userContext.packageDetails) {
            currentStep = 'packageDetails';
        } else if (userContext.fromAddress && isAddressComplete(userContext.fromAddress) && 
                  userContext.toAddress && isAddressComplete(userContext.toAddress) && 
                  userContext.packageDetails && !isShipmentSetupComplete(userContext)) {
            currentStep = 'shipmentSetup';
        } else if (isShipmentSetupComplete(userContext) && 
                  userContext.fromAddress && isAddressComplete(userContext.fromAddress) && 
                  userContext.toAddress && isAddressComplete(userContext.toAddress) && 
                  userContext.packageDetails) {
            currentStep = 'complete';
        }

        // Add step-specific instructions
        switch (currentStep) {
            case 'initial':
                systemPrompt += `\n\nCURRENT STEP: Initial greeting
                - If the user mentions shipping a package, acknowledge it and ask for the origin address
                - If the user just says hello or similar, ask what they would like to ship`;
                break;
            case 'originAddress':
                systemPrompt += `\n\nCURRENT STEP: Collecting origin address
                - Ask for the next missing piece of the origin address
                - If the user provides multiple pieces of information, acknowledge each one
                - If the user corrects information, acknowledge the correction
                - If the user provides information in an unexpected format, ask for clarification`;
                break;
            case 'destinationAddress':
                systemPrompt += `\n\nCURRENT STEP: Collecting destination address
                - Ask for the next missing piece of the destination address
                - If the user provides multiple pieces of information, acknowledge each one
                - If the user corrects information, acknowledge the correction
                - If the user provides information in an unexpected format, ask for clarification`;
                break;
            case 'packageDetails':
                systemPrompt += `\n\nCURRENT STEP: Collecting package details
                - Ask for the weight of the package
                - If the user provides the weight, ask for dimensions (length, width, height)
                - If the user provides dimensions, ask for the value of the package
                - If the user provides the value, ask for any special handling requirements`;
                break;
            case 'shipmentSetup':
                systemPrompt += `\n\nCURRENT STEP: Setting up shipment
                - Ask for the next missing piece of shipment setup information
                - If the user provides multiple pieces of information, acknowledge each one
                - If the user corrects information, acknowledge the correction
                - If the user provides information in an unexpected format, ask for clarification`;
                break;
            case 'complete':
                systemPrompt += `\n\nCURRENT STEP: Confirming shipment details
                - Summarize all collected information
                - Ask if everything is correct
                - If the user confirms, proceed to the next phase
                - If the user wants to change anything, ask what needs to be changed`;
                break;
        }

        // Create the full prompt with context and conversation history
        const fullPrompt = `${systemPrompt}\n\nUser context: ${JSON.stringify(userContext)}\n\nPrevious messages: ${JSON.stringify(previousMessages)}\n\nUser message: ${messageText}`;

        // Call GenKit with the structured prompt
        const response = await ai.generate(fullPrompt);
        
        // Extract response text
        let responseText = '';
        
        try {
            if (response && response.message && response.message.content) {
                responseText = response.message.content
                    .map(part => part.text || '')
                    .join('\n');
            } else if (typeof response === 'string') {
                responseText = response;
            } else if (response?.text) {
                responseText = response.text;
            } else if (response?.content) {
                responseText = response.content;
            } else {
                responseText = JSON.stringify(response);
            }
        } catch (error) {
            console.error('Error parsing response:', error);
            responseText = 'I apologize, but I encountered an error processing your message.';
        }

        // Extract any new information from the user's message
        const locationInfo = extractLocationInfo(messageText);

        // Update context with any new information
        if (locationInfo.city || locationInfo.state || locationInfo.country || locationInfo.postalCode || locationInfo.street) {
            // If we don't have an origin address yet, or if the user is providing origin information
            if (!userContext.fromAddress || 
                (userContext.fromAddress && 
                 (!userContext.fromAddress.city || 
                  !userContext.fromAddress.state || 
                  !userContext.fromAddress.country || 
                  !userContext.fromAddress.postalCode || 
                  !userContext.fromAddress.street))) {
                
                // Check if the user is correcting information
                if (messageText.toLowerCase().includes('street') || messageText.toLowerCase().includes('address')) {
                    userContext.fromAddress = {
                        ...userContext.fromAddress,
                        street: locationInfo.street || userContext.fromAddress?.street
                    };
                } else if (messageText.toLowerCase().includes('city')) {
                    userContext.fromAddress = {
                        ...userContext.fromAddress,
                        city: locationInfo.city || userContext.fromAddress?.city
                    };
                } else if (messageText.toLowerCase().includes('state') || messageText.toLowerCase().includes('province')) {
                    userContext.fromAddress = {
                        ...userContext.fromAddress,
                        state: locationInfo.state || userContext.fromAddress?.state
                    };
                } else if (messageText.toLowerCase().includes('country')) {
                    userContext.fromAddress = {
                        ...userContext.fromAddress,
                        country: locationInfo.country || userContext.fromAddress?.country
                    };
                } else if (messageText.toLowerCase().includes('postal') || messageText.toLowerCase().includes('zip')) {
                    userContext.fromAddress = {
                        ...userContext.fromAddress,
                        postalCode: locationInfo.postalCode || userContext.fromAddress?.postalCode
                    };
                } else {
                    // If no specific field is mentioned, update all provided fields
                    userContext.fromAddress = {
                        ...userContext.fromAddress,
                        ...locationInfo
                    };
                }
                
                // Format postal code if present
                if (userContext.fromAddress.postalCode && userContext.fromAddress.country) {
                    userContext.fromAddress.postalCode = formatPostalCode(
                        userContext.fromAddress.postalCode, 
                        userContext.fromAddress.country
                    );
                }
            } 
            // If we have a complete origin address but no destination address yet
            else if (isAddressComplete(userContext.fromAddress) && 
                    (!userContext.toAddress || 
                     (userContext.toAddress && 
                      (!userContext.toAddress.city || 
                       !userContext.toAddress.state || 
                       !userContext.toAddress.country || 
                       !userContext.toAddress.postalCode || 
                       !userContext.toAddress.street)))) {
                
                // Check if the user is correcting information
                if (messageText.toLowerCase().includes('street') || messageText.toLowerCase().includes('address')) {
                    userContext.toAddress = {
                        ...userContext.toAddress,
                        street: locationInfo.street || userContext.toAddress?.street
                    };
                } else if (messageText.toLowerCase().includes('city')) {
                    userContext.toAddress = {
                        ...userContext.toAddress,
                        city: locationInfo.city || userContext.toAddress?.city
                    };
                } else if (messageText.toLowerCase().includes('state') || messageText.toLowerCase().includes('province')) {
                    userContext.toAddress = {
                        ...userContext.toAddress,
                        state: locationInfo.state || userContext.toAddress?.state
                    };
                } else if (messageText.toLowerCase().includes('country')) {
                    userContext.toAddress = {
                        ...userContext.toAddress,
                        country: locationInfo.country || userContext.toAddress?.country
                    };
                } else if (messageText.toLowerCase().includes('postal') || messageText.toLowerCase().includes('zip')) {
                    userContext.toAddress = {
                        ...userContext.toAddress,
                        postalCode: locationInfo.postalCode || userContext.toAddress?.postalCode
                    };
                } else {
                    // If no specific field is mentioned, update all provided fields
                    userContext.toAddress = {
                        ...userContext.toAddress,
                        ...locationInfo
                    };
                }
                
                // Format postal code if present
                if (userContext.toAddress.postalCode && userContext.toAddress.country) {
                    userContext.toAddress.postalCode = formatPostalCode(
                        userContext.toAddress.postalCode, 
                        userContext.toAddress.country
                    );
                }
            }
        }

        // Extract package details
        if (messageText.toLowerCase().includes('weight') || messageText.toLowerCase().includes('lbs') || messageText.toLowerCase().includes('kg')) {
            const weightMatch = messageText.match(/(\d+(?:\.\d+)?)\s*(lbs|kg|pounds|kilograms)/i);
            if (weightMatch && validateWeight(weightMatch[0])) {
                userContext.packageDetails = {
                    ...userContext.packageDetails,
                    weight: formatWeight(weightMatch[0])
                };
            }
        }

        // Extract and update shipment setup information
        if (messageText.toLowerCase().includes('reference') || messageText.toLowerCase().includes('shipment') || messageText.toLowerCase().includes('order')) {
            const referenceMatch = messageText.match(/(?:reference|shipment|order)\s+(?:number|name|id)?\s*[:#]?\s*([^\s,]+)/i);
            if (referenceMatch && !userContext.bookingReference) {
                userContext.bookingReference = referenceMatch[1].trim();
            }
        }

        if (messageText.toLowerCase().includes('type') || messageText.toLowerCase().includes('kind')) {
            const typeMatch = messageText.match(/(?:type|kind)\s+(?:is|of)?\s*[:#]?\s*([^\s,]+)/i);
            if (typeMatch && !userContext.bookingReferenceType) {
                userContext.bookingReferenceType = typeMatch[1].trim();
            }
        }

        if (messageText.toLowerCase().includes('bill') || messageText.toLowerCase().includes('payment')) {
            const billMatch = messageText.match(/(?:bill|payment)\s+(?:type|method)?\s*[:#]?\s*([^\s,]+)/i);
            if (billMatch && !userContext.shipmentBillType) {
                userContext.shipmentBillType = billMatch[1].trim();
            }
        }

        if (messageText.toLowerCase().includes('date') || messageText.toLowerCase().includes('when')) {
            const dateMatch = messageText.match(/(?:date|when)\s+(?:is|should)?\s*[:#]?\s*([^\s,]+)/i);
            if (dateMatch && !userContext.shipmentDate) {
                userContext.shipmentDate = dateMatch[1].trim();
            }
        }

        if (messageText.toLowerCase().includes('pickup') || messageText.toLowerCase().includes('pick up')) {
            const pickupMatch = messageText.match(/(?:pickup|pick up)\s+(?:window|time)?\s*[:#]?\s*([^\s,]+)/i);
            if (pickupMatch && !userContext.pickupWindow) {
                userContext.pickupWindow = pickupMatch[1].trim();
            }
        }

        if (messageText.toLowerCase().includes('delivery') || messageText.toLowerCase().includes('drop off')) {
            const deliveryMatch = messageText.match(/(?:delivery|drop off)\s+(?:window|time)?\s*[:#]?\s*([^\s,]+)/i);
            if (deliveryMatch && !userContext.deliveryWindow) {
                userContext.deliveryWindow = deliveryMatch[1].trim();
            }
        }

        // Return response with updated context
        return {
            message: {
                role: 'model',
                content: responseText
            },
            userContext: userContext
        };
    } catch (error) {
        console.error('Error in chatWithGemini:', error);
        throw new Error(`Failed to process chat message: ${error.message}`);
    }
});
