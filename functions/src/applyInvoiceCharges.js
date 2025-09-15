const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

/**
 * Cloud function to apply invoice charges to a shipment
 * This function updates the shipment with actual costs and charges from the invoice
 */
exports.applyInvoiceCharges = onCall({ 
    cors: true, 
    timeoutSeconds: 60 
}, async (request) => {
    try {
        const { shipmentId, invoiceData, charges } = request.data;

        if (!shipmentId || !charges || !Array.isArray(charges) || charges.length === 0) {
            throw new HttpsError('invalid-argument', 'Missing required parameters: shipmentId and charges array');
        }

        const db = getFirestore();

        // 1. First, find the shipment (dual lookup strategy)
        let shipmentDoc = null;
        let shipmentRef = null;

        try {
            // Try direct document ID lookup first
            shipmentRef = db.collection('shipments').doc(shipmentId);
            shipmentDoc = await shipmentRef.get();
        } catch (error) {
            console.log('Direct lookup failed, trying query by shipmentID field');
        }

        if (!shipmentDoc || !shipmentDoc.exists) {
            // Fallback: Query by shipmentID field
            const shipmentsQuery = await db.collection('shipments')
                .where('shipmentID', '==', shipmentId)
                .limit(1)
                .get();

            if (shipmentsQuery.empty) {
                throw new HttpsError('not-found', `Shipment not found: ${shipmentId}`);
            }

            shipmentDoc = shipmentsQuery.docs[0];
            shipmentRef = shipmentDoc.ref;
        }

        const shipmentData = shipmentDoc.data();
        console.log('📦 Found shipment:', { 
            id: shipmentDoc.id, 
            shipmentID: shipmentData.shipmentID,
            carrier: shipmentData.selectedCarrier
        });

        // 2. Prepare the charge updates
        const updates = {
            updatedAt: FieldValue.serverTimestamp(),
            lastAPProcessing: {
                appliedAt: FieldValue.serverTimestamp(),
                invoiceNumber: invoiceData.invoiceNumber,
                invoiceRef: invoiceData.invoiceRef,
                fileName: invoiceData.fileName,
                chargesApplied: charges.length
            }
        };

        // 3. Update charges in the rate structure
        let rateBreakdown = shipmentData.manualRates || [];
        
        // Update existing charges or add new ones
        charges.forEach(invoiceCharge => {
            const existingChargeIndex = rateBreakdown.findIndex(rate => 
                rate.code === invoiceCharge.code || rate.chargeName?.includes(invoiceCharge.name)
            );

            const chargeUpdate = {
                actualCost: parseFloat(invoiceCharge.actualCost) || 0,
                actualCharge: parseFloat(invoiceCharge.actualCharge) || 0,
                actualCostCurrency: invoiceCharge.currency || 'CAD',
                actualChargeCurrency: invoiceCharge.currency || 'CAD',
                ediNumber: invoiceCharge.ediNumber,
                invoiceApplied: true,
                appliedAt: new Date()
            };

            if (existingChargeIndex !== -1) {
                // Update existing charge
                rateBreakdown[existingChargeIndex] = {
                    ...rateBreakdown[existingChargeIndex],
                    ...chargeUpdate
                };
            } else {
                // Add new charge
                rateBreakdown.push({
                    id: `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    code: invoiceCharge.code,
                    chargeName: invoiceCharge.name,
                    cost: parseFloat(invoiceCharge.actualCost) || 0,
                    charge: parseFloat(invoiceCharge.actualCharge) || 0,
                    currency: invoiceCharge.currency || 'CAD',
                    ...chargeUpdate
                });
            }
        });

        updates.manualRates = rateBreakdown;

        // 4. Recalculate taxes (basic implementation - you may need to enhance this)
        const shipmentType = shipmentData.shipmentInfo?.shipmentType || shipmentData.shipmentType;
        const shipFrom = shipmentData.shipmentInfo?.shipFrom || shipmentData.shipFrom;
        const shipTo = shipmentData.shipmentInfo?.shipTo || shipmentData.shipTo;
        
        if (shipFrom?.country === 'CA' && shipTo?.country === 'CA') {
            // Canadian domestic shipment - add HST
            const province = shipTo?.province || shipTo?.state || 'ON';
            const taxRate = getTaxRate(province);
            const subtotal = rateBreakdown.reduce((sum, rate) => 
                sum + (parseFloat(rate.actualCharge || rate.charge) || 0), 0
            );
            
            const taxAmount = subtotal * taxRate;
            const taxCode = province === 'QC' ? 'QST' : 'HST';
            
            // Add or update tax charge
            const taxChargeIndex = rateBreakdown.findIndex(rate => 
                rate.code === taxCode || rate.code === 'HST' || rate.code === 'GST'
            );
            
            if (taxChargeIndex !== -1) {
                rateBreakdown[taxChargeIndex].actualCharge = taxAmount;
                rateBreakdown[taxChargeIndex].charge = taxAmount;
            } else {
                rateBreakdown.push({
                    id: `tax_${Date.now()}`,
                    code: taxCode,
                    chargeName: `${taxCode} Tax`,
                    cost: 0,
                    charge: taxAmount,
                    actualCost: 0,
                    actualCharge: taxAmount,
                    currency: 'CAD',
                    isTax: true,
                    taxRate: taxRate,
                    appliedAt: new Date()
                });
            }
            
            updates.manualRates = rateBreakdown;
        }

        // 5. Add shipment history entry
        const historyEntry = {
            id: `ap_processing_${Date.now()}`,
            action: 'AP Processing - Invoice Charges Applied',
            timestamp: new Date(),
            details: {
                invoiceNumber: invoiceData.invoiceNumber,
                chargesApplied: charges.length,
                charges: charges.map(c => ({
                    code: c.code,
                    name: c.name,
                    actualCost: c.actualCost,
                    actualCharge: c.actualCharge,
                    currency: c.currency
                }))
            },
            user: request.auth?.token?.email || 'system',
            source: 'AP Processing'
        };

        const existingHistory = shipmentData.statusHistory || [];
        updates.statusHistory = [...existingHistory, historyEntry];

        // 6. Update the shipment
        await shipmentRef.update(updates);

        console.log('✅ Successfully applied charges to shipment:', {
            shipmentId: shipmentDoc.id,
            chargesApplied: charges.length,
            invoiceNumber: invoiceData.invoiceNumber
        });

        return {
            success: true,
            shipmentId: shipmentDoc.id,
            chargesApplied: charges.length,
            message: `Successfully applied ${charges.length} charge(s) to shipment ${shipmentData.shipmentID || shipmentDoc.id}`
        };

    } catch (error) {
        console.error('❌ Error applying invoice charges:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Failed to apply charges: ${error.message}`);
    }
});

/**
 * Get tax rate for Canadian provinces
 */
function getTaxRate(province) {
    const taxRates = {
        'ON': 0.13, // HST
        'BC': 0.12, // GST + PST
        'AB': 0.05, // GST only
        'SK': 0.11, // GST + PST
        'MB': 0.12, // GST + PST
        'QC': 0.14975, // GST + QST
        'NB': 0.15, // HST
        'NS': 0.15, // HST
        'PE': 0.15, // HST
        'NL': 0.15, // HST
        'YT': 0.05, // GST only
        'NT': 0.05, // GST only
        'NU': 0.05  // GST only
    };
    
    return taxRates[province] || 0.13; // Default to Ontario HST
}
