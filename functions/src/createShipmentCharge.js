const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

const db = admin.firestore();

/**
 * Create a charge record from matched invoice data
 */
const createShipmentCharge = onCall({
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { shipmentId, invoiceData, matchConfidence, autoCreated } = request.data;
        const userId = request.auth?.uid;
        const userEmail = request.auth?.email;

        if (!userId) {
            throw new Error('Authentication required');
        }

        if (!shipmentId || !invoiceData) {
            throw new Error('Shipment ID and invoice data required');
        }

        logger.info('💰 Creating charge', {
            shipmentId,
            invoiceAmount: invoiceData.totalAmount,
            confidence: matchConfidence,
            autoCreated
        });

        // Get shipment data
        const shipmentDoc = await db.collection('shipments').doc(shipmentId).get();
        if (!shipmentDoc.exists) {
            throw new Error(`Shipment ${shipmentId} not found`);
        }

        const shipmentData = { id: shipmentDoc.id, ...shipmentDoc.data() };

        // Prepare charge data
        const chargeData = {
            shipmentID: shipmentData.shipmentID || shipmentId,
            shipmentDocId: shipmentId,
            
            // Invoice data
            invoiceNumber: invoiceData.invoiceNumber || invoiceData.references?.invoiceRef,
            invoiceDate: invoiceData.invoiceDate || invoiceData.shipmentDate || new Date(),
            invoiceAmount: parseFloat(invoiceData.totalAmount) || 0,
            currency: invoiceData.currency || 'CAD',
            
            // Carrier data
            carrier: invoiceData.carrier || shipmentData.selectedCarrier || shipmentData.carrier,
            carrierInvoiceRef: invoiceData.carrierReference || invoiceData.references?.carrierRef,
            
            // Line items
            chargeItems: extractChargeItems(invoiceData),
            
            // Metadata
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: userEmail,
            createdByUserId: userId,
            
            // AP Processing metadata
            apProcessing: {
                autoCreated,
                matchConfidence,
                invoiceFileName: invoiceData.fileName,
                extractedAt: invoiceData.extractedAt || new Date(),
                processingId: invoiceData.processingId
            },
            
            // Status
            status: autoCreated && matchConfidence >= 0.95 ? 'approved' : 'pending_review',
            invoiceStatus: 'uninvoiced',
            
            // Company and customer data
            companyID: shipmentData.companyID || shipmentData.companyId,
            customerId: shipmentData.customerId || shipmentData.customerID,
            
            // Shipment reference data
            shipmentDate: shipmentData.bookedAt || shipmentData.createdAt,
            origin: formatLocation(shipmentData.shipFrom),
            destination: formatLocation(shipmentData.shipTo),
            
            // Audit trail
            auditTrail: [{
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                action: 'created',
                userId: userId,
                userEmail: userEmail,
                details: autoCreated ? 
                    `Auto-created from invoice with ${(matchConfidence * 100).toFixed(1)}% confidence` :
                    'Manually created from invoice'
            }]
        };

        // Create charge document
        const chargeRef = await db.collection('shipmentCharges').add(chargeData);
        
        // Update shipment with charge reference
        await updateShipmentWithCharge(shipmentId, chargeRef.id, invoiceData.totalAmount);

        // Log creation
        await logChargeCreation(chargeRef.id, chargeData, userId);

        // Send notification if auto-created with high confidence
        if (autoCreated && matchConfidence >= 0.95) {
            await sendAutoCreationNotification(shipmentData, chargeData, chargeRef.id);
        }

        return {
            success: true,
            chargeId: chargeRef.id,
            status: chargeData.status,
            message: autoCreated ? 
                `Charge auto-created with ${(matchConfidence * 100).toFixed(1)}% confidence` :
                'Charge created successfully'
        };

    } catch (error) {
        logger.error('❌ Charge creation error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Extract charge line items from invoice data
 */
function extractChargeItems(invoiceData) {
    const items = [];
    
    // If detailed charges exist
    if (invoiceData.charges && Array.isArray(invoiceData.charges)) {
        invoiceData.charges.forEach(charge => {
            items.push({
                description: charge.description || charge.chargeType || 'Freight Charge',
                code: charge.code || charge.chargeCode,
                amount: parseFloat(charge.amount) || 0,
                quantity: charge.quantity || 1,
                unitPrice: charge.unitPrice || charge.amount,
                type: determineChargeType(charge)
            });
        });
    } else {
        // Create single line item from total
        items.push({
            description: 'Total Freight Charges',
            code: 'FREIGHT',
            amount: parseFloat(invoiceData.totalAmount) || 0,
            quantity: 1,
            unitPrice: parseFloat(invoiceData.totalAmount) || 0,
            type: 'freight'
        });
    }
    
    return items;
}

/**
 * Determine charge type from description
 */
function determineChargeType(charge) {
    const description = (charge.description || '').toLowerCase();
    
    if (description.includes('fuel')) return 'fuel';
    if (description.includes('accessorial')) return 'accessorial';
    if (description.includes('tax')) return 'tax';
    if (description.includes('discount')) return 'discount';
    if (description.includes('detention')) return 'detention';
    if (description.includes('storage')) return 'storage';
    
    return 'freight';
}

/**
 * Format location for display
 */
function formatLocation(location) {
    if (!location) return 'N/A';
    
    const parts = [];
    if (location.city) parts.push(location.city);
    if (location.province || location.state) {
        parts.push(location.province || location.state);
    }
    if (location.country) parts.push(location.country);
    
    return parts.join(', ') || 'N/A';
}

/**
 * Update shipment with charge reference
 */
async function updateShipmentWithCharge(shipmentId, chargeId, amount) {
    try {
        const updateData = {
            lastChargeCreated: admin.firestore.FieldValue.serverTimestamp(),
            lastChargeId: chargeId,
            hasCharges: true
        };
        
        // Update invoice status if not set
        const shipmentDoc = await db.collection('shipments').doc(shipmentId).get();
        if (shipmentDoc.exists) {
            const currentData = shipmentDoc.data();
            if (!currentData.invoiceStatus || currentData.invoiceStatus === 'uninvoiced') {
                updateData.invoiceStatus = 'pending';
            }
            
            // Update total charged amount
            const currentCharged = currentData.totalCharged || 0;
            updateData.totalCharged = currentCharged + amount;
        }
        
        await db.collection('shipments').doc(shipmentId).update(updateData);
    } catch (error) {
        logger.warn('Failed to update shipment with charge:', error);
    }
}

/**
 * Log charge creation for audit
 */
async function logChargeCreation(chargeId, chargeData, userId) {
    try {
        await db.collection('chargeCreationLog').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            chargeId,
            shipmentID: chargeData.shipmentID,
            invoiceNumber: chargeData.invoiceNumber,
            amount: chargeData.invoiceAmount,
            autoCreated: chargeData.apProcessing.autoCreated,
            confidence: chargeData.apProcessing.matchConfidence,
            userId,
            status: chargeData.status
        });
    } catch (error) {
        logger.warn('Failed to log charge creation:', error);
    }
}

/**
 * Send notification for auto-created charges
 */
async function sendAutoCreationNotification(shipment, charge, chargeId) {
    try {
        // Get company notification settings
        const companyDoc = await db.collection('companies').doc(shipment.companyID).get();
        if (!companyDoc.exists) return;
        
        const companyData = companyDoc.data();
        const notifyEmails = companyData.apNotificationEmails || [];
        
        if (notifyEmails.length === 0) return;
        
        // Create notification
        await db.collection('notifications').add({
            type: 'charge_auto_created',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            recipients: notifyEmails,
            data: {
                chargeId,
                shipmentID: shipment.shipmentID,
                invoiceNumber: charge.invoiceNumber,
                amount: charge.invoiceAmount,
                currency: charge.currency,
                confidence: charge.apProcessing.matchConfidence,
                carrier: charge.carrier
            },
            subject: `Charge Auto-Created: ${shipment.shipmentID}`,
            message: `A charge of ${charge.currency} ${charge.invoiceAmount.toFixed(2)} was automatically created for shipment ${shipment.shipmentID} from invoice ${charge.invoiceNumber} with ${(charge.apProcessing.matchConfidence * 100).toFixed(1)}% confidence.`
        });
        
    } catch (error) {
        logger.warn('Failed to send auto-creation notification:', error);
    }
}

module.exports = { createShipmentCharge }; 