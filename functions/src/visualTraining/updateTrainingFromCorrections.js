const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Update training model based on user corrections
 * This function learns from user feedback to improve future predictions
 */
exports.updateTrainingFromCorrections = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { analysisId, corrections, userFeedback } = request.data;
        
        if (!request.auth) {
            throw new Error('Authentication required');
        }
        
        if (!analysisId || !corrections) {
            throw new Error('analysisId and corrections are required');
        }
        
        console.log('🔄 Processing user corrections for:', analysisId);
        
        // Get the original analysis
        const analysisDoc = await db.collection('visualTrainingData').doc(analysisId).get();
        if (!analysisDoc.exists) {
            throw new Error('Analysis not found');
        }
        
        const analysisData = analysisDoc.data();
        
        // Process each correction
        const processedCorrections = [];
        const improvementMetrics = {
            totalCorrections: corrections.length,
            confidenceImprovements: 0,
            newFieldsAdded: 0,
            incorrectFieldsRemoved: 0
        };
        
        for (const correction of corrections) {
            const processed = await processCorrection(correction, analysisData);
            processedCorrections.push(processed);
            
            // Update metrics
            if (correction.action === 'improve_confidence') {
                improvementMetrics.confidenceImprovements++;
            } else if (correction.action === 'add_field') {
                improvementMetrics.newFieldsAdded++;
            } else if (correction.action === 'remove_field') {
                improvementMetrics.incorrectFieldsRemoved++;
            }
        }
        
        // Store correction data for learning
        const correctionRecord = {
            analysisId,
            carrierId: analysisData.carrierId,
            exampleId: analysisData.exampleId,
            userId: request.auth.uid,
            corrections: processedCorrections,
            userFeedback,
            metrics: improvementMetrics,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'processed'
        };
        
        await db.collection('userCorrections').add(correctionRecord);
        
        // Update the training template with learned improvements
        await updateCarrierTemplate(analysisData.carrierId, processedCorrections);
        
        // Update the original analysis with corrected data
        const updatedBoundingBoxes = applyCorrectionsToAnalysis(
            analysisData.boundingBoxes, 
            processedCorrections
        );
        
        await db.collection('visualTrainingData').doc(analysisId).update({
            boundingBoxes: updatedBoundingBoxes,
            corrected: true,
            correctionCount: processedCorrections.length,
            userFeedback,
            lastCorrectedAt: admin.firestore.FieldValue.serverTimestamp(),
            confidence: calculateOverallConfidence(updatedBoundingBoxes)
        });
        
        // Generate learning insights
        const learningInsights = await generateLearningInsights(
            analysisData.carrierId, 
            processedCorrections
        );
        
        console.log('✅ Corrections processed successfully:', {
            correctionCount: processedCorrections.length,
            improvementMetrics,
            learningInsights
        });
        
        return {
            success: true,
            data: {
                correctionCount: processedCorrections.length,
                metrics: improvementMetrics,
                learningInsights,
                updatedConfidence: calculateOverallConfidence(updatedBoundingBoxes)
            }
        };
        
    } catch (error) {
        console.error('❌ Correction processing failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Process individual correction
 */
async function processCorrection(correction, analysisData) {
    const { 
        boundingBoxId, 
        action, 
        newBoundingBox, 
        newValue, 
        newType, 
        confidence 
    } = correction;
    
    const processed = {
        boundingBoxId,
        action,
        timestamp: new Date().toISOString(),
        originalConfidence: 0,
        newConfidence: confidence || 1.0
    };
    
    // Find original bounding box
    const originalBox = analysisData.boundingBoxes.find(box => box.id === boundingBoxId);
    if (originalBox) {
        processed.originalConfidence = originalBox.confidence;
        processed.originalBoundingBox = originalBox.boundingBox;
        processed.originalValue = originalBox.value;
        processed.originalType = originalBox.type;
    }
    
    switch (action) {
        case 'adjust_bounds':
            processed.newBoundingBox = newBoundingBox;
            processed.improvementType = 'spatial_accuracy';
            break;
            
        case 'correct_value':
            processed.newValue = newValue;
            processed.improvementType = 'content_accuracy';
            break;
            
        case 'change_type':
            processed.newType = newType;
            processed.improvementType = 'classification_accuracy';
            break;
            
        case 'add_field':
            processed.newBoundingBox = newBoundingBox;
            processed.newValue = newValue;
            processed.newType = newType;
            processed.improvementType = 'detection_coverage';
            break;
            
        case 'remove_field':
            processed.improvementType = 'false_positive_reduction';
            break;
            
        case 'improve_confidence':
            processed.improvementType = 'confidence_calibration';
            break;
    }
    
    return processed;
}

/**
 * Update carrier template with learned patterns
 */
async function updateCarrierTemplate(carrierId, corrections) {
    try {
        // Get existing template
        const templateRef = db.collection('carrierInvoiceTemplates').doc(carrierId);
        const templateDoc = await templateRef.get();
        
        let templateData = templateDoc.exists ? templateDoc.data() : {
            carrierId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            patterns: {},
            learningData: {
                correctionHistory: [],
                improvedFields: [],
                commonMistakes: []
            }
        };
        
        // Analyze corrections to extract learning patterns
        const learningPatterns = extractLearningPatterns(corrections);
        
        // Update template with new patterns
        if (learningPatterns.spatialPatterns.length > 0) {
            templateData.patterns.spatialPatterns = [
                ...(templateData.patterns.spatialPatterns || []),
                ...learningPatterns.spatialPatterns
            ];
        }
        
        if (learningPatterns.contentPatterns.length > 0) {
            templateData.patterns.contentPatterns = [
                ...(templateData.patterns.contentPatterns || []),
                ...learningPatterns.contentPatterns
            ];
        }
        
        // Update learning metadata
        templateData.learningData.correctionHistory.push({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            correctionCount: corrections.length,
            patterns: learningPatterns
        });
        
        templateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        templateData.totalCorrections = (templateData.totalCorrections || 0) + corrections.length;
        
        await templateRef.set(templateData, { merge: true });
        
        console.log('📚 Template updated with learning patterns for carrier:', carrierId);
        
    } catch (error) {
        console.error('Failed to update carrier template:', error);
    }
}

/**
 * Extract learning patterns from corrections
 */
function extractLearningPatterns(corrections) {
    const patterns = {
        spatialPatterns: [],
        contentPatterns: [],
        typePatterns: []
    };
    
    corrections.forEach(correction => {
        switch (correction.improvementType) {
            case 'spatial_accuracy':
                if (correction.originalBoundingBox && correction.newBoundingBox) {
                    patterns.spatialPatterns.push({
                        fieldType: correction.originalType,
                        adjustment: calculateBoundingBoxAdjustment(
                            correction.originalBoundingBox,
                            correction.newBoundingBox
                        ),
                        confidence: correction.newConfidence
                    });
                }
                break;
                
            case 'content_accuracy':
                if (correction.originalValue && correction.newValue) {
                    patterns.contentPatterns.push({
                        fieldType: correction.originalType,
                        originalPattern: correction.originalValue,
                        correctedPattern: correction.newValue,
                        confidence: correction.newConfidence
                    });
                }
                break;
                
            case 'classification_accuracy':
                if (correction.originalType && correction.newType) {
                    patterns.typePatterns.push({
                        originalType: correction.originalType,
                        correctedType: correction.newType,
                        value: correction.originalValue,
                        confidence: correction.newConfidence
                    });
                }
                break;
        }
    });
    
    return patterns;
}

/**
 * Calculate bounding box adjustment vector
 */
function calculateBoundingBoxAdjustment(originalBox, newBox) {
    // Simplified calculation - in production this would be more sophisticated
    return {
        xOffset: (newBox.vertices[0].x || 0) - (originalBox.vertices[0].x || 0),
        yOffset: (newBox.vertices[0].y || 0) - (originalBox.vertices[0].y || 0),
        widthChange: calculateBoxWidth(newBox) - calculateBoxWidth(originalBox),
        heightChange: calculateBoxHeight(newBox) - calculateBoxHeight(originalBox)
    };
}

/**
 * Calculate bounding box width
 */
function calculateBoxWidth(boundingBox) {
    if (!boundingBox.vertices || boundingBox.vertices.length < 2) return 0;
    return Math.abs((boundingBox.vertices[1].x || 0) - (boundingBox.vertices[0].x || 0));
}

/**
 * Calculate bounding box height
 */
function calculateBoxHeight(boundingBox) {
    if (!boundingBox.vertices || boundingBox.vertices.length < 4) return 0;
    return Math.abs((boundingBox.vertices[3].y || 0) - (boundingBox.vertices[0].y || 0));
}

/**
 * Apply corrections to analysis bounding boxes
 */
function applyCorrectionsToAnalysis(originalBoxes, corrections) {
    let updatedBoxes = [...originalBoxes];
    
    corrections.forEach(correction => {
        const boxIndex = updatedBoxes.findIndex(box => box.id === correction.boundingBoxId);
        
        if (boxIndex !== -1) {
            const box = { ...updatedBoxes[boxIndex] };
            
            switch (correction.action) {
                case 'adjust_bounds':
                    box.boundingBox = correction.newBoundingBox;
                    box.confidence = correction.newConfidence;
                    break;
                    
                case 'correct_value':
                    box.value = correction.newValue;
                    box.confidence = correction.newConfidence;
                    break;
                    
                case 'change_type':
                    box.type = correction.newType;
                    box.label = generateLabelForType(correction.newType);
                    box.color = getColorForType(correction.newType);
                    break;
                    
                case 'remove_field':
                    updatedBoxes.splice(boxIndex, 1);
                    return; // Skip the update since we removed the box
                    
                case 'improve_confidence':
                    box.confidence = correction.newConfidence;
                    break;
            }
            
            box.corrected = true;
            box.lastCorrectedAt = new Date().toISOString();
            updatedBoxes[boxIndex] = box;
            
        } else if (correction.action === 'add_field') {
            // Add new bounding box
            updatedBoxes.push({
                id: `corrected_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                type: correction.newType,
                label: generateLabelForType(correction.newType),
                color: getColorForType(correction.newType),
                boundingBox: correction.newBoundingBox,
                confidence: correction.newConfidence,
                value: correction.newValue,
                editable: true,
                corrected: true,
                addedByUser: true,
                createdAt: new Date().toISOString()
            });
        }
    });
    
    return updatedBoxes;
}

/**
 * Generate label for field type
 */
function generateLabelForType(type) {
    const labels = {
        'carrier_logo': 'Carrier Logo',
        'invoice_number': 'Invoice Number',
        'invoice_date': 'Invoice Date',
        'total_amount': 'Total Amount',
        'shipment_id': 'Shipment ID',
        'tracking_number': 'Tracking Number',
        'due_date': 'Due Date',
        'customer_info': 'Customer Information',
        'billing_address': 'Billing Address',
        'service_type': 'Service Type'
    };
    
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Get color for field type
 */
function getColorForType(type) {
    const colors = {
        'carrier_logo': '#2196F3',     // Blue
        'invoice_number': '#FFEB3B',   // Yellow
        'invoice_date': '#FF9800',     // Orange
        'total_amount': '#9C27B0',     // Purple
        'shipment_id': '#4CAF50',      // Green
        'tracking_number': '#00BCD4',  // Cyan
        'due_date': '#FF5722',         // Red-Orange
        'customer_info': '#795548',    // Brown
        'billing_address': '#607D8B',  // Blue Grey
        'service_type': '#E91E63'      // Pink
    };
    
    return colors[type] || '#757575'; // Grey for unknown types
}

/**
 * Generate learning insights from corrections
 */
async function generateLearningInsights(carrierId, corrections) {
    const insights = {
        mostCommonCorrections: {},
        accuracyImprovements: {},
        recommendedImprovements: []
    };
    
    // Analyze correction types
    corrections.forEach(correction => {
        const type = correction.improvementType;
        insights.mostCommonCorrections[type] = (insights.mostCommonCorrections[type] || 0) + 1;
    });
    
    // Calculate accuracy improvements
    corrections.forEach(correction => {
        if (correction.originalConfidence && correction.newConfidence) {
            const improvement = correction.newConfidence - correction.originalConfidence;
            if (improvement > 0) {
                const fieldType = correction.originalType || 'unknown';
                if (!insights.accuracyImprovements[fieldType]) {
                    insights.accuracyImprovements[fieldType] = [];
                }
                insights.accuracyImprovements[fieldType].push(improvement);
            }
        }
    });
    
    // Generate recommendations
    if (insights.mostCommonCorrections.spatial_accuracy > 2) {
        insights.recommendedImprovements.push(
            'Consider adjusting spatial detection algorithms for better bounding box accuracy'
        );
    }
    
    if (insights.mostCommonCorrections.content_accuracy > 2) {
        insights.recommendedImprovements.push(
            'OCR accuracy could be improved for this carrier\'s document format'
        );
    }
    
    if (insights.mostCommonCorrections.detection_coverage > 1) {
        insights.recommendedImprovements.push(
            'Some important fields are being missed - enhance field detection patterns'
        );
    }
    
    return insights;
}

/**
 * Calculate overall confidence score
 */
function calculateOverallConfidence(boundingBoxes) {
    if (!boundingBoxes.length) return 0;
    
    const totalConfidence = boundingBoxes.reduce((sum, box) => sum + box.confidence, 0);
    return totalConfidence / boundingBoxes.length;
}
