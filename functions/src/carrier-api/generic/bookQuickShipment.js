const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');

const db = admin.firestore();

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
    try {
        const { shipmentData, carrierDetails } = request.data;
        
        // Check if this is a warmup request
        if (shipmentData?._isWarmupRequest || request.auth?.uid === 'keepalive-system' || request.auth?.uid?.includes('warmup')) {
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
            status: 'booked', // Ensure status is set to booked
            
            // Store carrier details for document generation
            quickShipCarrierDetails: carrierDetails,
            
            // Enhanced tracking info
            trackingInfo: {
                trackingNumber: shipmentData.shipmentID,
                carrier: shipmentData.carrier,
                status: 'booked',
                statusHistory: [{
                    status: 'booked',
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
        } catch (error) {
            logger.error('Error generating QuickShip BOL:', error);
            documentResults.push({ success: false, error: error.message });
        }
        
        // 2. Generate Carrier Confirmation (if carrier has email)
        if (carrierDetails?.contactEmail) {
            try {
                const { generateCarrierConfirmationCore } = require('./generateCarrierConfirmation');
                const confirmationResult = await generateCarrierConfirmationCore(shipmentData.shipmentID, firestoreDocId, carrierDetails);
                documentResults.push(confirmationResult);
                
                logger.info('QuickShip Carrier Confirmation generation completed:', {
                    success: confirmationResult.success,
                    hasDownloadUrl: !!confirmationResult.data?.downloadUrl,
                    fileName: confirmationResult.data?.fileName
                });
            } catch (error) {
                logger.error('Error generating QuickShip Carrier Confirmation:', error);
                documentResults.push({ success: false, error: error.message });
            }
        } else {
            logger.info('No carrier email provided, skipping Carrier Confirmation generation');
        }

        logger.info('Document generation completed successfully - sending notifications directly with document results');
        
        // Send QuickShip notifications directly with the actual document results
        // This avoids race conditions where the onShipmentCreated trigger might run before documents are fully accessible
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
        
        return {
            success: true,
            message: 'QuickShip booked successfully',
            data: {
                shipmentId: shipmentData.shipmentID,
                firestoreDocId: firestoreDocId,
                trackingNumber: shipmentData.shipmentID,
                status: 'booked',
                carrier: shipmentData.carrier,
                totalCharges: shipmentData.totalCharges,
                currency: shipmentData.currency,
                documentsGenerated: documentResults.filter(r => r.success).length,
                totalDocuments: documentResults.length
            }
        };
        
    } catch (error) {
        logger.error('Error in bookQuickShipment:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
});

module.exports = {
    bookQuickShipment
}; 