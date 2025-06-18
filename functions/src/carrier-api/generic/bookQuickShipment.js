const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Books a QuickShip shipment - manual carrier booking
 * Saves shipment data, generates documents, and sends notifications
 * @param {Object} request - Firebase function request containing shipment data
 * @returns {Object} - Success/error response with booking confirmation
 */
const bookQuickShipment = onCall(async (request) => {
    try {
        const { shipmentData, carrierDetails } = request.data;
        
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

        // Save shipment to Firestore
        const shipmentDocRef = db.collection('shipments').doc();
        const firestoreDocId = shipmentDocRef.id;

        // Prepare complete shipment data for storage
        const completeShipmentData = {
            ...shipmentData,
            firestoreDocId: firestoreDocId,
            bookingMethod: 'quickship_manual',
            carrierType: 'manual',
            
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

        // Save to Firestore
        await shipmentDocRef.set(completeShipmentData);
        logger.info('QuickShip shipment saved to Firestore:', firestoreDocId);

        // Generate documents in parallel
        const documentPromises = [];

        // 1. Generate Generic BOL
        const { generateGenericBOL } = require('./generateGenericBOL');
        documentPromises.push(
            generateGenericBOL({
                data: {
                    shipmentId: shipmentData.shipmentID,
                    firebaseDocId: firestoreDocId
                }
            }).catch(error => {
                logger.error('Error generating Generic BOL:', error);
                return { success: false, error: error.message };
            })
        );

        // 2. Generate Carrier Confirmation (if carrier has email)
        if (carrierDetails?.contactEmail) {
            const { generateCarrierConfirmation } = require('./generateCarrierConfirmation');
            documentPromises.push(
                generateCarrierConfirmation({
                    data: {
                        shipmentId: shipmentData.shipmentID,
                        firebaseDocId: firestoreDocId,
                        carrierDetails: carrierDetails
                    }
                }).catch(error => {
                    logger.error('Error generating Carrier Confirmation:', error);
                    return { success: false, error: error.message };
                })
            );
        }

        // Wait for all documents to generate
        const documentResults = await Promise.all(documentPromises);
        
        // Send notifications
        try {
            const { sendQuickShipNotifications } = require('./sendQuickShipNotifications');
            await sendQuickShipNotifications({
                shipmentData: completeShipmentData,
                carrierDetails: carrierDetails,
                documentResults: documentResults
            });
            logger.info('QuickShip notifications sent successfully');
        } catch (notificationError) {
            logger.error('Error sending QuickShip notifications:', notificationError);
            // Don't fail the booking if notifications fail
        }

        logger.info('QuickShip booking completed successfully');
        
        return {
            success: true,
            message: 'QuickShip booked successfully',
            data: {
                shipmentId: shipmentData.shipmentID,
                firestoreDocId: firestoreDocId,
                trackingNumber: shipmentData.shipmentID,
                status: 'booked',
                documents: documentResults.filter(result => result.success),
                carrier: shipmentData.carrier,
                totalCharges: shipmentData.totalCharges,
                currency: shipmentData.currency
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