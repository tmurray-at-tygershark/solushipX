const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const functions = require('firebase-functions');

const db = admin.firestore();
const storage = admin.storage();

/**
 * Generates an eShipPlus/Integrated Carriers Bill of Lading (BOL) PDF document
 * Based on the exact format from Integrated Carriers BOL template
 * @param {Object} request - Firebase function request containing shipment data
 * @returns {Object} - Success/error response with document download URL
 */
exports.generateEShipPlusBOL = onCall({
    cors: true,
    timeoutSeconds: 120,
    memory: "512MiB",
    region: 'us-central1'
}, async (request) => {
    const { shipmentId, firebaseDocId, overwriteDocumentId } = request.data;
    return await generateEShipPlusBOLInternal(shipmentId, firebaseDocId, overwriteDocumentId);
});

/**
 * Internal function for generating eShipPlus BOL - can be called directly from other functions
 * @param {string} shipmentId - eShipPlus shipment ID
 * @param {string} firebaseDocId - Firebase document ID
 * @param {string} overwriteDocumentId - Optional document ID to overwrite
 * @returns {Object} - Success/error response with document download URL
 */
async function generateEShipPlusBOLInternal(shipmentId, firebaseDocId, overwriteDocumentId = null) {
    try {
        logger.info('🚀 Starting eShipPlus BOL generation function (internal)');

        logger.info('📝 Request parameters:', {
            shipmentId,
            firebaseDocId,
            overwriteDocumentId: overwriteDocumentId || 'None - will create new'
        });
        
        if (!shipmentId || !firebaseDocId) {
            throw new functions.https.HttpsError('invalid-argument', 'shipmentId and firebaseDocId are required');
        }

        logger.info('🔍 Fetching shipment data from Firestore...');
        
        // Get shipment data from Firestore
        const shipmentDoc = await db.collection('shipments').doc(firebaseDocId).get();
        if (!shipmentDoc.exists) {
            throw new functions.https.HttpsError('not-found', `Shipment ${firebaseDocId} not found`);
        }
        
        const shipmentData = shipmentDoc.data();
        logger.info('✅ Retrieved shipment data for eShipPlus BOL generation:', {
            hasData: !!shipmentData,
            dataKeys: shipmentData ? Object.keys(shipmentData).slice(0, 10) : 'No data' // Log first 10 keys
        });
        
        // Extract data for BOL generation
        logger.info('🔧 Extracting BOL data...');
        const bolData = extractEShipPlusBOLData(shipmentData, shipmentId);
        
        if (!bolData) {
            throw new functions.https.HttpsError('internal', 'Failed to extract BOL data from shipment');
        }
        
        logger.info('📄 Generating PDF BOL...');
        
        // Generate the PDF BOL
        const pdfBuffer = await generateEShipPlusBOLPDF(bolData);
        
        if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new functions.https.HttpsError('internal', 'Failed to generate PDF buffer');
        }
        
        logger.info('💾 Storing BOL document...', { bufferSize: pdfBuffer.length });
        
        // Store the BOL document
        const documentInfo = await storeEShipPlusBOLDocument(pdfBuffer, shipmentId, firebaseDocId, overwriteDocumentId);
        
        logger.info('✅ eShipPlus BOL generation completed successfully:', documentInfo);
        
        return {
            success: true,
            message: 'eShipPlus BOL generated successfully',
            data: {
                ...documentInfo,
                shipmentId: shipmentId,
                firebaseDocId: firebaseDocId
            }
        };
        
    } catch (error) {
        logger.error('❌ Error in generateEShipPlusBOLInternal:', {
            error: error.message,
            code: error.code,
            stack: error.stack,
            shipmentId,
            firebaseDocId
        });

        // If it's already an HttpsError, re-throw it
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        // Otherwise, wrap it in an HttpsError
        throw new functions.https.HttpsError('internal', `Failed to generate eShipPlus BOL: ${error.message}`);
    }
}

/**
 * Export the internal function for direct calls from other functions
 */
exports.generateEShipPlusBOLInternal = generateEShipPlusBOLInternal;

/**
 * Extracts and formats data from shipment for eShipPlus BOL generation
 * Enhanced to handle multiple data formats and ensure complete data extraction
 * @param {Object} shipmentData - Firestore shipment document data
 * @param {string} shipmentId - eShipPlus shipment ID
 * @returns {Object} - Formatted BOL data
 */
