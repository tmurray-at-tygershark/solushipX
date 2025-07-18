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
        
        // DEBUG: Log final broker object AFTER bolData is created
        if (bolData && bolData.broker) {
            console.log('🎯 BOL Generation - Final Broker Object:', {
                name: bolData.broker.name,
                phone: bolData.broker.phone,
                email: bolData.broker.email,
                port: bolData.broker.port,
                reference: bolData.broker.reference
            });
            console.log('🔥 PORT AND REFERENCE VALUES:', {
                portValue: bolData.broker.port,
                portType: typeof bolData.broker.port,
                referenceValue: bolData.broker.reference,
                referenceType: typeof bolData.broker.reference,
                portTrimmed: typeof bolData.broker.port === 'string' ? bolData.broker.port.trim() : 'NOT_STRING',
                referenceTrimmed: typeof bolData.broker.reference === 'string' ? bolData.broker.reference.trim() : 'NOT_STRING'
            });
        }
        
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
    
    // Extract additional reference numbers
    const referenceNumbers = shipmentData.shipmentInfo?.referenceNumbers || [];
    
    // Use SHIPMENT ID as BOL number instead of random number
    const bolNumber = shipmentData.shipmentID || shipmentId || 'Unknown';
    
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

        // ETA information removed from BOL generation
    
    // Calculate total weight and piece count with enhanced extraction
    let totalWeight = 0;
    let totalPieces = 0;
    
    packages.forEach(pkg => {
        // Enhanced weight extraction with unit conversion
        const weight = parseFloat(String(pkg.weight || 0).replace(/[^\d.-]/g, '')) || 0;
        const weightUnit = pkg.weightUnit || shipmentData.unitSystem || 'lbs';
        
        // Convert kg to lbs if needed
        let convertedWeight = weight;
        if (weightUnit.toLowerCase().includes('kg') || weightUnit.toLowerCase().includes('kilo')) {
            convertedWeight = weight * 2.20462;
        }
        
        // Enhanced quantity extraction with multiple fallback fields
        const quantity = parseInt(String(
            pkg.quantity || 
            pkg.packagingQuantity || 
            pkg.qty || 
            pkg.packageQuantity || 
            pkg.pieces || 
            1
        ).replace(/[^\d]/g, '')) || 1;
        
        totalWeight += (convertedWeight * quantity); // FIXED: Weight × Quantity  
        totalPieces += quantity;
    });
    
    // Get carrier name from QuickShip
    const carrierName = shipmentData.selectedCarrier || 
                       shipmentData.carrier || 
                       'GENERIC CARRIER';
    
    // Extract billing type from shipment data - ENHANCED for QuickShip
    const billingType = shipmentData.shipmentInfo?.billingType || 
                       shipmentData.shipmentInfo?.shipmentBillType ||
                       shipmentData.billingType || 
                       shipmentData.paymentTerms ||
                       shipmentData.billing?.type ||
                       shipmentData.billing ||
                       shipmentData.freightTerms ||
                       'third_party'; // Default to third_party to match form values
    
    console.log(`🔍 BOL Generation - Billing type extraction:`, {
        'shipmentInfo.billingType': shipmentData.shipmentInfo?.billingType,
        'shipmentInfo.shipmentBillType': shipmentData.shipmentInfo?.shipmentBillType,
        'billingType': shipmentData.billingType,
        'paymentTerms': shipmentData.paymentTerms,
        'billing.type': shipmentData.billing?.type,
        'billing': shipmentData.billing,
        'freightTerms': shipmentData.freightTerms,
        'FINAL billingType': billingType,
        'FINAL billingType NORMALIZED': billingType.toLowerCase()
    });
    
    // Extract special instructions dynamically from shipment data
    const specialInstructions = [];
    
    // REMOVED HARDCODED MESSAGES - now only show actual shipment instructions
    
    // Add general special instructions from shipment data
    const generalInstructions = shipmentData.specialInstructions || 
                               shipmentData.shipmentInfo?.specialInstructions ||
                               shipmentData.generalInstructions;
    
    if (generalInstructions && generalInstructions.trim()) {
        // Handle both string and array formats
        if (Array.isArray(generalInstructions)) {
            generalInstructions.forEach(instruction => {
                if (instruction && instruction.trim()) {
                    specialInstructions.push(instruction.trim());
                }
            });
        } else {
            specialInstructions.push(generalInstructions.trim());
        }
    }
    
    // Add pickup special instructions if available
    const pickupInstructions = shipmentData.shipmentInfo?.pickupSpecialInstructions ||
                              shipmentData.pickup_instructions ||
                              shipmentData.specialInstructions?.pickup ||
                              shipmentData.shipFrom?.specialInstructions;
    if (pickupInstructions && pickupInstructions.trim()) {
        specialInstructions.push(`PICKUP: ${pickupInstructions.trim()}`);
    }
    
    // Add delivery special instructions if available
    const deliveryInstructions = shipmentData.shipmentInfo?.deliverySpecialInstructions ||
                                shipmentData.delivery_instructions ||
                                shipmentData.specialInstructions?.delivery ||
                                shipmentData.shipTo?.specialInstructions;
    if (deliveryInstructions && deliveryInstructions.trim()) {
        specialInstructions.push(`DELIVERY: ${deliveryInstructions.trim()}`);
    }
    
    // Add handling instructions if available
    const handlingInstructions = shipmentData.shipmentInfo?.handlingInstructions ||
                                shipmentData.handling_instructions ||
                                shipmentData.specialInstructions?.handling;
    if (handlingInstructions && handlingInstructions.trim()) {
        specialInstructions.push(`HANDLING: ${handlingInstructions.trim()}`);
    }
    
    // Add hazmat or dangerous goods instructions
    const hazmatInstructions = shipmentData.shipmentInfo?.hazmatInstructions ||
                              shipmentData.hazmat_instructions ||
                              shipmentData.dangerousGoods?.instructions;
    if (hazmatInstructions && hazmatInstructions.trim()) {
        specialInstructions.push(`HAZMAT: ${hazmatInstructions.trim()}`);
    }
    
    // Add custom instructions from packages if available
    if (packages && Array.isArray(packages)) {
        packages.forEach((pkg, index) => {
            if (pkg.specialInstructions && pkg.specialInstructions.trim()) {
                specialInstructions.push(`PACKAGE ${index + 1}: ${pkg.specialInstructions.trim()}`);
            }
        });
    }
    
            return {
            // Header Information
            bolNumber: bolNumber.toString(),
            shipDate: formattedShipDate,
            carrier: carrierName,
            proNumber: proNumber,
            customerRef: referenceNumber,
            referenceNumbers: referenceNumbers,
        
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
            openTime: extractOpenTime(shipFrom),   // FIXED: Use address-based extraction
            closeTime: extractCloseTime(shipFrom), // FIXED: Use address-based extraction
            specialInstructions: shipFrom?.specialInstructions || shipFrom?.instructions || ''
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
            phone: shipTo?.phone || '',
            openTime: extractOpenTime(shipTo),   // FIXED: Use address-based extraction
            closeTime: extractCloseTime(shipTo), // FIXED: Use address-based extraction
            specialInstructions: shipTo?.specialInstructions || shipTo?.instructions || ''
        },
        
        // Third Party Billing (Integrated Carriers)
        thirdParty: {
            company: 'INTEGRATED CARRIERS',
            address1: '9 - 75 FIRST STREET,',
            address2: 'SUITE 209,',
            city: 'ORANGEVILLE',
            state: 'ON',
            zip: 'L9W 5B6',
            accountNumber: '' // Will be populated dynamically in the future
        },

        // Customs Broker Information - SAFE extraction with comprehensive null checks
        broker: (() => {
            try {
                // Safely check if broker data exists
                const brokerDetails = (shipmentData && typeof shipmentData === 'object') ? shipmentData.brokerDetails : null;
                const selectedBroker = (shipmentData && typeof shipmentData === 'object') ? shipmentData.selectedBroker : null;
                
                // Check multiple possible field names for port and reference
                const brokerPort = (shipmentData && typeof shipmentData === 'object') ? 
                    (shipmentData.brokerPort || shipmentData.port || shipmentData.customsPort) : null;
                const brokerReference = (shipmentData && typeof shipmentData === 'object') ? 
                    (shipmentData.brokerReference || shipmentData.reference || shipmentData.customsReference || shipmentData.brokerRef) : null;

                // DEBUG: Log broker data for troubleshooting
                console.log('🔍 BOL Generation - Broker Data Debug:', {
                    hasShipmentData: !!shipmentData,
                    selectedBroker,
                    extractedBrokerPort: brokerPort,
                    extractedBrokerReference: brokerReference,
                    shipmentDataBrokerFields: shipmentData ? {
                        brokerPort: shipmentData.brokerPort,
                        port: shipmentData.port,
                        customsPort: shipmentData.customsPort,
                        brokerReference: shipmentData.brokerReference,
                        reference: shipmentData.reference,
                        customsReference: shipmentData.customsReference,
                        brokerRef: shipmentData.brokerRef
                    } : null,
                    brokerDetails: brokerDetails ? {
                        name: brokerDetails.name,
                        port: brokerDetails.port,
                        reference: brokerDetails.reference,
                        brokerPort: brokerDetails.brokerPort,
                        brokerReference: brokerDetails.brokerReference
                    } : null
                });
                
                // ADDITIONAL DEBUG: Log what we're actually getting
                console.log('🚀 SHIPMENT DATA RECEIVED:', JSON.stringify(shipmentData, null, 2));

                return {
                    name: (() => {
                        try {
                            let brokerName = '';
                            if (brokerDetails && typeof brokerDetails === 'object') {
                                brokerName = brokerDetails.name || brokerDetails.brokerName || 
                                           brokerDetails.companyName || brokerDetails.id || '';
                            }
                            if (!brokerName && selectedBroker) {
                                brokerName = String(selectedBroker);
                            }
                            return String(brokerName || '');
                        } catch (e) {
                            return '';
                        }
                    })(),
                    phone: (() => {
                        try {
                            if (!brokerDetails || typeof brokerDetails !== 'object') return '';
                            return String(brokerDetails.phone || brokerDetails.telephone || 
                                   brokerDetails.contactPhone || brokerDetails.phoneNumber || '');
                        } catch (e) {
                            return '';
                        }
                    })(),
                    email: (() => {
                        try {
                            if (!brokerDetails || typeof brokerDetails !== 'object') return '';
                            return String(brokerDetails.email || brokerDetails.contactEmail || 
                                   brokerDetails.emailAddress || '');
                        } catch (e) {
                            return '';
                        }
                    })(),
                    fax: (() => {
                        try {
                            if (!brokerDetails || typeof brokerDetails !== 'object') return '';
                            return String(brokerDetails.fax || brokerDetails.faxNumber || '');
                        } catch (e) {
                            return '';
                        }
                    })(),

                    port: (() => {
                        try {
                            // Check multiple possible sources for port data
                            let port = brokerPort || '';
                            if (!port && brokerDetails && typeof brokerDetails === 'object') {
                                port = brokerDetails.port || brokerDetails.brokerPort || '';
                            }
                            return String(port || '');
                        } catch (e) {
                            return '';
                        }
                    })(),
                    reference: (() => {
                        try {
                            // Check multiple possible sources for reference data
                            let reference = brokerReference || '';
                            if (!reference && brokerDetails && typeof brokerDetails === 'object') {
                                reference = brokerDetails.reference || brokerDetails.brokerReference || brokerDetails.referenceNumber || '';
                            }
                            return String(reference || '');
                        } catch (e) {
                            return '';
                        }
                    })()
                };
            } catch (e) {
                // Ultimate fallback - return empty broker object
                console.warn('BOL Generation: Error extracting broker data, using empty fallback:', e);
                return {
                    name: '', phone: '', email: '', port: '', reference: ''
                };
            }
        })(),
        
        
        
        // Package Information - Enhanced mapping for QuickShip with quantity and units
        packages: packages.map((pkg, index) => {
            const weight = parseFloat(String(pkg.weight || 0).replace(/[^\d.-]/g, '')) || 0;
            const weightUnit = pkg.weightUnit || shipmentData.unitSystem || 'lbs';
            
            // Convert weight to lbs for display if needed
            let displayWeight = weight;
            if (weightUnit.toLowerCase().includes('kg') || weightUnit.toLowerCase().includes('kilo')) {
                displayWeight = weight * 2.20462;
            }
            
            const length = pkg.length || 48;
            const width = pkg.width || 40;
            const height = pkg.height || 48;
            const declaredValue = parseFloat(String(pkg.declaredValue || 0).replace(/[^\d.-]/g, '')) || 0;
            const declaredValueCurrency = pkg.declaredValueCurrency || 'CAD';
            
            // Enhanced quantity extraction
            const quantity = parseInt(String(
                pkg.quantity || 
                pkg.packagingQuantity || 
                pkg.qty || 
                pkg.packageQuantity || 
                pkg.pieces || 
                1
            ).replace(/[^\d]/g, '')) || 1;
            
            return {
                type: pkg.packageType || pkg.type || 'PALLET',
                weight: displayWeight, // Use converted weight
                originalWeight: weight, // Keep original for reference
                weightUnit: weightUnit, // Store original unit
                quantity: quantity, // Store actual quantity
                description: pkg.description || 
                           pkg.itemDescription ||
                           'General Freight',
                dimensions: `${length} x ${width} x ${height}`,
                freightClass: pkg.freightClass || pkg.class || '',
                declaredValue: declaredValue,
                declaredValueCurrency: declaredValueCurrency,
                hazmat: pkg.hazmat || pkg.isDangerous || false
            };
        }),
        
        // Totals
        totalPieces: totalPieces,
        totalWeight: totalWeight,
        
        // Billing Information
        billingType: billingType,
        
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
 * OPTIMIZED FOR 8.5x11 (LETTER SIZE) FORMAT - UPDATED with improved spacing
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
    
    // Header Section (Y: 20-85) - UPDATED range
    drawExactHeader(doc, bolData);
    
    // Ship From/To Section (Y: 85-245) - UPDATED positioning 
    drawExactShippingSection(doc, bolData);
    
    // Third Party Billing Section (Y: 245-325) - UPDATED positioning
    drawExactThirdPartySection(doc, bolData);
    
    // Special Instructions Section (Y: 330-375) - UPDATED positioning
    drawExactSpecialInstructions(doc, bolData);
    
    // Freight Table Section (Y: 380-520) - UPDATED positioning
    drawExactFreightTable(doc, bolData);
    
    // Value Declaration Section (Y: 540-580) - ADJUSTED for totals section
    drawExactValueDeclaration(doc, bolData);
    
    // Trailer Information Section (Y: 585-635) - ADJUSTED for totals section
    drawExactTrailerSection(doc, bolData);
    
    // Signature Section (Y: 640-740) - ADJUSTED for totals section
    drawExactSignatureSection(doc, bolData);
    
    // Legal disclaimer at bottom (Y: 750-765) - ADJUSTED for totals section
    drawExactLegalDisclaimer(doc);
}

