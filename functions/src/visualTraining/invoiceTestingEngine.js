const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const vision = require('@google-cloud/vision');
const { VertexAI } = require('@google-cloud/vertexai');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const db = admin.firestore();
const bucket = admin.storage().bucket();
const visionClient = new vision.ImageAnnotatorClient();

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

/**
 * Enterprise-level carrier model testing engine
 * Tests trained AI models against sample invoices to measure performance
 */
exports.testCarrierModel = onCall({
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

        const { 
            carrierId, 
            fileName, 
            base64Data, 
            expectedResults = null,
            testType = 'accuracy_test',
            metadata = {} 
        } = request.data || {};
        
        if (!carrierId || !fileName || !base64Data) {
            throw new Error('carrierId, fileName, and base64Data are required');
        }

        console.log(`🧪 Starting carrier model test: ${carrierId}/${fileName}`);
        console.log(`🔍 Carrier ID details:`, {
            carrierId,
            carrierIdType: typeof carrierId,
            carrierIdLength: carrierId?.length
        });

        // Generate unique test ID
        const testId = `test_${Date.now()}_${uuidv4().substring(0, 8)}`;
        const filePath = `testing/${carrierId}/${testId}/${fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;

        // Upload test file to storage
        const file = bucket.file(filePath);
        const buffer = Buffer.from(base64Data, 'base64');
        
        await file.save(buffer, {
            metadata: {
                contentType: 'application/pdf',
                metadata: {
                    carrierId,
                    testId,
                    originalFileName: fileName,
                    testType,
                    uploadedBy: request.auth.uid,
                    uploadedAt: new Date().toISOString()
                }
            }
        });

        // Make file publicly accessible for processing
        await file.makePublic();
        const downloadURL = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

        console.log('📄 File uploaded, starting AI processing...');

        // Step 1: Get trained model for carrier
        const carrierModel = await getCarrierTrainedModel(carrierId);
        console.log(`ℹ️ Carrier Model Loaded:`, {
            type: carrierModel?.type,
            version: carrierModel?.version,
            sampleCount: carrierModel?.sampleCount,
            hasVisualAnnotations: !!carrierModel?.visualAnnotations && Object.keys(carrierModel.visualAnnotations).length > 0,
            hasPatterns: !!carrierModel?.patterns && Object.keys(carrierModel.patterns).length > 0,
            fieldsInVisualAnnotations: carrierModel?.visualAnnotations ? Object.keys(carrierModel.visualAnnotations) : []
        });
        
        // Step 2: Process invoice with current AI pipeline (Gemini extraction)
        const aiResults = await processInvoiceWithAI(downloadURL, carrierModel);
        console.log(`🤖 Raw AI Extraction (from Gemini):`, aiResults.extractedData);
        console.log(`📈 Raw AI Confidence:`, aiResults.confidence);

        // Step 3: Apply trained model patterns (including visual annotations)
        const enhancedAiResults = await applyTrainedModelPatterns(aiResults, carrierModel);
        console.log(`✨ Enhanced AI Extraction (after applying model):`, enhancedAiResults.extractedData);
        console.log(`📊 Enhanced AI Confidence:`, enhancedAiResults.confidence);
        
        // Step 4: Calculate accuracy metrics if expected results provided
        const accuracyMetrics = expectedResults 
            ? await calculateAccuracyMetrics(enhancedAiResults, expectedResults)
            : await generateQualityMetrics(enhancedAiResults);

        // Step 5: Generate improvement recommendations
        const recommendations = await generateTestingRecommendations(
            enhancedAiResults, 
            accuracyMetrics, 
            carrierModel,
            carrierId
        );

        // Step 6: Store test results
        const testResults = {
            testId,
            carrierId,
            fileName,
            downloadURL,
            filePath,
            testType,
            
            // AI Processing Results
            aiResults,
            expectedResults,
            accuracyMetrics,
            recommendations,
            
            // Metadata
            metadata: {
                ...metadata,
                uploadedBy: request.auth.uid,
                modelVersion: carrierModel?.version || 'v1.0',
                processingTime: new Date().toISOString()
            },
            
            // Timestamps
            timestamps: {
                uploaded: admin.firestore.FieldValue.serverTimestamp(),
                processed: admin.firestore.FieldValue.serverTimestamp(),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            },
            
            // Test Status
            status: 'completed',
            success: true
        };

        // Save to testing results collection
        const testRef = db.collection('testingResults')
            .doc(carrierId)
            .collection('tests')
            .doc(testId);
            
        await testRef.set(testResults);

        // Update carrier testing statistics
        await updateCarrierTestingStats(carrierId, testResults);

        console.log(`✅ Test completed successfully: ${testId}`);

        return {
            success: true,
            testId,
            testResults: {
                ...testResults,
                downloadURL // Include for immediate access
            },
            message: 'Carrier model testing completed successfully'
        };

    } catch (error) {
        console.error('❌ Carrier model testing error:', error);
        return {
            success: false,
            error: error.message || 'Failed to test carrier model'
        };
    }
});

/**
 * Get testing history for a carrier
 */
exports.getCarrierTestingHistory = onCall({
    cors: {
        origin: ['https://solushipx.web.app', 'http://localhost:3000'],
        credentials: true
    },
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { carrierId, limit = 50, offset = 0 } = request.data || {};
        
        if (!carrierId) {
            throw new Error('carrierId is required');
        }

        const testsQuery = db.collection('testingResults')
            .doc(carrierId)
            .collection('tests')
            .orderBy('timestamps.processed', 'desc')
            .limit(limit)
            .offset(offset);

        const snapshot = await testsQuery.get();
        const tests = [];
        
        snapshot.forEach(doc => {
            tests.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Get carrier testing statistics
        const statsDoc = await db.collection('carrierTestingStats').doc(carrierId).get();
        const stats = statsDoc.exists ? statsDoc.data() : {};

        return {
            success: true,
            tests,
            stats,
            totalTests: tests.length,
            hasMore: tests.length === limit
        };

    } catch (error) {
        console.error('Get testing history error:', error);
        return {
            success: false,
            error: error.message || 'Failed to get testing history'
        };
    }
});

/**
 * Get detailed test results
 */
exports.getTestResults = onCall({
    cors: {
        origin: ['https://solushipx.web.app', 'http://localhost:3000'],
        credentials: true
    },
    timeoutSeconds: 30,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { carrierId, testId } = request.data || {};
        
        if (!carrierId || !testId) {
            throw new Error('carrierId and testId are required');
        }

        const testDoc = await db.collection('testingResults')
            .doc(carrierId)
            .collection('tests')
            .doc(testId)
            .get();

        if (!testDoc.exists) {
            throw new Error('Test results not found');
        }

        return {
            success: true,
            testResults: {
                id: testDoc.id,
                ...testDoc.data()
            }
        };

    } catch (error) {
        console.error('Get test results error:', error);
        return {
            success: false,
            error: error.message || 'Failed to get test results'
        };
    }
});

// Helper Functions

async function getCarrierTrainedModel(carrierId) {
    try {
        console.log(`Loading trained model for carrier: ${carrierId}`);
        
        // Step 1: Try to get traditional trained model first
        const modelDoc = await db.collection('trainedModels').doc(carrierId).get();
        
        if (modelDoc.exists) {
            const modelData = modelDoc.data();
            console.log(`Found traditional trained model v${modelData.version} for carrier: ${carrierId}`);
            return modelData;
        }

        // Step 2: If no traditional model, check for visual training data
        console.log(`No traditional model found. Checking for visual training data for carrier: ${carrierId}`);
        
        try {
            const samplesQuery = await db.collection('unifiedTraining')
                .doc(carrierId)
                .collection('samples')
                .where('processingStatus', '==', 'completed')
                .where('trainingType', '==', 'visual_annotation')
                .orderBy('timestamps.createdAt', 'desc')
                .limit(10)
                .get();

            if (!samplesQuery.empty) {
                console.log(`Found ${samplesQuery.size} visual training samples for carrier: ${carrierId}`);
                
                // Aggregate visual annotations and extracted features from recent samples
                const visualAnnotations = {};
                const extractedFeatures = [];
                
                samplesQuery.docs.forEach(doc => {
                    const sampleData = doc.data();
                    
                    // Collect visual annotations
                    if (sampleData.visualAnnotations) {
                        Object.keys(sampleData.visualAnnotations).forEach(fieldType => {
                            if (!visualAnnotations[fieldType]) {
                                visualAnnotations[fieldType] = [];
                            }
                            visualAnnotations[fieldType].push(...sampleData.visualAnnotations[fieldType]);
                        });
                    }
                    
                    // Collect extracted features for pattern learning
                    if (sampleData.extractedFeatures && sampleData.extractedFeatures.extractedData) {
                        extractedFeatures.push(sampleData.extractedFeatures.extractedData);
                    }
                });

                // Create a visual_annotation_based model
                const visualModel = {
                    type: 'visual_annotation_based',
                    version: 1,
                    carrierId: carrierId,
                    sampleCount: samplesQuery.size,
                    visualAnnotations: visualAnnotations,
                    extractedFeatures: extractedFeatures,
                    confidence: 0.85, // Higher confidence for visual training
                    createdAt: new Date().toISOString(),
                    patterns: {} // Could be enhanced with pattern detection
                };
                
                console.log(`Created visual annotation model with ${Object.keys(visualAnnotations).length} field types`);
                return visualModel;
            }
        } catch (visualError) {
            console.warn('Error loading visual training data:', visualError);
        }

        console.log(`No trained model (traditional or visual) found for carrier: ${carrierId}`);
        return null;
        
    } catch (error) {
        console.warn('Error getting trained model:', error);
        return null;
    }
}

async function processInvoiceWithAI(downloadURL, carrierModel) {
    try {
        console.log('🤖 Processing invoice with AI...');

        // Step 1: OCR with Google Vision
        const ocrResults = await extractTextWithVision(downloadURL);
        
        // Step 2: Enhanced extraction with Gemini
        const geminiResults = await extractWithGemini(downloadURL, ocrResults, carrierModel);
        
        // Step 3: Apply trained model patterns if available
        const enhancedResults = carrierModel 
            ? await applyTrainedModelPatterns(geminiResults, carrierModel)
            : geminiResults;

        return {
            ocrResults,
            geminiResults,
            enhancedResults,
            confidence: enhancedResults.confidence || 0.75,
            extractedData: enhancedResults.extractedData || {},
            processingTime: new Date().toISOString()
        };

    } catch (error) {
        console.error('AI processing error:', error);
        throw new Error(`AI processing failed: ${error.message}`);
    }
}

async function extractTextWithVision(imageUrl) {
    try {
        const [result] = await visionClient.textDetection(imageUrl);
        const detections = result.textAnnotations;
        
        if (!detections || detections.length === 0) {
            return { fullText: '', blocks: [], confidence: 0 };
        }

        return {
            fullText: detections[0].description,
            blocks: detections.slice(1).map(detection => ({
                text: detection.description,
                confidence: detection.confidence || 0.8,
                bounds: detection.boundingPoly
            })),
            confidence: 0.9
        };
    } catch (error) {
        console.error('Vision API error:', error);
        throw new Error(`OCR failed: ${error.message}`);
    }
}

async function extractWithGemini(imageUrl, ocrResults, carrierModel) {
    try {
        console.log('🤖 Extracting with Gemini using enhanced prompt:', imageUrl);
        
        const axios = require('axios');
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const base64Data = buffer.toString('base64');
        
        const mimeType = imageUrl.toLowerCase().includes('.pdf') ? 'application/pdf' : 'image/jpeg';
        
        const prompt = `
        You are an expert AI invoice processing system. Analyze this invoice document and extract the following information. 
        Respond ONLY with a JSON object. Ensure all fields are present, even if empty or null.

        SPECIAL INSTRUCTIONS FOR POLARIS TRANSPORT CARRIERS:
        - For billOfLading/shipment ID: Remove any prefixes like "SI:", "Shipment:", "BOL:" - extract only the actual ID (e.g., "SI: ICAL-23KDTK" should be "ICAL-23KDTK")
        - For totalAmount: Extract the final total with currency exactly as shown (e.g., "$247.09 CAD" should be amount: 247.09, currency: "CAD")
        - For charges: Extract ALL line items including descriptions, amounts, and rates. Look for items like freight charges, border fees, fuel surcharges, etc.

        {\
            "carrierInformation": {\
                "company": "string | null",\
                "address": "string | null",\
                "phone": "string | null",\
                "fax": "string | null"\
            },\
            "invoiceDetails": {\
                "invoiceNumber": "string | null",\
                "invoiceDate": "string | null",
                "billOfLading": "string | null (REMOVE prefixes like SI:, Shipment:, BOL:)"\
            },\
            "shipmentReferences": {\
                "purchaseOrder": "string | null",\
                "papsLabel": "string | null"\
            },\
            "shipper": {\
                "company": "string | null",
                "address": "string | null"\
            },\
            "consignee": {\
                "company": "string | null",
                "address": "string | null"\
            },\
            "packageDetails": [\
                {\
                    "quantity": "number | null",
                    "description": "string | null",
                    "weight": "string | null",
                    "dimensions": "string | null"\
                }\
            ],\
            "charges": [\
                {\
                    "description": "string | null (e.g., LAPTOP, BORDER FEE, FUEL SURCHARGE)",
                    "amount": "number | null (numeric value only)",
                    "rate": "string | null (percentage or rate info)"\
                }\
            ],\
            "totalAmount": {\
                "amount": "number | null (numeric value only)",
                "currency": "string | null (e.g., CAD, USD, CAN Funds)"\
            }\
        }\
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
        console.log('DEBUG: Raw text from Gemini before cleaning:', text);
        
        // CRITICAL FIX: Gemini often wraps JSON in markdown code blocks (```json ... ```)
        // We need to strip this wrapper before parsing.
        let cleanedText = text.trim();
        console.log('DEBUG: Cleaned text after initial trim:', cleanedText);

        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.substring(7);
            console.log('DEBUG: Cleaned text after stripping ```json:', cleanedText);
        }
        if (cleanedText.endsWith('```')) {
            cleanedText = cleanedText.substring(0, cleanedText.length - 3);
            console.log('DEBUG: Cleaned text after stripping ```:', cleanedText);
        }
        cleanedText = cleanedText.trim(); // Trim again after stripping
        console.log('DEBUG: Final cleaned text before JSON.parse():', cleanedText);

        try {
            const extractedData = JSON.parse(cleanedText);
            console.log('Gemini extraction successful with enhanced prompt.');
            return {
                extractedData,
                confidence: extractedData.confidence || 0.8,
                extractionQuality: extractedData.extractionQuality || 'medium',
                rawResponse: text
            };
        } catch (parseError) {
            console.warn('JSON parse error, using fallback extraction. Raw Gemini response:', text);
            return {
                extractedData: {},
                confidence: 0.5,
                extractionQuality: 'low',
                rawResponse: text,
                error: 'Failed to parse AI response'
            };
        }

    } catch (error) {
        console.error('Gemini extraction error with enhanced prompt:', error);
        throw new Error(`Gemini processing failed: ${error.message}`);
    }
}

