const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// 🧪 TEST INVOICE GENERATION - No Database Changes  
exports.testInvoiceGeneration = functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
            try {
                // Get the authenticated user
                const authHeader = req.headers.authorization;
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }

                const idToken = authHeader.split('Bearer ')[1];
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                
                console.log('🧪 Test Invoice Generation requested by:', decodedToken.email);

                const { 
                    invoiceData, 
                    companyId, 
                    testEmail = 'tyler@tygershark.com',
                    realDataTest = true 
                } = req.body;

                if (!invoiceData || !companyId) {
                    return res.status(400).json({ 
                        error: 'Missing required fields: invoiceData and companyId' 
                    });
                }

                console.log('🧪 Processing test invoice for company:', companyId);
                console.log('📧 Test email will be sent to:', testEmail);
                console.log('📊 Invoice data preview:', {
                    invoiceNumber: invoiceData.invoiceNumber,
                    companyName: invoiceData.companyName,
                    lineItemsCount: invoiceData.lineItems?.length || 0,
                    subtotal: invoiceData.subtotal,
                    total: invoiceData.total,
                    currency: invoiceData.currency,
                    realDataTest: realDataTest
                });

                // Get company data for email template
                const db = admin.firestore();
                const companyDoc = await db.collection('companies').doc(companyId).get();
                const companyData = companyDoc.exists ? companyDoc.data() : null;

                if (!companyData) {
                    console.warn('⚠️ Company data not found for:', companyId);
                }

                // Create test invoice document (with TEST prefix)
                const testInvoiceDoc = {
                    ...invoiceData,
                    invoiceNumber: `TEST-${Date.now()}-${invoiceData.invoiceNumber}`,
                    status: 'test',
                    testMode: true,
                    realDataTest: realDataTest,
                    testRequestedBy: decodedToken.email,
                    testCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    originalInvoiceData: invoiceData,
                    companyData: companyData || { companyName: invoiceData.companyName }
                };

                // Generate HTML email content
                const emailHtml = generateTestInvoiceEmail(testInvoiceDoc, companyData);

                // Send test email using SendGrid
                const sgMail = require('@sendgrid/mail');
                const sendgridApiKey = process.env.SENDGRID_API_KEY;
                
                if (!sendgridApiKey) {
                    console.error('❌ SendGrid API key not configured');
                    return res.status(500).json({ error: 'Email service not configured' });
                }

                sgMail.setApiKey(sendgridApiKey);

                const emailData = {
                    to: testEmail,
                    from: {
                        email: 'noreply@solushipx.com',
                        name: 'SolushipX Testing'
                    },
                    subject: `🧪 TEST INVOICE - ${testInvoiceDoc.invoiceNumber} for ${invoiceData.companyName}`,
                    html: emailHtml,
                    text: generateTestInvoiceTextEmail(testInvoiceDoc)
                };

                await sgMail.send(emailData);

                console.log('✅ Test invoice email sent successfully to:', testEmail);

                // 🔧 CRITICAL: NO DATABASE STATUS CHANGES
                // Unlike real invoice generation, we don't:
                // - Update shipment statuses to 'invoiced'
                // - Create invoice records in the database
                // - Modify charge statuses
                // This is purely for testing email output and data validation

                res.json({
                    success: true,
                    message: `Test invoice sent to ${testEmail}`,
                    testInvoiceNumber: testInvoiceDoc.invoiceNumber,
                    companyName: invoiceData.companyName,
                    lineItemsCount: invoiceData.lineItems?.length || 0,
                    total: invoiceData.total,
                    currency: invoiceData.currency,
                    testMode: true,
                    realDataTest: realDataTest,
                    emailSentTo: testEmail,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Test invoice generation error:', error);
                res.status(500).json({
                    error: 'Test invoice generation failed',
                    details: error.message
                });
            }
        });
    });

