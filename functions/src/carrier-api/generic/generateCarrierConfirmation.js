const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const db = admin.firestore();
const storage = admin.storage();

/**
 * Generates a Carrier Confirmation PDF document for QuickShip
 * Based on the exact format from Generic_Carrier_Confirmation.pdf template
 * @param {Object} request - Firebase function request containing shipment data
 * @returns {Object} - Success/error response with document download URL
 */
const generateCarrierConfirmation = onCall(async (request) => {
    try {
        const { shipmentId, firebaseDocId, carrierDetails } = request.data;
        
        logger.info('generateCarrierConfirmation called with:', { 
            shipmentId, 
            firebaseDocId,
            carrierName: carrierDetails?.name 
        });
        
        // Validate required parameters
        if (!shipmentId) {
            throw new Error('Shipment ID is required');
        }
        
        if (!firebaseDocId) {
            throw new Error('Firebase document ID is required');
        }
        
        if (!carrierDetails) {
            throw new Error('Carrier details are required');
        }
        
        // Get shipment data from Firestore
        // First try to get by document ID (for when firebaseDocId is the actual doc ID)
        let shipmentDoc = await db.collection('shipments').doc(firebaseDocId).get();
        let shipmentData = null;
        
        if (shipmentDoc.exists) {
            shipmentData = shipmentDoc.data();
            logger.info('Retrieved shipment data by document ID for Carrier Confirmation generation');
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
        
        // Extract data for confirmation generation
        const confirmationData = extractCarrierConfirmationData(shipmentData, shipmentId, carrierDetails);
        
        // Generate the PDF confirmation
        const pdfBuffer = await generateCarrierConfirmationPDF(confirmationData);
        
        // Store the confirmation document
        const documentInfo = await storeCarrierConfirmationDocument(pdfBuffer, shipmentId, firebaseDocId);
        
        logger.info('Carrier Confirmation generation completed successfully');
        
        return {
            success: true,
            message: 'Carrier Confirmation generated successfully',
            data: {
                ...documentInfo,
                shipmentId: shipmentId,
                firebaseDocId: firebaseDocId,
                carrierName: carrierDetails.name
            }
        };
        
    } catch (error) {
        logger.error('Error in generateCarrierConfirmation:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
});

/**
 * Extracts and formats data from shipment for Carrier Confirmation generation
 * @param {Object} shipmentData - Firestore shipment document data
 * @param {string} shipmentId - Shipment ID
 * @param {Object} carrierDetails - Carrier contact information
 * @returns {Object} - Formatted confirmation data
 */
function extractCarrierConfirmationData(shipmentData, shipmentId, carrierDetails) {
    console.log('extractCarrierConfirmationData: Processing shipment data for Carrier Confirmation');
    
    // Extract addresses
    const shipFrom = shipmentData.shipFrom || {};
    const shipTo = shipmentData.shipTo || {};
    
    // Extract packages
    const packages = shipmentData.packages || [];
    
    // Extract shipment details
    const referenceNumber = shipmentData.shipmentInfo?.shipperReferenceNumber || 
                          shipmentData.referenceNumber || 
                          '';
    
    // Format ship date
    const shipDate = shipmentData.shipmentInfo?.shipmentDate || 
                    new Date().toISOString().split('T')[0];
    
    const formattedShipDate = new Date(shipDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Calculate totals
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
    
    // Extract rate information
    const manualRates = shipmentData.manualRates || [];
    const totalCharges = shipmentData.totalCharges || 0;
    
    return {
        // Confirmation header info
        confirmationNumber: `CONF-${shipmentId}`,
        orderNumber: shipmentId,
        shipDate: formattedShipDate,
        todayDate: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        
        // Carrier information
        carrier: {
            name: carrierDetails.name || 'Unknown Carrier',
            contactName: carrierDetails.contactName || '',
            contactEmail: carrierDetails.contactEmail || ''
        },
        
        // Customer/Shipper information
        shipper: {
            company: shipFrom?.companyName || shipFrom?.company || 'Unknown Shipper',
            contact: shipFrom?.contact || shipFrom?.contactName || '',
            address: `${shipFrom?.street || ''} ${shipFrom?.street2 || ''}`.trim(),
            city: shipFrom?.city || '',
            state: shipFrom?.state || '',
            zip: shipFrom?.postalCode || '',
            phone: shipFrom?.phone || ''
        },
        
        // Consignee information
        consignee: {
            company: shipTo?.companyName || shipTo?.company || 'Unknown Consignee',
            contact: shipTo?.contact || shipTo?.contactName || '',
            address: `${shipTo?.street || ''} ${shipTo?.street2 || ''}`.trim(),
            city: shipTo?.city || '',
            state: shipTo?.state || '',
            zip: shipTo?.postalCode || '',
            phone: shipTo?.phone || ''
        },
        
        // Shipment details
        referenceNumber: referenceNumber,
        totalPieces: totalPieces,
        totalWeight: totalWeight,
        totalCharges: totalCharges,
        currency: shipmentData.currency || 'CAD',
        
        // Package details
        packages: packages.map((pkg, index) => {
            // Ensure numeric values for individual packages
            const rawWeight = pkg.weight || pkg.totalWeight || 0;
            const weight = parseFloat(String(rawWeight).replace(/[^\d.-]/g, '')) || 0;
            
            const rawQuantity = pkg.quantity || pkg.packagingQuantity || pkg.pieces || 1;
            const pieces = parseInt(String(rawQuantity).replace(/[^\d]/g, '')) || 1;
            
            return {
                pieces: pieces,
                weight: weight,
                description: pkg.description || pkg.itemDescription || 'General Freight',
                dimensions: pkg.length && pkg.width && pkg.height ? 
                           `${pkg.length}" × ${pkg.width}" × ${pkg.height}"` : 'N/A'
            };
        }),
        
        // Rate breakdown
        rateBreakdown: manualRates.map(rate => ({
            description: rate.chargeName || rate.code || 'Freight Charge',
            amount: parseFloat(rate.charge || 0),
            currency: rate.chargeCurrency || 'CAD'
        })),
        
        // Service instructions
        specialInstructions: shipmentData.shipmentInfo?.notes || 
                           'Standard freight service'
    };
}

/**
 * Generates the Carrier Confirmation PDF document using PDFKit
 * @param {Object} confirmationData - Formatted confirmation data
 * @returns {Buffer} - PDF buffer
 */
async function generateCarrierConfirmationPDF(confirmationData) {
    return new Promise((resolve, reject) => {
        try {
            // Create PDF document (Letter size: 612 x 792 points)
            const doc = new PDFDocument({
                size: 'letter',
                margin: 40,
                info: {
                    Title: `Carrier Confirmation ${confirmationData.confirmationNumber}`,
                    Author: 'Integrated Carriers SoluShip',
                    Subject: 'Carrier Confirmation',
                    Keywords: 'Carrier, Confirmation, QuickShip, Freight'
                }
            });
            
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);
            
            // Build the confirmation document
            buildCarrierConfirmationDocument(doc, confirmationData);
            
            // Finalize the PDF
            doc.end();
            
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Builds the complete Carrier Confirmation document
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {Object} confirmationData - Confirmation data
 */
function buildCarrierConfirmationDocument(doc, confirmationData) {
    // Header with logo and title
    drawConfirmationHeader(doc, confirmationData);
    
    // Carrier and shipment info
    drawCarrierInfo(doc, confirmationData);
    
    // Pickup and delivery addresses
    drawAddressInfo(doc, confirmationData);
    
    // Shipment details table
    drawShipmentDetails(doc, confirmationData);
    
    // Rate breakdown
    drawRateBreakdown(doc, confirmationData);
    
    // Special instructions and footer
    drawInstructionsAndFooter(doc, confirmationData);
}

/**
 * Draws the confirmation header with branding
 */
function drawConfirmationHeader(doc, confirmationData) {
    // Company logo/name
    try {
        const logoPath = path.join(__dirname, '../../assets/SolushipX_black.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 40, 40, {
                width: 120,
                height: 40
            });
        } else {
            // Fallback to text
            doc.font('Helvetica-Bold')
               .fontSize(18)
               .text('INTEGRATED CARRIERS', 40, 45);
        }
    } catch (error) {
        // Fallback to text
        doc.font('Helvetica-Bold')
           .fontSize(18)
           .text('INTEGRATED CARRIERS', 40, 45);
    }
    
    // Title
    doc.font('Helvetica-Bold')
       .fontSize(24)
       .fillColor('#1976d2')
       .text('CARRIER CONFIRMATION', 40, 100, {
           width: 532,
           align: 'center'
       });
    
    // Confirmation details box
    doc.fillColor('#000000')
       .strokeColor('#1976d2')
       .lineWidth(2)
       .rect(350, 40, 222, 80)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text('CONFIRMATION #:', 360, 50)
       .font('Helvetica')
       .fontSize(12)
       .text(confirmationData.confirmationNumber, 360, 65);
    
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text('ORDER #:', 360, 85)
       .font('Helvetica')
       .fontSize(12)
       .text(confirmationData.orderNumber, 360, 100);
    
    // Date
    doc.font('Helvetica')
       .fontSize(10)
       .text(`Generated: ${confirmationData.todayDate}`, 40, 140);
    
    // Horizontal line
    doc.strokeColor('#cccccc')
       .lineWidth(1)
       .moveTo(40, 160)
       .lineTo(572, 160)
       .stroke();
}

/**
 * Draws carrier and basic shipment information
 */
function drawCarrierInfo(doc, confirmationData) {
    let yPos = 180;
    
    // Carrier section
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor('#1976d2')
       .text('CARRIER INFORMATION', 40, yPos);
    
    yPos += 25;
    
    doc.fillColor('#000000')
       .font('Helvetica-Bold')
       .fontSize(12)
       .text(`Carrier: ${confirmationData.carrier.name}`, 40, yPos);
    
    yPos += 15;
    
    if (confirmationData.carrier.contactName) {
        doc.font('Helvetica')
           .fontSize(10)
           .text(`Contact: ${confirmationData.carrier.contactName}`, 40, yPos);
        yPos += 12;
    }
    
    if (confirmationData.carrier.contactEmail) {
        doc.text(`Email: ${confirmationData.carrier.contactEmail}`, 40, yPos);
        yPos += 12;
    }
    
    // Shipment overview section
    yPos += 20;
    
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor('#1976d2')
       .text('SHIPMENT OVERVIEW', 40, yPos);
    
    yPos += 25;
    
    doc.fillColor('#000000')
       .font('Helvetica')
       .fontSize(10);
    
    // Two column layout for shipment details
    const leftColumn = [
        `Ship Date: ${confirmationData.shipDate}`,
        `Reference #: ${confirmationData.referenceNumber || 'N/A'}`,
        `Total Pieces: ${confirmationData.totalPieces}`
    ];
    
    const rightColumn = [
        `Order #: ${confirmationData.orderNumber}`,
        `Total Weight: ${confirmationData.totalWeight.toFixed(1)} lbs`,
        `Total Charges: ${confirmationData.currency} $${confirmationData.totalCharges.toFixed(2)}`
    ];
    
    leftColumn.forEach((text, index) => {
        doc.text(text, 40, yPos + (index * 15));
    });
    
    rightColumn.forEach((text, index) => {
        doc.text(text, 300, yPos + (index * 15));
    });
    
    return yPos + 60;
}

/**
 * Draws pickup and delivery address information
 */
function drawAddressInfo(doc, confirmationData) {
    let yPos = 320;
    
    // Addresses section header
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor('#1976d2')
       .text('PICKUP & DELIVERY ADDRESSES', 40, yPos);
    
    yPos += 30;
    
    // Two column layout for addresses
    const leftWidth = 250;
    const rightX = 300;
    
    // Pickup address (left)
    doc.fillColor('#000000')
       .font('Helvetica-Bold')
       .fontSize(12)
       .text('PICKUP FROM:', 40, yPos);
    
    yPos += 20;
    
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text(confirmationData.shipper.company, 40, yPos, { width: leftWidth });
    
    yPos += 12;
    
    if (confirmationData.shipper.contact) {
        doc.font('Helvetica')
           .fontSize(9)
           .text(`Contact: ${confirmationData.shipper.contact}`, 40, yPos, { width: leftWidth });
        yPos += 10;
    }
    
    doc.text(confirmationData.shipper.address, 40, yPos, { width: leftWidth });
    yPos += 10;
    
    doc.text(`${confirmationData.shipper.city}, ${confirmationData.shipper.state} ${confirmationData.shipper.zip}`, 40, yPos, { width: leftWidth });
    yPos += 10;
    
    if (confirmationData.shipper.phone) {
        doc.text(`Phone: ${confirmationData.shipper.phone}`, 40, yPos, { width: leftWidth });
    }
    
    // Reset yPos for delivery address (right column)
    yPos = 370;
    
    // Delivery address (right)
    doc.font('Helvetica-Bold')
       .fontSize(12)
       .text('DELIVER TO:', rightX, yPos);
    
    yPos += 20;
    
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text(confirmationData.consignee.company, rightX, yPos, { width: leftWidth });
    
    yPos += 12;
    
    if (confirmationData.consignee.contact) {
        doc.font('Helvetica')
           .fontSize(9)
           .text(`Contact: ${confirmationData.consignee.contact}`, rightX, yPos, { width: leftWidth });
        yPos += 10;
    }
    
    doc.text(confirmationData.consignee.address, rightX, yPos, { width: leftWidth });
    yPos += 10;
    
    doc.text(`${confirmationData.consignee.city}, ${confirmationData.consignee.state} ${confirmationData.consignee.zip}`, rightX, yPos, { width: leftWidth });
    yPos += 10;
    
    if (confirmationData.consignee.phone) {
        doc.text(`Phone: ${confirmationData.consignee.phone}`, rightX, yPos, { width: leftWidth });
    }
    
    return Math.max(yPos, 450);
}

/**
 * Draws shipment details table
 */
function drawShipmentDetails(doc, confirmationData) {
    let yPos = 480;
    
    // Section header
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor('#1976d2')
       .text('SHIPMENT DETAILS', 40, yPos);
    
    yPos += 30;
    
    // Table header
    const tableTop = yPos;
    const tableHeight = 20;
    
    doc.fillColor('#f5f5f5')
       .rect(40, tableTop, 532, tableHeight)
       .fill();
    
    doc.fillColor('#000000')
       .strokeColor('#cccccc')
       .lineWidth(1)
       .rect(40, tableTop, 532, tableHeight)
       .stroke();
    
    // Column headers
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .text('PIECES', 45, tableTop + 6)
       .text('WEIGHT', 120, tableTop + 6)
       .text('DESCRIPTION', 200, tableTop + 6)
       .text('DIMENSIONS', 450, tableTop + 6);
    
    yPos += tableHeight;
    
    // Table rows
    confirmationData.packages.forEach((pkg, index) => {
        if (index % 2 === 1) {
            doc.fillColor('#fafafa')
               .rect(40, yPos, 532, 18)
               .fill();
        }
        
        doc.fillColor('#000000')
           .strokeColor('#cccccc')
           .lineWidth(0.5)
           .rect(40, yPos, 532, 18)
           .stroke();
        
        doc.font('Helvetica')
           .fontSize(9)
           .text(pkg.pieces.toString(), 45, yPos + 5)
           .text(`${pkg.weight.toFixed(1)} lbs`, 120, yPos + 5)
           .text(pkg.description, 200, yPos + 5, { width: 240 })
           .text(pkg.dimensions, 450, yPos + 5);
        
        yPos += 18;
    });
    
    return yPos + 20;
}

/**
 * Draws rate breakdown section
 */
function drawRateBreakdown(doc, confirmationData) {
    let yPos = 580;
    
    // Only show if there are rate details
    if (confirmationData.rateBreakdown.length > 0) {
        doc.font('Helvetica-Bold')
           .fontSize(14)
           .fillColor('#1976d2')
           .text('RATE BREAKDOWN', 40, yPos);
        
        yPos += 25;
        
        confirmationData.rateBreakdown.forEach(rate => {
            doc.fillColor('#000000')
               .font('Helvetica')
               .fontSize(10)
               .text(`${rate.description}:`, 40, yPos)
               .text(`${rate.currency} $${rate.amount.toFixed(2)}`, 450, yPos, { align: 'right' });
            yPos += 15;
        });
        
        // Total line
        doc.strokeColor('#cccccc')
           .lineWidth(1)
           .moveTo(40, yPos)
           .lineTo(572, yPos)
           .stroke();
        
        yPos += 10;
        
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .text('TOTAL CHARGES:', 40, yPos)
           .text(`${confirmationData.currency} $${confirmationData.totalCharges.toFixed(2)}`, 450, yPos, { align: 'right' });
        
        yPos += 30;
    }
    
    return yPos;
}

/**
 * Draws special instructions and footer
 */
function drawInstructionsAndFooter(doc, confirmationData) {
    let yPos = 650;
    
    // Special instructions
    doc.font('Helvetica-Bold')
       .fontSize(12)
       .fillColor('#1976d2')
       .text('SPECIAL INSTRUCTIONS:', 40, yPos);
    
    yPos += 20;
    
    doc.fillColor('#000000')
       .font('Helvetica')
       .fontSize(10)
       .text(confirmationData.specialInstructions, 40, yPos, {
           width: 532,
           height: 40
       });
    
    yPos += 60;
    
    // Footer
    doc.strokeColor('#cccccc')
       .lineWidth(1)
       .moveTo(40, yPos)
       .lineTo(572, yPos)
       .stroke();
    
    yPos += 15;
    
    doc.font('Helvetica')
       .fontSize(9)
       .fillColor('#666666')
       .text('This confirmation serves as notification of your freight pickup assignment.', 40, yPos, {
           width: 532,
           align: 'center'
       });
    
    yPos += 12;
    
    doc.text('Please confirm receipt and expected pickup time by replying to this confirmation.', 40, yPos, {
        width: 532,
        align: 'center'
    });
    
    yPos += 12;
    
    doc.text('For questions or concerns, please contact Integrated Carriers at your earliest convenience.', 40, yPos, {
        width: 532,
        align: 'center'
    });
}

/**
 * Stores the Carrier Confirmation document in Firebase Storage
 */
async function storeCarrierConfirmationDocument(pdfBuffer, shipmentId, firebaseDocId) {
    try {
        const fileName = `SOLUSHIP-${shipmentId}-CARRIER-CONFIRMATION.pdf`;
        const bucket = storage.bucket();
        const file = bucket.file(`shipment-documents/${firebaseDocId}/${fileName}`);
        
        // Upload PDF to Firebase Storage
        await file.save(pdfBuffer, {
            metadata: {
                contentType: 'application/pdf',
                metadata: {
                    shipmentId: shipmentId,
                    documentType: 'carrier_confirmation',
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
            docType: 7, // Custom type for carrier confirmations
            fileSize: pdfBuffer.length,
            documentType: 'carrier_confirmation',
            downloadUrl: downloadUrl,
            storagePath: `shipment-documents/${firebaseDocId}/${fileName}`,
            metadata: {
                shipmentId: shipmentId,
                documentFormat: 'PDF',
                confirmationGenerated: true,
                isQuickShip: true
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            _isUnifiedStructure: true
        };
        
        // Store in unified structure
        const unifiedDocRef = db.collection('shipments').doc(firebaseDocId)
                                .collection('documents').doc(`${firebaseDocId}_carrier_confirmation`);
        await unifiedDocRef.set(documentData);
        
        // Store in main collection
        const legacyDocRef = db.collection('shipmentDocuments').doc(`${firebaseDocId}_carrier_confirmation`);
        await legacyDocRef.set({
            ...documentData,
            unifiedDocumentId: `${firebaseDocId}_carrier_confirmation`,
            migrationNote: 'Created for QuickShip carrier confirmation',
            _isUnifiedStructure: true
        });
        
        logger.info(`Carrier Confirmation stored:`, {
            shipmentId: firebaseDocId,
            documentId: `${firebaseDocId}_carrier_confirmation`,
            storagePath: documentData.storagePath
        });
        
        return {
            documentId: `${firebaseDocId}_carrier_confirmation`,
            downloadUrl: downloadUrl,
            fileName: fileName,
            storagePath: documentData.storagePath
        };
        
    } catch (error) {
        logger.error('Error storing Carrier Confirmation:', error);
        throw new Error(`Failed to store Carrier Confirmation: ${error.message}`);
    }
}

module.exports = {
    generateCarrierConfirmation
}; 