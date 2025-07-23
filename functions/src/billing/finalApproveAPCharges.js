const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

const db = admin.firestore();

/**
 * Final Approve AP-Processed Charges
 * Completes the approval process for charges that have been processed through AP
 * Sets EDI numbers, applies charges to shipments, and marks as fully approved
 */
const finalApproveAPCharges = onCall({
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 120
}, async (request) => {
    try {
        const { 
            shipmentIds, 
            ediNumbers = [],
            overrideExceptions = false,
            approvalNotes = '',
            finalApproval = true
        } = request.data;
        
        const userId = request.auth?.uid;
        const userEmail = request.auth?.email;

        if (!userId) {
            throw new Error('Authentication required');
        }

        if (!shipmentIds || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
            throw new Error('Shipment IDs array is required');
        }

        logger.info('🎯 Processing final approval for AP charges', {
            shipmentCount: shipmentIds.length,
            hasEdiNumbers: ediNumbers.length > 0,
            overrideExceptions,
            userId
        });

        const results = [];
        const errors = [];

        // Process each shipment for final approval
        for (let i = 0; i < shipmentIds.length; i++) {
            const shipmentId = shipmentIds[i];
            const ediNumber = ediNumbers[i] || `EDI-${Date.now()}-${String(i + 1).padStart(3, '0')}`;
            
            try {
                const result = await processFinalAPApproval(
                    shipmentId, 
                    userId, 
                    userEmail, 
                    ediNumber,
                    overrideExceptions,
                    approvalNotes
                );
                results.push(result);
            } catch (error) {
                logger.error(`❌ Failed final approval for shipment ${shipmentId}:`, error);
                errors.push({
                    shipmentId,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = errors.length;

        return {
            success: failureCount === 0,
            processedCount: shipmentIds.length,
            successCount: successCount,
            failureCount: failureCount,
            results: results,
            errors: errors,
            message: `Final approval completed for ${successCount}/${shipmentIds.length} charges`
        };

    } catch (error) {
        logger.error('❌ Final AP approval error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Process final approval for a single AP-processed charge
 */
async function processFinalAPApproval(shipmentId, userId, userEmail, ediNumber, overrideExceptions, approvalNotes) {
    // 🔧 CRITICAL FIX: ALWAYS query by shipmentID field, NEVER use document ID
    logger.info(`🔍 Querying shipment by shipmentID field: ${shipmentId}`);
    const shipmentQuery = await db.collection('shipments')
        .where('shipmentID', '==', shipmentId)
        .limit(1)
        .get();
        
    if (shipmentQuery.empty) {
        throw new Error(`Shipment ${shipmentId} not found in database`);
    }
    
    const shipmentDoc = shipmentQuery.docs[0];
    const documentId = shipmentDoc.id;
    logger.info(`✅ Found shipment by shipmentID field. Document ID: ${documentId}`);

    const shipmentData = shipmentDoc.data();

    // Validate that this is an AP-processed charge
    if (shipmentData.chargeStatus?.status !== 'ap_processed') {
        throw new Error(`Shipment ${shipmentId} is not in ap_processed status. Current status: ${shipmentData.chargeStatus?.status}`);
    }

    // 🔧 NEW: Check for extracted cost data from AP processing
    if (!shipmentData.apExtractedCosts) {
        throw new Error(`Shipment ${shipmentId} missing extracted cost data from AP processing`);
    }

    // Check for exceptions if not overriding
    if (!overrideExceptions && shipmentData.exceptionStatus?.hasExceptions) {
        const highSeverityExceptions = shipmentData.exceptionStatus.exceptions?.filter(
            ex => ex.severity === 'HIGH'
        ) || [];
        
        if (highSeverityExceptions.length > 0) {
            throw new Error(`Cannot approve due to ${highSeverityExceptions.length} high-severity exception(s). Override required.`);
        }
    }

    // 🔧 NEW: Update actual costs using extracted data from AP processing
    const extractedCosts = shipmentData.apExtractedCosts;
    const invoiceData = shipmentData.apInvoiceData;

    // Prepare actual rates update using extracted data
    const actualRatesUpdate = {
        totalCharges: parseFloat(extractedCosts.totalCharges) || 0,
        currency: extractedCosts.currency || 'CAD',
        charges: (extractedCosts.charges || []).map(charge => ({
            name: charge.name || charge.description || 'Unknown Charge',
            amount: parseFloat(charge.amount) || 0,
            currency: charge.currency || extractedCosts.currency || 'CAD',
            code: charge.code || generateChargeCode(charge.name)
        })),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedFrom: 'ap_final_approval',
        processingId: shipmentData.chargeStatus?.apProcessingId || null,
        invoiceNumber: invoiceData?.invoiceNumber || null,
        carrierInvoiceRef: invoiceData?.carrierReference || null
    };

    // Calculate cost comparison
    const quotedTotal = getQuotedTotal(shipmentData);
    const actualTotal = actualRatesUpdate.totalCharges;
    const variance = actualTotal - quotedTotal;
    const variancePercent = quotedTotal > 0 ? (variance / quotedTotal) * 100 : 0;

    const costComparison = {
        quotedTotal: quotedTotal,
        actualTotal: actualTotal,
        variance: variance,
        variancePercent: variancePercent,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Prepare final approval update
    const finalApprovalData = {
        chargeStatus: {
            ...shipmentData.chargeStatus,
            status: 'approved', // 🎯 FINAL APPROVAL: Mark as fully approved
            finalApprovedBy: userEmail || 'system', // 🔧 FIXED: Handle undefined userEmail
            finalApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
            finalApprovedByUserId: userId || null, // 🔧 FIXED: Handle undefined userId
            finalApprovalNotes: approvalNotes,
            ediNumber: ediNumber, // 🎯 ASSIGN EDI NUMBER
            requiresFinalApproval: false // 🎯 NO LONGER NEEDS APPROVAL
        },
        
        // 🔧 NEW: Add actual costs and cost comparison
        actualRates: actualRatesUpdate,
        costComparison: costComparison,
        hasActualCosts: true,
        actualCostsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        actualCostsUpdatedBy: userEmail || 'system', // 🔧 FIXED: Handle undefined userEmail
        
        // Update invoice status to be ready for billing
        invoiceStatus: 'ready_for_billing',
        
        // Add EDI tracking
        ediProcessing: {
            ediNumber: ediNumber,
            assignedAt: admin.firestore.FieldValue.serverTimestamp(),
            assignedBy: userEmail || 'system', // 🔧 FIXED: Handle undefined userEmail
            status: 'assigned'
        },
        
        // Track final approval in status history
        [`statusHistory.${Date.now()}`]: {
            status: shipmentData.status || 'unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            note: overrideExceptions ? 
                `Final charge approval with exception override - EDI: ${ediNumber} - ${approvalNotes}` :
                `Final charge approval completed - EDI: ${ediNumber} - ${approvalNotes}`,
            updatedBy: userEmail || 'system', // 🔧 FIXED: Handle undefined userEmail
            type: 'final_charges_approved',
            changes: {
                previousChargeStatus: 'ap_processed',
                newChargeStatus: 'approved',
                ediNumber: ediNumber,
                overrideExceptions: overrideExceptions,
                invoiceStatus: 'ready_for_billing'
            }
        }
    };

    // If overriding exceptions, mark them as resolved
    if (overrideExceptions && shipmentData.exceptionStatus?.hasExceptions) {
        finalApprovalData.exceptionStatus = {
            ...shipmentData.exceptionStatus,
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            resolvedBy: userEmail || 'system', // 🔧 FIXED: Handle undefined userEmail
            resolutionMethod: 'final_approval_override',
            resolutionNotes: `Final approval override: ${approvalNotes}`
        };
    }

    // Update shipment document
    await db.collection('shipments').doc(documentId).update(finalApprovalData);

    // Log final approval event
    await logFinalApprovalEvent(documentId, shipmentData.shipmentID, userEmail, ediNumber, overrideExceptions);

    return {
        success: true,
        shipmentId: documentId, // 🔧 FIXED: Return document ID, not business shipmentID
        documentId: documentId,
        shipmentID: shipmentId, // 🔧 FIXED: This is the business identifier passed in
        ediNumber: ediNumber,
        newStatus: 'approved',
        message: 'Final approval completed successfully'
    };
}

/**
 * Log final approval event for audit trail
 */
async function logFinalApprovalEvent(documentId, shipmentID, userEmail, ediNumber, overrideExceptions) {
    try {
        await db.collection('finalApprovalLog').add({
            shipmentDocumentId: documentId,
            shipmentID: shipmentID,
            finalApprovedBy: userEmail || 'system', // 🔧 FIXED: Handle undefined userEmail
            finalApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
            ediNumber: ediNumber,
            overrideExceptions: overrideExceptions,
            action: 'final_charge_approval'
        });
    } catch (error) {
        logger.warn('Failed to log final approval event:', error);
    }
}

module.exports = { finalApproveAPCharges };

/**
 * Helper function to get quoted total from shipment data
 */
function getQuotedTotal(shipmentData) {
    // Try multiple possible locations for quoted totals
    if (shipmentData.selectedRate?.totalCharges) {
        return parseFloat(shipmentData.selectedRate.totalCharges) || 0;
    }
    if (shipmentData.markupRates?.totalCharges) {
        return parseFloat(shipmentData.markupRates.totalCharges) || 0;
    }
    if (shipmentData.quotedRates?.totalCharges) {
        return parseFloat(shipmentData.quotedRates.totalCharges) || 0;
    }
    if (shipmentData.manualRates?.length > 0) {
        return shipmentData.manualRates.reduce((total, rate) => {
            return total + (parseFloat(rate.amount) || 0);
        }, 0);
    }
    return 0;
}

/**
 * Helper function to generate charge codes
 */
function generateChargeCode(chargeName) {
    if (!chargeName) return 'UNK';
    
    const name = chargeName.toLowerCase();
    if (name.includes('freight')) return 'FRT';
    if (name.includes('fuel')) return 'FUE';
    if (name.includes('residential')) return 'RES';
    if (name.includes('delivery')) return 'DEL';
    if (name.includes('pickup')) return 'PUP';
    if (name.includes('accessorial')) return 'ACC';
    if (name.includes('service')) return 'SVC';
    if (name.includes('handling')) return 'HDL';
    if (name.includes('insurance')) return 'INS';
    if (name.includes('tax')) return 'TAX';
    
    // Generate 3-letter code from first letters of words
    const words = chargeName.split(' ').filter(word => word.length > 0);
    if (words.length >= 3) {
        return words.slice(0, 3).map(word => word[0].toUpperCase()).join('');
    } else if (words.length === 2) {
        return (words[0].substring(0, 2) + words[1][0]).toUpperCase();
    } else {
        return chargeName.substring(0, 3).toUpperCase();
    }
} 