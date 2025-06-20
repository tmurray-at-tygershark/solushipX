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
 * Core Carrier Confirmation generation function - can be called directly from other functions
 * @param {string} shipmentId - The shipment ID
 * @param {string} firebaseDocId - The Firebase document ID
 * @param {Object} carrierDetails - The carrier details
 * @returns {Object} - Success/error response with document info
 */
async function generateCarrierConfirmationCore(shipmentId, firebaseDocId, carrierDetails) {
    try {
        logger.info('generateCarrierConfirmationCore called with:', { 
            shipmentId, 
            firebaseDocId,
            carrierName: carrierDetails?.name 
        });
        
        if (!shipmentId) {
            throw new Error('Shipment ID is required');
        }
        
        if (!firebaseDocId) {
            throw new Error('Firebase document ID is required');
        }
        
        if (!carrierDetails) {
            throw new Error('Carrier details are required');
        }
        
        // Get shipment data from Firestore with enhanced fallback logic
        let shipmentDoc = await db.collection('shipments').doc(firebaseDocId).get();
        let shipmentData = null;
        
        if (shipmentDoc.exists) {
            shipmentData = shipmentDoc.data();
            logger.info('Retrieved shipment data by document ID for Carrier Confirmation generation');
        } else {
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
        
        // Extract data for confirmation generation with enhanced mapping
        const confirmationData = extractEnhancedConfirmationData(shipmentData, shipmentId, carrierDetails);
        
        // Generate the PDF confirmation with world-class design
        const pdfBuffer = await generateEnhancedConfirmationPDF(confirmationData);
        
        // Store the confirmation document
        const documentInfo = await storeConfirmationDocument(pdfBuffer, shipmentId, firebaseDocId);
        
        logger.info('Core Carrier Confirmation generation completed successfully');
        
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
        logger.error('Error in generateCarrierConfirmationCore:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

/**
 * Generates a world-class Carrier Confirmation PDF document
 * Enhanced with professional design, comprehensive data mapping, and improved layout
 * @param {Object} request - Firebase function request containing shipment data
 * @returns {Object} - Success/error response with document download URL
 */
const generateCarrierConfirmation = onCall({
    minInstances: 1, // Keep warm to prevent cold starts for document generation
    memory: '1GiB', // More memory for PDF generation
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { shipmentId, firebaseDocId, carrierDetails } = request.data;
        
        logger.info('generateCarrierConfirmation called with:', { 
            shipmentId, 
            firebaseDocId,
            carrierName: carrierDetails?.name 
        });
        
        // Use the core function
        return await generateCarrierConfirmationCore(shipmentId, firebaseDocId, carrierDetails);
        
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
 * Extracts confirmation data with comprehensive mapping and intelligent fallbacks
 * Enhanced to handle all data formats and ensure complete information extraction
 */
function extractEnhancedConfirmationData(shipmentData, shipmentId, carrierDetails) {
    console.log('extractEnhancedConfirmationData: Processing shipment data with enhanced mapping');
    
    // Extract addresses with comprehensive fallback logic
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
    
    // Extract packages with enhanced mapping for all formats
    const packages = shipmentData.packages || 
                    shipmentData.shipment?.packages || 
                    shipmentData.Items || 
                    shipmentData.packageDetails ||
                    [];
    
    // Extract booking/rate information
    const booking = shipmentData.carrierBookingConfirmation || 
                   shipmentData.bookingConfirmation ||
                   shipmentData.confirmation ||
                   {};
                   
    const manualRates = shipmentData.manualRates || [];
    
    // Generate reference numbers with enhanced format
    const refNumber = Math.floor(Math.random() * 9000000) + 1000000;
    const confirmationNumber = `IC-${refNumber}`;
    
    // Format dates with proper handling
    const now = new Date();
    const shipDate = shipmentData.shipmentInfo?.shipmentDate || 
                    shipmentData.shipmentDate ||
                    booking.shippingDate || 
                    new Date().toISOString();
                    
    const deliveryDate = shipmentData.shipmentInfo?.deliveryDate || 
                        shipmentData.deliveryDate ||
                        booking.deliveryDate ||
                        new Date(new Date(shipDate).getTime() + (2 * 24 * 60 * 60 * 1000)); // +2 days default
    
    // Calculate comprehensive totals with proper weight parsing
    let totalWeight = 0;
    let totalPieces = 0;
    let totalSkids = 0;
    
    packages.forEach(pkg => {
        // Parse weight with enhanced logic
        const rawWeight = pkg.weight || pkg.reported_weight || pkg.Weight || pkg.packageWeight || 0;
        const weight = parseFloat(String(rawWeight).replace(/[^\d.-]/g, '')) || 0;
        
        // Parse quantity with fallback
        const quantity = parseInt(String(pkg.quantity || pkg.packagingQuantity || pkg.pieces || 1).replace(/[^\d]/g, '')) || 1;
        
        totalWeight += weight;
        totalPieces += quantity;
        
        // Count skids/pallets
        const packageType = (pkg.packagingType || pkg.type || '').toString().toUpperCase();
        if (packageType.includes('SKID') || packageType.includes('PALLET') || packageType === '262' || packageType === '258') {
            totalSkids += quantity;
        }
    });
    
    // Calculate agreed rate with comprehensive logic - use COST for carrier confirmation
    const agreedRate = shipmentData.totalCost || 
                      manualRates.reduce((sum, rate) => sum + (parseFloat(rate.cost) || 0), 0) ||
                      booking.totalCost ||
                      booking.totalCharges ||
                      500.00; // Default rate (lower since this is cost, not customer charge)
    
    // Extract special instructions from multiple sources
    const specialInstructions = [];
    
    // Add shipment notes
    if (shipmentData.shipmentInfo?.notes) {
        specialInstructions.push(shipmentData.shipmentInfo.notes);
    }
    
    // Add pickup instructions from address book
    if (shipFrom.specialInstructions) {
        specialInstructions.push(`PICKUP: ${shipFrom.specialInstructions}`);
    }
    
    // Add delivery instructions from address book
    if (shipTo.specialInstructions) {
        specialInstructions.push(`DELIVERY: ${shipTo.specialInstructions}`);
    }
    
    // Extract reference numbers with enhanced logic
    const poNumber = shipmentData.shipmentInfo?.poNumber || 
                    shipmentData.purchaseOrder ||
                    booking.poNumber || '';
                    
    const customerRef = shipmentData.shipmentInfo?.shipperReferenceNumber || 
                       shipmentData.referenceNumber || 
                       shipmentData.customerReference ||
                       booking.referenceNumber || '';
    
    // Get open/close hours based on the booking date
    const bookingDateObj = new Date(shipDate);
    const dayOfWeek = bookingDateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Extract business hours from address book
    const getBusinessHours = (address, dayOfWeek) => {
        // Check if address has businessHours object
        if (address.businessHours) {
            // If custom hours are enabled and exist for this day
            if (address.businessHours.customHoursEnabled && 
                address.businessHours.days && 
                address.businessHours.days[dayOfWeek]) {
                const dayHours = address.businessHours.days[dayOfWeek];
                return {
                    open: dayHours.open || '09:00 AM',
                    close: dayHours.close || '05:00 PM',
                    closed: dayHours.closed || false
                };
            }
            // If not custom hours, use default
            else if (address.businessHours.defaultOpen && address.businessHours.defaultClose) {
                return {
                    open: address.businessHours.defaultOpen,
                    close: address.businessHours.defaultClose,
                    closed: false
                };
            }
        }
        
        // Fallback to standard hours
        return {
            open: '09:00 AM',
            close: '05:00 PM',
            closed: false
        };
    };
    
    const shipperHours = getBusinessHours(shipFrom, dayOfWeek);
    const consigneeHours = getBusinessHours(shipTo, dayOfWeek);
    
    return {
        // Header information
        date: formatDateLong(bookingDateObj),
        refNumber: confirmationNumber,
        orderNumber: shipmentId,
        account: shipmentData.companyID || '-',
        contact: 'Tim Smith', // As requested
        
        // Carrier information with enhanced details
        carrier: carrierDetails.name || 'Integrated Carriers',
        carrierPhone: carrierDetails.contactPhone || carrierDetails.phone || '', // Updated to include phone
        carrierEmail: carrierDetails.contactEmail || carrierDetails.email || '', // Changed from fax to email
        attention: carrierDetails.contactName || carrierDetails.attention || '',
        
        // Shipper information with comprehensive mapping
        shipper: {
            company: shipFrom.companyName || shipFrom.company || shipFrom.name || 'Unknown Shipper',
            address1: shipFrom.street || shipFrom.address1 || shipFrom.addressLine1 || '',
            address2: shipFrom.street2 || shipFrom.address2 || shipFrom.addressLine2 || '',
            city: shipFrom.city || '',
            state: shipFrom.state || shipFrom.province || '',
            postalCode: shipFrom.postalCode || shipFrom.zip || '',
            country: shipFrom.country || 'CA',
            contact: `${shipFrom.firstName || ''} ${shipFrom.lastName || ''}`.trim() || 
                    shipFrom.contact || shipFrom.contactName || '',
            phone: shipFrom.phone || shipFrom.contactPhone || '',
            email: shipFrom.email || '',
            poNumber: poNumber,
            refNumber: customerRef,
            specialInstructions: shipFrom.specialInstructions || ''
        },
        
        // Consignee information with comprehensive mapping
        consignee: {
            company: shipTo.companyName || shipTo.company || shipTo.name || 'Unknown Consignee',
            address1: shipTo.street || shipTo.address1 || shipTo.addressLine1 || '',
            address2: shipTo.street2 || shipTo.address2 || shipTo.addressLine2 || '',
            city: shipTo.city || '',
            state: shipTo.state || shipTo.province || '',
            postalCode: shipTo.postalCode || shipTo.zip || '',
            country: shipTo.country || 'CA',
            contact: `${shipTo.firstName || ''} ${shipTo.lastName || ''}`.trim() || 
                    shipTo.contact || shipTo.contactName || '',
            phone: shipTo.phone || shipTo.contactPhone || '',
            email: shipTo.email || '',
            specialInstructions: shipTo.specialInstructions || ''
        },
        
        // Enhanced date/time information
        dateReady: formatDateShort(shipDate),
        readyTime: shipperHours.closed ? 'CLOSED' : shipperHours.open,
        closeTime: shipperHours.closed ? 'CLOSED' : shipperHours.close,
        deliverOn: formatDateShort(deliveryDate),
        deliverClose: consigneeHours.closed ? 'CLOSED' : consigneeHours.close,
        
        // Enhanced load information with detailed package breakdown
        pieces: totalPieces,
        weight: totalWeight.toFixed(2) + ' LBS',
        skids: totalSkids,
        packages: packages.map((pkg, index) => {
            const weight = parseFloat(String(pkg.weight || 0).replace(/[^\d.-]/g, '')) || 0;
            const quantity = parseInt(String(pkg.quantity || pkg.packagingQuantity || 1).replace(/[^\d]/g, '')) || 1;
            
            return {
                pieces: quantity,
                weight: weight.toFixed(2),
                type: getPackageTypeName(pkg.packagingType || pkg.type),
                description: pkg.description || pkg.itemDescription || pkg.commodity || 'General Freight',
                dimensions: formatDimensions(pkg),
                class: pkg.freightClass || pkg.class || ''
            };
        }),
        description: packages.length > 0 ? 
                    packages.map(p => p.description || p.itemDescription || 'General Freight').join(', ') : 
                    'General Freight',
        
        // Special instructions - combined from all sources
        specialInstructions: specialInstructions.join(' | ') || '',
        
        // Broker information (empty as requested)
        broker: '',
        brokerPhone: '',
        brokerFax: '',
        port: '',
        brokerRef: '',
        
        // Financial information - use cost currency for carrier confirmation
        agreedRate: agreedRate.toFixed(2) + ' ' + (manualRates[0]?.costCurrency || shipmentData.currency || 'CAD'),
        
        // Additional shipment details
        shipmentType: shipmentData.shipmentInfo?.shipmentType || 'freight',
        serviceLevel: shipmentData.shipmentInfo?.serviceLevel || 'standard',
        billType: shipmentData.shipmentInfo?.billType || 'third_party',
        trackingNumber: shipmentData.trackingNumber || shipmentData.carrierTrackingNumber || shipmentId,
        
        // Complete shipment data for reference
        shipmentData: shipmentData
    };
}

/**
 * Helper function to get package type name
 */
function getPackageTypeName(typeCode) {
    const packageTypes = {
        '237': '10KG BOX',
        '238': '25KG BOX',
        '239': 'ENVELOPE',
        '240': 'TUBE',
        '241': 'PAK',
        '242': 'BAGS',
        '243': 'BALE(S)',
        '244': 'BOX(ES)',
        '245': 'BUNCH(ES)',
        '246': 'BUNDLE(S)',
        '248': 'CARBOY(S)',
        '249': 'CARPET(S)',
        '250': 'CARTONS',
        '251': 'CASE(S)',
        '252': 'COIL(S)',
        '253': 'CRATE(S)',
        '254': 'CYLINDER(S)',
        '255': 'DRUM(S)',
        '256': 'LOOSE',
        '257': 'PAIL(S)',
        '258': 'PALLET(S)',
        '260': 'REEL(S)',
        '261': 'ROLL(S)',
        '262': 'SKID(S)',
        '265': 'TOTE(S)',
        '266': 'TUBES/PIPES',
        '268': 'GALLONS',
        '269': 'LIQUID BULK',
        '270': 'CONTAINER',
        '271': 'PIECES',
        '272': 'LOAD',
        '273': 'BLADE(S)',
        '274': 'RACKS',
        '275': 'GAYLORDS'
    };
    
    const typeStr = String(typeCode).toUpperCase();
    return packageTypes[typeCode] || typeStr || 'PACKAGE';
}

/**
 * Helper function to format dimensions
 */
function formatDimensions(pkg) {
    const length = pkg.length || pkg.dimensions?.length || 0;
    const width = pkg.width || pkg.dimensions?.width || 0;
    const height = pkg.height || pkg.dimensions?.height || 0;
    
    if (length && width && height) {
        return `${length}" × ${width}" × ${height}"`;
    }
    return '';
}

/**
 * Formats date to long format (e.g., "19-Jun-25")
 */
function formatDateLong(date) {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
}

/**
 * Formats date to short format (e.g., "19-Jun-25")
 */
function formatDateShort(date) {
    return formatDateLong(date);
}

/**
 * Generates the enhanced confirmation PDF with world-class design
 */
async function generateEnhancedConfirmationPDF(confirmationData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'letter',
                margin: 0, // No margins for precise control
                info: {
                    Title: `Carrier Confirmation ${confirmationData.orderNumber}`,
                    Author: 'Integrated Carriers - SolushipX',
                    Subject: 'Carrier Confirmation',
                    Keywords: 'carrier, confirmation, freight, shipping'
                }
            });
            
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            
            // Build the enhanced confirmation document
            buildEnhancedConfirmation(doc, confirmationData);
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Builds the enhanced confirmation layout with professional design
 */
function buildEnhancedConfirmation(doc, data) {
    // Set page background
    doc.rect(0, 0, 612, 792)
       .fill('#ffffff');
    
    // Main border
    doc.lineWidth(2)
       .strokeColor('#000000')
       .rect(20, 20, 572, 752)
       .stroke();
    
    // Professional header with enhanced design
    drawEnhancedHeader(doc, data);
    
    // Order notification banner
    drawOrderBanner(doc, data);
    
    // Carrier section with improved layout
    drawEnhancedCarrierSection(doc, data);
    
    // Shipper section with comprehensive details
    drawEnhancedShipperSection(doc, data);
    
    // Consignee section with comprehensive details
    drawEnhancedConsigneeSection(doc, data);
    
    // Special instructions with better formatting
    if (data.shipper.specialInstructions || data.consignee.specialInstructions) {
        drawEnhancedSpecialInstructions(doc, data);
    }
    
    // Broker section (layout only as requested)
    drawEnhancedBrokerSection(doc, data);
    
    // Load information with detailed table
    drawEnhancedLoadInfoSection(doc, data);
    
    // Terms and conditions with professional formatting
    drawEnhancedTermsSection(doc, data);
    
    // Signature section
    drawEnhancedSignatureSection(doc, data);
}

/**
 * Draws enhanced header with SolushipX logo and professional design
 */
function drawEnhancedHeader(doc, data) {
    // Header background
    doc.rect(20, 20, 572, 80)
       .fill('#f8f9fa');
    
    // Logo section
    try {
        // Use the SolushipX logo from assets
        const logoPath = path.join(__dirname, '../../assets/integratedcarrriers_logo_blk.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 35, 30, {
                width: 150,
                height: 60,
                fit: [150, 60],
                align: 'left',
                valign: 'center'
            });
        } else {
            console.error('Logo file not found at:', logoPath);
            // Fallback - just leave empty space for logo
        }
    } catch (error) {
        console.error('Error loading logo:', error);
        // Fallback - just leave empty space for logo
    }
    
    // Header info section (right side)
    const rightX = 380;
    let yPos = 35;
    
    // Date
    doc.font('Helvetica')
       .fontSize(9)
       .fillColor('#666666')
       .text('DATE', rightX, yPos);
    
    doc.fontSize(9)
       .fillColor('#000000')
       .text(':', rightX + 80, yPos)
       .text(data.date, rightX + 90, yPos);
    
    // Reference number
    yPos += 14;
    doc.fillColor('#666666')
       .text('REF#', rightX, yPos);
    
    doc.fillColor('#000000')
       .text(':', rightX + 80, yPos)
       .text(data.refNumber, rightX + 90, yPos);
    
    // Contact
    yPos += 14;
    doc.fillColor('#666666')
       .text('CONTACT', rightX, yPos);
    
    doc.fillColor('#000000')
       .text(':', rightX + 80, yPos)
       .text(data.contact, rightX + 90, yPos);
    
    // Account
    yPos += 14;
    doc.fillColor('#666666')
       .text('ACCOUNT', rightX, yPos);
    
    doc.fillColor('#000000')
       .text(':', rightX + 80, yPos)
       .text(data.account, rightX + 90, yPos);
}

/**
 * Draws order notification banner
 */
function drawOrderBanner(doc, data) {
    // Banner background
    doc.rect(20, 100, 572, 25)
       .fill('#1a237e');
    
    // Banner text
    doc.font('Helvetica-Bold')
       .fontSize(12)
       .fillColor('#ffffff')
       .text(`ORDER # ${data.orderNumber} MUST BE ADDED TO YOUR FREIGHT INVOICE`, 
             0, 107, { 
                 align: 'center',
                 width: 612
             });
}

/**
 * Draws enhanced carrier section
 */
function drawEnhancedCarrierSection(doc, data) {
    const sectionY = 135;
    const labelX = 35;
    const valueX = 145;
    const rightLabelX = 340;
    const rightValueX = 450;
    
    // Section header
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor('#1a237e')
       .text('CARRIER INFORMATION', labelX, sectionY);
    
    // Underline
    doc.strokeColor('#1a237e')
       .lineWidth(0.5)
       .moveTo(labelX, sectionY + 12)
       .lineTo(280, sectionY + 12)
       .stroke();
    
    let yPos = sectionY + 20;
    
    // Carrier name
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#333333')
       .text('Carrier', labelX, yPos);
    
    doc.fontSize(9)
       .fillColor('#000000')
       .text(':', valueX - 10, yPos);
    
    doc.font('Helvetica')
       .text(data.carrier, valueX, yPos);
    
    // Attention
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Attention', rightLabelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', rightValueX - 10, yPos);
    
    doc.font('Helvetica')
       .text(data.attention, rightValueX, yPos);
    
    // Phone
    yPos += 14;
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Telephone', labelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', valueX - 10, yPos);
    
    doc.font('Helvetica')
       .text(data.carrierPhone, valueX, yPos);
    
    // Email (changed from Fax)
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Email', rightLabelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', rightValueX - 10, yPos);
    
    doc.font('Helvetica')
       .text(data.carrierEmail, rightValueX, yPos);
}