// Apply trained model patterns (e.g., from visual annotations or traditional rule sets)
async function applyTrainedModelPatterns(geminiResults, carrierModel) {
    try {
        console.log('🎯 Applying trained model patterns...');
        console.log('Model type:', carrierModel?.type || 'none');
        
        // If no carrierModel is provided, return raw Gemini results
        if (!carrierModel) {
            console.log('⛔ No model provided. Returning raw Gemini extraction.');
            return geminiResults;
        }

        const enhancedData = { ...geminiResults.extractedData };
        const enhancedFields = {};
        let confidenceBoost = 0;

        // Handle different model types
        if (carrierModel.type === 'visual_annotation_based') {
            console.log('🔧 Applying visual annotation enhancements...');
            
            // Apply visual training patterns to improve extraction
            const { visualAnnotations, extractedFeatures } = carrierModel;
            
            if (visualAnnotations && Object.keys(visualAnnotations).length > 0) {
                console.log('📍 Applying visual annotation patterns for fields:', Object.keys(visualAnnotations));
                
                // Use visual training to enhance field extraction confidence
                if (visualAnnotations.carrier && enhancedData.carrierInformation?.company) {
                    enhancedFields.carrier = true;
                    confidenceBoost += 0.1;
                }
                
                if (visualAnnotations.invoiceNumber && enhancedData.invoiceDetails?.invoiceNumber) {
                    enhancedFields.invoiceNumber = true;
                    confidenceBoost += 0.1;
                }
                
                if (visualAnnotations.totalAmount && enhancedData.totalAmount?.amount) {
                    enhancedFields.totalAmount = true;
                    confidenceBoost += 0.1;
                }
                
                if (visualAnnotations.charges && enhancedData.charges && enhancedData.charges.length > 0) {
                    enhancedFields.charges = true;
                    confidenceBoost += 0.15; // Higher boost for complex line items
                }
                
                console.log(`📈 Visual annotation confidence boost: +${confidenceBoost.toFixed(2)}`);
            }
            
            // Use pattern learning from extracted features
            if (extractedFeatures && extractedFeatures.length > 0) {
                console.log(`🧠 Learning from ${extractedFeatures.length} previous extractions`);
                // Could implement pattern matching logic here for further enhancement
            }
            
        } else if (carrierModel.type === 'traditional') {
            console.log('🔧 Applying traditional pattern enhancements...');
            const { numberFormats, chargeTypes, invoiceFormat } = carrierModel.patterns || {};
            
            // Enhance number extraction
            if (numberFormats && enhancedData.invoiceDetails?.invoiceNumber) {
                console.log('💡 Applying traditional number pattern.');
                enhancedFields.invoiceNumber = true;
            }
            
            // Enhance charge type classification
            if (chargeTypes && enhancedData.charges) {
                enhancedData.charges = enhancedData.charges.map(item => ({
                    ...item,
                    type: classifyChargeType(item.description, chargeTypes)
                }));
                console.log('💡 Applying traditional charge type classification.');
                enhancedFields.charges = true;
            }
        }

        // Return enhanced data
        return {
            ...geminiResults,
            extractedData: enhancedData,
            confidence: Math.min(geminiResults.confidence + confidenceBoost, 0.95), // Cap at 95%
            modelEnhancements: true,
            enhancedFields,
            modelVersion: carrierModel?.version,
            modelType: carrierModel?.type,
            sampleCount: carrierModel?.sampleCount
        };

    } catch (error) {
        console.warn('Model pattern application error (returning original):', error);
        return geminiResults; // Return original if any error during enhancement
    }
}

