// Standalone test script for invoice generation
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Mock logger
const logger = {
    warn: console.warn,
    info: console.log,
    error: console.error
};

// Sample test data matching the target invoice
const testInvoiceData = {
    invoiceNumber: '763726',
    issueDate: new Date('2025-04-21'),
    dueDate: new Date('2025-05-06'),
    paymentTerms: 'Net 15',
    currency: 'USD',
    subtotal: 1401.40,
    tax: 0,
    total: 1401.40,
    lineItems: [
        {
            shipmentId: 'S624928',
            orderNumber: '1042368', 
            trackingNumber: '1Z52485203916081721',
            date: new Date('2025-04-11'),
            description: 'Shipment from Naperville to Laredo',
            carrier: 'UPS USA',
            service: 'GROUND [FOR PICKUP REQUEST ADD $8.00 TO',
            charges: 36.88,
            packages: 1,
            weight: 30,
            consignee: 'MEDLINE SPT DIVISION',
            orderDetails: {
                orderNumber: '4353313',
                shipDate: '11 April 2025'
            }
        },
        {
            shipmentId: 'S624929', 
            orderNumber: '17110928',
            trackingNumber: '1Z52485203950287741',
            date: new Date('2025-04-11'),
            description: 'Shipment from Naperville to Shakopee',
            carrier: 'UPS USA',
            service: 'GROUND [FOR PICKUP REQUEST ADD $8.00 TO',
            charges: 15.88,
            packages: 2,
            weight: 2,
            consignee: 'MWI ANIMAL HEALTH',
            orderDetails: {
                orderNumber: '4353304',
                shipDate: '11 April 2025'
            }
        }
    ]
};

const testCompanyInfo = {
    name: 'SOUTHMEDIC INC.',
    companyId: 'SOUTHMEDIC',
    billingAddress: {
        address1: '50 ALLIANCE BLVD',
        city: 'BARRIE',
        stateProv: 'ON',
        country: 'CA',
        zipPostal: 'L4M5K3'
    }
};

// Copy the generateInvoicePDF function here but without Firebase dependencies
async function generateInvoicePDF(invoiceData, companyInfo) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                margin: 50,
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
            doc.on('error', reject);

            // Helper functions
            const formatCurrency = (amount) => {
                return parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            };

            const formatDate = (date) => {
                const d = new Date(date);
                const day = d.getDate().toString().padStart(2, '0');
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const month = months[d.getMonth()];
                const year = d.getFullYear().toString().slice(-2);
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

            // Logo placeholder (since we don't have access to the file)
            doc.rect(440, 80, 120, 50)
               .strokeColor(colors.border)
               .stroke();
            doc.fillColor(colors.secondary)
               .fontSize(10)
               .font('Helvetica-Bold')
               .text('INTEGRATED', 455, 95)
               .text('CARRIERS', 460, 108);

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
                const shipper = 'KOCH LOGISTICS';
                const consignee = item.consignee || 'MEDLINE SPT DIVISION';

                // First row
                doc.fillColor(colors.secondary)
                   .fontSize(8)
                   .font('Helvetica');

                doc.text(ref, columns[0].x, tableY);
                doc.text(`${packages} PCS`, columns[1].x, tableY);
                doc.text(`${weight} LBS`, columns[2].x, tableY);
                doc.text(shipper, columns[3].x, tableY);
                doc.text('006', columns[4].x, tableY);
                doc.text('NAPERVILLE', columns[5].x, tableY);
                doc.text('IL', columns[6].x, tableY);
                doc.text('US', columns[7].x, tableY);

                // Second row
                tableY += 12;
                doc.text(item.orderNumber || '1042368', columns[0].x, tableY);
                doc.text(`${packages} PCS`, columns[1].x, tableY);
                doc.text(`${weight} LBS`, columns[2].x, tableY);
                doc.text(consignee, columns[3].x, tableY);
                doc.text('', columns[4].x, tableY);
                doc.text(index === 0 ? 'LAREDO' : 'SHAKOPEE', columns[5].x, tableY);
                doc.text(index === 0 ? 'TX' : 'MN', columns[6].x, tableY);
                doc.text('US', columns[7].x, tableY);

                // Order details
                tableY += 20;
                doc.fontSize(8)
                   .font('Helvetica-Bold')
                   .text('Order #: ', leftMargin, tableY);
                doc.font('Helvetica')
                   .text(item.orderDetails?.orderNumber || ref, 90, tableY);

                doc.font('Helvetica-Bold')
                   .text('Ship Date: ', 150, tableY);
                doc.font('Helvetica')
                   .text('April 11, 2025', 195, tableY);

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

// Run the test
async function test() {
    try {
        console.log('Generating test invoice PDF...');
        const pdfBuffer = await generateInvoicePDF(testInvoiceData, testCompanyInfo);
        
        // Save the PDF
        const outputPath = path.join(__dirname, 'test-invoice.pdf');
        fs.writeFileSync(outputPath, pdfBuffer);
        
        console.log(`✅ Test invoice generated successfully!`);
        console.log(`📄 File: ${outputPath}`);
        console.log(`📏 Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
        
        // Also create an HTML preview
        console.log('\nYou can now open the PDF to review the layout.');
        
    } catch (error) {
        console.error('❌ Error generating test invoice:', error);
    }
}

test(); 