/**
 * Draws enhanced shipper section
 */
function drawEnhancedShipperSection(doc, data) {
    const sectionY = 195;
    const labelX = 35;
    const valueX = 145;
    const rightLabelX = 340;
    const rightValueX = 420;
    
    // Section background
    doc.rect(25, sectionY - 5, 562, 115)
       .fill('#f8f9fa');
    
    // Section header
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor('#1a237e')
       .text('SHIPPER INFORMATION', labelX, sectionY);
    
    // Underline
    doc.strokeColor('#1a237e')
       .lineWidth(0.5)
       .moveTo(labelX, sectionY + 12)
       .lineTo(280, sectionY + 12)
       .stroke();
    
    let yPos = sectionY + 20;
    let rightYPos = sectionY + 20;
    
    // Shipper company
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#333333')
       .text('Shipper', labelX, yPos);
    
    doc.fontSize(9)
       .fillColor('#000000')
       .text(':', valueX - 10, yPos);
    
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .text(data.shipper.company, valueX, yPos);
    
    // Move address section up (reduce gap)
    yPos += 12;
    
    // Address - stacked in left column
    doc.font('Helvetica')
       .fontSize(9)
       .fillColor('#000000')
       .text(data.shipper.address1, valueX, yPos);
    
    if (data.shipper.address2) {
        yPos += 10;
        doc.text(data.shipper.address2, valueX, yPos);
    }
    
    // City
    yPos += 10;
    doc.text(data.shipper.city, valueX, yPos);
    
    // State/Prov and Postal Code on same line
    yPos += 10;
    doc.text(`${data.shipper.state}     ${data.shipper.postalCode}`, valueX, yPos);
    
    // Country
    yPos += 10;
    doc.text(data.shipper.country, valueX, yPos);
    
    // Right column - aligned with top
    // Reference Number
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Reference:', rightLabelX, rightYPos);
    
    doc.font('Helvetica')
       .fillColor('#000000')
       .text(data.shipper.refNumber || data.shipper.poNumber, rightValueX, rightYPos);
    
    // Contact
    rightYPos += 14;
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Contact:', rightLabelX, rightYPos);
    
    doc.font('Helvetica')
       .fillColor('#000000')
       .text(data.shipper.contact, rightValueX, rightYPos);
    
    // Phone
    rightYPos += 14;
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Telephone:', rightLabelX, rightYPos);
    
    doc.font('Helvetica')
       .fillColor('#000000')
       .text(data.shipper.phone, rightValueX, rightYPos);
    
    // Instructions
    if (data.shipper.specialInstructions) {
        rightYPos += 14;
        doc.font('Helvetica-Bold')
           .fillColor('#333333')
           .text('Instructions:', rightLabelX, rightYPos);
        
        doc.font('Helvetica')
           .fontSize(8)
           .fillColor('#000000')
           .text(data.shipper.specialInstructions, rightValueX, rightYPos, { width: 140 });
    }
    
    // Date Ready and times at bottom
    yPos += 20;
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#333333')
       .text('Date Ready', labelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', valueX - 10, yPos);
    
    doc.font('Helvetica')
       .text(data.dateReady, valueX, yPos);
    
    // Ready time
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Open', 240, yPos);
    
    doc.fillColor('#000000')
       .text(':', 280, yPos);
    
    doc.font('Helvetica')
       .text(data.readyTime, 290, yPos);
    
    // Close time
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Close', rightLabelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', rightValueX - 10, yPos);
    
    doc.font('Helvetica')
       .text(data.closeTime, rightValueX, yPos);
}