/**
 * Draws the exact header section matching the Polaris BOL with SolushipX branding
 * IMPROVED VERSION with better spacing and positioning
 */
function drawExactHeader(doc, bolData) {
    // IMPROVED HEADER LAYOUT - Better spacing and positioning
    
    // Company logo area (top-left) - REPOSITIONED for better spacing
    try {
        const logoPath = path.join(__dirname, '../../assets/integratedcarrriers_logo_blk.png');
        if (fs.existsSync(logoPath)) {
            // Embed the actual logo image with better positioning
            doc.image(logoPath, 30, 35, {
                width: 180, // Increased width for better visibility
                height: 50, // Reduced height for better proportion
                fit: [180, 50],
                align: 'left',
                valign: 'center'
            });
        } else {
            // Fallback to text-based logo with improved positioning
            doc.font('Helvetica-Bold')
               .fontSize(18) // Increased font size
               .fillColor('#000000')
               .text('SolushipX', 30, 40);
            
            // Add registered trademark symbol
            doc.fontSize(8) // Increased trademark size
               .text('®', 150, 35);
            
            // Company subtitle with better spacing
            doc.font('Helvetica')
               .fontSize(10) // Increased subtitle size
               .text('INTEGRATED CARRIERS', 30, 60)
               .fontSize(8)
               .text('Freight Logistics & Transportation', 30, 72);
        }
    } catch (error) {
        console.error('Error loading logo image:', error);
        // Fallback to text-based logo with improved positioning
        doc.font('Helvetica-Bold')
           .fontSize(18)
           .fillColor('#000000')
           .text('SolushipX', 30, 40);
        
        doc.fontSize(8)
           .text('®', 150, 35);
        
        doc.font('Helvetica')
           .fontSize(10)
           .text('INTEGRATED CARRIERS', 30, 60)
           .fontSize(8)
           .text('Freight Logistics & Transportation', 30, 72);
    }
    
    // Title section (center-right) - REPOSITIONED to avoid overlap
    doc.font('Helvetica-Bold')
       .fontSize(14) // Increased title font size
       .fillColor('#000000')
       .text('LTL Bill of Lading- Not Negotiable', 220, 30, {
           width: 200, // Increased width
           align: 'center'
       });
    
    // BOL Number box - IMPROVED sizing and positioning
    doc.lineWidth(1.5) // Thicker border for better visibility
       .rect(430, 35, 140, 35) // Larger box: width 140, height 35
       .stroke();
    
    // BOL Number label with better spacing
    doc.font('Helvetica-Bold')
       .fontSize(8) // Increased label font size
       .fillColor('#000000')
       .text('BOL Number:', 435, 42);
    
    // BOL Number value with better positioning
    doc.font('Helvetica-Bold')
       .fontSize(11) // Increased number font size
       .fillColor('#000000')
       .text(bolData.bolNumber, 435, 55, {
           width: 130,
           align: 'left'
       });
    
    // Add a subtle background for the BOL number box
    doc.fillColor('#f8f9fa')
       .rect(431, 36, 138, 33)
       .fill()
       .strokeColor('#000000')
       .rect(430, 35, 140, 35)
       .stroke();
    
    // Re-draw the BOL number text over the background
    doc.fillColor('#000000')
       .font('Helvetica-Bold')
       .fontSize(8)
       .text('BOL Number:', 435, 42);
    
    doc.font('Helvetica-Bold')
       .fontSize(11)
       .text(bolData.bolNumber, 435, 55, {
           width: 130,
           align: 'left'
       });
    
    // Horizontal separator line - REPOSITIONED for better spacing
    doc.strokeColor('#000000')
       .lineWidth(1.5) // Thicker separator line
       .moveTo(25, 85) // Moved up from 100 to 85
       .lineTo(587, 85)
       .stroke();
    

}

