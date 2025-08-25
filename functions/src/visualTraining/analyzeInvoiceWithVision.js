const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const vision = require('@google-cloud/vision');
const { VertexAI } = require('@google-cloud/vertexai');
const axios = require('axios');

const db = admin.firestore();
const visionClient = new vision.ImageAnnotatorClient();

/**
 * Enhanced AI-powered invoice analysis with visual bounding boxes
 * Combines Google Cloud Vision OCR with Gemini 2.5 Flash layout analysis
 */
exports.analyzeInvoiceWithVision = onCall({
    cors: true,
    timeoutSeconds: 300,
    memory: '1GiB'
}, async (request) => {
    try {
        const { carrierId, exampleId, pdfUrl } = request.data;
        
        if (!request.auth) {
            throw new Error('Authentication required');
        }
        
        if (!carrierId || !exampleId || !pdfUrl) {
            throw new Error('carrierId, exampleId, and pdfUrl are required');
        }
        
        console.log('🔍 Starting enhanced visual analysis for:', { carrierId, exampleId });
        
        // Step 1: Download PDF for analysis
        const pdfBuffer = await downloadPdfBuffer(pdfUrl);
        
        // Step 2: Extract text with precise coordinates using Google Vision
        const visionAnalysis = await analyzeWithGoogleVision(pdfBuffer);
        
        // Step 3: Perform layout analysis with Gemini 2.5 Flash
        const layoutAnalysis = await analyzeLayoutWithGemini(pdfBuffer);
        
        // Step 4: Detect logos and visual elements
        const logoAnalysis = await detectLogosAndVisualElements(pdfBuffer);
        
        // Step 5: Create intelligent bounding boxes for key components
        const boundingBoxes = await createSmartBoundingBoxes(
            visionAnalysis, 
            layoutAnalysis, 
            logoAnalysis
        );
        
        // Step 6: Store visual training data
        const visualTrainingData = {
            carrierId,
            exampleId,
            pdfUrl,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            analysis: {
                vision: visionAnalysis,
                layout: layoutAnalysis,
                logos: logoAnalysis
            },
            boundingBoxes,
            confidence: calculateOverallConfidence(boundingBoxes),
            status: 'analyzed',
            reviewRequired: boundingBoxes.some(box => box.confidence < 0.8)
        };
        
        // Store in Firestore
        await db.collection('visualTrainingData')
            .doc(`${carrierId}_${exampleId}`)
            .set(visualTrainingData);
        
        console.log('✅ Visual analysis complete:', {
            boundingBoxCount: boundingBoxes.length,
            overallConfidence: visualTrainingData.confidence,
            reviewRequired: visualTrainingData.reviewRequired
        });
        
        return {
            success: true,
            data: {
                boundingBoxes,
                confidence: visualTrainingData.confidence,
                reviewRequired: visualTrainingData.reviewRequired,
                analysisId: `${carrierId}_${exampleId}`
            }
        };
        
    } catch (error) {
        console.error('❌ Visual analysis failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Download PDF as buffer for analysis
 */
async function downloadPdfBuffer(pdfUrl) {
    const response = await axios.get(pdfUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000 
    });
    return Buffer.from(response.data);
}

/**
 * Analyze document with Google Cloud Vision for precise text extraction
 */
async function analyzeWithGoogleVision(pdfBuffer) {
    try {
        const [result] = await visionClient.documentTextDetection({
            image: { content: pdfBuffer }
        });
        
        const annotations = result.textAnnotations || [];
        const fullText = result.fullTextAnnotation;
        
        // Extract text blocks with bounding boxes
        const textBlocks = [];
        
        if (fullText && fullText.pages) {
            fullText.pages.forEach((page, pageIndex) => {
                page.blocks.forEach((block, blockIndex) => {
                    block.paragraphs.forEach((paragraph, paragraphIndex) => {
                        let paragraphText = '';
                        let wordBounds = [];
                        
                        paragraph.words.forEach(word => {
                            const wordText = word.symbols.map(symbol => symbol.text).join('');
                            paragraphText += wordText + ' ';
                            
                            if (word.boundingBox) {
                                wordBounds.push({
                                    text: wordText,
                                    boundingBox: word.boundingBox
                                });
                            }
                        });
                        
                        if (paragraph.boundingBox) {
                            textBlocks.push({
                                text: paragraphText.trim(),
                                boundingBox: paragraph.boundingBox,
                                confidence: paragraph.confidence || 0.9,
                                pageIndex,
                                blockIndex,
                                paragraphIndex,
                                words: wordBounds
                            });
                        }
                    });
                });
            });
        }
        
        return {
            fullText: annotations[0]?.description || '',
            textBlocks,
            totalBlocks: textBlocks.length,
            averageConfidence: textBlocks.reduce((acc, block) => acc + block.confidence, 0) / textBlocks.length
        };
        
    } catch (error) {
        console.error('Google Vision analysis failed:', error);
        return {
            fullText: '',
            textBlocks: [],
            totalBlocks: 0,
            averageConfidence: 0,
            error: error.message
        };
    }
}

/**
 * Analyze document layout with Gemini 2.5 Flash
 */
async function analyzeLayoutWithGemini(pdfBuffer) {
    try {
        const vertex_ai = new VertexAI({
            project: 'solushipx',
            location: 'us-central1',
            keyFilename: './service-account.json'
        });
        
        const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const prompt = `Analyze this invoice/shipping document and identify the precise locations of key components. Return a JSON object with the following structure:

{
    "documentType": "invoice|bol|shipping_document",
    "carrier": {
        "name": "detected carrier name",
        "logoDetected": true/false,
        "confidence": 0.0-1.0
    },
    "keyFields": {
        "invoiceNumber": {
            "value": "found value",
            "location": "approximate position description",
            "confidence": 0.0-1.0
        },
        "invoiceDate": {
            "value": "found date",
            "location": "approximate position description", 
            "confidence": 0.0-1.0
        },
        "totalAmount": {
            "value": "found amount",
            "location": "approximate position description",
            "confidence": 0.0-1.0
        },
        "shipmentIds": [
            {
                "value": "shipment ID",
                "location": "approximate position description",
                "confidence": 0.0-1.0
            }
        ]
    },
    "layoutStructure": {
        "hasHeader": true/false,
        "hasFooter": true/false,
        "hasTable": true/false,
        "tableRows": number,
        "logoPosition": "top-left|top-right|center|etc",
        "documentOrientation": "portrait|landscape"
    }
}

Focus on accuracy and provide confidence scores for each detected element.`;

        const requestPayload = {
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    { 
                        inlineData: { 
                            mimeType: 'application/pdf', 
                            data: pdfBuffer.toString('base64') 
                        } 
                    }
                ]
            }]
        };
        
        const response = await model.generateContent(requestPayload);
        const responseText = response?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        
        return JSON.parse(responseText);
        
    } catch (error) {
        console.error('Gemini layout analysis failed:', error);
        return {
            documentType: 'unknown',
            carrier: { name: '', logoDetected: false, confidence: 0 },
            keyFields: {},
            layoutStructure: {},
            error: error.message
        };
    }
}

