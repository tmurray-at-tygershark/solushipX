const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { httpsCallable } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');

const db = getFirestore();

/**
 * Core logic for intelligent automation - extracted for internal use
 */
async function performIntelligentAutoApproval(uploadId, userId) {
    try {
        if (!uploadId) {
            throw new Error('Missing required parameter: uploadId.');
        }

        logger.info(`🤖 Starting intelligent auto-processing for upload: ${uploadId}`, {
            uploadId,
            userId
        });

        // Update status to show automation started
        await db.collection('apUploads').doc(uploadId).update({
            automationStatus: 'extracting_charges',
            automationProgress: {
                step: 'extracting_charges',
                message: 'Analyzing extracted charges...',
                startedAt: FieldValue.serverTimestamp(),
                progress: 10
            },
            lastUpdated: FieldValue.serverTimestamp()
        });

        // Load the upload document
        const uploadDoc = await db.collection('apUploads').doc(uploadId).get();
        if (!uploadDoc.exists) {
            throw new HttpsError('not-found', `Upload not found: ${uploadId}`);
        }

        const uploadData = uploadDoc.data();
        
        // Verify extraction was successful
        if (!uploadData.extractedData || uploadData.processingStatus !== 'completed') {
            logger.warn(`Upload ${uploadId} is not ready for auto-processing`, {
                hasExtractedData: !!uploadData.extractedData,
                processingStatus: uploadData.processingStatus
            });
            return { success: false, reason: 'Upload not ready for processing' };
        }

        // Check if automation already completed successfully
        if (uploadData.automationStatus === 'processed') {
            logger.info(`Upload ${uploadId} already processed successfully`);
            return { 
                success: true, 
                reason: 'Already processed',
                totalShipments: uploadData.automationResults?.totalShipments || 0,
                processedShipments: uploadData.automationResults?.processedShipments || 0
            };
        }

        const extractedData = uploadData.extractedData;
        let processedShipments = 0;
        let totalShipments = 0;
        const results = [];

        // Update status: Matching shipments
        await db.collection('apUploads').doc(uploadId).update({
            automationStatus: 'matching_shipments',
            automationProgress: {
                step: 'matching_shipments',
                message: 'Finding matching shipments in database...',
                progress: 25
            },
            lastUpdated: FieldValue.serverTimestamp()
        });

        // Process each extracted shipment
        let shipments = [];
        
        // First try direct shipments array
        if (Array.isArray(extractedData.shipments)) {
            shipments = extractedData.shipments;
        }
        // Then try nested extractedData.extractedData.shipments
        else if (extractedData?.extractedData?.shipments && Array.isArray(extractedData.extractedData.shipments)) {
            logger.info(`🔄 Using nested extractedData.extractedData.shipments structure`);
            shipments = extractedData.extractedData.shipments;
        }
        // Fallback to charges-based single shipment
        else if (extractedData.charges) {
            shipments = [extractedData];
        }
        else {
            shipments = [];
        }

        logger.info(`Found ${shipments.length} shipments to process in upload ${uploadId}`);

        // Update status to matching shipments
        await db.collection('apUploads').doc(uploadId).update({
            automationStatus: 'matching_shipments',
            automationProgress: {
                step: 'matching_shipments',
                message: `Matching ${shipments.length} shipments to system records...`,
                totalShipments: shipments.length,
                processedShipments: 0
            },
            lastUpdated: FieldValue.serverTimestamp()
        });

        for (const shipmentData of shipments) {
            totalShipments++;
            
            try {
                // Ensure we have a valid shipment identifier
                const shipmentId = shipmentData.shipmentId || shipmentData.shipmentID || shipmentData.id || 
                                 shipmentData.trackingNumber || shipmentData.referenceNumber || 
                                 `shipment_${totalShipments}`;
                
                // Create a normalized shipment data object
                const normalizedShipmentData = {
                    ...shipmentData,
                    shipmentId: shipmentId
                };
                
                logger.info(`Processing shipment ${totalShipments}: ${shipmentId}`, {
                    originalKeys: Object.keys(shipmentData),
                    hasShipmentId: !!shipmentData.shipmentId,
                    hasShipmentID: !!shipmentData.shipmentID,
                    finalShipmentId: shipmentId,
                    shipmentDataSample: {
                        shipmentId: shipmentData.shipmentId,
                        shipmentID: shipmentData.shipmentID,
                        id: shipmentData.id,
                        orderNumber: shipmentData.orderNumber,
                        trackingNumber: shipmentData.trackingNumber,
                        referenceNumber: shipmentData.referenceNumber
                    }
                });
                
                // Update progress for current shipment
                await db.collection('apUploads').doc(uploadId).update({
                    'automationProgress.processedShipments': totalShipments - 1,
                    'automationProgress.message': `Matching shipment ${totalShipments} of ${shipments.length}: ${shipmentId}...`,
                    lastUpdated: FieldValue.serverTimestamp()
                });

                // Attempt to match the shipment
                const matchResult = await attemptShipmentMatching(normalizedShipmentData, uploadData);
                
                if (matchResult.matched && matchResult.confidence >= 80) {
                    logger.info(`Matched shipment ${shipmentId} with confidence ${matchResult.confidence}%`);
                    
                    // Update status to matching charges
                    await db.collection('apUploads').doc(uploadId).update({
                        automationStatus: 'matching_charges',
                        'automationProgress.step': 'matching_charges',
                        'automationProgress.message': `Analyzing charges for shipment: ${shipmentId}...`,
                        lastUpdated: FieldValue.serverTimestamp()
                    });

                    // Run intelligent auto-approval for matched shipment
                    console.log(`🚨 PRE-CALL DEBUG: About to call runIntelligentAutoApproval for ${matchResult.matchedShipmentId}`);
                    const autoApprovalResult = await runIntelligentAutoApproval(
                        matchResult.matchedShipmentId,
                        normalizedShipmentData,
                        uploadData,
                        userId,
                        uploadId
                    );
                    console.log(`🚨 POST-CALL DEBUG: runIntelligentAutoApproval returned:`, autoApprovalResult);
                    
                    if (autoApprovalResult.success) {
                        processedShipments++;
                        results.push({
                            shipmentId: shipmentId,
                            status: 'processed',
                            matchedShipmentId: matchResult.matchedShipmentId,
                            confidence: matchResult.confidence,
                            appliedCharges: autoApprovalResult.appliedCharges,
                            invoiceStatus: autoApprovalResult.invoiceStatus
                        });
                    } else {
                        results.push({
                            shipmentId: shipmentId,
                            status: 'match_found_but_processing_failed',
                            matchedShipmentId: matchResult.matchedShipmentId,
                            confidence: matchResult.confidence,
                            error: autoApprovalResult.error
                        });
                    }
                } else {
                    logger.info(`No suitable match found for shipment ${shipmentId}`, {
                        confidence: matchResult.confidence
                    });
                    results.push({
                        shipmentId: shipmentId,
                        status: 'no_match',
                        confidence: matchResult.confidence
                    });
                }
            } catch (error) {
                logger.error(`Error processing shipment ${shipmentId}:`, error);
                results.push({
                    shipmentId: shipmentId,
                    status: 'error',
                    error: error.message
                });
            }
        }

        // Determine overall upload status
        let uploadStatus = 'ready_to_process';
        if (processedShipments === totalShipments && totalShipments > 0) {
            uploadStatus = 'processed';
        } else if (processedShipments > 0) {
            uploadStatus = 'partially_processed';
        }

        // Update upload with automation results
        await db.collection('apUploads').doc(uploadId).update({
            automationStatus: uploadStatus,
            automationProgress: {
                step: 'completed',
                message: `Automation complete! Processed ${processedShipments}/${totalShipments} shipments.`,
                progress: 100,
                completedAt: FieldValue.serverTimestamp()
            },
            automationResults: {
                processedAt: FieldValue.serverTimestamp(),
                processedBy: userId,
                totalShipments,
                processedShipments,
                results
            },
            lastUpdated: FieldValue.serverTimestamp()
        });

        logger.info(`Intelligent auto-processing completed for upload ${uploadId}`, {
            uploadId,
            totalShipments,
            processedShipments,
            uploadStatus,
            results: results.length
        });

        return {
            success: true,
            uploadId,
            totalShipments,
            processedShipments,
            uploadStatus,
            results
        };

    } catch (error) {
        logger.error('❌ Intelligent auto-approval failed:', {
            uploadId,
            error: error.message,
            stack: error.stack
        });

        // Update upload document with error status
        await db.collection('apUploads').doc(uploadId).update({
            automationStatus: 'failed',
            automationError: error.message,
            automationProgress: {
                step: 'failed',
                message: `Failed: ${error.message}`,
                failedAt: FieldValue.serverTimestamp()
            },
            lastUpdated: FieldValue.serverTimestamp()
        });

        throw error;
    }
}

