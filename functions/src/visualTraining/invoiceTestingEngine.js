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
        maxOutputTokens: 32768, // Increased for large multi-shipment invoices
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
        console.log('🔍 DEBUGGING: About to call processInvoiceWithAI in testCarrierModel');
        const aiResults = await processInvoiceWithAI(downloadURL, carrierModel, carrierId);
        console.log('🔍 DEBUGGING: processInvoiceWithAI returned:', {
            hasAiResults: !!aiResults,
            aiResultsKeys: aiResults ? Object.keys(aiResults) : 'null',
            hasExtractedData: !!aiResults?.extractedData,
            extractedDataKeys: aiResults?.extractedData ? Object.keys(aiResults.extractedData) : 'null',
            hasEnhancedResults: !!aiResults?.enhancedResults,
            enhancedResultsKeys: aiResults?.enhancedResults ? Object.keys(aiResults.enhancedResults) : 'null'
        });
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

async function processInvoiceWithAI(downloadURL, carrierModel, carrierId = null) {
    try {
        console.log('🤖 Processing invoice with AI...');

        // Step 1: OCR with Google Vision
        const ocrResults = await extractTextWithVision(downloadURL);
        
        // Step 2: Enhanced extraction with Gemini
        console.log('🔍 DEBUGGING: About to call extractWithGemini');
        const geminiResults = await extractWithGemini(downloadURL, ocrResults, carrierModel, carrierId);
        console.log('🔍 DEBUGGING: Gemini results received:', {
            hasExtractedData: !!geminiResults.extractedData,
            extractedDataKeys: geminiResults.extractedData ? Object.keys(geminiResults.extractedData) : 'null',
            confidence: geminiResults.confidence
        });
        
        // Step 3: Apply trained model patterns if available
        console.log('🔍 DEBUGGING: About to apply trained model patterns, carrierModel exists:', !!carrierModel);
        const enhancedResults = carrierModel 
            ? await applyTrainedModelPatterns(geminiResults, carrierModel)
            : geminiResults;
        console.log('🔍 DEBUGGING: Enhanced results after pattern application:', {
            hasExtractedData: !!enhancedResults.extractedData,
            extractedDataKeys: enhancedResults.extractedData ? Object.keys(enhancedResults.extractedData) : 'null',
            confidence: enhancedResults.confidence
        });

        const finalResult = {
            ocrResults,
            geminiResults,
            enhancedResults,
            confidence: enhancedResults.confidence || 0.75,
            extractedData: enhancedResults.extractedData || {},
            processingTime: new Date().toISOString()
        };
        
        console.log('🔍 DEBUGGING: Final processInvoiceWithAI result structure:', {
            hasOcrResults: !!finalResult.ocrResults,
            hasGeminiResults: !!finalResult.geminiResults,
            hasEnhancedResults: !!finalResult.enhancedResults,
            hasExtractedData: !!finalResult.extractedData,
            extractedDataKeys: finalResult.extractedData ? Object.keys(finalResult.extractedData) : 'null',
            confidence: finalResult.confidence
        });

        return finalResult;

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

// Transform flat extraction format to structured format expected by frontend
function transformToStructuredFormat(flatData) {
    console.log('🔧 Transforming flat data to structured format:', flatData);
    
    const structuredData = {
        carrierInformation: {
            company: flatData.carrier || null,
            address: flatData.carrier_address || null,
            phone: flatData.carrier_phone || null,
            fax: flatData.carrier_fax || null,
            email: flatData.carrier_email || null,
            taxNumber: flatData.carrier_tax || flatData.tax_number || null
        },
        invoiceDetails: {
            invoiceNumber: flatData.invoice_number || null,
            invoiceDate: flatData.invoice_date || null,
            dueDate: flatData.due_date || null,
            invoiceTerms: flatData.invoice_terms || flatData.payment_terms || null,
            billOfLading: flatData.shipment_ids && Array.isArray(flatData.shipment_ids) 
                ? flatData.shipment_ids.join(', ') || null 
                : flatData.bill_of_lading || null,
            customerNumber: flatData.customer_number || flatData.account_number || null
        },
        shipments: (() => {
            // Check if we have multiple shipments in the data
            if (flatData.shipments && Array.isArray(flatData.shipments)) {
                return flatData.shipments.map(shipment => ({
                    shipmentId: shipment.shipmentId || shipment.shipment_id || shipment.order_number || null,
                    trackingNumber: shipment.trackingNumber || shipment.tracking_number || null,
                    proNumber: shipment.proNumber || shipment.pro_number || null,
                    billOfLading: shipment.billOfLading || shipment.bill_of_lading || null,
                    service: shipment.service || shipment.serviceType || null,
                    deliveryDate: shipment.deliveryDate || shipment.delivery_date || null,
                    shipper: {
                        company: shipment.shipper?.company || shipment.shipper || null,
                        address: shipment.shipper?.address || shipment.shipper_address || null
                    },
                    consignee: {
                        company: shipment.consignee?.company || shipment.consignee || null,
                        address: shipment.consignee?.address || shipment.consignee_address || null
                    },
                    packageDetails: shipment.packageDetails || shipment.packages || [{
                        quantity: shipment.quantity || 1,
                        description: shipment.description || null,
                        weight: shipment.weight || null,
                        dimensions: shipment.dimensions || null
                    }],
                    charges: shipment.charges || [],
                    totalAmount: shipment.totalAmount || shipment.total || 0
                }));
            } else {
                // Single shipment - convert legacy format to new structure
                return [{
                    shipmentId: flatData.shipment_id || flatData.shipmentId || flatData.shipment_number || 
                              flatData.reference_number || flatData.job_id || null,
                    trackingNumber: flatData.tracking_number || flatData.waybill || null,
                    proNumber: flatData.pro_number || null,
                    billOfLading: flatData.shipment_ids && Array.isArray(flatData.shipment_ids) 
                        ? flatData.shipment_ids.join(', ') || null 
                        : flatData.bill_of_lading || null,
                    service: flatData.service || flatData.service_type || null,
                    deliveryDate: flatData.delivery_date || null,
                    shipper: {
                        company: flatData.shipper || null,
                        address: flatData.shipper_address || null
                    },
                    consignee: {
                        company: flatData.consignee || null,
                        address: flatData.consignee_address || null
                    },
                    packageDetails: flatData.package_details || flatData.packages || [
                        // If no package details provided, create a basic one from total info if available
                        ...(flatData.total && !flatData.package_details && !flatData.packages ? 
                            [{
                                description: 'Shipment',
                                weight: 'Not specified',
                                dimensions: 'Not specified'
                            }] : []
                        )
                    ],
                    charges: flatData.charges || [],
                    totalAmount: flatData.total || flatData.totalAmount || 0
                }];
            }
        })(),
        invoiceSummary: {
            totalShipments: flatData.shipments ? flatData.shipments.length : 1,
            subtotal: flatData.subtotal || null,
            totalTax: flatData.total_tax || flatData.tax_amount || null,
            totalAmount: flatData.total || flatData.total_amount || null,
            currency: flatData.currency || flatData.total_currency || 'CAD',
            amountDue: flatData.amount_due || flatData.total || flatData.total_amount || null
        }
    };
    
    console.log('🔧 Structured data result:', structuredData);
    return structuredData;
}

async function extractWithGemini(imageUrl, ocrResults, carrierModel, carrierId = null) {
    try {
        console.log('🤖 Extracting with Gemini using enhanced prompt:', imageUrl);
        
        const axios = require('axios');
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const base64Data = buffer.toString('base64');
        
        const mimeType = imageUrl.toLowerCase().includes('.pdf') ? 'application/pdf' : 'image/jpeg';
        
        // Try to get carrier-specific prompt first
        let prompt = await getCarrierSpecificPrompt(carrierId);
        
        // If no carrier-specific prompt, use enhanced generic prompt
        if (!prompt) {
            prompt = `
You are an expert AI invoice processing system specializing in transportation, logistics, and freight carrier invoices. Analyze this document with extreme precision and extract ALL relevant information. Return ONLY a JSON object - no explanatory text before or after.

## DOCUMENT ANALYSIS INSTRUCTIONS

### STEP 1: DOCUMENT IDENTIFICATION
- Determine if this is an invoice, bill of lading, freight bill, or shipping document
- Identify the carrier/company from header, logo, or footer areas
- Look for document numbers in top-right, top-left, or header sections

### STEP 2: SYSTEMATIC FIELD EXTRACTION

#### CARRIER INFORMATION (Usually in header/top section):
- Extract company name exactly as written (remove "Inc.", "Ltd.", "LLC" only if needed for clarity)
- Full address including street, city, province/state, postal/zip code, country
- All contact details: phone, fax, email, website
- Tax numbers, GST/HST numbers if visible

#### INVOICE DETAILS (Usually top-right or center):
- Invoice number (remove prefixes: "Invoice #", "INV:", "No.", "#")
- Invoice date (standardize to YYYY-MM-DD format)
- Due date or payment date if shown
- Reference numbers, PO numbers, customer numbers

#### SHIPMENT IDENTIFIERS (Multiple locations possible):
- **SHIPMENT ID (CRITICAL)**: Look for shipment numbers, job IDs, or reference numbers that match internal systems
- Bill of Lading (BOL) numbers - remove prefixes like "BOL:", "B/L:", "SI:"
- Shipment IDs, waybill numbers, tracking numbers
- Pro numbers, job numbers, reference numbers
- Customer reference numbers, PO numbers

**PRIORITY EXTRACTION**: Shipment ID is essential for matching to internal shipment records. Look for:
- Alphanumeric codes like "IC-CUSTOMER-123ABC" 
- Job numbers, reference numbers, or shipment numbers
- Any identifier that could link to internal shipment tracking

#### SHIPPER (Ship From) - Usually left side or top section:
- Complete company name
- Full address with postal/zip code
- Contact person name and phone if shown
- Pickup date/time if visible

#### CONSIGNEE (Ship To) - Usually right side or middle section:
- Complete company name  
- Full address with postal/zip code
- Contact person name and phone if shown
- Delivery date/time if visible

#### PACKAGE/FREIGHT DETAILS (Usually in table format):
- Quantity/pieces count
- Package type (pallets, boxes, crates, etc.)
- Description of goods/commodities
- Weight (total and per piece if shown)
- Dimensions (L×W×H) if provided
- Declared value or insurance amount

#### CHARGES BREAKDOWN (Usually in table with multiple rows):
Extract ALL line items including:
- Base freight charges ("Freight", "Transportation", "Linehaul")
- Fuel surcharges ("Fuel", "FSC", "Fuel Surcharge") 
- Accessorial charges ("Liftgate", "Inside Delivery", "Residential")
- Border/customs fees ("Border Fee", "Customs", "Brokerage")
- Insurance charges
- Storage/detention fees
- Handling charges
- Any other fees or surcharges

For each charge:
- Description exactly as written
- Amount as pure number (remove $, commas, currency symbols)
- Rate/percentage if shown (e.g., "2.5%", "$0.15/lb")

#### PAYMENT & TERMS:
- Payment terms ("Net 30", "Due on Receipt", "COD", "Prepaid")
- Payment method (check, wire, credit card)
- Due date or discount terms
- Late fees or interest rates

#### TOTALS & CURRENCY:
- Subtotal before taxes
- Tax amounts (GST, HST, PST, sales tax) with rates
- Total amount including all taxes and fees
- Currency (CAD, USD, or other)

## EXTRACTION PATTERNS & RULES

### NUMBER CLEANING RULES:
- Remove currency symbols: "$1,234.56" → 1234.56
- Remove prefixes: "Invoice #12345" → "12345"
- Clean references: "BOL: ABC-123" → "ABC-123"
- Parse weights: "2,500 lbs" → "2500 lbs"

### DATE STANDARDIZATION:
- Convert all dates to YYYY-MM-DD format
- Handle formats: MM/DD/YYYY, DD/MM/YYYY, DD-MMM-YYYY
- Examples: "Dec 15, 2024" → "2024-12-15"

### ADDRESS STANDARDIZATION:
- Include full address on single line with commas
- Format: "123 Main St, Anytown, ON, L1A 2B3, Canada"
- Separate company name from address

### CHARGE CLASSIFICATION:
- Group similar charges together
- Standardize descriptions: "Fuel Sur" → "Fuel Surcharge"
- Ensure amounts are numeric only
- Include tax breakdown separately

### VALIDATION RULES:
- Verify total equals sum of line items + taxes
- Check that required fields (invoice #, amount) are present
- Ensure dates are logical (invoice date ≤ due date)
- Validate that addresses include city and postal code

        {\
            "carrierInformation": {\
                "company": "string | null",\
                "address": "string | null",\
                "phone": "string | null",\
                "fax": "string | null",
                "email": "string | null",
                "taxNumber": "string | null"
            },
            "invoiceDetails": {\
                "invoiceNumber": "string | null",\
                "invoiceDate": "string | null",
                "billOfLading": "string | null (REMOVE prefixes like SI:, Shipment:, BOL:)",
                "invoiceTerms": "string | null (e.g., Net 30, Due on Receipt, COD)",
                "customerNumber": "string | null"
            },
            "shipments": [\
                {\
                    "shipmentId": "string | null (CRITICAL: Order No or shipment ID)",
                    "trackingNumber": "string | null",
                    "proNumber": "string | null",
                    "billOfLading": "string | null",
                    "service": "string | null (e.g., LTL RUSH, LTL DIRECT, LTL SAMEDAY)",
                    "deliveryDate": "string | null",
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
                            "description": "string | null (e.g., Base, Fuel, Weight, Wait)",
                            "amount": "number | null (numeric value only)",
                            "rate": "string | null"\
                        }\
                    ],\
                    "totalAmount": "number | null (total for THIS shipment)"\
                }\
            ],\
            "invoiceSummary": {
                "totalShipments": "number | null (count of shipments)",
                "subtotal": "number | null",
                "totalTax": "number | null",
                "totalAmount": "number | null (grand total of all shipments)",
                "currency": "string | null (e.g., CAD, USD)",
                "amountDue": "number | null"
            }
        }

## CRITICAL REQUIREMENTS FOR MULTI-SHIPMENT INVOICES:
1. IF multiple shipments detected, create separate entries in "shipments" array
2. Each shipment MUST have its own charges array
3. Match charges to the correct shipment based on table structure
4. Preserve shipment-specific details (Order No, destinations, services)
5. Calculate individual shipment totals
6. Ensure overall invoice total matches sum of all shipments
7. Numbers must be pure numeric values (no currency symbols)
8. Addresses must be complete and properly formatted
9. Dates must be in YYYY-MM-DD format
10. Extract ALL charges found, no matter how small
11. Use exact text from document, don't paraphrase
12. Double-check all extracted amounts add up correctly\
        `;
        }

        const hasCarrierPrompt = prompt !== null && prompt !== undefined;
        console.log('🔄 Using carrier-specific prompt:', hasCarrierPrompt ? 'Yes' : 'No (using generic)');

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
            console.log('🔍 DEBUGGING: About to parse JSON from Gemini');
            let extractedData = JSON.parse(cleanedText);
            console.log('🔍 DEBUGGING: Successfully parsed JSON:', extractedData);
            console.log('🔍 DEBUGGING: Extracted data keys:', Object.keys(extractedData));
            
            // Transform flat format to structured format if needed
            if (extractedData.carrier && !extractedData.carrierInformation) {
                console.log('🔧 DEBUGGING: Converting flat format to structured format');
                console.log('🔧 DEBUGGING: Original flat data:', extractedData);
                extractedData = transformToStructuredFormat(extractedData);
                console.log('🔧 DEBUGGING: Transformed data keys:', Object.keys(extractedData));
                console.log('🔧 DEBUGGING: Transformed data structure:', JSON.stringify(extractedData, null, 2));
            }
            
            // Apply charge code normalization for better frontend matching
            if (extractedData.charges && Array.isArray(extractedData.charges)) {
                extractedData.charges = extractedData.charges.map(charge => {
                    const description = charge.description || '';
                    const desc = description.toLowerCase();
                    
                    // Map charge description to standard code
                    let code = 'FRT'; // Default to freight
                    if (desc.includes('freight') || desc.includes('shipping') || desc.includes('transport')) {
                        code = 'FRT';
                    } else if (desc.includes('fuel') || desc.includes('surcharge')) {
                        code = 'FSC';
                    } else if (desc.includes('handling') || desc.includes('accessorial') || desc.includes('special')) {
                        code = 'ACC';
                    } else if (desc.includes('border') || desc.includes('customs') || desc.includes('duty')) {
                        code = 'BOR';
                    } else if (desc.includes('insurance') || desc.includes('coverage')) {
                        code = 'INS';
                    }
                    
                    // Ensure amount is properly formatted as number
                    let amount = charge.amount;
                    if (typeof amount === 'string') {
                        amount = parseFloat(amount.replace(/[^0-9.-]/g, ''));
                    }
                    if (isNaN(amount)) amount = 0;
                    
                    // Add code to charge for better matching
                    return {
                        description: description || 'Charge',
                        amount: amount,
                        rate: charge.rate || null,
                        code: code,
                        originalDescription: description
                    };
                });
                
                console.log('Applied charge code mapping to extracted charges:', extractedData.charges);
            }
            
            console.log('🔍 DEBUGGING: Gemini extraction successful with enhanced prompt.');
            console.log('🔍 DEBUGGING: About to return extraction result with keys:', Object.keys(extractedData));
            const result = {
                extractedData,
                confidence: extractedData.confidence || 0.8,
                extractionQuality: extractedData.extractionQuality || 'medium',
                rawResponse: text,
                metadata: {
                    usedCarrierSpecificPrompt: hasCarrierPrompt,
                    carrierId: carrierModel?.carrierId || carrierId || null
                }
            };
            console.log('🔍 DEBUGGING: Final extraction result structure:', {
                hasExtractedData: !!result.extractedData,
                extractedDataKeys: result.extractedData ? Object.keys(result.extractedData) : 'null',
                confidence: result.confidence,
                hasMetadata: !!result.metadata
            });
            return result;
        } catch (parseError) {
            console.warn('JSON parse error, attempting fallback extraction. Parse error:', parseError.message);
            console.warn('Raw Gemini response length:', text.length);
            console.warn('Cleaned text length:', cleanedText.length);
            
            // Try to extract partial data from incomplete JSON
            let fallbackData = {};
            
            try {
                // Extract basic fields even from incomplete JSON
                const carrierMatch = cleanedText.match(/"company":\s*"([^"]+)"/);
                const invoiceNumberMatch = cleanedText.match(/"invoiceNumber":\s*"([^"]+)"/);
                const invoiceDateMatch = cleanedText.match(/"invoiceDate":\s*"([^"]+)"/);
                const subtotalMatch = cleanedText.match(/"subtotal":\s*([0-9.]+)/);
                const totalAmountMatch = cleanedText.match(/"amount":\s*([0-9.]+)/);
                const currencyMatch = cleanedText.match(/"currency":\s*"([^"]+)"/);
                
                if (carrierMatch || invoiceNumberMatch || subtotalMatch) {
                    fallbackData = {
                        carrierInformation: {
                            company: carrierMatch ? carrierMatch[1] : null
                        },
                        invoiceDetails: {
                            invoiceNumber: invoiceNumberMatch ? invoiceNumberMatch[1] : null,
                            invoiceDate: invoiceDateMatch ? invoiceDateMatch[1] : null
                        },
                        totalAmount: {
                            subtotal: subtotalMatch ? parseFloat(subtotalMatch[1]) : null,
                            amount: totalAmountMatch ? parseFloat(totalAmountMatch[1]) : null,
                            currency: currencyMatch ? currencyMatch[1] : 'CAD'
                        },
                        charges: [],
                        packageDetails: []
                    };
                    
                    console.log('🔧 Extracted fallback data from incomplete JSON:', fallbackData);
                }
            } catch (fallbackError) {
                console.warn('Fallback extraction also failed:', fallbackError.message);
            }
            
            return {
                extractedData: fallbackData,
                confidence: Object.keys(fallbackData).length > 0 ? 0.6 : 0.3,
                extractionQuality: Object.keys(fallbackData).length > 0 ? 'partial' : 'low',
                rawResponse: text,
                error: 'JSON parsing failed, used fallback extraction',
                metadata: {
                    usedCarrierSpecificPrompt: hasCarrierPrompt,
                    carrierId: carrierModel?.carrierId || carrierId || null,
                    parseError: parseError.message,
                    responseLength: text.length,
                    cleanedLength: cleanedText.length
                }
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

/**
 * Load carrier-specific prompt from database
 */
async function getCarrierSpecificPrompt(carrierId) {
    if (!carrierId) {
        console.log('⚠️ No carrierId provided for prompt lookup');
        return null;
    }

    try {
        const admin = require('firebase-admin');
        const db = admin.firestore();
        
        console.log(`🔍 Looking for carrier-specific prompt: ${carrierId}`);
        
        const promptDoc = await db.collection('carrierPrompts').doc(carrierId).get();
        
        if (!promptDoc.exists) {
            console.log(`📋 No carrier-specific prompt found for ${carrierId}`);
            return null;
        }

        const promptData = promptDoc.data();
        
        if (!promptData.isActive) {
            console.log(`⛔ Carrier prompt for ${carrierId} is not active`);
            return null;
        }

        console.log(`✅ Found carrier-specific prompt for ${carrierId} (version ${promptData.version})`);
        
        return promptData.generatedPrompt;

    } catch (error) {
        console.error(`❌ Error loading carrier prompt for ${carrierId}:`, error);
        return null;
    }
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
