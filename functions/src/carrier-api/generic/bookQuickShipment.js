const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');

// Import shipment events utility
const { recordShipmentEvent, EVENT_TYPES, EVENT_SOURCES } = require('../../utils/shipmentEvents');

const db = admin.firestore();

/**
 * Internal booking function that can be called directly or via onCall
 * @param {Object} data - The request data containing shipmentData and carrierDetails
 * @param {Object} auth - Authentication context (optional for warmup)
 * @returns {Object} - Success/error response with booking confirmation
 */
async function bookQuickShipmentInternal(data, auth = null) {
    try {
        const { shipmentData, carrierDetails } = data;
        
        // Check if this is a warmup request
        if (shipmentData?._isWarmupRequest || auth?.uid === 'keepalive-system' || auth?.uid?.includes('warmup')) {
            logger.info('🔥 QuickShip bookQuickShipment warmup request detected - returning quick response');
            return {
                success: true,
                warmup: true,
                message: 'Function warmed successfully',
                timestamp: new Date().toISOString()
            };
        }
        
        logger.info('bookQuickShipment called with:', { 
            shipmentId: shipmentData?.shipmentID,
            carrier: shipmentData?.carrier 
        });
        
        // Validate required data
        if (!shipmentData) {
            throw new Error('Shipment data is required');
        }
        
        if (!shipmentData.shipmentID) {
            throw new Error('Shipment ID is required');
        }

        // Check if a shipment already exists with this shipmentID
        // This would be the case if a draft was created first
        let shipmentDocRef;
        let firestoreDocId;
        let existingShipment = null;
        let isNewShipment = false;
        
        // First, check if a document exists with the shipmentID as the document ID
        const existingDocWithShipmentId = await db.collection('shipments').doc(shipmentData.shipmentID).get();
        
        if (existingDocWithShipmentId.exists) {
            // Use the existing document
            shipmentDocRef = existingDocWithShipmentId.ref;
            firestoreDocId = shipmentData.shipmentID;
            existingShipment = existingDocWithShipmentId.data();
            logger.info('Found existing shipment document with shipmentID as doc ID:', firestoreDocId);
        } else {
            // If not found by document ID, search by shipmentID field
            const querySnapshot = await db.collection('shipments')
                .where('shipmentID', '==', shipmentData.shipmentID)
                .limit(1)
                .get();
                
            if (!querySnapshot.empty) {
                // Use the existing document
                const existingDoc = querySnapshot.docs[0];
                shipmentDocRef = existingDoc.ref;
                firestoreDocId = existingDoc.id;
                existingShipment = existingDoc.data();
                logger.info('Found existing shipment document by shipmentID field:', firestoreDocId);
            } else {
                // Create a new document with auto-generated ID
                shipmentDocRef = db.collection('shipments').doc();
                firestoreDocId = shipmentDocRef.id;
                isNewShipment = true;
                logger.info('Creating new shipment document:', firestoreDocId);
            }
        }

        // Prepare complete shipment data for storage
        const completeShipmentData = {
            ...existingShipment, // Preserve any existing data
            ...shipmentData,
            firestoreDocId: firestoreDocId,
            bookingMethod: 'quickship_manual',
            carrierType: 'manual',
            status: 'pending', // Ensure status is set to pending
            bookingTimestamp: new Date().toISOString(), // Add booking timestamp
            
            // Store carrier details for document generation
            quickShipCarrierDetails: carrierDetails,
            
            // Enhanced tracking info
            trackingInfo: {
                trackingNumber: shipmentData.shipmentID,
                carrier: shipmentData.carrier,
                status: 'pending',
                statusHistory: [{
                    status: 'pending',
                    timestamp: new Date(), // Use regular Date object instead of serverTimestamp() in arrays
                    description: 'QuickShip booking confirmed',
                    location: shipmentData.shipFrom?.city || 'Origin'
                }]
            }
        };

        // Save or update the shipment document FIRST
        if (existingShipment) {
            await shipmentDocRef.update(completeShipmentData);
            logger.info('Updated existing QuickShip shipment in Firestore:', firestoreDocId);
        } else {
            await shipmentDocRef.set(completeShipmentData);
            logger.info('Created new QuickShip shipment in Firestore:', firestoreDocId);
        }

        // **CRITICAL FIX**: Record shipment events in timeline using Firebase document ID
        try {
            // Record shipment creation event (for new shipments)
            if (isNewShipment) {
                await recordShipmentEvent(
                    firestoreDocId, // Use Firebase document ID, not shipmentID
                    EVENT_TYPES.CREATED,
                    'Shipment Created',
                    `QuickShip shipment created with ID: ${shipmentData.shipmentID}`,
                    EVENT_SOURCES.USER,
                    {
                        email: auth?.token?.email || shipmentData.createdByEmail || 'unknown',
                        userId: auth?.uid || shipmentData.createdBy || 'unknown',
                        userName: auth?.token?.name || auth?.token?.email?.split('@')[0] || 'Unknown User'
                    },
                    {
                        shipmentType: shipmentData.shipmentInfo?.shipmentType || 'freight',
                        carrier: shipmentData.carrier,
                        bookingMethod: 'quickship_manual'
                    }
                );
                logger.info(`Recorded shipment creation event for ${shipmentData.shipmentID} (${firestoreDocId})`);
            }

            // Record booking confirmation event (for all QuickShip bookings)
            await recordShipmentEvent(
                firestoreDocId, // Use Firebase document ID, not shipmentID
                EVENT_TYPES.BOOKING_CONFIRMED,
                'QuickShip Booking Confirmed',
                `QuickShip booking confirmed for carrier: ${shipmentData.carrier}`,
                EVENT_SOURCES.USER,
                {
                    email: auth?.token?.email || shipmentData.createdByEmail || 'unknown',
                    userId: auth?.uid || shipmentData.createdBy || 'unknown',
                    userName: auth?.token?.name || auth?.token?.email?.split('@')[0] || 'Unknown User'
                },
                {
                    carrier: shipmentData.carrier,
                    bookingMethod: 'quickship_manual',
                    totalCharges: shipmentData.totalCharges,
                    currency: shipmentData.currency,
                    trackingNumber: shipmentData.shipmentID
                }
            );
            logger.info(`Recorded booking confirmation event for ${shipmentData.shipmentID} (${firestoreDocId})`);

        } catch (eventError) {
            logger.error('Error recording QuickShip events (non-blocking):', eventError);
            // Don't fail the booking if event recording fails
        }

        // GENERATE DOCUMENTS AFTER DATABASE SAVE (so they exist regardless of email success/failure)
        logger.info('Starting document generation after successful database save...');
        const documentResults = [];
        
        // 1. Generate Generic BOL
        try {
            const { generateBOLCore } = require('./generateGenericBOL');
            const bolResult = await generateBOLCore(shipmentData.shipmentID, firestoreDocId);
            documentResults.push(bolResult);
            
            logger.info('QuickShip BOL generation completed:', {
                success: bolResult.success,
                hasDownloadUrl: !!bolResult.data?.downloadUrl,
                fileName: bolResult.data?.fileName
            });

            // Record document generation event
            if (bolResult.success) {
                try {
                    await recordShipmentEvent(
                        firestoreDocId,
                        EVENT_TYPES.DOCUMENT_GENERATED,
                        'BOL Generated',
                        `Bill of Lading document generated: ${bolResult.data?.fileName || 'BOL.pdf'}`,
                        EVENT_SOURCES.SYSTEM,
                        null,
                        {
                            documentType: 'BOL',
                            fileName: bolResult.data?.fileName,
                            downloadUrl: bolResult.data?.downloadUrl
                        }
                    );
                } catch (docEventError) {
                    logger.error('Error recording BOL generation event:', docEventError);
                }
            }
        } catch (error) {
            logger.error('Error generating QuickShip BOL:', error);
            documentResults.push({ success: false, error: error.message });
        }
        
        // 2. Generate Carrier Confirmation (if carrier has any email contacts)
        let shouldGenerateCarrierConfirmation = false;
        
        // Check for legacy email structure
        if (carrierDetails?.contactEmail) {
            shouldGenerateCarrierConfirmation = true;
            logger.info('Carrier confirmation will be generated - found legacy contactEmail');
        }
        // Check for new terminal-based email structure
        else if (carrierDetails?.emailContacts && Array.isArray(carrierDetails.emailContacts)) {
            // Check if any terminal has any emails
            const hasAnyEmails = carrierDetails.emailContacts.some(terminal => {
                const contactTypes = terminal.contactTypes || {};
                return Object.values(contactTypes).some(emails => 
                    Array.isArray(emails) && emails.length > 0 && emails.some(email => email && email.trim())
                );
            });
            
            if (hasAnyEmails) {
                shouldGenerateCarrierConfirmation = true;
                logger.info('Carrier confirmation will be generated - found emails in terminal structure');
            }
        }
        
        if (shouldGenerateCarrierConfirmation) {
            try {
                const { generateCarrierConfirmationCore } = require('./generateCarrierConfirmation');
                const confirmationResult = await generateCarrierConfirmationCore(shipmentData.shipmentID, firestoreDocId, carrierDetails);
                documentResults.push(confirmationResult);
                
                logger.info('QuickShip Carrier Confirmation generation completed:', {
                    success: confirmationResult.success,
                    hasDownloadUrl: !!confirmationResult.data?.downloadUrl,
                    fileName: confirmationResult.data?.fileName
                });

                // Record carrier confirmation generation event
                if (confirmationResult.success) {
                    try {
                        await recordShipmentEvent(
                            firestoreDocId,
                            EVENT_TYPES.DOCUMENT_GENERATED,
                            'Carrier Confirmation Generated',
                            `Carrier confirmation document generated: ${confirmationResult.data?.fileName || 'Confirmation.pdf'}`,
                            EVENT_SOURCES.SYSTEM,
                            null,
                            {
                                documentType: 'Carrier Confirmation',
                                fileName: confirmationResult.data?.fileName,
                                downloadUrl: confirmationResult.data?.downloadUrl,
                                carrier: shipmentData.carrier
                            }
                        );
                    } catch (docEventError) {
                        logger.error('Error recording carrier confirmation generation event:', docEventError);
                    }
                }
            } catch (error) {
                logger.error('Error generating QuickShip Carrier Confirmation:', error);
                documentResults.push({ success: false, error: error.message });
            }
        } else {
            logger.info('No carrier email found in either legacy or terminal structure, skipping Carrier Confirmation generation', {
                hasCarrierDetails: !!carrierDetails,
                hasContactEmail: !!carrierDetails?.contactEmail,
                hasEmailContacts: !!carrierDetails?.emailContacts,
                emailContactsCount: carrierDetails?.emailContacts?.length || 0
            });
        }

        logger.info('Document generation completed successfully - sending notifications directly with document results');
        
        // Send QuickShip notifications directly with the actual document results
        // This avoids race conditions where the onShipmentCreated trigger might run before documents are fully accessible
        // Check if email notifications are disabled
        if (shipmentData.skipEmailNotifications) {
            logger.info('Email notifications are disabled via skipEmailNotifications flag - skipping email sending but documents were still generated');
        } else {
            try {
                const { sendQuickShipNotifications } = require('./sendQuickShipNotifications');
                await sendQuickShipNotifications({
                    shipmentData: completeShipmentData,
                    carrierDetails: carrierDetails,
                    documentResults: documentResults
                });
                logger.info('QuickShip notifications sent successfully with direct document results');
            } catch (notificationError) {
                logger.error('Error sending QuickShip notifications (non-blocking):', notificationError);
                // Don't fail the booking if notifications fail
            }
        }
        
        return {
            success: true,
            message: 'QuickShip booked successfully',
            data: {
                shipmentId: shipmentData.shipmentID,
                firestoreDocId: firestoreDocId,
                trackingNumber: shipmentData.shipmentID,
                status: 'pending',
                carrier: shipmentData.carrier,
                totalCharges: shipmentData.totalCharges,
                currency: shipmentData.currency,
                documentsGenerated: documentResults.filter(r => r.success).length,
                totalDocuments: documentResults.length
            }
        };
        
    } catch (error) {
        logger.error('Error in bookQuickShipmentInternal:', error);
        throw error;
    }
}

/**
 * Books a QuickShip shipment - manual carrier booking
 * Saves shipment data to database and generates documents - notifications handled by onShipmentCreated trigger
 * @param {Object} request - Firebase function request containing shipment data
 * @returns {Object} - Success/error response with booking confirmation
 */
const bookQuickShipment = onCall({
    minInstances: 1, // Keep warm to prevent cold starts for critical QuickShip operations
    memory: '512MiB',
    timeoutSeconds: 60
}, async (request) => {
    return await bookQuickShipmentInternal(request.data, request.auth);
});

module.exports = {
    bookQuickShipment,
    bookQuickShipmentInternal
}; 