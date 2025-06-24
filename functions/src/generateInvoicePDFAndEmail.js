const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const PDFDocument = require('pdfkit');
const { getStorage } = require('firebase-admin/storage');
const { sendEmailWithAttachment } = require('./email/sendgridService');

const db = getFirestore();
const storage = getStorage();

exports.generateInvoicePDFAndEmail = onCall(async (request) => {
    try {
        const { invoiceData, companyId } = request.data;
        
        if (!invoiceData || !companyId) {
            throw new HttpsError('invalid-argument', 'Missing required parameters');
        }

        logger.info('Generating invoice PDF and email for company:', companyId);

        // Get company information
        const companyDoc = await db.collection('companies').where('companyID', '==', companyId).get();
        if (companyDoc.empty) {
            throw new HttpsError('not-found', 'Company not found');
        }
        
        const companyInfo = companyDoc.docs[0].data();
        
        // Generate PDF
        const pdfBuffer = await generateInvoicePDF(invoiceData, companyInfo);
        
        // Upload PDF to Storage
        const fileName = `invoices/${invoiceData.invoiceNumber}.pdf`;
        const file = storage.bucket().file(fileName);
        await file.save(pdfBuffer, {
            metadata: {
                contentType: 'application/pdf',
                metadata: {
                    invoiceNumber: invoiceData.invoiceNumber,
                    companyId: companyId,
                    generatedAt: new Date().toISOString()
                }
            }
        });

        // Get download URL
        const [downloadURL] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
        });

        // Send email with PDF attachment
        await sendInvoiceEmail(invoiceData, companyInfo, pdfBuffer);
        
        logger.info('Invoice PDF generated and email sent successfully');
        
        return {
            success: true,
            invoiceNumber: invoiceData.invoiceNumber,
            downloadURL: downloadURL
        };
        
    } catch (error) {
        logger.error('Error generating invoice PDF and email:', error);
        throw new HttpsError('internal', 'Failed to generate invoice: ' + error.message);
    }
});

async function generateInvoicePDF(invoiceData, companyInfo) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            
            doc.on('data', buffer => buffers.push(buffer));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            // Company Header
            doc.fillColor('#1c277d')
               .fontSize(24)
               .text('INVOICE', 50, 50, { align: 'left' });
            
            // Company Logo/Name
            doc.fillColor('#000')
               .fontSize(16)
               .text('Integrated Carriers', 50, 80)
               .fontSize(10)
               .text('Professional Shipping Solutions', 50, 100)
               .text('support@integratedcarriers.com', 50, 115)
               .text('1-800-XXX-XXXX', 50, 130);

            // Invoice Details (Right side)
            doc.fontSize(12)
               .text(`Invoice #: ${invoiceData.invoiceNumber}`, 350, 80)
               .text(`Date: ${new Date(invoiceData.issueDate).toLocaleDateString()}`, 350, 100)
               .text(`Due Date: ${new Date(invoiceData.dueDate).toLocaleDateString()}`, 350, 120)
               .text(`Payment Terms: ${invoiceData.paymentTerms}`, 350, 140);

            // Bill To Section
            doc.fontSize(14)
               .fillColor('#1c277d')
               .text('BILL TO:', 50, 180);
            
            doc.fillColor('#000')
               .fontSize(12)
               .text(companyInfo.name || invoiceData.companyName, 50, 200);
            
            // Add billing address if available
            if (companyInfo.billingAddress) {
                const addr = companyInfo.billingAddress;
                let addressText = '';
                if (addr.address1) addressText += addr.address1 + '\n';
                if (addr.address2) addressText += addr.address2 + '\n';
                if (addr.city || addr.stateProv || addr.zipPostal) {
                    addressText += `${addr.city || ''}, ${addr.stateProv || ''} ${addr.zipPostal || ''}\n`;
                }
                if (addr.country) addressText += addr.country;
                
                if (addressText) {
                    doc.text(addressText, 50, 220);
                }
            }

            // Table Header
            const tableTop = 300;
            doc.fontSize(10)
               .fillColor('#f8fafc')
               .rect(50, tableTop, 500, 25)
               .fill();
            
            doc.fillColor('#374151')
               .text('Shipment ID', 60, tableTop + 8)
               .text('Description', 160, tableTop + 8)
               .text('Service', 320, tableTop + 8)
               .text('Amount', 480, tableTop + 8);

            // Table Content
            let yPosition = tableTop + 35;
            let subtotal = 0;

            invoiceData.lineItems.forEach((item, index) => {
                // Alternate row colors
                if (index % 2 === 0) {
                    doc.fillColor('#f8fafc')
                       .rect(50, yPosition - 5, 500, 20)
                       .fill();
                }

                doc.fillColor('#000')
                   .fontSize(9)
                   .text(item.shipmentId, 60, yPosition)
                   .text(item.description, 160, yPosition, { width: 150 })
                   .text(`${item.carrier} - ${item.service}`, 320, yPosition, { width: 120 })
                   .text(`$${item.charges.toFixed(2)}`, 480, yPosition);

                // Add charge breakdown if available and enabled
                if (invoiceData.settings.includeChargeBreakdown && item.chargeBreakdown && item.chargeBreakdown.length > 0) {
                    yPosition += 15;
                    item.chargeBreakdown.forEach(charge => {
                        doc.fontSize(8)
                           .fillColor('#6b7280')
                           .text(`  • ${charge.name}: $${charge.amount.toFixed(2)}`, 170, yPosition);
                        yPosition += 12;
                    });
                    yPosition -= 12; // Adjust for the extra increment
                }

                subtotal += item.charges;
                yPosition += 25;

                // Check if we need a new page
                if (yPosition > 700) {
                    doc.addPage();
                    yPosition = 50;
                }
            });

            // Totals Section
            yPosition += 20;
            const totalsX = 400;
            
            doc.fontSize(10)
               .text('Subtotal:', totalsX, yPosition)
               .text(`$${invoiceData.subtotal.toFixed(2)}`, totalsX + 80, yPosition);
            
            yPosition += 20;
            doc.text('HST (13%):', totalsX, yPosition)
               .text(`$${invoiceData.tax.toFixed(2)}`, totalsX + 80, yPosition);
            
            yPosition += 20;
            doc.fontSize(12)
               .fillColor('#1c277d')
               .text('TOTAL:', totalsX, yPosition)
               .text(`$${invoiceData.total.toFixed(2)}`, totalsX + 80, yPosition);

            // Payment Instructions
            yPosition += 50;
            doc.fillColor('#000')
               .fontSize(10)
               .text('Payment Instructions:', 50, yPosition)
               .fontSize(9)
               .text('Please remit payment within the specified terms. Include invoice number on all payments.', 50, yPosition + 15)
               .text('For questions regarding this invoice, contact support@integratedcarriers.com', 50, yPosition + 30);

            // Footer
            doc.fontSize(8)
               .fillColor('#6b7280')
               .text('Thank you for your business!', 50, 750)
               .text(`Generated on ${new Date().toLocaleDateString()}`, 400, 750);

            doc.end();
            
        } catch (error) {
            reject(error);
        }
    });
}

