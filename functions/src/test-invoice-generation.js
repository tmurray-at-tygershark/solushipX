// Test script for invoice generation
const path = require('path');
const fs = require('fs');

// Mock the logger
const logger = {
    info: console.log,
    warn: console.warn,
    error: console.error
};

// Import the PDF generation function
const generateInvoicePDF = require('./generateInvoicePDFAndEmail').generateInvoicePDF;

// Sample invoice data
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
            consignee: 'MEDLINE SPT DIVISION'
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
            packages: 1,
            weight: 2,
            consignee: 'MWI ANIMAL HEALTH'
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

async function testGeneratePDF() {
    try {
        console.log('Generating test invoice PDF...');
        
        // Ensure the module exports properly
        const module = require('./generateInvoicePDFAndEmail');
        const generatePDF = module.generateInvoicePDF || module.generateInvoicePDFAndEmail;
        
        if (!generatePDF) {
            throw new Error('PDF generation function not found in module');
        }
        
        const pdfBuffer = await generatePDF(testInvoiceData, testCompanyInfo);
        
        // Save the PDF for inspection
        const outputPath = path.join(__dirname, 'test-invoice.pdf');
        fs.writeFileSync(outputPath, pdfBuffer);
        
        console.log(`Test invoice generated successfully: ${outputPath}`);
        console.log(`File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
        
    } catch (error) {
        console.error('Error generating test invoice:', error);
    }
}

// Run the test
testGeneratePDF(); 