function extractEShipPlusBOLData(shipmentData, shipmentId) {
    try {
        logger.info('🔍 Extracting BOL data from shipment:', {
            shipmentId,
            hasShipmentData: !!shipmentData,
            shipmentDataKeys: shipmentData ? Object.keys(shipmentData) : 'No data'
        });

        if (!shipmentData) {
            throw new Error('Shipment data is required for BOL generation');
        }

        // Extract addresses - handle multiple possible formats
        const shipFrom = shipmentData.shipFrom || 
                        shipmentData.shipment?.pickup_address || 
                        shipmentData.pickup_address ||
                        shipmentData.Origin ||
                        {};
                        
        const shipTo = shipmentData.shipTo || 
                      shipmentData.shipment?.delivery_address || 
                      shipmentData.delivery_address ||
                      shipmentData.Destination ||
                      {};
        
        logger.info('📍 Address extraction:', {
            hasShipFrom: !!shipFrom,
            hasShipTo: !!shipTo,
            shipFromCompany: shipFrom?.companyName || shipFrom?.company || 'Unknown',
            shipToCompany: shipTo?.companyName || shipTo?.company || 'Unknown'
        });
        
        // Extract packages - handle multiple possible formats
        const packages = shipmentData.packages || 
                        shipmentData.shipment?.packages || 
                        shipmentData.Items || 
                        shipmentData.packageDetails ||
                        [];
        
        logger.info('📦 Package extraction:', {
            packagesCount: packages.length,
            packagesType: Array.isArray(packages) ? 'array' : typeof packages
        });
        
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
        
        // USE SHIPMENT ID AS BOL NUMBER (Requirement #2)
        const bolNumber = shipmentId || `BOL-${Date.now()}`;
        
        // Extract carrier order confirmation number for Quote Number (Requirement #5)
        const carrierOrderNumber = booking.confirmationNumber || 
                                  booking.orderNumber ||
                                  booking.Order_Number ||
                                  booking.order_number ||
                                  booking.proNumber ||
                                  shipmentData.carrierBookingConfirmation?.confirmationNumber ||
                                  `P${Date.now()}`;
        
        // Generate Order Number (different from BOL for eShipPlus)
        const orderNumber = booking.orderNumber ||
                           booking.Order_Number ||
                           booking.confirmationNumber ||
                           booking.proNumber ||
                           `ORD-${Date.now()}`;
        
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
        
        // Extract PO Number
        const poNumber = shipmentData.shipmentInfo?.poNumber ||
                        shipmentData.poNumber ||
                        booking.poNumber ||
                        booking.PurchaseOrder ||
                        '';
        
        // Extract Pickup Reference
        const pickupRef = shipmentData.shipmentInfo?.pickupReference ||
                         shipmentData.pickupReference ||
                         booking.pickupReference ||
                         referenceNumber ||
                         '';
        
        // Calculate total weight and piece count
        let totalWeight = 0;
        let totalPieces = 0;
        
        if (Array.isArray(packages)) {
            packages.forEach(pkg => {
                const weight = parseFloat(pkg.weight || pkg.reported_weight || pkg.Weight || pkg.packageWeight || 0);
                const quantity = parseInt(pkg.quantity || pkg.PackagingQuantity || pkg.pieces || 1);
                
                totalWeight += weight;
                totalPieces += quantity;
            });
        } else {
            logger.warn('⚠️ Packages is not an array, defaulting to empty packages');
        }
        
        // Extract carrier/route information - for eShipPlus, this comes from selected rate
        const selectedRate = shipmentData.selectedRate || shipmentData.selectedRateRef || {};
        const carrierInfo = selectedRate.carrierName || selectedRate.carrier || 'WARD TRUCKING';
        
        // Extract pickup and delivery instructions
        const pickupInstructions = shipmentData.shipmentInfo?.pickupSpecialInstructions ||
                                  shipmentData.pickup_instructions ||
                                  shipmentData.specialInstructions?.pickup ||
                                  booking.pickupInstructions ||
                                  '';
        
        const deliveryInstructions = shipmentData.shipmentInfo?.deliverySpecialInstructions ||
                                    shipmentData.delivery_instructions ||
                                    shipmentData.specialInstructions?.delivery ||
                                    booking.deliveryInstructions ||
                                    '';

        const bolData = {
            // Header Information - USE SHIPMENT ID AS BOL NUMBER
            bolNumber: bolNumber,
            orderNumber: orderNumber,
            shipDate: formattedShipDate,
            
            // Ship From Information - FIXED to use companyName over nickname
            shipFrom: {
                company: shipFrom?.companyName || shipFrom?.company || shipFrom?.Company || shipFrom?.Description || shipFrom?.name || 'Unknown Shipper',
                contact: shipFrom?.contact || shipFrom?.attention || shipFrom?.contactName || shipFrom?.Contact || '',
                address1: shipFrom?.address_line_1 || shipFrom?.street || shipFrom?.addressLine1 || shipFrom?.address1 || shipFrom?.Street || '',
                address2: shipFrom?.address_line_2 || shipFrom?.street2 || shipTo?.addressLine2 || shipTo?.address2 || shipTo?.StreetExtra || '',
                city: shipFrom?.city || shipFrom?.City || '',
                state: shipFrom?.province || shipFrom?.state || shipFrom?.State || '',
                zip: shipFrom?.postal_code || shipFrom?.postalCode || shipFrom?.zip || shipFrom?.PostalCode || '',
                phone: shipFrom?.phone || shipFrom?.Phone || shipFrom?.contactPhone || '',
                fax: shipFrom?.fax || shipFrom?.Fax || '',
            },
            
            // Ship To Information - FIXED to use companyName over nickname  
            shipTo: {
                company: shipTo?.companyName || shipTo?.company || shipTo?.Company || shipTo?.Description || shipTo?.name || 'Unknown Consignee',
                contact: shipTo?.contact || shipTo?.attention || shipTo?.contactName || shipTo?.Contact || '',
                address1: shipTo?.address_line_1 || shipTo?.street || shipTo?.addressLine1 || shipTo?.address1 || shipTo?.Street || '',
                address2: shipTo?.address_line_2 || shipTo?.street2 || shipTo?.addressLine2 || shipTo?.address2 || shipTo?.StreetExtra || '',
                city: shipTo?.city || shipTo?.City || '',
                state: shipTo?.province || shipTo?.state || shipTo?.State || '',
                zip: shipTo?.postal_code || shipTo?.postalCode || shipTo?.zip || shipTo?.PostalCode || '',
                phone: shipTo?.phone || shipTo?.Phone || shipTo?.contactPhone || '',
                fax: shipTo?.fax || shipTo?.Fax || '',
            },
            
            // Reference Information
            poNumber: poNumber,
            pickupRef: pickupRef,
            
            // Carrier Information
            carrierRoute: carrierInfo,
            
            // Pickup/Delivery Information
            pickupInstructions: pickupInstructions,
            deliveryInstructions: deliveryInstructions,
            
            // Pickup window
            pickupEarliest: shipmentData.shipmentInfo?.earliestPickup || '14:00',
            pickupLatest: shipmentData.shipmentInfo?.latestPickup || '17:00',
            
            // Billing Information (Logistics Plus from the document)
            billTo: {
                company: 'Logistics Plus',
                address1: '1355 Windward Concourse',
                address2: 'Suite 205',
                city: 'Alpharetta',
                state: 'GA',
                zip: '30005'
            },
            
            // Quote Information - USE CARRIER ORDER CONFIRMATION NUMBER (Requirement #5)
            quoteNumber: carrierOrderNumber,
            
            // Package Information - Enhanced mapping
            packages: Array.isArray(packages) ? packages.map((pkg, index) => {
                const weight = parseFloat(pkg.weight || pkg.reported_weight || pkg.Weight || pkg.packageWeight || 0);
                const freightClass = pkg.freightClass || 
                                   pkg.FreightClass || 
                                   pkg.freight_class ||
                                   pkg.class ||
                                   70; // Default class
                
                return {
                    quantity: parseInt(pkg.quantity || pkg.PackagingQuantity || pkg.pieces || 1),
                    description: pkg.description || 
                               pkg.commodity_description || 
                               pkg.Description || 
                               pkg.itemDescription ||
                               pkg.commodityDescription ||
                               'GENERAL FREIGHT', // Default description
                    weight: weight,
                    freightClass: freightClass,
                    stcNumber: pkg.stcNumber || pkg.STC || '', // STC # column
                };
            }) : [{
                quantity: 1,
                description: 'GENERAL FREIGHT',
                weight: 100,
                freightClass: 70,
                stcNumber: ''
            }],
            
            // Totals
            totalWeight: totalWeight > 0 ? totalWeight : 100, // Default weight if none calculated
            
            // Store complete shipment data for reference
            shipmentData: shipmentData
        };

        logger.info('✅ BOL data extraction completed:', {
            bolNumber: bolData.bolNumber,
            orderNumber: bolData.orderNumber,
            quoteNumber: bolData.quoteNumber,
            totalWeight: bolData.totalWeight,
            packagesCount: bolData.packages.length
        });

        return bolData;

    } catch (error) {
        logger.error('❌ Error extracting BOL data:', {
            error: error.message,
            stack: error.stack,
            shipmentId,
            hasShipmentData: !!shipmentData
        });
        
        // Return a minimal valid structure to prevent complete failure
        return {
            bolNumber: shipmentId || `BOL-${Date.now()}`, // Use shipment ID
            orderNumber: `ORD-${Date.now()}`,
            shipDate: new Date().toLocaleDateString('en-US'),
            shipFrom: {
                company: 'Unknown Shipper',
                contact: '',
                address1: '',
                address2: '',
                city: '',
                state: '',
                zip: '',
                phone: '',
                fax: ''
            },
            shipTo: {
                company: 'Unknown Consignee',
                contact: '',
                address1: '',
                address2: '',
                city: '',
                state: '',
                zip: '',
                phone: '',
                fax: ''
            },
            poNumber: '',
            pickupRef: '',
            carrierRoute: 'WARD TRUCKING',
            pickupInstructions: '',
            deliveryInstructions: '',
            pickupEarliest: '14:00',
            pickupLatest: '17:00',
            billTo: {
                company: 'Logistics Plus',
                address1: '1355 Windward Concourse',
                address2: 'Suite 205',
                city: 'Alpharetta',
                state: 'GA',
                zip: '30005'
            },
            quoteNumber: `P${Date.now()}`, // Default carrier order number format
            packages: [{
                quantity: 1,
                description: 'GENERAL FREIGHT',
                weight: 100,
                freightClass: 70,
                stcNumber: ''
            }],
            totalWeight: 100,
            shipmentData: shipmentData || {}
        };
    }
}

