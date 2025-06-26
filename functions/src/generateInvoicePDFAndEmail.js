const { logger } = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const PDFDocument = require('pdfkit');
const { getStorage } = require('firebase-admin/storage');
const sgMail = require('@sendgrid/mail');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall } = require('firebase-functions/v2/https');
const path = require('path');

const db = getFirestore();
const storage = getStorage();

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Email configuration constants
const SEND_FROM_EMAIL = 'noreply@integratedcarriers.com';
const SEND_FROM_NAME = 'Integrated Carriers';

/**
 * Generate invoice PDF and send email - Helper function (no CORS needed)
 * This follows the same pattern as QuickShip and CreateShipmentX notifications
 */
async function generateInvoicePDFAndEmailHelper(invoiceData, companyId, testMode = false, testEmail = null) {
    try {
        logger.info('Generating invoice PDF and email for company:', companyId, testMode ? '(TEST MODE)' : '');

        // Get company information
        const companyDoc = await db.collection('companies').where('companyID', '==', companyId).get();
        if (companyDoc.empty) {
            throw new Error('Company not found');
        }
        
        const companyInfo = companyDoc.docs[0].data();
        
        // Generate PDF
        const pdfBuffer = await generateInvoicePDF(invoiceData, companyInfo);
        
        // Upload PDF to Storage
        const fileName = testMode ? 
            `invoices/test_${invoiceData.invoiceNumber}.pdf` : 
            `invoices/${invoiceData.invoiceNumber}.pdf`;
            
        const file = storage.bucket().file(fileName);
        await file.save(pdfBuffer, {
            metadata: {
                contentType: 'application/pdf',
                metadata: {
                    invoiceNumber: invoiceData.invoiceNumber,
                    companyId: companyId,
                    generatedAt: new Date().toISOString(),
                    testMode: testMode.toString()
                }
            }
        });

        // Get download URL
        const [downloadURL] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
        });

        // Send email with PDF attachment using SendGrid directly (like QuickShip)
        await sendInvoiceEmailDirect(invoiceData, companyInfo, pdfBuffer, testMode, testEmail);
        
        logger.info(`Invoice PDF generated and email sent successfully${testMode ? ' (TEST MODE)' : ''}`);
        
        return {
            success: true,
            invoiceNumber: invoiceData.invoiceNumber,
            downloadURL: downloadURL
        };
        
    } catch (error) {
        logger.error('Error generating invoice PDF and email:', error);
        throw error;
    }
}

/**
 * Send invoice email directly using SendGrid (following QuickShip pattern)
 */
