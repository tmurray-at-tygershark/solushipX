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
        
        totalWeight += (weight * quantity); // FIXED: Weight × Quantity like BOL
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
    
    // DEBUG: Log account resolution for debugging the TS issue
    const accountResolution = {
        carrierDetailsAccountNumber: carrierDetails.accountNumber,
        carrierDetailsApiAccountNumber: carrierDetails.apiCredentials?.accountNumber,
        companyIDFallback: shipmentData.companyID,
        finalAccountValue: carrierDetails.accountNumber || carrierDetails.apiCredentials?.accountNumber || shipmentData.companyID || '-',
        carrierDetailsKeys: Object.keys(carrierDetails),
        carrierName: carrierDetails.name
    };
    
    console.log('🔍 CARRIER CONFIRMATION ACCOUNT DEBUG:', accountResolution);
    
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
    
    // Carrier information with enhanced details and new email structure support
    let carrierPhone = '';
    let carrierEmail = '';
    let carrierAttention = '';
    
    console.log('🚛 CARRIER CONFIRMATION DEBUG: Extracting carrier contact information:', {
        carrierName: carrierDetails.name,
        hasEmailContacts: !!carrierDetails.emailContacts,
        creationMethod: shipmentData.creationMethod,
        selectedCarrierContactId: shipmentData.selectedCarrierContactId,
        carrierDetailsKeys: Object.keys(carrierDetails),
        emailContactsLength: carrierDetails.emailContacts?.length || 0
    });
    
    // Handle both old and new carrier data structures
    if (carrierDetails.emailContacts && shipmentData.creationMethod === 'quickship') {
        // NEW STRUCTURE: Terminal-based email management (QuickShip carriers only)
        console.log('Using new terminal-based carrier structure for QuickShip carrier');
        
        // If selectedCarrierContactId is provided, use the specific terminal
        let selectedTerminalId = shipmentData.selectedCarrierContactId || 'default';
        
        // Extract terminal from selectedCarrierContactId (format: terminalId_contactType_index)
        if (selectedTerminalId.includes('_')) {
            selectedTerminalId = selectedTerminalId.split('_')[0];
        }
        
        // Find the selected terminal or use default
        const terminals = carrierDetails.emailContacts || [];
        let selectedTerminal = terminals.find(terminal => terminal.id === selectedTerminalId);
        
        // If no specific terminal found, use the first one or default
        if (!selectedTerminal && terminals.length > 0) {
            selectedTerminal = terminals.find(terminal => terminal.isDefault) || terminals[0];
        }
        
        if (selectedTerminal) {
            console.log('Using terminal for carrier confirmation:', selectedTerminal.name);
            
            // Extract phone number from terminal (use phone field if available)
            carrierPhone = selectedTerminal.phone || '';
            
            // Get emails for carrier confirmation - prioritize dispatch emails
            const contactTypes = selectedTerminal.contactTypes || {};
            const dispatchEmails = contactTypes.dispatch || [];
            const customerServiceEmails = contactTypes.customer_service || [];
            const allEmails = [
                ...dispatchEmails,
                ...customerServiceEmails,
                ...(contactTypes.quotes || []),
                ...(contactTypes.billing_adjustments || []),
                ...(contactTypes.claims || []),
                ...(contactTypes.sales_reps || []),
                ...(contactTypes.customs || []),
                ...(contactTypes.other || [])
            ].filter(email => email && email.trim());
            
            // Use the first available email (usually dispatch)
            carrierEmail = allEmails[0] || '';
            
            // Set attention to terminal contact name or terminal name
            carrierAttention = selectedTerminal.contactName || selectedTerminal.name || '';
            
            console.log('Extracted QuickShip carrier contact info:', {
                terminal: selectedTerminal.name,
                phone: carrierPhone,
                email: carrierEmail,
                attention: carrierAttention,
                totalEmails: allEmails.length,
                dispatchEmailsCount: dispatchEmails.length,
                customerServiceEmailsCount: customerServiceEmails.length
            });
        } else {
            console.log('⚠️ No terminal found for QuickShip carrier:', {
                selectedTerminalId,
                availableTerminals: terminals.map(t => ({ id: t.id, name: t.name, isDefault: t.isDefault }))
            });
        }
    } else {
        // OLD STRUCTURE: Legacy contactEmail/contactPhone fields (API carriers and fallback)
        console.log('Using legacy carrier structure for API carrier or fallback');
        carrierPhone = carrierDetails.contactPhone || carrierDetails.phone || '';
        carrierEmail = carrierDetails.contactEmail || carrierDetails.email || '';
        carrierAttention = carrierDetails.contactName || carrierDetails.attention || '';
        
        console.log('Legacy carrier fields extracted:', {
            contactPhone: carrierDetails.contactPhone,
            phone: carrierDetails.phone,
            contactEmail: carrierDetails.contactEmail,
            email: carrierDetails.email,
            contactName: carrierDetails.contactName,
            attention: carrierDetails.attention
        });
    }
    
    // If still no email found, use legacy fallback
    if (!carrierEmail) {
        const fallbackEmail = carrierDetails.contactEmail || carrierDetails.email || carrierDetails.billingEmail || '';
        console.log('🔄 Using email fallback:', fallbackEmail);
        carrierEmail = fallbackEmail;
    }
    
    // If still no phone found, use legacy fallback  
    if (!carrierPhone) {
        const fallbackPhone = carrierDetails.contactPhone || carrierDetails.phone || '';
        console.log('🔄 Using phone fallback:', fallbackPhone);
        carrierPhone = fallbackPhone;
    }
    
    // If still no attention found, use legacy fallback
    if (!carrierAttention) {
        const fallbackAttention = carrierDetails.contactName || carrierDetails.attention || '';
        console.log('🔄 Using attention fallback:', fallbackAttention);
        carrierAttention = fallbackAttention;
    }
    
    console.log('🚛 FINAL CARRIER CONTACT INFO for confirmation:', {
        name: carrierDetails.name,
        phone: carrierPhone,
        email: carrierEmail,
        attention: carrierAttention,
        phoneLength: carrierPhone.length,
        emailLength: carrierEmail.length,
        attentionLength: carrierAttention.length
    });

    // FIXED: Extract business hours from address records like BOL does
    const shipperHours = {
        open: extractOpenTime(shipFrom),   // Use address-based extraction like BOL
        close: extractCloseTime(shipFrom), // Use address-based extraction like BOL
        closed: false
    };
    
    const consigneeHours = {
        open: extractOpenTime(shipTo),   // Use address-based extraction like BOL
        close: extractCloseTime(shipTo), // Use address-based extraction like BOL
        closed: false
    };
    
    // CRITICAL FIX: Ensure times are always available with comprehensive fallbacks
    const finalShipperOpen = shipperHours.open || shipFrom.openTime || shipFrom.readyTime || shipFrom.hours?.open || '';
    const finalShipperClose = shipperHours.close || shipFrom.closeTime || shipFrom.hours?.close || '';
    const finalConsigneeOpen = consigneeHours.open || shipTo.openTime || shipTo.deliverTime || shipTo.hours?.open || '';
    const finalConsigneeClose = consigneeHours.close || shipTo.closeTime || shipTo.hours?.close || '';
    
    console.log('🚛 CARRIER CONFIRMATION HOURS DEBUG:', {
        shipperOriginal: { open: shipperHours.open, close: shipperHours.close },
        shipperFinal: { open: finalShipperOpen, close: finalShipperClose },
        consigneeOriginal: { open: consigneeHours.open, close: consigneeHours.close },
        consigneeFinal: { open: finalConsigneeOpen, close: finalConsigneeClose },
        shipFromData: { openTime: shipFrom.openTime, closeTime: shipFrom.closeTime, readyTime: shipFrom.readyTime },
        shipToData: { openTime: shipTo.openTime, closeTime: shipTo.closeTime, deliverTime: shipTo.deliverTime }
    });
    
    return {
        // Header information
        date: formatDateLong(now),
        refNumber: confirmationNumber,
        orderNumber: shipmentId,
        account: carrierDetails.accountNumber || carrierDetails.apiCredentials?.accountNumber || shipmentData.companyID || '-',
        contact: 'Tim Smith', // As requested
        
        // Log the account resolution for debugging
        _debugAccountResolution: {
            carrierDetailsAccountNumber: carrierDetails.accountNumber,
            carrierDetailsApiAccountNumber: carrierDetails.apiCredentials?.accountNumber,
            companyIDFallback: shipmentData.companyID,
            finalAccountValue: carrierDetails.accountNumber || carrierDetails.apiCredentials?.accountNumber || shipmentData.companyID || '-',
            carrierDetailsKeys: Object.keys(carrierDetails),
            carrierDetailsFullObject: carrierDetails
        },
        
        // Carrier information with enhanced details
        carrier: carrierDetails.name || 'Integrated Carriers',
        carrierPhone: carrierPhone,
        carrierEmail: carrierEmail, // Changed from fax to email
        attention: carrierAttention,
        
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
        readyTime: finalShipperOpen,
        closeTime: finalShipperClose,
        deliverOpen: finalConsigneeOpen,
        deliverClose: finalConsigneeClose,
        
        // Enhanced load information with detailed package breakdown
        pieces: totalPieces,
        weight: totalWeight.toFixed(2) + ' LBS',
        skids: totalSkids,
        packages: packages.map((pkg, index) => {
            const weight = parseFloat(String(pkg.weight || 0).replace(/[^\d.-]/g, '')) || 0;
            const quantity = parseInt(String(pkg.quantity || pkg.packagingQuantity || 1).replace(/[^\d]/g, '')) || 1;
            
            return {
                pieces: quantity,
                weight: (weight * quantity).toFixed(2), // FIXED: Total weight per line (weight × quantity)
                individualWeight: weight.toFixed(2), // Keep individual weight for reference
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
 * Extracts open time from address record with proper fallback
 * @param {Object} address - Address object from shipment data
 * @returns {string} - Formatted open time or empty string
 */
function extractOpenTime(address) {
    console.log(`🕐 CARRIER CONFIRMATION DEBUG: Extracting open time from address:`, {
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
                console.log(`🕐 CARRIER CONFIRMATION DEBUG: Using Monday custom hours open: ${openTime}`);
                return openTime;
            }
        } else if (address.businessHours.defaultHours?.open) {
            const openTime = formatTime(address.businessHours.defaultHours.open);
            console.log(`🕐 CARRIER CONFIRMATION DEBUG: Using default hours open: ${openTime}`);
            return openTime;
        }
    }
    
    // Check legacy format
    if (address.openHours || address.openTime) {
        const openTime = formatTime(address.openHours || address.openTime);
        console.log(`🕐 CARRIER CONFIRMATION DEBUG: Using legacy open hours: ${openTime}`);
        return openTime;
    }
    
    console.log(`🕐 CARRIER CONFIRMATION DEBUG: No open time found, returning empty string`);
    // Return empty string if no time found
    return '';
}

/**
 * Extracts close time from address record with proper fallback
 * @param {Object} address - Address object from shipment data
 * @returns {string} - Formatted close time or empty string
 */
function extractCloseTime(address) {
    console.log(`🕕 CARRIER CONFIRMATION DEBUG: Extracting close time from address:`, {
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
                console.log(`🕕 CARRIER CONFIRMATION DEBUG: Using Monday custom hours close: ${closeTime}`);
                return closeTime;
            }
        } else if (address.businessHours.defaultHours?.close) {
            const closeTime = formatTime(address.businessHours.defaultHours.close);
            console.log(`🕕 CARRIER CONFIRMATION DEBUG: Using default hours close: ${closeTime}`);
            return closeTime;
        }
    }
    
    // Check legacy format
    if (address.closeHours || address.closeTime) {
        const closeTime = formatTime(address.closeHours || address.closeTime);
        console.log(`🕕 CARRIER CONFIRMATION DEBUG: Using legacy close hours: ${closeTime}`);
        return closeTime;
    }
    
    console.log(`🕕 CARRIER CONFIRMATION DEBUG: No close time found, returning empty string`);
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
    console.log('🚛 CARRIER CONFIRMATION DEBUG: Drawing shipper section with FIXED spacing');
    console.log('🚛 FIXED VALUES: valueX=105 (was 145), rightValueX=395 (was 420)');
    
    const sectionY = 195;
    const labelX = 35;
    const valueX = 105; // FIXED: Reduced from 145 to 105 (40px closer)
    const rightLabelX = 340;
    const rightValueX = 395; // FIXED: Reduced from 420 to 395 (25px closer)
    
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
    
    // Address - FIXED: Combine address1 and address2 on same line
    doc.font('Helvetica')
       .fontSize(8)
       .fillColor('#000000');
    
    let fullAddress = data.shipper.address1;
    if (data.shipper.address2 && data.shipper.address2.trim()) {
        fullAddress += `, ${data.shipper.address2}`;
    }
    doc.text(fullAddress, valueX, yPos);
    
    // City
    yPos += 9;
    doc.text(data.shipper.city, valueX, yPos);
    
    // State/Prov, Postal Code and Country on same line
    yPos += 9;
    doc.text(`${data.shipper.state}     ${data.shipper.postalCode}     ${data.shipper.country}`, valueX, yPos);
    
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
    
    // Instructions - FIXED: Better positioning to prevent overlap
    if (data.shipper.specialInstructions) {
        rightYPos += 14;
        doc.font('Helvetica-Bold')
           .fillColor('#333333')
           .text('Instructions:', rightLabelX, rightYPos);
        
        doc.font('Helvetica')
           .fontSize(8)
           .fillColor('#000000')
           .text(data.shipper.specialInstructions, rightValueX, rightYPos, { width: 140 }); // FIXED: Use rightValueX, not rightLabelX
    }
    
    // FIXED: Changed "Date Ready" to "Shipment Date" and improved spacing
    yPos += 40; // CHANGED: Increased from 20 to 40 for 20px additional space from original position
    console.log(`🚛 CARRIER CONFIRMATION DEBUG: Shipment Date moved down 20px within shipper section to Y=${yPos}`);
    
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#333333')
       .text('Shipment Date', labelX, yPos); // FIXED: Changed from "Date Ready" to "Shipment Date"
    
    doc.fillColor('#000000')
       .text(':', valueX - 5, yPos);  // FIXED: Reduced gap from -10 to -5
    
    doc.font('Helvetica')
       .text(data.dateReady, valueX, yPos);
    
    // Ready time - FIXED: Much closer spacing with guaranteed display
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Open', 180, yPos);  // FIXED: Moved left from 240 to 180
    
    doc.fillColor('#000000')
       .text(':', 205, yPos);     // FIXED: Moved left from 280 to 205
    
    doc.font('Helvetica')
       .text(data.readyTime, 210, yPos);
    
    // Close time - FIXED: Much closer spacing, moved further left to avoid overlap with guaranteed display
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Close', 260, yPos);  // FIXED: Moved even further left from 280 to 260
    
    doc.fillColor('#000000')
       .text(':', 285, yPos);      // FIXED: Moved left to 285
    
    doc.font('Helvetica')
       .text(data.closeTime, 290, yPos);
}

/**
 * Draws enhanced consignee section
 */
function drawEnhancedConsigneeSection(doc, data) {
    const sectionY = 315;
    const labelX = 35;
    const valueX = 105; // FIXED: Reduced from 145 to 105 (40px closer)
    const rightLabelX = 340;
    const rightValueX = 395; // FIXED: Reduced from 420 to 395 (25px closer)
    
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
    
    // Address - FIXED: Combine address1 and address2 on same line
    doc.font('Helvetica')
       .fontSize(8)
       .fillColor('#000000');
    
    let fullAddress = data.consignee.address1;
    if (data.consignee.address2 && data.consignee.address2.trim()) {
        fullAddress += `, ${data.consignee.address2}`;
    }
    doc.text(fullAddress, valueX, yPos);
    
    // City
    yPos += 9;
    doc.text(data.consignee.city, valueX, yPos);
    
    // State/Prov, Postal Code and Country on same line
    yPos += 9;
    doc.text(`${data.consignee.state}     ${data.consignee.postalCode}     ${data.consignee.country}`, valueX, yPos);
    
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
    
    // Instructions - FIXED: Proper positioning to prevent overlap
    if (data.consignee.specialInstructions) {
        rightYPos += 14;
        doc.font('Helvetica-Bold')
           .fillColor('#333333')
           .text('Instructions:', rightLabelX, rightYPos);
        
        doc.font('Helvetica')
           .fontSize(8)
           .fillColor('#000000')
           .text(data.consignee.specialInstructions, rightValueX, rightYPos, { width: 140 }); // FIXED: Use rightValueX, not rightLabelX
    }
    
    // ADDED BACK: Open and Close times (without Deliver On date)
    yPos += 20; // Add some space after address
    
    // Open time for consignee
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#333333')
       .text('Open', 180, yPos); // Position similar to shipper section
    
    doc.fillColor('#000000')
       .text(':', 205, yPos);
    
    doc.font('Helvetica')
       .text(data.deliverOpen, 210, yPos);
    
    // Close time
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Close', 260, yPos);
    
    doc.fillColor('#000000')
       .text(':', 285, yPos);
    
    doc.font('Helvetica')
       .text(data.deliverClose, 290, yPos);
}

/**
 * Draws enhanced special instructions
 */
function drawEnhancedSpecialInstructions(doc, data) {
    const sectionY = 405; // Reverted back to original position
    const labelX = 35;
    
    // Section background if there are instructions - INCREASED HEIGHT
    if (data.shipper.specialInstructions || data.consignee.specialInstructions) {
        doc.rect(25, sectionY - 5, 562, 45) // FIXED: Increased from 35 to 45
           .fill('#fff3cd');
    }
    
    // Special instructions label
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#333333')
       .text('Special Instructions:', labelX, sectionY); // Added colon to label
    
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
           .fillColor('#000000')
           .text(instructions.join(' | '), labelX, sectionY + 14, { // FIXED: Increased spacing from +12 to +14
               width: 520, // Increased width since we're not beside the label
               align: 'left'
           });
    }
}

/**
 * Draws enhanced broker section
 */
function drawEnhancedBrokerSection(doc, data) {
    const sectionY = 455; // MOVED DOWN: Add 10px padding from yellow banner above (was 445)
    const labelX = 35;
    const valueX = 105; // FIXED: Reduced from 145 to 105 (40px closer)
    const rightLabelX = 340;
    const rightValueX = 395; // FIXED: Reduced from 450 to 395 (55px closer)
    
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
       .text(':', valueX - 5, yPos);  // FIXED: Reduced gap from -10 to -5
    
    doc.font('Helvetica')
       .text(data.broker, valueX, yPos);
    
    // Phone
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Phone', rightLabelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', rightValueX - 5, yPos);  // FIXED: Reduced gap from -10 to -5
    
    doc.font('Helvetica')
       .text(data.brokerPhone, rightValueX, yPos);
    
    // Reference and Port
    yPos += 14;
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Reference', labelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', valueX - 5, yPos);  // FIXED: Reduced gap from -10 to -5
    
    doc.font('Helvetica')
       .text(data.brokerRef, valueX, yPos);
    
    // Port
    doc.font('Helvetica-Bold')
       .fillColor('#333333')
       .text('Port', rightLabelX, yPos);
    
    doc.fillColor('#000000')
       .text(':', rightValueX - 5, yPos);  // FIXED: Reduced gap from -10 to -5
    
    doc.font('Helvetica')
       .text(data.port, rightValueX, yPos);
}

