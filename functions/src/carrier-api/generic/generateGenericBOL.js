const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const db = admin.firestore();
const storage = admin.storage();

/**
 * Generates a Generic Bill of Lading (BOL) PDF document for QuickShip
 * Based on the exact format from Basic_BOL.pdf template
 * @param {Object} request - Firebase function request containing shipment data
 * @returns {Object} - Success/error response with document download URL
 */
const generateGenericBOL = onCall(async (request) => {
    try {
        const { shipmentId, firebaseDocId } = request.data;
        
        logger.info('generateGenericBOL called with:', { shipmentId, firebaseDocId });
        
        // Validate required parameters
        if (!shipmentId) {
            throw new Error('Shipment ID is required');
        }
        
        if (!firebaseDocId) {
            throw new Error('Firebase document ID is required');
        }
        
        // Get shipment data from Firestore
        // First try to get by document ID (for when firebaseDocId is the actual doc ID)
        let shipmentDoc = await db.collection('shipments').doc(firebaseDocId).get();
        let shipmentData = null;
        
        if (shipmentDoc.exists) {
            shipmentData = shipmentDoc.data();
            logger.info('Retrieved shipment data by document ID for Generic BOL generation');
        } else {
            // If not found by document ID, try to find by shipmentID field
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
                // Also try searching by the firebaseDocId as shipmentID (in case they're passed incorrectly)
                const fallbackQuery = await db.collection('shipments')
                    .where('shipmentID', '==', firebaseDocId)
                    .limit(1)
                    .get();
                    
                if (!fallbackQuery.empty) {
                    shipmentDoc = fallbackQuery.docs[0];
                    shipmentData = shipmentDoc.data();
                    logger.info(`Found shipment by fallback shipmentID: ${firebaseDocId}`);
                } else {
                    throw new Error(`Shipment with ID ${shipmentId} or ${firebaseDocId} not found in database`);
                }
            }
        }
        
        if (!shipmentData) {
            throw new Error(`Shipment ${shipmentId} not found`);
        }
        
        // Extract data for BOL generation
        const bolData = extractGenericBOLData(shipmentData, shipmentId);
        
        // Generate the PDF BOL
        const pdfBuffer = await generateGenericBOLPDF(bolData);
        
        // Store the BOL document
        const documentInfo = await storeGenericBOLDocument(pdfBuffer, shipmentId, firebaseDocId);
        
        logger.info('Generic BOL generation completed successfully');
        
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
        logger.error('Error in generateGenericBOL:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
});

/**
 * Extracts and formats data from shipment for Generic BOL generation
 * @param {Object} shipmentData - Firestore shipment document data
 * @param {string} shipmentId - Shipment ID
 * @returns {Object} - Formatted BOL data
 */
function extractGenericBOLData(shipmentData, shipmentId) {
    console.log('extractGenericBOLData: Processing shipment data for Generic BOL');
    
    // Extract addresses
    const shipFrom = shipmentData.shipFrom || {};
    const shipTo = shipmentData.shipTo || {};
    
    // Extract packages
    const packages = shipmentData.packages || [];
    
    // Extract reference information
    const referenceNumber = shipmentData.shipmentInfo?.shipperReferenceNumber || 
                          shipmentData.referenceNumber || 
                          shipmentData.shipmentID ||
                          '';
    
    // Generate BOL number
    const bolNumber = `BOL-${shipmentId}`;
    
    // Extract and format ship date
    const shipDate = shipmentData.shipmentInfo?.shipmentDate || 
                    new Date().toISOString().split('T')[0];
    
    const formattedShipDate = new Date(shipDate).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
    });
    
    // Calculate total weight and piece count
    let totalWeight = 0;
    let totalPieces = 0;
    
    console.log('Calculating totals from packages:', packages);
    
    packages.forEach((pkg, index) => {
        // Ensure numeric values for individual packages
        const rawWeight = pkg.weight || pkg.totalWeight || 0;
        const weight = parseFloat(String(rawWeight).replace(/[^\d.-]/g, '')) || 0;
        
        const rawQuantity = pkg.quantity || pkg.packagingQuantity || pkg.pieces || 1;
        const pieces = parseInt(String(rawQuantity).replace(/[^\d]/g, '')) || 1;
        
        console.log(`Package ${index + 1}: weight=${rawWeight} -> ${weight}, quantity=${rawQuantity} -> ${pieces}`);
        
        // Add to totals (ensure numeric addition)
        totalWeight = Number(totalWeight) + Number(weight);
        totalPieces = Number(totalPieces) + Number(pieces);
    });
    
    // Ensure final totals are numbers
    totalWeight = Number(totalWeight) || 0;
    totalPieces = Number(totalPieces) || 0;
    
    console.log('Final calculated totals:', { totalWeight, totalPieces });
    
    // Extract carrier details
    const carrierDetails = shipmentData.carrierDetails || {};
    const carrierName = shipmentData.carrier || 'Generic Carrier';
    
    return {
        // Header Information
        bolNumber: bolNumber,
        shipDate: formattedShipDate,
        carrier: carrierName,
        proNumber: shipmentId,
        customerRef: referenceNumber,
        
        // Ship From Information
        shipFrom: {
            company: shipFrom?.companyName || shipFrom?.company || 'Unknown Shipper',
            contact: shipFrom?.contact || shipFrom?.contactName || '',
            address1: shipFrom?.street || '',
            address2: shipFrom?.street2 || '',
            city: shipFrom?.city || '',
            state: shipFrom?.state || '',
            zip: shipFrom?.postalCode || '',
            phone: shipFrom?.phone || '',
            openTime: shipmentData.shipmentInfo?.earliestPickup || '09:00',
            closeTime: shipmentData.shipmentInfo?.latestPickup || '17:00'
        },
        
        // Ship To Information
        shipTo: {
            company: shipTo?.companyName || shipTo?.company || 'Unknown Consignee',
            contact: shipTo?.contact || shipTo?.contactName || '',
            address1: shipTo?.street || '',
            address2: shipTo?.street2 || '',
            city: shipTo?.city || '',
            state: shipTo?.state || '',
            zip: shipTo?.postalCode || '',
            phone: shipTo?.phone || ''
        },
        
        // Third Party Billing (SolushipX - Integrated Carriers)
        thirdParty: {
            company: 'INTEGRATED CARRIERS',
            address1: '9 - 75 FIRST STREET,',
            address2: 'SUITE 209,',
            city: 'Orangeville',
            state: 'ON',
            zip: 'L9W 5B6'
        },
        
        // Package Information
        packages: packages.map((pkg, index) => {
            // Ensure numeric values for individual packages
            const rawWeight = pkg.weight || pkg.totalWeight || 0;
            const weight = parseFloat(String(rawWeight).replace(/[^\d.-]/g, '')) || 0;
            
            const rawQuantity = pkg.quantity || pkg.packagingQuantity || pkg.pieces || 1;
            const pieces = parseInt(String(rawQuantity).replace(/[^\d]/g, '')) || 1;
            
            const length = parseFloat(pkg.length) || 48;
            const width = parseFloat(pkg.width) || 40;
            const height = parseFloat(pkg.height) || 48;
            
            return {
                pieces: pieces,
                weight: weight,
                description: pkg.description || 
                           pkg.itemDescription ||
                           'General Freight',
                dimensions: `${length}" x ${width}" x ${height}"`,
                freightClass: pkg.freightClass || ''
            };
        }),
        
        // Totals
        totalPieces: totalPieces,
        totalWeight: totalWeight,
        
        // Manual rates for special instructions
        manualRates: shipmentData.manualRates || [],
        
        // Store complete shipment data for reference
        shipmentData: shipmentData
    };
}

