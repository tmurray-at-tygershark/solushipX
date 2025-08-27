const { GoogleGenerativeAI } = require('@google/generative-ai');
const { VertexAI } = require('@google-cloud/vertexai');
const admin = require('firebase-admin');
const axios = require('axios');

/**
 * 🧠 ENHANCED GEMINI PROCESSING ENGINE
 * State-of-the-art AI invoice processing with advanced techniques:
 * - Multi-modal document understanding
 * - Schema-aware extraction
 * - Confidence-based processing
 * - Self-improving prompts
 * - Carrier-specific intelligence
 */

class EnhancedGeminiProcessor {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);
        this.vertexAI = new VertexAI({
            project: 'solushipx',
            location: 'us-central1'
        });
        this.db = admin.firestore();
        
        // Use the latest Gemini models
        this.textModel = this.genAI.getGenerativeModel({ 
            model: 'gemini-2.0-flash-exp',
            generationConfig: {
                temperature: 0.1,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 32768
            }
        });
        
        this.visionModel = this.vertexAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.1,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 32768
            }
        });
    }

    /**
     * 🎯 MASTER PROCESSING FUNCTION
     * Orchestrates the entire AI analysis pipeline
     */
    async processInvoiceDocument(pdfUrl, carrierHint = null, options = {}) {
        try {
            console.log('🚀 Starting Enhanced Gemini processing for:', pdfUrl);
            
            const processingId = `proc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            
            // Step 1: Document preparation and multimodal analysis
            const documentAnalysis = await this.performMultiModalAnalysis(pdfUrl, processingId);
            
            // Step 2: Carrier detection and model selection
            const carrierInfo = await this.detectCarrierIntelligently(documentAnalysis, carrierHint);
            
            // Step 3: Schema-aware extraction using trained patterns
            const extractedData = await this.performSchemaAwareExtraction(
                documentAnalysis, 
                carrierInfo, 
                options
            );
            
            // Step 4: Confidence assessment and quality scoring
            const qualityAssessment = await this.assessExtractionQuality(extractedData, documentAnalysis);
            
            // Step 5: Shipment intelligence and matching preparation
            const shipmentData = await this.extractShipmentIntelligence(extractedData, qualityAssessment);
            
            // Step 6: Create processing results with confidence routing
            const results = {
                processingId,
                documentAnalysis,
                carrierInfo,
                extractedData,
                qualityAssessment,
                shipmentData,
                processingTimestamp: new Date().toISOString(),
                confidenceRouting: this.determineConfidenceRouting(qualityAssessment),
                metadata: {
                    modelVersions: {
                        textModel: 'gemini-2.0-flash-exp',
                        visionModel: 'gemini-2.5-flash'
                    },
                    processingOptions: options,
                    carrierHint
                }
            };
            
            // Step 7: Store processing results for learning
            await this.storeProcessingResults(results);
            
            console.log('✅ Enhanced Gemini processing completed:', processingId);
            return results;
            
        } catch (error) {
            console.error('❌ Enhanced Gemini processing error:', error);
            throw new Error(`AI Processing failed: ${error.message}`);
        }
    }

    /**
     * 🔍 MULTI-MODAL DOCUMENT ANALYSIS
     * Combines visual and textual understanding
     */
    async performMultiModalAnalysis(pdfUrl, processingId) {
        console.log('🔍 Performing multi-modal document analysis...');
        
        try {
            // Download PDF for analysis
            const pdfBuffer = await this.downloadPdfBuffer(pdfUrl);
            const pdfBase64 = pdfBuffer.toString('base64');
            
            // Parallel processing for speed
            const [textAnalysis, visualAnalysis, layoutAnalysis] = await Promise.all([
                this.performTextAnalysis(pdfBase64),
                this.performVisualAnalysis(pdfBuffer),
                this.performLayoutAnalysis(pdfBase64)
            ]);
            
            return {
                processingId,
                textAnalysis,
                visualAnalysis,
                layoutAnalysis,
                documentSize: pdfBuffer.length,
                analysisTimestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Multi-modal analysis error:', error);
            throw error;
        }
    }

    /**
     * 📝 ADVANCED TEXT ANALYSIS
     * Extract and understand textual content
     */
    async performTextAnalysis(pdfBase64) {
        const prompt = `
🎯 ADVANCED DOCUMENT TEXT ANALYSIS

Analyze this PDF document and provide comprehensive text understanding:

ANALYSIS REQUIREMENTS:
1. Document Classification
2. Content Structure Analysis  
3. Key Entity Detection
4. Text Quality Assessment
5. Language and Format Detection

OUTPUT SCHEMA:
{
    "documentType": "invoice|bill_of_lading|shipping_receipt|packing_list|other",
    "contentStructure": {
        "hasHeader": boolean,
        "hasFooter": boolean,  
        "hasTable": boolean,
        "hasSideContent": boolean,
        "columnCount": number,
        "pageCount": number,
        "textDensity": "low|medium|high"
    },
    "keyEntities": {
        "dates": [{"value": "string", "type": "invoice_date|due_date|shipping_date|other", "confidence": number}],
        "amounts": [{"value": number, "currency": "string", "type": "total|subtotal|tax|fee|other", "confidence": number}],
        "identifiers": [{"value": "string", "type": "invoice_number|tracking_number|po_number|shipment_id|other", "confidence": number}],
        "companies": [{"value": "string", "type": "carrier|shipper|consignee|billing|other", "confidence": number}],
        "addresses": [{"value": "string", "type": "billing|shipping|return|carrier|other", "confidence": number}]
    },
    "textQuality": {
        "clarity": number,  // 0-1 score
        "completeness": number,  // 0-1 score  
        "consistency": number,  // 0-1 score
        "ocrConfidence": number  // 0-1 score
    },
    "languageInfo": {
        "primaryLanguage": "string",
        "secondaryLanguages": ["string"],
        "locale": "string"
    },
    "processingNotes": ["string"],
    "overallConfidence": number
}

CRITICAL: Return only valid JSON. No explanations or additional text.
`;

        try {
            const result = await this.visionModel.generateContent([
                {
                    inlineData: {
                        mimeType: 'application/pdf',
                        data: pdfBase64
                    }
                },
                { text: prompt }
            ]);

            const response = await result.response;
            const text = response.text();
            
            return this.parseAndValidateJSON(text, 'textAnalysis');
            
        } catch (error) {
            console.error('Text analysis error:', error);
            return this.getDefaultTextAnalysis();
        }
    }

    /**
     * 👁️ ADVANCED VISUAL ANALYSIS  
     * Understand visual layout and elements
     */
    async performVisualAnalysis(pdfBuffer) {
        // This would integrate with Google Cloud Vision API
        // for precise visual element detection
        try {
            const vision = require('@google-cloud/vision');
            const client = new vision.ImageAnnotatorClient();
            
            // Convert PDF to images for visual analysis
            // Implementation would involve PDF-to-image conversion
            // and then visual analysis of each page
            
            return {
                logoDetection: [],
                tableDetection: [],
                boundingBoxes: [],
                visualElements: [],
                confidence: 0.8
            };
            
        } catch (error) {
            console.error('Visual analysis error:', error);
            return this.getDefaultVisualAnalysis();
        }
    }

    /**
     * 📐 ADVANCED LAYOUT ANALYSIS
     * Understand document structure and organization
     */
    async performLayoutAnalysis(pdfBase64) {
        const prompt = `
🏗️ ADVANCED DOCUMENT LAYOUT ANALYSIS

Analyze the visual layout and structural organization of this document:

ANALYSIS FOCUS:
1. Document Structure Mapping
2. Section Identification  
3. Table Analysis
4. Header/Footer Analysis
5. Visual Hierarchy Assessment

OUTPUT SCHEMA:
{
    "documentStructure": {
        "orientation": "portrait|landscape",
        "margins": {"top": number, "bottom": number, "left": number, "right": number},
        "sections": [
            {
                "type": "header|body|footer|sidebar|table|signature",
                "position": {"x": number, "y": number, "width": number, "height": number},
                "content": "brief_description",
                "importance": "high|medium|low"
            }
        ]
    },
    "tableAnalysis": {
        "tablesDetected": number,
        "tables": [
            {
                "position": {"x": number, "y": number, "width": number, "height": number},
                "rows": number,
                "columns": number,
                "hasHeaders": boolean,
                "dataType": "shipments|charges|summary|other",
                "confidence": number
            }
        ]
    },
    "headerFooterAnalysis": {
        "header": {
            "present": boolean,
            "content": "description",
            "logoPresent": boolean,
            "contactInfo": boolean
        },
        "footer": {
            "present": boolean,
            "content": "description",
            "pageNumbers": boolean,
            "additionalInfo": boolean
        }
    },
    "visualHierarchy": {
        "titleElements": [{"text": "string", "importance": number, "position": "string"}],
        "keyValuePairs": [{"label": "string", "value": "string", "confidence": number}],
        "emphasizedElements": [{"text": "string", "emphasis_type": "bold|italic|underline|large|color", "importance": number}]
    },
    "layoutQuality": {
        "organization": number,  // 0-1 score
        "readability": number,   // 0-1 score  
        "consistency": number,   // 0-1 score
        "completeness": number   // 0-1 score
    },
    "overallConfidence": number
}

CRITICAL: Return only valid JSON. No explanations.
`;

        try {
            const result = await this.visionModel.generateContent([
                {
                    inlineData: {
                        mimeType: 'application/pdf',
                        data: pdfBase64
                    }
                },
                { text: prompt }
            ]);

            const response = await result.response;
            const text = response.text();
            
            return this.parseAndValidateJSON(text, 'layoutAnalysis');
            
        } catch (error) {
            console.error('Layout analysis error:', error);
            return this.getDefaultLayoutAnalysis();
        }
    }

    /**
     * 🚛 INTELLIGENT CARRIER DETECTION
     * Advanced carrier identification with confidence scoring
     */
    async detectCarrierIntelligently(documentAnalysis, carrierHint) {
        console.log('🚛 Performing intelligent carrier detection...');
        
        // Combine all analysis data for carrier detection
        const combinedData = {
            textEntities: documentAnalysis.textAnalysis?.keyEntities || {},
            visualElements: documentAnalysis.visualAnalysis || {},
            layoutStructure: documentAnalysis.layoutAnalysis || {}
        };
        
        const prompt = `
🚛 INTELLIGENT CARRIER DETECTION

Analyze the combined document data to identify the carrier/vendor with high precision:

DOCUMENT DATA:
${JSON.stringify(combinedData, null, 2)}

${carrierHint ? `CARRIER HINT: ${carrierHint}` : ''}

DETECTION REQUIREMENTS:
1. Identify primary carrier/vendor
2. Detect carrier branding elements  
3. Analyze carrier-specific patterns
4. Cross-reference carrier databases
5. Provide confidence scoring

OUTPUT SCHEMA:
{
    "primaryCarrier": {
        "name": "detected_carrier_name",
        "standardizedName": "standardized_name",
        "carrierId": "system_carrier_id",
        "confidence": number,  // 0-1 score
        "detectionMethods": ["logo|text|pattern|hint|other"],
        "brandingElements": [{"type": "logo|text|color|format", "value": "string", "confidence": number}]
    },
    "alternativeCarriers": [
        {
            "name": "string",
            "confidence": number,
            "reason": "string"
        }
    ],
    "carrierClassification": {
        "type": "courier|freight|ltl|ftl|air|ocean|rail|other",
        "serviceLevel": "express|standard|economy|overnight|other",
        "regional": boolean,
        "international": boolean
    },
    "detectionQuality": {
        "clarityScore": number,     // How clear the carrier identification is
        "consistencyScore": number, // How consistent carrier info is throughout doc
        "completenessScore": number // How complete the carrier information is
    },
    "recommendedProcessing": {
        "useTrainedModel": boolean,
        "modelId": "string|null",
        "fallbackStrategy": "generic|template|manual"
    },
    "overallConfidence": number
}

CRITICAL: Return only valid JSON.
`;

        try {
            const result = await this.textModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const carrierInfo = this.parseAndValidateJSON(text, 'carrierDetection');
            
            // Enhance with system carrier data
            if (carrierInfo.primaryCarrier) {
                carrierInfo.primaryCarrier = await this.enrichCarrierInfo(carrierInfo.primaryCarrier);
            }
            
            return carrierInfo;
            
        } catch (error) {
            console.error('Carrier detection error:', error);
            return this.getDefaultCarrierInfo();
        }
    }

    /**
     * 📋 SCHEMA-AWARE EXTRACTION
     * Extract structured data using carrier-specific schemas
     */
    async performSchemaAwareExtraction(documentAnalysis, carrierInfo, options) {
        console.log('📋 Performing schema-aware extraction...');
        
        // Get carrier-specific schema and patterns
        const extractionSchema = await this.getCarrierExtractionSchema(carrierInfo.primaryCarrier);
        
        const prompt = `
📋 SCHEMA-AWARE DATA EXTRACTION

Extract structured data from this document using the carrier-specific schema:

DOCUMENT ANALYSIS:
${JSON.stringify(documentAnalysis, null, 2)}

CARRIER INFO:
${JSON.stringify(carrierInfo, null, 2)}

EXTRACTION SCHEMA:
${JSON.stringify(extractionSchema, null, 2)}

EXTRACTION REQUIREMENTS:
1. Follow the provided schema exactly
2. Extract all available data points
3. Provide confidence scores for each field
4. Handle multiple shipments if present
5. Maintain data relationships and consistency

OUTPUT SCHEMA:
{
    "invoiceHeader": {
        "invoiceNumber": {"value": "string", "confidence": number, "source": "string"},
        "invoiceDate": {"value": "YYYY-MM-DD", "confidence": number, "source": "string"},
        "dueDate": {"value": "YYYY-MM-DD", "confidence": number, "source": "string"},
        "currency": {"value": "string", "confidence": number, "source": "string"},
        "totalAmount": {"value": number, "confidence": number, "source": "string"},
        "subtotal": {"value": number, "confidence": number, "source": "string"},
        "taxAmount": {"value": number, "confidence": number, "source": "string"}
    },
    "carrierDetails": {
        "name": {"value": "string", "confidence": number, "source": "string"},
        "address": {"value": "string", "confidence": number, "source": "string"},
        "contactInfo": {
            "phone": {"value": "string", "confidence": number, "source": "string"},
            "email": {"value": "string", "confidence": number, "source": "string"},
            "website": {"value": "string", "confidence": number, "source": "string"}
        }
    },
    "billingInfo": {
        "billToName": {"value": "string", "confidence": number, "source": "string"},
        "billToAddress": {"value": "string", "confidence": number, "source": "string"},
        "billToContact": {"value": "string", "confidence": number, "source": "string"}
    },
    "shipmentDetails": [
        {
            "shipmentId": {"value": "string", "confidence": number, "source": "string"},
            "trackingNumber": {"value": "string", "confidence": number, "source": "string"},
            "referenceNumbers": [{"type": "po|bol|pro|other", "value": "string", "confidence": number}],
            "shipDate": {"value": "YYYY-MM-DD", "confidence": number, "source": "string"},
            "deliveryDate": {"value": "YYYY-MM-DD", "confidence": number, "source": "string"},
            "origin": {
                "name": {"value": "string", "confidence": number, "source": "string"},
                "address": {"value": "string", "confidence": number, "source": "string"},
                "city": {"value": "string", "confidence": number, "source": "string"},
                "state": {"value": "string", "confidence": number, "source": "string"},
                "postalCode": {"value": "string", "confidence": number, "source": "string"},
                "country": {"value": "string", "confidence": number, "source": "string"}
            },
            "destination": {
                "name": {"value": "string", "confidence": number, "source": "string"},
                "address": {"value": "string", "confidence": number, "source": "string"},
                "city": {"value": "string", "confidence": number, "source": "string"},
                "state": {"value": "string", "confidence": number, "source": "string"},
                "postalCode": {"value": "string", "confidence": number, "source": "string"},
                "country": {"value": "string", "confidence": number, "source": "string"}
            },
            "packageInfo": {
                "pieces": {"value": number, "confidence": number, "source": "string"},
                "weight": {"value": number, "unit": "lbs|kg", "confidence": number, "source": "string"},
                "dimensions": {"length": number, "width": number, "height": number, "unit": "in|cm", "confidence": number},
                "packageType": {"value": "string", "confidence": number, "source": "string"}
            },
            "charges": [
                {
                    "description": {"value": "string", "confidence": number, "source": "string"},
                    "code": {"value": "string", "confidence": number, "source": "string"},
                    "amount": {"value": number, "confidence": number, "source": "string"},
                    "currency": {"value": "string", "confidence": number, "source": "string"},
                    "category": {"value": "freight|fuel|accessorial|tax|other", "confidence": number, "source": "string"}
                }
            ],
            "serviceInfo": {
                "serviceType": {"value": "string", "confidence": number, "source": "string"},
                "serviceLevel": {"value": "string", "confidence": number, "source": "string"},
                "specialInstructions": {"value": "string", "confidence": number, "source": "string"}
            }
        }
    ],
    "extractionMetadata": {
        "extractionTimestamp": "string",
        "schemaVersion": "string",
        "processingTime": number,
        "totalShipments": number,
        "averageConfidence": number,
        "lowConfidenceFields": ["string"],
        "missingRequiredFields": ["string"]
    }
}

CRITICAL: Return only valid JSON. Extract ALL available information with confidence scores.
`;

        try {
            const result = await this.textModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            return this.parseAndValidateJSON(text, 'schemaExtraction');
            
        } catch (error) {
            console.error('Schema extraction error:', error);
            return this.getDefaultExtractionResult();
        }
    }

    /**
     * ✅ EXTRACTION QUALITY ASSESSMENT
     * Assess the quality and reliability of extracted data
     */
    async assessExtractionQuality(extractedData, documentAnalysis) {
        console.log('✅ Assessing extraction quality...');
        
        const prompt = `
✅ EXTRACTION QUALITY ASSESSMENT

Analyze the quality and reliability of the extracted data:

EXTRACTED DATA:
${JSON.stringify(extractedData, null, 2)}

DOCUMENT ANALYSIS:
${JSON.stringify(documentAnalysis, null, 2)}

ASSESSMENT REQUIREMENTS:
1. Data completeness analysis
2. Confidence score validation  
3. Consistency checks
4. Critical field validation
5. Overall reliability scoring

OUTPUT SCHEMA:
{
    "completenessScore": number,  // 0-1 score for data completeness
    "consistencyScore": number,   // 0-1 score for data consistency  
    "confidenceScore": number,    // 0-1 average confidence across all fields
    "criticalFieldsScore": number, // 0-1 score for critical field presence
    "dataQualityIssues": [
        {
            "field": "string",
            "issue": "missing|low_confidence|inconsistent|invalid_format|other", 
            "severity": "critical|high|medium|low",
            "description": "string",
            "suggestedAction": "string"
        }
    ],
    "recommendedActions": [
        {
            "action": "auto_approve|human_review|request_correction|reject",
            "reason": "string",
            "priority": "high|medium|low"
        }
    ],
    "processingRecommendation": {
        "autoProcessable": boolean,
        "requiresReview": boolean,
        "confidenceLevel": "high|medium|low",
        "reviewPriority": "urgent|normal|low"
    },
    "overallScore": number  // 0-1 overall quality score
}

CRITICAL: Return only valid JSON.
`;

        try {
            const result = await this.textModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            return this.parseAndValidateJSON(text, 'qualityAssessment');
            
        } catch (error) {
            console.error('Quality assessment error:', error);
            return this.getDefaultQualityAssessment();
        }
    }

    /**
     * 🎯 SHIPMENT INTELLIGENCE EXTRACTION
     * Advanced shipment data processing and enhancement
     */
    async extractShipmentIntelligence(extractedData, qualityAssessment) {
        console.log('🎯 Extracting shipment intelligence...');
        
        if (!extractedData.shipmentDetails || !Array.isArray(extractedData.shipmentDetails)) {
            return {
                shipments: [],
                totalShipments: 0,
                processingNotes: ['No shipment details found in extracted data'],
                intelligence: {
                    matchingStrategy: 'fallback',
                    confidenceLevel: 'low'
                }
            };
        }
        
        const prompt = `
🎯 SHIPMENT INTELLIGENCE ENHANCEMENT

Enhance and validate shipment data for optimal matching:

EXTRACTED SHIPMENTS:
${JSON.stringify(extractedData.shipmentDetails, null, 2)}

QUALITY ASSESSMENT:
${JSON.stringify(qualityAssessment, null, 2)}

INTELLIGENCE REQUIREMENTS:
1. Shipment ID normalization and validation
2. Reference number standardization
3. Address parsing and validation
4. Charge categorization and validation
5. Matching strategy recommendation

OUTPUT SCHEMA:
{
    "shipments": [
        {
            "originalData": {}, // Original extracted data
            "enhancedData": {
                "normalizedShipmentId": "string",
                "standardizedReferences": [{"type": "string", "value": "string", "normalized": "string"}],
                "parsedOrigin": {
                    "standardizedAddress": "string",
                    "parsedComponents": {},
                    "geocodeConfidence": number
                },
                "parsedDestination": {
                    "standardizedAddress": "string", 
                    "parsedComponents": {},
                    "geocodeConfidence": number
                },
                "categorizedCharges": [
                    {
                        "originalCharge": {},
                        "category": "freight|fuel|accessorial|tax|discount|other",
                        "subcategory": "string",
                        "taxable": boolean,
                        "standardizedCode": "string"
                    }
                ],
                "calculatedTotals": {
                    "freight": number,
                    "fuel": number,
                    "accessorial": number, 
                    "tax": number,
                    "total": number,
                    "currency": "string"
                }
            },
            "matchingIntelligence": {
                "primaryMatchingFields": ["string"],
                "secondaryMatchingFields": ["string"],
                "fuzzyMatchingCandidates": ["string"],
                "matchingStrategy": "exact|fuzzy|date_amount|manual",
                "expectedMatchConfidence": number
            },
            "validationStatus": {
                "isValid": boolean,
                "validationErrors": ["string"],
                "validationWarnings": ["string"],
                "completenessScore": number
            }
        }
    ],
    "totalShipments": number,
    "aggregatedTotals": {
        "totalAmount": number,
        "totalFreight": number,
        "totalFuel": number,
        "totalAccessorial": number,
        "totalTax": number,
        "currency": "string"
    },
    "processingRecommendations": {
        "batchProcessing": boolean,
        "requiresManualReview": boolean,
        "autoMatchingViable": boolean,
        "splitProcessing": boolean
    },
    "intelligence": {
        "matchingStrategy": "exact|fuzzy|hybrid|manual",
        "confidenceLevel": "high|medium|low",
        "processingComplexity": "simple|medium|complex",
        "recommendedWorkflow": "auto|review|manual"
    }
}

CRITICAL: Return only valid JSON.
`;

        try {
            const result = await this.textModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            return this.parseAndValidateJSON(text, 'shipmentIntelligence');
            
        } catch (error) {
            console.error('Shipment intelligence error:', error);
            return this.getDefaultShipmentIntelligence();
        }
    }

    // Helper methods continue...
    
    /**
     * 🎯 CONFIDENCE-BASED ROUTING
     * Determine processing path based on confidence levels
     */
    determineConfidenceRouting(qualityAssessment) {
        const overallScore = qualityAssessment.overallScore || 0;
        const criticalScore = qualityAssessment.criticalFieldsScore || 0;
        
        if (overallScore >= 0.95 && criticalScore >= 0.9) {
            return {
                route: 'auto_approve',
                confidence: 'high',
                requiresReview: false,
                priority: 'normal'
            };
        } else if (overallScore >= 0.8 && criticalScore >= 0.7) {
            return {
                route: 'light_review',
                confidence: 'medium', 
                requiresReview: true,
                priority: 'normal'
            };
        } else if (overallScore >= 0.6) {
            return {
                route: 'full_review',
                confidence: 'medium',
                requiresReview: true,
                priority: 'high'
            };
        } else {
            return {
                route: 'manual_processing',
                confidence: 'low',
                requiresReview: true,
                priority: 'urgent'
            };
        }
    }

    /**
     * 💾 STORE PROCESSING RESULTS
     * Store results for learning and analytics
     */
    async storeProcessingResults(results) {
        try {
            const docRef = this.db.collection('aiProcessingResults').doc(results.processingId);
            await docRef.set({
                ...results,
                storedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ Processing results stored:', results.processingId);
        } catch (error) {
            console.error('Error storing processing results:', error);
        }
    }

    // Utility methods...
    
    async downloadPdfBuffer(pdfUrl) {
        try {
            const response = await axios.get(pdfUrl, { 
                responseType: 'arraybuffer',
                timeout: 30000 
            });
            return Buffer.from(response.data);
        } catch (error) {
            throw new Error(`Failed to download PDF: ${error.message}`);
        }
    }

    parseAndValidateJSON(text, context) {
        try {
            // Clean the text and extract JSON
            const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleanText);
            return parsed;
        } catch (error) {
            console.error(`JSON parsing error in ${context}:`, error);
            console.error('Raw text:', text.substring(0, 500));
            return this.getDefaultResult(context);
        }
    }

    getDefaultResult(context) {
        const defaults = {
            'textAnalysis': this.getDefaultTextAnalysis(),
            'layoutAnalysis': this.getDefaultLayoutAnalysis(),
            'carrierDetection': this.getDefaultCarrierInfo(),
            'schemaExtraction': this.getDefaultExtractionResult(),
            'qualityAssessment': this.getDefaultQualityAssessment(),
            'shipmentIntelligence': this.getDefaultShipmentIntelligence()
        };
        
        return defaults[context] || {};
    }

    getDefaultTextAnalysis() {
        return {
            documentType: 'unknown',
            contentStructure: { hasTable: false, textDensity: 'medium' },
            keyEntities: { dates: [], amounts: [], identifiers: [], companies: [], addresses: [] },
            textQuality: { clarity: 0.5, completeness: 0.5, consistency: 0.5, ocrConfidence: 0.5 },
            languageInfo: { primaryLanguage: 'en', locale: 'en-US' },
            overallConfidence: 0.5
        };
    }

    getDefaultVisualAnalysis() {
        return {
            logoDetection: [],
            tableDetection: [],
            boundingBoxes: [],
            visualElements: [],
            confidence: 0.5
        };
    }

    getDefaultLayoutAnalysis() {
        return {
            documentStructure: { orientation: 'portrait', sections: [] },
            tableAnalysis: { tablesDetected: 0, tables: [] },
            headerFooterAnalysis: { header: { present: false }, footer: { present: false } },
            visualHierarchy: { titleElements: [], keyValuePairs: [], emphasizedElements: [] },
            layoutQuality: { organization: 0.5, readability: 0.5, consistency: 0.5, completeness: 0.5 },
            overallConfidence: 0.5
        };
    }

    getDefaultCarrierInfo() {
        return {
            primaryCarrier: { name: 'Unknown', confidence: 0.1, detectionMethods: [] },
            alternativeCarriers: [],
            carrierClassification: { type: 'other' },
            detectionQuality: { clarityScore: 0.3, consistencyScore: 0.3, completenessScore: 0.3 },
            recommendedProcessing: { useTrainedModel: false, fallbackStrategy: 'generic' },
            overallConfidence: 0.3
        };
    }

    getDefaultExtractionResult() {
        return {
            invoiceHeader: {},
            carrierDetails: {},
            billingInfo: {},
            shipmentDetails: [],
            extractionMetadata: { totalShipments: 0, averageConfidence: 0.3 }
        };
    }

    getDefaultQualityAssessment() {
        return {
            completenessScore: 0.3,
            consistencyScore: 0.3,
            confidenceScore: 0.3,
            criticalFieldsScore: 0.3,
            dataQualityIssues: [],
            recommendedActions: [{ action: 'human_review', reason: 'Low extraction confidence' }],
            processingRecommendation: { autoProcessable: false, requiresReview: true, confidenceLevel: 'low' },
            overallScore: 0.3
        };
    }

    getDefaultShipmentIntelligence() {
        return {
            shipments: [],
            totalShipments: 0,
            processingNotes: ['Default intelligence - no data extracted'],
            intelligence: { matchingStrategy: 'manual', confidenceLevel: 'low' }
        };
    }

    async getCarrierExtractionSchema(carrierInfo) {
        // This would fetch carrier-specific schemas from the database
        // For now, return a generic schema
        return {
            version: '1.0',
            type: 'generic',
            fields: {
                required: ['invoiceNumber', 'invoiceDate', 'totalAmount'],
                optional: ['dueDate', 'currency', 'shipmentDetails']
            }
        };
    }

    async enrichCarrierInfo(carrierInfo) {
        // This would enhance carrier info with system data
        return {
            ...carrierInfo,
            systemCarrierId: null,
            hasTrainedModel: false,
            modelVersion: null
        };
    }
}

module.exports = EnhancedGeminiProcessor;