/**
 * Generates the eShipPlus BOL PDF document using PDFKit with exact positioning
 * @param {Object} bolData - Formatted BOL data
 * @returns {Buffer} - PDF buffer
 */
async function generateEShipPlusBOLPDF(bolData) {
    return new Promise((resolve, reject) => {
        try {
            logger.info('🔧 Starting PDF generation with bolData:', {
                bolNumber: bolData?.bolNumber,
                orderNumber: bolData?.orderNumber,
                hasShipFrom: !!bolData?.shipFrom,
                hasShipTo: !!bolData?.shipTo,
                packagesCount: bolData?.packages?.length || 0
            });

            // Validate bolData before PDF creation
            if (!bolData) {
                throw new Error('bolData is required for PDF generation');
            }

            if (!bolData.bolNumber) {
                logger.warn('⚠️ Missing bolNumber, using fallback');
                bolData.bolNumber = `BOL-${Date.now()}`;
            }

            logger.info('📄 Creating PDFDocument with bolNumber:', bolData.bolNumber);

            // Create PDF document (Letter size: 612 x 792 points) with no margins for exact positioning
            const doc = new PDFDocument({
                size: 'letter',
                margin: 0,
                info: {
                    Title: `BOL ${bolData.bolNumber} - Integrated Carriers`,
                    Author: 'Integrated Carriers SoluShip',
                    Subject: 'Bill of Lading',
                    Keywords: 'BOL, Bill of Lading, Integrated Carriers, eShipPlus, Freight'
                }
            });

            logger.info('✅ PDFDocument created successfully');

            // Validate that doc was created properly
            if (!doc || typeof doc.on !== 'function') {
                throw new Error('PDFDocument creation failed - doc is not a valid EventEmitter');
            }

            const chunks = [];
            
            doc.on('data', chunk => {
                logger.debug('📊 PDF chunk received, size:', chunk.length);
                chunks.push(chunk);
            });
            
            doc.on('end', () => {
                try {
                    const pdfBuffer = Buffer.concat(chunks);
                    logger.info('✅ PDF generation completed, buffer size:', pdfBuffer.length);
                    resolve(pdfBuffer);
                } catch (bufferError) {
                    logger.error('❌ Error creating PDF buffer:', bufferError);
                    reject(bufferError);
                }
            });
            
            doc.on('error', (error) => {
                logger.error('❌ PDFDocument error:', error);
                reject(error);
            });

            logger.info('🎨 Building BOL document content...');
            
            // Build the BOL document with exact positioning
            buildExactEShipPlusBOLDocument(doc, bolData);
            
            logger.info('📝 Finalizing PDF document...');
            
            // Finalize the PDF
            doc.end();
            
        } catch (error) {
            logger.error('❌ Error in generateEShipPlusBOLPDF:', {
                error: error.message,
                stack: error.stack,
                bolDataKeys: bolData ? Object.keys(bolData) : 'bolData is null/undefined'
            });
            reject(error);
        }
    });
}

