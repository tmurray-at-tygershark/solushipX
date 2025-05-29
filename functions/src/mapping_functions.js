const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Storage } = require('@google-cloud/storage');
const mappingGeneratorPrompt = require('./edi-prompts/mapping_generator_prompt');
const crypto = require('crypto');

// Firebase Admin is already initialized in index.js with correct bucket configuration

const db = admin.firestore();

const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

exports.generateEdiMapping = functions.https.onRequest(
    { region: 'us-central1', cors: true, timeoutSeconds: 300, memory: '1GiB' }, 
    async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { carrierName, csvHeadersString, sampleDataRows, prompt: userPrompt } = req.body;

    if (!carrierName || !csvHeadersString || !Array.isArray(sampleDataRows) || sampleDataRows.length === 0) {
        return res.status(400).send('Missing required fields: carrierName, csvHeadersString (comma-separated), and sampleDataRows (array of strings).');
    }

    const csvHeaders = csvHeadersString.split(',').map(h => h.trim());
    const headerStringForHash = csvHeaders.join('|');
    const headerHash = crypto.createHash('md5').update(headerStringForHash).digest('hex');

    console.log(`Generating EDI mapping for carrier: ${carrierName}, header hash: ${headerHash}`);

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        // Use user-provided prompt if available, else default
        const mappingPrompt = userPrompt || mappingGeneratorPrompt;
        const inputText = `\nInputs:\n1. carrierName: "${carrierName}"\n2. fileType: "CSV"\n3. csvHeaders: ${JSON.stringify(csvHeaders)}\n4. sampleDataRows: ${JSON.stringify(sampleDataRows)}\nUse these inputs to fulfill the TASK defined in the prompt below.`;
        const fullPrompt = `${mappingPrompt}\n${inputText}`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const textResponse = response.text();

        console.log("Raw AI Response for mapping generation:", textResponse);

        let parsedMappingJson;
        try {
            let jsonStringToParse = textResponse.trim();
            const markdownMatch = jsonStringToParse.match(/```json\n?([\s\S]*?)\n?```/);
            if (markdownMatch && markdownMatch[1]) {
                jsonStringToParse = markdownMatch[1].trim();
            }
            parsedMappingJson = JSON.parse(jsonStringToParse);
            parsedMappingJson.headerHash = headerHash;
            parsedMappingJson.carrierName = carrierName;
            parsedMappingJson.fileType = "CSV";
            parsedMappingJson.prompt = mappingPrompt;
            return res.status(200).send(parsedMappingJson);
        } catch (e) {
            console.error("Error parsing AI JSON response for mapping:", e);
            console.error("String that failed parsing:", textResponse);
            return res.status(500).send({ error: "Failed to parse AI response into valid JSON.", rawResponse: textResponse });
        }
    } catch (error) {
        console.error('Error calling Gemini AI for mapping generation:', error);
        return res.status(500).send({ error: 'Failed to generate EDI mapping.', details: error.message });
    }
});

// Force redeploy: touching this file to ensure generateEdiMapping is deployed 