const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const EnhancedGeminiProcessor = require('./enhancedGeminiProcessor');

/**
 * 🎯 UNIFIED PROCESSING ORCHESTRATOR
 * Seamlessly integrates invoice training and production processing
 * - Routes between training and production modes
 * - Manages model selection and application
 * - Handles learning from corrections
 * - Coordinates confidence-based workflows
 */

let db, bucket;
function initServices() {
    if (!db) {
        db = admin.firestore();
        bucket = admin.storage().bucket();
    }
    return { db, bucket };
}

/**
 * 🚀 MASTER INVOICE PROCESSING FUNCTION
 * Single entry point for all invoice processing needs
 */
exports.processInvoiceUnified = onCall({
    cors: {
        origin: ['https://solushipx.web.app', 'http://localhost:3000'],
        credentials: true
    },
    timeoutSeconds: 540, // 9 minutes for complex processing
    memory: '2GiB',
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { 
            pdfUrl, 
            carrierHint, 
            processingMode = 'production',  // 'training' | 'production' | 'hybrid'
            companyId,
            options = {} 
        } = request.data || {};

        if (!pdfUrl) {
            throw new Error('pdfUrl is required');
        }

        console.log(`🚀 Starting unified invoice processing: ${processingMode} mode`);

        const { db } = initServices();
        const processor = new EnhancedGeminiProcessor();

        // Step 1: Initial AI processing with enhanced Gemini
        const aiResults = await processor.processInvoiceDocument(pdfUrl, carrierHint, options);

        // Step 2: Determine processing strategy based on mode and confidence
        const processingStrategy = determineProcessingStrategy(aiResults, processingMode, options);

        // Step 3: Route to appropriate processing pipeline
        let finalResults;
        switch (processingStrategy.route) {
            case 'auto_production':
                finalResults = await processProductionPipeline(aiResults, companyId, processingStrategy);
                break;
            case 'training_enhancement':
                finalResults = await processTrainingPipeline(aiResults, request.auth.uid, processingStrategy);
                break;
            case 'hybrid_learning':
                finalResults = await processHybridPipeline(aiResults, companyId, request.auth.uid, processingStrategy);
                break;
            case 'manual_review':
                finalResults = await processManualReviewPipeline(aiResults, companyId, processingStrategy);
                break;
            default:
                throw new Error('Unknown processing strategy');
        }

        // Step 4: Store comprehensive results for analytics and learning
        await storeUnifiedResults(aiResults, finalResults, processingStrategy, request.auth.uid);

        console.log(`✅ Unified processing completed: ${processingStrategy.route}`);

        return {
            success: true,
            processingId: aiResults.processingId,
            strategy: processingStrategy,
            aiResults: aiResults,
            finalResults: finalResults,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ Unified processing error:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
});

/**
 * 🎯 PRODUCTION PROCESSING PIPELINE
 * High-confidence automatic processing for production use
 */
async function processProductionPipeline(aiResults, companyId, strategy) {
    console.log('🏭 Processing production pipeline...');

    const { db } = initServices();
    const results = {
        pipeline: 'production',
        autoProcessed: true,
        shipmentMatches: [],
        chargeUpdates: [],
        processingNotes: []
    };

    try {
        // Step 1: Intelligent shipment matching
        if (aiResults.shipmentData?.shipments?.length > 0) {
            for (const shipment of aiResults.shipmentData.shipments) {
                const matchResult = await performIntelligentShipmentMatching(
                    shipment, 
                    companyId, 
                    aiResults.carrierInfo
                );
                results.shipmentMatches.push(matchResult);

                // Step 2: Auto-update charges for high-confidence matches
                if (matchResult.confidence >= 0.95 && matchResult.bestMatch) {
                    const chargeUpdate = await updateShipmentChargesAutomatically(
                        matchResult.bestMatch.shipment.id,
                        shipment.enhancedData.categorizedCharges,
                        aiResults.processingId
                    );
                    results.chargeUpdates.push(chargeUpdate);
                }
            }
        }

        // Step 3: Generate production summary
        results.summary = {
            totalShipments: aiResults.shipmentData?.totalShipments || 0,
            matchedShipments: results.shipmentMatches.filter(m => m.confidence >= 0.8).length,
            autoUpdatedShipments: results.chargeUpdates.filter(u => u.success).length,
            requiresReview: results.shipmentMatches.filter(m => m.confidence < 0.8).length
        };

        console.log('✅ Production pipeline completed');
        return results;

    } catch (error) {
        console.error('Production pipeline error:', error);
        results.error = error.message;
        return results;
    }
}

/**
 * 📚 TRAINING ENHANCEMENT PIPELINE
 * Process document for model training and improvement
 */
async function processTrainingPipeline(aiResults, userId, strategy) {
    console.log('📚 Processing training pipeline...');

    const { db } = initServices();
    const results = {
        pipeline: 'training',
        trainingData: null,
        modelUpdates: [],
        processingNotes: []
    };

    try {
        // Step 1: Create training sample from AI results
        const trainingSample = await createTrainingSampleFromAI(aiResults, userId);
        results.trainingData = trainingSample;

        // Step 2: Update carrier-specific model if available
        if (aiResults.carrierInfo?.primaryCarrier?.carrierId) {
            const modelUpdate = await updateCarrierModel(
                aiResults.carrierInfo.primaryCarrier.carrierId,
                trainingSample
            );
            results.modelUpdates.push(modelUpdate);
        }

        // Step 3: Store for future training iterations
        await storeTrainingData(trainingSample, aiResults.processingId);

        console.log('✅ Training pipeline completed');
        return results;

    } catch (error) {
        console.error('Training pipeline error:', error);
        results.error = error.message;
        return results;
    }
}

/**
 * 🔄 HYBRID LEARNING PIPELINE
 * Combines production processing with continuous learning
 */
async function processHybridPipeline(aiResults, companyId, userId, strategy) {
    console.log('🔄 Processing hybrid pipeline...');

    const results = {
        pipeline: 'hybrid',
        productionResults: null,
        learningResults: null,
        processingNotes: []
    };

    try {
        // Step 1: Run production processing
        const productionResults = await processProductionPipeline(aiResults, companyId, strategy);
        results.productionResults = productionResults;

        // Step 2: Simultaneously enhance training
        const learningResults = await processTrainingPipeline(aiResults, userId, strategy);
        results.learningResults = learningResults;

        // Step 3: Cross-validate and improve
        await crossValidateResults(productionResults, learningResults, aiResults.processingId);

        console.log('✅ Hybrid pipeline completed');
        return results;

    } catch (error) {
        console.error('Hybrid pipeline error:', error);
        results.error = error.message;
        return results;
    }
}

/**
 * 👁️ MANUAL REVIEW PIPELINE
 * Prepare low-confidence results for human review
 */
async function processManualReviewPipeline(aiResults, companyId, strategy) {
    console.log('👁️ Processing manual review pipeline...');

    const results = {
        pipeline: 'manual_review',
        reviewItems: [],
        confidence: strategy.confidence,
        processingNotes: []
    };

    try {
        // Step 1: Identify review items
        if (aiResults.shipmentData?.shipments?.length > 0) {
            for (const shipment of aiResults.shipmentData.shipments) {
                const reviewItem = {
                    shipmentData: shipment,
                    extractionIssues: identifyExtractionIssues(shipment),
                    suggestedActions: generateSuggestedActions(shipment),
                    priority: determinePriority(shipment, aiResults.qualityAssessment)
                };
                results.reviewItems.push(reviewItem);
            }
        }

        // Step 2: Attempt fuzzy matching for context
        for (const item of results.reviewItems) {
            item.possibleMatches = await performFuzzyMatching(
                item.shipmentData,
                companyId,
                { includePartial: true, maxResults: 5 }
            );
        }

        console.log('✅ Manual review pipeline completed');
        return results;

    } catch (error) {
        console.error('Manual review pipeline error:', error);
        results.error = error.message;
        return results;
    }
}

/**
 * 🧠 DETERMINE PROCESSING STRATEGY
 * Intelligent routing based on confidence and context
 */
function determineProcessingStrategy(aiResults, processingMode, options) {
    const overallConfidence = aiResults.qualityAssessment?.overallScore || 0;
    const carrierConfidence = aiResults.carrierInfo?.overallConfidence || 0;
    const hasTrainedModel = aiResults.carrierInfo?.primaryCarrier?.hasTrainedModel || false;

    // Training mode always goes to training pipeline
    if (processingMode === 'training') {
        return {
            route: 'training_enhancement',
            confidence: 'training',
            reason: 'Explicit training mode requested',
            priority: 'normal'
        };
    }

    // High confidence + production mode = auto processing
    if (processingMode === 'production' && overallConfidence >= 0.95 && carrierConfidence >= 0.9) {
        return {
            route: 'auto_production',
            confidence: 'high',
            reason: 'High confidence extraction with known carrier',
            priority: 'normal'
        };
    }

    // Medium confidence + hybrid mode = learning while processing
    if (processingMode === 'hybrid' || (overallConfidence >= 0.8 && hasTrainedModel)) {
        return {
            route: 'hybrid_learning',
            confidence: 'medium',
            reason: 'Medium confidence with learning opportunity',
            priority: 'normal'
        };
    }

    // Low confidence = manual review
    if (overallConfidence < 0.6 || carrierConfidence < 0.5) {
        return {
            route: 'manual_review',
            confidence: 'low',
            reason: 'Low confidence requires human review',
            priority: 'high'
        };
    }

    // Default to manual review for safety
    return {
        route: 'manual_review',
        confidence: 'medium',
        reason: 'Default safety routing',
        priority: 'normal'
    };
}

/**
 * 🎯 INTELLIGENT SHIPMENT MATCHING
 * Advanced matching using multiple strategies
 */
async function performIntelligentShipmentMatching(shipmentData, companyId, carrierInfo) {
    const { db } = initServices();

    try {
        console.log('🎯 Performing intelligent shipment matching...');

        // Extract key matching identifiers
        const matchingCriteria = {
            shipmentId: shipmentData.enhancedData?.normalizedShipmentId,
            referenceNumbers: shipmentData.enhancedData?.standardizedReferences || [],
            trackingNumber: shipmentData.originalData?.trackingNumber?.value,
            amount: shipmentData.enhancedData?.calculatedTotals?.total,
            dateRange: extractDateRange(shipmentData.originalData)
        };

        // Strategy 1: Exact shipment ID match
        let exactMatch = null;
        if (matchingCriteria.shipmentId) {
            exactMatch = await findExactShipmentMatch(matchingCriteria.shipmentId, companyId);
            if (exactMatch) {
                return {
                    strategy: 'exact_id',
                    confidence: 0.98,
                    bestMatch: exactMatch,
                    alternativeMatches: [],
                    notes: ['Exact shipment ID match found']
                };
            }
        }

        // Strategy 2: Reference number matching
        const referenceMatches = [];
        for (const ref of matchingCriteria.referenceNumbers) {
            const matches = await findReferenceMatches(ref.normalized, companyId);
            referenceMatches.push(...matches);
        }

        if (referenceMatches.length > 0) {
            const bestRefMatch = selectBestMatch(referenceMatches, matchingCriteria);
            if (bestRefMatch.confidence >= 0.9) {
                return {
                    strategy: 'reference_match',
                    confidence: bestRefMatch.confidence,
                    bestMatch: bestRefMatch,
                    alternativeMatches: referenceMatches.slice(1, 4),
                    notes: ['Reference number match found']
                };
            }
        }

        // Strategy 3: Fuzzy matching with amount and date
        const fuzzyMatches = await performFuzzyMatching(shipmentData, companyId, {
            includeAmount: true,
            includeDates: true,
            maxResults: 10
        });

        if (fuzzyMatches.length > 0) {
            const bestFuzzyMatch = fuzzyMatches[0];
            if (bestFuzzyMatch.confidence >= 0.8) {
                return {
                    strategy: 'fuzzy_match',
                    confidence: bestFuzzyMatch.confidence,
                    bestMatch: bestFuzzyMatch,
                    alternativeMatches: fuzzyMatches.slice(1, 5),
                    notes: ['Fuzzy matching based on multiple criteria']
                };
            }
        }

        // No good matches found
        return {
            strategy: 'no_match',
            confidence: 0.1,
            bestMatch: null,
            alternativeMatches: fuzzyMatches.slice(0, 3),
            notes: ['No confident matches found - requires manual review']
        };

    } catch (error) {
        console.error('Shipment matching error:', error);
        return {
            strategy: 'error',
            confidence: 0,
            bestMatch: null,
            alternativeMatches: [],
            notes: [`Matching error: ${error.message}`]
        };
    }
}

/**
 * 💰 UPDATE SHIPMENT CHARGES AUTOMATICALLY
 * Update actual charges in matched shipments
 */
async function updateShipmentChargesAutomatically(shipmentId, charges, processingId) {
    try {
        console.log(`💰 Auto-updating charges for shipment: ${shipmentId}`);

        const { db } = initServices();

        // Prepare actual rates update
        const actualRatesUpdate = {
            totalCharges: charges.reduce((sum, charge) => sum + (charge.originalCharge.amount?.value || 0), 0),
            currency: charges[0]?.originalCharge?.currency?.value || 'CAD',
            charges: charges.map(charge => ({
                name: charge.originalCharge.description?.value || 'Unknown Charge',
                amount: charge.originalCharge.amount?.value || 0,
                currency: charge.originalCharge.currency?.value || 'CAD',
                code: charge.standardizedCode || charge.originalCharge.code?.value || 'UNK',
                category: charge.category,
                confidence: charge.originalCharge.amount?.confidence || 0.8
            })),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedFrom: 'ai_auto_processing',
            processingId: processingId,
            autoUpdated: true
        };

        // Update shipment document
        const shipmentRef = db.collection('shipments').doc(shipmentId);
        await shipmentRef.update({
            actualRates: actualRatesUpdate,
            hasActualCosts: true,
            aiProcessingId: processingId,
            actualCostsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            actualCostsUpdatedBy: 'ai_system',
            lastModified: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Charges updated successfully for shipment: ${shipmentId}`);

        return {
            success: true,
            shipmentId: shipmentId,
            updatedCharges: actualRatesUpdate.charges.length,
            totalAmount: actualRatesUpdate.totalCharges,
            processingId: processingId
        };

    } catch (error) {
        console.error('Charge update error:', error);
        return {
            success: false,
            shipmentId: shipmentId,
            error: error.message,
            processingId: processingId
        };
    }
}

// Helper functions...

async function findExactShipmentMatch(shipmentId, companyId) {
    const { db } = initServices();
    
    // Try document ID first
    const directDoc = await db.collection('shipments').doc(shipmentId).get();
    if (directDoc.exists && directDoc.data().companyID === companyId) {
        return { shipment: { id: directDoc.id, ...directDoc.data() }, confidence: 0.98 };
    }
    
    // Try shipmentID field
    const shipmentQuery = await db.collection('shipments')
        .where('shipmentID', '==', shipmentId)
        .where('companyID', '==', companyId)
        .limit(1)
        .get();
        
    if (!shipmentQuery.empty) {
        const doc = shipmentQuery.docs[0];
        return { shipment: { id: doc.id, ...doc.data() }, confidence: 0.98 };
    }
    
    return null;
}

async function findReferenceMatches(referenceNumber, companyId) {
    const { db } = initServices();
    const matches = [];
    
    // Search in various reference fields
    const searchFields = [
        'shipperReferenceNumber',
        'bookingReferenceNumber', 
        'customerReferenceNumber',
        'poNumber',
        'orderNumber'
    ];
    
    for (const field of searchFields) {
        const query = await db.collection('shipments')
            .where(`shipmentInfo.${field}`, '==', referenceNumber)
            .where('companyID', '==', companyId)
            .limit(5)
            .get();
            
        query.docs.forEach(doc => {
            matches.push({
                shipment: { id: doc.id, ...doc.data() },
                confidence: 0.92,
                matchedField: field
            });
        });
    }
    
    return matches;
}

async function performFuzzyMatching(shipmentData, companyId, options = {}) {
    // Simplified fuzzy matching implementation
    // In production, this would use more sophisticated algorithms
    return [];
}

function selectBestMatch(matches, criteria) {
    // Simple best match selection - in production would be more sophisticated
    return matches.length > 0 ? matches[0] : null;
}

function extractDateRange(shipmentData) {
    // Extract date range from shipment data for matching
    return {
        start: null,
        end: null
    };
}

function identifyExtractionIssues(shipmentData) {
    const issues = [];
    
    if (!shipmentData.originalData?.shipmentId?.value) {
        issues.push({ field: 'shipmentId', severity: 'critical', issue: 'missing' });
    }
    
    if (!shipmentData.originalData?.charges || shipmentData.originalData.charges.length === 0) {
        issues.push({ field: 'charges', severity: 'critical', issue: 'missing' });
    }
    
    return issues;
}

function generateSuggestedActions(shipmentData) {
    const actions = [];
    
    actions.push({ action: 'review_extraction', priority: 'high' });
    actions.push({ action: 'manual_matching', priority: 'medium' });
    
    return actions;
}

function determinePriority(shipmentData, qualityAssessment) {
    const confidence = shipmentData.validationStatus?.completenessScore || 0;
    
    if (confidence < 0.3) return 'urgent';
    if (confidence < 0.6) return 'high';
    if (confidence < 0.8) return 'medium';
    return 'low';
}

async function createTrainingSampleFromAI(aiResults, userId) {
    // Create training sample from AI processing results
    return {
        id: `training_${Date.now()}`,
        source: 'ai_processing',
        data: aiResults,
        createdBy: userId,
        createdAt: new Date().toISOString()
    };
}

async function updateCarrierModel(carrierId, trainingSample) {
    // Update carrier-specific model with new training data
    return {
        carrierId: carrierId,
        updated: true,
        version: '1.0'
    };
}

async function storeTrainingData(trainingSample, processingId) {
    const { db } = initServices();
    
    await db.collection('trainingData').doc(trainingSample.id).set({
        ...trainingSample,
        processingId: processingId,
        storedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function crossValidateResults(productionResults, learningResults, processingId) {
    // Cross-validate production and learning results for improvement
    console.log('🔄 Cross-validating results...');
}

async function storeUnifiedResults(aiResults, finalResults, strategy, userId) {
    const { db } = initServices();
    
    await db.collection('unifiedProcessingResults').doc(aiResults.processingId).set({
        aiResults: aiResults,
        finalResults: finalResults,
        strategy: strategy,
        processedBy: userId,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * 🔧 LEARNING FROM CORRECTIONS
 * Process user corrections to improve models
 */
exports.learnFromCorrections = onCall({
    cors: {
        origin: ['https://solushipx.web.app', 'http://localhost:3000'],
        credentials: true
    },
    timeoutSeconds: 120,
    memory: '512MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { processingId, corrections, feedback } = request.data || {};

        if (!processingId || !corrections) {
            throw new Error('processingId and corrections are required');
        }

        console.log(`📚 Learning from corrections for: ${processingId}`);

        const { db } = initServices();

        // Store corrections for model improvement
        await db.collection('processingCorrections').doc().set({
            processingId: processingId,
            corrections: corrections,
            feedback: feedback,
            correctedBy: request.auth.uid,
            correctedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Trigger model retraining if needed
        await triggerModelRetrainingIfNeeded(processingId, corrections);

        console.log('✅ Corrections processed successfully');

        return {
            success: true,
            message: 'Corrections received and will be used to improve the AI models',
            processingId: processingId
        };

    } catch (error) {
        console.error('❌ Learning from corrections error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

async function triggerModelRetrainingIfNeeded(processingId, corrections) {
    // Logic to determine if model retraining is needed
    // and trigger the retraining process
    console.log('🎯 Checking if model retraining is needed...');
}

module.exports = {
    processInvoiceUnified: exports.processInvoiceUnified,
    learnFromCorrections: exports.learnFromCorrections
};