/**
 * Builds the complete eShipPlus BOL document with exact pixel positioning to match INTEGRATED CARRIERS format
 * EXACT MATCH FOR 8.5x11 (LETTER SIZE) FORMAT - OPTIMIZED TO FIT ON ONE PAGE
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {Object} bolData - BOL data
 */
function buildExactEShipPlusBOLDocument(doc, bolData) {
    // Set default stroke and fill colors
    doc.strokeColor('#000000').fillColor('#000000');
    
    // Main container border (full page border) - SIZED FOR 8.5x11 (612x792 points)
    doc.lineWidth(1)
       .rect(15, 15, 582, 762) // Reduced margins to fit more content
       .stroke();
    
    // Header Section (Y: 15-140) - SMALLER HEADER to prevent overflow
    drawSolushipXHeader(doc, bolData);
    
    // Origin/Destination Section (Y: 145-245) - REDUCED HEIGHT
    drawIntegratedCarriersOriginDestination(doc, bolData);
    
    // References and Instructions Section (Y: 250-320) - REDUCED HEIGHT
    drawIntegratedCarriersReferencesInstructions(doc, bolData);
    
    // Carrier/Route and Billing Section (Y: 325-395) - REDUCED HEIGHT
    drawIntegratedCarriersCarrierBilling(doc, bolData);
    
    // Quote and Broker Information Section (Y: 400-440) - REDUCED HEIGHT
    drawIntegratedCarriersQuoteBroker(doc, bolData);
    
    // Package Table Section (Y: 445-530) - REDUCED HEIGHT
    drawIntegratedCarriersPackageTable(doc, bolData);
    
    // Notes Section (Y: 535-590) - REDUCED HEIGHT
    drawIntegratedCarriersNotes(doc, bolData);
    
    // Shipper Certification Section (Y: 595-630) - REDUCED HEIGHT
    drawIntegratedCarriersShipperCertification(doc, bolData);
    
    // Footer Information (Y: 635-762) - COMPACT FOOTER
    drawIntegratedCarriersFooter(doc, bolData);
}

/**
 * Draws the SolushipX header section with actual logo image and smaller text (Requirement #1 & #3)
 */
