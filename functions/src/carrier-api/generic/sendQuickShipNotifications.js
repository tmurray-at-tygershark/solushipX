const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const { sendEmail } = require('../../email/sendgridService');

const db = admin.firestore();

/**
 * Sends all QuickShip notifications including customer confirmations and carrier notifications
 * @param {Object} params - Notification parameters
 * @param {Object} params.shipmentData - Complete shipment data
 * @param {Object} params.carrierDetails - Carrier contact information
 * @param {Array} params.documentResults - Generated document results
 */
async function sendQuickShipNotifications({ shipmentData, carrierDetails, documentResults }) {
    try {
        logger.info('Sending QuickShip notifications for shipment:', shipmentData.shipmentID);
        
        const notifications = [];
        
        // 1. Send customer/shipper notification
        notifications.push(sendCustomerNotification(shipmentData, documentResults));
        
        // 2. Send carrier notification (if carrier has email)
        if (carrierDetails?.contactEmail) {
            notifications.push(sendCarrierNotification(shipmentData, carrierDetails, documentResults));
        }
        
        // 3. Send internal company notifications
        notifications.push(sendInternalNotification(shipmentData, documentResults));
        
        // Wait for all notifications to complete
        const results = await Promise.allSettled(notifications);
        
        // Log results
        results.forEach((result, index) => {
            const notificationType = ['customer', 'carrier', 'internal'][index];
            if (result.status === 'fulfilled') {
                logger.info(`${notificationType} notification sent successfully`);
            } else {
                logger.error(`${notificationType} notification failed:`, result.reason);
            }
        });
        
        logger.info('QuickShip notifications processing completed');
        
    } catch (error) {
        logger.error('Error in sendQuickShipNotifications:', error);
        throw error;
    }
}

/**
 * Sends notification to the customer/shipper
 */
async function sendCustomerNotification(shipmentData, documentResults) {
    try {
        // Get customer email from shipTo or shipFrom
        const customerEmail = shipmentData.shipTo?.email || 
                             shipmentData.shipFrom?.email;
        
        if (!customerEmail) {
            logger.warn('No customer email found, skipping customer notification');
            return;
        }
        
        // Prepare attachments (BOL and Carrier Confirmation documents)
        const attachments = [];
        
        // Add BOL document
        const bolDocument = documentResults.find(doc => 
            doc.success && doc.data?.fileName?.includes('BOL')
        );
        
        if (bolDocument?.data?.downloadUrl) {
            attachments.push({
                filename: bolDocument.data.fileName,
                type: 'application/pdf',
                content_id: 'bol_document',
                disposition: 'attachment',
                url: bolDocument.data.downloadUrl
            });
            logger.info('Added BOL document to customer email attachments');
        }
        
        // Add Carrier Confirmation document (customers may want this for their records)
        const confirmationDocument = documentResults.find(doc => 
            doc.success && doc.data?.fileName?.includes('CARRIER-CONFIRMATION')
        );
        
        if (confirmationDocument?.data?.downloadUrl) {
            attachments.push({
                filename: confirmationDocument.data.fileName,
                type: 'application/pdf',
                content_id: 'carrier_confirmation',
                disposition: 'attachment',
                url: confirmationDocument.data.downloadUrl
            });
            logger.info('Added Carrier Confirmation document to customer email attachments');
        }
        
        // Calculate package totals with proper handling
        const totalPieces = shipmentData.packages?.reduce((total, pkg) => {
            const quantity = parseInt(pkg.quantity || pkg.packagingQuantity || 1);
            return total + quantity;
        }, 0) || 0;
        
        const totalWeight = shipmentData.packages?.reduce((total, pkg) => {
            const weight = parseFloat(pkg.weight || 0);
            return total + weight;
        }, 0) || 0;
        
        // Prepare email data with enhanced QuickShip-specific mapping
        const emailData = {
            to: customerEmail,
            subject: `QuickShip Confirmation - ${shipmentData.shipmentID}`,
            templateId: 'quickship_customer_confirmation',
            dynamicTemplateData: {
                shipmentId: shipmentData.shipmentID,
                carrier: shipmentData.carrier,
                trackingNumber: shipmentData.trackingNumber || shipmentData.shipmentID,
                totalCharges: shipmentData.totalCharges?.toFixed(2) || '0.00',
                currency: shipmentData.currency || 'CAD',
                
                // Shipper information - Enhanced mapping for QuickShip
                shipFromCompany: shipmentData.shipFrom?.companyName || 
                                shipmentData.shipFrom?.company || 
                                shipmentData.shipFrom?.addressNickname || 
                                'Unknown Company',
                shipFromAddress: formatAddress(shipmentData.shipFrom),
                
                // Consignee information - Enhanced mapping for QuickShip
                shipToCompany: shipmentData.shipTo?.companyName || 
                              shipmentData.shipTo?.company || 
                              shipmentData.shipTo?.customerName ||
                              'Unknown Company',
                shipToAddress: formatAddress(shipmentData.shipTo),
                
                // Package information with proper totals
                totalPieces: totalPieces,
                totalWeight: totalWeight.toFixed(1),
                
                // Service details - QuickShip specific
                serviceType: 'QuickShip Manual Entry',
                shipDate: formatDate(shipmentData.shipmentInfo?.shipmentDate),
                referenceNumber: shipmentData.shipmentInfo?.shipperReferenceNumber || '',
                
                // Manual rates breakdown - Enhanced for QuickShip
                rateBreakdown: shipmentData.manualRates?.map(rate => ({
                    description: rate.chargeName || rate.code || 'Freight Charge',
                    amount: parseFloat(rate.charge || 0).toFixed(2),
                    currency: rate.chargeCurrency || 'CAD'
                })) || []
            },
            attachments: attachments
        };
        
        await sendEmail(emailData);
        logger.info('Customer notification sent successfully to:', customerEmail, {
            attachmentCount: attachments.length,
            shipmentId: shipmentData.shipmentID
        });
        
    } catch (error) {
        logger.error('Error sending customer notification:', error);
        throw error;
    }
}

