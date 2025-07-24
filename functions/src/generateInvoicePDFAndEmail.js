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

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Email configuration constants - Updated per billing requirements
const SEND_FROM_EMAIL = 'ap@integratedcarriers.com';
const SEND_FROM_NAME = 'Integrated Carriers';

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
        
        // Handle test mode with mock company data - make this check more explicit
        if (testMode === true && companyId === 'TEST_COMPANY') {
            logger.info('✅ USING MOCK COMPANY DATA - Test mode detected correctly');
            // Use mock company data for test mode
            companyInfo = {
                name: 'Tyger Shark Inc',
                companyID: 'TEST_COMPANY',
                address: {
                    street: '123 Business Street, Suite 100',
                    city: 'Toronto',
                    state: 'ON',
                    postalCode: 'M5V 3A8',
                    country: 'Canada'
                },
                phone: '(416) 555-0123',
                email: 'billing@tygershark.com',
                billingAddress: {
                    address1: '123 Business Street, Suite 100',
                    city: 'Toronto',
                    stateProv: 'ON',
                    zipPostal: 'M5V 3A8',
                    country: 'CA',
                    email: 'billing@tygershark.com'
                }
            };
            logger.info('Mock company data created successfully');
        } else {
            logger.info('❌ PRODUCTION MODE - Will query database for company:', companyId);
            logger.info('Why production mode?', {
                testModeCheck: testMode === true,
                companyIdCheck: companyId === 'TEST_COMPANY',
                bothChecks: testMode === true && companyId === 'TEST_COMPANY'
            });
            // Get company information from database for production mode
            const companyDoc = await db.collection('companies').where('companyID', '==', companyId).get();
            if (companyDoc.empty) {
                logger.error('Company not found in database:', companyId);
                throw new Error('Company not found');
            }
            companyInfo = companyDoc.docs[0].data();
            logger.info('Company data retrieved from database');
        }
        
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

        // Email content using SendGrid directly (like QuickShip pattern)
        const emailContent = {
            to: recipientEmail,
            from: {
                email: SEND_FROM_EMAIL,
                name: SEND_FROM_NAME
            },
            subject: testMode ? 
                `[TEST] Integrated Carriers - Invoice Notification` :
                `Integrated Carriers - Invoice Notification`,
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

            // Company logo (top right corner) - MOVED UP 8PX
            try {
                const logoPath = path.join(__dirname, 'assets', 'integratedcarrriers_logo_blk.png');
                doc.image(logoPath, rightCol, currentY - 8, { // ✅ MOVED UP 8PX
                    width: 130,
                    fit: [130, 40]
                });
            } catch (error) {
                logger.warn('Logo not found, creating text logo');
                doc.fillColor(colors.primary)
                   .fontSize(14)
                   .font('Helvetica-Bold')
                   .text('INTEGRATED CARRIERS', rightCol, currentY - 8, { width: 130, align: 'center' }); // ✅ MOVED UP 8PX
            }

            // INVOICE title (left side)
            doc.fillColor(colors.primary)
               .fontSize(18)
               .font('Helvetica-Bold')
               .text('INVOICE', leftCol, currentY);

            currentY += 20;

            // Invoice number (much smaller)
            doc.fillColor(colors.accent)
               .fontSize(9) // Reduced from 12
               .font('Helvetica-Bold')
               .text(`#${invoiceData.invoiceNumber}`, leftCol, currentY);

            currentY += 15; // Reduced spacing

            // ==================== ORGANIZED COMPANY INFORMATION ====================
            doc.fillColor(colors.text)
               .fontSize(8)
               .font('Helvetica-Bold')
               .text('INTEGRATED CARRIERS', leftCol, currentY);

            currentY += 10;
            doc.fontSize(7)
               .font('Helvetica')
               .fillColor(colors.textLight);

            // More organized company details in structured format
            const companyDetails = [
                '9 - 75 First Street, Suite 209',
                'Orangeville, ON L9W 5B6, Canada',
                '',
                'Tel: (416) 603-0103',
                'Email: ap@integratedcarriers.com', // ✅ CHANGED FROM save@ to ap@
                'Web: www.integratedcarriers.com',
                'GST#: 84606 8013 RT0001'
            ];

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
            const detailsBoxHeight = 85;

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
               .fontSize(7)
               .font('Helvetica-Bold');

            const invoiceDetails = [
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
            currentY = Math.max(currentY, detailsBoxY + detailsBoxHeight - 15); // ✅ MOVED UP 20PX: Changed from +5 to -15

            // Bill To section (left side)
            doc.fillColor(colors.primary)
               .fontSize(9)
               .font('Helvetica-Bold')
               .text('BILL TO:', leftCol, currentY);

            // Invoice Summary (moved further right, simplified)
            const summaryX = leftCol + 400; // Moved further right
            doc.fillColor(colors.primary)
               .fontSize(9)
               .font('Helvetica-Bold')
               .text('INVOICE TOTAL:', summaryX, currentY);

            // ✅ FIXED: Proper single line spacing for invoice total
            const totalLabelY = currentY;
            const totalAmountY = totalLabelY + 12; // ✅ FIXED: Single line spacing (12px down from label)
            doc.fillColor(colors.text)
               .fontSize(12)
               .font('Helvetica-Bold')
               .text(`${formatCurrency(invoiceData.total, invoiceData.currency)}`, summaryX, totalAmountY);

            currentY += 10;

            // Customer billing information with complete address (increased spacing)
            doc.fillColor(colors.text)
               .fontSize(8)
               .font('Helvetica-Bold')
               .text(invoiceData.companyName || companyInfo.name, leftCol, currentY);

            currentY += 12; // Increased from 8 to 12
            doc.fontSize(7)
               .font('Helvetica');

            // Use actual billing address if available, otherwise main address
            const billingAddr = companyInfo.billingAddress || companyInfo.address || {};
            const mainAddr = companyInfo.address || {};
            
            // ✅ FIXED: Combine street and suite on one line with comma
            const street = billingAddr.street || billingAddr.address1 || mainAddr.street;
            const addressLine2 = billingAddr.address2 || billingAddr.addressLine2;
            
            if (street) {
                if (addressLine2) {
                    doc.text(`${street}, ${addressLine2}`, leftCol, currentY);
                } else {
                    doc.text(street, leftCol, currentY);
                }
                currentY += 10;
            }

            const city = billingAddr.city || mainAddr.city;
            const state = billingAddr.state || billingAddr.stateProv || mainAddr.state;
            const postal = billingAddr.postalCode || billingAddr.zipPostal || mainAddr.postalCode;
            const country = billingAddr.country || mainAddr.country;
            
            // ✅ FIXED: Combine city, state, postal, country on one line
            if (city && state && postal) {
                const countryName = country === 'CA' ? 'Canada' : country === 'US' ? 'United States' : country;
                if (countryName) {
                    doc.text(`${city}, ${state} ${postal} ${countryName}`, leftCol, currentY);
            } else {
                    doc.text(`${city}, ${state} ${postal}`, leftCol, currentY);
                }
                currentY += 10;
            }

            // Phone and email from billing or main contact
            const phone = companyInfo.billingPhone || companyInfo.phone || companyInfo.mainContact?.phone;
            if (phone) {
                doc.text(`Phone: ${phone}`, leftCol, currentY);
                currentY += 10;
            }

            const email = companyInfo.billingEmail || companyInfo.email || companyInfo.mainContact?.email;
            if (email) {
                doc.text(`Email: ${email}`, leftCol, currentY);
                currentY += 10;
            }

            // Summary information (right side - simplified, moved closer)

            // ==================== SHIPMENT TABLE (WITH ENHANCED SPACING) ====================
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
               .fontSize(7)
               .font('Helvetica-Bold');

            const headers = ['SHIPMENT ID', 'DETAILS', 'ORIGIN', 'DESTINATION', 'CARRIER & SERVICE', 'FEES', 'TOTAL'];
            headers.forEach((header, i) => {
                doc.text(header, colPositions[i] + 3, tableStartY + 7, { width: colWidths[i] - 6 });
            });

            let tableY = tableStartY + 22 + 8; // Added 8px space below headers

            // Invoice line items
            invoiceData.lineItems.forEach((item, index) => {
                // ✅ DYNAMIC ROW HEIGHT: Calculate height needed based on content
                let maxColumnHeight = 45; // Minimum row height
                
                // Calculate fees column height (typically the tallest)
                let feesHeight = 0;
                if (item.chargeBreakdown && Array.isArray(item.chargeBreakdown) && item.chargeBreakdown.length > 0) {
                    const maxCharges = 5;
                    const sortedCharges = [...item.chargeBreakdown].sort((a, b) => (b.amount || 0) - (a.amount || 0));
                    
                    feesHeight += 4; // Initial padding
                    sortedCharges.slice(0, maxCharges).forEach((fee) => {
                        const chargeCode = fee.code || fee.chargeCode || '';
                        const chargeName = fee.description || fee.name || fee.chargeType || 'Miscellaneous';
                        const amount = fee.amount || 0;
                        const displayText = `${chargeName} - ${formatCurrency(amount, invoiceData.currency)}`;
                        
                        const textHeight = doc.heightOfString(displayText, { 
                            width: colWidths[5] - 4,
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
                        feesHeight += 4 + (3 * 8); // 3 default charge lines
                    } else {
                        feesHeight += 12; // Single total line
                    }
                }
                
                // Calculate details column height
                const detailsForHeight = [
                    `Ship Date: ${formatDate(item.date)}`,
                    `Tracking: ${item.trackingNumber || 'TBD'}`,
                    item.references || item.orderNumber || '' ? `Ref: ${item.references || item.orderNumber}` : '',
                    `${item.packages || 1} pcs`,
                    `${(item.weight || 0) * (item.packages || 1)} ${item.weightUnit || 'lbs'}`
                ].filter(detail => detail);
                const detailsHeight = 4 + (detailsForHeight.length * 9);
                
                // Use the maximum height among all columns, with minimum of 45px
                const rowHeight = Math.max(maxColumnHeight, feesHeight, detailsHeight, 45);
                
                // ✅ PAGINATION: Check if we need a new page for combined invoices
                const pageBottomMargin = 150; // Reserve space for totals and footer
                const availableSpace = doc.page.height - pageBottomMargin;
                
                if (tableY + rowHeight > availableSpace) {
                    // Start new page for remaining line items
                    doc.addPage();
                    
                    // Recreate header on new page
                    const newPageStartY = margin + 50; // Leave space for condensed header
                    
                    // Add condensed invoice header
                    doc.fillColor(colors.text)
                       .fontSize(10)
                       .font('Helvetica-Bold')
                       .text(`Invoice ${invoiceData.invoiceNumber} (Continued)`, leftCol, margin);
                    
                    // Recreate table header
                    const newTableStartY = newPageStartY;
                    doc.rect(leftCol, newTableStartY, contentWidth, 22)
                       .fillColor(colors.primary)
                       .fill();

                    doc.fillColor('white')
                       .fontSize(7)
                       .font('Helvetica-Bold');

                    const headers = ['SHIPMENT ID', 'DETAILS', 'ORIGIN', 'DESTINATION', 'CARRIER & SERVICE', 'FEES', 'TOTAL'];
                    headers.forEach((header, i) => {
                        doc.text(header, colPositions[i] + 3, newTableStartY + 7, { width: colWidths[i] - 6 });
                    });

                    tableY = newTableStartY + 22 + 8;
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
                   .fontSize(6)
                   .font('Helvetica');

                // Column 1: Shipment ID (top aligned)
                const shipmentRef = item.shipmentId || item.id || 'N/A';
                doc.text(shipmentRef, colPositions[0] + 2, tableY + 2, { 
                    width: colWidths[0] - 4,
                    align: 'left',
                    baseline: 'top'
                });

                // Column 2: Details (Enhanced with references and ship date)
                const references = item.references || item.orderNumber || '';
                const totalWeight = (item.weight || 0) * (item.packages || 1);
                const shipmentDetails = [
                    `Ship Date: ${formatDate(item.date)}`,
                    `Tracking: ${item.trackingNumber || 'TBD'}`,
                    references ? `Ref: ${references}` : '',
                    `${item.packages || 1} pcs`,
                    `${totalWeight} ${item.weightUnit || 'lbs'}`
                ].filter(detail => detail); // Remove empty details
                
                let detailY = tableY + 2;
                shipmentDetails.forEach(detail => {
                    doc.text(detail, colPositions[1] + 2, detailY, { 
                        width: colWidths[1] - 4,
                        align: 'left',
                        baseline: 'top' 
                    });
                    detailY += 9;
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
                        originLines.push(from.postalCode || from.zipPostal);
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
                let originY = tableY + 2;
                originLines.slice(0, 4).forEach(line => {
                    if (line && line.trim()) {
                        const textHeight = doc.heightOfString(line.trim(), { 
                            width: colWidths[2] - 4 
                        });
                        doc.text(line.trim(), colPositions[2] + 2, originY, { 
                            width: colWidths[2] - 4,
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
                        destLines.push(to.postalCode || to.zipPostal);
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
                let destY = tableY + 2;
                destLines.slice(0, 4).forEach(line => {
                    if (line && line.trim()) {
                        const textHeight = doc.heightOfString(line.trim(), { 
                            width: colWidths[3] - 4 
                        });
                        doc.text(line.trim(), colPositions[3] + 2, destY, { 
                            width: colWidths[3] - 4,
                            align: 'left',
                            baseline: 'top'
                        });
                        destY += Math.max(textHeight, 9); // Use calculated height or minimum 9px
                    }
                });

                // Column 5: Service (Enhanced with carrier name)
                const carrierName = item.carrier || 'Canpar Express';
                const serviceInfo = item.service || 'Standard Ground';
                
                doc.fontSize(6)
                   .font('Helvetica-Bold')
                   .text(carrierName, colPositions[4] + 2, tableY + 2, { 
                       width: colWidths[4] - 4,
                       align: 'left',
                       baseline: 'top'
                   });
                
                doc.fontSize(6)
                   .font('Helvetica')
                   .text(serviceInfo, colPositions[4] + 2, tableY + 18, { // ✅ CHANGED: From tableY + 12 to tableY + 18 (6px more space)
                       width: colWidths[4] - 4,
                       align: 'left',
                       baseline: 'top'
                   });

                // Column 6: Enhanced Fees with Professional Charge Breakdown
                doc.font('Helvetica')
                   .fontSize(6); // ✅ CHANGED: From fontSize(5) to fontSize(6) to match other columns
                
                // 🔧 ENHANCED: More comprehensive charge breakdown display with $0.00 filtering
                if (item.chargeBreakdown && Array.isArray(item.chargeBreakdown) && item.chargeBreakdown.length > 0) {
                    let feeY = tableY + 2;
                    let chargesDisplayed = 0;
                    const maxCharges = 5;
                    
                    // ✅ FILTER OUT $0.00 CHARGES from display
                    const nonZeroCharges = item.chargeBreakdown.filter(charge => {
                        const amount = parseFloat(charge.amount) || 0;
                        return amount > 0;
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
                            width: colWidths[5] - 4,
                            align: 'left'
                        });
                        
                        doc.text(displayText, colPositions[5] + 2, feeY, { 
                            width: colWidths[5] - 4,
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
                        
                        doc.fontSize(4)
                           .fillColor('#666666')
                           .text(summaryText, colPositions[5] + 2, feeY, { 
                                     width: colWidths[5] - 4,
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
                    
                    let feeY = tableY + 2;
                    charges.forEach(charge => {
                        const chargeText = `${charge.code}: ${charge.name} - ${formatCurrency(charge.amount, invoiceData.currency)}`;
                        
                        // ✅ FIXED: Calculate actual text height to prevent overlapping
                        const textHeight = doc.heightOfString(chargeText, { 
                            width: colWidths[5] - 4,
                            align: 'left'
                        });
                        
                        doc.text(chargeText, colPositions[5] + 2, feeY, { 
                                    width: colWidths[5] - 4,
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
                            width: colWidths[5] - 4,
                            align: 'left'
                        });
                        
                        doc.text(totalText, colPositions[5] + 2, feeY, { 
                                    width: colWidths[5] - 4,
                                    align: 'left',
                                    baseline: 'top'
                                });
                        
                        // Update feeY for any subsequent content
                        feeY += Math.max(textHeight + 2, 8); // Minimum 8px spacing
                    }
                }

                // Column 7: Total (top aligned)
                const totalCharges = item.charges || 0;
                doc.fontSize(6)
                   .font('Helvetica-Bold')
                   .text(formatCurrency(totalCharges, invoiceData.currency), 
                         colPositions[6] + 2, tableY + 2, { 
                             width: colWidths[6] - 4, 
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

            // 🔧 ENHANCED: Professional totals breakdown with subtotal, tax, and total
            let currentTotalY = totalsStartY;
            const lineHeight = 18;
            const totalLines = invoiceData.tax && invoiceData.tax > 0 ? 3 : 2; // Subtotal + Tax (if applicable) + Total
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
               .fontSize(8)
               .font('Helvetica-Bold')
               .text('AMOUNT DUE', totalsX + 8, currentTotalY + 5);

            currentTotalY += 20;

            // ✅ LOG TAX SEPARATION STATUS
            console.log(`📊 PDF Totals: Subtotal=$${invoiceData.subtotal || invoiceData.total} Tax=$${invoiceData.tax || 0} Total=$${invoiceData.total} ${invoiceData.tax > 0 ? '✅ TAX SEPARATED' : '❌ NO TAX'}`);
            
            // Subtotal line
            doc.fillColor(colors.text)
               .fontSize(7)
               .font('Helvetica')
               .text('Subtotal:', totalsX + 8, currentTotalY);
            doc.text(formatCurrency(invoiceData.subtotal || invoiceData.total, invoiceData.currency), 
                     totalsX + 100, currentTotalY, { width: 70, align: 'right' });
            currentTotalY += lineHeight;

            // Tax line (if applicable)
            if (invoiceData.tax && invoiceData.tax > 0) {
                const taxRate = invoiceData.taxRate || 0;
                const taxLabel = taxRate > 0 ? `Taxes (${(taxRate * 100).toFixed(1)}%):` : 'Taxes:';
                
                console.log(`💸 Adding tax line to PDF: ${taxLabel} $${invoiceData.tax}`);
                
                doc.text(taxLabel, totalsX + 8, currentTotalY);
                doc.text(formatCurrency(invoiceData.tax, invoiceData.currency), 
                         totalsX + 100, currentTotalY, { width: 70, align: 'right' });
                currentTotalY += lineHeight;
            } else {
                console.log(`❌ No tax line added - invoiceData.tax: ${invoiceData.tax}`);
            }

            // Total line with emphasis
            doc.rect(totalsX + 5, currentTotalY - 3, totalsWidth - 10, lineHeight)
               .fillColor(colors.primary)
               .fill();

            doc.fillColor('white')
               .fontSize(9)
               .font('Helvetica-Bold')
               .text('TOTAL DUE:', totalsX + 8, currentTotalY);
            doc.text(formatCurrency(invoiceData.total, invoiceData.currency), 
                     totalsX + 100, currentTotalY, { width: 70, align: 'right' });

            // Currency notation
            doc.fillColor(colors.textLight)
               .fontSize(6)
               .font('Helvetica')
               .text(`All amounts in ${invoiceData.currency || 'USD'}`, 
                     totalsX + 8, currentTotalY + lineHeight + 5);

            // ==================== ENHANCED PAYMENT INFORMATION ====================
            // ✅ ENSURE PAYMENT INFO ON LAST PAGE: Check if enough space remains
            const paymentSectionHeight = 120; // Estimate height needed for payment information
            const pageBottomMargin = 80; // Space for footer
            const availableSpaceForPayment = doc.page.height - (totalsStartY + 50) - pageBottomMargin;
            
            let paymentY;
            if (availableSpaceForPayment < paymentSectionHeight) {
                // Not enough space, add new page for payment information
                doc.addPage();
                paymentY = margin + 20; // Start near top of new page
                console.log('Added new page for payment information to ensure it appears on last page');
            } else {
                // Enough space on current page
                paymentY = totalsStartY + 50;
            }

            doc.fillColor(colors.primary)
               .fontSize(8)
               .font('Helvetica-Bold')
               .text('PAYMENT INFORMATION', leftCol, paymentY);

            let payInfoY = paymentY + 15;
            doc.fillColor(colors.text)
               .fontSize(6)
               .font('Helvetica');

            // ✅ NEW: Enhanced payment information with E-transfer, EFT, and credit card options
            const paymentSections = [
                {
                    title: 'FOR E-TRANSFER PAYMENT,',
                    content: ['Please send to: ar@integratedcarriers.com']
                },
                {
                    title: 'FOR EFT PAYMENT,',
                    content: [
                        'Bank name: Royal Bank of Canada',
                        'Bank address: 4550 Hurontario St. Mississauga ON L5R 4E4',
                        'Account Name: 6834884 Canada Inc. / Integrated Carriers',
                        '',
                        'Account address: 9 – 75 First Street, Suite 209, Orangeville, ON, L9W 5B6',
                        '',
                        'Bank #: 003  |  Branch Transit #: 03971',
                        'RBC Canadian Account #: 1002567  |  US Account #: 4001947',
                        '',
                        'Payment notice sent to: ar@integratedcarriers.com'
                    ]
                }
            ];

            // Render payment sections in compact format
            paymentSections.forEach((section, sectionIndex) => {
                // Section title
                doc.fillColor(colors.text)
                   .fontSize(6)
                   .font('Helvetica-Bold')
                   .text(section.title, leftCol, payInfoY);
                payInfoY += 10;

                // Section content
                doc.font('Helvetica');
                section.content.forEach(line => {
                    if (line.trim() === '') {
                        payInfoY += 3; // Small gap for empty lines
                    } else {
                        doc.text(line, leftCol + 10, payInfoY, { width: contentWidth - 10 });
                        payInfoY += 7;
                    }
                });

                // Space between sections
                if (sectionIndex < paymentSections.length - 1) {
                payInfoY += 8;
                }
            });

            // Credit card payment notice
            payInfoY += 5;
            doc.fillColor(colors.text)
               .fontSize(6)
               .font('Helvetica')
               .text('We also accept credit card payment with a fee.', leftCol, payInfoY, { width: contentWidth });

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
               .fontSize(7)
               .font('Helvetica')
               .text('"Helping Everyone Succeed"', leftCol, footerY, { width: contentWidth, align: 'center' });

            doc.fontSize(6)
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
    generateInvoicePDF, // Export the PDF generation function for testing
    getNextInvoiceNumber // ✅ NEW: Export sequential invoice numbering function
}; 