function drawSolushipXHeader(doc, bolData) {
    // Add actual SolushipX logo image (like Polaris BOL)
    try {
        const logoPath = path.join(__dirname, '../../assets/SolushipX_black.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 20, 25, { width: 120, height: 30 }); // Compact logo size
        } else {
            // Fallback to text if logo not found
            doc.font('Helvetica-Bold')
               .fontSize(14)
               .fillColor('#1976d2')
               .text('SolushipX', 20, 25);
            
            doc.font('Helvetica')
               .fontSize(7)
               .fillColor('#666666')
               .text('Freight Management System', 20, 42);
        }
    } catch (error) {
        logger.warn('Failed to load SolushipX logo, using text fallback:', error.message);
        // Fallback to text
        doc.font('Helvetica-Bold')
           .fontSize(14)
           .fillColor('#1976d2')
           .text('SolushipX', 20, 25);
        
        doc.font('Helvetica')
           .fontSize(7)
           .fillColor('#666666')
           .text('Freight Management System', 20, 42);
    }
    
    // Title section (center) - SMALLER TITLE
    doc.font('Helvetica-Bold')
       .fontSize(10) // Reduced from 12
       .fillColor('#000000')
       .text('STRAIGHT BILL OF LADING - SHORT FORM-ORIGINAL - Not Negotiable', 140, 25, {
           width: 280,
           align: 'center'
       });
    
    // BOL NUMBER section (top-right) - REQUIREMENT #3: Smaller text
    doc.font('Helvetica-Bold')
       .fontSize(8) // Reduced from 10
       .text('BOL NUMBER:', 450, 25);
    
    doc.font('Helvetica')
       .fontSize(9) // Reduced from 12
       .text(bolData.bolNumber, 450, 35);
    
    // INTEGRATED CARRIERS text (right side) - SMALLER
    doc.font('Helvetica-Bold')
       .fontSize(7) // Reduced from 9
       .text('INTEGRATED CARRIERS', 450, 48);
    
    // Order Number section - SMALLER
    doc.font('Helvetica-Bold')
       .fontSize(7) // Reduced from 8
       .text('Order Number:', 450, 58);
    
    doc.font('Helvetica')
       .fontSize(8) // Reduced from 9
       .text(bolData.orderNumber, 450, 68);
    
    // Legal disclaimer section - SMALLER AND MORE COMPACT
    doc.font('Helvetica')
       .fontSize(5) // Reduced from 6
       .fillColor('#000000')
       .text('RECEIVED, subject to the classifications and tariffs in effect on the date of the issue of this Bill of Lading. The property described below, in apparent good order, except as noted (contents and condition of contents of packages unknown), marked, consigned, and destined as indicated below, which said carrier (the word carrier being understood throughout this contract as meaning any person or corporation in possession of the property under the contract) agrees to carry to its usual place of delivery at said destination, if on its route, otherwise to deliver to another carrier on the route to said destination. It is mutually agreed, as to each carrier of all or any of said property over all or any portion of said route to destination, and as to each party at time interested in all or any of said property, that every service to be performed hereunder shall be subject to all terms and conditions of the Uniform Domestic Straight Bill of lading set forth (1) in Uniform Freight Classification in effect on the data hereof, if this is a rail or a rail-water shipment, or (2) in the applicable motor carrier classification or tariff if this is a motor carrier shipment. Shipper hereby certifies that he is familiar with all the terms and conditions of the said bill of lading, including those on the back thereof, set forth in the classification or tariff which governs the transportation of this shipment, and the said terms and conditions are hereby agreed to by the shipper and accepted for himself and his assigns.', 20, 85, {
           width: 570,
           align: 'justify',
           lineGap: 0.5
       });
    
    // Horizontal separator line
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(15, 140)
       .lineTo(597, 140)
       .stroke();
}

/**
 * Draws the origin and destination section with smart address formatting (Requirement #4)
 */
function drawIntegratedCarriersOriginDestination(doc, bolData) {
    const startY = 145; // Adjusted for new compact layout
    
    // ORIGIN section (left half)
    doc.font('Helvetica-Bold')
       .fontSize(9) // Slightly smaller
       .text('ORIGIN:', 20, startY);
    
    // Origin company name
    doc.font('Helvetica-Bold')
       .fontSize(8) // Smaller font
       .text(bolData.shipFrom.company, 20, startY + 12);
    
    // Origin address - SMART FORMATTING: Skip blank address2 lines
    let originY = startY + 24;
    doc.font('Helvetica')
       .fontSize(7) // Smaller address text
       .text(bolData.shipFrom.address1, 20, originY);
    
    // Only add address2 line if it has content (Requirement #4)
    if (bolData.shipFrom.address2 && bolData.shipFrom.address2.trim()) {
        originY += 10;
        doc.text(bolData.shipFrom.address2, 20, originY);
    }
    
    // City, state, zip on next line
    originY += 10;
    doc.text(`${bolData.shipFrom.city}, ${bolData.shipFrom.state} ${bolData.shipFrom.zip}`, 20, originY);
    
    // Contact details section for origin - COMPACT
    originY += 15;
    doc.font('Helvetica')
       .fontSize(6) // Smaller labels
       .text('Contact Name:', 20, originY)
       .text('Phone:', 100, originY)
       .text('Fax:', 160, originY);
    
    doc.fontSize(7) // Smaller contact info
       .text(bolData.shipFrom.contact, 20, originY + 8)
       .text(bolData.shipFrom.phone, 100, originY + 8)
       .text(bolData.shipFrom.fax, 160, originY + 8);
    
    // Vertical separator line
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(306, startY)
       .lineTo(306, startY + 100) // Reduced height
       .stroke();
    
    // DESTINATION section (right half)
    doc.font('Helvetica-Bold')
       .fontSize(9) // Smaller
       .text('DESTINATION:', 315, startY);
    
    // Destination company name
    doc.font('Helvetica-Bold')
       .fontSize(8) // Smaller font
       .text(bolData.shipTo.company, 315, startY + 12);
    
    // Destination address - SMART FORMATTING: Skip blank address2 lines
    let destinationY = startY + 24;
    doc.font('Helvetica')
       .fontSize(7) // Smaller address text
       .text(bolData.shipTo.address1, 315, destinationY);
    
    // Only add address2 line if it has content (Requirement #4)
    if (bolData.shipTo.address2 && bolData.shipTo.address2.trim()) {
        destinationY += 10;
        doc.text(bolData.shipTo.address2, 315, destinationY);
    }
    
    // City, state, zip on next line
    destinationY += 10;
    doc.text(`${bolData.shipTo.city}, ${bolData.shipTo.state} ${bolData.shipTo.zip}`, 315, destinationY);
    
    // Contact details for destination - COMPACT
    destinationY += 15;
    doc.font('Helvetica')
       .fontSize(6) // Smaller labels
       .text('Contact Name:', 315, destinationY)
       .text('Phone:', 395, destinationY)
       .text('Fax:', 455, destinationY);
    
    doc.fontSize(7) // Smaller contact info
       .text(bolData.shipTo.contact, 315, destinationY + 8)
       .text(bolData.shipTo.phone, 395, destinationY + 8)
       .text(bolData.shipTo.fax, 455, destinationY + 8);
    
    // Signature line and billing info - COMPACT
    doc.font('Helvetica')
       .fontSize(6) // Smaller
       .text('(SIGNATURE OF CONSIGNOR)', 315, startY + 85);
    
    doc.text('3RD PARTY PREPAID', 315, startY + 93);
    
    // Horizontal separator
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(15, 245)
       .lineTo(597, 245)
       .stroke();
}