/**
 * Sends notification to the carrier
 */
async function sendCarrierNotification(shipmentData, carrierDetails, documentResults) {
    try {
        if (!carrierDetails.contactEmail) {
            logger.warn('No carrier email found, skipping carrier notification');
            return;
        }
        
        // Prepare attachments (Carrier Confirmation document)
        const attachments = [];
        const confirmationDocument = documentResults.find(doc => 
            doc.success && doc.data?.fileName?.includes('CARRIER-CONFIRMATION')
        );
        
        if (confirmationDocument?.data?.downloadUrl) {
            attachments.push({
                filename: confirmationDocument.data.fileName,
                type: 'application/pdf',
                content_id: 'carrier_confirmation',
                disposition: 'attachment',
                url: confirmationDocument.data.downloadUrl
            });
            logger.info('Added Carrier Confirmation document to carrier email attachments');
        } else {
            logger.warn('No carrier confirmation document found for attachment');
        }
        
        // Calculate package totals with proper handling
        const totalPieces = shipmentData.packages?.reduce((total, pkg) => {
            const quantity = parseInt(pkg.quantity || pkg.packagingQuantity || 1);
            return total + quantity;
        }, 0) || 0;
        
        const totalWeight = shipmentData.packages?.reduce((total, pkg) => {
            const weight = parseFloat(pkg.weight || 0);
            return total + weight;
        }, 0) || 0;
        
        // Prepare email data with enhanced QuickShip-specific mapping
        const emailData = {
            to: carrierDetails.contactEmail,
            subject: `QuickShip Pickup Assignment - Order ${shipmentData.shipmentID}`,
            templateId: 'quickship_carrier_notification',
            dynamicTemplateData: {
                carrierName: carrierDetails.name,
                contactName: carrierDetails.contactName || 'Carrier Representative',
                
                // Order information
                orderNumber: shipmentData.shipmentID,
                confirmationNumber: `CONF-${shipmentData.shipmentID}`,
                
                // Pickup information - Enhanced mapping for QuickShip
                pickupCompany: shipmentData.shipFrom?.companyName || 
                              shipmentData.shipFrom?.company || 
                              shipmentData.shipFrom?.addressNickname || 
                              'Unknown Company',
                pickupContact: shipmentData.shipFrom?.contact || 
                              shipmentData.shipFrom?.contactName || 
                              shipmentData.shipFrom?.firstName + ' ' + shipmentData.shipFrom?.lastName || '',
                pickupAddress: formatAddress(shipmentData.shipFrom),
                pickupPhone: shipmentData.shipFrom?.phone || '',
                pickupDate: formatDate(shipmentData.shipmentInfo?.shipmentDate),
                
                // Delivery information - Enhanced mapping for QuickShip
                deliveryCompany: shipmentData.shipTo?.companyName || 
                               shipmentData.shipTo?.company || 
                               shipmentData.shipTo?.customerName ||
                               'Unknown Company',
                deliveryContact: shipmentData.shipTo?.contact || 
                               shipmentData.shipTo?.contactName || 
                               shipmentData.shipTo?.firstName + ' ' + shipmentData.shipTo?.lastName || '',
                deliveryAddress: formatAddress(shipmentData.shipTo),
                deliveryPhone: shipmentData.shipTo?.phone || '',
                
                // Shipment details with proper totals
                totalPieces: totalPieces,
                totalWeight: totalWeight.toFixed(1),
                referenceNumber: shipmentData.shipmentInfo?.shipperReferenceNumber || '',
                
                // Package details - Enhanced for QuickShip
                packages: shipmentData.packages?.map((pkg, index) => ({
                    pieces: parseInt(pkg.quantity || pkg.packagingQuantity || 1),
                    weight: parseFloat(pkg.weight || 0).toFixed(1),
                    description: pkg.description || pkg.itemDescription || 'General Freight',
                    dimensions: pkg.length && pkg.width && pkg.height ? 
                               `${pkg.length}" × ${pkg.width}" × ${pkg.height}"` : 'N/A',
                    packagingType: getPackagingTypeName(pkg.packagingType) || 'Package'
                })) || [],
                
                // Special instructions and notes
                specialInstructions: shipmentData.shipmentInfo?.notes || 
                                   'QuickShip manual entry - Standard freight service. Please coordinate pickup time with shipper.',
                
                // QuickShip specific information
                serviceType: 'QuickShip Manual Entry',
                bookingMethod: 'Manual QuickShip Booking',
                
                // Rate information for carrier reference
                totalCharges: shipmentData.totalCharges?.toFixed(2) || '0.00',
                currency: shipmentData.currency || 'CAD'
            },
            attachments: attachments
        };
        
        await sendEmail(emailData);
        logger.info('Carrier notification sent successfully to:', carrierDetails.contactEmail, {
            attachmentCount: attachments.length,
            shipmentId: shipmentData.shipmentID,
            carrierName: carrierDetails.name
        });
        
    } catch (error) {
        logger.error('Error sending carrier notification:', error);
        throw error;
    }
}

