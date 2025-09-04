const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { VertexAI } = require('@google-cloud/vertexai');

// Baseline Generic AI Prompt - Applied to all carriers by default
const BASELINE_PROMPT = `You are an expert AI invoice processing system specializing in transportation, logistics, and freight carrier invoices. Analyze this document with extreme precision and extract ALL relevant information. Return ONLY a JSON object - no explanatory text before or after.

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

{
    "carrierInformation": {
        "company": "string | null",
        "address": "string | null",
        "phone": "string | null",
        "fax": "string | null",
        "email": "string | null",
        "taxNumber": "string | null"
    },
    "invoiceDetails": {
        "invoiceNumber": "string | null",
        "invoiceDate": "string | null",
        "billOfLading": "string | null (REMOVE prefixes like SI:, Shipment:, BOL:)",
        "invoiceTerms": "string | null (e.g., Net 30, Due on Receipt, COD)",
        "customerNumber": "string | null"
    },
    "shipmentReferences": {
        "shipmentId": "string | null (CRITICAL: shipment ID for internal matching)",
        "purchaseOrder": "string | null",
        "customerReference": "string | null",
        "proNumber": "string | null",
        "trackingNumber": "string | null",
        "jobNumber": "string | null"
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
            "description": "string | null (e.g., LAPTOP, BORDER FEE, FUEL SURCHARGE)",
            "amount": "number | null (numeric value only)",
            "rate": "string | null (percentage or rate info)"
        }
    ],
    "totalAmount": {
        "subtotal": "number | null",
        "totalTax": "number | null",
        "amount": "number | null (numeric value only)",
        "currency": "string | null (e.g., CAD, USD, CAN Funds)",
        "amountDue": "number | null"
    }
}

## CRITICAL REQUIREMENTS:
1. ALL fields must be present in output, use null if not found
2. Numbers must be pure numeric values (no currency symbols)
3. Addresses must be complete and properly formatted
4. Dates must be in YYYY-MM-DD format
5. Extract ALL charges found, no matter how small
6. Verify mathematical accuracy (totals = subtotal + taxes)
7. Use exact text from document, don't paraphrase
8. Double-check all extracted amounts add up correctly
9. Ensure no placeholder or example data remains
10. Confirm all text is extracted exactly as shown on document`;

function initServices() {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
    const db = admin.firestore();
    return { db };
}

/**
 * Export baseline prompt for external use
 */
exports.getBaselinePrompt = () => BASELINE_PROMPT;

/**
 * Generate AI-powered carrier-specific extraction prompts
 * Always starts with baseline prompt as foundation
 */