/**
 * Draws the references and instructions section - COMPACT
 */
function drawIntegratedCarriersReferencesInstructions(doc, bolData) {
    const startY = 250; // Adjusted positioning
    
    // Left column
    doc.font('Helvetica')
       .fontSize(7) // Smaller font
       .text('Shipper\'s Reference #:', 20, startY + 5)
       .text(bolData.pickupRef, 105, startY + 5);
    
    doc.text('Terminal:', 20, startY + 15)
       .text('Terminal Phone:', 70, startY + 15)
       .text('Terminal Fax:', 130, startY + 15);
    
    // Right column
    doc.text('PO Number #:', 315, startY + 5)
       .text(bolData.poNumber, 370, startY + 5);
    
    doc.text('Terminal:', 315, startY + 15)
       .text('Terminal Phone:', 365, startY + 15)
       .text('Terminal Fax:', 425, startY + 15);
    
    // Pickup Instructions (left) - COMPACT
    doc.font('Helvetica-Bold')
       .fontSize(7) // Smaller
       .text('Pickup Instructions:', 20, startY + 30);
    
    doc.font('Helvetica')
       .fontSize(6) // Smaller
       .text(bolData.pickupInstructions || `PICKUP ${bolData.pickupRef}`, 20, startY + 40, {
           width: 280,
           height: 15 // Reduced height
       });
    
    // Delivery Instructions (right) - COMPACT
    doc.font('Helvetica-Bold')
       .fontSize(7) // Smaller
       .text('Delivery Instructions:', 315, startY + 30);
    
    doc.font('Helvetica')
       .fontSize(6) // Smaller
       .text(bolData.deliveryInstructions || 'Standard delivery', 315, startY + 40, {
           width: 280,
           height: 15 // Reduced height
       });
    
    // Horizontal separator
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(15, 320)
       .lineTo(597, 320)
       .stroke();
}

/**
 * Draws the carrier/route and billing section - COMPACT
 */
function drawIntegratedCarriersCarrierBilling(doc, bolData) {
    const startY = 325; // Adjusted positioning
    
    // Left column - Carrier/Route section
    doc.font('Helvetica-Bold')
       .fontSize(7) // Smaller
       .text('CARRIER/ROUTE:', 20, startY + 5);
    
    doc.font('Helvetica')
       .fontSize(7) // Smaller
       .text(bolData.carrierRoute, 20, startY + 15);
    
    doc.font('Helvetica-Bold')
       .fontSize(7) // Smaller
       .text('SHIPMENT DATE:', 20, startY + 28);
    
    doc.font('Helvetica')
       .fontSize(7) // Smaller
       .text(bolData.shipDate, 20, startY + 38);
    
    doc.font('Helvetica')
       .fontSize(6) // Smaller
       .text('Available for pickup between', 20, startY + 50)
       .text(bolData.pickupEarliest, 120, startY + 50)
       .text('and', 145, startY + 50)
       .text(bolData.pickupLatest, 160, startY + 50);
    
    doc.font('Helvetica-Bold')
       .fontSize(7) // Smaller
       .text('ACCESSORIALS:', 20, startY + 62);
    
    // Vertical separator
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(306, startY)
       .lineTo(306, startY + 70) // Reduced height
       .stroke();
    
    // Right column - Bill Freight Charges section
    doc.font('Helvetica-Bold')
       .fontSize(7) // Smaller
       .text('Bill Freight Charge(s) To:', 315, startY + 5);
    
    doc.font('Helvetica')
       .fontSize(7) // Smaller
       .text(bolData.billTo.company, 315, startY + 15)
       .text(bolData.billTo.address1, 315, startY + 25)
       .text(bolData.billTo.address2, 315, startY + 35)
       .text(`${bolData.billTo.city}, ${bolData.billTo.state} ${bolData.billTo.zip}`, 315, startY + 45);
    
    // Horizontal separator
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(15, 395)
       .lineTo(597, 395)
       .stroke();
}

/**
 * Draws the quote and broker information section - COMPACT
 */