function applyNumberPattern(number, patterns) {
    // Apply known number formatting patterns
    for (const pattern of patterns) {
        if (new RegExp(pattern).test(number)) {
            return number; // Already matches pattern
        }
    }
    return number; // Return as-is if no pattern matches
}

function classifyChargeType(description, knownTypes) {
    const desc = description.toLowerCase();
    
    for (const type of knownTypes) {
        if (desc.includes(type.toLowerCase())) {
            return type;
        }
    }
    
    // Default classification
    if (desc.includes('freight') || desc.includes('shipping')) return 'Freight';
    if (desc.includes('fuel') || desc.includes('surcharge')) return 'Fuel Surcharge';
    if (desc.includes('accessorial') || desc.includes('handling')) return 'Accessorial';
    
    return 'Other';
}

async function calculateAccuracyMetrics(aiResults, expectedResults) {
    try {
        const metrics = {
            overall: 0,
            fieldAccuracy: {},
            confidence: aiResults.confidence || 0,
            extractionQuality: 'medium'
        };

        const extractedData = aiResults.enhancedResults?.extractedData || aiResults.extractedData || {};
        
        // Define the fields to compare and their paths in the new, structured format
        const fieldsToCompare = [
            { name: 'carrier', extractedPath: 'carrierInformation.company', expectedPath: 'carrier' },
            { name: 'invoiceNumber', extractedPath: 'invoiceDetails.invoiceNumber', expectedPath: 'invoiceNumber' },
            { name: 'totalAmount', extractedPath: 'totalAmount.amount', expectedPath: 'totalAmount' },
            { name: 'billOfLading', extractedPath: 'invoiceDetails.billOfLading', expectedPath: 'shipmentIds' }, // Mapping expected 'shipmentIds' to extracted 'billOfLading'
            { name: 'invoiceTerms', extractedPath: 'invoiceDetails.invoiceDate', expectedPath: 'invoiceTerms' },
            { name: 'shipper', extractedPath: 'shipper.company', expectedPath: 'shipper' },
            { name: 'consignee', extractedPath: 'consignee.company', expectedPath: 'consignee' },
            { name: 'weightDimensions', extractedPath: 'packageDetails', expectedPath: 'weightDimensions' }
        ];

        let totalAccuracy = 0;
        let fieldsCompared = 0;

        for (const fieldDef of fieldsToCompare) {
            const extractedValue = getNestedValue(extractedData, fieldDef.extractedPath);
            const expectedValue = getNestedValue(expectedResults, fieldDef.expectedPath);

            if (expectedValue !== null && expectedValue !== undefined && extractedValue !== null && extractedValue !== undefined) {
                const accuracy = calculateFieldAccuracy(extractedValue, expectedValue);
                metrics.fieldAccuracy[fieldDef.name] = accuracy;
                totalAccuracy += accuracy;
                fieldsCompared++;
            }
        }

        // Helper to get nested values
        function getNestedValue(obj, path) {
            return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : null, obj);
        }

        // Calculate overall accuracy
        metrics.overall = fieldsCompared > 0 ? totalAccuracy / fieldsCompared : 0;
        
        // Determine extraction quality
        if (metrics.overall >= 0.9) metrics.extractionQuality = 'high';
        else if (metrics.overall >= 0.7) metrics.extractionQuality = 'medium';
        else metrics.extractionQuality = 'low';

        return metrics;

    } catch (error) {
        console.error('Accuracy calculation error:', error);
        return {
            overall: 0,
            fieldAccuracy: {},
            confidence: 0.5,
            extractionQuality: 'low',
            error: error.message
        };
    }
}

