const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// 🚨 CRITICAL DEBUG: This should appear in logs if our updated function is loaded
console.log('🚨 APPLYINVOICECHARGES.JS LOADED - VERSION 3.0 - TIMESTAMP:', new Date().toISOString());

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
            // 🔧 CRITICAL FIX: Update invoice status when charges are applied - ready to invoice
            invoiceStatus: 'ready_to_invoice',
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

        // Ensure statusHistory is properly handled
        console.log('🔍 Checking statusHistory:', {
            exists: !!shipmentData.statusHistory,
            type: typeof shipmentData.statusHistory,
            isArray: Array.isArray(shipmentData.statusHistory),
            value: shipmentData.statusHistory
        });
        
        const existingHistory = Array.isArray(shipmentData.statusHistory) 
            ? shipmentData.statusHistory 
            : [];
        
        // Update any existing "Ready To Process" entries to "Processed"
        const updatedHistory = existingHistory.map(entry => {
            if (entry.details && 
                (entry.details.includes && entry.details.includes('Ready To Process')) ||
                (entry.action && entry.action.includes('Ready To Process')) ||
                (entry.status && entry.status === 'Ready To Process')) {
                return {
                    ...entry,
                    status: 'Processed',
                    action: entry.action ? entry.action.replace('Ready To Process', 'Processed') : entry.action,
                    details: typeof entry.details === 'string' 
                        ? entry.details.replace('Ready To Process', 'Processed')
                        : entry.details,
                    updatedAt: new Date(),
                    updatedBy: request.auth?.token?.email || 'system'
                };
            }
            return entry;
        });
        
        updates.statusHistory = [...updatedHistory, historyEntry];

        // 6. Update the shipment
        await shipmentRef.update(updates);

        // 7. Update apUploads collection with charge application data for UI persistence
        if (invoiceData.uploadId) {
            try {
                const chargeApplications = charges.map((charge, index) => ({
                    chargeIndex: index,
                    chargeCode: charge.code,
                    chargeName: charge.name,
                    status: 'applied',
                    appliedAt: new Date(),
                    shipmentId: shipmentDoc.id
                }));

                await db.collection('apUploads').doc(invoiceData.uploadId).update({
                    chargeApplications: FieldValue.arrayUnion(...chargeApplications),
                    hasAppliedCharges: true,
                    lastUpdated: FieldValue.serverTimestamp()
                });

                console.log('✅ Updated apUploads with charge applications for UI persistence');
            } catch (uploadError) {
                console.warn('⚠️ Failed to update apUploads with charge applications:', uploadError);
                // Don't fail the main operation if this fails
            }
        }

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

/**
 * SEPARATE FUNCTION FOR AUTOMATION - Internal use only
 * This is specifically for automated charge application to avoid breaking manual version
 */