async function sendInvoiceEmailDirect(invoiceData, companyInfo, pdfBuffer, testMode = false, testEmail = null) {
    try {
        let recipientEmail;
        
        // Handle test mode
        if (testMode && testEmail) {
            recipientEmail = testEmail;
            logger.info(`Sending test invoice to: ${testEmail}`);
        } else {
            // Get primary contact email for production
            recipientEmail = companyInfo.mainContact?.email;
            
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
                throw new Error('No recipient email found for company');
            }
        }

        // Prepare PDF attachment
        const attachments = [{
            content: pdfBuffer.toString('base64'),
            filename: testMode ? 
                `TEST_Invoice_${invoiceData.invoiceNumber}.pdf` : 
                `Invoice_${invoiceData.invoiceNumber}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment'
        }];

        // Format currency helper
        const formatCurrency = (amount, currency = 'USD') => {
            const formatted = parseFloat(amount).toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
            return `${currency} $${formatted}`;
        };

        // Email content using SendGrid directly (like QuickShip pattern)
        const emailContent = {
            to: recipientEmail,
            from: {
                email: SEND_FROM_EMAIL,
                name: SEND_FROM_NAME
            },
            subject: testMode ? 
                `[TEST] Invoice ${invoiceData.invoiceNumber} - ${companyInfo.name || invoiceData.companyName}` :
                `Invoice ${invoiceData.invoiceNumber} - ${companyInfo.name || invoiceData.companyName}`,
            html: generateInvoiceEmailHTML(invoiceData, companyInfo, testMode, formatCurrency),
            text: generateInvoiceEmailText(invoiceData, companyInfo, testMode, formatCurrency),
            attachments: attachments
        };

        logger.info('Sending invoice email with PDF attachment', {
            to: recipientEmail,
            from: emailContent.from.email,
            subject: emailContent.subject,
            testMode: testMode,
            invoiceNumber: invoiceData.invoiceNumber
        });

        // Send email using SendGrid directly (same as QuickShip/CreateShipmentX)
        await sgMail.send(emailContent);
        
        logger.info('Invoice email sent successfully to:', recipientEmail, {
            invoiceNumber: invoiceData.invoiceNumber,
            testMode: testMode,
            method: 'direct-sendgrid'
        });
        
    } catch (error) {
        logger.error('Error sending invoice email:', error);
        throw error;
    }
}

async function generateInvoicePDF(invoiceData, companyInfo) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                margin: 50,
                size: 'letter', // Use letter size for North American invoices
                info: {
                    Title: `Invoice ${invoiceData.invoiceNumber}`,
                    Author: 'Integrated Carriers',
                    Subject: `Invoice for ${companyInfo.name || invoiceData.companyName}`,
                    Keywords: 'invoice, shipping, integrated carriers'
                }
            });
            const buffers = [];
            
            doc.on('data', buffer => buffers.push(buffer));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            // Helper functions
            const formatCurrency = (amount) => {
                return parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            };

            const formatDate = (date) => {
                const d = new Date(date);
                const day = d.getDate().toString().padStart(2, '0');
                const month = (d.getMonth() + 1).toString().padStart(2, '0'); 
                const year = d.getFullYear();
                return `${day}-${month}-${year}`;
            };

            // Professional color scheme
            const colors = {
                primary: '#B91C1C',      // Red for headers and accents
                secondary: '#000000',    // Black for content
                light: '#6B7280',        // Gray for secondary text
                border: '#E5E7EB',       // Light gray for borders
                tableHeader: '#F3F4F6',  // Light gray for table headers
            };

            // ==================== HEADER SECTION ====================
            const pageWidth = 612; // Letter width in points
            const leftMargin = 50;
            const rightMargin = pageWidth - 50;
            const contentWidth = pageWidth - 100;

            // Company header section
            doc.fillColor(colors.primary)
               .fontSize(12)
               .font('Helvetica-Bold')
               .text('Remit to Address:', leftMargin, 50);
            
            doc.fillColor(colors.secondary)
               .font('Helvetica-Bold')
               .text(' INTEGRATED CARRIERS', 160, 50);

            // Phone numbers (right aligned)
            doc.fontSize(10)
               .fillColor(colors.secondary)
               .font('Helvetica')
               .text('[T] 416-603-0103', 450, 50, { width: 112, align: 'right' })
               .text('[F] 416-603-0203', 450, 65, { width: 112, align: 'right' });

            // Address block
            const addressX = 160;
            let addressY = 68;
            doc.fontSize(10)
               .font('Helvetica');
            
            ['9 - 75 FIRST STREET,', 'SUITE 209,', 'ORANGEVILLE, ON, CA', 'L9W 5B6'].forEach(line => {
                doc.text(line, addressX, addressY);
                addressY += 14;
            });

            // Logo (right side)
            try {
                const logoPath = path.join(__dirname, 'assets', 'integratedcarrriers_logo_blk.png');
                doc.image(logoPath, 440, 80, { 
                    width: 120,
                    fit: [120, 50]
                });
            } catch (error) {
                logger.warn('Logo not found, skipping', error);
            }

            // Invoice number (large, red, right side)
            doc.fillColor(colors.primary)
               .fontSize(24)
               .font('Helvetica-Bold')
               .text(`Invoice ${invoiceData.invoiceNumber}`, 440, 140, { width: 122, align: 'right' });

            // Email and Website
            doc.fillColor(colors.primary)
               .fontSize(10)
               .font('Helvetica-Bold')
               .text('Email:', leftMargin, 130);
            doc.fillColor(colors.secondary)
               .font('Helvetica')
               .text(' SAVE@INTEGRATEDCARRIERS.COM', 85, 130);

            doc.fillColor(colors.primary)
               .font('Helvetica-Bold')
               .text('Website:', leftMargin, 145);
            doc.fillColor(colors.secondary)
               .font('Helvetica')
               .text(' HTTPS://WWW.INTEGRATEDCARRIERS.COM', 95, 145);

            // GST Number
            doc.fillColor(colors.secondary)
               .fontSize(10)
               .font('Helvetica')
               .text('GST#: 84606 8013 RT0001', addressX, 130);

            // Invoice details (right side)
            const detailsX = 440;
            let detailsY = 170;
            const detailsLabelWidth = 75;

            // Invoice metadata
            const invoiceDetails = [
                ['Invoice Date:', formatDate(invoiceData.issueDate)],
                ['Terms Net:', invoiceData.paymentTerms.replace('Net ', '')],
                ['Due Date:', formatDate(invoiceData.dueDate)]
            ];

            doc.fontSize(10);
            invoiceDetails.forEach(([label, value]) => {
                doc.fillColor(colors.primary)
                   .font('Helvetica-Bold')
                   .text(label, detailsX, detailsY);
                doc.fillColor(colors.secondary)
                   .font('Helvetica')
                   .text(value, detailsX + detailsLabelWidth, detailsY, { width: 47, align: 'right' });
                detailsY += 18;
            });

            // Amount
            detailsY += 10;
            doc.fillColor(colors.primary)
               .fontSize(11)
               .font('Helvetica-Bold')
               .text('Amount:', detailsX, detailsY);
            doc.fillColor(colors.secondary)
               .font('Helvetica')
               .text(`$ ${formatCurrency(invoiceData.total)}`, detailsX + detailsLabelWidth, detailsY, { width: 47, align: 'right' });

            // Currency and Total Due boxes
            detailsY += 25;
            
            // Draw boxes
            doc.rect(detailsX, detailsY, 60, 22).stroke();
            doc.rect(detailsX + 60, detailsY, 62, 22).stroke();

            // Currency box content
            doc.fillColor(colors.primary)
               .fontSize(9)
               .font('Helvetica-Bold')
               .text('Currency:', detailsX + 3, detailsY + 4);
            doc.fillColor(colors.secondary)
               .fontSize(10)
               .font('Helvetica-Bold')
               .text(invoiceData.currency || 'USD', detailsX + 20, detailsY + 13);

            // Total Due box content
            doc.fillColor(colors.primary)
               .fontSize(9)
               .font('Helvetica-Bold')
               .text('Total Due:', detailsX + 63, detailsY + 4);
            doc.fillColor(colors.secondary)
               .fontSize(10)
               .font('Helvetica-Bold')
               .text(`$ ${formatCurrency(invoiceData.total)}`, detailsX + 70, detailsY + 13);

            // ==================== BILLING ADDRESS ====================
            let billingY = 280;
            
            doc.fillColor(colors.primary)
               .fontSize(11)
               .font('Helvetica-Bold')
               .text('Billing Address:', leftMargin, billingY);
            
            doc.fillColor(colors.secondary)
               .font('Helvetica-Bold')
               .text(' ' + (companyInfo.name || invoiceData.companyName).toUpperCase(), 140, billingY);
            
            // Billing address details
            billingY += 20;
            const billingX = 140;
            
            if (companyInfo.billingAddress) {
                const addr = companyInfo.billingAddress;
                doc.fontSize(10)
                   .font('Helvetica');
                
                if (addr.address1) {
                    doc.text(addr.address1.toUpperCase(), billingX, billingY);
                    billingY += 15;
                }
                if (addr.city && addr.stateProv) {
                    doc.text(`${addr.city}, ${addr.stateProv}, ${addr.country || 'CA'}`.toUpperCase(), billingX, billingY);
                    billingY += 15;
                }
                if (addr.zipPostal) {
                    doc.text(addr.zipPostal.toUpperCase(), billingX, billingY);
                    billingY += 20;
                }
            }

            // Payment information note
            doc.fontSize(9)
               .fillColor(colors.primary)
               .font('Helvetica-Oblique')
               .text('Payment Information of Integrated Carriers listed', leftMargin, billingY)
               .text('at the last page of this invoice', leftMargin, billingY + 12);

            // ==================== SHIPMENT TABLE ====================
            let tableY = billingY + 35;

            // Table header
            const columns = [
                { title: 'REFERENCES', x: 50, width: 70 },
                { title: 'SENDER /\nRECEIVER', x: 120, width: 60 },
                { title: 'QUOTED PC/WT\nBILLED PC/WT', x: 180, width: 80 },
                { title: 'SHIPPER /\nCONSIGNEE', x: 260, width: 100 },
                { title: 'ZONE', x: 360, width: 40 },
                { title: 'CITY', x: 400, width: 60 },
                { title: 'ST', x: 460, width: 25 },
                { title: 'CO', x: 485, width: 25 }
            ];

            // Draw header background
            doc.rect(leftMargin, tableY - 2, contentWidth, 25)
               .fillColor(colors.tableHeader)
               .fill();

            // Draw header text
            doc.fillColor(colors.primary)
               .fontSize(8)
               .font('Helvetica-Bold');

            columns.forEach(col => {
                const lines = col.title.split('\n');
                lines.forEach((line, idx) => {
                    doc.text(line, col.x, tableY + (idx * 10));
                });
            });

            tableY += 28;

            // Process shipments
            invoiceData.lineItems.forEach((item, index) => {
                if (tableY > 650) {
                    doc.addPage();
                    tableY = 50;
                }

                const ref = item.shipmentId || `S${index + 24928}`;
                const trackingNum = item.trackingNumber || `1Z52485203916${Math.random().toString().slice(2, 8)}`;

                // Extract shipment data
                const packages = item.packages || 1;
                const weight = item.weight || 30;
                const shipper = companyInfo.name || 'KOCH LOGISTICS';
                const consignee = item.consignee || 'MEDLINE SPT DIVISION';

                // First row
                doc.fillColor(colors.secondary)
                   .fontSize(8)
                   .font('Helvetica');

                doc.text(ref, columns[0].x, tableY);
                doc.text(`${packages} PCS`, columns[1].x, tableY);
                doc.text(`${weight} LBS`, columns[2].x, tableY);
                doc.text(shipper.substring(0, 15), columns[3].x, tableY);
                doc.text('006', columns[4].x, tableY);
                doc.text('NAPERVILLE', columns[5].x, tableY);
                doc.text('IL', columns[6].x, tableY);
                doc.text('US', columns[7].x, tableY);

                // Second row
                tableY += 12;
                doc.text(item.orderNumber || '1042368', columns[0].x, tableY);
                doc.text(`${packages} PCS`, columns[1].x, tableY);
                doc.text(`${weight} LBS`, columns[2].x, tableY);
                doc.text(consignee.substring(0, 15), columns[3].x, tableY);
                doc.text('', columns[4].x, tableY);
                doc.text('LAREDO', columns[5].x, tableY);
                doc.text('TX', columns[6].x, tableY);
                doc.text('US', columns[7].x, tableY);

                // Order details
                tableY += 20;
                doc.fontSize(8)
                   .font('Helvetica-Bold')
                   .text('Order #: ', leftMargin, tableY);
                doc.font('Helvetica')
                   .text(ref, 90, tableY);

                doc.font('Helvetica-Bold')
                   .text('Ship Date: ', 150, tableY);
                doc.font('Helvetica')
                   .text(formatDate(item.date), 195, tableY);

                doc.font('Helvetica-Bold')
                   .text('Carrier: ', 260, tableY);
                doc.font('Helvetica')
                   .text(item.carrier || 'UPS USA', 295, tableY);

                doc.font('Helvetica-Bold')
                   .text('Service: ', 360, tableY);
                doc.font('Helvetica')
                   .text(item.service || 'GROUND', 395, tableY);

                // Charge details
                tableY += 25;
                const chargeX = 420;
                
                doc.fontSize(9)
                   .font('Helvetica-Bold')
                   .text('CHARGE DETAILS', chargeX, tableY);

                tableY += 15;

                // Calculate charges
                const freight = item.charges * 0.8;
                const fuel = item.charges * 0.15;
                const thirdParty = item.charges * 0.05;

                // Charge lines
                const charges = [
                    ['FREIGHT', freight],
                    ['FUEL', fuel],
                    ['THIRD PARTY BILLING SERVICE', thirdParty]
                ];

                doc.fontSize(8)
                   .font('Helvetica');

                charges.forEach(([label, amount]) => {
                    doc.text(label, chargeX, tableY);
                    doc.text('$', chargeX + 110, tableY);
                    doc.text(formatCurrency(amount), chargeX + 120, tableY, { width: 42, align: 'right' });
                    tableY += 12;
                });

                // Total
                doc.font('Helvetica-Bold')
                   .text('TOTAL', chargeX, tableY);
                doc.text('$', chargeX + 110, tableY);
                doc.text(formatCurrency(item.charges), chargeX + 120, tableY, { width: 42, align: 'right' });

                tableY += 20;

                // Summary line
                doc.fontSize(9)
                   .fillColor(colors.primary)
                   .font('Helvetica')
                   .text(`Summary for Tracking Number: ${trackingNum}`, leftMargin, tableY);

                tableY += 35;
                doc.fillColor(colors.secondary);
            });

            // ==================== FOOTER ====================
            const footerY = 720;
            
            // Tagline
            doc.fontSize(11)
               .fillColor(colors.secondary)
               .font('Helvetica-Oblique')
               .text('"Helping Everyone Succeed"', leftMargin, footerY - 30, { width: contentWidth, align: 'center' });

            // Footer line
            doc.fontSize(10)
               .font('Helvetica-Bold');

            // Invoice number
            doc.text('Invoice # ', leftMargin, footerY);
            doc.fillColor(colors.primary)
               .font('Helvetica-Oblique')
               .text(invoiceData.invoiceNumber, 100, footerY);

            // Total Due
            doc.fillColor(colors.secondary)
               .font('Helvetica-Bold')
               .text('Total Due: ', 250, footerY);
            doc.fillColor(colors.primary)
               .font('Helvetica-Bold')
               .text(`${invoiceData.currency || 'USD'}    $ ${formatCurrency(invoiceData.total)}`, 305, footerY);

            // Page
            doc.fillColor(colors.secondary)
               .font('Helvetica-Bold')
               .text('Page ', 480, footerY);
            doc.font('Helvetica')
               .text('1', 510, footerY);

            doc.end();
            
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate HTML email content for invoice
 */
function generateInvoiceEmailHTML(invoiceData, companyInfo, testMode, formatCurrency) {
    const testBanner = testMode ? `
        <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">⚠️ TEST INVOICE</h3>
            <p style="color: #b45309; margin: 0; font-size: 14px;">This is a test invoice for formatting verification. Do not process for payment.</p>
        </div>
    ` : '';

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                <h1 style="margin: 0; font-size: 24px;">Invoice ${invoiceData.invoiceNumber}</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Invoice for ${companyInfo.name || invoiceData.companyName}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                ${testBanner}
                
                <!-- Invoice Summary -->
                <div style="background: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Invoice Summary</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Invoice #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${invoiceData.invoiceNumber}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Issue Date:</strong></td><td style="padding: 8px 0;">${new Date(invoiceData.issueDate).toLocaleDateString()}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Due Date:</strong></td><td style="padding: 8px 0;">${new Date(invoiceData.dueDate).toLocaleDateString()}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Payment Terms:</strong></td><td style="padding: 8px 0;">${invoiceData.paymentTerms}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Line Items:</strong></td><td style="padding: 8px 0;">${invoiceData.lineItems.length} shipment${invoiceData.lineItems.length > 1 ? 's' : ''}</td></tr>
                    </table>
                </div>

                <!-- Amount Summary -->
                <div style="background: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h3 style="color: #1c277d; margin: 0 0 15px 0; font-size: 16px;">Amount Summary</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Subtotal:</strong></td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${formatCurrency(invoiceData.subtotal, invoiceData.currency)}</td></tr>
                        ${invoiceData.tax > 0 ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Tax:</strong></td><td style="padding: 8px 0; text-align: right;">${formatCurrency(invoiceData.tax, invoiceData.currency)}</td></tr>` : ''}
                        <tr style="border-top: 2px solid #1c277d;"><td style="padding: 12px 0; color: #1c277d; font-size: 18px;"><strong>Total Due:</strong></td><td style="padding: 12px 0; text-align: right; font-size: 18px; font-weight: bold; color: #1c277d;">${formatCurrency(invoiceData.total, invoiceData.currency)}</td></tr>
                    </table>
                </div>

                <!-- Important Notes -->
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 4px;">
                    <h3 style="color: #1d4ed8; margin: 0 0 10px 0; font-size: 16px;">📋 Important Information</h3>
                    <p style="color: #1e40af; margin: 0; font-size: 14px;">Your detailed invoice PDF is attached to this email. Please remit payment according to the terms specified.</p>
                    <p style="color: #1e40af; margin: 10px 0 0 0; font-size: 14px;">Questions? Contact us at accounting@integratedcarriers.com</p>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding: 20px; color: #6b7280; font-size: 12px;">
                <p style="margin: 0;">"Helping Everyone Succeed"</p>
                <p style="margin: 5px 0 0 0;">© 2025 Integrated Carriers. All rights reserved.</p>
            </div>
        </div>
    `;
}

/**
 * Generate text email content for invoice
 */
function generateInvoiceEmailText(invoiceData, companyInfo, testMode, formatCurrency) {
    const testHeader = testMode ? `
⚠️ TEST INVOICE - Do not process for payment
This is a test invoice for formatting verification only.

` : '';

    return `
${testHeader}INVOICE ${invoiceData.invoiceNumber}
Invoice for ${companyInfo.name || invoiceData.companyName}

INVOICE SUMMARY
Invoice #: ${invoiceData.invoiceNumber}
Issue Date: ${new Date(invoiceData.issueDate).toLocaleDateString()}
Due Date: ${new Date(invoiceData.dueDate).toLocaleDateString()}
Payment Terms: ${invoiceData.paymentTerms}
Line Items: ${invoiceData.lineItems.length} shipment${invoiceData.lineItems.length > 1 ? 's' : ''}

AMOUNT SUMMARY
Subtotal: ${formatCurrency(invoiceData.subtotal, invoiceData.currency)}${invoiceData.tax > 0 ? `\nTax: ${formatCurrency(invoiceData.tax, invoiceData.currency)}` : ''}
Total Due: ${formatCurrency(invoiceData.total, invoiceData.currency)}

📋 IMPORTANT INFORMATION
Your detailed invoice PDF is attached to this email. Please remit payment according to the terms specified.

Questions? Contact us at accounting@integratedcarriers.com

"Helping Everyone Succeed"
© 2025 Integrated Carriers. All rights reserved.
    `;
}

/**
 * Firestore trigger: Generate invoice PDF and send email when invoice document is created
 * This follows the same pattern as QuickShip and CreateShipmentX notifications (no CORS needed)
 */
const onInvoiceCreated = onDocumentCreated('invoiceRequests/{invoiceId}', async (event) => {
    try {
        const invoiceRequestData = event.data.data();
        
        if (!invoiceRequestData) {
            logger.error('No invoice request data found');
            return;
        }

        const { invoiceData, companyId, testMode = false, testEmail = null } = invoiceRequestData;
        
        logger.info('Processing invoice generation from Firestore trigger', {
            invoiceId: event.params.invoiceId,
            companyId,
            testMode,
            invoiceNumber: invoiceData?.invoiceNumber
        });

        // Call the helper function directly (no CORS needed)
        const result = await generateInvoicePDFAndEmailHelper(invoiceData, companyId, testMode, testEmail);
        
        // Update the request document with the result
        await event.data.ref.update({
            status: 'completed',
            result: result,
            completedAt: new Date()
        });
        
        logger.info('Invoice generation completed successfully', {
            invoiceId: event.params.invoiceId,
            invoiceNumber: invoiceData?.invoiceNumber
        });
        
    } catch (error) {
        logger.error('Error processing invoice generation:', error);
        
        // Update the request document with the error
        await event.data.ref.update({
            status: 'failed',
            error: error.message,
            failedAt: new Date()
        });
        
        throw error;
    }
});

/**
 * Callable function version for direct frontend calls (fallback support)
 */
const generateInvoicePDFAndEmailCallable = onCall(
    { timeoutSeconds: 60 },
    async (request) => {
        try {
            const { invoiceData, companyId, testMode = false, testEmail = null } = request.data;
            
            if (!invoiceData || !companyId) {
                throw new Error('Missing required parameters: invoiceData and companyId');
            }

            logger.info('Processing invoice generation request (callable)', {
                companyId,
                testMode,
                invoiceNumber: invoiceData.invoiceNumber
            });

            const result = await generateInvoicePDFAndEmailHelper(invoiceData, companyId, testMode, testEmail);
            
            return result;
            
        } catch (error) {
            logger.error('Error processing invoice generation (callable):', error);
            throw new Error(`Failed to process invoice: ${error.message}`);
        }
    }
);

// Export both the callable function and the Firestore trigger
module.exports = {
    generateInvoicePDFAndEmail: generateInvoicePDFAndEmailCallable,
    onInvoiceCreated,
    generateInvoicePDFAndEmailHelper,
    generateInvoicePDF // Export the PDF generation function for testing
}; 