function calculateFieldAccuracy(extracted, expected) {
    if (!extracted || !expected) return 0;
    
    const extractedStr = String(extracted).toLowerCase().trim();
    const expectedStr = String(expected).toLowerCase().trim();
    
    if (extractedStr === expectedStr) return 1.0;
    
    // Calculate similarity for partial matches
    const similarity = calculateStringSimilarity(extractedStr, expectedStr);
    return Math.max(similarity, 0);
}

function calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
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

async function generateQualityMetrics(aiResults) {
    // Generate quality metrics when no expected results are provided
    const extractedData = aiResults.enhancedResults?.extractedData || aiResults.extractedData || {};
    
    const metrics = {
        overall: aiResults.confidence || 0.75,
        fieldAccuracy: {},
        confidence: aiResults.confidence || 0.75,
        extractionQuality: aiResults.extractionQuality || 'medium',
        completeness: 0
    };

    // Calculate completeness based on required fields (using correct nested paths)
    const requiredFieldPaths = [
        { name: 'carrier', path: 'carrierInformation.company' },
        { name: 'invoiceNumber', path: 'invoiceDetails.invoiceNumber' },
        { name: 'totalAmount', path: 'totalAmount.amount' },
        { name: 'billOfLading', path: 'invoiceDetails.billOfLading' },
        { name: 'invoiceTerms', path: 'invoiceDetails.invoiceDate' },
        { name: 'shipper', path: 'shipper.company' },
        { name: 'consignee', path: 'consignee.company' },
        { name: 'weightDimensions', path: 'packageDetails' }
    ];
    
    const extractedFields = requiredFieldPaths.filter(fieldDef => {
        const value = getNestedValue(extractedData, fieldDef.path);
        return value !== null && value !== undefined;
    });
    metrics.completeness = extractedFields.length / requiredFieldPaths.length;

    // Estimate field accuracy based on confidence and patterns (using correct nested paths)
    requiredFieldPaths.forEach(fieldDef => {
        const value = getNestedValue(extractedData, fieldDef.path);
        if (value !== null && value !== undefined) {
            metrics.fieldAccuracy[fieldDef.name] = Math.min(metrics.confidence + 0.1, 0.95);
        } else {
            metrics.fieldAccuracy[fieldDef.name] = 0;
        }
    });

    // Helper function for nested value access
    function getNestedValue(obj, path) {
        return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : null, obj);
    }

    return metrics;
}