/**
 * Cloud Function wrapper for intelligent automation
 */
exports.processIntelligentAutoApproval = onCall({
    cors: true,
    enforceAppCheck: false,
    timeoutSeconds: 300 // 5 minutes for complex processing
}, async (request) => {
    try {
        const { uploadId } = request.data;
        const { auth } = request;

        if (!auth) {
            throw new HttpsError('unauthenticated', 'Authentication required.');
        }

        if (!uploadId) {
            throw new HttpsError('invalid-argument', 'Missing required parameter: uploadId.');
        }

        return await performIntelligentAutoApproval(uploadId, auth.uid);
    } catch (error) {
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Failed to process intelligent auto-approval.', error.message);
    }
});

/**
 * Attempt to match an extracted shipment to an existing shipment in the system
 */
async function attemptShipmentMatching(shipmentData, uploadData) {
    try {
        const shipmentId = shipmentData.shipmentId || shipmentData.shipmentID;
        
        if (!shipmentId) {
            return { matched: false, confidence: 0, reason: 'No shipment ID found' };
        }

        // Clean and normalize the shipment ID
        const cleanShipmentId = shipmentId.toString().trim();
        
        logger.info(`Attempting to match shipment ID: ${cleanShipmentId}`);

        // Try exact match first
        const exactMatch = await db.collection('shipments')
            .where('shipmentID', '==', cleanShipmentId)
            .limit(1)
            .get();

        if (!exactMatch.empty) {
            const matchedDoc = exactMatch.docs[0];
            logger.info(`Found exact match for ${cleanShipmentId}: ${matchedDoc.id}`);
            return {
                matched: true,
                confidence: 100,
                matchedShipmentId: matchedDoc.id,
                matchedShipmentData: matchedDoc.data(),
                matchType: 'exact'
            };
        }

        // Try fuzzy matching on reference numbers
        const referenceNumbers = [
            shipmentData.referenceNumber,
            shipmentData.customerReference,
            shipmentData.orderNumber,
            ...(shipmentData.references || [])
        ].filter(ref => ref && ref.toString().trim());

        for (const refNum of referenceNumbers) {
            const cleanRef = refNum.toString().trim();
            
            // Check shipmentID field
            const refMatch = await db.collection('shipments')
                .where('shipmentID', '==', cleanRef)
                .limit(1)
                .get();

            if (!refMatch.empty) {
                const matchedDoc = refMatch.docs[0];
                logger.info(`Found reference match for ${cleanRef}: ${matchedDoc.id}`);
                return {
                    matched: true,
                    confidence: 90,
                    matchedShipmentId: matchedDoc.id,
                    matchedShipmentData: matchedDoc.data(),
                    matchType: 'reference'
                };
            }
        }

        return { matched: false, confidence: 0, reason: 'No matches found' };

    } catch (error) {
        logger.error('Error in shipment matching:', error);
        return { matched: false, confidence: 0, reason: error.message };
    }
}