/**
 * Draws enhanced load information section with detailed table
 */
function drawEnhancedLoadInfoSection(doc, data) {
    const tableY = 505; // MOVED DOWN: Adjusted for broker section move (was 495)
    
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
    
    // Table border - REDUCED HEIGHT: 80px for better balance
    doc.strokeColor('#cccccc')
       .lineWidth(1)
       .rect(25, tableY, 562, 80)
       .stroke();
    
    // Table data
    let dataY = tableY + 25;
    const maxPackages = 6; // REDUCED: Show 6 packages to fit in 80px table
    
    if (data.packages && data.packages.length > 0) {
        // Show up to 6 packages
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
               .text(pkg.dimensions, 290, dataY, { align: 'center', width: 80 })
               .text(pkg.class, 380, dataY, { align: 'center', width: 30 })
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
           .text('', 380, dataY, { align: 'center', width: 30 })
           .text(data.description, 420, dataY);
    }
    
    // Totals section - ADJUSTED: now at tableY + 85 for smaller table
    const totalsY = tableY + 85;
    
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
 * Draws enhanced terms and conditions section with full text
 */
function drawEnhancedTermsSection(doc, data) {
    const termsY = 635; // FINE-TUNED: moved back up 15px from 650 to 635 for perfect spacing
    
    // Terms header
    doc.rect(25, termsY, 562, 18)
       .fill('#dc3545');
    
    doc.font('Helvetica-Bold')
       .fontSize(9)
       .fillColor('#ffffff')
       .text('TERMS AND CONDITIONS', 35, termsY + 5);
    
    // Terms content background - AGGRESSIVELY REDUCED: 45px to fit everything
    doc.rect(25, termsY + 18, 562, 45)
       .fill('#f8f9fa');
    
    // Terms text - UPDATED: Full terms text as provided by user
    let textY = termsY + 22;
    
    // FULL TERMS: Updated with the complete terms text provided by user
    const fullTerms = 'Integrated Carriers is solely responsible for the payment of freight charges on this shipment. Rate is all inclusive including fuel surcharge. Integrated Carriers must be informed of any change to shipment and any accessorial charges before they occur. All charges must be confirmed by revised email. All drivers crossing the border MUST have valid passport. Non payment will occur if this order is co-brokered (or subcontracted) or if customer is back solicited. Should the Bill of Lading instructions differ from the above and/or any conditions cannot be met, Integrated Carriers must be notified immediately. Load confirmation must be signed and emailed back IMMEDIATELY to complete this transaction and for payment to be processed.';
    
    doc.font('Helvetica')
       .fontSize(6.5) // REDUCED font size to fit more text
       .fillColor('#000000')
       .text(fullTerms, 35, textY, { 
           width: 522, // Slightly reduced width for better margins
           lineGap: 1 // Minimal line gap
       });
}

/**
 * Draws enhanced signature section
 */
function drawEnhancedSignatureSection(doc, data) {
    const sigY = 705; // MOVED DOWN 20PX: from 685 to 705
    
    // Signature area background - MOVED DOWN ENTIRE SECTION
    doc.rect(25, sigY, 562, 35)
       .fill('#ffffff')
       .strokeColor('#000000')
       .lineWidth(1)
       .stroke();
    
    // X mark - MOVED DOWN WITH ENTIRE SECTION
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor('#dc3545')
       .text('X', 40, sigY + 8);
    
    // Signature line - MOVED DOWN WITH ENTIRE SECTION
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(60, sigY + 18)
       .lineTo(300, sigY + 18)
       .stroke();
    
    // Signature label - MOVED DOWN WITH ENTIRE SECTION
    doc.font('Helvetica')
       .fontSize(9)
       .fillColor('#666666')
       .text('Carrier Signature', 60, sigY + 22);
    
    // Date line - MOVED DOWN WITH ENTIRE SECTION
    doc.moveTo(350, sigY + 18)
       .lineTo(450, sigY + 18)
       .stroke();
    
    doc.text('Date', 350, sigY + 22);
    
    // Print name line - MOVED DOWN WITH ENTIRE SECTION
    doc.moveTo(480, sigY + 18)
       .lineTo(570, sigY + 18)
       .stroke();
    
    doc.text('Print Name', 480, sigY + 22);
    
    // MOVED DOWN 20PX: Integrated Carriers address - positioned right after signature
    const addressY = sigY + 40; // Now at 745 (705 + 40)
    
    // FIXED: Put entire address on one line for maximum compactness - ALL CAPITALS
    const fullAddress = 'INTEGRATED CARRIERS - 9 - 75 FIRST STREET, SUITE 209, ORANGEVILLE, ON L9W 5B6';
    
    // Center the address block - FIXED: Proper centering calculation
    const pageWidth = 612; // Standard letter size width
    const addressBlockWidth = 400; // Wider for single line
    const centerX = (pageWidth - addressBlockWidth) / 2; // True center calculation
    
    doc.font('Helvetica')
       .fontSize(8)
       .fillColor('#000000')
       .text(fullAddress, centerX, addressY, { align: 'center', width: addressBlockWidth });
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