/**
 * Sends internal company notifications
 */
async function sendInternalNotification(shipmentData, documentResults) {
    try {
        // Get company notification preferences
        const companyDoc = await db.collection('companies').doc(shipmentData.companyID).get();
        if (!companyDoc.exists) {
            logger.warn('Company not found for internal notifications');
            return;
        }
        
        const companyData = companyDoc.data();
        const notificationEmails = companyData.notificationSubscriptions?.shipment_created || [];
        
        if (notificationEmails.length === 0) {
            logger.info('No internal notification subscribers found');
            return;
        }
        
        // Send to each subscriber
        const internalPromises = notificationEmails.map(async (email) => {
            const emailData = {
                to: email,
                subject: `QuickShip Booked - ${shipmentData.shipmentID}`,
                templateId: 'quickship_internal_notification',
                dynamicTemplateData: {
                    shipmentId: shipmentData.shipmentID,
                    carrier: shipmentData.carrier,
                    bookedBy: shipmentData.createdBy,
                    
                    // Shipper information
                    shipFromCompany: shipmentData.shipFrom?.companyName || shipmentData.shipFrom?.company || 'Unknown',
                    shipFromAddress: formatAddress(shipmentData.shipFrom),
                    
                    // Consignee information
                    shipToCompany: shipmentData.shipTo?.companyName || shipmentData.shipTo?.company || 'Unknown',
                    shipToAddress: formatAddress(shipmentData.shipTo),
                    
                    // Financial information
                    totalCharges: shipmentData.totalCharges?.toFixed(2) || '0.00',
                    currency: shipmentData.currency || 'CAD',
                    
                    // Package summary
                    totalPieces: shipmentData.packages?.reduce((total, pkg) => 
                        total + (parseInt(pkg.quantity || pkg.packagingQuantity || 1)), 0) || 0,
                    totalWeight: shipmentData.packages?.reduce((total, pkg) => 
                        total + (parseFloat(pkg.weight || 0)), 0).toFixed(1) || '0.0',
                    
                    // Rate breakdown for internal tracking
                    rateBreakdown: shipmentData.manualRates?.map(rate => ({
                        description: rate.chargeName || rate.code || 'Freight Charge',
                        cost: parseFloat(rate.cost || 0).toFixed(2),
                        charge: parseFloat(rate.charge || 0).toFixed(2),
                        currency: rate.chargeCurrency || 'CAD'
                    })) || []
                }
            };
            
            return sendEmail(emailData);
        });
        
        await Promise.all(internalPromises);
        logger.info(`Internal notifications sent to ${notificationEmails.length} recipients`);
        
    } catch (error) {
        logger.error('Error sending internal notifications:', error);
        throw error;
    }
}

