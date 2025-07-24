const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const { generateInvoicePDFAndEmailHelper } = require('../generateInvoicePDFAndEmail');

const db = getFirestore();

/**
 * Regenerate an existing invoice PDF and optionally resend email
 * This function can be used for both regenerating PDFs and resending emails
 */
const regenerateInvoice = onCall(
    { 
        timeoutSeconds: 60,
        cors: true
    },
    async (request) => {
        try {
            const { 
                invoiceId, 
                action = 'regenerate', // 'regenerate' | 'resend' | 'both'
                testMode = false,
                testEmail = null
            } = request.data;

            if (!invoiceId) {
                throw new Error('Invoice ID is required');
            }

            logger.info(`Processing ${action} request for invoice: ${invoiceId}`, {
                action,
                testMode,
                testEmail
            });

            // Get invoice data from database
            const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
            if (!invoiceDoc.exists) {
                throw new Error(`Invoice ${invoiceId} not found`);
            }

            const invoiceData = invoiceDoc.data();
            
            // Validate invoice data
            if (!invoiceData.companyId) {
                throw new Error('Invoice missing company ID');
            }

            if (!invoiceData.invoiceNumber) {
                throw new Error('Invoice missing invoice number');
            }

            logger.info('Retrieved invoice data for regeneration', {
                invoiceNumber: invoiceData.invoiceNumber,
                companyId: invoiceData.companyId,
                status: invoiceData.status,
                lineItemsCount: invoiceData.lineItems?.length || 0
            });

            // Prepare invoice data for regeneration
            const regenerationData = {
                invoiceNumber: invoiceData.invoiceNumber,
                companyId: invoiceData.companyId,
                companyName: invoiceData.companyName,
                customerId: invoiceData.customerId,
                issueDate: invoiceData.issueDate,
                dueDate: invoiceData.dueDate,
                status: invoiceData.status,
                lineItems: invoiceData.lineItems || [],
                subtotal: invoiceData.subtotal || 0,
                tax: invoiceData.tax || 0,
                total: invoiceData.total || 0,
                currency: invoiceData.currency || 'USD',
                paymentTerms: invoiceData.paymentTerms || 'Net 30',
                taxRate: invoiceData.taxRate || 0
            };

            let result = {};

            if (action === 'regenerate' || action === 'both') {
                // Regenerate PDF only (no email)
                logger.info('Regenerating PDF for invoice:', invoiceData.invoiceNumber);
                
                // Use the existing helper function to regenerate PDF
                const regenerationResult = await generateInvoicePDFAndEmailHelper(
                    regenerationData,
                    invoiceData.companyId,
                    false, // Don't send email for regenerate
                    null
                );

                result.pdfRegenerated = true;
                result.downloadURL = regenerationResult.downloadURL;

                // Update invoice record with regeneration info
                await db.collection('invoices').doc(invoiceId).update({
                    lastRegeneratedAt: new Date(),
                    regenerationCount: (invoiceData.regenerationCount || 0) + 1,
                    lastRegeneratedBy: request.auth?.uid || 'system'
                });

                logger.info('PDF regenerated successfully', {
                    invoiceNumber: invoiceData.invoiceNumber,
                    downloadURL: regenerationResult.downloadURL
                });
            }

            if (action === 'resend' || action === 'both') {
                // Resend email with existing or regenerated PDF
                logger.info('Resending email for invoice:', invoiceData.invoiceNumber);

                const resendResult = await generateInvoicePDFAndEmailHelper(
                    regenerationData,
                    invoiceData.companyId,
                    testMode,
                    testEmail
                );

                result.emailResent = true;
                result.emailSentTo = testEmail || 'customer billing email';

                // Update invoice record with resend info
                await db.collection('invoices').doc(invoiceId).update({
                    lastEmailSentAt: new Date(),
                    emailResendCount: (invoiceData.emailResendCount || 0) + 1,
                    lastEmailSentBy: request.auth?.uid || 'system'
                });

                logger.info('Email resent successfully', {
                    invoiceNumber: invoiceData.invoiceNumber,
                    sentTo: result.emailSentTo
                });
            }

            return {
                success: true,
                invoiceNumber: invoiceData.invoiceNumber,
                action: action,
                ...result
            };

        } catch (error) {
            logger.error('Error in regenerateInvoice:', error);
            throw new Error(`Failed to ${request.data.action || 'process'} invoice: ${error.message}`);
        }
    }
);

module.exports = { regenerateInvoice }; 