async function sendInvoiceEmail(invoiceData, companyInfo, pdfBuffer) {
    try {
        // Get primary contact email
        let recipientEmail = companyInfo.mainContact?.email;
        
        if (!recipientEmail && companyInfo.billingAddress?.email) {
            recipientEmail = companyInfo.billingAddress.email;
        }
        
        if (!recipientEmail) {
            // Get first user's email from the company
            const usersSnapshot = await db.collection('users')
                .where('companyID', '==', companyInfo.companyID)
                .limit(1)
                .get();
            
            if (!usersSnapshot.empty) {
                recipientEmail = usersSnapshot.docs[0].data().email;
            }
        }

        if (!recipientEmail) {
            throw new Error(`No email found for company ${companyInfo.companyID}`);
        }

        const emailData = {
            to: recipientEmail,
            subject: `Invoice ${invoiceData.invoiceNumber} from Integrated Carriers`,
            templateId: 'invoice_generated',
            dynamicTemplateData: {
                invoiceNumber: invoiceData.invoiceNumber,
                companyName: companyInfo.name || invoiceData.companyName,
                totalAmount: invoiceData.total.toFixed(2),
                dueDate: new Date(invoiceData.dueDate).toLocaleDateString(),
                paymentTerms: invoiceData.paymentTerms,
                shipmentCount: invoiceData.lineItems.length,
                currency: invoiceData.currency || 'CAD'
            },
            attachments: [
                {
                    content: pdfBuffer.toString('base64'),
                    filename: `Invoice-${invoiceData.invoiceNumber}.pdf`,
                    type: 'application/pdf',
                    disposition: 'attachment'
                }
            ]
        };

        await sendEmailWithAttachment(emailData);
        logger.info(`Invoice email sent to ${recipientEmail}`);
        
    } catch (error) {
        logger.error('Error sending invoice email:', error);
        throw error;
    }
}

// Email template for invoice notifications
const INVOICE_EMAIL_TEMPLATE = {
    invoice_generated: {
        subject: (data) => `Invoice ${data.invoiceNumber} from Integrated Carriers`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                    <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                    <h1 style="margin: 0; font-size: 24px;">New Invoice Available</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your monthly shipping charges invoice is ready</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                    <!-- Invoice Summary -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Invoice Summary</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Invoice #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.invoiceNumber}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Company:</strong></td><td style="padding: 8px 0;">${data.companyName}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Due Date:</strong></td><td style="padding: 8px 0;">${data.dueDate}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Payment Terms:</strong></td><td style="padding: 8px 0;">${data.paymentTerms}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Shipments:</strong></td><td style="padding: 8px 0;">${data.shipmentCount}</td></tr>
                        </table>
                    </div>

                    <!-- Amount Due -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">Amount Due</h3>
                        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #1c277d;">${data.currency} $${data.totalAmount}</p>
                    </div>

                    <!-- Payment Instructions -->
                    <div style="background: #e8f4fd; padding: 20px; border-radius: 0; border-left: 4px solid #1c277d; margin-bottom: 20px;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">Payment Instructions</h3>
                        <p style="margin: 0; color: #000;">Please remit payment within the specified terms. The detailed invoice is attached as a PDF. For questions, contact our billing department.</p>
                    </div>

                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                        <p style="margin: 0;">Questions? Contact us at <a href="mailto:billing@integratedcarriers.com" style="color: #1c277d;">billing@integratedcarriers.com</a></p>
                        <p style="margin: 10px 0 0 0; font-size: 14px;">© 2024 Integrated Carriers. All rights reserved.</p>
                    </div>
                </div>
            </div>
        `,
        text: (data) => `
New Invoice Available

INVOICE SUMMARY
- Invoice #: ${data.invoiceNumber}
- Company: ${data.companyName}
- Due Date: ${data.dueDate}
- Payment Terms: ${data.paymentTerms}
- Shipments: ${data.shipmentCount}

AMOUNT DUE: ${data.currency} $${data.totalAmount}

PAYMENT INSTRUCTIONS
Please remit payment within the specified terms. The detailed invoice is attached as a PDF. For questions, contact our billing department.

Questions? Contact billing@integratedcarriers.com
© 2024 Integrated Carriers. All rights reserved.
        `
    }
}; 