/**
 * Helper function to format addresses
 */
function formatAddress(address) {
    if (!address) return 'N/A';
    
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.street2) parts.push(address.street2);
    if (address.city || address.state || address.postalCode) {
        const cityStateZip = [];
        if (address.city) cityStateZip.push(address.city);
        if (address.state) cityStateZip.push(address.state);
        if (address.postalCode) cityStateZip.push(address.postalCode);
        parts.push(cityStateZip.join(', '));
    }
    if (address.country && address.country !== 'CA' && address.country !== 'US') {
        parts.push(address.country);
    }
    
    return parts.join(', ') || 'N/A';
}

/**
 * Helper function to format dates
 */
function formatDate(dateString) {
    if (!dateString) return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

/**
 * Helper function to get packaging type name from code
 * Maps packaging type codes to human-readable names
 */
function getPackagingTypeName(packagingTypeCode) {
    const packagingTypes = {
        237: '10KG BOX',
        238: '25KG BOX', 
        239: 'ENVELOPE',
        240: 'TUBE',
        241: 'PAK',
        242: 'BAGS',
        243: 'BALE(S)',
        244: 'BOX(ES)',
        245: 'BUNCH(ES)',
        246: 'BUNDLE(S)',
        248: 'CARBOY(S)',
        249: 'CARPET(S)',
        250: 'CARTONS',
        251: 'CASE(S)',
        252: 'COIL(S)',
        253: 'CRATE(S)',
        254: 'CYLINDER(S)',
        255: 'DRUM(S)',
        256: 'LOOSE',
        257: 'PAIL(S)',
        258: 'PALLET(S)',
        260: 'REEL(S)',
        261: 'ROLL(S)',
        262: 'SKID(S)',
        265: 'TOTE(S)',
        266: 'TUBES/PIPES',
        268: 'GALLONS',
        269: 'LIQUID BULK',
        270: 'CONTAINER',
        271: 'PIECES',
        272: 'LOAD',
        273: 'BLADE(S)',
        274: 'RACKS',
        275: 'GAYLORDS'
    };
    
    return packagingTypes[packagingTypeCode] || 'PACKAGE';
}

module.exports = {
    sendQuickShipNotifications
}; 