function generateTestInvoiceEmail(testInvoiceDoc, companyData) {
    const { invoiceNumber, companyName, lineItems, subtotal, tax, total, currency, paymentTerms } = testInvoiceDoc;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Test Invoice - ${invoiceNumber}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8fafc; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .test-banner { background: #7c3aed; color: white; padding: 15px; text-align: center; font-weight: bold; font-size: 16px; }
        .header { background: #111827; color: white; padding: 30px; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 5px 0 0 0; opacity: 0.8; }
        .invoice-info { padding: 30px; border-bottom: 1px solid #e5e7eb; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .info-section h3 { color: #374151; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-section p { margin: 5px 0; color: #6b7280; }
        .table-container { padding: 0 30px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #f8fafc; padding: 15px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; }
        td { padding: 12px 15px; border-bottom: 1px solid #f1f5f9; }
        tr:hover { background: #f8fafc; }
        .totals { padding: 30px; background: #f8fafc; }
        .totals-table { width: 100%; max-width: 400px; margin-left: auto; }
        .totals-table td { padding: 8px 0; border: none; }
        .totals-table .total-row { font-weight: bold; font-size: 18px; border-top: 2px solid #374151; }
        .footer { padding: 30px; text-align: center; color: #6b7280; font-size: 12px; }
        .currency { font-weight: 600; color: #7c3aed; }
        .test-warning { background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 15px; margin: 20px 30px; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="container">
        <!-- TEST BANNER -->
        <div class="test-banner">
            🧪 THIS IS A TEST INVOICE - NO PAYMENT REQUIRED
        </div>
        
        <!-- HEADER -->
        <div class="header">
            <h1>Invoice ${invoiceNumber}</h1>
            <p>Generated for testing purposes</p>
        </div>
        
        <!-- TEST WARNING -->
        <div class="test-warning">
            <strong>⚠️ Test Invoice Notice:</strong> This is a test invoice generated for validation purposes. 
            No charges are being billed and no database statuses have been modified. This email was sent to 
            tyler@tygershark.com for testing the invoice generation system with real approved charges data.
        </div>
        
        <!-- INVOICE INFO -->
        <div class="invoice-info">
            <div class="info-grid">
                <div class="info-section">
                    <h3>Bill To</h3>
                    <p><strong>${companyName}</strong></p>
                    ${companyData?.address ? `<p>${companyData.address}</p>` : ''}
                    ${companyData?.city ? `<p>${companyData.city}, ${companyData.state || ''} ${companyData.postalCode || ''}</p>` : ''}
                    ${companyData?.phone ? `<p>Phone: ${companyData.phone}</p>` : ''}
                </div>
                <div class="info-section">
                    <h3>Invoice Details</h3>
                    <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Payment Terms:</strong> ${paymentTerms}</p>
                    <p><strong>Currency:</strong> <span class="currency">${currency}</span></p>
                </div>
            </div>
        </div>
        
        <!-- LINE ITEMS -->
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Shipment ID</th>
                        <th>Description</th>
                        <th>Carrier</th>
                        <th>Service Date</th>
                        <th style="text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${lineItems.map(item => `
                        <tr>
                            <td><strong>${item.shipmentId}</strong></td>
                            <td>${item.description}</td>
                            <td>${item.carrier}</td>
                            <td>${new Date(item.date).toLocaleDateString()}</td>
                            <td style="text-align: right;"><span class="currency">${currency} ${item.charges.toFixed(2)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- TOTALS -->
        <div class="totals">
            <table class="totals-table">
                <tr>
                    <td>Subtotal:</td>
                    <td style="text-align: right;"><span class="currency">${currency} ${subtotal.toFixed(2)}</span></td>
                </tr>
                ${tax > 0 ? `
                <tr>
                    <td>Tax:</td>
                    <td style="text-align: right;"><span class="currency">${currency} ${tax.toFixed(2)}</span></td>
                </tr>
                ` : ''}
                <tr class="total-row">
                    <td><strong>Total:</strong></td>
                    <td style="text-align: right;"><strong><span class="currency">${currency} ${total.toFixed(2)}</span></strong></td>
                </tr>
            </table>
        </div>
        
        <!-- FOOTER -->
        <div class="footer">
            <p>This is a test invoice generated by SolushipX for validation purposes.</p>
            <p>Questions about this test? Contact your system administrator.</p>
            <hr style="margin: 20px 0; border: none; height: 1px; background: #e5e7eb;">
            <p>&copy; ${new Date().getFullYear()} SolushipX - Freight Management System</p>
        </div>
    </div>
</body>
</html>`;
}

function generateTestInvoiceTextEmail(testInvoiceDoc) {
    const { invoiceNumber, companyName, lineItems, subtotal, tax, total, currency, paymentTerms } = testInvoiceDoc;
    
    return `
🧪 TEST INVOICE - ${invoiceNumber}

⚠️ THIS IS A TEST INVOICE - NO PAYMENT REQUIRED
This is a test invoice generated for validation purposes.

INVOICE DETAILS:
- Invoice Number: ${invoiceNumber}
- Company: ${companyName}
- Date: ${new Date().toLocaleDateString()}
- Payment Terms: ${paymentTerms}
- Currency: ${currency}

LINE ITEMS:
${lineItems.map(item => 
    `- ${item.shipmentId}: ${item.description} (${item.carrier}) - ${currency} ${item.charges.toFixed(2)}`
).join('\n')}

TOTALS:
Subtotal: ${currency} ${subtotal.toFixed(2)}
${tax > 0 ? `Tax: ${currency} ${tax.toFixed(2)}\n` : ''}Total: ${currency} ${total.toFixed(2)}

This test email was sent to tyler@tygershark.com for system validation.
No database statuses have been modified.

© ${new Date().getFullYear()} SolushipX - Freight Management System
`;
} 