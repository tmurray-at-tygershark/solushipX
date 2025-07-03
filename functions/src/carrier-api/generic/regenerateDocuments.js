const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const { generateBOLCore } = require('./generateGenericBOL');
const { generateCarrierConfirmationCore } = require('./generateCarrierConfirmation');

const db = admin.firestore();

/**
 * Regenerate BOL document with latest shipment data
 */
const regenerateBOL = onCall({
    minInstances: 1,
    memory: '1GiB',
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { shipmentId, firebaseDocId, reason = 'User requested regeneration' } = request.data;
        const { uid: userId, email: userEmail } = request.auth || {};

        // Ensure we have safe values for Firestore (no undefined values)
        const safeUserId = userId || 'unknown';
        const safeUserEmail = userEmail || 'unknown@system.local';

        logger.info('regenerateBOL started:', { 
            shipmentId, 
            firebaseDocId, 
            userId: safeUserId, 
            userEmail: safeUserEmail,
            reason 
        });

        if (!shipmentId || !firebaseDocId) {
            throw new Error('Shipment ID and Firebase document ID are required');
        }

        // Get current shipment data - FIXED: Firebase v9+ syntax
        logger.info('Fetching shipment data...', { firebaseDocId });
        const shipmentDoc = await db.collection('shipments').doc(firebaseDocId).get();
        if (!shipmentDoc.exists) {
            throw new Error(`Shipment ${firebaseDocId} not found`);
        }

        const shipmentData = shipmentDoc.data();
        logger.info('Shipment data retrieved successfully', { 
            shipmentId: shipmentData.shipmentID,
            status: shipmentData.status 
        });

        // Archive existing BOL documents (mark as archived, don't delete)
        logger.info('Archiving existing BOL documents...', { firebaseDocId });
        await archiveExistingDocuments(firebaseDocId, 'bol', safeUserId, reason);

        // Generate new BOL
        logger.info('Generating new BOL document...', { shipmentId, firebaseDocId });
        const bolResult = await generateBOLCore(shipmentId, firebaseDocId);

        if (bolResult.success) {
            logger.info('BOL generation successful, updating metadata...', { firebaseDocId });
            
            // Update the new document with regeneration metadata
            const newDocRef = db.collection('shipments').doc(firebaseDocId)
                .collection('documents').doc(`${firebaseDocId}_bol`);
            
            // Use set with merge to handle cases where document doesn't exist yet
            await newDocRef.set({
                version: admin.firestore.FieldValue.increment(1),
                isLatest: true,
                regeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
                regeneratedBy: safeUserId,
                regeneratedByEmail: safeUserEmail,
                regenerationReason: reason,
                editHistory: admin.firestore.FieldValue.arrayUnion({
                    action: 'regenerated',
                    timestamp: new Date(),
                    userId: safeUserId,
                    userEmail: safeUserEmail,
                    reason: reason
                })
            }, { merge: true });

            // Also update legacy collection with set merge
            const legacyDocRef = db.collection('shipmentDocuments').doc(`${firebaseDocId}_bol`);
            await legacyDocRef.set({
                version: admin.firestore.FieldValue.increment(1),
                isLatest: true,
                regeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
                regeneratedBy: safeUserId,
                regeneratedByEmail: safeUserEmail,
                regenerationReason: reason
            }, { merge: true });

            // Record regeneration event in shipment history
            logger.info('Recording regeneration event in shipment history...', { firebaseDocId });
            await recordRegenerationEvent(firebaseDocId, 'BOL', safeUserId, safeUserEmail, reason);

            logger.info('BOL regeneration completed successfully:', { 
                shipmentId, 
                firebaseDocId, 
                userId: safeUserId,
                documentUrl: bolResult.data?.url || 'N/A'
            });

            return {
                success: true,
                message: 'BOL regenerated successfully',
                data: {
                    ...bolResult.data,
                    regeneratedAt: new Date().toISOString(),
                    regeneratedBy: safeUserEmail
                }
            };
        } else {
            throw new Error(bolResult.error || 'Failed to regenerate BOL');
        }

    } catch (error) {
        logger.error('Error regenerating BOL:', { 
            error: error.message, 
            stack: error.stack,
            shipmentId: request.data?.shipmentId,
            firebaseDocId: request.data?.firebaseDocId
        });
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
});

/**
 * Regenerate Carrier Confirmation document with latest shipment data
 */
