const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();

/**
 * Enhanced invoice status management with comprehensive tracking
 * Supports: generated, sent, viewed, paid, cancelled, refunded, disputed
 */
const updateInvoiceStatus = onCall(
    { 
        timeoutSeconds: 30,
        cors: true
    },
    async (request) => {
        try {
            const { 
                invoiceId, 
                newStatus, 
                paymentDetails = null,
                notes = '',
                automaticUpdate = false 
            } = request.data;

            if (!invoiceId || !newStatus) {
                throw new Error('Invoice ID and new status are required');
            }

            // Define valid status transitions
            const validStatuses = [
                'generated',   // PDF created but not sent
                'sent',        // Email sent to customer
                'viewed',      // Customer opened email/PDF
                'paid',        // Payment received
                'overdue',     // Past due date
                'cancelled',   // Invoice cancelled
                'refunded',    // Payment refunded
                'disputed',    // Payment disputed
                'draft'        // Draft state
            ];

            if (!validStatuses.includes(newStatus)) {
                throw new Error(`Invalid status: ${newStatus}. Valid statuses: ${validStatuses.join(', ')}`);
            }

            logger.info(`Updating invoice ${invoiceId} status to: ${newStatus}`, {
                invoiceId,
                newStatus,
                automaticUpdate,
                hasPaymentDetails: !!paymentDetails,
                updatedBy: request.auth?.uid || 'system'
            });

            // Get current invoice data
            const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
            if (!invoiceDoc.exists) {
                throw new Error(`Invoice ${invoiceId} not found`);
            }

            const invoiceData = invoiceDoc.data();
            const currentStatus = invoiceData.status;

            // Validate status transition (prevent invalid backwards transitions)
            if (!isValidStatusTransition(currentStatus, newStatus)) {
                throw new Error(`Invalid status transition from '${currentStatus}' to '${newStatus}'`);
            }

            // Prepare update data
            const updateData = {
                status: newStatus,
                lastUpdatedAt: new Date(),
                lastUpdatedBy: request.auth?.uid || 'system'
            };

            // Add status-specific fields
            switch (newStatus) {
                case 'sent':
                    updateData.sentAt = new Date();
                    updateData.emailSentCount = (invoiceData.emailSentCount || 0) + 1;
                    break;
                    
                case 'viewed':
                    updateData.viewedAt = new Date();
                    updateData.firstViewedAt = invoiceData.firstViewedAt || new Date();
                    updateData.viewCount = (invoiceData.viewCount || 0) + 1;
                    break;
                    
                case 'paid':
                    updateData.paidAt = new Date();
                    if (paymentDetails) {
                        updateData.paymentDetails = {
                            ...paymentDetails,
                            recordedAt: new Date()
                        };
                    }
                    break;
                    
                case 'overdue':
                    updateData.overdueAt = new Date();
                    break;
                    
                case 'cancelled':
                    updateData.cancelledAt = new Date();
                    updateData.cancellationReason = notes || 'No reason provided';
                    break;
                    
                case 'refunded':
                    updateData.refundedAt = new Date();
                    if (paymentDetails) {
                        updateData.refundDetails = {
                            ...paymentDetails,
                            recordedAt: new Date()
                        };
                    }
                    break;
                    
                case 'disputed':
                    updateData.disputedAt = new Date();
                    updateData.disputeReason = notes || 'No reason provided';
                    break;
            }

            // Add to status history
            const statusHistoryEntry = {
                fromStatus: currentStatus,
                toStatus: newStatus,
                timestamp: new Date(),
                updatedBy: request.auth?.uid || 'system',
                automatic: automaticUpdate,
                notes: notes
            };

            updateData.statusHistory = FieldValue.arrayUnion(statusHistoryEntry);

            // Update invoice document
            await db.collection('invoices').doc(invoiceId).update(updateData);

            // If marking as paid, update related shipments
            if (newStatus === 'paid' && invoiceData.shipmentIds) {
                const shipmentUpdatePromises = invoiceData.shipmentIds.map(shipmentId =>
                    db.collection('shipments').doc(shipmentId).update({
                        invoiceStatus: 'paid',
                        paidAt: new Date()
                    })
                );
                await Promise.all(shipmentUpdatePromises);
            }

            logger.info(`Invoice ${invoiceId} status updated successfully`, {
                fromStatus: currentStatus,
                toStatus: newStatus,
                invoiceNumber: invoiceData.invoiceNumber
            });

            return {
                success: true,
                invoiceId: invoiceId,
                invoiceNumber: invoiceData.invoiceNumber,
                fromStatus: currentStatus,
                toStatus: newStatus,
                updatedAt: updateData.lastUpdatedAt
            };

        } catch (error) {
            logger.error('Error updating invoice status:', error);
            throw new Error(`Failed to update invoice status: ${error.message}`);
        }
    }
);

/**
 * Validate if a status transition is allowed
 */
function isValidStatusTransition(currentStatus, newStatus) {
    // Define valid transitions
    const transitions = {
        'draft': ['generated', 'cancelled'],
        'generated': ['sent', 'cancelled'],
        'sent': ['viewed', 'overdue', 'cancelled'],
        'viewed': ['paid', 'overdue', 'disputed', 'cancelled'],
        'overdue': ['paid', 'disputed', 'cancelled'],
        'paid': ['refunded', 'disputed'],
        'cancelled': [], // Cannot transition from cancelled
        'refunded': ['disputed'],
        'disputed': ['paid', 'cancelled']
    };

    // Allow any transition if current status is not defined
    if (!currentStatus || !transitions[currentStatus]) {
        return true;
    }

    return transitions[currentStatus].includes(newStatus);
}

module.exports = { updateInvoiceStatus }; 