exports.generateCarrierPrompt = onCall({
    cors: true,
    timeoutSeconds: 300,
    memory: '2GiB',
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { carrierId, regenerate = false } = request.data || {};
        
        if (!carrierId) {
            throw new Error('carrierId is required');
        }

        console.log(`🧠 Generating AI prompt for carrier: ${carrierId}`);

        const { db } = initServices();

        // Check if prompt already exists (unless regenerating)
        if (!regenerate) {
            const existingPrompt = await db.collection('carrierPrompts').doc(carrierId).get();
            if (existingPrompt.exists) {
                console.log('📋 Using existing carrier prompt');
                return {
                    success: true,
                    prompt: existingPrompt.data(),
                    source: 'existing'
                };
            }
        }

        // Always use baseline prompt as foundation (no training data required)
        console.log('🎯 Using baseline prompt as foundation for carrier-specific prompt...');
        
        // Generate prompt using baseline as starting point
        const generatedPrompt = await generateBaselinePrompt();

        // Save to database
        const promptDoc = {
            carrierId,
            generatedPrompt: BASELINE_PROMPT, // Always use baseline
            analysisData: generatedPrompt.analysis,
            trainingDataSummary: {
                sampleCount: 0,
                annotationTypes: ['baseline'],
                commonPatterns: 'Uses enhanced generic baseline prompt'
            },
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
            generatedBy: request.auth.uid,
            version: 1,
            isActive: true,
            userModifications: [],
            performance: {
                accuracy: null,
                testCount: 0
            },
            isBaseline: true // Flag to indicate this uses baseline prompt
        };

        await db.collection('carrierPrompts').doc(carrierId).set(promptDoc);

        console.log('✅ Generated and saved carrier-specific prompt');

        return {
            success: true,
            prompt: promptDoc,
            source: 'generated'
        };

    } catch (error) {
        console.error('❌ Error generating carrier prompt:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Gather all training data for a carrier
 */
async function gatherCarrierTrainingData(carrierId, db) {
    console.log(`📊 Gathering training data for carrier: ${carrierId}`);

    // First, resolve the carrier name to actual training document ID
    let actualTrainingId = carrierId;
    let resolvedCarrierName = null;

    // Handle both carrier names and training IDs
    if (carrierId.startsWith('training_')) {
        // Already a training ID - use directly
        console.log(`📋 Using provided training ID directly: ${actualTrainingId}`);
        
        // Try to get the carrier name from the trainingCarriers collection
        try {
            const carrierDoc = await db.collection('trainingCarriers').doc(carrierId).get();
            if (carrierDoc.exists) {
                resolvedCarrierName = carrierDoc.data().name;
                console.log(`✅ Found carrier name: ${resolvedCarrierName} for training ID: ${carrierId}`);
            }
        } catch (error) {
            console.log(`⚠️ Could not fetch carrier name for training ID ${carrierId}: ${error.message}`);
        }
    } else {
        // Carrier name provided - resolve to training ID
        console.log(`🔍 Resolving carrier name "${carrierId}" to training document ID...`);
        try {
            const carrierQuery = await db.collection('trainingCarriers')
                .where('name', '==', carrierId)
                .where('active', '==', true)
                .limit(1)
                .get();
            
            if (!carrierQuery.empty) {
                const carrierDoc = carrierQuery.docs[0];
                actualTrainingId = carrierDoc.data().id;
                resolvedCarrierName = carrierDoc.data().name;
                console.log(`✅ Resolved "${carrierId}" to training ID: ${actualTrainingId}`);
            } else {
                // Try case-insensitive search
                const allCarriers = await db.collection('trainingCarriers')
                    .where('active', '==', true)
                    .get();
                
                for (const doc of allCarriers.docs) {
                    const carrierData = doc.data();
                    if (carrierData.name.toLowerCase() === carrierId.toLowerCase()) {
                        actualTrainingId = carrierData.id;
                        resolvedCarrierName = carrierData.name;
                        console.log(`✅ Resolved "${carrierId}" (case-insensitive) to training ID: ${actualTrainingId}`);
                        break;
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️ Could not resolve carrier name: ${error.message}`);
        }
    }

    // Try multiple approaches to find training data using the resolved training ID
    let samplesSnapshot = null;
    let searchStrategy = '';

    // Strategy 1: Look for completed visual annotation samples (using trainingMethod field)
    try {
        console.log(`🔍 Strategy 1: Looking for completed visual annotation samples in unifiedTraining/${actualTrainingId}/samples`);
        samplesSnapshot = await db.collection('unifiedTraining')
            .doc(actualTrainingId)
            .collection('samples')
            .where('trainingMethod', '==', 'visual_annotation')
            .where('processingStatus', '==', 'completed')
            .limit(20)
            .get();
        
        if (!samplesSnapshot.empty) {
            searchStrategy = 'completed_visual_annotation';
            console.log(`✅ Found ${samplesSnapshot.size} completed visual annotation samples`);
        } else {
            console.log(`❌ No completed visual annotation samples found`);
        }
    } catch (error) {
        console.log('❌ Strategy 1 failed:', error.message);
    }

    // Strategy 1b: Try with trainingType field (fallback)
    if (!samplesSnapshot || samplesSnapshot.empty) {
        try {
            console.log(`🔍 Strategy 1b: Looking for completed visual annotation samples using trainingType field`);
            samplesSnapshot = await db.collection('unifiedTraining')
                .doc(actualTrainingId)
                .collection('samples')
                .where('trainingType', '==', 'visual_annotation')
                .where('processingStatus', '==', 'completed')
                .limit(20)
                .get();
            
            if (!samplesSnapshot.empty) {
                searchStrategy = 'completed_visual_annotation_alt';
                console.log(`✅ Found ${samplesSnapshot.size} completed visual annotation samples (alt field)`);
            } else {
                console.log(`❌ No completed visual annotation samples found (alt field)`);
            }
        } catch (error) {
            console.log('❌ Strategy 1b failed:', error.message);
        }
    }

    // Strategy 2: Look for any visual annotation samples (regardless of status)
    if (!samplesSnapshot || samplesSnapshot.empty) {
        try {
            console.log(`🔍 Strategy 2: Looking for any visual annotation samples (regardless of status)`);
            samplesSnapshot = await db.collection('unifiedTraining')
                .doc(actualTrainingId)
                .collection('samples')
                .where('trainingMethod', '==', 'visual_annotation')
                .limit(20)
                .get();
            
            if (!samplesSnapshot.empty) {
                searchStrategy = 'any_visual_annotation';
                console.log(`✅ Found ${samplesSnapshot.size} visual annotation samples (any status)`);
            } else {
                console.log(`❌ No visual annotation samples found (any status)`);
            }
        } catch (error) {
            console.log('❌ Strategy 2 failed:', error.message);
        }
    }

    // Strategy 3: Look for any samples in the carrier's collection
    if (!samplesSnapshot || samplesSnapshot.empty) {
        try {
            console.log(`🔍 Strategy 3: Looking for any samples in the carrier's collection`);
            samplesSnapshot = await db.collection('unifiedTraining')
                .doc(actualTrainingId)
                .collection('samples')
                .limit(20)
                .get();
            
            if (!samplesSnapshot.empty) {
                searchStrategy = 'any_samples';
                console.log(`✅ Found ${samplesSnapshot.size} samples of any type`);
            } else {
                console.log(`❌ No samples found in the carrier's collection`);
            }
        } catch (error) {
            console.log('❌ Strategy 3 failed:', error.message);
        }
    }

    // Strategy 4: Look for carrier by name pattern (e.g., "landliner" -> "training_*landliner*")
    if (!samplesSnapshot || samplesSnapshot.empty) {
        try {
            // For known carriers like "landliner", try to find training carriers with similar names
            const carrierNamePatterns = {
                'landliner': ['training_', 'landliner'],
                'polaris': ['training_', 'polaris']
            };
            
            if (carrierNamePatterns[carrierId]) {
                // Search all unifiedTraining documents to find ones with carrier names containing our pattern
                const allCarriersSnapshot = await db.collection('unifiedTraining').listDocuments();
                
                for (const carrierDoc of allCarriersSnapshot) {
                    const docId = carrierDoc.id.toLowerCase();
                    const patterns = carrierNamePatterns[carrierId];
                    
                    // Check if this document ID matches our pattern (e.g., contains "training_" and "landliner")
                    const matchesPattern = patterns.every(pattern => docId.includes(pattern.toLowerCase()));
                    
                    if (matchesPattern) {
                        console.log(`🔍 Found potential carrier match: ${carrierDoc.id} for ${carrierId}`);
                        
                        // Try to get samples from this carrier
                        const candidateSnapshot = await db.collection('unifiedTraining')
                            .doc(carrierDoc.id)
                            .collection('samples')
                            .where('trainingMethod', '==', 'visual_annotation')
                            .orderBy('timestamps.uploaded', 'desc')
                            .limit(20)
                            .get();
                        
                        if (!candidateSnapshot.empty) {
                            samplesSnapshot = candidateSnapshot;
                            searchStrategy = 'pattern_matched_carrier';
                            console.log(`✅ Found ${samplesSnapshot.size} samples using pattern matching for ${carrierDoc.id}`);
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            console.log('❌ Strategy 4 (pattern matching) failed:', error.message);
        }
    }

    // Strategy 5: Look in trainingExamples collection (legacy format)
    if (!samplesSnapshot || samplesSnapshot.empty) {
        try {
            // Try with both the original carrierId and actualTrainingId
            samplesSnapshot = await db.collection('trainingExamples')
                .where('carrierId', '==', actualTrainingId)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();
            
            // If not found with actualTrainingId, try with original carrierId
            if (samplesSnapshot.empty && actualTrainingId !== carrierId) {
                samplesSnapshot = await db.collection('trainingExamples')
                    .where('carrierId', '==', carrierId)
                    .orderBy('createdAt', 'desc')
                    .limit(20)
                    .get();
            }
            
            if (!samplesSnapshot.empty) {
                searchStrategy = 'legacy_training_examples';
                console.log(`✅ Found ${samplesSnapshot.size} legacy training examples`);
            }
        } catch (error) {
            console.log('❌ Strategy 5 failed:', error.message);
        }
    }

    if (!samplesSnapshot || samplesSnapshot.empty) {
        console.log(`❌ No training data found for ${carrierId} (resolved to: ${actualTrainingId}) using any strategy`);
        return { 
            hasSufficientData: false, 
            reason: `No training samples found in any collection for carrier "${carrierId}" (resolved to training ID: ${actualTrainingId})`,
            searchDetails: {
                originalCarrierId: carrierId,
                resolvedTrainingId: actualTrainingId,
                resolvedCarrierName: resolvedCarrierName
            }
        };
    }

    const trainingData = {
        sampleCount: samplesSnapshot.size,
        samples: [],
        annotationTypes: new Set(),
        patterns: {},
        commonFields: {},
        ocrTexts: [],
        hasSufficientData: true,
        searchStrategy: searchStrategy,
        carrierInfo: {
            originalCarrierId: carrierId,
            resolvedTrainingId: actualTrainingId,
            resolvedCarrierName: resolvedCarrierName || carrierId
        }
    };

    console.log(`📋 Processing ${samplesSnapshot.size} samples using strategy: ${searchStrategy}`);

    // Process each sample based on the data format
    for (const doc of samplesSnapshot.docs) {
        const sampleData = doc.data();
        
        let sample;
        
        // Handle different data formats based on search strategy
        if (searchStrategy === 'legacy_training_examples') {
            // Legacy format from trainingExamples collection
            sample = {
                id: doc.id,
                fileName: sampleData.fileName || sampleData.originalFileName || 'unknown.pdf',
                annotations: sampleData.annotations || sampleData.boundingBoxes || {},
                extractedFeatures: sampleData.extractedData || sampleData.analysisResults || {},
                ocrText: sampleData.ocrText || sampleData.textContent || '',
                downloadURL: sampleData.downloadURL || sampleData.pdfUrl
            };
        } else {
            // Standard unified training format
            sample = {
                id: doc.id,
                fileName: sampleData.fileName || 'unknown.pdf',
                annotations: sampleData.visualAnnotations || sampleData.annotations || {},
                extractedFeatures: sampleData.extractedFeatures || sampleData.analysisResults || {},
                ocrText: sampleData.ocrText || sampleData.textContent || '',
                downloadURL: sampleData.downloadURL || sampleData.pdfUrl
            };
        }

        // Collect annotation types from any available annotations
        const allAnnotations = { ...sample.annotations };
        if (sampleData.boundingBoxes) {
            // Handle bounding box format
            Object.assign(allAnnotations, sampleData.boundingBoxes);
        }

        Object.keys(allAnnotations).forEach(type => {
            trainingData.annotationTypes.add(type);
        });

        // Analyze patterns from extracted features
        if (sample.extractedFeatures.extractedData) {
            analyzePatterns(sample.extractedFeatures.extractedData, trainingData.patterns);
        } else if (sample.extractedFeatures) {
            // Try to extract patterns from any available data
            analyzePatterns(sample.extractedFeatures, trainingData.patterns);
        }

        trainingData.samples.push(sample);
        if (sample.ocrText) {
            trainingData.ocrTexts.push(sample.ocrText);
        }

        console.log(`  ✓ Processed sample: ${sample.fileName} (${Object.keys(allAnnotations).length} annotations)`);
    }

    trainingData.annotationTypes = Array.from(trainingData.annotationTypes);

    console.log(`📈 Gathered data: ${trainingData.sampleCount} samples, ${trainingData.annotationTypes.length} annotation types`);

    return trainingData;
}

/**
 * Generate baseline prompt structure for any carrier
 */
async function generateBaselinePrompt() {
    console.log('🎯 Generating baseline prompt structure...');
    
    // Always return the baseline prompt with standard analysis
    const generatedPrompt = {
        prompt: BASELINE_PROMPT,
        analysis: {
            carrierName: 'Universal Baseline',
            documentType: 'invoice',
            keyPatterns: [
                'Uses baseline prompt as foundation',
                'Comprehensive extraction coverage',
                'Professional invoice processing'
            ],
            fieldLocations: {
                'invoiceNumber': 'Top-right or header section',
                'totalAmount': 'Bottom-right of document',
                'charges': 'Central table format',
                'carrier': 'Header/logo area'
            },
            formatRules: [
                'Standardized date format (YYYY-MM-DD)',
                'Clean numeric amounts (no currency symbols)',
                'Comprehensive address formatting',
                'Complete charge extraction'
            ],
            commonIssues: [
                'Watch for prefixed reference numbers',
                'Ensure all charges are captured',
                'Validate mathematical accuracy'
            ]
        }
    };

    console.log('✅ Baseline prompt structure generated successfully');
    
    return generatedPrompt;
}

/**
 * Analyze patterns in extracted data
 */
function analyzePatterns(extractedData, patterns) {
    // Analyze invoice number patterns
    if (extractedData.invoiceNumber) {
        if (!patterns.invoiceNumbers) patterns.invoiceNumbers = [];
        patterns.invoiceNumbers.push(extractedData.invoiceNumber);
    }

    // Analyze total amount patterns
    if (extractedData.totalAmount) {
        if (!patterns.totalAmounts) patterns.totalAmounts = [];
        patterns.totalAmounts.push(extractedData.totalAmount);
    }

    // Analyze charge patterns
    if (extractedData.charges) {
        if (!patterns.chargeTypes) patterns.chargeTypes = [];
        extractedData.charges.forEach(charge => {
            patterns.chargeTypes.push(charge.description || charge.name);
        });
    }

    // Analyze carrier information patterns
    if (extractedData.carrierInformation) {
        if (!patterns.carrierInfo) patterns.carrierInfo = [];
        patterns.carrierInfo.push(extractedData.carrierInformation);
    }
}

/**
 * Update carrier prompt with user modifications
 */
exports.updateCarrierPrompt = onCall({
    cors: true,
    timeoutSeconds: 60,
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { carrierId, promptModifications, notes } = request.data || {};
        
        if (!carrierId || !promptModifications) {
            throw new Error('carrierId and promptModifications are required');
        }

        const { db } = initServices();

        // Get existing prompt
        const promptDoc = await db.collection('carrierPrompts').doc(carrierId).get();
        if (!promptDoc.exists) {
            throw new Error('Carrier prompt not found');
        }

        const currentPrompt = promptDoc.data();

        // Create modification record with current timestamp (not serverTimestamp)
        const currentTime = new Date();
        const modification = {
            modifiedAt: currentTime,
            modifiedBy: request.auth.uid,
            changes: promptModifications,
            notes: notes,
            previousVersion: currentPrompt.version
        };

        // Update prompt
        await db.collection('carrierPrompts').doc(carrierId).update({
            generatedPrompt: promptModifications,
            userModifications: admin.firestore.FieldValue.arrayUnion(modification),
            version: currentPrompt.version + 1,
            lastModified: admin.firestore.FieldValue.serverTimestamp(),
            lastModifiedBy: request.auth.uid
        });

        console.log(`✅ Updated carrier prompt for ${carrierId}`);

        return {
            success: true,
            message: 'Carrier prompt updated successfully'
        };

    } catch (error) {
        console.error('❌ Error updating carrier prompt:', error);
        return {
            success: false,
            error: error.message
        };
    }
});
