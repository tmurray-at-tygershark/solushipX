const { logger } = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const PDFDocument = require('pdfkit');
const { getStorage } = require('firebase-admin/storage');
const sgMail = require('@sendgrid/mail');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall } = require('firebase-functions/v2/https');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const os = require('os');

const db = getFirestore();
const storage = getStorage();

// ✅ SEQUENTIAL INVOICE NUMBERING SYSTEM
async function getNextInvoiceNumber() {
    const invoiceCounterRef = db.collection('system').doc('invoiceCounter');
    
    try {
        // Use atomic transaction to ensure unique sequential numbers
        const result = await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(invoiceCounterRef);
            
            let currentNumber;
            if (!counterDoc.exists) {
                // Initialize counter starting at 1000000 (first invoice will be 1000001)
                currentNumber = 1000000;
                transaction.set(invoiceCounterRef, { 
                    currentNumber: currentNumber,
                    lastUpdated: FieldValue.serverTimestamp(),
                    createdAt: FieldValue.serverTimestamp()
                });
            } else {
                currentNumber = counterDoc.data().currentNumber || 1000000;
            }
            
            // Increment counter for next use
            const nextNumber = currentNumber + 1;
            transaction.update(invoiceCounterRef, { 
                currentNumber: nextNumber,
                lastUpdated: FieldValue.serverTimestamp()
            });
            
            return nextNumber;
        });
        
        // Format as 7-digit number (pad with leading zeros if needed)
        const formattedNumber = result.toString().padStart(7, '0');
        console.log(`Generated sequential invoice number: ${formattedNumber}`);
        
        return formattedNumber;
    } catch (error) {
        console.error('Error generating sequential invoice number:', error);
        // Fallback to timestamp-based number if sequential fails
        const fallbackNumber = (1000000 + Date.now() % 9000000).toString();
        console.warn(`Using fallback invoice number: ${fallbackNumber}`);
        return fallbackNumber;
    }
}

// Peek next invoice number without reserving (no counter update)
async function getPeekInvoiceNumber() {
    const invoiceCounterRef = db.collection('system').doc('invoiceCounter');
    try {
        const docSnap = await invoiceCounterRef.get();
        const currentNumber = docSnap.exists ? (docSnap.data().currentNumber || 1000000) : 1000000;
        const nextNumber = currentNumber + 1;
        const formattedNumber = nextNumber.toString().padStart(7, '0');
        return formattedNumber;
    } catch (error) {
        console.error('Error peeking sequential invoice number:', error);
        const fallbackNumber = (1000000 + Date.now() % 9000000).toString();
        return fallbackNumber;
    }
}

// Configure SendGrid with fallback to Firebase config
const functions = require('firebase-functions');
const sendgridApiKey = process.env.SENDGRID_API_KEY || functions.config().sendgrid?.api_key;

if (!sendgridApiKey) {
    throw new Error('SendGrid API key not found in environment variables or Firebase config');
}
sgMail.setApiKey(sendgridApiKey);

// Email configuration constants - Updated per billing requirements
// Note: These are now fallbacks - dynamic company data is used when available
const SEND_FROM_EMAIL_FALLBACK = 'ap@integratedcarriers.com';
const SEND_FROM_NAME_FALLBACK = 'Integrated Carriers';

/**
 * Generate invoice PDF and send email - Helper function (no CORS needed)
 * This follows the same pattern as QuickShip and CreateShipmentX notifications
 */