async function generateTestingRecommendations(aiResults, accuracyMetrics, carrierModel, carrierId) {
    const recommendations = [];
    
    // Analyze accuracy metrics
    if (accuracyMetrics.overall < 0.7) {
        recommendations.push({
            type: 'accuracy',
            priority: 'high',
            title: 'Low Overall Accuracy Detected',
            description: `Current accuracy is ${Math.round(accuracyMetrics.overall * 100)}%. Consider adding more training samples.`,
            action: 'Add 5-10 more training samples with similar invoice formats'
        });
    }

    // Check specific field accuracy
    Object.entries(accuracyMetrics.fieldAccuracy || {}).forEach(([field, accuracy]) => {
        if (accuracy < 0.8) {
            recommendations.push({
                type: 'field_accuracy',
                priority: 'medium',
                title: `${field} Extraction Needs Improvement`,
                description: `${field} accuracy is ${Math.round(accuracy * 100)}%`,
                action: `Focus on training samples with clear ${field} examples`
            });
        }
    });

    // Check confidence levels
    if (aiResults.confidence < 0.8) {
        recommendations.push({
            type: 'confidence',
            priority: 'medium',
            title: 'Low Confidence Scores',
            description: 'AI model shows uncertainty in extraction results',
            action: 'Add more diverse training samples to improve model confidence'
        });
    }

    // Model-specific recommendations
    if (!carrierModel) {
        recommendations.push({
            type: 'training',
            priority: 'high',
            title: 'No Trained Model Found',
            description: 'No specific model training detected for this carrier',
            action: 'Complete the visual training workflow with 1+ annotated samples'
        });
    } else if (carrierModel.type === 'visual_annotation_based') {
        // Visual training is active - provide appropriate recommendations
        if (carrierModel.sampleCount >= 3) {
            recommendations.push({
                type: 'training',
                priority: 'low',
                title: 'Visual Training Active',
                description: `${carrierModel.sampleCount} visual training samples available. Model is operational.`,
                action: 'Add more samples to further improve accuracy (optional)'
            });
        } else if (carrierModel.sampleCount >= 1) {
            recommendations.push({
                type: 'training',
                priority: 'medium',
                title: 'Minimal Visual Training',
                description: `${carrierModel.sampleCount} visual training sample(s) available. Model is functional.`,
                action: 'Consider adding 2-3 more samples for better robustness'
            });
        }
    } else if (carrierModel.type === 'traditional' && carrierModel.sampleCount < 10) {
        recommendations.push({
            type: 'training',
            priority: 'medium',
            title: 'Limited Training Data',
            description: `Only ${carrierModel.sampleCount} training samples available`,
            action: 'Add more training samples for better accuracy (recommended: 10-15 samples)'
        });
    }

    return recommendations;
}

async function updateCarrierTestingStats(carrierId, testResults) {
    try {
        const statsRef = db.collection('carrierTestingStats').doc(carrierId);
        
        await statsRef.set({
            lastTested: admin.firestore.FieldValue.serverTimestamp(),
            totalTests: admin.firestore.FieldValue.increment(1),
            averageAccuracy: testResults.accuracyMetrics.overall,
            lastAccuracy: testResults.accuracyMetrics.overall,
            testingHistory: admin.firestore.FieldValue.arrayUnion({
                testId: testResults.testId,
                accuracy: testResults.accuracyMetrics.overall,
                confidence: testResults.accuracyMetrics.confidence,
                timestamp: new Date().toISOString()
            })
        }, { merge: true });

        console.log(`Updated testing stats for carrier: ${carrierId}`);
    } catch (error) {
        console.error('Error updating testing stats:', error);
    }
}
