const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const uuid = require('uuid');

const db = admin.firestore();
const storage = admin.storage();

/**
 * Core BOL generation function - can be called directly from other functions
 * @param {string} shipmentId - The shipment ID
 * @param {string} firebaseDocId - The Firebase document ID
 * @returns {Object} - Success/error response with document info
 */
async function generateBOLCore(shipmentId, firebaseDocId) {
    try {
        logger.info('generateBOLCore called with:', { shipmentId, firebaseDocId });
        
        if (!shipmentId) {
            throw new Error('Shipment ID is required');
        }
        
        if (!firebaseDocId) {
            throw new Error('Firebase document ID is required');
        }
        
        // Get shipment data from Firestore
        let shipmentDoc = await db.collection('shipments').doc(firebaseDocId).get();
        let shipmentData = null;
        
        if (shipmentDoc.exists) {
            shipmentData = shipmentDoc.data();
            logger.info('Retrieved shipment data by document ID for Generic BOL generation');
        } else {
            // Try to find by shipmentID field
            logger.info(`Document ${firebaseDocId} not found, searching by shipmentID field`);
            const shipmentQuery = await db.collection('shipments')
                .where('shipmentID', '==', shipmentId)
                .limit(1)
                .get();
                
            if (!shipmentQuery.empty) {
                shipmentDoc = shipmentQuery.docs[0];
                shipmentData = shipmentDoc.data();
                logger.info(`Found shipment by shipmentID: ${shipmentId}`);
            } else {
                // Try firebaseDocId as shipmentID
                const fallbackQuery = await db.collection('shipments')
                    .where('shipmentID', '==', firebaseDocId)
                    .limit(1)
                    .get();
                    
                if (!fallbackQuery.empty) {
                    shipmentDoc = fallbackQuery.docs[0];
                    shipmentData = shipmentDoc.data();
                    logger.info(`Found shipment by fallback shipmentID: ${firebaseDocId}`);
                } else {
                    throw new Error(`Shipment with ID ${shipmentId} or ${firebaseDocId} not found`);
                }
            }
        }
        
        if (!shipmentData) {
            throw new Error(`Shipment ${shipmentId} not found`);
        }
        
        // Extract data for BOL generation
        const bolData = extractBOLData(shipmentData, shipmentId);
        
        // Generate the PDF BOL
        const pdfBuffer = await generateBOLPDF(bolData);
        
        // Store the BOL document
        const documentInfo = await storeBOLDocument(pdfBuffer, shipmentId, firebaseDocId);
        
        logger.info('Core Generic BOL generation completed successfully');
        
        return {
            success: true,
            message: 'Generic BOL generated successfully',
            data: {
                ...documentInfo,
                shipmentId: shipmentId,
                firebaseDocId: firebaseDocId
            }
        };
        
    } catch (error) {
        logger.error('Error in generateBOLCore:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

/**
 * Generates a Generic Bill of Lading (BOL) PDF document
 * Using exact Polaris Transportation BOL format with QuickShip data
 */
const generateGenericBOL = onCall({
    minInstances: 1, // Keep warm to prevent cold starts for document generation
    memory: '1GiB', // More memory for PDF generation
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { shipmentId, firebaseDocId } = request.data;
        
        logger.info('generateGenericBOL called with:', { shipmentId, firebaseDocId });
        
        // Use the core function
        return await generateBOLCore(shipmentId, firebaseDocId);
        
    } catch (error) {
        logger.error('Error in generateGenericBOL:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
});

/**
 * Extracts and formats data from shipment for BOL generation
 * Enhanced to handle QuickShip data formats
 * @param {Object} shipmentData - Firestore shipment document data
 * @param {string} shipmentId - QuickShip shipment ID
 * @returns {Object} - Formatted BOL data
 */
function extractBOLData(shipmentData, shipmentId) {
    console.log('extractBOLData: Processing QuickShip data for Generic BOL');
    
    // Extract addresses from QuickShip format
    const shipFrom = shipmentData.shipFrom || {};
    const shipTo = shipmentData.shipTo || {};
    
    // Extract packages from QuickShip format
    const packages = shipmentData.packages || [];
    
    // Extract reference information
    const referenceNumber = shipmentData.shipmentInfo?.shipperReferenceNumber || 
                          shipmentData.referenceNumber || 
                          shipmentData.shipmentID ||
                          '';
    
    // Generate BOL number with proper format
    const bolNumber = Math.floor(Math.random() * 900000) + 4000000; // Generates number like 4429597
    
    // Extract and format ship date
    const shipDate = shipmentData.shipmentInfo?.shipmentDate || 
                    shipmentData.shipmentDate ||
                    new Date().toISOString().split('T')[0];
    
    const formattedShipDate = new Date(shipDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    // Extract Pro Number from QuickShip
    const proNumber = shipmentData.shipmentInfo?.carrierTrackingNumber || 
                     shipmentData.carrierTrackingNumber ||
                     `P${Math.floor(Math.random() * 90000000) + 10000000}`;
    
    // Calculate total weight and piece count
    let totalWeight = 0;
    let totalPieces = 0;
    
    packages.forEach(pkg => {
        const weight = parseFloat(String(pkg.weight || 0).replace(/[^\d.-]/g, '')) || 0;
        const quantity = parseInt(String(pkg.quantity || pkg.packagingQuantity || 1).replace(/[^\d]/g, '')) || 1;
        
        totalWeight += weight;
        totalPieces += quantity;
    });
    
    // Get carrier name from QuickShip
    const carrierName = shipmentData.selectedCarrier || 
                       shipmentData.carrier || 
                       'GENERIC CARRIER';
    
    // Extract special instructions for QuickShip
    const specialInstructions = [];
    
    // Add QuickShip specific instructions
    specialInstructions.push('QuickShip Manual Entry Shipment');
    specialInstructions.push('Questions or issues with shipment call support');
    
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
    
    return {
        // Header Information
        bolNumber: bolNumber.toString(),
        shipDate: formattedShipDate,
        carrier: carrierName,
        proNumber: proNumber,
        customerRef: referenceNumber,
        
        // Ship From Information - Enhanced extraction for QuickShip
        shipFrom: {
            company: shipFrom?.companyName || shipFrom?.company || 'Unknown Shipper',
            contact: shipFrom?.contact || shipFrom?.contactName || '',
            address1: shipFrom?.street || shipFrom?.address1 || '',
            address2: shipFrom?.street2 || shipFrom?.address2 || '',
            city: shipFrom?.city || '',
            state: shipFrom?.state || shipFrom?.province || '',
            zip: shipFrom?.postalCode || shipFrom?.zip || '',
            phone: shipFrom?.phone || '',
            openTime: shipmentData.shipmentInfo?.earliestPickup || '09:00',
            closeTime: shipmentData.shipmentInfo?.latestPickup || '17:00'
        },
        
        // Ship To Information - Enhanced extraction for QuickShip
        shipTo: {
            company: shipTo?.companyName || shipTo?.company || 'Unknown Consignee',
            contact: shipTo?.contact || shipTo?.contactName || '',
            address1: shipTo?.street || shipTo?.address1 || '',
            address2: shipTo?.street2 || shipTo?.address2 || '',
            city: shipTo?.city || '',
            state: shipTo?.state || shipTo?.province || '',
            zip: shipTo?.postalCode || shipTo?.zip || '',
            phone: shipTo?.phone || ''
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
        
        // Package Information - Enhanced mapping for QuickShip
        packages: packages.map((pkg, index) => {
            const weight = parseFloat(String(pkg.weight || 0).replace(/[^\d.-]/g, '')) || 0;
            const length = pkg.length || 48;
            const width = pkg.width || 40;
            const height = pkg.height || 48;
            
            return {
                type: pkg.packageType || pkg.type || 'PALLET',
                weight: weight,
                description: pkg.description || 
                           pkg.itemDescription ||
                           'General Freight',
                dimensions: `${length} x ${width} x ${height}`,
                freightClass: pkg.freightClass || ''
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
 * Generates the BOL PDF with exact layout matching Polaris Transportation format
 */
async function generateBOLPDF(bolData) {
    return new Promise((resolve, reject) => {
        try {
            // Create PDF document (Letter size: 612 x 792 points) with no margins for exact positioning
            const doc = new PDFDocument({
                size: 'letter',
                margin: 0,
                info: {
                    Title: `BOL ${bolData.bolNumber} - Generic BOL`,
                    Author: 'Integrated Carriers SoluShip',
                    Subject: 'Bill of Lading',
                    Keywords: 'BOL, Bill of Lading, QuickShip, Freight'
                }
            });
            
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);
            
            // Build the BOL document with exact positioning matching Polaris format
            buildExactBOLDocument(doc, bolData);
            
            // Finalize the PDF
            doc.end();
            
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Builds the complete BOL document with exact pixel positioning matching Polaris format
 * OPTIMIZED FOR 8.5x11 (LETTER SIZE) FORMAT
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {Object} bolData - BOL data
 */
function buildExactBOLDocument(doc, bolData) {
    // Set default stroke and fill colors
    doc.strokeColor('#000000').fillColor('#000000');
    
    // Main container border (full page border) - SIZED FOR 8.5x11
    doc.lineWidth(2)
       .rect(20, 20, 572, 752) // Standard letter size with margins
       .stroke();
    
    // Header Section (Y: 20-100)
    drawExactHeader(doc, bolData);
    
    // Ship From/To Section (Y: 100-260)
    drawExactShippingSection(doc, bolData);
    
    // Third Party Billing Section (Y: 260-340)
    drawExactThirdPartySection(doc, bolData);
    
    // Special Instructions Section (Y: 340-400)
    drawExactSpecialInstructions(doc, bolData);
    
    // Freight Table Section (Y: 400-520) - ADJUSTED HEIGHT
    drawExactFreightTable(doc, bolData);
    
    // Value Declaration Section (Y: 525-565) - REPOSITIONED
    drawExactValueDeclaration(doc, bolData);
    
    // Trailer Information Section (Y: 570-620) - REPOSITIONED
    drawExactTrailerSection(doc, bolData);
    
    // Signature Section (Y: 625-725) - REPOSITIONED
    drawExactSignatureSection(doc, bolData);
    
    // Legal disclaimer at bottom (Y: 735-750) - FITS ON PAGE
    drawExactLegalDisclaimer(doc);
}

/**
 * Draws the exact header section matching the Polaris BOL with SolushipX branding
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
               .fontSize(16)
               .fillColor('#000000')
               .text('SolushipX', 35, 40);
            
            // Add registered trademark symbol
            doc.fontSize(6)
               .text('®', 135, 35);
            
            // Company subtitle
            doc.font('Helvetica')
               .fontSize(8)
               .text('INTEGRATED CARRIERS', 35, 60)
               .fontSize(7)
               .text('Freight Logistics & Transportation', 35, 72);
        }
    } catch (error) {
        console.error('Error loading logo image:', error);
        // Fallback to text-based logo
        doc.font('Helvetica-Bold')
           .fontSize(16)
           .fillColor('#000000')
           .text('SolushipX', 35, 40);
        
        // Add registered trademark symbol
        doc.fontSize(6)
           .text('®', 135, 35);
        
        // Company subtitle
        doc.font('Helvetica')
           .fontSize(8)
           .text('INTEGRATED CARRIERS', 35, 60)
           .fontSize(7)
           .text('Freight Logistics & Transportation', 35, 72);
    }
    
    // Professional accent line under logo area
    doc.strokeColor('#000000')
       .lineWidth(2)
       .moveTo(35, 83)
       .lineTo(170, 83)
       .stroke();
    
    // Title section (top-right) - FIXED POSITIONING TO PREVENT OVERLAP
    doc.font('Helvetica-Bold')
       .fontSize(11)
       .fillColor('#000000')
       .text('LTL Bill of Lading- Not Negotiable', 280, 25, {
           width: 160,
           align: 'center'
       });
    
    // BOL Number box - REPOSITIONED AND RESIZED TO FIT PROPERLY
    doc.lineWidth(1)
       .rect(450, 45, 120, 25)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('BOL Number:', 455, 50)
       .fontSize(9)
       .fillColor('#000000')
       .text(bolData.bolNumber, 455, 62, {
           width: 110,
           align: 'left'
       });
    
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
       .fontSize(8)
       .fillColor('#FFFFFF')
       .rect(25, 100, 280, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('SHIP FROM', 30, 105);
    
    // Ship From content
    doc.fillColor('#000000')
       .font('Helvetica-Bold')
       .fontSize(7)
       .text(bolData.shipFrom.company, 30, 118);
    
    // Only show contact if it exists and is meaningful
    let yPos = 128;
    if (bolData.shipFrom.contact && bolData.shipFrom.contact.trim() !== '' && bolData.shipFrom.contact !== bolData.shipFrom.company) {
        doc.font('Helvetica')
           .text(`Contact: ${bolData.shipFrom.contact}`, 30, yPos);
        yPos += 10;
    }
    
    doc.font('Helvetica')
       .text(bolData.shipFrom.address1, 30, yPos);
    yPos += 10;
    
    if (bolData.shipFrom.address2 && bolData.shipFrom.address2.trim()) {
        doc.text(bolData.shipFrom.address2, 30, yPos);
        yPos += 10;
    }
    
    doc.text(`${bolData.shipFrom.city}, ${bolData.shipFrom.state} ${bolData.shipFrom.zip}`, 30, yPos);
    
    // Ship From timing
    doc.text(`Open: ${bolData.shipFrom.openTime}`, 200, 118)
       .text(`Close: ${bolData.shipFrom.closeTime}`, 200, 128)
       .text(`Phone: ${bolData.shipFrom.phone}`, 200, 138);
    
    // Ship date and carrier info (right side of Ship From)
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('Ship Date:', 320, 118)
       .font('Helvetica')
       .text(bolData.shipDate, 370, 118);
    
    doc.font('Helvetica-Bold')
       .text('Carrier:', 320, 128)
       .font('Helvetica')
       .fontSize(6)
       .text(bolData.carrier, 370, 128, { width: 200 });
    
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('Pro Number:', 320, 145)
       .font('Helvetica')
       .text(bolData.proNumber, 390, 145);
    
    // Ship To section
    doc.lineWidth(1)
       .rect(25, 180, 280, 80)
       .stroke();
    
    // Ship To header
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .fillColor('#FFFFFF')
       .rect(25, 180, 280, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('SHIP TO', 30, 185);
    
    // Ship To content
    doc.fillColor('#000000')
       .font('Helvetica-Bold')
       .fontSize(7)
       .text(bolData.shipTo.company, 30, 198);
    
    // Only show contact if it exists and is meaningful
    let shipToYPos = 208;
    if (bolData.shipTo.contact && bolData.shipTo.contact.trim() !== '' && bolData.shipTo.contact !== bolData.shipTo.company) {
        doc.font('Helvetica')
           .text(`Contact: ${bolData.shipTo.contact}`, 30, shipToYPos);
        shipToYPos += 10;
    }
    
    // Properly format address
    doc.font('Helvetica');
    if (bolData.shipTo.address1) {
        doc.text(bolData.shipTo.address1, 30, shipToYPos);
        shipToYPos += 10;
    }
    if (bolData.shipTo.address2 && bolData.shipTo.address2.trim()) {
        doc.text(bolData.shipTo.address2, 30, shipToYPos);
        shipToYPos += 10;
    }
    doc.text(`${bolData.shipTo.city}, ${bolData.shipTo.state} ${bolData.shipTo.zip}`, 30, shipToYPos);
    
    // References section (right column)
    doc.lineWidth(1)
       .rect(305, 180, 282, 80)
       .stroke();
    
    // References header
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .fillColor('#FFFFFF')
       .rect(305, 180, 282, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('REFERENCES', 310, 185);
    
    // References content
    doc.fillColor('#000000')
       .font('Helvetica-Bold')
       .fontSize(7)
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
       .text('', 380, 230);
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
       .fontSize(8)
       .fillColor('#FFFFFF')
       .rect(25, 260, 562, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('THIRD PARTY FREIGHT CHARGES BILLED TO', 30, 265);
    
    // Third party content
    doc.fillColor('#000000')
       .font('Helvetica')
       .fontSize(7)
       .text(bolData.thirdParty.company, 30, 280)
       .text(bolData.thirdParty.address1, 30, 290)
       .text(bolData.thirdParty.address2, 30, 300)
       .text(`${bolData.thirdParty.city}, ${bolData.thirdParty.state} ${bolData.thirdParty.zip}`, 30, 310);
    
    // Account number (right side)
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('Account Number:', 400, 280)
       .font('Helvetica')
       .text(bolData.thirdParty.accountNumber, 490, 280);
    
    // Check boxes for freight terms
    const checkBoxY = 300;
    doc.font('Helvetica')
       .fontSize(6)
       .text('Freight Charges are:', 400, checkBoxY);
    
    // Draw checkboxes
    doc.rect(400, checkBoxY + 12, 6, 6).stroke()
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
       .fontSize(8)
       .fillColor('#FFFFFF')
       .rect(25, 340, 562, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('SPECIAL INSTRUCTIONS', 30, 345);
    
    // Special instructions content
    doc.fillColor('#000000')
       .font('Helvetica')
       .fontSize(6);
    
    let textY = 360;
    bolData.specialInstructions.forEach((instruction, index) => {
        doc.text(instruction, 30, textY);
        textY += 10;
    });
}

/**
 * Draws the exact freight table section
 */
function drawExactFreightTable(doc, bolData) {
    const tableStartY = 400;
    const tableWidth = 562;
    const rowHeight = 18;
    
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
       .rect(25, tableStartY, tableWidth, 120)
       .stroke();
    
    // Draw table header
    doc.font('Helvetica-Bold')
       .fontSize(6)
       .fillColor('#FFFFFF')
       .rect(25, tableStartY, tableWidth, 20)
       .fill('#000000');
    
    let xPos = 25;
    columns.forEach(col => {
        doc.fillColor('#FFFFFF')
           .text(col.header, xPos + 2, tableStartY + 3, {
               width: col.width - 4,
               align: col.align,
               height: 16
           });
        
        // Draw column separators
        if (xPos > 25) {
            doc.strokeColor('#FFFFFF')
               .lineWidth(1)
               .moveTo(xPos, tableStartY)
               .lineTo(xPos, tableStartY + 20)
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
            doc.moveTo(xPos, tableStartY + 20)
               .lineTo(xPos, tableStartY + 120)
               .stroke();
        }
        xPos += col.width;
    });
    
    // Draw data rows
    doc.fillColor('#000000')
       .font('Helvetica')
       .fontSize(6);
    
    let dataY = tableStartY + 28;
    const maxRows = 4;
    
    bolData.packages.slice(0, maxRows).forEach((pkg, index) => {
        if (index > 0) {
            // Draw row separator
            doc.strokeColor('#CCCCCC')
               .lineWidth(0.25)
               .moveTo(25, dataY - 3)
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
                   height: rowHeight - 3
               });
            xPos += columns[colIndex].width;
        });
        
        dataY += rowHeight;
    });
    
    // Position totals WITHIN the table at bottom
    const totalsY = tableStartY + 95;
    
    // Draw separator line for totals section
    doc.strokeColor('#000000')
       .lineWidth(0.5)
       .moveTo(25, totalsY)
       .lineTo(587, totalsY)
       .stroke();
    
    // TOTAL PIECES and WEIGHT
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .fillColor('#000000')
       .text('TOTAL PIECES:', 350, totalsY + 5)
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
       .rect(25, 525, 562, 40)
       .stroke();
    
    doc.font('Helvetica')
       .fontSize(5)
       .text('Where the rate is dependent on value, shippers are required to state specifically in writing the agreed or declared value of the property as follows:', 30, 530)
       .text('The agreed or declared value of the property is specifically stated by the shipper to be not exceeding _____________ per _______________', 30, 538);
    
    doc.font('Helvetica-Bold')
       .fontSize(5)
       .text('NOTE: Liability limitation for loss or damage in this shipment may be applicable. See 49 CFR 370.', 30, 548);
    
    // COD section (right side)
    doc.lineWidth(0.5)
       .rect(400, 525, 187, 40)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(6)
       .text('COD', 405, 530);
    
    doc.font('Helvetica')
       .fontSize(5)
       .text('Amount: $ _______________', 405, 540)
       .text('Fee Terms: ☐ Collect ☐ Prepaid', 405, 548)
       .text('Customer check acceptable: ☐', 405, 556);
}

/**
 * Draws the exact trailer loading section
 */
function drawExactTrailerSection(doc, bolData) {
    const sectionY = 570;
    
    // Trailer loaded section (left)
    doc.lineWidth(1)
       .rect(25, sectionY, 186, 50)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('TRAILER LOADED:', 30, sectionY + 5);
    
    doc.font('Helvetica')
       .fontSize(6)
       .text('_____________ by shipper', 30, sectionY + 18)
       .text('_____________ by driver', 30, sectionY + 30);
    
    // Freight counted section (middle)
    doc.lineWidth(1)
       .rect(211, sectionY, 186, 50)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('FREIGHT COUNTED:', 216, sectionY + 5);
    
    doc.font('Helvetica')
       .fontSize(6)
       .text('_____________ by shipper', 216, sectionY + 18)
       .text('_____________ by driver', 216, sectionY + 30);
    
    // Container sealed section (right)
    doc.lineWidth(1)
       .rect(397, sectionY, 190, 50)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('CONTAINER SEALED:', 402, sectionY + 5);
    
    doc.font('Helvetica')
       .fontSize(6)
       .text('_____________ by shipper', 402, sectionY + 18)
       .text('_____________ by driver', 402, sectionY + 30);
}

/**
 * Draws the exact signature section
 */
function drawExactSignatureSection(doc, bolData) {
    const sigY = 625;
    const sigHeight = 100;
    const colWidth = 187;
    
    // Shipper signature section (left)
    doc.lineWidth(1)
       .rect(25, sigY, colWidth, sigHeight)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('SHIPPER SIGNATURE/DATE', 30, sigY + 5);
    
    doc.font('Helvetica')
       .fontSize(5)
       .text('This is to certify that the above named materials are', 30, sigY + 16)
       .text('properly classified, packaged, marked and labeled,', 30, sigY + 24)
       .text('and are in proper condition for transportation', 30, sigY + 32)
       .text('according to the applicable regulations of the', 30, sigY + 40)
       .text('Department of Transportation.', 30, sigY + 48);
    
    // Signature lines
    doc.strokeColor('#000000')
       .lineWidth(0.5)
       .moveTo(30, sigY + 65)
       .lineTo(140, sigY + 65)
       .stroke();
    
    doc.fontSize(5)
       .text('Shipper', 30, sigY + 70);
    
    doc.moveTo(150, sigY + 65)
       .lineTo(200, sigY + 65)
       .stroke();
    
    doc.text('Date', 160, sigY + 70);
    
    // Carrier signature section (middle)
    doc.lineWidth(1)
       .rect(212, sigY, colWidth, sigHeight)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('CARRIER SIGNATURE/DATE', 217, sigY + 5);
    
    doc.font('Helvetica')
       .fontSize(5)
       .text('Carrier acknowledges receipt of packages and', 217, sigY + 16)
       .text('required placards. Property described above is', 217, sigY + 24)
       .text('received in good order, except as noted.', 217, sigY + 32);
    
    // Signature lines
    doc.strokeColor('#000000')
       .lineWidth(0.5)
       .moveTo(217, sigY + 65)
       .lineTo(327, sigY + 65)
       .stroke();
    
    doc.fontSize(5)
       .text('Carrier', 217, sigY + 70);
    
    doc.moveTo(337, sigY + 65)
       .lineTo(387, sigY + 65)
       .stroke();
    
    doc.text('Date', 347, sigY + 70);
    
    // Consignee signature section (right)
    doc.lineWidth(1)
       .rect(399, sigY, 188, sigHeight)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('CONSIGNEE SIGNATURE/DATE', 404, sigY + 5);
    
    doc.font('Helvetica')
       .fontSize(5)
       .text('Received in good order, except as noted.', 404, sigY + 16);
    
    // Signature lines
    doc.strokeColor('#000000')
       .lineWidth(0.5)
       .moveTo(404, sigY + 65)
       .lineTo(514, sigY + 65)
       .stroke();
    
    doc.fontSize(5)
       .text('Consignee', 404, sigY + 70);
    
    doc.moveTo(524, sigY + 65)
       .lineTo(574, sigY + 65)
       .stroke();
    
    doc.text('Date', 534, sigY + 70);
}

/**
 * Draws the exact legal disclaimer at the bottom
 */
function drawExactLegalDisclaimer(doc) {
    // Position legal disclaimer to fit on page
    const disclaimerY = 735;
    
    doc.font('Helvetica')
       .fontSize(5)
       .text('Subject to Section 7 of conditions, if this shipment is to be delivered to the consignee without recourse on the consignor, the consignor shall sign the following statement:', 25, disclaimerY)
       .text('The carrier shall not make delivery of this shipment without payment of freight and all other lawful charges. ________________________ (Signature of consignor)', 25, disclaimerY + 10);
}

/**
 * Stores the BOL document in Firebase Storage
 */
async function storeBOLDocument(pdfBuffer, shipmentId, firebaseDocId) {
    try {
        const fileName = `SOLUSHIP-${shipmentId}-BOL.pdf`;
        const bucket = storage.bucket();
        const file = bucket.file(`shipment-documents/${firebaseDocId}/${fileName}`);
        
        // Upload the file
        await file.save(pdfBuffer, {
            metadata: {
                contentType: 'application/pdf',
                metadata: {
                    shipmentId: shipmentId,
                    carrier: 'Generic',
                    documentType: 'bol',
                    generatedAt: new Date().toISOString()
                }
            }
        });
        
        // Make the file publicly accessible
        await file.makePublic();
        
        // Get the public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
        
        // Generate download token for Firebase Storage URL
        const downloadToken = uuid.v4();
        
        // Update metadata with download token
        await file.setMetadata({
            metadata: {
                firebaseStorageDownloadTokens: downloadToken,
                shipmentId: shipmentId,
                carrier: 'Generic',
                documentType: 'bol',
                generatedAt: new Date().toISOString()
            }
        });
        
        // Firebase Storage download URL with token
        const firebaseStorageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${downloadToken}`;
        
        const documentData = {
            shipmentId: firebaseDocId,
            fileName: fileName,
            filename: fileName, // Keep for backward compatibility
            docType: 3,
            fileSize: pdfBuffer.length,
            carrier: 'Generic',
            documentType: 'bol',
            downloadUrl: firebaseStorageUrl,
            publicUrl: publicUrl,
            downloadToken: downloadToken,
            storagePath: `shipment-documents/${firebaseDocId}/${fileName}`,
            metadata: {
                genericShipmentId: shipmentId,
                documentFormat: 'PDF',
                bolGenerated: true,
                isQuickShip: true,
                exactPositioning: true,
                polarisLayoutMatch: true,
                exactPositioning: true,
                polarisLayoutMatch: true
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            _isUnifiedStructure: true
        };
        
        const unifiedDocRef = db.collection('shipments').doc(firebaseDocId)
                                .collection('documents').doc(`${firebaseDocId}_bol`);
        await unifiedDocRef.set(documentData);
        
        const legacyDocRef = db.collection('shipmentDocuments').doc(`${firebaseDocId}_bol`);
        await legacyDocRef.set({
            ...documentData,
            unifiedDocumentId: `${firebaseDocId}_bol`,
            migrationNote: 'Created with unified ID structure for QuickShip with Polaris layout',
            _isUnifiedStructure: true
        });
        
        logger.info(`Generic BOL stored with Polaris layout:`, {
            shipmentId: firebaseDocId,
            documentId: `${firebaseDocId}_bol`,
            storagePath: documentData.storagePath,
            downloadUrl: firebaseStorageUrl
        });
        
        return {
            documentId: `${firebaseDocId}_bol`,
            downloadUrl: firebaseStorageUrl,
            publicUrl: publicUrl,
            fileName: fileName,
            storagePath: documentData.storagePath
        };
        
    } catch (error) {
        logger.error('Error storing Generic BOL:', error);
        throw new Error(`Failed to store BOL: ${error.message}`);
    }
}

module.exports = {
    generateGenericBOL,
    generateBOLCore
}; 