/**
 * Draws enhanced consignee section
 */
function drawEnhancedConsigneeSection(doc, data) {
    const sectionY = 315;
    const labelX = 35;
    const valueX = 145;
    const rightLabelX = 340;
    const rightValueX = 420;
    
    // Section header
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor('#1a237e')
       .text('CONSIGNEE INFORMATION', labelX, sectionY);
    
    // Underline
    doc.strokeColor('#1a237e')
       .lineWidth(0.5)
       .moveTo(labelX, sectionY + 12)
       .lineTo(280, sectionY + 12)
       .stroke();
    
    let yPos = sectionY + 20;
    let rightYPos = sectionY + 20;
    
    // Consignee company
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#333333')
       .text('Consignee', labelX, yPos);
    
    doc.fontSize(9)
       .fillColor('#000000')
       .text(':', valueX - 10, yPos);
    
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .text(data.consignee.company, valueX, yPos);
    
    // Move address section up (reduce gap)
    yPos += 12;
    
    // Address - stacked in left column
    doc.font('Helvetica')
       .fontSize(9)
       .fillColor('#000000')
       .text(data.consignee.address1, valueX, yPos);
    
    if (data.consignee.address2) {
        yPos += 10;
        doc.text(data.consignee.address2, valueX, yPos);
    }
    
    // City
    yPos += 10;
    doc.text(data.consignee.city, valueX, yPos);
    
    // State/Prov and Postal Code on same line
    yPos += 10;
    doc.text(`${data.consignee.state}     ${data.consignee.postalCode}`, valueX, yPos);
    
    // Country
    yPos += 10;
    doc.text(data.consignee.country, valueX, yPos);
    
    // Right column - aligned with top
    // Contact
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Contact:', rightLabelX, rightYPos);
    
    doc.font('Helvetica')
       .fillColor('#000000')
       .text(data.consignee.contact, rightValueX, rightYPos);
    
    // Phone
    rightYPos += 14;
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Telephone:', rightLabelX, rightYPos);
    
    doc.font('Helvetica')
       .fillColor('#000000')
       .text(data.consignee.phone, rightValueX, rightYPos);
    
    // Instructions
    if (data.consignee.specialInstructions) {
        rightYPos += 14;
        doc.font('Helvetica-Bold')
           .fillColor('#333333')
           .text('Instructions:', rightLabelX, rightYPos);
        
        doc.font('Helvetica')
           .fontSize(8)
           .fillColor('#000000')
           .text(data.consignee.specialInstructions, rightValueX, rightYPos, { width: 140 });
    }
    
    // Deliver On and Close time at bottom
    yPos += 20;
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#333333')
       .text('Deliver On', labelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', valueX - 10, yPos);
    
    doc.font('Helvetica')
       .text(data.deliverOn, valueX, yPos);
    
    // Close time
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Close', rightLabelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', rightValueX - 10, yPos);
    
    doc.font('Helvetica')
       .text(data.deliverClose, rightValueX, yPos);
}