/**
 * Draws the exact shipping addresses section
 * IMPROVED VERSION with better spacing, proper time extraction, and layout
 */
function drawExactShippingSection(doc, bolData) {
    // Ship From section (left column) - IMPROVED spacing
    doc.lineWidth(1)
       .rect(25, 85, 280, 85) // Increased height from 80 to 85
       .stroke();
    
    // Ship From header
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .fillColor('#FFFFFF')
       .rect(25, 85, 280, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('SHIP FROM', 30, 90);
    
    // Ship From content - IMPROVED layout
    doc.fillColor('#000000')
       .font('Helvetica-Bold')
       .fontSize(8) // Increased from 7 to 8
       .text(bolData.shipFrom.company, 30, 105);
    
    // Contact information - only show if meaningful
    let yPos = 115;
    if (bolData.shipFrom.contact && bolData.shipFrom.contact.trim() !== '' && 
        bolData.shipFrom.contact !== bolData.shipFrom.company) {
        doc.font('Helvetica')
           .fontSize(7)
           .text(`Contact: ${bolData.shipFrom.contact}`, 30, yPos);
        yPos += 9;
    }
    
    // Address lines - FIXED: Combine address1 and address2 on same line
    doc.font('Helvetica')
       .fontSize(7);
    
    if (bolData.shipFrom.address1) {
        let fullAddress = bolData.shipFrom.address1;
        if (bolData.shipFrom.address2 && bolData.shipFrom.address2.trim()) {
            fullAddress += `, ${bolData.shipFrom.address2}`;
            console.log(`🏠 BOL DEBUG: Combined Ship From address: "${fullAddress}"`);
        } else {
            console.log(`🏠 BOL DEBUG: Ship From address (no address2): "${fullAddress}"`);
        }
        doc.text(fullAddress, 30, yPos);
        yPos += 9;
    }
    
    // City, State, Zip
    doc.text(`${bolData.shipFrom.city}, ${bolData.shipFrom.state} ${bolData.shipFrom.zip}`, 30, yPos);
    yPos += 12;
    
    // Phone with better formatting
    if (bolData.shipFrom.phone && bolData.shipFrom.phone.trim()) {
        const formattedPhone = formatPhoneNumber(bolData.shipFrom.phone);
        doc.font('Helvetica')
           .fontSize(7)
           .text(`Phone: ${formattedPhone}`, 30, yPos);
        yPos += 9;
    }
    
    // Special instructions with improved positioning
    if (bolData.shipFrom.specialInstructions && bolData.shipFrom.specialInstructions.trim()) {
        doc.font('Helvetica-Bold')
           .fontSize(6)
           .text('Instructions:', 30, yPos);
        doc.font('Helvetica')
           .fontSize(6)
           .text(bolData.shipFrom.specialInstructions, 85, yPos, { 
               width: 210, // Increased width to use more available space
               height: 20
           });
    }
    
    // Ship From timing (right side) - FIXED: Use direct openTime/closeTime from extracted data
    console.log(`⏰ BOL DEBUG: Ship From timing - Open: ${bolData.shipFrom.openTime}, Close: ${bolData.shipFrom.closeTime}, Position X=230`);
    
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('Open:', 230, 105); // FIXED: Moved right from 210 to 230
    
    doc.font('Helvetica')
       .fontSize(7)
       .text(bolData.shipFrom.openTime, 255, 105); // FIXED: Use direct data
    
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('Close:', 230, 115); // FIXED: Moved right from 210 to 230
    
    doc.font('Helvetica')
       .fontSize(7)
       .text(bolData.shipFrom.closeTime, 255, 115); // FIXED: Use direct data
    
    // Ship date and carrier info (right side) - REPOSITIONED for better layout with fixed spacing
    doc.font('Helvetica-Bold')
       .fontSize(8) // Increased font size
       .text('Ship Date:', 320, 105)
       .font('Helvetica')
       .fontSize(8)
       .text(bolData.shipDate, 375, 105);
    
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .text('Carrier:', 320, 118)
       .font('Helvetica')
       .fontSize(7) // Smaller font for long carrier names
       .text(bolData.carrier, 360, 118, { width: 220 });
    
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .text('Pro Number:', 320, 128)  // FIXED: Reduced gap from 131 to 128
       .font('Helvetica')
       .fontSize(8)
       .text(bolData.proNumber, 385, 128);

    // ETA Fields removed from BOL generation
    
    // Ship To section - IMPROVED spacing and layout
    doc.lineWidth(1)
       .rect(25, 175, 280, 90) // Reduced height by 10px (from 100 to 90)
       .stroke();
    
    // Ship To header
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .fillColor('#FFFFFF')
       .rect(25, 175, 280, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('SHIP TO', 30, 180);
    
    // Ship To content - IMPROVED layout
    doc.fillColor('#000000')
       .font('Helvetica-Bold')
       .fontSize(8) // Increased from 7 to 8
       .text(bolData.shipTo.company, 30, 195);
    
    // Contact information - only show if meaningful
    let shipToYPos = 205;
    if (bolData.shipTo.contact && bolData.shipTo.contact.trim() !== '' && 
        bolData.shipTo.contact !== bolData.shipTo.company) {
        doc.font('Helvetica')
           .fontSize(7)
           .text(`Contact: ${bolData.shipTo.contact}`, 30, shipToYPos);
        shipToYPos += 9;
    }
    
    // Address lines - FIXED: Combine address1 and address2 on same line
    doc.font('Helvetica')
       .fontSize(7);
    
    if (bolData.shipTo.address1) {
        let fullAddress = bolData.shipTo.address1;
        if (bolData.shipTo.address2 && bolData.shipTo.address2.trim()) {
            fullAddress += `, ${bolData.shipTo.address2}`;
        }
        doc.text(fullAddress, 30, shipToYPos);
        shipToYPos += 9;
    }
    
    // City, State, Zip
    doc.text(`${bolData.shipTo.city}, ${bolData.shipTo.state} ${bolData.shipTo.zip}`, 30, shipToYPos);
    shipToYPos += 12;
    
    // Phone with better formatting
    if (bolData.shipTo.phone && bolData.shipTo.phone.trim()) {
        const formattedPhone = formatPhoneNumber(bolData.shipTo.phone);
        doc.font('Helvetica')
           .fontSize(7)
           .text(`Phone: ${formattedPhone}`, 30, shipToYPos);
        shipToYPos += 9;
    }
    
    // Special instructions with improved positioning
    if (bolData.shipTo.specialInstructions && bolData.shipTo.specialInstructions.trim()) {
        doc.font('Helvetica-Bold')
           .fontSize(6)
           .text('Instructions:', 30, shipToYPos);
        doc.font('Helvetica')
           .fontSize(6)
           .text(bolData.shipTo.specialInstructions, 85, shipToYPos, { 
               width: 210, // Increased width to use more available space
               height: 20
           });
    }
    
    // FIXED: Add Ship To timing (right side) - use direct data from bolData.shipTo
    console.log(`⏰ BOL DEBUG: Ship To timing - Open: ${bolData.shipTo.openTime}, Close: ${bolData.shipTo.closeTime}, Position X=230`);
    
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('Open:', 230, 195); // Position similar to Ship From
    
    doc.font('Helvetica')
       .fontSize(7)
       .text(bolData.shipTo.openTime, 255, 195); // FIXED: Use direct data
    
    doc.font('Helvetica-Bold')
       .fontSize(7)
       .text('Close:', 230, 205);
    
    doc.font('Helvetica')
       .fontSize(7)
       .text(bolData.shipTo.closeTime, 255, 205); // FIXED: Use direct data
    
    // References section (right column) - IMPROVED positioning
    doc.lineWidth(1)
       .rect(305, 175, 282, 90) // Reduced height by 10px to match ship to
       .stroke();
    
    // References header
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .fillColor('#FFFFFF')
       .rect(305, 175, 282, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('REFERENCES', 310, 180);
    
    // References content - IMPROVED layout and spacing
    doc.fillColor('#000000')
       .font('Helvetica-Bold')
       .fontSize(8) // Increased font size
       .text('Shipment ID:', 310, 195)
       .font('Helvetica')
       .fontSize(8)
       .text(bolData.bolNumber, 375, 195);
    
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .text('Customer Ref #:', 310, 210)
       .font('Helvetica')
       .fontSize(8)
       .text(bolData.customerRef || '', 395, 210);
    
    // Display additional reference numbers if available
    let refYPos = 225;
    if (bolData.referenceNumbers && bolData.referenceNumbers.length > 0) {
        // Show up to 2 additional references
        bolData.referenceNumbers.slice(0, 2).forEach((ref, index) => {
            if (ref && ref.trim()) {
                doc.font('Helvetica')
                   .fontSize(7)
                   .text(ref, 395, refYPos);
                refYPos += 10;
            }
        });
        
        // If there are more than 2 additional references, show "..."
        if (bolData.referenceNumbers.length > 2) {
            doc.font('Helvetica')
               .fontSize(6)
               .text('...', 395, refYPos);
        }
    } else {
        // Original P.O. Number field if no additional references
        doc.font('Helvetica-Bold')
           .fontSize(8)
           .text('P.O. Number:', 310, 225)
           .font('Helvetica')
           .fontSize(8)
           .text('', 385, 225);
        
        // Add empty line for manual entry
        doc.strokeColor('#CCCCCC')
           .lineWidth(0.5)
           .moveTo(385, 235)
           .lineTo(570, 235)
           .stroke();
    }
}

/**
 * Extracts open time from address record with proper fallback
 * @param {Object} address - Address object from shipment data
 * @returns {string} - Formatted open time or empty string
 */
function extractOpenTime(address) {
    console.log(`🕐 BOL DEBUG: Extracting open time from address:`, {
        hasBusinessHours: !!address?.businessHours,
        hasLegacyOpenHours: !!address?.openHours,
        hasOpenTime: !!address?.openTime,
        businessHours: address?.businessHours,
        openHours: address?.openHours,
        openTime: address?.openTime
    });
    
    // Check for business hours in various formats
    if (address.businessHours) {
        // New format with business hours object
        if (address.businessHours.useCustomHours) {
            // For custom hours, we could show "Varies" or extract Monday hours as default
            const mondayHours = address.businessHours.customHours?.monday;
            if (mondayHours && !mondayHours.closed && mondayHours.open) {
                const openTime = formatTime(mondayHours.open);
                console.log(`🕐 BOL DEBUG: Using Monday custom hours open: ${openTime}`);
                return openTime;
            }
        } else if (address.businessHours.defaultHours?.open) {
            const openTime = formatTime(address.businessHours.defaultHours.open);
            console.log(`🕐 BOL DEBUG: Using default hours open: ${openTime}`);
            return openTime;
        }
    }
    
    // Check legacy format
    if (address.openHours || address.openTime) {
        const openTime = formatTime(address.openHours || address.openTime);
        console.log(`🕐 BOL DEBUG: Using legacy open hours: ${openTime}`);
        return openTime;
    }
    
    console.log(`🕐 BOL DEBUG: No open time found, returning empty string`);
    // Return empty string if no time found
    return '';
}

/**
 * Extracts close time from address record with proper fallback
 * @param {Object} address - Address object from shipment data
 * @returns {string} - Formatted close time or empty string
 */
function extractCloseTime(address) {
    console.log(`🕕 BOL DEBUG: Extracting close time from address:`, {
        hasBusinessHours: !!address?.businessHours,
        hasLegacyCloseHours: !!address?.closeHours,
        hasCloseTime: !!address?.closeTime,
        businessHours: address?.businessHours,
        closeHours: address?.closeHours,
        closeTime: address?.closeTime
    });
    
    // Check for business hours in various formats
    if (address.businessHours) {
        // New format with business hours object
        if (address.businessHours.useCustomHours) {
            // For custom hours, we could show "Varies" or extract Monday hours as default
            const mondayHours = address.businessHours.customHours?.monday;
            if (mondayHours && !mondayHours.closed && mondayHours.close) {
                const closeTime = formatTime(mondayHours.close);
                console.log(`🕕 BOL DEBUG: Using Monday custom hours close: ${closeTime}`);
                return closeTime;
            }
        } else if (address.businessHours.defaultHours?.close) {
            const closeTime = formatTime(address.businessHours.defaultHours.close);
            console.log(`🕕 BOL DEBUG: Using default hours close: ${closeTime}`);
            return closeTime;
        }
    }
    
    // Check legacy format
    if (address.closeHours || address.closeTime) {
        const closeTime = formatTime(address.closeHours || address.closeTime);
        console.log(`🕕 BOL DEBUG: Using legacy close hours: ${closeTime}`);
        return closeTime;
    }
    
    console.log(`🕕 BOL DEBUG: No close time found, returning empty string`);
    // Return empty string if no time found
    return '';
}

/**
 * Formats time string to consistent format
 * @param {string} timeString - Time in various formats
 * @returns {string} - Formatted time (HH:MM) or empty string for 0:00
 */
function formatTime(timeString) {
    if (!timeString || timeString.trim() === '') {
        return '';
    }
    
    // Convert to string and clean
    const cleanTime = String(timeString).trim();
    
    // If time is 0:00, 00:00, or similar, return empty string
    if (cleanTime === '0:00' || cleanTime === '00:00' || cleanTime === '0000' || cleanTime === '0') {
        return '';
    }
    
    // If already in HH:MM format, return as is
    if (/^\d{1,2}:\d{2}$/.test(cleanTime)) {
        return cleanTime;
    }
    
    // If in HHMM format, add colon
    if (/^\d{4}$/.test(cleanTime)) {
        const formatted = `${cleanTime.substring(0, 2)}:${cleanTime.substring(2, 4)}`;
        // Check if it's 00:00 after formatting
        if (formatted === '00:00') {
            return '';
        }
        return formatted;
    }
    
    // If in H:MM or HH:M format, normalize
    if (/^\d{1,2}:\d{1,2}$/.test(cleanTime)) {
        const [hours, minutes] = cleanTime.split(':');
        const formatted = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
        // Check if it's 00:00 after formatting
        if (formatted === '00:00') {
            return '';
        }
        return formatted;
    }
    
    // Return as-is if can't parse
    return cleanTime;
}

/**
 * Formats phone number for better display
 * @param {string} phone - Raw phone number
 * @returns {string} - Formatted phone number
 */
function formatPhoneNumber(phone) {
    if (!phone || phone.trim() === '') {
        return '';
    }
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Format based on length
    if (digits.length === 10) {
        // US/Canada format: (XXX) XXX-XXXX
        return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6, 10)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
        // US/Canada with country code: 1 (XXX) XXX-XXXX
        return `1 (${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7, 11)}`;
    } else {
        // Return original if can't format
        return phone;
    }
}

/**
 * Draws the exact third party billing section
 * IMPROVED VERSION with dynamic billing address and enhanced layout
 */
function drawExactThirdPartySection(doc, bolData) {
    // Third party billing section (left column) - Split into two columns like SHIP TO/REFERENCES
    doc.lineWidth(1)
       .rect(25, 270, 280, 80) // Left column: same width as SHIP TO
       .stroke();

    // Third party header (left column)
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .fillColor('#FFFFFF')
       .rect(25, 270, 280, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('THIRD PARTY FREIGHT CHARGES BILLED TO', 30, 275);

    // Customs Broker section (right column)
    doc.lineWidth(1)
       .rect(305, 270, 282, 80) // Right column: same width as REFERENCES
       .stroke();

    // Customs Broker header (right column)
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .fillColor('#FFFFFF')
       .rect(305, 270, 282, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('CUSTOMS BROKER', 310, 275);

    // Customs Broker content (right column) - ORGANIZED label:value format
    try {
        doc.fillColor('#000000')
           .font('Helvetica')
           .fontSize(7);

        let brokerYPos = 293;

        // Check if we have any broker data at all
        const hasBrokerData = bolData && bolData.broker && (
            (bolData.broker.name && String(bolData.broker.name).trim()) ||
            (bolData.broker.phone && String(bolData.broker.phone).trim()) ||
            (bolData.broker.email && String(bolData.broker.email).trim()) ||
            (bolData.broker.port && String(bolData.broker.port).trim()) ||
            (bolData.broker.reference && String(bolData.broker.reference).trim())
        );

        if (!hasBrokerData) {
            // Display "No broker assigned" if no broker data exists
            doc.text('No broker assigned', 310, brokerYPos);
        } else {
            // Display broker information in label:value format

            // Broker Name: [value]
            if (bolData.broker.name) {
                try {
                    const nameValue = String(bolData.broker.name).trim();
                    if (nameValue && nameValue !== 'null' && nameValue !== 'undefined') {
                        doc.text(`Broker Name: ${nameValue}`, 310, brokerYPos);
                        brokerYPos += 9;
                    }
                } catch (e) {
                    console.warn('BOL: Error displaying broker name:', e);
                }
            }

            // Phone: [value]
            if (bolData.broker.phone) {
                try {
                    const phoneValue = String(bolData.broker.phone).trim();
                    if (phoneValue && phoneValue !== 'null' && phoneValue !== 'undefined') {
                        doc.text(`Phone: ${phoneValue}`, 310, brokerYPos);
                        brokerYPos += 9;
                    }
                } catch (e) {
                    console.warn('BOL: Error displaying broker phone:', e);
                }
            }
            
            // Email: [value]
            if (bolData.broker.email) {
                try {
                    const emailValue = String(bolData.broker.email).trim();
                    if (emailValue && emailValue !== 'null' && emailValue !== 'undefined') {
                        doc.text(`Email: ${emailValue}`, 310, brokerYPos);
                        brokerYPos += 9;
                    }
                } catch (e) {
                    console.warn('BOL: Error displaying broker email:', e);
                }
            }

            // Port: [value]
            if (bolData.broker.port) {
                try {
                    const portValue = String(bolData.broker.port).trim();
                    if (portValue && portValue !== 'null' && portValue !== 'undefined') {
                        doc.text(`Port: ${portValue}`, 310, brokerYPos);
                        brokerYPos += 9;
                    }
                } catch (e) {
                    console.warn('BOL: Error displaying broker port:', e);
                }
            }
            
            // Reference: [value]
            if (bolData.broker.reference) {
                try {
                    const referenceValue = String(bolData.broker.reference).trim();
                    if (referenceValue && referenceValue !== 'null' && referenceValue !== 'undefined') {
                        doc.text(`Reference: ${referenceValue}`, 310, brokerYPos);
                        brokerYPos += 9;
                    }
                } catch (e) {
                    console.warn('BOL: Error displaying broker reference:', e);
                }
            }
        }
    } catch (e) {
        // Ultimate fallback - display minimal safe content
        console.warn('BOL: Error in broker section display, using fallback:', e);
        try {
            doc.fillColor('#000000')
               .font('Helvetica-Bold')
               .fontSize(8)
               .text('No broker assigned', 310, 293);
        } catch (fallbackError) {
            console.error('BOL: Critical error in broker section fallback:', fallbackError);
        }
    }
    
    // ENHANCED billing address extraction - use dynamic billing data when available
    let billingAddress = getBillingAddress(bolData);
    
        // Third party content with better spacing
    doc.fillColor('#000000')
       .font('Helvetica-Bold')
       .fontSize(8) // Increased font size for company name
       .text(billingAddress.company, 30, 293);

    // Address lines with improved spacing
    doc.font('Helvetica')
       .fontSize(7);

    let yPos = 303;
    if (billingAddress.address1 && billingAddress.address1.trim()) {
        doc.text(billingAddress.address1, 30, yPos);
        yPos += 9;
    }
    
    if (billingAddress.address2 && billingAddress.address2.trim()) {
        doc.text(billingAddress.address2, 30, yPos);
        yPos += 9;
    }
    
    // City, State, Zip with better formatting
    const cityStateZip = `${billingAddress.city}, ${billingAddress.state} ${billingAddress.zip}`;
    doc.text(cityStateZip, 30, yPos);
    
    // Account number (right side) - ENHANCED with better positioning
    if (billingAddress.accountNumber && billingAddress.accountNumber.trim() !== '') {
        doc.font('Helvetica-Bold')
           .fontSize(8) // Increased font size
           .text('Account Number:', 400, 293)
           .font('Helvetica')
           .fontSize(8)
           .text(billingAddress.accountNumber, 495, 293);
    }
    
    // ENHANCED freight terms checkboxes - positioned below address, left-aligned
    const checkBoxY = yPos + 15; // Position below the address with some spacing
    
    // STATIC SELECTION: Always select Third Party checkbox as per business requirement
    console.log('BOL Generation: Static Third Party billing selection applied');
    
    // Prepaid checkbox (always unchecked) - left aligned
    doc.rect(30, checkBoxY, 8, 8).stroke();
    doc.font('Helvetica')
       .fontSize(7)
       .text('Prepaid', 42, checkBoxY + 2);
    
    // Collect checkbox (always unchecked) - next to Prepaid
    doc.rect(100, checkBoxY, 8, 8).stroke();
    doc.font('Helvetica')
       .fontSize(7)
       .text('Collect', 112, checkBoxY + 2);
    
    // 3rd Party checkbox (ALWAYS CHECKED) - next to Collect
    doc.rect(170, checkBoxY, 8, 8).stroke();
    // Always add X mark for 3rd party
    doc.lineWidth(1.5)
       .moveTo(171, checkBoxY + 1)
       .lineTo(177, checkBoxY + 7)
       .stroke()
       .moveTo(177, checkBoxY + 1)
       .lineTo(171, checkBoxY + 7)
       .stroke();
    doc.font('Helvetica')
       .fontSize(7)
       .text('3rd Party', 182, checkBoxY + 2);
    
    // Reset line width for other elements
    doc.lineWidth(1);
    
    // Add billing contact information if available
    if (billingAddress.phone && billingAddress.phone.trim()) {
        const formattedPhone = formatPhoneNumber(billingAddress.phone);
        doc.font('Helvetica')
           .fontSize(6)
           .text(`Phone: ${formattedPhone}`, 30, checkBoxY + 20);
    }
}

/**
 * Extracts billing address information from shipment data
 * ALWAYS returns INTEGRATED CARRIERS address regardless of billing status
 * @param {Object} bolData - BOL data object
 * @returns {Object} - Billing address object
 */
function getBillingAddress(bolData) {
    // ALWAYS use INTEGRATED CARRIERS address for Third Party Billing Charges section
    // This is a business requirement regardless of actual billing status
    return {
        company: 'INTEGRATED CARRIERS',
        address1: '9 - 75 FIRST STREET, SUITE 209',
        address2: '', // Address line 2 is empty since suite is included in address1
        city: 'ORANGEVILLE',
        state: 'ON',
        zip: 'L9W 5B6',
        phone: '', // No phone number specified
        accountNumber: '' // No account number specified
    };
}

/**
 * Draws the exact special instructions section
 * IMPROVED VERSION with better handling of empty instructions and layout
 */
function drawExactSpecialInstructions(doc, bolData) {
        // Special instructions section - IMPROVED height for better content fit
    doc.lineWidth(1)
       .rect(25, 355, 562, 45) // Properly positioned after THIRD PARTY section
       .stroke();

    // Special instructions header
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .fillColor('#FFFFFF')
       .rect(25, 355, 562, 15)
       .fill('#000000')
       .fillColor('#FFFFFF')
       .text('SPECIAL INSTRUCTIONS', 30, 360);
    
    // Special instructions content - ENHANCED with better handling
    doc.fillColor('#000000')
       .font('Helvetica')
       .fontSize(7); // Increased font size for better readability
    
    let textY = 375;
    const maxY = 395; // Adjusted for THIRD PARTY repositioning
    
    // Check if there are any special instructions
    if (bolData.specialInstructions && bolData.specialInstructions.length > 0) {
        // Filter out empty instructions
        const validInstructions = bolData.specialInstructions.filter(instruction => 
            instruction && instruction.trim() !== ''
        );
        
        if (validInstructions.length > 0) {
            validInstructions.forEach((instruction, index) => {
                if (textY < maxY) { // Limit to available space
                    // Wrap long instructions to fit within the section
                    const wrappedText = doc.widthOfString(instruction) > 520 ? 
                        instruction.substring(0, 80) + '...' : instruction;
                    
                    doc.text(wrappedText, 30, textY, {
                        width: 520, // Set width for text wrapping
                        height: 10
                    });
                    textY += 10; // Better line spacing
                }
            });
        } else {
            // Show placeholder when no valid instructions
            doc.font('Helvetica')
               .fontSize(6)
               .fillColor('#888888')
               .text('No special instructions provided', 30, textY);
        }
    } else {
        // Show placeholder when instructions array is empty or undefined
        doc.font('Helvetica')
           .fontSize(6)
           .fillColor('#888888')
           .text('No special instructions provided', 30, textY);
    }
}

/**
 * Draws the exact freight table section - FIXED to use actual package data
 */
function drawExactFreightTable(doc, bolData) {
    const tableStartY = 405; // Moved down to start right below Special Instructions
    const tableWidth = 562;
    const rowHeight = 16; // Slightly reduced row height
    const tableHeight = 120; // Reduced by another 10px (from 130 to 120)
    
    // Column definitions with exact widths - Added declared value column
    const columns = [
        { header: 'PACKAGE\nQUANTITY', width: 50, align: 'center' },
        { header: 'PACKAGE\nTYPE', width: 50, align: 'center' },
        { header: 'WEIGHT\n(LBS)', width: 50, align: 'center' },
        { header: 'H/M', width: 30, align: 'center' },
        { header: 'COMMODITY DESCRIPTION', width: 170, align: 'left' }, // Reduced width for declared value
        { header: 'DIMENSIONS\nL x W x H', width: 70, align: 'center' },
        { header: 'DECLARED\nVALUE', width: 70, align: 'right' }, // New declared value column
        { header: 'CLASS', width: 72, align: 'center' } // Adjusted width
    ];
    
    // Draw table border
    doc.lineWidth(1)
       .rect(25, tableStartY, tableWidth, tableHeight)
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
               .lineTo(xPos, tableStartY + tableHeight)
               .stroke();
        }
        xPos += col.width;
    });
    
    // Draw data rows - FIXED to use actual package data
    doc.fillColor('#000000')
       .font('Helvetica')
       .fontSize(6);
    
    let dataY = tableStartY + 25;
    const maxRows = 6; // INCREASED from 4 to 6
    
    // ENHANCED package data extraction with proper quantity and weight handling
    bolData.packages.slice(0, maxRows).forEach((pkg, index) => {
        if (index > 0) {
            // Draw row separator
            doc.strokeColor('#CCCCCC')
               .lineWidth(0.25)
               .moveTo(25, dataY - 2)
               .lineTo(587, dataY - 2)
               .stroke();
        }
        
        xPos = 25;
        
        // FIXED: Extract actual package quantity from shipment data
        const packageQuantity = bolData.shipmentData?.packages?.[index]?.quantity || 
                               bolData.shipmentData?.packages?.[index]?.packagingQuantity || 
                               bolData.shipmentData?.packages?.[index]?.qty || 
                               1; // Default to 1 if not found
        
        // FIXED: Extract actual weight with proper unit handling
        const packageWeight = parseFloat(String(pkg.weight || 0).replace(/[^\d.-]/g, '')) || 0;
        
        // ENHANCED: Check for weight units and convert if needed
        const weightUnit = bolData.shipmentData?.packages?.[index]?.weightUnit || 
                          bolData.shipmentData?.unitSystem || 
                          'lbs';
        
        // Convert kg to lbs if needed
        let displayWeight = packageWeight;
        if (weightUnit.toLowerCase().includes('kg') || weightUnit.toLowerCase().includes('kilo')) {
            displayWeight = packageWeight * 2.20462; // Convert kg to lbs
        }
        
        // Format declared value with currency
        const formatDeclaredValue = (value, currency) => {
            if (!value || value <= 0) return '';
            const currencySymbol = currency === 'USD' ? 'USD$' : 'CAD$';
            return `${currencySymbol}${value.toFixed(2)}`;
        };
        
        // ENHANCED: Extract H/M (Hazmat) indicator
        const hazmatIndicator = bolData.shipmentData?.packages?.[index]?.hazmat || 
                               bolData.shipmentData?.packages?.[index]?.isDangerous || 
                               bolData.shipmentData?.hazmatDeclaration ? 'H' : '';
        
        // ENHANCED: Build row data with actual extracted values
        const rowData = [
            packageQuantity.toString(), // FIXED: Use actual package quantity
            pkg.type || 'PALLET',
            displayWeight.toFixed(0), // FIXED: Use actual calculated weight
            hazmatIndicator, // ENHANCED: Show H for hazmat, M for other markings
            pkg.description,
            pkg.dimensions,
            formatDeclaredValue(pkg.declaredValue, pkg.declaredValueCurrency), // Declared value with currency
            pkg.freightClass || '' // Freight class
        ];
        
        rowData.forEach((data, colIndex) => {
            doc.fillColor('#000000')
               .text(data, xPos + 2, dataY, {
                   width: columns[colIndex].width - 4,
                   align: columns[colIndex].align,
                   height: rowHeight - 2
               });
            xPos += columns[colIndex].width;
        });
        
        dataY += rowHeight;
    });
    
    // ENHANCED: Calculate totals from actual package data
    let calculatedTotalPieces = 0;
    let calculatedTotalWeight = 0;
    
    bolData.packages.forEach((pkg, index) => {
        const packageQuantity = bolData.shipmentData?.packages?.[index]?.quantity || 
                               bolData.shipmentData?.packages?.[index]?.packagingQuantity || 
                               bolData.shipmentData?.packages?.[index]?.qty || 
                               1;
        
        const packageWeight = parseFloat(String(pkg.weight || 0).replace(/[^\d.-]/g, '')) || 0;
        const weightUnit = bolData.shipmentData?.packages?.[index]?.weightUnit || 
                          bolData.shipmentData?.unitSystem || 
                          'lbs';
        
        // Convert weight if needed
        let displayWeight = packageWeight;
        if (weightUnit.toLowerCase().includes('kg') || weightUnit.toLowerCase().includes('kilo')) {
            displayWeight = packageWeight * 2.20462;
        }
        
        calculatedTotalPieces += parseInt(packageQuantity) || 1;
        calculatedTotalWeight += (displayWeight * (parseInt(packageQuantity) || 1)); // FIXED: Weight × Quantity
    });
    
    // FIXED: Position totals OUTSIDE the table structure for better layout
    const totalsY = tableStartY + tableHeight + 5; // Position below the table
    
    // Create a dedicated totals section with proper spacing
    doc.font('Helvetica-Bold')
       .fontSize(8)
       .fillColor('#000000');
    
    // FIXED: Draw totals separately with much closer spacing to prevent cutoff
    const totalsStartX = 30; // Start from left edge
    
    // Draw TOTAL PIECES first
    doc.text(`TOTAL PIECES: ${calculatedTotalPieces}`, totalsStartX, totalsY, {
           align: 'left'
       });
    
    // Draw TOTAL WEIGHT right after pieces with minimal spacing
    const piecesTextWidth = doc.widthOfString(`TOTAL PIECES: ${calculatedTotalPieces}`);
    const weightStartX = totalsStartX + piecesTextWidth + 40; // Only 40px spacing between them
    
    doc.text(`TOTAL WEIGHT: ${calculatedTotalWeight.toFixed(0)} LBS`, weightStartX, totalsY, {
           align: 'left'
       });
}

/**
 * Draws the exact value declaration section
 */
function drawExactValueDeclaration(doc, bolData) {
    // Value declaration section - ADJUSTED Y position for totals section
    doc.lineWidth(1)
       .rect(25, 540, 562, 40)
       .stroke();
    
    doc.font('Helvetica')
       .fontSize(5)
       .text('Where the rate is dependent on value, shippers are required to state specifically in writing the agreed or declared value of the property as follows:', 30, 545)
       .text('The agreed or declared value of the property is specifically stated by the shipper to be not exceeding _____________ per _______________', 30, 553);
    
    doc.font('Helvetica-Bold')
       .fontSize(5)
       .text('NOTE: Liability limitation for loss or damage in this shipment may be applicable. See 49 CFR 370.', 30, 563);
    
    // COD section (right side)
    doc.lineWidth(0.5)
       .rect(400, 540, 187, 40)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(6)
       .text('COD', 405, 545);
    
    doc.font('Helvetica')
       .fontSize(5)
       .text('Amount: $ _______________', 405, 555)
       .text('Fee Terms: ☐ Collect ☐ Prepaid', 405, 563)
       .text('Customer check acceptable: ☐', 405, 571);
}

/**
 * Draws the exact trailer loading section
 */
function drawExactTrailerSection(doc, bolData) {
    const sectionY = 585; // ADJUSTED Y position for totals section
    
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
    const sigY = 640; // ADJUSTED Y position for totals section
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
    // Position legal disclaimer to fit on page with new layout - ADJUSTED for totals section
    const disclaimerY = 750;
    
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