/**
 * Run intelligent auto-approval for a matched shipment
 */
async function runIntelligentAutoApproval(matchedShipmentId, extractedShipmentData, uploadData, userId, uploadId) {
    try {
        console.log(`🚨 BASIC DEBUG: runIntelligentAutoApproval called for ${matchedShipmentId}`);
        
        // Load the matched shipment data
        const shipmentDoc = await db.collection('shipments').doc(matchedShipmentId).get();
        if (!shipmentDoc.exists) {
            throw new Error(`Matched shipment not found: ${matchedShipmentId}`);
        }

        const shipmentData = shipmentDoc.data();
        
        // Get shipment date for currency conversion
        const shipmentDate = shipmentData.shipmentInfo?.shipmentDate || 
                           shipmentData.shipmentDate || 
                           shipmentData.bookedAt || 
                           shipmentData.createdAt;

        // Extract charges from the extracted data
        const invoiceCharges = extractedShipmentData.charges || [];
        console.log(`🚨 BASIC DEBUG: extractedShipmentData.charges for ${matchedShipmentId}:`, JSON.stringify(invoiceCharges, null, 2));
        
        const systemCharges = extractShipmentCharges(shipmentData);
        console.log(`🚨 BASIC DEBUG: systemCharges for ${matchedShipmentId}:`, JSON.stringify(systemCharges, null, 2));

        logger.info(`Analyzing charges for shipment ${matchedShipmentId}`, {
            invoiceCharges: invoiceCharges.length,
            systemCharges: systemCharges.length,
            invoiceChargesList: invoiceCharges.map(ic => ({ name: ic.name || ic.description, amount: ic.amount })),
            systemChargesList: systemCharges.map(sc => ({ name: sc.name || sc.description, amount: sc.amount }))
        });

        // Filter out tax charges (matching frontend behavior)
        const filterTaxCharges = (charges) => charges.filter(charge => {
            const chargeName = (charge.name || charge.description || '').toLowerCase();
            const chargeCode = (charge.code || '').toLowerCase();
            
            const isTaxCharge = 
                chargeName.includes('hst') ||
                chargeName.includes('gst') ||
                chargeName.includes('pst') ||
                chargeName.includes('qst') ||
                chargeName.includes('tax') ||
                chargeCode.includes('hst') ||
                chargeCode.includes('gst') ||
                chargeCode.includes('pst') ||
                chargeCode.includes('qst') ||
                chargeCode.includes('tax');
            
            if (isTaxCharge) {
                console.log('🚫 Filtering out tax charge:', charge.code || 'N/A', charge.name || charge.description);
            }
            
            return !isTaxCharge;
        });

        const filteredInvoiceCharges = filterTaxCharges(invoiceCharges);
        const filteredSystemCharges = filterTaxCharges(systemCharges);

        logger.info(`After tax filtering for ${matchedShipmentId}:`, {
            originalInvoiceCharges: invoiceCharges.length,
            filteredInvoiceCharges: filteredInvoiceCharges.length,
            originalSystemCharges: systemCharges.length,
            filteredSystemCharges: filteredSystemCharges.length,
            filteredOutCharges: (invoiceCharges.length - filteredInvoiceCharges.length) + (systemCharges.length - filteredSystemCharges.length)
        });

        // Perform intelligent charge matching and analysis
        const { matchedCharges, unmatchedCharges } = await performChargeMatching(
            filteredInvoiceCharges,
            filteredSystemCharges,
            shipmentDate
        );
        
        logger.info(`🔍 CHARGE MATCHING RESULT for ${matchedShipmentId}`, {
            inputInvoiceCharges: invoiceCharges.length,
            inputSystemCharges: systemCharges.length,
            outputMatchedCharges: matchedCharges.length,
            outputUnmatchedCharges: unmatchedCharges.length
        });

        // Determine auto-approval recommendations
        logger.info(`🔍 DEBUGGING: About to categorize charges`, {
            matchedChargesInput: matchedCharges.length,
            unmatchedChargesInput: unmatchedCharges.length
        });
        
        const { perfectMatches, exceptionCharges } = categorizeChargesForApproval(
            matchedCharges,
            unmatchedCharges
        );
        
        logger.info(`🔍 DEBUGGING: Categorization complete`, {
            perfectMatchesOutput: perfectMatches.length,
            exceptionChargesOutput: exceptionCharges.length
        });

        logger.info(`Categorized charges for ${matchedShipmentId}:`, {
            totalMatched: matchedCharges.length,
            perfectMatches: perfectMatches.length,
            exceptionCharges: exceptionCharges.length,
            unmatchedCount: unmatchedCharges.length,
            allMatchedCharges: matchedCharges.map(mc => ({
                name: mc.name,
                confidence: mc.confidence,
                variancePercent: mc.variancePercent,
                systemCode: mc.systemCode,
                systemQuotedCost: mc.systemQuotedCost,
                systemQuotedCharge: mc.systemQuotedCharge
            })),
            perfectMatchDetails: perfectMatches.map(pm => ({
                name: pm.name,
                confidence: pm.confidence,
                variancePercent: pm.variancePercent,
                systemCode: pm.systemCode
            })),
            exceptionChargeDetails: exceptionCharges.map(ec => ({
                name: ec.name,
                confidence: ec.confidence,
                variancePercent: ec.variancePercent,
                systemCode: ec.systemCode
            })),
            unmatchedCharges: unmatchedCharges.map(uc => ({
                name: uc.name,
                reason: uc.reason || 'No match found'
            }))
        });

        // CRITICAL DEBUGGING: Log why no perfect matches found
        if (perfectMatches.length === 0) {
            logger.warn(`⚠️ NO PERFECT MATCHES FOUND for ${matchedShipmentId}`, {
                matchedChargesCount: matchedCharges.length,
                matchedChargesDetails: matchedCharges.map(mc => ({
                    name: mc.name,
                    confidence: mc.confidence,
                    variancePercent: mc.variancePercent,
                    meetsConfidenceThreshold: mc.confidence >= 50,
                    meetsVarianceThreshold: mc.variancePercent <= 25,
                    shouldBeApproved: mc.confidence >= 50 || mc.variancePercent <= 25
                }))
            });
        }

        let appliedCharges = 0;
        let invoiceStatus = 'ready_to_process';

        // Process perfect matches (95%+ confidence)
        if (perfectMatches.length > 0) {
            logger.info(`🎯 Found ${perfectMatches.length} perfect matches to process`);
            
            // Update status to approving charges
            if (uploadId) {
                await db.collection('apUploads').doc(uploadId).update({
                    automationStatus: 'approving_charges',
                    'automationProgress.step': 'approving_charges',
                    'automationProgress.message': `Auto-approving ${perfectMatches.length} perfect matches...`,
                    lastUpdated: FieldValue.serverTimestamp()
                });
            }

            logger.info(`💳 About to apply charges for shipment ${matchedShipmentId}`, {
                perfectMatches: perfectMatches.map(pm => ({
                    name: pm.name,
                    code: pm.systemCode,
                    actualCost: pm.systemQuotedCost,
                    actualCharge: pm.systemQuotedCharge
                }))
            });

            // USE SEPARATE AUTOMATION FUNCTION TO AVOID BREAKING MANUAL VERSION
            const { applyChargesForAutomation } = require('./applyInvoiceCharges');
            
            // Create the charge data in the expected format
            const invoiceDataForCharges = {
                invoiceNumber: uploadData.invoiceNumber,
                invoiceRef: uploadData.metadata?.invoiceRef || uploadData.invoiceNumber,
                fileName: uploadData.fileName || 'Auto-processed'
            };

            const chargesToApply = perfectMatches.map(charge => ({
                // IDENTICAL FIELD MAPPING TO MANUAL APPROVAL
                code: charge.systemCode || charge.code || charge.chargeCode || 'MISC',
                name: charge.systemName || charge.name || charge.chargeName || charge.description || 'Unknown Charge',
                actualCost: charge.systemQuotedCost || charge.systemActualCost || charge.actualCost || charge.quotedCost || 0,
                actualCharge: charge.systemQuotedCharge || charge.systemActualCharge || charge.actualCharge || charge.quotedCharge || 0,
                currency: charge.systemCurrency || charge.currency || 'CAD',
                ediNumber: uploadData.invoiceNumber || uploadData.metadata?.invoiceRef
            }));

            // Debug: Log the charges being passed to applyChargesForAutomation
            logger.info('🔍 CHARGES TO APPLY DEBUG:', {
                shipmentId: matchedShipmentId,
                chargesCount: chargesToApply.length,
                charges: chargesToApply,
                hasAppliedAtFields: chargesToApply.some(c => c.appliedAt !== undefined),
                chargeFields: chargesToApply.map(c => Object.keys(c))
            });

            // Update status: Approving charges
            await db.collection('apUploads').doc(uploadId).update({
                automationStatus: 'approving_charges',
                'automationProgress.step': 'approving_charges',
                'automationProgress.message': `Auto-applying ${perfectMatches.length} qualified charges to ${matchedShipmentId}...`,
                'automationProgress.progress': 75,
                lastUpdated: FieldValue.serverTimestamp()
            });

            const perfectMatchResult = await applyChargesForAutomation(matchedShipmentId, invoiceDataForCharges, chargesToApply);

            logger.info(`Perfect match charge application result:`, {
                shipmentId: matchedShipmentId,
                success: perfectMatchResult.success,
                chargesApplied: perfectMatches.length,
                result: perfectMatchResult,
                errorDetails: perfectMatchResult.error
            });

            if (perfectMatchResult.success) {
                appliedCharges += perfectMatches.length;
                logger.info(`✅ Successfully applied ${perfectMatches.length} perfect match charges to ${matchedShipmentId}`);
            } else {
                logger.error(`❌ Failed to apply perfect match charges to ${matchedShipmentId}:`, {
                    error: perfectMatchResult.error,
                    fullResult: perfectMatchResult
                });
            }
        }

        // Process exception charges (80-94% confidence)
        if (exceptionCharges.length > 0) {
            // USE THE EXACT SAME applyInvoiceCharges CLOUD FUNCTION AS MANUAL APPROVAL
            const exceptionApprovalRequest = {
                data: {
                    shipmentId: matchedShipmentId,
                    invoiceData: {
                        invoiceNumber: uploadData.invoiceNumber,
                        invoiceRef: uploadData.metadata?.invoiceRef || uploadData.invoiceNumber,
                        fileName: uploadData.fileName || 'Auto-processed (Exception)'
                    },
                    charges: exceptionCharges.map(charge => ({
                        // IDENTICAL FIELD MAPPING TO MANUAL APPROVAL
                        code: charge.systemCode || charge.code || charge.chargeCode || 'MISC',
                        name: charge.systemName || charge.name || charge.chargeName || charge.description || 'Unknown Charge',
                        actualCost: charge.systemQuotedCost || charge.systemActualCost || charge.actualCost || charge.quotedCost || charge.invoiceAmount || 0,
                        actualCharge: charge.systemQuotedCharge || charge.systemActualCharge || charge.actualCharge || charge.quotedCharge || charge.invoiceAmount || 0,
                        currency: charge.systemCurrency || charge.currency || charge.invoiceCurrency || 'CAD',
                        ediNumber: uploadData.invoiceNumber || uploadData.metadata?.invoiceRef
                    }))
                },
                auth: { uid: userId }
            };

            const exceptionResult = await applyInvoiceCharges(exceptionApprovalRequest);

            if (exceptionResult.success) {
                appliedCharges += exceptionCharges.length;
            }
        }

        // Determine final invoice status
        const totalCharges = perfectMatches.length + exceptionCharges.length;
        if (appliedCharges === totalCharges && totalCharges > 0) {
            if (exceptionCharges.length > 0) {
                invoiceStatus = 'processed_with_exception';
            } else {
                invoiceStatus = 'processed';
            }
        } else if (appliedCharges > 0) {
            invoiceStatus = 'partially_processed';
        }

        // Note: applyInvoiceCharges function already handles shipment invoice status update
        // No need for separate status update call since it's handled in applyInvoiceCharges

        logger.info(`Auto-approval completed for shipment ${matchedShipmentId}`, {
            totalCharges,
            appliedCharges,
            invoiceStatus,
            perfectMatches: perfectMatches.length,
            exceptionCharges: exceptionCharges.length
        });

        return {
            success: true,
            appliedCharges,
            totalCharges,
            invoiceStatus,
            perfectMatches: perfectMatches.length,
            exceptionCharges: exceptionCharges.length
        };

    } catch (error) {
        logger.error(`Error in auto-approval for shipment ${matchedShipmentId}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Helper function to extract charges from shipment data
 */
function extractShipmentCharges(shipmentData) {
    const charges = [];
    
    // Check different charge sources in shipment data
    const chargeSources = [
        shipmentData.manualRates,
        shipmentData.actualRates?.charges,
        shipmentData.selectedRate?.charges,
        shipmentData.markupRates?.charges,
        shipmentData.billingDetails?.charges
    ].filter(source => Array.isArray(source));

    for (const source of chargeSources) {
        for (const charge of source) {
            charges.push({
                code: charge.code || charge.chargeCode || 'MISC',
                name: charge.name || charge.description || 'Unknown Charge',
                quotedCost: parseFloat(charge.quotedCost || charge.cost || charge.amount || 0),
                quotedCharge: parseFloat(charge.quotedCharge || charge.charge || charge.amount || 0),
                currency: charge.currency || 'CAD'
            });
        }
    }

    return charges;
}

/**
 * Perform intelligent charge matching between invoice and system charges
 * Uses the same sophisticated logic as the frontend APProcessingResults.jsx
 */
async function performChargeMatching(invoiceCharges, systemCharges, shipmentDate) {
    const matchedCharges = [];
    const unmatchedCharges = [];

    // Group invoice charges by type for intelligent matching
    const invoiceChargeGroups = {
        freight: invoiceCharges.filter(charge => 
            /base|freight|transport|ground|delivery/i.test(charge.name || charge.description || '')
        ),
        fuel: invoiceCharges.filter(charge => 
            /fuel|fsc|surcharge/i.test(charge.name || charge.description || '')
        ),
        accessorial: invoiceCharges.filter(charge => 
            /accessorial|extra|additional|special/i.test(charge.name || charge.description || '')
        ),
        other: invoiceCharges.filter(charge => 
            !/base|freight|transport|ground|delivery|fuel|fsc|surcharge|accessorial|extra|additional|special/i.test(charge.name || charge.description || '')
        )
    };

    // Process each system charge and find best invoice match
    for (const systemCharge of systemCharges) {
        // CRITICAL FIX: When name is "Unknown Charge", use the code for matching
        const systemChargeCode = (systemCharge.code || '').toLowerCase();
        const systemChargeName = systemCharge.name === 'Unknown Charge' 
            ? systemChargeCode 
            : (systemCharge.name || '').toLowerCase();
        
        let bestMatch = null;
        let bestConfidence = 0;
        let matchingLogic = '';

        // Freight charges: Try to match with combined Base + Fuel if amounts align
        if (systemChargeCode === 'frt' || /freight|frt|base|transport/i.test(systemChargeName)) {
            const freightTotal = invoiceChargeGroups.freight.reduce((sum, charge) => 
                sum + parseFloat(charge.amount || 0), 0);
            const fuelTotal = invoiceChargeGroups.fuel.reduce((sum, charge) => 
                sum + parseFloat(charge.amount || 0), 0);
            const combinedInvoiceTotal = freightTotal + fuelTotal;
            
            const systemAmount = parseFloat(systemCharge.quotedCost || systemCharge.quotedCharge || 0);
            
            console.log(`🚚 FRT Combination Check:`, {
                systemCode: systemCharge.code,
                systemName: systemCharge.name,
                freightCharges: invoiceChargeGroups.freight.map(c => ({ name: c.name || c.description, amount: c.amount })),
                fuelCharges: invoiceChargeGroups.fuel.map(c => ({ name: c.name || c.description, amount: c.amount })),
                freightTotal,
                fuelTotal,
                combinedInvoiceTotal,
                systemAmount,
                variance: systemAmount > 0 ? ((Math.abs(systemAmount - combinedInvoiceTotal) / systemAmount) * 100).toFixed(2) + '%' : 'N/A'
            });
            
            if (systemAmount > 0 && combinedInvoiceTotal > 0) {
                const variance = Math.abs(systemAmount - combinedInvoiceTotal);
                const variancePercent = (variance / systemAmount) * 100;
                
                if (variancePercent <= 5.0) { // 5% tolerance
                    bestConfidence = Math.max(95, 100 - variancePercent); // 95-100% confidence
                    matchingLogic = `Combined invoice charges (Base: CAD $${freightTotal.toFixed(2)} + Fuel: CAD $${fuelTotal.toFixed(2)} = CAD $${combinedInvoiceTotal.toFixed(2)}) match system cost CAD $${systemAmount.toFixed(2)} within ${variancePercent.toFixed(1)}% tolerance`;
                    
                    // Create a combined charge representation
                    bestMatch = {
                        name: 'Freight (Combined Base + Fuel)',
                        amount: combinedInvoiceTotal,
                        currency: 'CAD',
                        variancePercent: variancePercent, // Add variance for categorization
                        invoiceCharges: [...invoiceChargeGroups.freight, ...invoiceChargeGroups.fuel]
                    };
                    
                    console.log(`✅ FRT Combined Match Found! Confidence: ${bestConfidence}%`);
                }
            }
        }

        // If no combined match found, try individual charge matching
        if (!bestMatch) {
            for (const invoiceCharge of invoiceCharges) {
                const invoiceAmount = parseFloat(invoiceCharge.amount || 0);
                const systemAmount = parseFloat(systemCharge.quotedCost || systemCharge.quotedCharge || 0);
                
                if (invoiceAmount > 0 && systemAmount > 0) {
                    const variance = Math.abs(systemAmount - invoiceAmount);
                    const variancePercent = (variance / systemAmount) * 100;
                    
                    // FRONTEND KEYWORD MATCHING LOGIC
                    const invoiceName = (invoiceCharge.name || invoiceCharge.description || '').toLowerCase();
                    let keywordScore = 0;
                    
                    // Partial name matching for common charge types (EXACT FRONTEND LOGIC)
                    const chargeKeywords = [
                        { keywords: ['freight', 'frt', 'base'], weight: 30 },
                        { keywords: ['fuel', 'fsc', 'surcharge'], weight: 25 },
                        { keywords: ['tax', 'hst', 'gst', 'pst', 'qst'], weight: 35 },
                        { keywords: ['accessorial', 'acc', 'additional'], weight: 20 },
                        { keywords: ['insurance', 'ins'], weight: 20 },
                        { keywords: ['handling', 'hdl'], weight: 15 }
                    ];

                    chargeKeywords.forEach(({ keywords, weight }) => {
                        // Check both name and code for system charge (for "Unknown Charge" cases)
                        const systemHasKeyword = keywords.some(kw => 
                            systemChargeName.includes(kw) || systemChargeCode.includes(kw)
                        );
                        const invoiceHasKeyword = keywords.some(kw => invoiceName.includes(kw));

                        if (systemHasKeyword && invoiceHasKeyword) {
                            keywordScore += weight;
                        }
                    });
                    
                    // Name similarity check
                    const nameSimilarity = calculateStringSimilarity(
                        invoiceName,
                        systemChargeName
                    );
                    
                    // Calculate confidence based on keyword match + amount + name similarity
                    let confidence = keywordScore; // Start with keyword score (0-35 points)
                    
                    // Add amount matching confidence
                    if (variancePercent <= 1.0) {
                        confidence += 50; // Perfect amount match
                    } else if (variancePercent <= 5.0) {
                        confidence += 40; // Good amount match
                    } else if (variancePercent <= 10.0) {
                        confidence += 30; // Acceptable amount match
                    } else if (variancePercent <= 20.0) {
                        confidence += 20; // Poor amount match
                    }
                    
                    // Add name similarity
                    if (nameSimilarity > 0.8) {
                        confidence += 20; // High name similarity
                    } else if (nameSimilarity > 0.6) {
                        confidence += 15; // Medium name similarity
                    } else if (nameSimilarity > 0.4) {
                        confidence += 10; // Low name similarity
                    }
                    
                    if (confidence > bestConfidence && confidence >= 30) { // LOWERED to match frontend
                        bestConfidence = confidence;
                        bestMatch = invoiceCharge;
                        matchingLogic = `Keyword: ${keywordScore}pts, Amount: Invoice $${invoiceAmount.toFixed(2)} vs System $${systemAmount.toFixed(2)} (${variancePercent.toFixed(1)}% variance), Name similarity: ${(nameSimilarity * 100).toFixed(1)}%`;
                    }
                }
            }
        }

        if (bestMatch && bestConfidence >= 30) { // LOWERED from 80 to 30 to match frontend logic
            matchedCharges.push({
                ...bestMatch,
                systemCode: systemCharge.code || 'MISC',
                systemName: systemCharge.name,
                systemQuotedCost: systemCharge.quotedCost,
                systemQuotedCharge: systemCharge.quotedCharge,
                systemCurrency: systemCharge.currency || 'CAD',
                matchScore: bestConfidence,
                confidence: bestConfidence,
                variancePercent: bestMatch.variancePercent || 0, // Ensure variance is preserved
                matchingLogic: matchingLogic,
                autoApprovalRecommendation: bestConfidence >= 95 ? 'approve' : 'review'
            });
        }
    }

    // Any invoice charges that weren't matched become unmatched
    const matchedInvoiceCharges = new Set();
    matchedCharges.forEach(charge => {
        if (charge.invoiceCharges) {
            // Combined charges
            charge.invoiceCharges.forEach(ic => matchedInvoiceCharges.add(ic));
        } else {
            matchedInvoiceCharges.add(charge);
        }
    });

    unmatchedCharges.push(...invoiceCharges.filter(charge => !matchedInvoiceCharges.has(charge)));

    return { matchedCharges, unmatchedCharges };
}

/**
 * Calculate match score between invoice charge and system charge
 */
function calculateChargeMatchScore(invoiceCharge, systemCharge) {
    let score = 0;
    
    // Name similarity (40% weight)
    const nameSimilarity = calculateStringSimilarity(
        (invoiceCharge.name || '').toLowerCase(),
        (systemCharge.name || '').toLowerCase()
    );
    score += nameSimilarity * 0.4;
    
    // Amount similarity (60% weight)
    const invoiceAmount = parseFloat(invoiceCharge.amount || 0);
    const systemAmount = parseFloat(systemCharge.quotedCharge || systemCharge.quotedCost || 0);
    
    if (invoiceAmount > 0 && systemAmount > 0) {
        const amountDiff = Math.abs(invoiceAmount - systemAmount) / Math.max(invoiceAmount, systemAmount);
        const amountSimilarity = Math.max(0, 1 - amountDiff);
        score += amountSimilarity * 0.6;
    }
    
    return Math.round(score * 100);
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix = Array(len2 + 1).fill().map(() => Array(len1 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
        for (let i = 1; i <= len1; i++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j - 1][i] + 1,
                matrix[j][i - 1] + 1,
                matrix[j - 1][i - 1] + cost
            );
        }
    }
    
    const distance = matrix[len2][len1];
    return 1 - distance / Math.max(len1, len2);
}

/**
 * Categorize charges for auto-approval based on confidence
 */
function categorizeChargesForApproval(matchedCharges, unmatchedCharges) {
    // EXTREME DEBUGGING: Accept ANY matched charge
    console.log(`🚨 CATEGORIZE DEBUG: Input matchedCharges.length = ${matchedCharges.length}`);
    console.log(`🚨 CATEGORIZE DEBUG: matchedCharges =`, JSON.stringify(matchedCharges, null, 2));
    
    const perfectMatches = matchedCharges.filter(charge => {
        // ACCEPT EVERYTHING FOR DEBUGGING - confidence >= 1%
        const qualifies = charge.confidence >= 1 || charge.variancePercent <= 100;
        console.log(`🚨 CATEGORIZE DEBUG: Charge "${charge.name}" confidence=${charge.confidence}% qualifies=${qualifies}`);
        return qualifies;
    });
    
    const exceptionCharges = matchedCharges.filter(charge => 
        charge.confidence >= 30 && 
        charge.confidence < 50
    );
    
    return { perfectMatches, exceptionCharges };
}

/**
 * Apply charges via the existing applyInvoiceCharges cloud function
 */
/**
 * Internal version of applyInvoiceCharges - uses the same logic as the cloud function
 * but can be called directly from other cloud functions
 */
// REMOVED: Custom internal function - now using working applyInvoiceCharges cloud function
/*
async function applyInvoiceChargesInternal({ shipmentId, invoiceData, charges, userId }) {
    try {
        const db = getFirestore();

        if (!shipmentId || !charges || !Array.isArray(charges) || charges.length === 0) {
            throw new Error('Missing required parameters: shipmentId and charges array');
        }

        logger.info('🔄 INTERNAL: Applying charges to shipment', {
            shipmentId,
            chargesCount: charges.length,
            invoiceNumber: invoiceData?.invoiceNumber,
            userId
        });

        // 1. First, find the shipment (dual lookup strategy - IDENTICAL TO MANUAL)
        let shipmentDoc = null;
        let shipmentRef = null;

        try {
            // Try direct document ID lookup first
            shipmentRef = db.collection('shipments').doc(shipmentId);
            shipmentDoc = await shipmentRef.get();
        } catch (error) {
            logger.warn(`Direct lookup failed for ${shipmentId}, trying shipmentID field lookup`);
        }

        // If direct lookup failed or document doesn't exist, try shipmentID field
        if (!shipmentDoc || !shipmentDoc.exists) {
            logger.info(`Trying shipmentID field lookup for: ${shipmentId}`);
            
            const shipmentQuery = await db.collection('shipments')
                .where('shipmentID', '==', shipmentId)
                .limit(1)
                .get();

            if (!shipmentQuery.empty) {
                shipmentDoc = shipmentQuery.docs[0];
                shipmentRef = shipmentDoc.ref;
                logger.info(`Found shipment by shipmentID field: ${shipmentDoc.id}`);
            }
        }

        if (!shipmentDoc || !shipmentDoc.exists) {
            throw new Error(`Shipment not found: ${shipmentId}`);
        }

        const shipmentData = shipmentDoc.data();

        // 2. Prepare charge updates (IDENTICAL LOGIC TO MANUAL)
        const chargeUpdates = charges.map(charge => ({
            id: charge.id || `${shipmentId}_charge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            code: charge.code || 'MISC',
            description: charge.name || 'Unknown Charge',
            quotedCost: 0,
            quotedCharge: 0,
            actualCost: parseFloat(charge.actualCost) || 0,
            actualCharge: parseFloat(charge.actualCharge) || 0,
            quotedCostCurrency: charge.currency || 'CAD',
            quotedChargeCurrency: charge.currency || 'CAD',
            actualCostCurrency: charge.currency || 'CAD',
            actualChargeCurrency: charge.currency || 'CAD',
            invoiceNumber: charge.invoiceNumber || invoiceData?.invoiceNumber || '-',
            ediNumber: charge.ediNumber || '-',
            commissionable: charge.commissionable || false
        }));

        // 3. Update shipment based on type (QuickShip vs Regular)
        const isQuickShip = shipmentData.creationMethod === 'quickship';
        const updates = {
            updatedAt: FieldValue.serverTimestamp(),
            invoiceStatus: 'ready_to_invoice', // CRITICAL FIX - same as manual
            lastAPProcessing: {
                appliedAt: FieldValue.serverTimestamp(),
                invoiceNumber: invoiceData?.invoiceNumber,
                chargesApplied: charges.length,
                processedBy: userId || 'automation'
            }
        };

        if (isQuickShip) {
            // For QuickShip: update manualRates
            const existingRates = shipmentData.manualRates || [];
            const updatedRates = [...existingRates];

            chargeUpdates.forEach(charge => {
                const existingIndex = updatedRates.findIndex(rate => 
                    rate.code === charge.code || rate.chargeName === charge.description
                );

                if (existingIndex !== -1) {
                    // Update existing rate
                    updatedRates[existingIndex] = {
                        ...updatedRates[existingIndex],
                        actualCost: charge.actualCost,
                        actualCharge: charge.actualCharge,
                        actualCostCurrency: charge.actualCostCurrency,
                        actualChargeCurrency: charge.actualChargeCurrency,
                        invoiceNumber: charge.invoiceNumber,
                        ediNumber: charge.ediNumber
                    };
                } else {
                    // Add new rate
                    updatedRates.push({
                        id: charge.id,
                        code: charge.code,
                        chargeName: charge.description,
                        cost: charge.actualCost,
                        charge: charge.actualCharge,
                        actualCost: charge.actualCost,
                        actualCharge: charge.actualCharge,
                        currency: charge.actualCostCurrency,
                        actualCostCurrency: charge.actualCostCurrency,
                        actualChargeCurrency: charge.actualChargeCurrency,
                        invoiceNumber: charge.invoiceNumber,
                        ediNumber: charge.ediNumber,
                        commissionable: charge.commissionable
                    });
                }
            });

            updates.manualRates = updatedRates;
        } else {
            // For regular shipments: update updatedCharges
            updates.updatedCharges = chargeUpdates;
        }

        // 4. Update status history (IDENTICAL TO MANUAL)
        const existingHistory = Array.isArray(shipmentData.statusHistory)
            ? shipmentData.statusHistory
            : [];

        const historyEntry = {
            timestamp: FieldValue.serverTimestamp(),
            action: 'AP Processing - Invoice Charges Applied (Auto)',
            details: `Applied ${charges.length} charge(s) from invoice ${invoiceData?.invoiceNumber || 'Unknown'}`,
            user: userId || 'automation',
            invoiceNumber: invoiceData?.invoiceNumber,
            chargesApplied: charges.length
        };

        // Update existing "Ready To Process" entries to "Processed"
        const updatedHistory = existingHistory.map(entry => {
            if (entry.details &&
                (entry.details.includes && entry.details.includes('Ready To Process')) ||
                (entry.action && entry.action.includes('Ready To Process')) ||
                (entry.status && entry.status === 'Ready To Process')) {
                return {
                    ...entry,
                    status: 'Processed',
                    details: entry.details ? entry.details.replace('Ready To Process', 'Processed') : 'Processed'
                };
            }
            return entry;
        });

        updates.statusHistory = [...updatedHistory, historyEntry];

        // 5. Execute the update
        await shipmentRef.update(updates);

        logger.info('✅ INTERNAL: Successfully applied charges to shipment', {
            shipmentId: shipmentDoc.id,
            chargesApplied: charges.length,
            invoiceStatus: 'ready_to_invoice',
            isQuickShip
        });

        return { 
            success: true, 
            shipmentId: shipmentDoc.id,
            chargesApplied: charges.length
        };

    } catch (error) {
        logger.error('❌ INTERNAL: Error applying charges:', error);
        return { 
            success: false, 
            error: error.message 
        };
    }
}
*/