function drawIntegratedCarriersQuoteBroker(doc, bolData) {
    const startY = 400; // Adjusted positioning
    
    // Left column - Quote Number
    doc.font('Helvetica-Bold')
       .fontSize(7) // Smaller
       .text('QUOTE NUMBER:', 20, startY + 5);
    
    doc.font('Helvetica')
       .fontSize(7) // Smaller
       .text(bolData.quoteNumber, 20, startY + 15); // Now uses dynamic quote number
    
    // Vertical separator
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(306, startY)
       .lineTo(306, startY + 40) // Reduced height
       .stroke();
    
    // Right column - Broker information
    doc.font('Helvetica-Bold')
       .fontSize(7) // Smaller
       .text('BrokerName:', 315, startY + 5);
    
    doc.font('Helvetica')
       .fontSize(6) // Smaller
       .text('BrokerDetail :', 315, startY + 15)
       .text('PhoneNo:', 365, startY + 15)
       .text('Fax:', 415, startY + 15)
       .text('Email:', 365, startY + 25)
       .text('Contact:', 415, startY + 25);
    
    // Horizontal separator
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(15, 440)
       .lineTo(597, 440)
       .stroke();
}

/**
 * Draws the package table section - COMPACT
 */
function drawIntegratedCarriersPackageTable(doc, bolData) {
    const startY = 445; // Adjusted positioning
    const tableHeight = 85; // Reduced height
    
    // Table border
    doc.lineWidth(1)
       .rect(15, startY, 582, tableHeight) // Adjusted width
       .stroke();
    
    // Table headers - compact positioning
    const headerY = startY + 6;
    doc.font('Helvetica-Bold')
       .fontSize(7) // Smaller headers
       .text('QUANTITY', 20, headerY, { width: 65, align: 'center' })
       .text('DESCRIPTION AND IDENTIFICATION OF ARTICLES', 90, headerY, { width: 350, align: 'center' })
       .text('WEIGHT (lb)', 445, headerY, { width: 60, align: 'center' })
       .text('CLASS/RATE', 510, headerY, { width: 80, align: 'center' });
    
    // Column separators - adjusted positions
    doc.strokeColor('#000000')
       .lineWidth(0.5)
       .moveTo(85, startY)
       .lineTo(85, startY + tableHeight)
       .stroke()
       .moveTo(440, startY)
       .lineTo(440, startY + tableHeight)
       .stroke()
       .moveTo(505, startY)
       .lineTo(505, startY + tableHeight)
       .stroke();
    
    // Header separator
    doc.strokeColor('#000000')
       .lineWidth(0.5)
       .moveTo(15, startY + 18) // Reduced header height
       .lineTo(597, startY + 18)
       .stroke();
    
    // Package data rows - COMPACT
    let dataY = startY + 25;
    const lineHeight = 10; // Reduced line height
    bolData.packages.forEach((pkg, index) => {
        if (dataY > startY + tableHeight - 15) return; // Don't overflow table
        
        doc.font('Helvetica')
           .fontSize(6) // Smaller font
           .text(pkg.quantity.toString(), 20, dataY, { width: 60, align: 'center' })
           .text(pkg.description.toUpperCase(), 90, dataY, { width: 345, align: 'left' })
           .text(pkg.weight.toFixed(1), 445, dataY, { width: 55, align: 'center' })
           .text(pkg.freightClass.toString(), 510, dataY, { width: 75, align: 'center' });
        
        dataY += lineHeight;
    });
    
    // Total weight at bottom
    doc.font('Helvetica-Bold')
       .fontSize(7) // Smaller total
       .text(`Total: ${bolData.totalWeight.toFixed(1)}`, 445, startY + tableHeight - 10, { width: 55, align: 'center' });
    
    // Horizontal separator
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(15, 530)
       .lineTo(597, 530)
       .stroke();
}

/**
 * Draws the notes section - COMPACT with only 1 line for writing
 */
function drawIntegratedCarriersNotes(doc, bolData) {
    const startY = 535; // Adjusted positioning
    
    // Section headers
    doc.font('Helvetica-Bold')
       .fontSize(7) // Smaller
       .text('General Notes:', 20, startY + 5);
    
    doc.font('Helvetica-Bold')
       .fontSize(7) // Smaller
       .text('Critical Notes:', 315, startY + 5);
    
    // Vertical separator
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(306, startY)
       .lineTo(306, startY + 40) // Reduced height
       .stroke();
    
    // Add only 1 line for notes (reduced from 2)
    doc.strokeColor('#000000')
       .lineWidth(0.3)
       .moveTo(20, startY + 15)
       .lineTo(300, startY + 15)
       .stroke();
       
    doc.strokeColor('#000000')
       .lineWidth(0.3)
       .moveTo(315, startY + 15)
       .lineTo(585, startY + 15)
       .stroke();
    
    // Bottom section - COMPACT
    doc.font('Helvetica')
       .fontSize(6) // Smaller
       .text('Original Bill of Lading created by: DAVE', 20, startY + 28); // Moved up since we removed a line
    
    doc.text('Received in Apparent good Order (Except as Noted) The Goods Described Herein.', 20, startY + 36);
    
    // Signature line - COMPACT
    doc.fontSize(5) // Much smaller
       .text('# pieces _____ Driver____________ Division________________ Date_______', 20, startY + 43);
    
    // Horizontal separator
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(15, 590)
       .lineTo(597, 590)
       .stroke();
}