/**
 * Draws enhanced special instructions
 */
function drawEnhancedSpecialInstructions(doc, data) {
    const sectionY = 405;
    const labelX = 35;
    const valueX = 145;
    
    // Section background if there are instructions
    if (data.shipper.specialInstructions || data.consignee.specialInstructions) {
        doc.rect(25, sectionY - 5, 562, 35)
           .fill('#fff3cd');
    }
    
    // Special instructions
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#333333')
       .text('Special Instructions', labelX, sectionY);
    
    doc.fillColor('#000000')
       .text(':', valueX - 10, sectionY);
    
    let instructions = [];
    if (data.shipper.specialInstructions) {
        instructions.push(`Shipper: ${data.shipper.specialInstructions}`);
    }
    if (data.consignee.specialInstructions) {
        instructions.push(`Consignee: ${data.consignee.specialInstructions}`);
    }
    
    if (instructions.length > 0) {
        doc.font('Helvetica')
           .fontSize(8)
           .text(instructions.join(' | '), valueX, sectionY, {
               width: 420,
               align: 'left'
           });
    }
}

/**
 * Draws enhanced broker section
 */
function drawEnhancedBrokerSection(doc, data) {
    const sectionY = 445;
    const labelX = 35;
    const valueX = 145;
    const rightLabelX = 340;
    const rightValueX = 450;
    
    // Section header
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor('#1a237e')
       .text('BROKER INFORMATION', labelX, sectionY);
    
    // Underline
    doc.strokeColor('#1a237e')
       .lineWidth(0.5)
       .moveTo(labelX, sectionY + 12)
       .lineTo(280, sectionY + 12)
       .stroke();
    
    let yPos = sectionY + 20;
    
    // Broker
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#333333')
       .text('Broker', labelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', valueX - 10, yPos);
    
    doc.font('Helvetica')
       .text(data.broker, valueX, yPos);
    
    // Phone
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Phone', rightLabelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', rightValueX - 10, yPos);
    
    doc.font('Helvetica')
       .text(data.brokerPhone, rightValueX, yPos);
    
    // Reference and Port
    yPos += 14;
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Reference', labelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', valueX - 10, yPos);
    
    doc.font('Helvetica')
       .text(data.brokerRef, valueX, yPos);
    
    // Port
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Port', rightLabelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', rightValueX - 10, yPos);
    
    doc.font('Helvetica')
       .text(data.port, rightValueX, yPos);
}

