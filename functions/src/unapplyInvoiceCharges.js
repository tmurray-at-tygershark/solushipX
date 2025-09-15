const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

/**
 * Cloud function to unapply/revert invoice charges from a shipment
 * This function removes actual costs and charges that were previously applied
 */
exports.unapplyInvoiceCharges = onCall({ 
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
        console.log('📦 Found shipment for unapplying charges:', { 
            id: shipmentDoc.id, 
            shipmentID: shipmentData.shipmentID,
            carrier: shipmentData.selectedCarrier
        });

        // 2. Prepare the updates
        const updates = {
            updatedAt: FieldValue.serverTimestamp(),
            lastAPProcessing: {
                unappliedAt: FieldValue.serverTimestamp(),
                invoiceNumber: invoiceData.invoiceNumber,
                invoiceRef: invoiceData.invoiceRef,
                fileName: invoiceData.fileName,
                chargesUnapplied: charges.length
            }
        };

        // 3. Update charges in the rate structure - remove actual values
        let rateBreakdown = shipmentData.manualRates || [];
        
        charges.forEach(invoiceCharge => {
            const existingChargeIndex = rateBreakdown.findIndex(rate => 
                rate.code === invoiceCharge.code || rate.chargeName?.includes(invoiceCharge.name)
            );

            if (existingChargeIndex !== -1) {
                // Remove the applied invoice data, keep original quoted values
                const existingCharge = rateBreakdown[existingChargeIndex];
                
                // Remove actual values and invoice-related fields
                delete existingCharge.actualCost;
                delete existingCharge.actualCharge;
                delete existingCharge.actualCostCurrency;
                delete existingCharge.actualChargeCurrency;
                delete existingCharge.ediNumber;
                delete existingCharge.invoiceApplied;
                delete existingCharge.appliedAt;
                
                rateBreakdown[existingChargeIndex] = existingCharge;
                console.log(`🔄 Unapplied charge: ${invoiceCharge.code} from shipment`);
            }
        });

        updates.manualRates = rateBreakdown;

        // 4. Recalculate taxes after removing actual charges
        const shipmentType = shipmentData.shipmentInfo?.shipmentType || shipmentData.shipmentType;
        const shipFrom = shipmentData.shipmentInfo?.shipFrom || shipmentData.shipFrom;
        const shipTo = shipmentData.shipmentInfo?.shipTo || shipmentData.shipTo;
        
        if (shipFrom?.country === 'CA' && shipTo?.country === 'CA') {
            // Canadian domestic shipment - recalculate HST based on quoted charges
            const province = shipTo?.province || shipTo?.state || 'ON';
            const taxRate = getTaxRate(province);
            const subtotal = rateBreakdown.reduce((sum, rate) => {
                // Use quoted charge instead of actual charge
                if (rate.isTax) return sum; // Skip existing tax charges
                return sum + (parseFloat(rate.charge) || 0);
            }, 0);
            
            const taxAmount = subtotal * taxRate;
            const taxCode = province === 'QC' ? 'QST' : 'HST';
            
            // Update or remove tax charge
            const taxChargeIndex = rateBreakdown.findIndex(rate => 
                rate.code === taxCode || rate.code === 'HST' || rate.code === 'GST'
            );
            
            if (taxChargeIndex !== -1) {
                // Update tax to use quoted values instead of actual
                rateBreakdown[taxChargeIndex].charge = taxAmount;
                delete rateBreakdown[taxChargeIndex].actualCharge;
                delete rateBreakdown[taxChargeIndex].actualCost;
                console.log(`🔄 Recalculated tax after unapply: ${taxCode} = ${taxAmount}`);
            }
            
            updates.manualRates = rateBreakdown;
        }

        // 5. Add shipment history entry
        const historyEntry = {
            id: `ap_unapply_${Date.now()}`,
            action: 'AP Processing - Invoice Charges Unapplied',
            timestamp: new Date(),
            details: {
                invoiceNumber: invoiceData.invoiceNumber,
                chargesUnapplied: charges.length,
                charges: charges.map(c => ({
                    code: c.code,
                    name: c.name
                }))
            },
            user: request.auth?.token?.email || 'system',
            source: 'AP Processing - Unapply'
        };

        const existingHistory = shipmentData.statusHistory || [];
        updates.statusHistory = [...existingHistory, historyEntry];

        // 6. Update the shipment
        await shipmentRef.update(updates);

        console.log('✅ Successfully unapplied charges from shipment:', {
            shipmentId: shipmentDoc.id,
            chargesUnapplied: charges.length,
            invoiceNumber: invoiceData.invoiceNumber
        });

        return {
            success: true,
            shipmentId: shipmentDoc.id,
            chargesUnapplied: charges.length,
            message: `Successfully unapplied ${charges.length} charge(s) from shipment ${shipmentData.shipmentID || shipmentDoc.id}`
        };

    } catch (error) {
        console.error('❌ Error unapplying invoice charges:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Failed to unapply charges: ${error.message}`);
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