/**
 * Draws the shipper certification section - COMPACT
 */
function drawIntegratedCarriersShipperCertification(doc, bolData) {
    const startY = 595; // Adjusted positioning
    
    // Certification box - SMALLER
    doc.lineWidth(1)
       .rect(15, startY, 582, 35) // Reduced height
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(7) // Smaller
       .text('SHIPPER CERTIFICATION', 20, startY + 5);
    
    doc.font('Helvetica')
       .fontSize(6) // Smaller
       .text('This is to certify that the above named materials are properly classified, described, packaged, marked, and labeled and are in proper condition', 20, startY + 15)
       .text('for transportation according to the applicable regulations of the DOT.', 20, startY + 23);
    
    doc.fontSize(6) // Smaller signature line
       .text('Per________________________ Date__________', 20, startY + 30);
    
    // Horizontal separator
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(15, 630)
       .lineTo(597, 630)
       .stroke();
}

/**
 * Draws the footer section - COMPACT
 */
function drawIntegratedCarriersFooter(doc, bolData) {
    const startY = 635; // Adjusted positioning
    
    // PRO label placement
    doc.font('Helvetica-Bold')
       .fontSize(8) // Smaller
       .text('PLACE PRO LABEL HERE', 20, startY);
    
    // Contact information - COMPACT
    doc.font('Helvetica')
       .fontSize(5) // Much smaller
       .text('Any additional accessorial not requested on the original BOL must be authorized prior to service by Integrated Carriers @ 877-603-0103 or', 20, startY + 12)
       .text('saveit@integratedcarriers.com', 20, startY + 18);
    
    doc.text('If you have any questions or if requested pick up cannot be made for any reason, please call Integrated Carriers at 877-603-', 20, startY + 26)
       .text('0103.', 20, startY + 32);
    
    doc.fontSize(4) // Very small system info
       .text('*** Soluship TMS 4.0.23.5 - Fri May 30 11:03:39 EDT', 20, startY + 42);
    
    // Page number
    doc.fontSize(5)
       .text('Page 1', 550, startY + 42);
}

/**
 * Stores the eShipPlus BOL document in Firebase Storage and creates document record
 */
async function storeEShipPlusBOLDocument(pdfBuffer, shipmentId, firebaseDocId, overwriteDocumentId = null) {
    try {
        // Use the new naming convention: SOLUSHIP-SHIPMENTID-BOL.pdf
        const fileName = `SOLUSHIP-${shipmentId}-BOL.pdf`;
        const bucket = storage.bucket();
        
        // Use unified storage path
        const file = bucket.file(`shipment-documents/${firebaseDocId}/${fileName}`);
        
        // Upload PDF to Firebase Storage
        await file.save(pdfBuffer, {
            metadata: {
                contentType: 'application/pdf',
                metadata: {
                    shipmentId: shipmentId,
                    carrier: 'eShipPlus',
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
            docType: 1, // 1 for BOL documents
            fileSize: pdfBuffer.length,
            carrier: 'eShipPlus',
            documentType: 'bol',
            downloadUrl: downloadUrl,
            storagePath: `shipment-documents/${firebaseDocId}/${fileName}`,
            isGeneratedBOL: true,
            replacesApiBOL: true,
            metadata: {
                eshipplus: {
                    shipmentId: shipmentId,
                    documentFormat: 'PDF',
                    bolGenerated: true,
                    exactPositioning: true,
                    fontOptimized: true,
                    replacesApiBol: true,
                    generated: true,
                    isAutoGenerated: true
                },
                documentCategory: 'bol',
                documentSubType: 'generated-bol',
                documentType: 'bill_of_lading'
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            _isUnifiedStructure: true,
            _isGeneratedDocument: true
        };
        
        // Use overwriteDocumentId if provided, otherwise generate unique ID
        const documentId = overwriteDocumentId || `${firebaseDocId}_bol_generated`;
        
        if (overwriteDocumentId) {
            logger.info('🔄 Overwriting API BOL document with generated BOL:', {
                overwriteDocumentId,
                newFileName: fileName
            });
        } else {
            logger.info('📄 Creating new BOL document:', {
                documentId,
                fileName
            });
        }
        
        // Store in unified structure
        const unifiedDocRef = db.collection('shipments').doc(firebaseDocId)
                                .collection('documents').doc(documentId);
        await unifiedDocRef.set(documentData);
        
        // Store in main collection
        const legacyDocRef = db.collection('shipmentDocuments').doc(documentId);
        await legacyDocRef.set({
            ...documentData,
            unifiedDocumentId: documentId,
            migrationNote: overwriteDocumentId ? 
                'Generated eShipPlus BOL overwriting API BOL' : 
                'Generated eShipPlus BOL with exact positioning',
            _isUnifiedStructure: true
        });
        
        logger.info('✅ Successfully stored BOL document:', {
            documentId,
            docType: documentData.docType,
            isOverwrite: !!overwriteDocumentId,
            storagePath: documentData.storagePath
        });
        
        return {
            documentId: documentId,
            downloadUrl: downloadUrl,
            fileName: fileName,
            storagePath: documentData.storagePath
        };
        
    } catch (error) {
        logger.error('Error storing eShipPlus BOL:', error);
        throw new Error(`Failed to store eShipPlus BOL: ${error.message}`);
    }
} 