/**
 * Draws enhanced load information section with detailed table
 */
function drawEnhancedLoadInfoSection(doc, data) {
    const tableY = 495;
    
    // Table header background
    doc.rect(25, tableY, 562, 20)
       .fill('#1a237e');
    
    // Table header
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#ffffff')
       .text('Load Info', 30, tableY + 6)
       .text('Pieces', 110, tableY + 6)
       .text('Weight', 170, tableY + 6)
       .text('Type', 230, tableY + 6)
       .text('Dimensions', 290, tableY + 6)
       .text('Class', 380, tableY + 6)
       .text('Description', 420, tableY + 6);
    
    // Table border
    doc.strokeColor('#cccccc')
       .lineWidth(1)
       .rect(25, tableY, 562, 120)
       .stroke();
    
    // Table data
    let dataY = tableY + 25;
    const maxPackages = 10; // Make room for 10 packages as requested
    
    if (data.packages && data.packages.length > 0) {
        // Show up to 10 packages
        data.packages.slice(0, maxPackages).forEach((pkg, index) => {
            if (index > 0) {
                // Row separator
                doc.strokeColor('#eeeeee')
                   .lineWidth(0.5)
                   .moveTo(25, dataY - 2)
                   .lineTo(587, dataY - 2)
                   .stroke();
            }
            
            doc.font('Helvetica')
               .fontSize(8)
               .fillColor('#000000')
               .text(pkg.pieces.toString(), 110, dataY, { align: 'center', width: 40 })
               .text(pkg.weight + ' LBS', 170, dataY, { align: 'center', width: 50 })
               .text(pkg.type, 230, dataY, { align: 'center', width: 50 })
               .text(pkg.dimensions || 'N/A', 290, dataY, { align: 'center', width: 80 })
               .text(pkg.class || 'N/A', 380, dataY, { align: 'center', width: 30 })
               .text(pkg.description, 420, dataY, { width: 160 });
            
            dataY += 10;
        });
        
        if (data.packages.length > maxPackages) {
            doc.font('Helvetica-Oblique')
               .fontSize(7)
               .fillColor('#666666')
               .text(`... and ${data.packages.length - maxPackages} more items`, 380, dataY);
        }
    } else {
        // Single line summary
        doc.font('Helvetica')
           .fontSize(8)
           .fillColor('#000000')
           .text(data.pieces.toString(), 110, dataY, { align: 'center', width: 40 })
           .text(data.weight, 170, dataY, { align: 'center', width: 50 })
           .text('FREIGHT', 230, dataY, { align: 'center', width: 50 })
           .text('MIXED', 290, dataY, { align: 'center', width: 80 })
           .text('N/A', 380, dataY, { align: 'center', width: 30 })
           .text(data.description, 420, dataY);
    }
    
    // Totals section
    const totalsY = tableY + 125;
    
    // Totals background
    doc.rect(25, totalsY, 562, 25)
       .fill('#f8f9fa');
    
    // Total pieces and weight
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#333333')
       .text('TOTAL PIECES:', 40, totalsY + 8)
       .text(data.pieces.toString(), 140, totalsY + 8)
       .text('TOTAL WEIGHT:', 220, totalsY + 8)
       .text(data.weight, 310, totalsY + 8);
    
    // Agreed rate - simple black text, no green background
    doc.font('Helvetica-Bold')
       .fontSize(11)
       .fillColor('#000000')
       .text('AGREED RATE', 410, totalsY + 2)
       .fontSize(14)
       .text(data.agreedRate, 410, totalsY + 12, { align: 'right', width: 167 });
}

