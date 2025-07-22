const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

const db = admin.firestore();

/**
 * Update shipment actualRates with carrier invoice data from AP processing
 * This connects the AP processing results to the actual shipment cost tracking
 */
const updateActualCosts = onCall({
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 120
}, async (request) => {
    try {
        const { shipmentId, actualCosts, invoiceData, processingId, autoUpdate = false } = request.data;
        const userId = request.auth?.uid;
        const userEmail = request.auth?.email;

        if (!userId) {
            throw new Error('Authentication required');
        }

        if (!shipmentId || !actualCosts) {
            throw new Error('Shipment ID and actual costs are required');
        }

        logger.info('💰 Updating actual costs for shipment', {
            shipmentId,
            totalActualCost: actualCosts.totalCharges,
            userId,
            autoUpdate,
            processingId
        });

        // Find shipment document (handle both document ID and shipmentID field)
        let shipmentDoc;
        try {
            // Try direct document lookup first
            shipmentDoc = await db.collection('shipments').doc(shipmentId).get();
            if (!shipmentDoc.exists) {
                // Fallback to shipmentID field query
                const query = await db.collection('shipments')
                    .where('shipmentID', '==', shipmentId)
                    .limit(1)
                    .get();
                
                if (!query.empty) {
                    shipmentDoc = query.docs[0];
                } else {
                    throw new Error(`Shipment ${shipmentId} not found`);
                }
            }
        } catch (error) {
            throw new Error(`Failed to find shipment ${shipmentId}: ${error.message}`);
        }

        const shipmentData = shipmentDoc.data();
        const documentId = shipmentDoc.id;

        // Validate shipment status
        if (shipmentData.status === 'cancelled' || shipmentData.status === 'canceled') {
            logger.warn('Cannot update costs for cancelled shipment', { shipmentId });
            return {
                success: false,
                error: 'Cannot update actual costs for cancelled shipments',
                exceptionType: 'CANCELLED_SHIPMENT'
            };
        }

        // Prepare actual rates update
        const actualRatesUpdate = {
            totalCharges: parseFloat(actualCosts.totalCharges) || 0,
            currency: actualCosts.currency || shipmentData.currency || 'CAD',
            charges: (actualCosts.charges || []).map(charge => ({
                name: charge.name || charge.description || 'Unknown Charge',
                amount: parseFloat(charge.amount) || 0,
                currency: charge.currency || actualCosts.currency || 'CAD',
                code: charge.code || generateChargeCode(charge.name)
            })),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedFrom: 'ap_processing',
            processingId: processingId || null,
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

        // Prepare shipment update
        const updateData = {
            actualRates: actualRatesUpdate,
            costComparison: costComparison,
            hasActualCosts: true,
            actualCostsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            actualCostsUpdatedBy: userEmail,
            lastModified: admin.firestore.FieldValue.serverTimestamp(),
            lastModifiedBy: userEmail
        };

        // Add to status history
        updateData[`statusHistory.${Date.now()}`] = {
            status: shipmentData.status || 'unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            note: autoUpdate ? 
                `Actual costs auto-updated from carrier invoice (${processingId})` :
                `Actual costs manually updated from carrier invoice`,
            updatedBy: userEmail,
            type: 'actual_costs_update',
            changes: {
                quotedTotal: quotedTotal,
                actualTotal: actualTotal,
                variance: variance,
                variancePercent: variancePercent.toFixed(2) + '%'
            }
        };

        // Update the shipment document
        await db.collection('shipments').doc(documentId).update(updateData);

        logger.info('✅ Successfully updated actual costs', {
            documentId,
            shipmentId,
            quotedTotal,
            actualTotal,
            variance,
            variancePercent: variancePercent.toFixed(2) + '%'
        });

        // Trigger exception detection
        try {
            const detectExceptions = require('./detectExceptions').detectExceptions;
            const exceptionResult = await detectExceptions.call(null, {
                data: { shipmentId: documentId, triggerFrom: 'actual_costs_update' },
                auth: { uid: userId, email: userEmail }
            });
            
            if (exceptionResult && exceptionResult.data) {
                logger.info('Exception detection completed', {
                    shipmentId: documentId,
                    hasExceptions: exceptionResult.data.hasExceptions,
                    exceptionCount: exceptionResult.data.exceptionCount
                });
            }
        } catch (exceptionError) {
            logger.warn('Exception detection failed but continuing', {
                shipmentId: documentId,
                error: exceptionError.message
            });
        }

        return {
            success: true,
            documentId: documentId,
            shipmentId: shipmentId,
            costComparison: costComparison,
            actualRates: actualRatesUpdate,
            message: autoUpdate ? 
                'Actual costs auto-updated from carrier invoice' :
                'Actual costs updated successfully'
        };

    } catch (error) {
        logger.error('❌ Error updating actual costs:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Helper function to get quoted total from shipment data
 */
function getQuotedTotal(shipmentData) {
    // Handle different shipment types
    if (shipmentData.creationMethod === 'quickship' && shipmentData.manualRates) {
        return shipmentData.manualRates.reduce((sum, rate) => 
            sum + (parseFloat(rate.charge) || 0), 0);
    } else if (shipmentData.markupRates?.totalCharges) {
        return parseFloat(shipmentData.markupRates.totalCharges) || 0;
    } else if (shipmentData.selectedRate?.totalCharges) {
        return parseFloat(shipmentData.selectedRate.totalCharges) || 0;
    } else if (shipmentData.totalCharges) {
        return parseFloat(shipmentData.totalCharges) || 0;
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

module.exports = { updateActualCosts }; 