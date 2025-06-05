const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const db = admin.firestore();
const storage = admin.storage();

/**
 * Generates a Polaris Transportation Bill of Lading (BOL) PDF document
 * Based on the exact format from Polaris Transportation BOL template
 * @param {Object} request - Firebase function request containing shipment data
 * @returns {Object} - Success/error response with document download URL
 */
const generatePolarisTransportationBOL = onCall(async (request) => {
    try {
        const { shipmentId, firebaseDocId } = request.data;
        
        logger.info('generatePolarisTransportationBOL called with:', { shipmentId, firebaseDocId });
        
        // Validate required parameters
        if (!shipmentId) {
            throw new Error('Shipment ID is required');
        }
        
        if (!firebaseDocId) {
            throw new Error('Firebase document ID is required');
        }
        
        // Get shipment data from Firestore
        const shipmentDoc = await db.collection('shipments').doc(firebaseDocId).get();
        if (!shipmentDoc.exists) {
            throw new Error(`Shipment ${firebaseDocId} not found`);
        }
        
        const shipmentData = shipmentDoc.data();
        logger.info('Retrieved shipment data for BOL generation');
        
        // Extract data for BOL generation
        const bolData = extractBOLData(shipmentData, shipmentId);
        
        // Generate the PDF BOL
        const pdfBuffer = await generateBOLPDF(bolData);
        
        // Store the BOL document
        const documentInfo = await storeBOLDocument(pdfBuffer, shipmentId, firebaseDocId);
        
        logger.info('Polaris Transportation BOL generation completed successfully');
        
        return {
            success: true,
            message: 'Polaris Transportation BOL generated successfully',
            data: {
                ...documentInfo,
                shipmentId: shipmentId,
                firebaseDocId: firebaseDocId
            }
        };
        
    } catch (error) {
        logger.error('Error in generatePolarisTransportationBOL:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
});

/**
 * Extracts and formats data from shipment for BOL generation
 * Enhanced to handle multiple data formats and ensure complete data extraction
 * @param {Object} shipmentData - Firestore shipment document data
 * @param {string} shipmentId - Polaris shipment ID
 * @returns {Object} - Formatted BOL data
 */
function extractBOLData(shipmentData, shipmentId) {
    console.log('extractBOLData: Processing shipment data for BOL');
    
    // Extract addresses - handle multiple possible formats
    const shipFrom = shipmentData.shipFrom || 
                    shipmentData.shipment?.pickup_address || 
                    shipmentData.pickup_address ||
                    shipmentData.Origin;
                    
    const shipTo = shipmentData.shipTo || 
                  shipmentData.shipment?.delivery_address || 
                  shipmentData.delivery_address ||
                  shipmentData.Destination;
    
    // Extract packages - handle multiple possible formats
    const packages = shipmentData.packages || 
                    shipmentData.shipment?.packages || 
                    shipmentData.Items || 
                    shipmentData.packageDetails ||
                    [];
    
    // Extract booking confirmation data
    const booking = shipmentData.carrierBookingConfirmation || 
                   shipmentData.bookingConfirmation ||
                   shipmentData.confirmation ||
                   {};
    
    // Extract reference information with multiple fallbacks
    const referenceNumber = shipmentData.shipmentInfo?.shipperReferenceNumber || 
                          shipmentData.referenceNumber || 
                          shipmentData.shipmentID ||
                          shipmentData.customerReference ||
                          shipmentData.reference ||
                          '';
    
    // Generate BOL number with proper Polaris format
    const bolNumber = booking.orderNumber || 
                     booking.confirmationNumber || 
                     booking.Order_Number ||
                     booking.order_number ||
                     `BOL-${shipmentId}-${Date.now().toString().slice(-6)}`;
    
    // Extract and format ship date
    const shipDate = shipmentData.shipmentInfo?.shipmentDate || 
                    shipmentData.shipmentDate ||
                    booking.shippingDate || 
                    booking.ship_date ||
                    new Date().toISOString().split('T')[0];
    
    const formattedShipDate = new Date(shipDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    // Extract Pro Number (Polaris Order Number)
    const proNumber = booking.orderNumber || 
                     booking.Order_Number ||
                     booking.confirmationNumber ||
                     booking.proNumber ||
                     shipmentId ||
                     '';
    
    // Calculate total weight and piece count
    let totalWeight = 0;
    let totalPieces = 0;
    
    packages.forEach(pkg => {
        const weight = parseFloat(pkg.weight || pkg.reported_weight || pkg.Weight || pkg.packageWeight || 0);
        const quantity = parseInt(pkg.quantity || pkg.PackagingQuantity || pkg.pieces || 1);
        
        totalWeight += weight;
        totalPieces += quantity;
    });
    
    // Extract special instructions from multiple sources
    const specialInstructions = [];
    
    // Add standard Polaris Transportation instructions
    specialInstructions.push('BROKER IS CUSTOMS QUOTE.');
    specialInstructions.push('EMAIL DOCS@CUSTOMSQUOTE.COM');
    specialInstructions.push('Questions or issues with shipment call 416-503-0103');
    
    // Add pickup special instructions if available
    const pickupInstructions = shipmentData.shipmentInfo?.pickupSpecialInstructions ||
                              shipmentData.pickup_instructions ||
                              shipmentData.specialInstructions?.pickup;
    if (pickupInstructions && pickupInstructions.trim()) {
        specialInstructions.push(`PICKUP: ${pickupInstructions}`);
    }
    
    // Add delivery special instructions if available
    const deliveryInstructions = shipmentData.shipmentInfo?.deliverySpecialInstructions ||
                                shipmentData.delivery_instructions ||
                                shipmentData.specialInstructions?.delivery;
    if (deliveryInstructions && deliveryInstructions.trim()) {
        specialInstructions.push(`DELIVERY: ${deliveryInstructions}`);
    }
    
    // Add any general special instructions
    const generalInstructions = shipmentData.specialInstructions?.general ||
                               shipmentData.generalInstructions ||
                               shipmentData.notes;
    if (generalInstructions && generalInstructions.trim()) {
        specialInstructions.push(generalInstructions);
    }
    
    return {
        // Header Information
        bolNumber: bolNumber,
        shipDate: formattedShipDate,
        carrier: 'POLARIS TRANSPORTATION GROUP',
        proNumber: proNumber,
        customerRef: referenceNumber,
        
        // Ship From Information - Enhanced extraction
        shipFrom: {
            company: shipFrom?.name || shipFrom?.company || shipFrom?.Company || 'Unknown Shipper',
            contact: shipFrom?.contact || shipFrom?.attention || shipFrom?.contactName || '',
            address1: shipFrom?.address_line_1 || shipFrom?.street || shipFrom?.addressLine1 || shipFrom?.address1 || '',
            address2: shipFrom?.address_line_2 || shipFrom?.street2 || shipFrom?.addressLine2 || shipFrom?.address2 || '',
            city: shipFrom?.city || shipFrom?.City || '',
            state: shipFrom?.province || shipFrom?.state || shipFrom?.State || '',
            zip: shipFrom?.postal_code || shipFrom?.postalCode || shipFrom?.zip || shipFrom?.PostalCode || '',
            phone: shipFrom?.phone || shipFrom?.Phone || shipFrom?.contactPhone || '',
            openTime: shipmentData.shipmentInfo?.earliestPickup || '09:00',
            closeTime: shipmentData.shipmentInfo?.latestPickup || '17:00'
        },
        
        // Ship To Information - Enhanced extraction
        shipTo: {
            company: shipTo?.name || shipTo?.company || shipTo?.Company || 'Unknown Consignee',
            contact: shipTo?.contact || shipTo?.attention || shipTo?.contactName || '',
            address1: shipTo?.address_line_1 || shipTo?.street || shipTo?.addressLine1 || shipTo?.address1 || '',
            address2: shipTo?.address_line_2 || shipTo?.street2 || shipTo?.addressLine2 || shipTo?.address2 || '',
            city: shipTo?.city || shipTo?.City || '',
            state: shipTo?.province || shipTo?.state || shipTo?.State || '',
            zip: shipTo?.postal_code || shipTo?.postalCode || shipTo?.zip || shipTo?.PostalCode || '',
            phone: shipTo?.phone || shipTo?.Phone || shipTo?.contactPhone || ''
        },
        
        // Third Party Billing (SolushipX - Integrated Carriers)
        thirdParty: {
            company: 'SOLUSHIPX - INTEGRATED CARRIERS',
            address1: '9 - 75 FIRST STREET,',
            address2: 'SUITE 209,',
            city: 'Orangeville',
            state: 'ON',
            zip: 'L9W 5B6',
            accountNumber: '000605'
        },
        
        // Package Information - Enhanced mapping
        packages: packages.map((pkg, index) => {
            const weight = parseFloat(pkg.weight || pkg.reported_weight || pkg.Weight || pkg.packageWeight || 0);
            const length = pkg.length || pkg.Length || pkg.dimensions?.length || 48;
            const width = pkg.width || pkg.Width || pkg.dimensions?.width || 40;
            const height = pkg.height || pkg.Height || pkg.dimensions?.height || 48;
            
            return {
                type: pkg.packageType || pkg.type || 'PALLET', // Default to PALLET for LTL
                weight: weight,
                description: pkg.description || 
                           pkg.commodity_description || 
                           pkg.Description || 
                           pkg.itemDescription ||
                           pkg.commodityDescription ||
                           'General Freight',
                dimensions: `${length} x ${width} x ${height}`,
                freightClass: pkg.freightClass || 
                            pkg.FreightClass || 
                            pkg.freight_class ||
                            pkg.class ||
                            ''
            };
        }),
        
        // Totals
        totalPieces: totalPieces,
        totalWeight: totalWeight,
        
        // Special Instructions
        specialInstructions: specialInstructions,
        
        // Store complete shipment data for reference
        shipmentData: shipmentData
    };
}

/**
 * Generates the BOL PDF document using PDFKit with exact positioning
 * @param {Object} bolData - Formatted BOL data
 * @returns {Buffer} - PDF buffer
 */
async function generateBOLPDF(bolData) {
    return new Promise((resolve, reject) => {
        try {
            // Create PDF document (Letter size: 612 x 792 points) with no margins for exact positioning
            const doc = new PDFDocument({
                size: 'letter',
                margin: 0,
                info: {
                    Title: `BOL ${bolData.bolNumber} - Polaris Transportation`,
                    Author: 'Integrated Carriers SoluShip',
                    Subject: 'Bill of Lading',
                    Keywords: 'BOL, Bill of Lading, Polaris Transportation, Freight'
                }
            });
            
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);
            
            // Build the BOL document with exact positioning
            buildExactBOLDocument(doc, bolData);
            
            // Finalize the PDF
            doc.end();
            
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Builds the complete BOL document with exact pixel positioning to match original format
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {Object} bolData - BOL data
 */
function buildExactBOLDocument(doc, bolData) {
    // Set default stroke and fill colors
    doc.strokeColor('#000000').fillColor('#000000');
    
    // Main container border (full page border)
    doc.lineWidth(2)
       .rect(20, 20, 572, 752)
       .stroke();
    
    // Header Section (Y: 20-100)
    drawExactHeader(doc, bolData);
    
    // Ship From/To Section (Y: 100-260)
    drawExactShippingSection(doc, bolData);
    
    // Third Party Billing Section (Y: 260-340)
    drawExactThirdPartySection(doc, bolData);
    
    // Special Instructions Section (Y: 340-400)
    drawExactSpecialInstructions(doc, bolData);
    
    // Freight Table Section (Y: 400-540)
    drawExactFreightTable(doc, bolData);
    
    // Value Declaration Section (Y: 540-590)
    drawExactValueDeclaration(doc, bolData);
    
    // Trailer Information Section (Y: 590-640)
    drawExactTrailerSection(doc, bolData);
    
    // Signature Section (Y: 640-752)
    drawExactSignatureSection(doc, bolData);
    
    // Legal disclaimer at bottom
    drawExactLegalDisclaimer(doc);
}

/**
 * Draws the exact header section matching the original BOL with SolushipX branding
 */
function drawExactHeader(doc, bolData) {
    // Company logo area (top-left) - REMOVED BOX around logo
    // Load and embed SolushipX logo image
    try {
        const logoPath = path.join(__dirname, '../../assets/SolushipX_black.png');
        if (fs.existsSync(logoPath)) {
            // Embed the actual logo image WITHOUT border box
            doc.image(logoPath, 35, 30, {
                width: 150,
                height: 60,
                fit: [150, 60],
                align: 'left',
                valign: 'center'
            });
        } else {
            // Fallback to text if image not found
            doc.font('Helvetica-Bold')
               .fontSize(16) // Reduced from 20
               .fillColor('#000000')
               .text('SolushipX', 35, 40);
            
            // Add registered trademark symbol
            doc.fontSize(6) // Reduced from 8
               .text('®', 135, 35);
            
            // Company subtitle
            doc.font('Helvetica')
               .fontSize(8) // Reduced from 10
               .text('INTEGRATED CARRIERS', 35, 60)
               .fontSize(7) // Reduced from 8
               .text('Freight Logistics & Transportation', 35, 72);
        }
    } catch (error) {
        console.error('Error loading logo image:', error);
        // Fallback to text-based logo
        doc.font('Helvetica-Bold')
           .fontSize(16) // Reduced from 20
           .fillColor('#000000')
           .text('SolushipX', 35, 40);
        
        // Add registered trademark symbol
        doc.fontSize(6) // Reduced from 8
           .text('®', 135, 35);
        
        // Company subtitle
        doc.font('Helvetica')
           .fontSize(8) // Reduced from 10
           .text('INTEGRATED CARRIERS', 35, 60)
           .fontSize(7) // Reduced from 8
           .text('Freight Logistics & Transportation', 35, 72);
    }
    
    // Professional accent line under logo area
    doc.strokeColor('#000000')
       .lineWidth(2)
       .moveTo(35, 83) // Adjusted position
       .lineTo(170, 83)
       .stroke();
    
    // Title section (top-right) - FIXED SIZE AND POSITIONING
    doc.font('Helvetica-Bold')
       .fontSize(12) // Reduced from 18 to prevent overflow
       .fillColor('#000000')
       .text('LTL Bill of Lading- Not Negotiable', 300, 30, { // Adjusted positioning
           width: 180, // Reduced width
           align: 'center'
       });
    
    // BOL Number box with enhanced styling - REPOSITIONED
    doc.lineWidth(1)
       .rect(420, 50, 140, 20) // Adjusted size and position
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(8) // Reduced from 10
       .text('BOL Number:', 425, 55)
       .fontSize(10) // Reduced from 12
       .fillColor('#000000')
       .text(bolData.bolNumber, 425, 65);
    
    // Horizontal separator line
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(25, 100)
       .lineTo(587, 100)
       .stroke();
}

/**
 * Draws the exact shipping addresses section
 */
function drawExactShippingSection(doc, bolData) {
    // Ship From section (left column)
    doc.lineWidth(1)
       .rect(25, 100, 280, 80)
       .stroke();
    
    // Ship From header
    doc.font('Helvetica-Bold')
       .fontSize(8) // Reduced from 10
       .fillColor('#FFFFFF')
       .rect(25, 100, 280, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('SHIP FROM', 30, 105);
    
    // Ship From content - REDUCED FONT SIZES
    doc.fillColor('#000000')
       .font('Helvetica')
       .fontSize(7) // Reduced from 9
       .text(bolData.shipFrom.company, 30, 118)
       .text(`Contact: ${bolData.shipFrom.contact}`, 30, 128)
       .text(bolData.shipFrom.address1, 30, 138)
       .text(bolData.shipFrom.address2 || '', 30, 148)
       .text(`${bolData.shipFrom.city}, ${bolData.shipFrom.state} ${bolData.shipFrom.zip}`, 30, 158);
    
    // Ship From timing
    doc.text(`Open: ${bolData.shipFrom.openTime}`, 200, 118)
       .text(`Close: ${bolData.shipFrom.closeTime}`, 200, 128)
       .text(`Phone: ${bolData.shipFrom.phone}`, 200, 138);
    
    // Ship date and carrier info (right side of Ship From) - REDUCED FONT SIZES
    doc.font('Helvetica-Bold')
       .fontSize(7) // Reduced from 9
       .text('Ship Date:', 320, 118)
       .font('Helvetica')
       .text(bolData.shipDate, 370, 118);
    
    doc.font('Helvetica-Bold')
       .text('Carrier:', 320, 128)
       .font('Helvetica')
       .fontSize(6) // Reduced from 8
       .text(bolData.carrier, 370, 128, { width: 200 });
    
    doc.font('Helvetica-Bold')
       .fontSize(7) // Reduced from 9
       .text('Pro Number:', 320, 145)
       .font('Helvetica')
       .text(bolData.proNumber, 390, 145);
    
    // Ship To section
    doc.lineWidth(1)
       .rect(25, 180, 280, 80)
       .stroke();
    
    // Ship To header
    doc.font('Helvetica-Bold')
       .fontSize(8) // Reduced from 10
       .fillColor('#FFFFFF')
       .rect(25, 180, 280, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('SHIP TO', 30, 185);
    
    // Ship To content - FIXED FORMATTING AND REDUCED FONT SIZES
    doc.fillColor('#000000')
       .font('Helvetica')
       .fontSize(7) // Reduced from 9
       .text(bolData.shipTo.company, 30, 198)
       .text(`Contact: ${bolData.shipTo.contact}`, 30, 208);
    
    // FIXED: Properly format address without unnecessary spaces/breaks
    let addressY = 218;
    if (bolData.shipTo.address1) {
        doc.text(bolData.shipTo.address1, 30, addressY);
        addressY += 10;
    }
    if (bolData.shipTo.address2 && bolData.shipTo.address2.trim()) {
        doc.text(bolData.shipTo.address2, 30, addressY);
        addressY += 10;
    }
    doc.text(`${bolData.shipTo.city}, ${bolData.shipTo.state} ${bolData.shipTo.zip}`, 30, addressY);
    
    // References section (right column)
    doc.lineWidth(1)
       .rect(305, 180, 282, 80)
       .stroke();
    
    // References header
    doc.font('Helvetica-Bold')
       .fontSize(8) // Reduced from 10
       .fillColor('#FFFFFF')
       .rect(305, 180, 282, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('REFERENCES', 310, 185);
    
    // References content - REDUCED FONT SIZES
    doc.fillColor('#000000')
       .font('Helvetica-Bold')
       .fontSize(7) // Reduced from 9
       .text('BOL #:', 310, 200)
       .font('Helvetica')
       .text(bolData.bolNumber, 350, 200);
    
    doc.font('Helvetica-Bold')
       .text('Customer Ref #:', 310, 215)
       .font('Helvetica')
       .text(bolData.customerRef, 390, 215);
    
    doc.font('Helvetica-Bold')
       .text('P.O. Number:', 310, 230)
       .font('Helvetica')
       .text('', 380, 230); // Will be populated from shipment data
}

/**
 * Draws the exact third party billing section
 */
function drawExactThirdPartySection(doc, bolData) {
    // Third party billing section
    doc.lineWidth(1)
       .rect(25, 260, 562, 80)
       .stroke();
    
    // Third party header
    doc.font('Helvetica-Bold')
       .fontSize(8) // Reduced from 10
       .fillColor('#FFFFFF')
       .rect(25, 260, 562, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('THIRD PARTY FREIGHT CHARGES BILLED TO', 30, 265);
    
    // Third party content
    doc.fillColor('#000000')
       .font('Helvetica')
       .fontSize(7) // Reduced from 9
       .text(bolData.thirdParty.company, 30, 280)
       .text(bolData.thirdParty.address1, 30, 290)
       .text(bolData.thirdParty.address2, 30, 300)
       .text(`${bolData.thirdParty.city}, ${bolData.thirdParty.state} ${bolData.thirdParty.zip}`, 30, 310);
    
    // Account number (right side)
    doc.font('Helvetica-Bold')
       .fontSize(7) // Reduced from 9
       .text('Account Number:', 400, 280)
       .font('Helvetica')
       .text(bolData.thirdParty.accountNumber, 490, 280);
    
    // Check boxes for freight terms
    const checkBoxY = 300;
    doc.font('Helvetica')
       .fontSize(6) // Reduced from 8
       .text('Freight Charges are:', 400, checkBoxY);
    
    // Draw checkboxes
    doc.rect(400, checkBoxY + 12, 6, 6).stroke() // Reduced size
       .text('Prepaid', 410, checkBoxY + 14);
    
    doc.rect(450, checkBoxY + 12, 6, 6).stroke()
       .text('Collect', 460, checkBoxY + 14);
    
    doc.rect(500, checkBoxY + 12, 6, 6).stroke()
       .text('3rd Party', 510, checkBoxY + 14);
}

/**
 * Draws the exact special instructions section
 */
function drawExactSpecialInstructions(doc, bolData) {
    // Special instructions section
    doc.lineWidth(1)
       .rect(25, 340, 562, 60)
       .stroke();
    
    // Special instructions header
    doc.font('Helvetica-Bold')
       .fontSize(8) // Reduced from 10
       .fillColor('#FFFFFF')
       .rect(25, 340, 562, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('SPECIAL INSTRUCTIONS', 30, 345);
    
    // Special instructions content
    doc.fillColor('#000000')
       .font('Helvetica')
       .fontSize(6); // Reduced from 8
    
    let textY = 355; // Adjusted
    bolData.specialInstructions.forEach((instruction, index) => {
        doc.text(instruction, 30, textY);
        textY += 10; // Reduced spacing
    });
}

/**
 * Draws the exact freight table section
 */
function drawExactFreightTable(doc, bolData) {
    const tableStartY = 400;
    const tableWidth = 562;
    const rowHeight = 18; // Reduced from 20
    
    // Column definitions with exact widths
    const columns = [
        { header: 'PACKAGE\nQUANTITY', width: 60, align: 'center' },
        { header: 'PACKAGE\nTYPE', width: 60, align: 'center' },
        { header: 'WEIGHT\n(LBS)', width: 60, align: 'center' },
        { header: 'H/M', width: 40, align: 'center' },
        { header: 'COMMODITY DESCRIPTION', width: 220, align: 'left' },
        { header: 'DIMENSIONS\nL x W x H', width: 80, align: 'center' },
        { header: 'CLASS', width: 42, align: 'center' }
    ];
    
    // Draw table border
    doc.lineWidth(1)
       .rect(25, tableStartY, tableWidth, 120) // Reduced height from 140
       .stroke();
    
    // Draw table header
    doc.font('Helvetica-Bold')
       .fontSize(6) // Reduced from 8
       .fillColor('#FFFFFF')
       .rect(25, tableStartY, tableWidth, 20) // Reduced from 25
       .fill('#000000');
    
    let xPos = 25;
    columns.forEach(col => {
        doc.fillColor('#FFFFFF')
           .text(col.header, xPos + 2, tableStartY + 3, { // Adjusted positioning
               width: col.width - 4,
               align: col.align,
               height: 16 // Reduced from 20
           });
        
        // Draw column separators
        if (xPos > 25) {
            doc.strokeColor('#FFFFFF')
               .lineWidth(1)
               .moveTo(xPos, tableStartY)
               .lineTo(xPos, tableStartY + 20) // Adjusted
               .stroke();
        }
        
        xPos += col.width;
    });
    
    // Draw column separators for data rows
    doc.strokeColor('#000000')
       .lineWidth(0.5);
    
    xPos = 25;
    columns.forEach((col, index) => {
        if (index > 0) {
            doc.moveTo(xPos, tableStartY + 20) // Adjusted
               .lineTo(xPos, tableStartY + 120) // Adjusted
               .stroke();
        }
        xPos += col.width;
    });
    
    // Draw data rows
    doc.fillColor('#000000')
       .font('Helvetica')
       .fontSize(6); // Reduced from 8
    
    let dataY = tableStartY + 28; // Adjusted
    const maxRows = 4; // Reduced to make room for totals
    
    bolData.packages.slice(0, maxRows).forEach((pkg, index) => {
        if (index > 0) {
            // Draw row separator
            doc.strokeColor('#CCCCCC')
               .lineWidth(0.25)
               .moveTo(25, dataY - 3) // Adjusted
               .lineTo(587, dataY - 3)
               .stroke();
        }
        
        xPos = 25;
        const rowData = [
            '1', // Package quantity
            pkg.type || 'PALLET',
            pkg.weight.toFixed(0),
            '', // H/M
            pkg.description,
            pkg.dimensions,
            pkg.freightClass || ''
        ];
        
        rowData.forEach((data, colIndex) => {
            doc.fillColor('#000000')
               .text(data, xPos + 2, dataY, {
                   width: columns[colIndex].width - 4,
                   align: columns[colIndex].align,
                   height: rowHeight - 3 // Adjusted
               });
            xPos += columns[colIndex].width;
        });
        
        dataY += rowHeight;
    });
    
    // FIXED: Position totals WITHIN the table at bottom
    const totalsY = tableStartY + 95; // Position within table
    
    // Draw separator line for totals section
    doc.strokeColor('#000000')
       .lineWidth(0.5)
       .moveTo(25, totalsY)
       .lineTo(587, totalsY)
       .stroke();
    
    // TOTAL PIECES and WEIGHT - PROPERLY POSITIONED AND SIZED
    doc.font('Helvetica-Bold')
       .fontSize(7) // Reduced from 9
       .fillColor('#000000')
       .text('TOTAL PIECES:', 350, totalsY + 5) // Positioned within table
       .text(bolData.totalPieces.toString(), 430, totalsY + 5)
       .text('TOTAL WEIGHT:', 350, totalsY + 15)
       .text(`${bolData.totalWeight.toFixed(0)} LBS`, 430, totalsY + 15);
}

/**
 * Draws the exact value declaration section
 */
function drawExactValueDeclaration(doc, bolData) {
    // Value declaration section
    doc.lineWidth(1)
       .rect(25, 520, 562, 50) // Adjusted position
       .stroke();
    
    doc.font('Helvetica')
       .fontSize(5) // Reduced from 7
       .text('Where the rate is dependent on value, shippers are required to state specifically in writing the agreed or declared value of the property as follows:', 30, 528)
       .text('The agreed or declared value of the property is specifically stated by the shipper to be not exceeding _____________ per _______________', 30, 538);
    
    doc.font('Helvetica-Bold')
       .fontSize(5) // Reduced from 7
       .text('NOTE: Liability limitation for loss or damage in this shipment may be applicable. See 49 CFR 370.', 30, 548);
    
    // COD section (right side)
    doc.lineWidth(0.5)
       .rect(400, 520, 187, 50) // Adjusted position
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(6) // Reduced from 8
       .text('COD', 405, 525);
    
    doc.font('Helvetica')
       .fontSize(5) // Reduced from 7
       .text('Amount: $ _______________', 405, 535)
       .text('Fee Terms: ☐ Collect ☐ Prepaid', 405, 545)
       .text('Customer check acceptable: ☐', 405, 555);
}

/**
 * Draws the exact trailer loading section
 */
function drawExactTrailerSection(doc, bolData) {
    const sectionY = 590;
    
    // Trailer loaded section (left)
    doc.lineWidth(1)
       .rect(25, sectionY, 186, 50)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7) // Reduced from 8
       .text('TRAILER LOADED:', 30, sectionY + 5);
    
    doc.font('Helvetica')
       .fontSize(6) // Reduced from 7
       .text('☐ by shipper', 30, sectionY + 18)
       .text('☐ by driver', 30, sectionY + 30);
    
    // Freight counted section (middle)
    doc.lineWidth(1)
       .rect(211, sectionY, 186, 50)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7) // Reduced from 8
       .text('FREIGHT COUNTED:', 216, sectionY + 5);
    
    doc.font('Helvetica')
       .fontSize(6) // Reduced from 7
       .text('☐ by shipper', 216, sectionY + 18)
       .text('☐ by driver', 216, sectionY + 30);
    
    // Container sealed section (right)
    doc.lineWidth(1)
       .rect(397, sectionY, 190, 50)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7) // Reduced from 8
       .text('CONTAINER SEALED:', 402, sectionY + 5);
    
    doc.font('Helvetica')
       .fontSize(6) // Reduced from 7
       .text('☐ by shipper', 402, sectionY + 18)
       .text('☐ by driver', 402, sectionY + 30);
}

/**
 * Draws the exact signature section
 */
function drawExactSignatureSection(doc, bolData) {
    const sigY = 640;
    const sigHeight = 112;
    const colWidth = 187;
    
    // Shipper signature section (left)
    doc.lineWidth(1)
       .rect(25, sigY, colWidth, sigHeight)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7) // Reduced from 8
       .text('SHIPPER SIGNATURE/DATE', 30, sigY + 5);
    
    doc.font('Helvetica')
       .fontSize(5) // Reduced from 6
       .text('This is to certify that the above named materials are', 30, sigY + 18)
       .text('properly classified, packaged, marked and labeled,', 30, sigY + 26)
       .text('and are in proper condition for transportation', 30, sigY + 34)
       .text('according to the applicable regulations of the', 30, sigY + 42)
       .text('Department of Transportation.', 30, sigY + 50);
    
    // FIXED: Signature lines - draw actual lines instead of problematic characters
    doc.strokeColor('#000000')
       .lineWidth(0.5)
       .moveTo(30, sigY + 75)
       .lineTo(140, sigY + 75)
       .stroke();
    
    doc.fontSize(5)
       .text('Shipper', 30, sigY + 80);
    
    doc.moveTo(150, sigY + 75)
       .lineTo(200, sigY + 75)
       .stroke();
    
    doc.text('Date', 160, sigY + 80);
    
    // Carrier signature section (middle)
    doc.lineWidth(1)
       .rect(212, sigY, colWidth, sigHeight)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7) // Reduced from 8
       .text('CARRIER SIGNATURE/DATE', 217, sigY + 5);
    
    doc.font('Helvetica')
       .fontSize(5) // Reduced from 6
       .text('Carrier acknowledges receipt of packages and', 217, sigY + 18)
       .text('required placards. Property described above is', 217, sigY + 26)
       .text('received in good order, except as noted.', 217, sigY + 34);
    
    // FIXED: Signature lines - draw actual lines
    doc.strokeColor('#000000')
       .lineWidth(0.5)
       .moveTo(217, sigY + 75)
       .lineTo(327, sigY + 75)
       .stroke();
    
    doc.fontSize(5)
       .text('Carrier', 217, sigY + 80);
    
    doc.moveTo(337, sigY + 75)
       .lineTo(387, sigY + 75)
       .stroke();
    
    doc.text('Date', 347, sigY + 80);
    
    // Consignee signature section (right)
    doc.lineWidth(1)
       .rect(399, sigY, 188, sigHeight)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7) // Reduced from 8
       .text('CONSIGNEE SIGNATURE/DATE', 404, sigY + 5);
    
    doc.font('Helvetica')
       .fontSize(5) // Reduced from 6
       .text('Received in good order, except as noted.', 404, sigY + 18);
    
    // FIXED: Signature lines - draw actual lines
    doc.strokeColor('#000000')
       .lineWidth(0.5)
       .moveTo(404, sigY + 75)
       .lineTo(514, sigY + 75)
       .stroke();
    
    doc.fontSize(5)
       .text('Consignee', 404, sigY + 80);
    
    doc.moveTo(524, sigY + 75)
       .lineTo(574, sigY + 75)
       .stroke();
    
    doc.text('Date', 534, sigY + 80);
}

/**
 * Draws the exact legal disclaimer at the bottom
 */
function drawExactLegalDisclaimer(doc) {
    doc.font('Helvetica')
       .fontSize(4) // Reduced from 5
       .text('Subject to Section 7 of conditions, if this shipment is to be delivered to the consignee without recourse on the consignor, the consignor shall sign the following statement:', 25, 760)
       .text('The carrier shall not make delivery of this shipment without payment of freight and all other lawful charges. ________________________ (Signature of consignor)', 25, 768);
}

/**
 * Stores the BOL document in Firebase Storage and creates document record
 */
async function storeBOLDocument(pdfBuffer, shipmentId, firebaseDocId) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `polaris-bol-${shipmentId}-${timestamp}.pdf`;
        const bucket = storage.bucket();
        
        // Use unified storage path
        const file = bucket.file(`shipment-documents/${firebaseDocId}/${fileName}`);
        
        // Upload PDF to Firebase Storage
        await file.save(pdfBuffer, {
            metadata: {
                contentType: 'application/pdf',
                metadata: {
                    shipmentId: shipmentId,
                    carrier: 'Polaris Transportation',
                    documentType: 'bol',
                    generatedAt: new Date().toISOString()
                }
            }
        });
        
        // Get download URL
        const [downloadUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 1000 * 60 * 60 * 24 * 365 // 1 year
        });
        
        // Create document record
        const documentData = {
            shipmentId: firebaseDocId,
            filename: fileName,
            docType: 3, // 3 for BOL documents
            fileSize: pdfBuffer.length,
            carrier: 'Polaris Transportation',
            documentType: 'bol',
            downloadUrl: downloadUrl,
            storagePath: `shipment-documents/${firebaseDocId}/${fileName}`,
            metadata: {
                polarisShipmentId: shipmentId,
                documentFormat: 'PDF',
                bolGenerated: true,
                exactPositioning: true,
                fontOptimized: true
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            _isUnifiedStructure: true
        };
        
        // Store in unified structure
        const unifiedDocRef = db.collection('shipments').doc(firebaseDocId)
                                .collection('documents').doc(`${firebaseDocId}_bol`);
        await unifiedDocRef.set(documentData);
        
        // Store in main collection
        const legacyDocRef = db.collection('shipmentDocuments').doc(`${firebaseDocId}_bol`);
        await legacyDocRef.set({
            ...documentData,
            unifiedDocumentId: `${firebaseDocId}_bol`,
            migrationNote: 'Created with unified ID structure and exact positioning',
            _isUnifiedStructure: true
        });
        
        logger.info(`Polaris Transportation BOL stored with exact positioning:`, {
            shipmentId: firebaseDocId,
            documentId: `${firebaseDocId}_bol`,
            storagePath: documentData.storagePath,
            improvementsApplied: 'Exact pixel positioning, proper fonts, enhanced data extraction'
        });
        
        return {
            documentId: `${firebaseDocId}_bol`,
            downloadUrl: downloadUrl,
            fileName: fileName,
            storagePath: documentData.storagePath
        };
        
    } catch (error) {
        logger.error('Error storing Polaris Transportation BOL:', error);
        throw new Error(`Failed to store BOL: ${error.message}`);
    }
}

module.exports = {
    generatePolarisTransportationBOL
}; 