/**
 * Draws enhanced terms and conditions section - more compact
 */
function drawEnhancedTermsSection(doc, data) {
    const termsY = 650;
    
    // Terms header
    doc.rect(25, termsY, 562, 18)
       .fill('#dc3545');
    
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#ffffff')
       .text('TERMS AND CONDITIONS', 35, termsY + 5);
    
    // Terms content background
    doc.rect(25, termsY + 18, 562, 70)
       .fill('#f8f9fa');
    
    // Terms text - more compact
    let textY = termsY + 23;
    const terms = [
        'Carrier is solely responsible for the payment of freight charges on this shipment. Rate is all inclusive including fuel surcharge.',
        'Carrier must be informed of any change to shipment and any accessorial charges before they occur. All Charges must be confirmed by revised email.',
        'All driver\'s crossing the border MUST have valid passport. Non payment will occur if this order is co-brokered or if customer is back solicited.',
        'Should the Bill of Lading instructions differ from the above and/or any conditions cannot be met, must be notified immediately.',
        'Load confirmation must be signed and emailed back IMMEDIATELY to complete this transaction and for payment to be processed.'
    ];
    
    doc.font('Helvetica')
       .fontSize(7)
       .fillColor('#000000');
    
    terms.forEach(term => {
        doc.text(term, 35, textY, { width: 542 });
        textY += 12;
    });
}