async function generateInvoicePDFAndEmailHelper(invoiceData, companyId, testMode = false, testEmail = null) {
    try {
        // COMPREHENSIVE DEBUG LOGGING
        logger.info('=== INVOICE GENERATION DEBUG START ===');
        logger.info('Raw parameters received:', {
            invoiceData: invoiceData ? 'present' : 'missing',
            companyId: companyId,
            testMode: testMode,
            testModeType: typeof testMode,
            testModeStrictEqual: testMode === true,
            testEmail: testEmail,
            isTestCompany: companyId === 'TEST_COMPANY'
        });
        
        logger.info('Generating invoice PDF and email for company:', companyId, testMode ? '(TEST MODE)' : '');
        logger.info('Test mode parameters:', { testMode, companyId, isTestCompany: companyId === 'TEST_COMPANY' });

        let companyInfo;
        
        // Get company information from database (always use real company data)
        logger.info('Querying database for company:', companyId);
        const companyDoc = await db.collection('companies').where('companyID', '==', companyId).get();
        if (companyDoc.empty) {
            logger.error('Company not found in database:', companyId);
            throw new Error('Company not found');
        }
        companyInfo = companyDoc.docs[0].data();
        logger.info('Company data retrieved from database');
        
        // DEBUG: Log company info structure for invoice logo debugging
        logger.info('🔍 INVOICE LOGO DEBUG - Company data loaded:', {
            companyName: companyInfo?.name,
            hasLogos: !!companyInfo?.logos,
            logoKeys: companyInfo?.logos ? Object.keys(companyInfo.logos) : 'none',
            invoiceLogoUrl: companyInfo?.logos?.invoice,
            invoiceLogoLength: companyInfo?.logos?.invoice?.length || 0,
            startsWithHttp: companyInfo?.logos?.invoice?.startsWith('http') || false
        });
        
        // Get customer billing information for BILL TO section
        let customerBillingInfo = null;
        if (invoiceData.customerId) {
            try {
                logger.info('Loading customer billing info for BILL TO section:', invoiceData.customerId);
                
                // Try direct document lookup first
                let customerDoc = await db.collection('customers').doc(invoiceData.customerId).get();
                
                if (!customerDoc.exists) {
                    // Fallback: query by customerID field
                    const customerQuery = db.collection('customers').where('customerID', '==', invoiceData.customerId).limit(1);
                    const customerSnapshot = await customerQuery.get();
                    
                    if (!customerSnapshot.empty) {
                        customerDoc = customerSnapshot.docs[0];
                    }
                }

                if (customerDoc.exists) {
                    const customerData = customerDoc.data();
                    
                    customerBillingInfo = {
                        companyName: customerData.companyName || customerData.company || customerData.name || '',
                        name: `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim(),
                        address: customerData.address || {},
                        billingAddress: customerData.billingAddress || customerData.address || {},
                        phone: customerData.phone || customerData.contactPhone || '',
                        email: customerData.email || customerData.contactEmail || '',
                        billingPhone: customerData.billingPhone || customerData.phone || '',
                        billingEmail: customerData.billingEmail || customerData.email || ''
                    };
                    
                    logger.info('Customer billing info loaded successfully for BILL TO section');
                } else {
                    logger.warn('Customer not found for BILL TO section:', invoiceData.customerId);
                }
            } catch (error) {
                logger.warn('Error loading customer billing info:', error.message);
            }
        }
        
        // Fallback: use invoice data for BILL TO if no customer found
        if (!customerBillingInfo) {
            logger.info('Using invoice data for BILL TO section (fallback)');
            customerBillingInfo = {
                companyName: invoiceData.companyName || '',
                name: '',
                address: {},
                billingAddress: {},
                phone: '',
                email: '',
                billingPhone: '',
                billingEmail: ''
            };
        }
        
        // Generate PDF with proper data separation
        const pdfBuffer = await generateInvoicePDF(invoiceData, companyInfo, customerBillingInfo);
        
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
            // 🔧 CRITICAL: Invoices are sent to CUSTOMERS, not companies
            // Get customer billing information from approved charges data
            let customerBillingEmail = null;
            
            // First, try to get customer billing email from invoice line items
            if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
                // Look for customer billing information in the line items
                for (const lineItem of invoiceData.lineItems) {
                    if (lineItem.customerBillingEmail) {
                        customerBillingEmail = lineItem.customerBillingEmail;
                        break;
                    }
                }
            }
            
            // If not found in line items, query customers collection directly
            if (!customerBillingEmail && invoiceData.customerId) {
                const customerSnapshot = await db.collection('customers')
                    .doc(invoiceData.customerId)
                    .get();
                
                if (customerSnapshot.exists) {
                    const customerData = customerSnapshot.data();
                    customerBillingEmail = customerData.billingEmail || 
                                        customerData.billing?.email || 
                                        customerData.email;
                }
            }
            
            // Fallback to company billing if customer billing not found (emergency fallback only)
            if (!customerBillingEmail) {
                logger.warn(`No customer billing email found for invoice ${invoiceData.invoiceNumber}, falling back to company billing`);
                customerBillingEmail = companyInfo.billingAddress?.email || companyInfo.mainContact?.email;
                
                // Last resort: get first user's email from the company
                if (!customerBillingEmail) {
                const usersSnapshot = await db.collection('users')
                    .where('companyID', '==', companyInfo.companyID)
                    .limit(1)
                    .get();
                
                if (!usersSnapshot.empty) {
                        customerBillingEmail = usersSnapshot.docs[0].data().email;
                    }
                }
            }
            
            recipientEmail = customerBillingEmail;
            
            if (!recipientEmail) {
                throw new Error(`No customer billing email found for invoice ${invoiceData.invoiceNumber}. Invoices must be sent to customer billing addresses.`);
            }
            
            logger.info(`Invoice ${invoiceData.invoiceNumber} will be sent to customer billing email: ${recipientEmail}`);
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

        // Prepare dynamic company email branding
        const fromEmail = companyInfo?.billingInfo?.accountsReceivable?.email?.[0] || SEND_FROM_EMAIL_FALLBACK;
        const companyDisplayName = companyInfo?.billingInfo?.companyDisplayName || companyInfo?.name || SEND_FROM_NAME_FALLBACK;

        // Email content using SendGrid directly (like QuickShip pattern)
        const emailContent = {
            to: recipientEmail,
            from: {
                email: fromEmail,
                name: companyDisplayName
            },
            subject: testMode ? 
                `[TEST] ${companyDisplayName} - Invoice Notification` :
                `${companyDisplayName} - Invoice Notification`,
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

async function generateInvoicePDF(invoiceData, companyInfo, customerBillingInfo = null) {
    // 🔍 CORE PDF GENERATION DEBUG - This function is called by ALL invoice generation processes
    logger.info('🚀 generateInvoicePDF CALLED - Core PDF generation starting:', {
        hasInvoiceData: !!invoiceData,
        hasCompanyInfo: !!companyInfo,
        hasCustomerBillingInfo: !!customerBillingInfo,
        invoiceNumber: invoiceData?.invoiceNumber,
        companyName: companyInfo?.name,
        customerCompany: customerBillingInfo?.companyName,
        companyLogos: companyInfo?.logos ? Object.keys(companyInfo.logos) : 'none',
        invoiceLogoExists: !!companyInfo?.logos?.invoice,
        invoiceLogoUrl: companyInfo?.logos?.invoice
    });
    
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                margin: 30,
                size: 'letter',
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

            // Page dimensions with reduced margins
            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;
            const margin = 30;
            const contentWidth = pageWidth - (margin * 2);
            const leftCol = margin;
            const rightCol = pageWidth - margin - 160;

            // Professional color scheme
            const colors = {
                primary: '#1e3a8a',
                accent: '#dc2626', 
                text: '#111827',
                textLight: '#6b7280',
                border: '#e5e7eb',
                background: '#f8fafc'
            };

            const formatCurrency = (amount, currency = 'USD') => {
                const formatted = parseFloat(amount || 0).toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                });
                return `${currency} $${formatted}`;
            };

            const formatDate = (date) => {
                try {
                    if (!date) return 'N/A';
                    
                    let dateObj;
                    if (typeof date === 'string') {
                        dateObj = new Date(date);
                    } else if (date.toDate && typeof date.toDate === 'function') {
                        // Firestore Timestamp
                        dateObj = date.toDate();
                    } else if (date.seconds) {
                        // Timestamp object
                        dateObj = new Date(date.seconds * 1000);
                    } else {
                        dateObj = new Date(date);
                    }
                    
                    if (isNaN(dateObj.getTime())) {
                        return 'N/A';
                    }
                    
                    return dateObj.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                } catch (error) {
                    console.error('Date formatting error:', error);
                    return 'N/A';
                }
            };

            // ==================== COMPACT HEADER SECTION ====================
            let currentY = margin;

            // Prepare company billing info for use throughout invoice
            const billingInfo = companyInfo?.billingInfo || {};
            const arContact = billingInfo.accountsReceivable || {};
            const companyDisplayName = billingInfo.companyDisplayName || companyInfo?.name || 'INTEGRATED CARRIERS';

            // Company logo (top right corner) - Use invoice logo if available
            logger.info('🎨 LOGO SECTION DEBUG - Starting logo processing:', {
                hasCompanyInfo: !!companyInfo,
                hasLogos: !!companyInfo?.logos,
                invoiceLogoUrl: companyInfo?.logos?.invoice,
                logoUrlType: typeof companyInfo?.logos?.invoice,
                isString: typeof companyInfo?.logos?.invoice === 'string',
                startsWithHttp: companyInfo?.logos?.invoice?.startsWith('http')
            });
            
            try {
                let logoDisplayed = false;
                
                // Try to use company's invoice logo first - DOWNLOAD LOCALLY for PDFKit
                const invoiceLogoUrl = companyInfo?.logos?.invoice;
                logger.info('🔍 Logo URL check:', { invoiceLogoUrl, exists: !!invoiceLogoUrl, isHttp: invoiceLogoUrl?.startsWith('http') });
                
                if (invoiceLogoUrl && invoiceLogoUrl.startsWith('http')) {
                    try {
                        logger.info('Downloading company invoice logo for PDF generation', { invoiceLogoUrl });
                        
                        // Download logo locally (same as BOL/Carrier Confirmation)
                        
                        const resp = await axios.get(invoiceLogoUrl, { responseType: 'arraybuffer' });
                        const tmpPath = path.join(os.tmpdir(), `invoice_logo_${Date.now()}.png`);
                        fs.writeFileSync(tmpPath, Buffer.from(resp.data));
                        
                        logger.info('Successfully downloaded invoice logo locally', { tmpPath });
                        
                        // Use local path for PDFKit
                        doc.image(tmpPath, rightCol, currentY - 8, {
                            width: 130,
                            fit: [130, 40]
                        });
                        logoDisplayed = true;
                        
                        logger.info('Successfully embedded custom invoice logo');
                    } catch (logoError) {
                        logger.warn('Failed to download/use company invoice logo, falling back to system logo:', logoError.message);
                    }
                } else {
                    logger.warn('🚨 INVOICE LOGO SKIPPED - URL validation failed:', {
                        invoiceLogoUrl,
                        urlExists: !!invoiceLogoUrl,
                        isString: typeof invoiceLogoUrl === 'string',
                        startsWithHttp: invoiceLogoUrl?.startsWith('http'),
                        urlLength: invoiceLogoUrl?.length || 0
                    });
                }
                
                // Fallback to system logo if company logo fails or doesn't exist
                if (!logoDisplayed) {
                    logger.warn('🎯 Using fallback system logo - company logo not displayed');
                    try {
                        const logoPath = path.join(__dirname, 'assets', 'integratedcarrriers_logo_blk.png');
                        doc.image(logoPath, rightCol, currentY - 8, {
                            width: 130,
                            fit: [130, 40]
                        });
                        logger.info('✅ System asset logo displayed successfully');
                    } catch (assetError) {
                        logger.warn('System asset logo failed, using text logo:', assetError.message);
                    }
                }
            } catch (error) {
                logger.warn('Logo not found, creating text logo');
                // Use dynamic company name for text logo
                doc.fillColor(colors.primary)
                   .fontSize(13.5)
                   .font('Helvetica-Bold')
                   .text(companyDisplayName.toUpperCase(), rightCol, currentY - 8, { width: 130, align: 'center' });
            }

            // INVOICE title (left side)
            doc.fillColor(colors.primary)
               .fontSize(17.5)
               .font('Helvetica-Bold')
               .text('INVOICE', leftCol, currentY);

            currentY += 20;

            // Invoice number removed from top-left - now in right-side details box

            // ==================== DYNAMIC COMPANY INFORMATION ====================
            doc.fillColor(colors.text)
               .fontSize(7.5)
               .font('Helvetica-Bold')
               .text(companyDisplayName.toUpperCase(), leftCol, currentY);

            currentY += 10;
            doc.fontSize(6.5)
               .font('Helvetica')
               .fillColor(colors.text);

            // Build dynamic company details from AR contact info
            const companyDetails = [];
            
            // Address information
            if (arContact.address1) {
                companyDetails.push(arContact.address1);
                if (arContact.address2) {
                    companyDetails.push(arContact.address2);
                }
                
                // City, State/Province, Postal Code, Country
                const locationParts = [];
                if (arContact.city) locationParts.push(arContact.city);
                if (arContact.stateProv) locationParts.push(arContact.stateProv);
                if (arContact.zipPostal) locationParts.push(arContact.zipPostal);
                if (arContact.country && arContact.country !== 'CA') {
                    locationParts.push(arContact.country === 'US' ? 'United States' : arContact.country);
                } else if (arContact.country === 'CA' || !arContact.country) {
                    locationParts.push('Canada');
                }
                
                if (locationParts.length > 0) {
                    companyDetails.push(locationParts.join(', '));
                }
            } else {
                // Fallback to hardcoded address if no AR contact address
                companyDetails.push('9 - 75 First Street, Suite 209');
                companyDetails.push('Orangeville, ON L9W 5B6, Canada');
            }
            
            companyDetails.push(''); // Spacing break
            
            // Contact information
            if (arContact.phone) {
                companyDetails.push(`Tel: ${arContact.phone}`);
            } else {
                companyDetails.push('Tel: (416) 603-0103'); // Fallback
            }
            
            // Email - use first AR email or fallback
            if (arContact.email && arContact.email.length > 0) {
                companyDetails.push(`Email: ${arContact.email[0]}`);
            } else {
                companyDetails.push('Email: ar@integratedcarriers.com'); // Fallback
            }
            
            // Website - use company website or fallback
            if (companyInfo?.website) {
                companyDetails.push(`Web: ${companyInfo.website}`);
            } else {
                companyDetails.push('Web: www.integratedcarriers.com'); // Fallback
            }
            
            // Tax number
            if (billingInfo.taxNumber) {
                companyDetails.push(billingInfo.taxNumber);
            } else {
                companyDetails.push('GST#: 84606 8013 RT0001'); // Fallback
            }

            companyDetails.forEach(line => {
                if (line === '') {
                    currentY += 4; // Small spacing break
                } else {
                    doc.text(line, leftCol, currentY);
                    currentY += 8;
                }
            });

            // ==================== INVOICE DETAILS BOX ====================
            const detailsBoxY = margin + 45;
            const detailsBoxWidth = 160;
            const detailsBoxHeight = 78; // Reduced by another 10px for optimal proportions

            // Draw details box
            doc.rect(rightCol, detailsBoxY, detailsBoxWidth, detailsBoxHeight)
               .fillColor(colors.background)
               .fill()
               .strokeColor(colors.border)
               .lineWidth(1)
               .stroke();

            // Details content
            let detailY = detailsBoxY + 8;
            doc.fillColor(colors.text)
               .fontSize(6.5)
               .font('Helvetica-Bold');

            const invoiceDetails = [
                ['Invoice #:', invoiceData.invoiceNumber],
                ['Invoice Date:', formatDate(invoiceData.issueDate || invoiceData.invoiceDate || new Date())],
                ['Due Date:', formatDate(invoiceData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))],
                ['Terms:', 'NET 30'],
                ['Currency:', invoiceData.currency || 'USD']
            ];

            invoiceDetails.forEach(([label, value]) => {
                doc.text(label, rightCol + 8, detailY);
                doc.font('Helvetica')
                   .text(value, rightCol + 60, detailY);
                doc.font('Helvetica-Bold');
                detailY += 13;
            });

            // ==================== BILL TO SECTION WITH SIMPLIFIED INVOICE SUMMARY ====================
            // ✅ DECOUPLED: Independent positioning for BILL TO section (not based on details box)
            const billToY = detailsBoxY + detailsBoxHeight - 15; // Position BILL TO 15px above the bottom of details box (moved up 30px)
            currentY = billToY;

            // Bill To section (left side)
            doc.fillColor(colors.primary)
               .fontSize(8.5)
               .font('Helvetica-Bold')
               .text('BILL TO:', leftCol, currentY);

            // ✅ INVOICE SUMMARY REPOSITIONED: Position below details box to avoid overlap
            const summaryX = rightCol; // Align with details box
            const summaryY = detailsBoxY + detailsBoxHeight + 15; // Position below details box
            doc.fillColor(colors.primary)
               .fontSize(8.5)
               .font('Helvetica-Bold')
               .text('INVOICE TOTAL:', summaryX, summaryY);

            // ✅ FIXED: Proper single line spacing for invoice total
            const totalLabelY = summaryY;
            const totalAmountY = totalLabelY + 12; // ✅ FIXED: Single line spacing (12px down from label)
            doc.fillColor(colors.text)
               .fontSize(11.5)
               .font('Helvetica-Bold')
               .text(`${formatCurrency(invoiceData.total, invoiceData.currency)}`, summaryX, totalAmountY);

            currentY += 10;

            // Customer billing information with complete address (increased spacing)
            // Use customer billing info if provided, otherwise fall back to companyInfo (for backward compatibility)
            const billToInfo = customerBillingInfo || companyInfo;

            // Track start to enforce a minimum section height
            const billToStartY = currentY;

            // Company name (or customer company)
            doc.fillColor(colors.text)
               .fontSize(7.5)
               .font('Helvetica-Bold')
               .text(billToInfo.companyName || billToInfo.name || invoiceData.companyName, leftCol, currentY);

            currentY += 10;
            doc.fontSize(6.5)
               .font('Helvetica');

            // Optional contact name line
            const contactLine = (billToInfo.name && billToInfo.name !== billToInfo.companyName) ? billToInfo.name : '';
            if (contactLine) {
                doc.text(contactLine, leftCol, currentY);
                currentY += 9;
            }

            // Use actual billing address if available, otherwise main address
            const billingAddr = billToInfo.billingAddress || billToInfo.address || {};
            const mainAddr = billToInfo.address || {};

            // Resolve address fields with robust fallbacks
            const street = billingAddr.address1 || billingAddr.addressLine1 || billingAddr.street || mainAddr.address1 || mainAddr.addressLine1 || mainAddr.street;
            const addressLine2 = billingAddr.address2 || billingAddr.addressLine2 || mainAddr.address2 || mainAddr.addressLine2;
            const city = billingAddr.city || mainAddr.city;
            const state = billingAddr.stateProv || billingAddr.state || billingAddr.province || mainAddr.stateProv || mainAddr.state || mainAddr.province;
            const postal = billingAddr.postalCode || billingAddr.zipPostal || billingAddr.postal || billingAddr.zip || mainAddr.postalCode || mainAddr.zipPostal || mainAddr.postal || mainAddr.zip;
            const country = billingAddr.country || mainAddr.country;

            // Street + line2
            if (street) {
                if (addressLine2) {
                    doc.text(`${street}, ${addressLine2}`, leftCol, currentY);
                } else {
                    doc.text(street, leftCol, currentY);
                }
                currentY += 9;
            }

            // City/State/Postal/Country on one line
            if (city || state || postal || country) {
                const postalUpper = postal ? String(postal).toUpperCase() : '';
                const parts = [];
                if (city) parts.push(city);
                if (state) parts.push(state);
                if (postalUpper) parts.push(postalUpper);
                const countryName = country === 'CA' ? 'Canada' : country === 'US' ? 'United States' : (country || '');
                if (countryName) parts.push(countryName);
                if (parts.length > 0) {
                    doc.text(parts.join(', '), leftCol, currentY);
                    currentY += 9;
                }
            }

            // Phone and email from billing or main contact
            const phone = billToInfo.billingPhone || billToInfo.phone || billToInfo.mainContact?.phone;
            if (phone) {
                doc.text(`Phone: ${phone}`, leftCol, currentY);
                currentY += 9;
            }

            const email = billToInfo.billingEmail || billToInfo.email || billToInfo.mainContact?.email;
            if (email) {
                doc.text(`Email: ${email}`, leftCol, currentY);
                currentY += 9;
            }

            // Enforce minimum BILL TO height so layout stays consistent
            // Expected full block: name (10) + contact (9) + street (9) + city/state/postal/country (9) + phone (9) + email (9) ≈ 55-60px
            const minBillToHeight = 60;
            const usedBillToHeight = currentY - billToStartY;
            if (usedBillToHeight < minBillToHeight) {
                currentY = billToStartY + minBillToHeight;
            }

            // Summary information (right side - simplified, moved closer)

            // ==================== SHIPMENT TABLE (WITH ENHANCED SPACING) ====================
            currentY += 10; // ✅ MOVED DOWN 20PX: Changed from -10 to +10 to provide proper spacing below BILL TO section
            console.log('🎯 PDF Generation: Added 10px spacing below BILL TO section, currentY:', currentY);
            const tableStartY = currentY;
            // Column widths: wider origin/destination, narrower fees
            const colWidths = [60, 90, 90, 90, 65, 85, 50]; // ✅ CHANGED: ORIGIN 75→90, DESTINATION 75→90, FEES 115→85
            let colX = leftCol;
            const colPositions = colWidths.map(width => {
                const pos = colX;
                colX += width;
                return pos;
            });

            // Table header
            doc.rect(leftCol, tableStartY, contentWidth, 22)
               .fillColor(colors.primary)
               .fill();

            doc.fillColor('white')
               .fontSize(6.5)
               .font('Helvetica-Bold');

            const headers = ['SHIPMENT ID', 'DETAILS', 'ORIGIN', 'DESTINATION', 'CARRIER & SERVICE', 'FEES', 'TOTAL'];
            headers.forEach((header, i) => {
                doc.text(header, colPositions[i] + 8, tableStartY + 7, { width: colWidths[i] - 16 });
            });

            let tableY = tableStartY + 22 + 6; // Reduced space below headers to match column padding

            // Invoice line items
            invoiceData.lineItems.forEach((item, index) => {
                // ✅ DYNAMIC ROW HEIGHT: Calculate height needed based on content
                let maxColumnHeight = 38; // Reduced minimum row height for space efficiency
                
                // Calculate fees column height (typically the tallest)
                let feesHeight = 12; // Reduced base padding (6px top + 6px bottom)
                if (item.chargeBreakdown && Array.isArray(item.chargeBreakdown) && item.chargeBreakdown.length > 0) {
                    const maxCharges = 5;
                    const sortedCharges = [...item.chargeBreakdown].sort((a, b) => (b.amount || 0) - (a.amount || 0));
                    
                    sortedCharges.slice(0, maxCharges).forEach((fee) => {
                        const chargeCode = fee.code || fee.chargeCode || '';
                        const chargeName = fee.description || fee.name || fee.chargeType || 'Miscellaneous';
                        const amount = fee.amount || 0;
                        const displayText = `${chargeName} - ${formatCurrency(amount, invoiceData.currency)}`;
                        
                        const textHeight = doc.heightOfString(displayText, { 
                            width: colWidths[5] - 16,
                            align: 'left'
                        });
                        feesHeight += Math.max(textHeight + 2, 8);
                    });
                    
                    if (item.chargeBreakdown.length > maxCharges) {
                        feesHeight += 8; // Summary line
                    }
                } else {
                    // Default charge breakdown height
                    const totalCharges = item.charges || 0;
                    if (totalCharges > 0) {
                        feesHeight += (3 * 8); // 3 default charge lines
                    } else {
                        feesHeight += 12; // Single total line
                    }
                }
                
                // ✅ FIXED: Calculate details column height using SAME data as rendering
                // Get ALL reference numbers (same logic as rendering)
                const allReferences = item.allReferenceNumbers || [];
                
                // Fallback to basic references if no comprehensive data
                if (allReferences.length === 0) {
                    const fallbackRefs = item.references || item.orderNumber || '';
                    if (fallbackRefs) {
                        allReferences.push(fallbackRefs);
                    }
                }
                
                const totalWeight = (item.weight || 0) * (item.packages || 1);
                const detailsForHeight = [
                    `Ship Date: ${formatDate(item.date)}`,
                    `Tracking: ${item.trackingNumber || 'TBD'}`,
                    // 🔍 CRITICAL: Use SAME reference logic as rendering
                    allReferences.length > 0 ? `Ref: ${allReferences.join(', ')}` : '',
                    `${item.packages || 1} pcs`,
                    `${totalWeight} ${item.weightUnit || 'lbs'}`
                ].filter(detail => detail);
                
                let calculatedDetailsHeight = 12; // Reduced base padding (6px top + 6px bottom)
                detailsForHeight.forEach(detail => {
                    if (detail && detail.trim()) {
                        const textHeight = doc.heightOfString(detail.trim(), { 
                            width: colWidths[1] - 16 
                        });
                        calculatedDetailsHeight += Math.max(textHeight, 7); // Reduced line spacing for compactness
                    }
                });
                const detailsHeight = calculatedDetailsHeight;
                
                // Use the maximum height among all columns, with reduced minimum for space efficiency
                const rowHeight = Math.max(maxColumnHeight, feesHeight, detailsHeight, 38);
                
                // ✅ PAGINATION: Check if we need a new page for combined invoices
                const pageBottomMargin = 90; // Reserve space for totals and footer (optimized from 150)
                const availableSpace = doc.page.height - pageBottomMargin;
                
                if (tableY + rowHeight > availableSpace) {
                    // Start new page for remaining line items
                    doc.addPage();
                    
                    // Recreate header on new page
                    const newPageStartY = margin + 50; // Leave space for condensed header
                    
                    // Add condensed invoice header
                    doc.fillColor(colors.text)
                       .fontSize(9.5)
                       .font('Helvetica-Bold')
                       .text(`Invoice ${invoiceData.invoiceNumber} (Continued)`, leftCol, margin);
                    
                    // Recreate table header
                    const newTableStartY = newPageStartY;
                    doc.rect(leftCol, newTableStartY, contentWidth, 22)
                       .fillColor(colors.primary)
                       .fill();

                    doc.fillColor('white')
                       .fontSize(6.5)
                       .font('Helvetica-Bold');

                    const headers = ['SHIPMENT ID', 'DETAILS', 'ORIGIN', 'DESTINATION', 'CARRIER & SERVICE', 'FEES', 'TOTAL'];
                    headers.forEach((header, i) => {
                        doc.text(header, colPositions[i] + 8, newTableStartY + 7, { width: colWidths[i] - 16 });
                    });

                    tableY = newTableStartY + 22 + 6;
                }
                
                // Alternate row backgrounds
                if (index % 2 === 1) {
                    doc.rect(leftCol, tableY, contentWidth, rowHeight)
                       .fillColor('#fafafa')
                       .fill();
                }

                // Vertical lines for columns
                doc.strokeColor(colors.border)
                   .lineWidth(0.5);
                colPositions.slice(1).forEach(pos => {
                    doc.moveTo(pos, tableY)
                       .lineTo(pos, tableY + rowHeight)
                       .stroke();
                });

                // Content
                doc.fillColor(colors.text)
                   .fontSize(5.5)
                   .font('Helvetica');

                // Column 1: Shipment ID (top aligned)
                const shipmentRef = item.shipmentId || item.id || 'N/A';
                doc.text(shipmentRef, colPositions[0] + 8, tableY + 6, { 
                    width: colWidths[0] - 16,
                    align: 'left',
                    baseline: 'top'
                });

                // Column 2: Details (Enhanced with ALL reference numbers and ship date)
                // 🔍 ENHANCED: Use already calculated reference numbers and weight
                const shipmentDetails = [
                    `Ship Date: ${formatDate(item.date)}`,
                    `Tracking: ${item.trackingNumber || 'TBD'}`,
                    // 🔍 ENHANCED: Show ALL reference numbers, joined with commas
                    allReferences.length > 0 ? `Ref: ${allReferences.join(', ')}` : '',
                    `${item.packages || 1} pcs`,
                    `${totalWeight} ${item.weightUnit || 'lbs'}`
                ].filter(detail => detail); // Remove empty details
                
                // ✅ FIXED: Use proper text wrapping and height calculation for DETAILS column
                let detailY = tableY + 6;
                shipmentDetails.forEach(detail => {
                    if (detail && detail.trim()) {
                        const textHeight = doc.heightOfString(detail.trim(), { 
                            width: colWidths[1] - 16 
                        });
                        doc.text(detail.trim(), colPositions[1] + 8, detailY, { 
                            width: colWidths[1] - 16,
                            align: 'left',
                            baseline: 'top' 
                        });
                        detailY += Math.max(textHeight, 7); // Reduced line spacing for compactness
                    }
                });

                // Column 3: Origin (with company name and proper spacing)
                let originLines = [];
                if (item.shipFrom) {
                    const from = item.shipFrom;
                    // Add company name first if available
                    if (from.companyName || from.company) {
                        originLines.push(from.companyName || from.company);
                    }
                    // Add street address
                    if (from.street || from.address1) {
                        originLines.push(from.street || from.address1);
                    }
                    // Add city, state, postal
                    const cityLine = `${from.city || ''}, ${from.state || from.stateProv || ''}`;
                    if (cityLine.trim() !== ',') {
                        originLines.push(cityLine);
                    }
                                    if (from.postalCode || from.zipPostal) {
                    const postalCode = from.postalCode || from.zipPostal;
                    originLines.push(postalCode.toString().toUpperCase()); // ✅ NEW: Convert to uppercase
                    }
                } else if (item.description && item.description.includes('from')) {
                    const parts = item.description.split(' from ');
                    if (parts[1] && parts[1].includes(' to ')) {
                        originLines.push(parts[1].split(' to ')[0]);
                    }
                } else if (item.origin) {
                    originLines.push(item.origin);
                }
                
                // ✅ IMPROVED: Display origin with proper text wrapping and height calculation
                if (originLines.length === 0) originLines = ['N/A'];
                let originY = tableY + 6;
                originLines.slice(0, 4).forEach(line => {
                    if (line && line.trim()) {
                        const textHeight = doc.heightOfString(line.trim(), { 
                            width: colWidths[2] - 16 
                        });
                        doc.text(line.trim(), colPositions[2] + 8, originY, { 
                            width: colWidths[2] - 16,
                            align: 'left',
                            baseline: 'top'
                        });
                        originY += Math.max(textHeight, 9); // Use calculated height or minimum 9px
                    }
                });

                // Column 4: Destination (with company name and proper spacing)
                let destLines = [];
                if (item.shipTo) {
                    const to = item.shipTo;
                    // Add company name first if available
                    if (to.companyName || to.company) {
                        destLines.push(to.companyName || to.company);
                    }
                    // Add street address
                    if (to.street || to.address1) {
                        destLines.push(to.street || to.address1);
                    }
                    // Add city, state, postal
                    const cityLine = `${to.city || ''}, ${to.state || to.stateProv || ''}`;
                    if (cityLine.trim() !== ',') {
                        destLines.push(cityLine);
                    }
                                    if (to.postalCode || to.zipPostal) {
                    const postalCode = to.postalCode || to.zipPostal;
                    destLines.push(postalCode.toString().toUpperCase()); // ✅ NEW: Convert to uppercase
                    }
                } else if (item.description && item.description.includes(' to ')) {
                    const parts = item.description.split(' to ');
                    if (parts[1]) {
                        destLines.push(parts[1]);
                    }
                } else if (item.destination) {
                    destLines.push(item.destination);
                }
                
                // ✅ IMPROVED: Display destination with proper text wrapping and height calculation
                if (destLines.length === 0) destLines = ['N/A'];
                let destY = tableY + 6;
                destLines.slice(0, 4).forEach(line => {
                    if (line && line.trim()) {
                        const textHeight = doc.heightOfString(line.trim(), { 
                            width: colWidths[3] - 16 
                        });
                        doc.text(line.trim(), colPositions[3] + 8, destY, { 
                            width: colWidths[3] - 16,
                            align: 'left',
                            baseline: 'top'
                        });
                        destY += Math.max(textHeight, 9); // Use calculated height or minimum 9px
                    }
                });

                // Column 5: Service (Enhanced with carrier name) - Override to Integrated Carriers
                const carrierName = 'Integrated Carriers'; // Override carrier for customer invoices
                const serviceInfo = item.service || 'Standard Ground';
                
                doc.fontSize(5.5)
                   .font('Helvetica-Bold')
                   .text(carrierName, colPositions[4] + 8, tableY + 6, { 
                       width: colWidths[4] - 16,
                       align: 'left',
                       baseline: 'top'
                   });
                
                doc.fontSize(5.5)
                   .font('Helvetica')
                   .text(serviceInfo, colPositions[4] + 8, tableY + 24, { // ✅ CHANGED: From tableY + 18 to tableY + 24 (maintain spacing)
                       width: colWidths[4] - 16,
                       align: 'left',
                       baseline: 'top'
                   });

                // Column 6: Enhanced Fees with Professional Charge Breakdown
                doc.font('Helvetica')
                   .fontSize(5.5); // ✅ CHANGED: Reduced by 1px for compactness
                
                // 🔧 ENHANCED: More comprehensive charge breakdown display with $0.00 filtering
                if (item.chargeBreakdown && Array.isArray(item.chargeBreakdown) && item.chargeBreakdown.length > 0) {
                    let feeY = tableY + 6;
                    let chargesDisplayed = 0;
                    const maxCharges = 5;
                    
                    // ✅ FILTER OUT $0.00 CHARGES AND TRANSACTION FEES from display
                    const nonZeroCharges = item.chargeBreakdown.filter(charge => {
                        const amount = parseFloat(charge.amount) || 0;
                        const description = (charge.description || charge.name || charge.chargeType || '').toLowerCase().trim();
                        
                        // Skip zero amount items
                        if (amount <= 0) return false;
                        
                        // Skip transaction fees
                        if (description.includes('transaction fee')) return false;
                        
                        return true;
                    });
                    
                    // Sort charges by amount (largest first) for better display
                    const sortedCharges = [...nonZeroCharges].sort((a, b) => (b.amount || 0) - (a.amount || 0));
                    
                    sortedCharges.slice(0, maxCharges).forEach((fee, index) => {
                        const chargeCode = fee.code || fee.chargeCode || '';
                        const chargeName = fee.description || fee.name || fee.chargeType || 'Miscellaneous';
                        const amount = fee.amount || 0;
                        
                        // Enhanced display without charge codes - just description and amount
                        const displayText = `${chargeName} - ${formatCurrency(amount, invoiceData.currency)}`;
                        
                        // ✅ FIXED: Calculate actual text height to prevent overlapping
                        const textHeight = doc.heightOfString(displayText, { 
                            width: colWidths[5] - 16,
                            align: 'left'
                        });
                        
                        doc.text(displayText, colPositions[5] + 8, feeY, { 
                            width: colWidths[5] - 16,
                            align: 'left',
                            baseline: 'top'
                        });
                        
                        // ✅ FIXED: Use calculated height + 2px spacing instead of fixed 7px
                        feeY += Math.max(textHeight + 2, 8); // Minimum 8px spacing
                        chargesDisplayed++;
                    });
                    
                    // Show summary if more charges exist (excluding $0.00 charges)
                    if (nonZeroCharges.length > maxCharges) {
                        const remainingCharges = nonZeroCharges.length - maxCharges;
                        const remainingAmount = nonZeroCharges
                            .slice(maxCharges)
                            .reduce((sum, charge) => sum + (charge.amount || 0), 0);
                        
                        const summaryText = `+${remainingCharges} more charges: ${formatCurrency(remainingAmount, invoiceData.currency)}`;
                        
                        doc.fontSize(3.5)
                           .fillColor('#666666')
                           .text(summaryText, colPositions[5] + 8, feeY, { 
                                     width: colWidths[5] - 16,
                                     align: 'left',
                                     baseline: 'top'
                                 });
                    }
                } else {
                    // 🔧 ENHANCED: More realistic default breakdown based on industry standards
                    const totalCharges = item.charges || 0;
                    
                    // Generate realistic charge breakdown
                    const charges = [];
                    if (totalCharges > 0) {
                        // Base freight (70-80% of total)
                        const freightPercent = 0.75;
                        const fuelPercent = 0.15;
                        const accessorialPercent = 0.10;
                        
                        charges.push({
                            code: 'FRT',
                            name: 'Freight Charges',
                            amount: totalCharges * freightPercent
                        });
                        
                        charges.push({
                            code: 'FSC',
                            name: 'Fuel Surcharge',
                            amount: totalCharges * fuelPercent
                        });
                        
                        if (totalCharges * accessorialPercent >= 1) {
                            charges.push({
                                code: 'ACC',
                                name: 'Accessorial Charges',
                                amount: totalCharges * accessorialPercent
                            });
                        }
                    }
                    
                    let feeY = tableY + 6;
                    charges.forEach(charge => {
                        const chargeText = `${charge.code}: ${charge.name} - ${formatCurrency(charge.amount, invoiceData.currency)}`;
                        
                        // ✅ FIXED: Calculate actual text height to prevent overlapping
                        const textHeight = doc.heightOfString(chargeText, { 
                            width: colWidths[5] - 16,
                            align: 'left'
                        });
                        
                        doc.text(chargeText, colPositions[5] + 8, feeY, { 
                                    width: colWidths[5] - 16,
                                    align: 'left',
                                    baseline: 'top'
                                });
                        
                        // ✅ FIXED: Use calculated height + 2px spacing instead of fixed 7px
                        feeY += Math.max(textHeight + 2, 8); // Minimum 8px spacing
                    });
                    
                    // Show total if no detailed breakdown available
                    if (charges.length === 0 && totalCharges > 0) {
                        const totalText = `Total Shipping Charges: ${formatCurrency(totalCharges, invoiceData.currency)}`;
                        
                        // ✅ FIXED: Calculate actual text height to prevent overlapping
                        const textHeight = doc.heightOfString(totalText, { 
                            width: colWidths[5] - 16,
                            align: 'left'
                        });
                        
                        doc.text(totalText, colPositions[5] + 8, feeY, { 
                                    width: colWidths[5] - 16,
                                    align: 'left',
                                    baseline: 'top'
                                });
                        
                        // Update feeY for any subsequent content
                        feeY += Math.max(textHeight + 2, 8); // Minimum 8px spacing
                    }
                }

                // Column 7: Total (top aligned)
                const totalCharges = item.charges || 0;
                doc.fontSize(5.5)
                   .font('Helvetica-Bold')
                   .text(formatCurrency(totalCharges, invoiceData.currency), 
                         colPositions[6] + 8, tableY + 6, { 
                             width: colWidths[6] - 16, 
                             align: 'right',
                             baseline: 'top'
                         });

                // Bottom border
                doc.strokeColor(colors.border)
                   .lineWidth(0.5)
                   .moveTo(leftCol, tableY + rowHeight)
                   .lineTo(leftCol + contentWidth, tableY + rowHeight)
                   .stroke();

                tableY += rowHeight;
            });

            // ==================== ENHANCED TOTALS SECTION WITH BREAKDOWN ====================
            const totalsStartY = tableY + 10;
            const totalsWidth = 180;
            const totalsX = leftCol + contentWidth - totalsWidth;

            // 🍁 ENHANCED: Professional totals breakdown with Quebec tax breakdown support
            let currentTotalY = totalsStartY;
            const lineHeight = 18;
            
            // 🍁 ENHANCED TAX BREAKDOWN: Calculate total lines needed with nested structure
            let totalLines = 2; // Subtotal + Total (minimum)
            let hasQuebecTaxes = false;
            let taxLines = 0;
            
            if (invoiceData.tax && invoiceData.tax > 0) {
                if (invoiceData.taxBreakdown && invoiceData.taxBreakdown.length > 0 && invoiceData.hasQuebecTaxes) {
                    // Enhanced tax breakdown: Total Tax + Individual nested tax lines
                    hasQuebecTaxes = true;
                    taxLines = invoiceData.taxBreakdown.length;
                    totalLines = 1 + 1 + taxLines + 1; // Subtotal + Total Tax + Individual Tax Lines + Total Due
                } else {
                    // Standard tax display: single tax line
                    taxLines = 1;
                    totalLines = 3; // Subtotal + Tax + Total
                }
            }
            
            const totalsHeight = totalLines * lineHeight + 10;

            // Background for totals section
            doc.rect(totalsX, currentTotalY, totalsWidth, totalsHeight)
               .fillColor('#f8f9fa')
               .fill()
               .strokeColor(colors.border)
               .lineWidth(1)
               .stroke();

            // Header
            doc.fillColor(colors.primary)
               .fontSize(7.5)
               .font('Helvetica-Bold')
               .text('AMOUNT DUE', totalsX + 8, currentTotalY + 5);

            currentTotalY += 20;

            // Subtotal line
            doc.fillColor(colors.text)
               .fontSize(6.5)
               .font('Helvetica')
               .text('Subtotal:', totalsX + 8, currentTotalY);
            doc.text(formatCurrency(invoiceData.subtotal || invoiceData.total, invoiceData.currency), 
                     totalsX + 100, currentTotalY, { width: 70, align: 'right' });
            currentTotalY += lineHeight;

            // 🍁 ENHANCED TAX BREAKDOWN: Total Tax with nested individual tax lines
            if (invoiceData.tax && invoiceData.tax > 0) {
                if (hasQuebecTaxes && invoiceData.taxBreakdown && invoiceData.taxBreakdown.length > 0) {
                    // Show "Total Tax:" line first
                    console.log('🍁 Rendering enhanced tax breakdown with Total Tax + nested individual taxes');
                    
                    doc.text('Total Tax:', totalsX + 8, currentTotalY);
                    doc.text(formatCurrency(invoiceData.tax, invoiceData.currency), 
                             totalsX + 100, currentTotalY, { width: 70, align: 'right' });
                    currentTotalY += lineHeight;
                    
                    // Show nested individual tax lines with indentation
                    invoiceData.taxBreakdown.forEach(tax => {
                        if (tax.amount > 0) {
                            doc.text(`  ${tax.label}:`, totalsX + 16, currentTotalY); // 8px additional indent
                            doc.text(formatCurrency(tax.amount, invoiceData.currency), 
                                     totalsX + 100, currentTotalY, { width: 70, align: 'right' });
                            currentTotalY += lineHeight;
                        }
                    });
                } else {
                    // Standard single tax line
                    const taxRate = invoiceData.taxRate || 0;
                    const taxLabel = taxRate > 0 ? `Taxes (${(taxRate * 100).toFixed(1)}%):` : 'Taxes:';
                    
                    doc.text(taxLabel, totalsX + 8, currentTotalY);
                    doc.text(formatCurrency(invoiceData.tax, invoiceData.currency), 
                             totalsX + 100, currentTotalY, { width: 70, align: 'right' });
                    currentTotalY += lineHeight;
                }
            }

            // Total line with emphasis
            doc.rect(totalsX + 5, currentTotalY - 3, totalsWidth - 10, lineHeight)
               .fillColor(colors.primary)
               .fill();

            doc.fillColor('white')
               .fontSize(8.5)
               .font('Helvetica-Bold')
               .text('TOTAL DUE:', totalsX + 8, currentTotalY);
            doc.text(formatCurrency(invoiceData.total, invoiceData.currency), 
                     totalsX + 100, currentTotalY, { width: 70, align: 'right' });

            // Currency notation removed per user request

            // ==================== DYNAMIC PAYMENT INFORMATION ====================
            // Only show payment section if company has configured payment information
            const paymentInfo = companyInfo?.billingInfo?.paymentInformation;
            
            if (paymentInfo && paymentInfo.trim()) {
                logger.info('📝 Rendering dynamic payment information from company billing config');
                
                // ✅ SIMPLE LOGIC: Always start payment info at same position as totals block
                const paymentY = totalsStartY + 5; // Align with "AMOUNT DUE" header position
                logger.info('Positioning payment information alongside totals section');

                // Payment Information Header
                doc.fillColor(colors.primary)
                   .fontSize(7.5)
                   .font('Helvetica-Bold')
                   .text('PAYMENT INFORMATION', leftCol, paymentY);

                let payInfoY = paymentY + 15;
                
                // Render custom payment information with line breaks preserved
                doc.fillColor(colors.text)
                   .fontSize(5.5)
                   .font('Helvetica');

                // Split payment info by lines and render each line
                const paymentLines = paymentInfo.split('\n');
                paymentLines.forEach((line, index) => {
                    if (line.trim() === '') {
                        payInfoY += 4; // Small gap for empty lines
                    } else {
                        // Check if line looks like a section header (all caps or ends with comma)
                        const isHeader = line.trim().toUpperCase() === line.trim() || line.trim().endsWith(',');
                        
                        if (isHeader) {
                            doc.font('Helvetica-Bold');
                        } else {
                            doc.font('Helvetica');
                        }
                        
                        doc.text(line.trim(), leftCol, payInfoY, { width: contentWidth });
                        payInfoY += 8;
                    }
                });
                
                logger.info('✅ Dynamic payment information rendered successfully');
            } else {
                logger.info('📝 No payment information configured - skipping payment section');
            }

            // ==================== FOOTER ====================
            const footerY = pageHeight - margin - 25;

            // Separator line
            doc.strokeColor(colors.border)
               .lineWidth(1)
               .moveTo(leftCol, footerY - 4)
               .lineTo(leftCol + contentWidth, footerY - 4)
               .stroke();

            // Footer content
            doc.fillColor(colors.textLight)
               .fontSize(6.5)
               .font('Helvetica')
               .text('"Helping Everyone Succeed"', leftCol, footerY, { width: contentWidth, align: 'center' });

            doc.fontSize(5.5)
               .text(`Invoice ${invoiceData.invoiceNumber} • Page 1 • Generated ${new Date().toLocaleDateString()}`, 
                     leftCol, footerY + 10, { width: contentWidth, align: 'center' });

            doc.end();
            
        } catch (error) {
            logger.error('Error generating invoice PDF:', error);
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

    // Dynamic company branding
    const companyDisplayName = companyInfo?.billingInfo?.companyDisplayName || companyInfo?.name || 'Integrated Carriers';
    const logoUrl = companyInfo?.logos?.email || companyInfo?.logos?.light || 'https://solushipx.web.app/images/integratedcarrriers_logo_white.png';
    const supportEmail = companyInfo?.billingInfo?.accountsReceivable?.email?.[0] || 'ar@integratedcarriers.com';

    // Format dates - use invoice data dates if available, otherwise use dynamic dates
    const issueDate = invoiceData.issueDate ? new Date(invoiceData.issueDate).toLocaleDateString('en-US') : new Date().toLocaleDateString('en-US');
    const dueDate = invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString('en-US') : new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-US');

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                <img src="${logoUrl}" alt="${companyDisplayName}" style="height: 40px; margin-bottom: 20px; display: block;" />
                <h1 style="margin: 0; font-size: 24px;">Invoice Notification</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Invoice for ${companyInfo.name || invoiceData.companyName}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                ${testBanner}
                
                <!-- Introductory Content -->
                <div style="background: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="color: #1c277d; margin: 0 0 15px 0; font-size: 16px; font-weight: bold;">Thank you for choosing ${companyDisplayName}</p>
                    <p style="color: #333; margin: 0 0 15px 0; font-size: 14px; line-height: 1.5;">Attached you'll find your detailed invoice for recent services. If you have any questions or need support, feel free to reply directly to this email or reach out to our billing team at <a href="mailto:${supportEmail}" style="color: #1c277d;">${supportEmail}</a></p>
                    <p style="color: #333; margin: 0 0 15px 0; font-size: 14px;">We appreciate your business and look forward to serving you again.</p>
                    <p style="color: #1c277d; margin: 0; font-size: 14px; font-weight: bold;">(Invoices Attached)</p>
                </div>

                <!-- Invoice Details -->
                <div style="background: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Issue Date:</strong></td><td style="padding: 8px 0;">${issueDate}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Due Date:</strong></td><td style="padding: 8px 0;">${dueDate}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Payment Terms:</strong></td><td style="padding: 8px 0;">NET 30</td></tr>
                    </table>
                </div>


            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding: 20px; color: #6b7280; font-size: 12px;">
                <p style="margin: 0;">"Helping Everyone Succeed"</p>
                <p style="margin: 5px 0 0 0;">© 2025 ${companyDisplayName}. All rights reserved.</p>
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

    // Dynamic company branding
    const companyDisplayName = companyInfo?.billingInfo?.companyDisplayName || companyInfo?.name || 'Integrated Carriers';
    const supportEmail = companyInfo?.billingInfo?.accountsReceivable?.email?.[0] || 'ar@integratedcarriers.com';

    // Format dates - use invoice data dates if available, otherwise use dynamic dates
    const issueDate = invoiceData.issueDate ? new Date(invoiceData.issueDate).toLocaleDateString('en-US') : new Date().toLocaleDateString('en-US');
    const dueDate = invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString('en-US') : new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-US');

    return `
${testHeader}INVOICE NOTIFICATION
Invoice for ${companyInfo.name || invoiceData.companyName}

Thank you for choosing ${companyDisplayName}

Attached you'll find your detailed invoice for recent services. If you have any questions or need support, feel free to reply directly to this email or reach out to our billing team at ${supportEmail}

We appreciate your business and look forward to serving you again.

(Invoices Attached)

INVOICE DETAILS
Issue Date: ${issueDate}
Due Date: ${dueDate}
Payment Terms: NET 30

"Helping Everyone Succeed"
© 2025 ${companyDisplayName}. All rights reserved.
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
    generateInvoicePDF, // Export the PDF generation function for testing
    getNextInvoiceNumber, // ✅ NEW: Export sequential invoice numbering function
    getPeekInvoiceNumber,
    generateInvoiceEmailHTML,
    generateInvoiceEmailText
}; 