const regenerateCarrierConfirmation = onCall({
    minInstances: 1,
    memory: '1GiB',
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { shipmentId, firebaseDocId, carrierDetails, reason = 'User requested regeneration' } = request.data;
        const { uid: userId, email: userEmail } = request.auth || {};

        // Ensure we have safe values for Firestore (no undefined values)
        const safeUserId = userId || 'unknown';
        const safeUserEmail = userEmail || 'unknown@system.local';

        logger.info('regenerateCarrierConfirmation started:', { 
            shipmentId, 
            firebaseDocId, 
            userId: safeUserId,
            userEmail: safeUserEmail,
            carrierName: carrierDetails?.name,
            reason 
        });

        if (!shipmentId || !firebaseDocId || !carrierDetails) {
            throw new Error('Shipment ID, Firebase document ID, and carrier details are required');
        }

        // Get current shipment data - FIXED: Firebase v9+ syntax
        logger.info('Fetching shipment data...', { firebaseDocId });
        const shipmentDoc = await db.collection('shipments').doc(firebaseDocId).get();
        if (!shipmentDoc.exists) {
            throw new Error(`Shipment ${firebaseDocId} not found`);
        }

        const shipmentData = shipmentDoc.data();
        logger.info('Shipment data retrieved successfully', { 
            shipmentId: shipmentData.shipmentID,
            status: shipmentData.status,
            carrier: carrierDetails.name,
            creationMethod: shipmentData.creationMethod
        });

        // ENHANCEMENT: Fetch complete carrier data to ensure account number is included
        let completeCarrierDetails = carrierDetails;
        
        try {
            logger.info('🔍 REGENERATION: Fetching complete carrier data...', {
                carrierName: carrierDetails.name,
                creationMethod: shipmentData.creationMethod,
                hasAccountNumber: !!carrierDetails.accountNumber
            });
            
            // For QuickShip shipments, check quickshipCarriers collection first
            if (shipmentData.creationMethod === 'quickship') {
                logger.info('🚀 QuickShip detected - searching quickshipCarriers collection');
                
                const quickshipCarriersRef = db.collection('quickshipCarriers');
                
                // Try to find by carrier name first
                const carrierName = carrierDetails.name || shipmentData.selectedCarrier || shipmentData.carrier;
                if (carrierName) {
                    const nameQuery = quickshipCarriersRef.where('name', '==', carrierName);
                    const nameSnapshot = await nameQuery.limit(1).get();
                    
                    if (!nameSnapshot.empty) {
                        const fullCarrierData = nameSnapshot.docs[0].data();
                        logger.info('✅ Found complete QuickShip carrier data:', {
                            name: fullCarrierData.name,
                            accountNumber: fullCarrierData.accountNumber,
                            hasEmailContacts: !!fullCarrierData.emailContacts
                        });
                        completeCarrierDetails = { ...carrierDetails, ...fullCarrierData };
                    } else {
                        // Try by carrierId if name doesn't work
                        const idQuery = quickshipCarriersRef.where('carrierId', '==', carrierName);
                        const idSnapshot = await idQuery.limit(1).get();
                        
                        if (!idSnapshot.empty) {
                            const fullCarrierData = idSnapshot.docs[0].data();
                            logger.info('✅ Found QuickShip carrier by ID:', {
                                name: fullCarrierData.name,
                                accountNumber: fullCarrierData.accountNumber,
                                hasEmailContacts: !!fullCarrierData.emailContacts
                            });
                            completeCarrierDetails = { ...carrierDetails, ...fullCarrierData };
                        } else {
                            logger.warn('❌ QuickShip carrier not found in quickshipCarriers collection:', carrierName);
                        }
                    }
                }
            } else {
                // For regular shipments, check carriers collection
                logger.info('🏢 Regular shipment - searching carriers collection');
                
                const carriersRef = db.collection('carriers');
                const carrierName = carrierDetails.name || shipmentData.selectedCarrier || shipmentData.carrier;
                
                if (carrierName) {
                    // Try by carrierID first
                    const idQuery = carriersRef.where('carrierID', '==', carrierName);
                    const idSnapshot = await idQuery.limit(1).get();
                    
                    if (!idSnapshot.empty) {
                        const fullCarrierData = idSnapshot.docs[0].data();
                        logger.info('✅ Found regular carrier by ID:', {
                            name: fullCarrierData.name,
                            accountNumber: fullCarrierData.accountNumber,
                            apiCredentials: !!fullCarrierData.apiCredentials
                        });
                        completeCarrierDetails = { ...carrierDetails, ...fullCarrierData };
                    } else {
                        // Try by name
                        const nameQuery = carriersRef.where('name', '==', carrierName);
                        const nameSnapshot = await nameQuery.limit(1).get();
                        
                        if (!nameSnapshot.empty) {
                            const fullCarrierData = nameSnapshot.docs[0].data();
                            logger.info('✅ Found regular carrier by name:', {
                                name: fullCarrierData.name,
                                accountNumber: fullCarrierData.accountNumber,
                                apiCredentials: !!fullCarrierData.apiCredentials
                            });
                            completeCarrierDetails = { ...carrierDetails, ...fullCarrierData };
                        } else {
                            logger.warn('❌ Regular carrier not found in carriers collection:', carrierName);
                        }
                    }
                }
            }
            
            logger.info('🎯 FINAL CARRIER DETAILS for regeneration:', {
                name: completeCarrierDetails.name,
                accountNumber: completeCarrierDetails.accountNumber,
                apiCredentialsAccountNumber: completeCarrierDetails.apiCredentials?.accountNumber,
                hasCompleteData: !!(completeCarrierDetails.accountNumber || completeCarrierDetails.apiCredentials?.accountNumber)
            });
            
        } catch (carrierFetchError) {
            logger.error('Error fetching complete carrier data (using provided details):', carrierFetchError);
            // Continue with provided carrier details as fallback
        }

        // Archive existing carrier confirmation documents
        logger.info('Archiving existing carrier confirmation documents...', { firebaseDocId });
        await archiveExistingDocuments(firebaseDocId, 'carrier_confirmation', safeUserId, reason);

        // Generate new carrier confirmation with complete carrier details
        logger.info('Generating new carrier confirmation document...', { 
            shipmentId, 
            firebaseDocId,
            carrierName: completeCarrierDetails.name,
            hasAccountNumber: !!(completeCarrierDetails.accountNumber || completeCarrierDetails.apiCredentials?.accountNumber)
        });
        const confirmationResult = await generateCarrierConfirmationCore(shipmentId, firebaseDocId, completeCarrierDetails);

        if (confirmationResult.success) {
            logger.info('Carrier confirmation generation successful, updating metadata...', { firebaseDocId });
            
            // Update the new document with regeneration metadata
            const newDocRef = db.collection('shipments').doc(firebaseDocId)
                .collection('documents').doc(`${firebaseDocId}_carrier_confirmation`);
            
            // Use set with merge to handle cases where document doesn't exist yet
            await newDocRef.set({
                version: admin.firestore.FieldValue.increment(1),
                isLatest: true,
                regeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
                regeneratedBy: safeUserId,
                regeneratedByEmail: safeUserEmail,
                regenerationReason: reason,
                editHistory: admin.firestore.FieldValue.arrayUnion({
                    action: 'regenerated',
                    timestamp: new Date(),
                    userId: safeUserId,
                    userEmail: safeUserEmail,
                    reason: reason
                })
            }, { merge: true });

            // Also update legacy collection with set merge
            const legacyDocRef = db.collection('shipmentDocuments').doc(`${firebaseDocId}_carrier_confirmation`);
            await legacyDocRef.set({
                version: admin.firestore.FieldValue.increment(1),
                isLatest: true,
                regeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
                regeneratedBy: safeUserId,
                regeneratedByEmail: safeUserEmail,
                regenerationReason: reason
            }, { merge: true });

            // Record regeneration event in shipment history
            logger.info('Recording regeneration event in shipment history...', { firebaseDocId });
            await recordRegenerationEvent(firebaseDocId, 'Carrier Confirmation', safeUserId, safeUserEmail, reason);

            logger.info('Carrier confirmation regeneration completed successfully:', { 
                shipmentId, 
                firebaseDocId, 
                userId: safeUserId,
                carrierName: completeCarrierDetails.name,
                documentUrl: confirmationResult.data?.url || 'N/A'
            });

            return {
                success: true,
                message: 'Carrier Confirmation regenerated successfully',
                data: {
                    ...confirmationResult.data,
                    regeneratedAt: new Date().toISOString(),
                    regeneratedBy: safeUserEmail,
                    carrierName: completeCarrierDetails.name
                }
            };
        } else {
            throw new Error(confirmationResult.error || 'Failed to regenerate Carrier Confirmation');
        }

    } catch (error) {
        logger.error('Error regenerating Carrier Confirmation:', { 
            error: error.message, 
            stack: error.stack,
            shipmentId: request.data?.shipmentId,
            firebaseDocId: request.data?.firebaseDocId,
            carrierName: request.data?.carrierDetails?.name
        });
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
});