/**
 * Detect logos and visual elements
 */
async function detectLogosAndVisualElements(pdfBuffer) {
    try {
        const [result] = await visionClient.logoDetection({
            image: { content: pdfBuffer }
        });
        
        const logos = result.logoAnnotations || [];
        
        // Also detect objects that might be visual elements
        const [objectResult] = await visionClient.objectLocalization({
            image: { content: pdfBuffer }
        });
        
        const objects = objectResult.localizedObjectAnnotations || [];
        
        return {
            logos: logos.map(logo => ({
                description: logo.description,
                confidence: logo.score,
                boundingBox: logo.boundingPoly
            })),
            objects: objects.map(obj => ({
                name: obj.name,
                confidence: obj.score,
                boundingBox: obj.boundingPoly
            })),
            logoCount: logos.length,
            objectCount: objects.length
        };
        
    } catch (error) {
        console.error('Logo detection failed:', error);
        return {
            logos: [],
            objects: [],
            logoCount: 0,
            objectCount: 0,
            error: error.message
        };
    }
}

/**
 * Create smart bounding boxes by combining all analysis data
 */
async function createSmartBoundingBoxes(visionAnalysis, layoutAnalysis, logoAnalysis) {
    const boundingBoxes = [];
    
    // Add logo bounding boxes (Blue)
    logoAnalysis.logos.forEach((logo, index) => {
        boundingBoxes.push({
            id: `logo_${index}`,
            type: 'carrier_logo',
            label: `Carrier Logo: ${logo.description}`,
            color: '#2196F3', // Blue
            boundingBox: logo.boundingBox,
            confidence: logo.confidence,
            value: logo.description,
            editable: true
        });
    });
    
    // Add key field bounding boxes based on layout analysis
    if (layoutAnalysis.keyFields) {
        // Invoice Number (Yellow)
        if (layoutAnalysis.keyFields.invoiceNumber) {
            const invoiceField = layoutAnalysis.keyFields.invoiceNumber;
            const textBlock = findBestMatchingTextBlock(
                visionAnalysis.textBlocks, 
                invoiceField.value
            );
            
            if (textBlock) {
                boundingBoxes.push({
                    id: 'invoice_number',
                    type: 'invoice_number',
                    label: 'Invoice Number',
                    color: '#FFEB3B', // Yellow
                    boundingBox: textBlock.boundingBox,
                    confidence: Math.min(invoiceField.confidence, textBlock.confidence),
                    value: invoiceField.value,
                    editable: true
                });
            }
        }
        
        // Total Amount (Purple)
        if (layoutAnalysis.keyFields.totalAmount) {
            const totalField = layoutAnalysis.keyFields.totalAmount;
            const textBlock = findBestMatchingTextBlock(
                visionAnalysis.textBlocks, 
                totalField.value
            );
            
            if (textBlock) {
                boundingBoxes.push({
                    id: 'total_amount',
                    type: 'total_amount',
                    label: 'Total Amount',
                    color: '#9C27B0', // Purple
                    boundingBox: textBlock.boundingBox,
                    confidence: Math.min(totalField.confidence, textBlock.confidence),
                    value: totalField.value,
                    editable: true
                });
            }
        }
        
        // Shipment IDs (Green)
        if (layoutAnalysis.keyFields.shipmentIds) {
            layoutAnalysis.keyFields.shipmentIds.forEach((shipmentField, index) => {
                const textBlock = findBestMatchingTextBlock(
                    visionAnalysis.textBlocks, 
                    shipmentField.value
                );
                
                if (textBlock) {
                    boundingBoxes.push({
                        id: `shipment_id_${index}`,
                        type: 'shipment_id',
                        label: 'Shipment ID',
                        color: '#4CAF50', // Green
                        boundingBox: textBlock.boundingBox,
                        confidence: Math.min(shipmentField.confidence, textBlock.confidence),
                        value: shipmentField.value,
                        editable: true
                    });
                }
            });
        }
        
        // Invoice Date (Orange)
        if (layoutAnalysis.keyFields.invoiceDate) {
            const dateField = layoutAnalysis.keyFields.invoiceDate;
            const textBlock = findBestMatchingTextBlock(
                visionAnalysis.textBlocks, 
                dateField.value
            );
            
            if (textBlock) {
                boundingBoxes.push({
                    id: 'invoice_date',
                    type: 'invoice_date',
                    label: 'Invoice Date',
                    color: '#FF9800', // Orange
                    boundingBox: textBlock.boundingBox,
                    confidence: Math.min(dateField.confidence, textBlock.confidence),
                    value: dateField.value,
                    editable: true
                });
            }
        }
    }
    
    return boundingBoxes;
}

