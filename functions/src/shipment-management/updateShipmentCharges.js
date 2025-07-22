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
            if (!shipmentDoc.exists) {
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
            updatedAt: new Date(),
            updatedBy: userEmail || 'system'
        };

        // Validate numeric values
        if (validatedCharge.quotedCost < 0 || validatedCharge.quotedCharge < 0 || 
            validatedCharge.actualCost < 0 || validatedCharge.actualCharge < 0) {
            throw new Error(`Charge ${index + 1}: Amounts cannot be negative`);
        }

        return validatedCharge;
    });

    // Prepare update data - FIXED: Different data storage for QuickShip vs Regular shipments
    const updateData = {
        // Update modification tracking
        lastModified: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: userEmail || 'system',
        
        // Add to shipment history
        [`statusHistory.${Date.now()}`]: {
            status: shipmentData.status || 'unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            note: `Charges updated by ${userEmail || 'system'}`,
            updatedBy: userEmail || 'system',
            type: 'charges_update',
            changes: {
                chargesCount: validatedCharges.length,
                totalCost: validatedCharges.reduce((sum, c) => sum + c.cost, 0),
                totalAmount: validatedCharges.reduce((sum, c) => sum + c.amount, 0),
                totalActual: validatedCharges.reduce((sum, c) => sum + c.actualAmount, 0)
            }
        }
    };

    // FIXED: Different storage strategy for QuickShip vs Regular shipments
    const isQuickShipShipment = shipmentData.creationMethod === 'quickship' || shipmentData.isQuickShip;
    
    if (isQuickShipShipment) {
        // For QuickShip: ONLY update manualRates (single source of truth)
        updateData.manualRates = validatedCharges.map((charge, index) => ({
            id: index + 1, // Add ID for consistency with QuickShip format
            carrier: shipmentData.selectedCarrier || shipmentData.carrier || '',
            code: charge.code,
            chargeName: charge.description,
            cost: charge.quotedCost.toString(), // Convert to string for QuickShip compatibility
            costCurrency: shipmentData.currency || 'CAD',
            charge: charge.quotedCharge.toString(), // Convert to string for QuickShip compatibility  
            chargeCurrency: shipmentData.currency || 'CAD',
            // Include actual cost/charge for inline editing compatibility
            actualCost: charge.actualCost || 0,
            actualCharge: charge.actualCharge || 0,
            invoiceNumber: charge.invoiceNumber || '-',
            ediNumber: charge.ediNumber || '-',
            commissionable: charge.commissionable || false
        }));
        
        // Clear conflicting fields for QuickShip to prevent data inconsistency
        updateData.chargesBreakdown = admin.firestore.FieldValue.delete();
        updateData.updatedCharges = admin.firestore.FieldValue.delete();
        
        logger.info('Updated manualRates for QuickShip (cleared other charge fields):', { 
            manualRatesCount: updateData.manualRates.length,
            rates: updateData.manualRates 
        });
    } else {
        // For regular shipments: Use chargesBreakdown and updatedCharges
        updateData.chargesBreakdown = validatedCharges;
        updateData.updatedCharges = validatedCharges;
        
        logger.info('Updated chargesBreakdown and updatedCharges for regular shipment');
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
        updatedBy: userEmail || 'system'
    });
}

module.exports = updateShipmentCharges; 