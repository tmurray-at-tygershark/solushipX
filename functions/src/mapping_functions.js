const functions = require('firebase-functions/v2');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const mappingGeneratorPrompt = require('./edi-prompts/mapping_generator_prompt');
const crypto = require('crypto');

// Ensure Firebase admin is initialized (if not already done in index.js or elsewhere)
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

exports.generateEdiMapping = functions.https.onRequest(
    { region: 'us-central1', cors: true, timeoutSeconds: 300, memory: '1GiB' }, 
    async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { carrierName, csvHeadersString, sampleDataRows } = req.body;

    if (!carrierName || !csvHeadersString || !Array.isArray(sampleDataRows) || sampleDataRows.length === 0) {
        return res.status(400).send('Missing required fields: carrierName, csvHeadersString (comma-separated), and sampleDataRows (array of strings).');
    }

    const csvHeaders = csvHeadersString.split(',').map(h => h.trim());

    // Create a hash of the headers for potential caching/storage key
    const headerStringForHash = csvHeaders.join('|');
    const headerHash = crypto.createHash('md5').update(headerStringForHash).digest('hex');

    console.log(`Generating EDI mapping for carrier: ${carrierName}, header hash: ${headerHash}`);

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const inputText = `
        Inputs:\n
        1. carrierName: "${carrierName}"\n
        2. fileType: "CSV"\n
        3. csvHeaders: ${JSON.stringify(csvHeaders)}

        4. sampleDataRows: ${JSON.stringify(sampleDataRows)}

        Use these inputs to fulfill the TASK defined in the prompt below.
        `;

        const fullPrompt = `${mappingGeneratorPrompt}\n${inputText}`;
        
        // console.log("Full prompt for mapping generation:", fullPrompt);

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const textResponse = response.text();

        console.log("Raw AI Response for mapping generation:", textResponse);

        let parsedMappingJson;
        try {
            // Attempt to extract JSON from markdown if present
            let jsonStringToParse = textResponse.trim();
            const markdownMatch = jsonStringToParse.match(/```json\n?([\s\S]*?)\n?```/);
            if (markdownMatch && markdownMatch[1]) {
                jsonStringToParse = markdownMatch[1].trim();
            }
            parsedMappingJson = JSON.parse(jsonStringToParse);
            // Add the calculated hash and provided carrierName/fileType to the response
            parsedMappingJson.headerHash = headerHash;
            parsedMappingJson.carrierName = carrierName; // Ensure it's in the final object
            parsedMappingJson.fileType = "CSV"; // Ensure it's in the final object

            // TODO: Add validation against the expected schema here
            // TODO: Save to Firestore: ediMappings/{carrierName}_{headerHash}

            return res.status(200).send(parsedMappingJson);
        } catch (e) {
            console.error("Error parsing AI JSON response for mapping:", e);
            console.error("String that failed parsing:", textResponse); // Log the problematic string
            return res.status(500).send({ error: "Failed to parse AI response into valid JSON.", rawResponse: textResponse });
        }

    } catch (error) {
        console.error('Error calling Gemini AI for mapping generation:', error);
        return res.status(500).send({ error: 'Failed to generate EDI mapping.', details: error.message });
    }
}); 