/**
 * Generates the Generic BOL PDF document using PDFKit
 * @param {Object} bolData - Formatted BOL data
 * @returns {Buffer} - PDF buffer
 */
async function generateGenericBOLPDF(bolData) {
    return new Promise((resolve, reject) => {
        try {
            // Create PDF document (Letter size: 612 x 792 points)
            const doc = new PDFDocument({
                size: 'letter',
                margin: 0,
                info: {
                    Title: `Generic BOL ${bolData.bolNumber}`,
                    Author: 'Integrated Carriers SoluShip',
                    Subject: 'Bill of Lading',
                    Keywords: 'BOL, Bill of Lading, Generic, Freight'
                }
            });
            
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);
            
            // Build the BOL document
            buildGenericBOLDocument(doc, bolData);
            
            // Finalize the PDF
            doc.end();
            
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Builds the complete Generic BOL document with exact positioning
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {Object} bolData - BOL data
 */
function buildGenericBOLDocument(doc, bolData) {
    // Set default stroke and fill colors
    doc.strokeColor('#000000').fillColor('#000000');
    
    // Main container border
    doc.lineWidth(2)
       .rect(20, 20, 572, 752)
       .stroke();
    
    // Header Section
    drawGenericHeader(doc, bolData);
    
    // Ship From/To Section
    drawGenericShippingSection(doc, bolData);
    
    // Third Party Billing Section  
    drawGenericThirdPartySection(doc, bolData);
    
    // Special Services Section
    drawGenericSpecialServices(doc, bolData);
    
    // Freight Table Section
    drawGenericFreightTable(doc, bolData);
    
    // Signature Section
    drawGenericSignatureSection(doc, bolData);
}

/**
 * Draws the header section with Integrated Carriers branding
 */
function drawGenericHeader(doc, bolData) {
    // Company logo area
    try {
        const logoPath = path.join(__dirname, '../../assets/SolushipX_black.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 35, 30, {
                width: 150,
                height: 60,
                fit: [150, 60],
                align: 'left',
                valign: 'center'
            });
        } else {
            // Fallback to text
            doc.font('Helvetica-Bold')
               .fontSize(20)
               .fillColor('#000000')
               .text('INTEGRATED', 35, 35)
               .text('CARRIERS', 35, 55);
        }
    } catch (error) {
        // Fallback to text-based logo
        doc.font('Helvetica-Bold')
           .fontSize(20)
           .fillColor('#000000')
           .text('INTEGRATED', 35, 35)
           .text('CARRIERS', 35, 55);
    }
    
    // Title section
    doc.font('Helvetica-Bold')
       .fontSize(16)
       .fillColor('#000000')
       .text('BILL OF LADING', 350, 30, {
           width: 200,
           align: 'center'
       });
    
    doc.font('Helvetica')
       .fontSize(12)
       .text('Not Negotiable', 350, 50, {
           width: 200,
           align: 'center'
       });
    
    // BOL Number box
    doc.lineWidth(1)
       .rect(450, 70, 120, 25)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .text('BOL Number:', 455, 75)
       .fontSize(10)
       .text(bolData.bolNumber, 455, 87);
    
    // Horizontal separator
    doc.lineWidth(1)
       .moveTo(25, 110)
       .lineTo(587, 110)
       .stroke();
}

/**
 * Draws the shipping addresses section
 */
function drawGenericShippingSection(doc, bolData) {
    const sectionY = 115;
    
    // Ship From section
    doc.lineWidth(1)
       .rect(25, sectionY, 275, 90)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text('SHIP FROM', 30, sectionY + 5);
    
    let yPos = sectionY + 20;
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .text(bolData.shipFrom.company, 30, yPos);
    yPos += 12;
    
    if (bolData.shipFrom.contact) {
        doc.font('Helvetica')
           .fontSize(8)
           .text(`Contact: ${bolData.shipFrom.contact}`, 30, yPos);
        yPos += 10;
    }
    
    doc.text(bolData.shipFrom.address1, 30, yPos);
    yPos += 10;
    
    if (bolData.shipFrom.address2) {
        doc.text(bolData.shipFrom.address2, 30, yPos);
        yPos += 10;
    }
    
    doc.text(`${bolData.shipFrom.city}, ${bolData.shipFrom.state} ${bolData.shipFrom.zip}`, 30, yPos);
    yPos += 10;
    
    doc.text(`Phone: ${bolData.shipFrom.phone}`, 30, yPos);
    
    // Ship To section
    doc.lineWidth(1)
       .rect(305, sectionY, 282, 90)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text('SHIP TO', 310, sectionY + 5);
    
    yPos = sectionY + 20;
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .text(bolData.shipTo.company, 310, yPos);
    yPos += 12;
    
    if (bolData.shipTo.contact) {
        doc.font('Helvetica')
           .fontSize(8)
           .text(`Contact: ${bolData.shipTo.contact}`, 310, yPos);
        yPos += 10;
    }
    
    doc.text(bolData.shipTo.address1, 310, yPos);
    yPos += 10;
    
    if (bolData.shipTo.address2) {
        doc.text(bolData.shipTo.address2, 310, yPos);
        yPos += 10;
    }
    
    doc.text(`${bolData.shipTo.city}, ${bolData.shipTo.state} ${bolData.shipTo.zip}`, 310, yPos);
    yPos += 10;
    
    doc.text(`Phone: ${bolData.shipTo.phone}`, 310, yPos);
    
    // Date and Pro Number
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .text('Date:', 200, sectionY + 60)
       .font('Helvetica')
       .text(bolData.shipDate, 220, sectionY + 60);
    
    doc.font('Helvetica-Bold')
       .text('Pro #:', 200, sectionY + 75)
       .font('Helvetica')
       .text(bolData.proNumber, 225, sectionY + 75);
}

/**
 * Draws the third party billing section
 */
function drawGenericThirdPartySection(doc, bolData) {
    const sectionY = 210;
    
    doc.lineWidth(1)
       .rect(25, sectionY, 562, 60)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text('THIRD PARTY FREIGHT CHARGES BILLED TO', 30, sectionY + 5);
    
    doc.font('Helvetica')
       .fontSize(9)
       .text(bolData.thirdParty.company, 30, sectionY + 20)
       .text(bolData.thirdParty.address1, 30, sectionY + 35)
       .text(`${bolData.thirdParty.city}, ${bolData.thirdParty.state} ${bolData.thirdParty.zip}`, 30, sectionY + 50);
    
    // Freight charges checkboxes
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .text('Freight Charges:', 350, sectionY + 20);
    
    doc.rect(350, sectionY + 35, 8, 8).stroke()
       .font('Helvetica')
       .fontSize(7)
       .text('Prepaid', 365, sectionY + 37);
    
    doc.rect(420, sectionY + 35, 8, 8).stroke()
       .text('Collect', 435, sectionY + 37);
    
    doc.rect(480, sectionY + 35, 8, 8).stroke()
       .text('3rd Party', 495, sectionY + 37);
    
    // Check the 3rd Party box
    doc.text('✓', 482, sectionY + 36);
}

/**
 * Draws special services section
 */
function drawGenericSpecialServices(doc, bolData) {
    const sectionY = 275;
    
    doc.lineWidth(1)
       .rect(25, sectionY, 562, 40)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text('SPECIAL SERVICES', 30, sectionY + 5);
    
    // List manual rate items as special services
    let servicesText = 'Manual Rate Entry: ';
    if (bolData.manualRates && bolData.manualRates.length > 0) {
        const rateItems = bolData.manualRates.map(rate => 
            `${rate.chargeName || rate.code} - $${rate.charge || '0.00'}`
        ).join(', ');
        servicesText += rateItems;
    } else {
        servicesText += 'Standard freight service';
    }
    
    doc.font('Helvetica')
       .fontSize(8)
       .text(servicesText, 30, sectionY + 20, {
           width: 520,
           height: 15
       });
}

/**
 * Draws the freight table section
 */
function drawGenericFreightTable(doc, bolData) {
    const tableY = 320;
    const tableHeight = 160;
    
    // Table border
    doc.lineWidth(1)
       .rect(25, tableY, 562, tableHeight)
       .stroke();
    
    // Column definitions
    const columns = [
        { header: 'PIECES', width: 70, x: 25 },
        { header: 'WEIGHT\n(LBS)', width: 80, x: 95 },
        { header: 'HM', width: 40, x: 175 },
        { header: 'COMMODITY DESCRIPTION', width: 250, x: 215 },
        { header: 'DIMENSIONS\nL x W x H', width: 122, x: 465 }
    ];
    
    // Draw header
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .fillColor('#000000')
       .rect(25, tableY, 562, 20)
       .stroke();
    
    columns.forEach(col => {
        doc.text(col.header, col.x + 3, tableY + 3, {
            width: col.width - 6,
            align: 'center'
        });
        
        // Column separators
        if (col.x > 25) {
            doc.moveTo(col.x, tableY)
               .lineTo(col.x, tableY + tableHeight)
               .stroke();
        }
    });
    
    // Draw data rows
    doc.font('Helvetica')
       .fontSize(8);
    
    let rowY = tableY + 25;
    const maxRows = 6;
    
    bolData.packages.slice(0, maxRows).forEach((pkg, index) => {
        columns.forEach((col, colIndex) => {
            let cellValue = '';
            switch (colIndex) {
                case 0: cellValue = pkg.pieces.toString(); break;
                case 1: cellValue = pkg.weight.toFixed(0); break;
                case 2: cellValue = ''; break; // HM
                case 3: cellValue = pkg.description; break;
                case 4: cellValue = pkg.dimensions; break;
            }
            
            doc.text(cellValue, col.x + 3, rowY, {
                width: col.width - 6,
                align: colIndex === 3 ? 'left' : 'center'
            });
        });
        
        rowY += 20;
        
        // Row separator
        if (index < bolData.packages.length - 1 && index < maxRows - 1) {
            doc.strokeColor('#CCCCCC')
               .lineWidth(0.5)
               .moveTo(25, rowY - 5)
               .lineTo(587, rowY - 5)
               .stroke()
               .strokeColor('#000000')
               .lineWidth(1);
        }
    });
    
    // Totals section
    const totalsY = tableY + tableHeight - 25;
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(25, totalsY)
       .lineTo(587, totalsY)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .text('TOTAL PIECES:', 350, totalsY + 5)
       .text(bolData.totalPieces.toString(), 450, totalsY + 5)
       .text('TOTAL WEIGHT:', 350, totalsY + 15)
       .text(`${bolData.totalWeight.toFixed(0)} LBS`, 450, totalsY + 15);
}

/**
 * Draws the signature section
 */
function drawGenericSignatureSection(doc, bolData) {
    const sigY = 485;
    const sigHeight = 100;
    const colWidth = 187;
    
    // Three signature boxes
    const signatures = [
        { title: 'SHIPPER SIGNATURE/DATE', x: 25 },
        { title: 'CARRIER SIGNATURE/DATE', x: 212 },
        { title: 'CONSIGNEE SIGNATURE/DATE', x: 399 }
    ];
    
    signatures.forEach(sig => {
        doc.lineWidth(1)
           .rect(sig.x, sigY, colWidth, sigHeight)
           .stroke();
        
        doc.font('Helvetica-Bold')
           .fontSize(8)
           .text(sig.title, sig.x + 5, sigY + 5);
        
        // Signature line
        doc.strokeColor('#000000')
           .lineWidth(0.5)
           .moveTo(sig.x + 5, sigY + 70)
           .lineTo(sig.x + 140, sigY + 70)
           .stroke();
        
        doc.font('Helvetica')
           .fontSize(7)
           .text('Signature', sig.x + 5, sigY + 75);
        
        // Date line
        doc.moveTo(sig.x + 150, sigY + 70)
           .lineTo(sig.x + 180, sigY + 70)
           .stroke();
        
        doc.text('Date', sig.x + 155, sigY + 75);
    });
    
    // Legal text at bottom
    doc.font('Helvetica')
       .fontSize(6)
       .text('Subject to the conditions of the carrier\'s tariff. Received in good order except as noted.', 25, sigY + sigHeight + 10);
}

/**
 * Stores the Generic BOL document in Firebase Storage
 */
async function storeGenericBOLDocument(pdfBuffer, shipmentId, firebaseDocId) {
    try {
        const fileName = `SOLUSHIP-${shipmentId}-BOL.pdf`;
        const bucket = storage.bucket();
        const file = bucket.file(`shipment-documents/${firebaseDocId}/${fileName}`);
        
        // Upload PDF to Firebase Storage
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
            carrier: 'Generic',
            documentType: 'bol',
            downloadUrl: downloadUrl,
            storagePath: `shipment-documents/${firebaseDocId}/${fileName}`,
            metadata: {
                genericShipmentId: shipmentId,
                documentFormat: 'PDF',
                bolGenerated: true,
                isQuickShip: true
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
            migrationNote: 'Created with unified ID structure for QuickShip',
            _isUnifiedStructure: true
        });
        
        logger.info(`Generic BOL stored:`, {
            shipmentId: firebaseDocId,
            documentId: `${firebaseDocId}_bol`,
            storagePath: documentData.storagePath
        });
        
        return {
            documentId: `${firebaseDocId}_bol`,
            downloadUrl: downloadUrl,
            fileName: fileName,
            storagePath: documentData.storagePath
        };
        
    } catch (error) {
        logger.error('Error storing Generic BOL:', error);
        throw new Error(`Failed to store BOL: ${error.message}`);
    }
}

module.exports = {
    generateGenericBOL
}; 