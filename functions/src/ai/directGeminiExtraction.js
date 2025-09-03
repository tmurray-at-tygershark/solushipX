const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { VertexAI } = require('@google-cloud/vertexai');
const axios = require('axios');

// Initialize Vertex AI for Gemini
const vertex_ai = new VertexAI({ 
    project: process.env.GOOGLE_CLOUD_PROJECT || 'solushipx', 
    location: 'us-central1' 
});
const model = vertex_ai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
    },
});

exports.directGeminiExtraction = onCall({
    cors: {
        origin: ['https://solushipx.web.app', 'http://localhost:3000'],
        credentials: true
    },
    timeoutSeconds: 300,
    memory: '2GiB',
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { base64Data, fileName } = request.data || {};

        if (!base64Data || !fileName) {
            throw new Error('base64Data and fileName are required.');
        }

        console.log(`Starting direct Gemini extraction for file: ${fileName}`);

        // Determine MIME type
        const mimeType = fileName.toLowerCase().includes('.pdf') ? 'application/pdf' : 'image/jpeg';

        const prompt = `
        You are an expert AI invoice processing system. Analyze this invoice document and extract the following information. 
        Respond ONLY with a JSON object. Ensure all fields are present, even if empty or null.

        {
            "carrierInformation": {
                "company": "string | null",
                "address": "string | null",
                "phone": "string | null",
                "fax": "string | null"
            },
            "invoiceDetails": {
                "invoiceNumber": "string | null",
                "invoiceDate": "string | null",
                "billOfLading": "string | null"
            },
            "shipmentReferences": {
                "purchaseOrder": "string | null",
                "papsLabel": "string | null"
            },
            "shipper": {
                "company": "string | null",
                "address": "string | null"
            },
            "consignee": {
                "company": "string | null",
                "address": "string | null"
            },
            "packageDetails": [
                {
                    "quantity": "number | null",
                    "description": "string | null",
                    "weight": "string | null",
                    "dimensions": "string | null"
                }
            ],
            "charges": [
                {
                    "description": "string | null",
                    "amount": "number | null",
                    "rate": "string | null"
                }
            ],
            "totalAmount": {
                "amount": "number | null",
                "currency": "string | null"
            }
        }
        `;

        const requestPayload = {
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    { 
                        inlineData: { 
                            mimeType: mimeType, 
                            data: base64Data 
                        } 
                    }
                ]
            }]
        };

        const result = await model.generateContent(requestPayload);
        const text = result.response.candidates[0].content.parts[0].text;
        
        try {
            const extractedData = JSON.parse(text);
            console.log('Gemini extraction successful.');
            return {
                success: true,
                extractedData,
                rawResponse: text,
                message: 'Direct Gemini extraction completed.'
            };
        } catch (parseError) {
            console.error('JSON parse error from Gemini response:', parseError);
            console.error('Raw Gemini response:', text);
            throw new Error(`Failed to parse Gemini response: ${parseError.message}`);
        }

    } catch (error) {
        console.error('Direct Gemini extraction error:', error);
        throw new Error(`Direct Gemini extraction failed: ${error.message}`);
    }
});