/**
 * Archive existing documents by marking them as archived and not latest
 */
async function archiveExistingDocuments(firebaseDocId, documentType, userId, reason) {
    try {
        // Archive in unified collection
        const unifiedQuery = db.collection('shipments').doc(firebaseDocId)
            .collection('documents')
            .where('documentType', '==', documentType)
            .where('isLatest', '==', true);

        const unifiedSnapshot = await unifiedQuery.get();
        const unifiedBatch = db.batch();

        unifiedSnapshot.docs.forEach(doc => {
            unifiedBatch.update(doc.ref, {
                isLatest: false,
                isArchived: true,
                archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                archivedBy: userId,
                archiveReason: reason
            });
        });

        if (!unifiedSnapshot.empty) {
            await unifiedBatch.commit();
        }

        // Archive in legacy collection
        const legacyQuery = db.collection('shipmentDocuments')
            .where('shipmentId', '==', firebaseDocId)
            .where('documentType', '==', documentType)
            .where('isLatest', '==', true);

        const legacySnapshot = await legacyQuery.get();
        const legacyBatch = db.batch();

        legacySnapshot.docs.forEach(doc => {
            legacyBatch.update(doc.ref, {
                isLatest: false,
                isArchived: true,
                archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                archivedBy: userId,
                archiveReason: reason
            });
        });

        if (!legacySnapshot.empty) {
            await legacyBatch.commit();
        }

        logger.info(`Archived ${unifiedSnapshot.size + legacySnapshot.size} existing ${documentType} documents`);

    } catch (error) {
        logger.error('Error archiving existing documents:', error);
        throw error;
    }
}