async function applyChargesForAutomation(shipmentId, invoiceData, charges) {
    console.log('✅ AUTOMATION FUNCTION - PRODUCTION VERSION 8.0:', {
        shipmentId,
        chargesCount: charges?.length,
        timestamp: new Date().toISOString()
    });
    
    try {
        if (!shipmentId || !charges || !Array.isArray(charges) || charges.length === 0) {
            throw new Error('Missing required parameters: shipmentId and charges array');
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
            console.warn(`Direct lookup failed for ${shipmentId}, trying shipmentID field lookup`);
        }

        // If direct lookup failed or document doesn't exist, try shipmentID field
        if (!shipmentDoc || !shipmentDoc.exists) {
            console.info(`Trying shipmentID field lookup for: ${shipmentId}`);
            
            const querySnapshot = await db.collection('shipments')
                .where('shipmentID', '==', shipmentId)
                .limit(1)
                .get();
            
            if (!querySnapshot.empty) {
                shipmentDoc = querySnapshot.docs[0];
                shipmentRef = shipmentDoc.ref;
                console.info(`Found shipment via shipmentID field: ${shipmentDoc.id}`);
            }
        }

        if (!shipmentDoc || !shipmentDoc.exists) {
            throw new Error(`Shipment not found: ${shipmentId}`);
        }

        const shipmentData = shipmentDoc.data();

        // 2. BULLETPROOF charge processing - strip ALL FieldValue objects
        const processedCharges = charges.map((charge, index) => {
            // Create completely clean charge object with only primitive values
            const cleanCharge = {
                id: `automation_${shipmentId}_${Date.now()}_${index}`,
                chargeCode: String(charge.code || 'MISC'),
                chargeName: String(charge.name || 'Unknown Charge'),
                actualCost: Number(parseFloat(charge.actualCost) || 0),
                actualCharge: Number(parseFloat(charge.actualCharge) || 0),
                currency: String(charge.currency || 'CAD'),
                appliedAt: new Date(), // CRITICAL: Always use new Date()
                appliedVia: 'automation',
                invoiceNumber: String(invoiceData?.invoiceNumber || ''),
                ediNumber: String(charge.ediNumber || invoiceData?.invoiceNumber || ''),
                source: 'automation'
            };
            
            // CRITICAL: Verify no FieldValue objects made it through
            Object.entries(cleanCharge).forEach(([key, value]) => {
                if (value && typeof value === 'object' && value._delegate) {
                    console.error('🚨 DETECTED FIELDVALUE OBJECT:', key, value);
                    throw new Error(`FieldValue object detected in charge field: ${key}`);
                }
            });
            
            console.log('✅ CLEAN CHARGE VERIFIED - VERSION 7.0:', {
                index,
                appliedAtType: typeof cleanCharge.appliedAt,
                appliedAtValue: cleanCharge.appliedAt,
                isDate: cleanCharge.appliedAt instanceof Date,
                noFieldValueObjects: true
            });
            
            return cleanCharge;
        });

        // 3. Create shipment history entry (same format as manual process)
        const historyEntry = {
            id: `ap_processing_${Date.now()}`,
            action: 'AP Processing - Invoice Charges Applied (Auto)',
            timestamp: new Date(), // CRITICAL FIX: Use Date object, not FieldValue.serverTimestamp() in array
            details: {
                invoiceNumber: invoiceData?.invoiceNumber || 'Unknown',
                chargesApplied: charges.length,
                charges: charges.map(c => ({
                    code: c.code,
                    name: c.name,
                    actualCost: c.actualCost,
                    actualCharge: c.actualCharge,
                    currency: c.currency
                })),
                appliedVia: 'automation',
                processedBy: 'system'
            },
            user: 'automation',
            source: 'AP Processing Automation'
        };

        // 4. Update existing status history entries and add new one
        const existingHistory = Array.isArray(shipmentData.statusHistory)
            ? shipmentData.statusHistory
            : [];

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

        // 5. Update rate breakdown (same as manual process) for UI display
        let rateBreakdown = shipmentData.manualRates || [];
        
        // Update existing charges or add new ones to rate breakdown
        charges.forEach(invoiceCharge => {
            const existingChargeIndex = rateBreakdown.findIndex(rate => 
                rate.code === invoiceCharge.code || rate.chargeName?.includes(invoiceCharge.name)
            );

            const chargeUpdate = {
                actualCost: parseFloat(invoiceCharge.actualCost) || 0,
                actualCharge: parseFloat(invoiceCharge.actualCharge) || 0,
                actualCostCurrency: invoiceCharge.currency || 'CAD',
                actualChargeCurrency: invoiceCharge.currency || 'CAD',
                ediNumber: invoiceCharge.ediNumber || invoiceData?.invoiceNumber || '',
                invoiceApplied: true,
                appliedAt: new Date()
            };

            if (existingChargeIndex !== -1) {
                // Update existing charge
                rateBreakdown[existingChargeIndex] = {
                    ...rateBreakdown[existingChargeIndex],
                    ...chargeUpdate
                };
                console.log(`✅ Updated existing charge: ${invoiceCharge.code} with actual cost $${chargeUpdate.actualCost}`);
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
                console.log(`✅ Added new charge: ${invoiceCharge.code} with actual cost $${chargeUpdate.actualCost}`);
            }
        });

        // 6. Update the shipment document
        const updates = {
            updatedCharges: processedCharges,
            manualRates: rateBreakdown, // CRITICAL: Update rate breakdown for UI display
            updatedAt: FieldValue.serverTimestamp(),
            invoiceStatus: 'ready_to_invoice', // CRITICAL: Set to ready_to_invoice
            statusHistory: [...updatedHistory, historyEntry],
            lastAPProcessing: {
                appliedAt: FieldValue.serverTimestamp(),
                appliedBy: 'automation',
                invoiceNumber: invoiceData?.invoiceNumber || '',
                chargeCount: charges.length,
                source: 'automation'
            }
        };

        // Debug: Log the updates object structure before applying
        console.log('🔧 AUTOMATION UPDATE DEBUG - VERSION 2.0:', {
            deployTime: '2025-09-17T14:47:00Z',
            shipmentId: shipmentDoc.id,
            updatedChargesLength: updates.updatedCharges.length,
            firstChargeStructure: updates.updatedCharges[0],
            firstChargeAppliedAtType: typeof updates.updatedCharges[0]?.appliedAt,
            firstChargeAppliedAtValue: updates.updatedCharges[0]?.appliedAt,
            allChargesAppliedAtTypes: updates.updatedCharges.map((charge, i) => ({
                index: i,
                appliedAtType: typeof charge.appliedAt,
                appliedAtValue: charge.appliedAt,
                isFieldValue: charge.appliedAt && typeof charge.appliedAt === 'object' && charge.appliedAt._delegate
            }))
        });
        
        // FINAL VERIFICATION: Ensure no FieldValue objects in the updates
        console.log('✅ FINAL UPDATE VERIFICATION - PRODUCTION VERSION 8.0:', {
            shipmentId: shipmentDoc.id,
            updatedChargesCount: updates.updatedCharges?.length,
            allChargesValid: updates.updatedCharges?.every(charge => 
                charge.appliedAt instanceof Date && 
                !(charge.appliedAt && typeof charge.appliedAt === 'object' && charge.appliedAt._delegate)
            )
        });
        
        // Verify no FieldValue objects in any charge
        updates.updatedCharges?.forEach((charge, index) => {
            Object.entries(charge).forEach(([key, value]) => {
                if (value && typeof value === 'object' && value._delegate) {
                    throw new Error(`FieldValue object found in updates.updatedCharges[${index}].${key}`);
                }
            });
        });
        
        await shipmentRef.update(updates);

        console.info(`✅ AUTOMATION: Successfully applied ${charges.length} charges to shipment ${shipmentData.shipmentID || shipmentDoc.id}`);

        return {
            success: true, 
            shipmentId: shipmentDoc.id,
            chargesApplied: charges.length,
            message: `Successfully applied ${charges.length} charge(s) to shipment ${shipmentData.shipmentID || shipmentDoc.id}`
        };

    } catch (error) {
        console.error('❌ AUTOMATION: Error applying charges:', error);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

/**
 * Export the automation function for use by intelligent processing
 */
exports.applyChargesForAutomation = applyChargesForAutomation;
