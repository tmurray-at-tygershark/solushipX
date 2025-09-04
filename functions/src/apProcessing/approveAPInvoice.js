const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getFunctions } = require('firebase-admin/functions');

/**
 * Cloud function to approve AP invoice processing results
 * Updates shipment costs, creates audit trail, and processes charges
 */
exports.approveAPInvoice = async (req, res) => {
    const db = getFirestore();
    
    try {
        const { 
            uploadId, 
            extractedResults, 
            approvedBy, 
            notes = '',
            overrideExceptions = false 
        } = req.body;

        console.log('🔥 Processing AP approval for upload:', uploadId);
        console.log('🔥 Extracted results count:', extractedResults?.length || 0);
        console.log('🔥 Approved by:', approvedBy);

        if (!uploadId || !extractedResults || !approvedBy) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: uploadId, extractedResults, approvedBy'
            });
        }

        const batch = db.batch();
        const approvalTimestamp = FieldValue.serverTimestamp();
        const processingResults = [];

        // Process each extracted shipment
        for (const shipment of extractedResults) {
            try {
                console.log(`🔍 Processing shipment: ${shipment.shipmentId}`);
                
                // Find matching shipment in database
                let shipmentDoc = null;
                let shipmentRef = null;

                // Try to find by matched shipment ID first
                if (shipment.matchedShipmentId || shipment.matchResult?.matchedShipmentId) {
                    const matchedId = shipment.matchedShipmentId || shipment.matchResult?.matchedShipmentId;
                    const matchQuery = db.collection('shipments').where('shipmentID', '==', matchedId).limit(1);
                    const matchSnapshot = await matchQuery.get();
                    
                    if (!matchSnapshot.empty) {
                        shipmentDoc = matchSnapshot.docs[0];
                        shipmentRef = shipmentDoc.ref;
                        console.log(`✅ Found matched shipment: ${matchedId}`);
                    }
                }

                // Fallback: try to find by extracted shipment ID
                if (!shipmentDoc && shipment.shipmentId) {
                    const extractedQuery = db.collection('shipments').where('shipmentID', '==', shipment.shipmentId).limit(1);
                    const extractedSnapshot = await extractedQuery.get();
                    
                    if (!extractedSnapshot.empty) {
                        shipmentDoc = extractedSnapshot.docs[0];
                        shipmentRef = shipmentDoc.ref;
                        console.log(`✅ Found shipment by extracted ID: ${shipment.shipmentId}`);
                    }
                }

                if (!shipmentDoc) {
                    console.log(`⚠️ No matching shipment found for: ${shipment.shipmentId}`);
                    processingResults.push({
                        shipmentId: shipment.shipmentId,
                        status: 'no_match',
                        message: 'No matching shipment found in database'
                    });
                    continue;
                }

                const existingData = shipmentDoc.data();
                
                // Prepare AP charges for update
                const apCharges = (shipment.charges || []).map(charge => ({
                    id: charge.id || `ap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: charge.name || charge.description || 'AP Charge',
                    amount: parseFloat(charge.amount) || 0,
                    currency: charge.currency || 'CAD',
                    source: 'ap-processing',
                    extractedFromInvoice: true,
                    approvedAt: approvalTimestamp,
                    approvedBy: approvedBy
                }));

                // Calculate total AP amount
                const totalAPAmount = apCharges.reduce((sum, charge) => sum + charge.amount, 0);

                // Update shipment with AP processing results
                const updateData = {
                    // Add AP charges
                    apCharges: apCharges,
                    apTotalAmount: totalAPAmount,
                    apCurrency: shipment.currency || 'CAD',
                    
                    // AP processing metadata
                    apProcessing: {
                        status: 'approved',
                        uploadId: uploadId,
                        extractedShipmentId: shipment.shipmentId,
                        confidence: shipment.matchConfidence || shipment.matchResult?.confidence || 0,
                        approvedBy: approvedBy,
                        approvedAt: approvalTimestamp,
                        notes: notes,
                        extractionEngine: 'gemini-2.5-flash',
                        overrideExceptions: overrideExceptions
                    },
                    
                    // Update modification tracking
                    lastModified: approvalTimestamp,
                    apLastModified: approvalTimestamp
                };

                // If charges match existing quotes, update cost basis
                if (existingData.selectedRate?.charges || existingData.actualRates?.charges) {
                    const existingCharges = existingData.selectedRate?.charges || existingData.actualRates?.charges || [];
                    
                    // Try to match AP charges to existing rate charges
                    const updatedCharges = existingCharges.map(existingCharge => {
                        const matchingAPCharge = apCharges.find(apCharge => 
                            apCharge.name.toLowerCase().includes(existingCharge.name?.toLowerCase() || '') ||
                            existingCharge.name?.toLowerCase().includes(apCharge.name.toLowerCase())
                        );
                        
                        if (matchingAPCharge) {
                            return {
                                ...existingCharge,
                                actualCost: matchingAPCharge.amount,
                                costCurrency: matchingAPCharge.currency,
                                costSource: 'ap-processing',
                                costUpdatedAt: approvalTimestamp
                            };
                        }
                        return existingCharge;
                    });

                    // Update the charges in the appropriate location
                    if (existingData.selectedRate?.charges) {
                        updateData['selectedRate.charges'] = updatedCharges;
                    }
                    if (existingData.actualRates?.charges) {
                        updateData['actualRates.charges'] = updatedCharges;
                    }
                }

                batch.update(shipmentRef, updateData);
                
                processingResults.push({
                    shipmentId: shipment.shipmentId,
                    matchedShipmentId: shipmentDoc.data().shipmentID,
                    status: 'approved',
                    totalAmount: totalAPAmount,
                    chargesCount: apCharges.length,
                    message: 'Successfully approved and updated'
                });

                console.log(`✅ Prepared shipment update for: ${shipment.shipmentId} -> ${shipmentDoc.data().shipmentID}`);

            } catch (error) {
                console.error(`❌ Error processing shipment ${shipment.shipmentId}:`, error);
                processingResults.push({
                    shipmentId: shipment.shipmentId,
                    status: 'error',
                    message: error.message
                });
            }
        }

        // Update the upload document with approval status
        const uploadRef = db.collection('pdfUploads').doc(uploadId);
        batch.update(uploadRef, {
            processingStatus: 'approved',
            approvalResults: {
                approvedBy: approvedBy,
                approvedAt: approvalTimestamp,
                notes: notes,
                overrideExceptions: overrideExceptions,
                processedShipments: processingResults.length,
                successfulUpdates: processingResults.filter(r => r.status === 'approved').length,
                processingResults: processingResults
            },
            lastModified: approvalTimestamp
        });

        // Commit all updates
        await batch.commit();
        
        console.log('✅ AP approval batch committed successfully');

        return res.status(200).json({
            success: true,
            message: 'AP invoice approved and posted successfully',
            uploadId: uploadId,
            processedShipments: processingResults.length,
            successfulUpdates: processingResults.filter(r => r.status === 'approved').length,
            results: processingResults
        });

    } catch (error) {
        console.error('❌ AP approval error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to approve AP invoice',
            details: error.message
        });
    }
};