/**
 * Find the best matching text block for a given value
 */
function findBestMatchingTextBlock(textBlocks, targetValue) {
    if (!targetValue || !textBlocks.length) return null;
    
    const cleanTarget = targetValue.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;
    
    textBlocks.forEach(block => {
        const cleanBlockText = block.text.toLowerCase().trim();
        
        // Exact match
        if (cleanBlockText === cleanTarget) {
            bestMatch = block;
            bestScore = 1.0;
            return;
        }
        
        // Contains match
        if (cleanBlockText.includes(cleanTarget)) {
            const score = cleanTarget.length / cleanBlockText.length;
            if (score > bestScore) {
                bestMatch = block;
                bestScore = score;
            }
        }
        
        // Fuzzy match
        const similarity = calculateStringSimilarity(cleanBlockText, cleanTarget);
        if (similarity > 0.8 && similarity > bestScore) {
            bestMatch = block;
            bestScore = similarity;
        }
    });
    
    return bestMatch;
}

/**
 * Calculate string similarity (simple implementation)
 */
function calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = calculateEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate edit distance between two strings
 */
function calculateEditDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

/**
 * Calculate overall confidence score
 */
function calculateOverallConfidence(boundingBoxes) {
    if (!boundingBoxes.length) return 0;
    
    const totalConfidence = boundingBoxes.reduce((sum, box) => sum + box.confidence, 0);
    return totalConfidence / boundingBoxes.length;
}