/**
 * Draws enhanced signature section
 */
function drawEnhancedSignatureSection(doc, data) {
    const sigY = 725;
    
    // Signature area background
    doc.rect(25, sigY, 562, 40)
       .fill('#ffffff')
       .strokeColor('#000000')
       .lineWidth(1)
       .stroke();
    
    // X mark
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor('#dc3545')
       .text('X', 40, sigY + 10);
    
    // Signature line
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(60, sigY + 20)
       .lineTo(300, sigY + 20)
       .stroke();
    
    // Signature label
    doc.font('Helvetica')
       .fontSize(9)
       .fillColor('#666666')
       .text('Carrier Signature', 60, sigY + 25);
    
    // Date line
    doc.moveTo(350, sigY + 20)
       .lineTo(450, sigY + 20)
       .stroke();
    
    doc.text('Date', 350, sigY + 25);
    
    // Print name line
    doc.moveTo(480, sigY + 20)
       .lineTo(570, sigY + 20)
       .stroke();
    
    doc.text('Print Name', 480, sigY + 25);
}

/**
 * Stores the confirmation document in Firebase Storage
 */
async function storeConfirmationDocument(pdfBuffer, shipmentId, firebaseDocId) {
    try {
        const fileName = `SOLUSHIP-${shipmentId}-CARRIER-CONFIRMATION.pdf`;
        const bucket = storage.bucket();
        const file = bucket.file(`shipment-documents/${firebaseDocId}/${fileName}`);
        
        // Upload the file
        await file.save(pdfBuffer, {
            metadata: {
                contentType: 'application/pdf',
                metadata: {
                    shipmentId: shipmentId,
                    documentType: 'carrier_confirmation',
                    generatedAt: new Date().toISOString(),
                    enhancedVersion: true,
                    designVersion: '2.0'
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
                documentType: 'carrier_confirmation',
                generatedAt: new Date().toISOString(),
                enhancedVersion: true,
                designVersion: '2.0'
            }
        });
        
        // Firebase Storage download URL with token
        const firebaseStorageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${downloadToken}`;
        
        const documentData = {
            shipmentId: firebaseDocId,
            fileName: fileName,
            filename: fileName, // Keep for backward compatibility
            docType: 7, // Carrier confirmation type
            fileSize: pdfBuffer.length,
            documentType: 'carrier_confirmation',
            downloadUrl: firebaseStorageUrl,
            publicUrl: publicUrl,
            downloadToken: downloadToken,
            storagePath: `shipment-documents/${firebaseDocId}/${fileName}`,
            metadata: {
                shipmentId: shipmentId,
                documentFormat: 'PDF',
                confirmationGenerated: true,
                isQuickShip: true,
                enhancedVersion: true,
                designImprovements: [
                    'Professional SolushipX logo',
                    'Enhanced data mapping',
                    'Improved layout and spacing',
                    'Comprehensive package details',
                    'Better visual hierarchy',
                    'Color-coded sections',
                    'All requested fixes implemented'
                ]
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            _isUnifiedStructure: true
        };
        
        const unifiedDocRef = db.collection('shipments').doc(firebaseDocId)
                                .collection('documents').doc(`${firebaseDocId}_carrier_confirmation`);
        await unifiedDocRef.set(documentData);
        
        const legacyDocRef = db.collection('shipmentDocuments').doc(`${firebaseDocId}_carrier_confirmation`);
        await legacyDocRef.set({
            ...documentData,
            unifiedDocumentId: `${firebaseDocId}_carrier_confirmation`,
            migrationNote: 'Enhanced carrier confirmation with all requested fixes',
            _isUnifiedStructure: true
        });
        
        logger.info(`Enhanced Carrier Confirmation stored:`, {
            shipmentId: firebaseDocId,
            documentId: `${firebaseDocId}_carrier_confirmation`,
            storagePath: documentData.storagePath,
            downloadUrl: firebaseStorageUrl,
            enhancements: documentData.metadata.designImprovements
        });
        
        return {
            documentId: `${firebaseDocId}_carrier_confirmation`,
            downloadUrl: firebaseStorageUrl,
            publicUrl: publicUrl,
            fileName: fileName,
            storagePath: documentData.storagePath
        };
        
    } catch (error) {
        logger.error('Error storing Enhanced Carrier Confirmation:', error);
        throw new Error(`Failed to store Carrier Confirmation: ${error.message}`);
    }
}

module.exports = {
    generateCarrierConfirmation,
    generateCarrierConfirmationCore
}; 