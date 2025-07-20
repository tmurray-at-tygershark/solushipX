const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Update shipment charges with audit trail
 */
const updateShipmentCharges = onCall({
    cors: true,
    minInstances: 1,
    memory: '512MiB',
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { shipmentId, charges } = request.data;
        const { uid: userId, email: userEmail } = request.auth;

        logger.info('updateShipmentCharges called:', { 
            shipmentId, 
            userId,
            userEmail,
            chargesCount: charges?.length || 0
        });

        // Validation
        if (!shipmentId) {
            throw new Error('Shipment ID is required');
        }

        if (!charges || !Array.isArray(charges)) {
            throw new Error('Charges array is required');
        }

        if (!userId) {
            throw new Error('Authentication required');
        }

        // Find shipment document
        const shipmentsQuery = db.collection('shipments').where('id', '==', shipmentId);
        const shipmentsSnapshot = await shipmentsQuery.get();

        if (shipmentsSnapshot.empty) {
            // Fallback: try to get by document ID
            const shipmentDoc = await db.collection('shipments').doc(shipmentId).get();
            if (!shipmentDoc.exists()) {
                throw new Error(`Shipment ${shipmentId} not found`);
            }
            
            await updateChargesForDocument(shipmentDoc, charges, userId, userEmail);
        } else {
            // Update using the found document
            const shipmentDoc = shipmentsSnapshot.docs[0];
            await updateChargesForDocument(shipmentDoc, charges, userId, userEmail);
        }

        return {
            success: true,
            message: 'Charges updated successfully',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

    } catch (error) {
        logger.error('Error updating shipment charges:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Helper function to update charges for a specific document
 */
async function updateChargesForDocument(shipmentDoc, charges, userId, userEmail) {
    const shipmentData = shipmentDoc.data();
    const shipmentRef = shipmentDoc.ref;

    logger.info('Updating charges for document:', { 
        docId: shipmentDoc.id,
        shipmentID: shipmentData.shipmentID || shipmentData.id
    });

    // Validate charges data
    const validatedCharges = charges.map((charge, index) => {
        if (!charge.description || charge.description.trim() === '') {
            throw new Error(`Charge ${index + 1}: Description is required`);
        }

        const validatedCharge = {
            code: charge.code || 'FRT',
            description: charge.description.trim(),
            quotedCost: parseFloat(charge.quotedCost) || 0,
            quotedCharge: parseFloat(charge.quotedCharge) || 0,
            actualCost: parseFloat(charge.actualCost) || 0,
            actualCharge: parseFloat(charge.actualCharge) || 0,
            invoiceNumber: charge.invoiceNumber || '-',
            ediNumber: charge.ediNumber || '-',
            commissionable: charge.commissionable || false,
            // Legacy fields for backward compatibility
            cost: parseFloat(charge.quotedCost || charge.cost) || 0,
            amount: parseFloat(charge.quotedCharge || charge.amount) || 0,
            actualAmount: parseFloat(charge.actualCharge || charge.actualAmount) || 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: userEmail
        };

        // Validate numeric values
        if (validatedCharge.quotedCost < 0 || validatedCharge.quotedCharge < 0 || 
            validatedCharge.actualCost < 0 || validatedCharge.actualCharge < 0) {
            throw new Error(`Charge ${index + 1}: Amounts cannot be negative`);
        }

        return validatedCharge;
    });

    // Prepare update data
    const updateData = {
        // Store charges in multiple formats for backward compatibility
        chargesBreakdown: validatedCharges,
        updatedCharges: validatedCharges,
        
        // Update modification tracking
        lastModified: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: userEmail,
        
        // Add to shipment history
        [`statusHistory.${Date.now()}`]: {
            status: shipmentData.status || 'unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            note: `Charges updated by ${userEmail}`,
            updatedBy: userEmail,
            type: 'charges_update',
            changes: {
                chargesCount: validatedCharges.length,
                totalCost: validatedCharges.reduce((sum, c) => sum + c.cost, 0),
                totalAmount: validatedCharges.reduce((sum, c) => sum + c.amount, 0),
                totalActual: validatedCharges.reduce((sum, c) => sum + c.actualAmount, 0)
            }
        }
    };

    // For QuickShip shipments, also update manualRates
    if (shipmentData.creationMethod === 'quickship') {
        updateData.manualRates = validatedCharges.map(charge => ({
            code: charge.code,
            chargeName: charge.description,
            cost: charge.cost,
            charge: charge.amount,
            actualCharge: charge.actualAmount,
            chargeCurrency: shipmentData.currency || 'CAD'
        }));
    }

    // For regular shipments, update billingDetails if it exists
    if (shipmentData.selectedRate?.billingDetails) {
        updateData['selectedRate.billingDetails'] = validatedCharges.map(charge => ({
            name: charge.description,
            code: charge.code,
            amount: charge.amount,
            actualAmount: charge.actualAmount,
            cost: charge.cost
        }));
    }

    // Perform the update
    await shipmentRef.update(updateData);

    logger.info('Charges updated successfully:', {
        docId: shipmentDoc.id,
        chargesCount: validatedCharges.length,
        updatedBy: userEmail
    });
}

module.exports = updateShipmentCharges; 