/**
 * Record document regeneration event in shipment history
 */
async function recordRegenerationEvent(shipmentId, documentType, userId, userEmail, reason) {
    try {
        const eventRef = db.collection('shipmentEvents').doc();
        await eventRef.set({
            shipmentId: shipmentId,
            eventType: 'document_regenerated',
            eventSource: 'user',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            title: `${documentType} Regenerated`,
            description: `${documentType} document was regenerated by user request`,
            details: {
                documentType: documentType,
                regeneratedBy: userId,
                regeneratedByEmail: userEmail,
                reason: reason
            },
            metadata: {
                userId: userId,
                userEmail: userEmail,
                action: 'document_regeneration'
            }
        });

        logger.info(`Recorded regeneration event for ${documentType}:`, { shipmentId, userId });

    } catch (error) {
        logger.error('Error recording regeneration event:', error);
        // Don't throw - this is non-critical
    }
}

/**
 * Regenerate all documents for a shipment
 */
const regenerateAllDocuments = onCall({
    minInstances: 1,
    memory: '1GiB',
    timeoutSeconds: 120
}, async (request) => {
    try {
        const { shipmentId, firebaseDocId, carrierDetails, reason = 'User requested full regeneration' } = request.data;
        const { uid: userId, email: userEmail } = request.auth || {};

        // Ensure we have safe values for Firestore (no undefined values)
        const safeUserId = userId || 'unknown';
        const safeUserEmail = userEmail || 'unknown@system.local';

        logger.info('regenerateAllDocuments called:', { shipmentId, firebaseDocId, userId: safeUserId, reason });

        const results = {
            bol: null,
            carrierConfirmation: null
        };

        // Regenerate BOL
        try {
            const bolResult = await regenerateBOL.handler({
                data: { shipmentId, firebaseDocId, reason },
                auth: { uid: safeUserId, email: safeUserEmail }
            });
            results.bol = bolResult;
        } catch (error) {
            results.bol = { success: false, error: error.message };
        }

        // Regenerate Carrier Confirmation if carrier details provided
        if (carrierDetails) {
            try {
                const confirmationResult = await regenerateCarrierConfirmation.handler({
                    data: { shipmentId, firebaseDocId, carrierDetails, reason },
                    auth: { uid: safeUserId, email: safeUserEmail }
                });
                results.carrierConfirmation = confirmationResult;
            } catch (error) {
                results.carrierConfirmation = { success: false, error: error.message };
            }
        }

        const successCount = Object.values(results).filter(r => r?.success).length;
        const totalCount = Object.values(results).filter(r => r !== null).length;

        return {
            success: successCount > 0,
            message: `${successCount}/${totalCount} documents regenerated successfully`,
            data: results
        };

    } catch (error) {
        logger.error('Error regenerating all documents:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

module.exports = {
    regenerateBOL,
    regenerateCarrierConfirmation,
    regenerateAllDocuments
}; 