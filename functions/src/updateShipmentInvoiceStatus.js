const { onCall } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Update shipment invoice status for AP processing automation
 * This function handles the automated status updates during intelligent processing
 */
exports.updateShipmentInvoiceStatus = onCall({
    cors: true,
    timeoutSeconds: 30
}, async (request) => {
    try {
        const { 
            shipmentId, 
            invoiceStatus, 
            invoiceData = {} 
        } = request.data;

        if (!shipmentId || !invoiceStatus) {
            throw new Error('Shipment ID and invoice status are required');
        }

        logger.info(`Updating shipment ${shipmentId} invoice status to: ${invoiceStatus}`, {
            shipmentId,
            invoiceStatus,
            invoiceData,
            updatedBy: request.auth?.uid || 'system'
        });

        // Valid invoice statuses for AP processing
        const validStatuses = [
            'processing',
            'ready_to_invoice',
            'exception', 
            'processed',
            'processed_with_exception',
            'partially_processed'
        ];

        if (!validStatuses.includes(invoiceStatus)) {
            throw new Error(`Invalid invoice status: ${invoiceStatus}. Valid statuses: ${validStatuses.join(', ')}`);
        }

        // Dual lookup strategy for shipment
        let shipmentRef = db.collection('shipments').doc(shipmentId);
        let shipmentDoc = await shipmentRef.get();

        // If not found by document ID, try by shipmentID field
        if (!shipmentDoc.exists) {
            const query = await db.collection('shipments')
                .where('shipmentID', '==', shipmentId)
                .limit(1)
                .get();
            
            if (!query.empty) {
                shipmentDoc = query.docs[0];
                shipmentRef = shipmentDoc.ref;
            }
        }

        if (!shipmentDoc.exists) {
            throw new Error(`Shipment ${shipmentId} not found`);
        }

        const currentData = shipmentDoc.data();

        // Prepare update data
        const updateData = {
            invoiceStatus: invoiceStatus,
            invoiceStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastModified: admin.firestore.FieldValue.serverTimestamp()
        };

        // Add status-specific fields
        switch (invoiceStatus) {
            case 'ready_to_invoice':
                updateData.readyToInvoiceAt = new Date();
                updateData.invoiceStatusLabel = 'Ready To Invoice';
                break;
                
            case 'exception':
                updateData.exceptionAt = new Date();
                updateData.invoiceStatusLabel = 'Exception';
                break;
                
            case 'processed':
                updateData.processedAt = new Date();
                updateData.invoiceStatusLabel = 'Processed';
                break;
                
            case 'processed_with_exception':
                updateData.processedAt = new Date();
                updateData.exceptionAt = new Date();
                updateData.invoiceStatusLabel = 'Processed with Exception';
                break;
                
            case 'partially_processed':
                updateData.partiallyProcessedAt = new Date();
                updateData.invoiceStatusLabel = 'Partially Processed';
                break;
                
            default:
                updateData.invoiceStatusLabel = invoiceStatus.charAt(0).toUpperCase() + invoiceStatus.slice(1);
        }

        // Add invoice data if provided
        if (invoiceData.invoiceNumber) {
            updateData.ediNumber = invoiceData.invoiceNumber;
            updateData.invoiceNumber = invoiceData.invoiceNumber;
        }

        if (invoiceData.totalChargesProcessed !== undefined) {
            updateData.totalChargesProcessed = invoiceData.totalChargesProcessed;
        }

        if (invoiceData.totalCharges !== undefined) {
            updateData.totalCharges = invoiceData.totalCharges;
        }

        if (invoiceData.processingDate) {
            updateData.processingDate = new Date(invoiceData.processingDate);
        }

        if (invoiceData.autoProcessed) {
            updateData.autoProcessed = true;
            updateData.autoProcessedAt = new Date();
        }

        // Create status history entry
        const statusHistoryEntry = {
            fromStatus: currentData.invoiceStatus || 'unknown',
            toStatus: invoiceStatus,
            timestamp: new Date(),
            updatedBy: request.auth?.uid || 'system',
            automatic: invoiceData.autoProcessed || false,
            invoiceData: invoiceData
        };

        // Add to invoice status history
        updateData.invoiceStatusHistory = admin.firestore.FieldValue.arrayUnion(statusHistoryEntry);

        // Update the shipment document
        await shipmentRef.update(updateData);

        logger.info(`Shipment ${shipmentId} invoice status updated successfully`, {
            fromStatus: currentData.invoiceStatus,
            toStatus: invoiceStatus,
            shipmentID: currentData.shipmentID,
            autoProcessed: invoiceData.autoProcessed
        });

        return {
            success: true,
            shipmentId: shipmentId,
            shipmentDocId: shipmentRef.id,
            updatedStatus: invoiceStatus,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        logger.error('Error updating shipment invoice status:', error);
        throw new Error(`Failed to update invoice status: ${error.message}`);
    }
});