/**
 * Update shipment invoice status via the existing cloud function
 */
// REMOVED: updateShipmentInvoiceStatusViaCloudFunction - now handled by applyInvoiceCharges

/**
 * ⚡ FIRESTORE TRIGGER: Automatically start intelligent automation when AI extraction completes
 * This replaces the unreliable 2-second setTimeout with a proper event-driven approach
 */
exports.onAPUploadCompleted = onDocumentUpdated('apUploads/{uploadId}', async (event) => {
    try {
        const uploadId = event.params.uploadId;
        const beforeData = event.data.before?.data();
        const afterData = event.data.after?.data();

        if (!beforeData || !afterData) {
            return; // No data to compare
        }

        // Check if this is the transition to extraction completion
        const wasProcessing = beforeData.processingStatus !== 'completed';
        const isNowCompleted = afterData.processingStatus === 'completed';
        const hasExtractedData = !!afterData.extractedData;
        const automationNotStarted = !afterData.automationStatus || afterData.automationStatus === 'pending';

        logger.info('🔍 AP Upload document updated', {
            uploadId,
            wasProcessing,
            isNowCompleted,
            hasExtractedData,
            automationNotStarted,
            beforeStatus: beforeData.processingStatus,
            afterStatus: afterData.processingStatus,
            beforeAutomation: beforeData.automationStatus,
            afterAutomation: afterData.automationStatus
        });

        // Only trigger automation when:
        // 1. Processing status changed to 'completed'
        // 2. Has extracted data
        // 3. Automation hasn't started yet
        if (wasProcessing && isNowCompleted && hasExtractedData && automationNotStarted) {
            logger.info(`🚀 AUTO-TRIGGERING intelligent automation for upload: ${uploadId}`);

            // Extract the core automation logic and call it directly
            try {
                // Call the internal automation logic directly
                const result = await performIntelligentAutoApproval(uploadId, 'system-automation-trigger');
                
                logger.info(`✅ Auto-triggered automation completed for upload: ${uploadId}`, result);
            } catch (error) {
                logger.error(`❌ Auto-triggered automation failed for upload: ${uploadId}`, error);
                
                // Update upload with automation error
                await db.collection('apUploads').doc(uploadId).update({
                    automationStatus: 'failed',
                    automationError: `Auto-trigger failed: ${error.message}`,
                    lastUpdated: FieldValue.serverTimestamp()
                });
            }
        }
    } catch (error) {
        logger.error('Error in onAPUploadCompleted trigger:', error);
    }
});
