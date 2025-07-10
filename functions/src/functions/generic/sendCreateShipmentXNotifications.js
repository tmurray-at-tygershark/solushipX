const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

const db = admin.firestore();

/**
 * Helper function to convert bill type codes to human readable labels
 */
function getBillTypeLabel(billType) {
    const billTypeLabels = {
        'prepaid': 'Prepaid',
        'collect': 'Collect',
        'third_party': 'Third Party',
        'freight_collect': 'Freight Collect',
        'fob_origin': 'FOB Origin',
        'fob_destination': 'FOB Destination'
    };
    return billTypeLabels[billType] || billType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Helper function to get proper service name from shipment data
 */
function getServiceName(data) {
    // Priority order for service name
    if (data.selectedRate?.service?.name) return data.selectedRate.service.name;
    if (data.selectedRate?.serviceName) return data.selectedRate.serviceName;
    if (data.shipmentInfo?.serviceType) return data.shipmentInfo.serviceType;
    if (data.serviceType) return data.serviceType;
    if (data.shipmentInfo?.shipmentType === 'ltl') return 'LTL';
    if (data.shipmentInfo?.shipmentType === 'ftl') return 'FTL';
    if (data.shipmentInfo?.shipmentType === 'courier') return 'Ground';
    return 'Standard Service';
}

// Initialize SendGrid with API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
} else {
    logger.error('SENDGRID_API_KEY environment variable is not set');
}

// Global email configuration - matching QuickShip exactly
const SEND_FROM_EMAIL = 'noreply@integratedcarriers.com';
const SEND_FROM_NAME = 'Integrated Carriers';

/**
 * Sends all CreateShipmentX notifications including customer confirmations and carrier notifications
 * Uses the exact same pattern as QuickShip notifications with proper document verification
 * @param {Object} request - Firebase function request
 */
const sendCreateShipmentXNotifications = onCall({
    minInstances: 1,
    memory: '512MiB',
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { shipmentData, documentResults } = request.data;
        
        if (!shipmentData || !documentResults) {
            throw new Error('Missing required data: shipmentData and documentResults are required');
        }
        
        logger.info('CreateShipmentX notifications starting:', {
            shipmentId: shipmentData.shipmentID || shipmentData.id,
            documentsReceived: documentResults.length
        });
        
        // Verify all documents are accessible before proceeding
        logger.info('Verifying all documents are accessible before sending emails...');
        await verifyDocumentsAccessible(documentResults);
        
        const results = [];
        
        // 1. Send customer notification
        try {
            await sendCustomerNotification(shipmentData, documentResults);
            results.push({ type: 'customer', success: true });
        } catch (error) {
            logger.error('Failed to send customer notification:', error);
            results.push({ type: 'customer', success: false, error: error.message });
        }
        
        // 2. Send carrier notification (skip for Canpar courier shipments)
        const shipmentType = shipmentData.shipmentInfo?.shipmentType || 'freight';
        const carrierName = shipmentData.carrier || '';
        const isCanparCourier = shipmentType === 'courier' && carrierName.toLowerCase().includes('canpar');
        
        if (isCanparCourier) {
            logger.info('Skipping carrier notification for Canpar courier shipment - Canpar handles their own notifications');
            results.push({ type: 'carrier', success: true, skipped: true, reason: 'Canpar handles own notifications' });
        } else {
            try {
                await sendCarrierNotification(shipmentData, documentResults);
                results.push({ type: 'carrier', success: true });
            } catch (error) {
                logger.error('Failed to send carrier notification:', error);
                results.push({ type: 'carrier', success: false, error: error.message });
            }
        }
        
        // 3. Send internal notifications
        try {
            logger.info('Attempting to send internal notifications...');
            await sendInternalNotification(shipmentData, documentResults);
            logger.info('Internal notifications sent successfully');
            results.push({ type: 'internal', success: true });
        } catch (error) {
            logger.error('Failed to send internal notification:', error);
            results.push({ type: 'internal', success: false, error: error.message });
        }
        
        logger.info('CreateShipmentX notifications completed:', {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        });
        
        return {
            success: true,
            message: 'CreateShipmentX notifications completed',
            results
        };
        
    } catch (error) {
        logger.error('Error in sendCreateShipmentXNotifications:', error);
        throw error;
    }
});

/**
 * Verifies that all documents are accessible with proper retry logic
 * Matches QuickShip implementation exactly
 */
async function verifyDocumentsAccessible(documentResults, maxAttempts = 15, initialDelay = 1000) {
    logger.info('Starting document accessibility verification...', {
        documentCount: documentResults.length,
        maxAttempts,
        initialDelay
    });
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        logger.info(`Document verification attempt ${attempt}/${maxAttempts}`);
        
        let allAccessible = true;
        const verificationResults = [];
        
        for (const doc of documentResults) {
            if (!doc.success || !doc.data?.downloadUrl) {
                verificationResults.push({
                    document: doc.data?.fileName || 'Unknown',
                    accessible: false,
                    reason: 'No download URL or document failed'
                });
                allAccessible = false;
                continue;
            }
            
            try {
                const response = await fetch(doc.data.downloadUrl, {
                    method: 'HEAD',
                    timeout: 5000
                });
                
                const accessible = response.ok;
                verificationResults.push({
                    document: doc.data.fileName,
                    accessible,
                    status: response.status,
                    statusText: response.statusText
                });
                
                if (!accessible) {
                    allAccessible = false;
                }
            } catch (error) {
                verificationResults.push({
                    document: doc.data?.fileName || 'Unknown',
                    accessible: false,
                    error: error.message
                });
                allAccessible = false;
            }
        }
        
        logger.info(`Verification attempt ${attempt} results:`, verificationResults);
        
        if (allAccessible) {
            logger.info(`All documents accessible after ${attempt} attempts`);
            return;
        }
        
        if (attempt < maxAttempts) {
            const delay = initialDelay * Math.pow(1.5, attempt - 1); // Exponential backoff
            logger.info(`Documents not ready, waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    logger.warn(`Document verification completed after ${maxAttempts} attempts, some documents may not be accessible`);
}

/**
 * Downloads document with retry logic and adds to attachments array
 * Matches QuickShip implementation exactly
 */
async function downloadDocumentWithRetry(downloadUrl, fileName, attachments, documentType, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            logger.info(`Attempting to download ${documentType} document (attempt ${attempt}/${maxRetries})`, {
                fileName,
                downloadUrl: downloadUrl.substring(0, 100) + '...',
                attempt
            });
            
            // Add delay for subsequent attempts to handle race conditions
            if (attempt > 1) {
                const delay = attempt * 1000; // 1s, 2s, 3s delays
                logger.info(`Waiting ${delay}ms before retry for ${documentType}...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/pdf'
                },
                timeout: 10000 // 10 second timeout
            });
            
            logger.info(`Download response for ${documentType}:`, {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries()),
                attempt
            });
            
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                
                if (arrayBuffer.byteLength === 0) {
                    throw new Error(`Empty document received for ${documentType}`);
                }
                
                const buffer = Buffer.from(arrayBuffer);
                const base64Content = buffer.toString('base64');
                
                // Validate the content is actually a PDF
                if (!base64Content.startsWith('JVBERi')) {
                    throw new Error(`Invalid PDF content for ${documentType} (doesn't start with PDF header)`);
                }
                
                attachments.push({
                    content: base64Content,
                    filename: fileName,
                    type: 'application/pdf',
                    disposition: 'attachment'
                });
                
                logger.info(`Successfully downloaded and attached ${documentType} on attempt ${attempt}`, {
                    fileName,
                    fileSize: arrayBuffer.byteLength,
                    base64Size: base64Content.length
                });
                
                return true;
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            logger.warn(`Failed to download ${documentType} on attempt ${attempt}:`, {
                error: error.message,
                fileName,
                attempt,
                willRetry: attempt < maxRetries
            });
            
            // If this was the last attempt, log the final failure
            if (attempt === maxRetries) {
                logger.error(`Final failure downloading ${documentType} after ${maxRetries} attempts:`, {
                    error: error.message,
                    fileName,
                    downloadUrl: downloadUrl.substring(0, 100) + '...'
                });
                return false;
            }
        }
    }
    
    return false;
}

/**
 * Sends notification to the customer
 * Uses direct sgMail.send() like QuickShip
 */
async function sendCustomerNotification(shipmentData, documentResults) {
    try {
        const customerEmail = shipmentData.shipTo?.email || shipmentData.customerEmail;
        
        if (!customerEmail) {
            logger.warn('No customer email found, skipping customer notification');
            return;
        }
        
        logger.info('DEBUG: Preparing attachments for customer email', {
            documentResults: documentResults.map(doc => ({
                fileName: doc.data?.fileName,
                type: doc.data?.type || doc.type,
                success: doc.success,
                hasData: !!doc.data,
                hasDownloadUrl: !!doc.data?.downloadUrl
            })),
            shipmentType: shipmentData.shipmentInfo?.shipmentType || 'unknown'
        });
        
        // Prepare attachments based on shipment type
        const attachments = [];
        const shipmentType = shipmentData.shipmentInfo?.shipmentType || 'freight';
        
        if (shipmentType === 'courier') {
            // For courier shipments: attach shipping labels
            const shippingLabelDocuments = documentResults.filter(doc => {
                const fileName = doc.data?.fileName || doc.data?.filename;
                return doc.success && (
                    doc.type === 'shipping_label' ||
                    fileName?.includes('label') ||
                    fileName?.includes('canpar-label')
                );
            });
            
            logger.info('DEBUG: Found shipping label documents for courier shipment', {
                labelCount: shippingLabelDocuments.length,
                labels: shippingLabelDocuments.map(doc => ({
                    fileName: doc.data?.fileName,
                    hasDownloadUrl: !!doc.data?.downloadUrl
                }))
            });
            
            for (const labelDoc of shippingLabelDocuments) {
                if (labelDoc.data?.downloadUrl) {
                    const labelFileName = labelDoc.data.fileName || labelDoc.data.filename;
                    const downloadSuccess = await downloadDocumentWithRetry(
                        labelDoc.data.downloadUrl,
                        labelFileName,
                        attachments,
                        'Shipping Label (Customer Email)'
                    );
                    
                    if (downloadSuccess) {
                        logger.info('Successfully attached shipping label to customer email:', {
                            filename: labelFileName
                        });
                    }
                }
            }
        } else {
            // For freight shipments: attach BOL only for customer
            const bolDocument = documentResults.find(doc => {
                const fileName = doc.data?.fileName || doc.data?.filename;
                return doc.success && fileName?.includes('BOL');
            });
            
            if (bolDocument?.data?.downloadUrl) {
                const bolFileName = bolDocument.data.fileName || bolDocument.data.filename;
                const downloadSuccess = await downloadDocumentWithRetry(
                    bolDocument.data.downloadUrl,
                    bolFileName,
                    attachments,
                    'BOL (Customer Email)'
                );
                
                if (downloadSuccess) {
                    logger.info('Successfully attached BOL document to customer email:', {
                        filename: bolFileName
                    });
                }
            } else {
                logger.warn('No BOL document found for freight shipment customer attachment');
            }
        }
        
        // Calculate total weight and pieces for email - FIXED: Weight × Quantity
        const totalWeight = shipmentData.packages?.reduce((sum, pkg) => sum + (parseFloat(pkg.weight || 0) * parseInt(pkg.packagingQuantity || 1)), 0) || 0;
        const totalPieces = shipmentData.packages?.reduce((sum, pkg) => sum + parseInt(pkg.packagingQuantity || 1), 0) || 0;
        
        // Use direct sgMail.send() like QuickShip
        const emailContent = {
            to: customerEmail,
            from: {
                email: SEND_FROM_EMAIL,
                name: SEND_FROM_NAME
            },
            subject: `Shipment Confirmation: ${shipmentData.shipmentID || shipmentData.id}`,
            html: generateCreateShipmentXCustomerHTML(shipmentData, totalPieces, totalWeight),
            text: generateCreateShipmentXCustomerText(shipmentData, totalPieces, totalWeight),
            attachments: attachments
        };
        
        logger.info('Sending customer email with attachments', {
            to: customerEmail,
            from: emailContent.from.email,
            subject: emailContent.subject,
            attachmentCount: attachments.length,
            shipmentType: shipmentType
        });
        
        await sgMail.send(emailContent);
        logger.info('Customer notification sent successfully to:', customerEmail, {
            attachmentCount: attachments.length,
            shipmentId: shipmentData.shipmentID || shipmentData.id,
            method: 'direct-sendgrid'
        });
        
    } catch (error) {
        logger.error('Error sending customer notification:', error);
        throw error;
    }
}

/**
 * Sends notification to the carrier
 * Uses direct sgMail.send() like QuickShip
 */
async function sendCarrierNotification(shipmentData, documentResults) {
    try {
        // Handle both old and new carrier email structures
        let carrierEmail = null;
        
        // Check for new terminal-based structure (QuickShip carriers)
        if (shipmentData.selectedCarrier?.emailContacts && shipmentData.creationMethod === 'quickship') {
            // NEW STRUCTURE: Terminal-based email management (QuickShip carriers only)
            logger.info('Extracting carrier email from new terminal-based structure for CreateShipmentX');
            
            // Get the selected terminal ID from shipment data
            let selectedTerminalId = shipmentData.selectedCarrierContactId || 'default';
            
            // Extract terminal from selectedCarrierContactId (format: terminalId_contactType_index)
            if (selectedTerminalId.includes('_')) {
                selectedTerminalId = selectedTerminalId.split('_')[0];
            }
            
            // Find the selected terminal or use default
            const terminals = shipmentData.selectedCarrier.emailContacts || [];
            let selectedTerminal = terminals.find(terminal => terminal.id === selectedTerminalId);
            
            // If no specific terminal found, use the first one or default
            if (!selectedTerminal && terminals.length > 0) {
                selectedTerminal = terminals.find(terminal => terminal.isDefault) || terminals[0];
            }
            
            if (selectedTerminal) {
                logger.info('Using terminal for CreateShipmentX carrier notification email:', selectedTerminal.name);
                
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
                carrierEmail = allEmails[0] || null;
                
                logger.info('Extracted CreateShipmentX carrier email from terminal:', {
                    terminal: selectedTerminal.name,
                    email: carrierEmail,
                    totalEmails: allEmails.length
                });
            }
        } else {
            // OLD STRUCTURE: Legacy contactEmail field (API carriers and fallback)
            logger.info('Using legacy carrier email structure for CreateShipmentX');
            carrierEmail = shipmentData.selectedCarrier?.contactEmail || shipmentData.carrierEmail;
        }
        
        // If still no email found, use fallback for testing only
        if (!carrierEmail) {
            carrierEmail = 'tyler@tygershark.com'; // Fallback for testing
            logger.warn('No carrier email found in either structure, using fallback email for testing', {
                hasSelectedCarrier: !!shipmentData.selectedCarrier,
                hasEmailContacts: !!shipmentData.selectedCarrier?.emailContacts,
                hasContactEmail: !!shipmentData.selectedCarrier?.contactEmail,
                creationMethod: shipmentData.creationMethod,
                selectedCarrierContactId: shipmentData.selectedCarrierContactId
            });
        }
        
        if (!carrierEmail) {
            logger.warn('No carrier email found and no fallback available, skipping carrier notification');
            return;
        }
        
        logger.info('DEBUG: Preparing attachments for carrier notification', {
            documentResults: documentResults.map(doc => ({
                fileName: doc.data?.fileName,
                type: doc.data?.type || doc.type,
                success: doc.success,
                hasData: !!doc.data,
                hasDownloadUrl: !!doc.data?.downloadUrl
            })),
            carrierEmail,
            shipmentType: shipmentData.shipmentInfo?.shipmentType || 'unknown'
        });
        
        // Prepare attachments based on shipment type
        const attachments = [];
        const shipmentType = shipmentData.shipmentInfo?.shipmentType || 'freight';
        
        if (shipmentType === 'courier') {
            // For courier shipments: attach shipping labels only
            const shippingLabelDocuments = documentResults.filter(doc => {
                const fileName = doc.data?.fileName || doc.data?.filename;
                return doc.success && (
                    doc.type === 'shipping_label' ||
                    fileName?.includes('label') ||
                    fileName?.includes('canpar-label')
                );
            });
            
            logger.info('DEBUG: Found shipping label documents for courier carrier notification', {
                labelCount: shippingLabelDocuments.length,
                labels: shippingLabelDocuments.map(doc => ({
                    fileName: doc.data?.fileName,
                    hasDownloadUrl: !!doc.data?.downloadUrl
                }))
            });
            
            for (const labelDoc of shippingLabelDocuments) {
                if (labelDoc.data?.downloadUrl) {
                    const labelFileName = labelDoc.data.fileName || labelDoc.data.filename;
                    const downloadSuccess = await downloadDocumentWithRetry(
                        labelDoc.data.downloadUrl,
                        labelFileName,
                        attachments,
                        'Shipping Label (Carrier Email)'
                    );
                    
                    if (downloadSuccess) {
                        logger.info('Successfully attached shipping label to carrier email:', {
                            filename: labelFileName
                        });
                    }
                }
            }
        } else {
            // For freight shipments: attach BOL + Carrier Confirmation
            
            // Add BOL document
            const bolDocument = documentResults.find(doc => {
                const fileName = doc.data?.fileName || doc.data?.filename;
                return doc.success && fileName?.includes('BOL');
            });
            
            if (bolDocument?.data?.downloadUrl) {
                const bolFileName = bolDocument.data.fileName || bolDocument.data.filename;
                const downloadSuccess = await downloadDocumentWithRetry(
                    bolDocument.data.downloadUrl,
                    bolFileName,
                    attachments,
                    'BOL (Carrier Email)'
                );
                
                if (downloadSuccess) {
                    logger.info('Successfully attached BOL document to carrier email:', {
                        filename: bolFileName
                    });
                }
            }
            
            // Add Carrier Confirmation document
            const confirmationDocument = documentResults.find(doc => {
                const fileName = doc.data?.fileName || doc.data?.filename;
                return doc.success && (
                    fileName?.includes('CARRIER-CONFIRMATION') ||
                    fileName?.includes('CARRIER') ||
                    doc.data?.type === 'carrier_confirmation'
                );
            });
            
            if (confirmationDocument?.data?.downloadUrl) {
                const confirmationFileName = confirmationDocument.data.fileName || confirmationDocument.data.filename;
                const downloadSuccess = await downloadDocumentWithRetry(
                    confirmationDocument.data.downloadUrl,
                    confirmationFileName,
                    attachments,
                    'Carrier Confirmation (Carrier Email)'
                );
                
                if (downloadSuccess) {
                    logger.info('Successfully attached Carrier Confirmation document to carrier email:', {
                        filename: confirmationFileName
                    });
                }
            }
        }
        
        // Calculate total weight and pieces for email - FIXED: Weight × Quantity
        const totalWeight = shipmentData.packages?.reduce((sum, pkg) => sum + (parseFloat(pkg.weight || 0) * parseInt(pkg.packagingQuantity || 1)), 0) || 0;
        const totalPieces = shipmentData.packages?.reduce((sum, pkg) => sum + parseInt(pkg.packagingQuantity || 1), 0) || 0;
        
        // Use direct sgMail.send() like QuickShip
        const emailContent = {
            to: carrierEmail,
            from: {
                email: SEND_FROM_EMAIL,
                name: SEND_FROM_NAME
            },
            subject: `New Shipment Assignment: ${shipmentData.shipmentID || shipmentData.id}`,
            html: generateCreateShipmentXCarrierHTML(shipmentData, totalPieces, totalWeight),
            text: generateCreateShipmentXCarrierText(shipmentData, totalPieces, totalWeight),
            attachments: attachments
        };
        
        logger.info('Sending carrier email with attachments', {
            to: carrierEmail,
            from: emailContent.from.email,
            subject: emailContent.subject,
            attachmentCount: attachments.length,
            shipmentType: shipmentType
        });
        
        await sgMail.send(emailContent);
        logger.info('Carrier notification sent successfully to:', carrierEmail, {
            attachmentCount: attachments.length,
            shipmentId: shipmentData.shipmentID || shipmentData.id,
            method: 'direct-sendgrid'
        });
        
    } catch (error) {
        logger.error('Error sending carrier notification:', error);
        throw error;
    }
}

/**
 * Sends internal notifications to company admins
 * Uses direct sgMail.send() like QuickShip
 */
async function sendInternalNotification(shipmentData, documentResults) {
    try {
        logger.info('sendInternalNotification: Starting internal notification process');
        
        // Get notification subscribers
        const subscribers = await getNotificationSubscribers(shipmentData.companyID);
        logger.info(`sendInternalNotification: Found ${subscribers?.length || 0} subscribers`);
        
        if (!subscribers || subscribers.length === 0) {
            logger.warn('No internal notification subscribers found');
            return;
        }
        
        // Prepare attachments based on shipment type (NO labels for internal notifications)
        const attachments = [];
        const shipmentType = shipmentData.shipmentInfo?.shipmentType || 'freight';
        logger.info(`sendInternalNotification: Processing ${shipmentType} shipment`);
        
        if (shipmentType === 'courier') {
            // For courier shipments: NO attachments for internal notifications
            logger.info('Internal notification for courier shipment - no attachments included');
        } else {
            // For freight shipments: attach BOL + Carrier Confirmation only
            
            // Add BOL document
            const bolDocument = documentResults.find(doc => {
                const fileName = doc.data?.fileName || doc.data?.filename;
                return doc.success && fileName?.includes('BOL');
            });
            
            if (bolDocument?.data?.downloadUrl) {
                const bolFileName = bolDocument.data.fileName || bolDocument.data.filename;
                await downloadDocumentWithRetry(
                    bolDocument.data.downloadUrl,
                    bolFileName,
                    attachments,
                    'BOL (Internal Email)'
                );
            }
            
            // Add Carrier Confirmation document
            const confirmationDocument = documentResults.find(doc => {
                const fileName = doc.data?.fileName || doc.data?.filename;
                return doc.success && (
                    fileName?.includes('CARRIER-CONFIRMATION') ||
                    fileName?.includes('CARRIER') ||
                    doc.data?.type === 'carrier_confirmation'
                );
            });
            
            if (confirmationDocument?.data?.downloadUrl) {
                const confirmationFileName = confirmationDocument.data.fileName || confirmationDocument.data.filename;
                await downloadDocumentWithRetry(
                    confirmationDocument.data.downloadUrl,
                    confirmationFileName,
                    attachments,
                    'Carrier Confirmation (Internal Email)'
                );
            }
        }
        
        // Calculate total weight and pieces for email - FIXED: Weight × Quantity
        const totalWeight = shipmentData.packages?.reduce((sum, pkg) => sum + (parseFloat(pkg.weight || 0) * parseInt(pkg.packagingQuantity || 1)), 0) || 0;
        const totalPieces = shipmentData.packages?.reduce((sum, pkg) => sum + parseInt(pkg.packagingQuantity || 1), 0) || 0;
        
        // Send to all subscribers
        for (const subscriber of subscribers) {
            try {
                const emailContent = {
                    to: subscriber.userEmail,
                    from: {
                        email: SEND_FROM_EMAIL,
                        name: SEND_FROM_NAME
                    },
                    subject: `New Shipment Created: ${shipmentData.shipmentID || shipmentData.id}`,
                    html: generateCreateShipmentXInternalHTML(shipmentData, totalPieces, totalWeight),
                    text: generateCreateShipmentXInternalText(shipmentData, totalPieces, totalWeight),
                    attachments: attachments
                };
                
                await sgMail.send(emailContent);
                logger.info('Internal notification sent to:', subscriber.userEmail, {
                    attachmentCount: attachments.length,
                    shipmentType: shipmentType
                });
            } catch (error) {
                logger.error(`Failed to send internal notification to ${subscriber.userEmail}:`, error);
            }
        }
        
    } catch (error) {
        logger.error('Error sending internal notifications:', error);
        throw error;
    }
}

/**
 * Get notification subscribers for a company
 */
async function getNotificationSubscribers(companyID) {
    try {
        const subscribersSnapshot = await db
            .collection('notificationSubscriptions')
            .where('companyId', '==', companyID)
            .where('notificationType', '==', 'shipment_created')
            .where('enabled', '==', true)
            .get();
        
        const subscribers = [];
        for (const doc of subscribersSnapshot.docs) {
            const data = doc.data();
            if (data.userEmail) {
                subscribers.push({
                    userEmail: data.userEmail,
                    userId: data.userId
                });
            }
        }
        
        logger.info(`Found ${subscribers.length} notification subscribers for company ${companyID}`);
        return subscribers;
        
    } catch (error) {
        logger.error('Error getting notification subscribers:', error);
        return [];
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
        day: 'numeric',
        timeZone: 'America/Toronto' // Force Eastern Time
    });
    
    try {
        let date;
        
        // Handle Firestore Timestamp
        if (dateString?.toDate) {
            date = dateString.toDate();
        } 
        // Handle date-only strings (YYYY-MM-DD) to avoid timezone issues
        else if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = dateString.split('-');
            date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } 
        // Handle other date formats
        else {
            date = new Date(dateString);
        }
        
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Toronto' // Force Eastern Time
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

/**
 * Generate HTML content for customer notification (matching QuickShip template design)
 */
function generateCreateShipmentXCustomerHTML(shipmentData, totalPieces, totalWeight) {
    // Format addresses consistently
    const shipFromFormatted = formatAddress(shipmentData.shipFrom);
    const shipToFormatted = formatAddress(shipmentData.shipTo);
    
    // Get carrier and service information
    const carrierName = shipmentData.carrier || 
                       shipmentData.selectedRate?.carrier?.name ||
                       shipmentData.selectedRate?.sourceCarrierName ||
                       shipmentData.selectedCarrier?.name ||
                       'Selected Carrier';
                       
    const serviceName = shipmentData.selectedRate?.service?.name ||
                       shipmentData.selectedRate?.service ||
                       shipmentData.selectedService ||
                       'Standard Service';

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                <h1 style="margin: 0; font-size: 24px;">Shipment Confirmation</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your shipment ${shipmentData.shipmentID || shipmentData.id} has been successfully entered in the system</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                <!-- Shipment Confirmed Notice -->
                <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; border-radius: 0; margin-bottom: 20px;">
                    <h3 style="color: #065f46; margin: 0 0 10px 0; font-size: 16px;">✅ Shipment Confirmed</h3>
                    <p style="color: #047857; margin: 0; font-size: 14px;">Your shipment has been processed successfully! Your shipping documents are attachments to this email.</p>
                </div>

                <!-- Shipment Summary -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Shipment Summary</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Shipment #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${shipmentData.shipmentID || shipmentData.id}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Company ID:</strong></td><td style="padding: 8px 0;">${shipmentData.companyID || 'N/A'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Created:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleDateString()}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td><td style="padding: 8px 0; color: #1c277d; font-weight: bold; text-transform: capitalize;">Pending</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Method:</strong></td><td style="padding: 8px 0;">CreateShipmentX</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Reference #:</strong></td><td style="padding: 8px 0;">${shipmentData.shipmentInfo?.shipperReferenceNumber || shipmentData.shipmentID || shipmentData.id}</td></tr>
                        ${shipmentData.shipmentInfo?.referenceNumbers && shipmentData.shipmentInfo.referenceNumbers.length > 0 ? 
                            shipmentData.shipmentInfo.referenceNumbers.map((ref, index) => 
                                `<tr><td style="padding: 8px 0; color: #666;"><strong>Reference ${index + 2}:</strong></td><td style="padding: 8px 0;">${ref}</td></tr>`
                            ).join('') : ''
                        }
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Bill Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${shipmentData.shipmentInfo?.billType || 'third_party'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Ship Date:</strong></td><td style="padding: 8px 0;">${formatDate(shipmentData.shipmentInfo?.shipmentDate)}</td></tr>
                        ${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Tracking #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber}</td></tr>` : ''}
                    </table>
                </div>

                <!-- Shipment Information -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Shipment Information</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${shipmentData.shipmentInfo?.shipmentType || 'freight'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Reference #:</strong></td><td style="padding: 8px 0;">${shipmentData.shipmentInfo?.shipperReferenceNumber || shipmentData.shipmentID || shipmentData.id}</td></tr>
                        ${shipmentData.shipmentInfo?.referenceNumbers && shipmentData.shipmentInfo.referenceNumbers.length > 0 ? 
                            shipmentData.shipmentInfo.referenceNumbers.map((ref, index) => 
                                `<tr><td style="padding: 8px 0; color: #666;"><strong>Reference ${index + 2}:</strong></td><td style="padding: 8px 0;">${ref}</td></tr>`
                            ).join('') : ''
                        }
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Bill Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${shipmentData.shipmentInfo?.billType || 'third_party'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Ship Date:</strong></td><td style="padding: 8px 0;">${formatDate(shipmentData.shipmentInfo?.shipmentDate)}</td></tr>
                        ${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Tracking #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber}</td></tr>` : ''}
                    </table>
                </div>

                <!-- Carrier & Service -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Carrier & Service</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Carrier:</strong></td><td style="padding: 8px 0;">${carrierName}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Service:</strong></td><td style="padding: 8px 0;">${serviceName}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Tracking #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber || 'Pending'}</td></tr>
                    </table>
                </div>

                <!-- Package Information -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Package Information</h2>
                    <p style="margin: 0 0 15px 0; color: #666;"><strong>Total: ${totalPieces} package${totalPieces > 1 ? 's' : ''}, ${totalWeight.toFixed(1)} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}</strong></p>
                    ${shipmentData.packages?.slice(0, 3).map((pkg, index) => `
                        <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                            <strong>Package ${index + 1}:</strong> ${pkg.itemDescription || 'Package'}<br>
                            <span style="color: #666;">
                                Qty: ${pkg.packagingQuantity || 1}, 
                                Weight: ${pkg.weight || 0} ${pkg.unitSystem === 'metric' ? 'kg' : 'lbs'}, 
                                Dimensions: ${pkg.length || 0}" × ${pkg.width || 0}" × ${pkg.height || 0}" ${pkg.unitSystem === 'metric' ? 'cm' : 'in'},
                                Type: ${getPackagingTypeName(pkg.packagingType)}
                                ${pkg.freightClass ? `<br>Freight Class: ${pkg.freightClass}` : ''}
                            </span>
                        </div>
                    `).join('')}
                    ${shipmentData.packages?.length > 3 ? `<p style="margin: 10px 0 0 0; color: #666; font-style: italic;">...and ${shipmentData.packages.length - 3} more package${(shipmentData.packages.length - 3) > 1 ? 's' : ''}</p>` : ''}
                </div>

                <!-- Addresses -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Address Information</h2>
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 200px; margin-right: 20px;">
                            <h4 style="color: #000; margin: 0 0 10px 0;">Ship From:</h4>
                            <p style="margin: 0; line-height: 1.5;">
                                ${shipmentData.shipFrom?.companyName ? `<strong>${shipmentData.shipFrom.companyName}</strong><br>` : ''}
                                ${shipmentData.shipFrom?.firstName || shipmentData.shipFrom?.lastName ? `${shipmentData.shipFrom.firstName || ''} ${shipmentData.shipFrom.lastName || ''}<br>` : ''}
                                ${shipmentData.shipFrom?.street ? `${shipmentData.shipFrom.street}<br>` : ''}
                                ${shipmentData.shipFrom?.street2 ? `${shipmentData.shipFrom.street2}<br>` : ''}
                                ${shipmentData.shipFrom ? `${shipmentData.shipFrom.city}, ${shipmentData.shipFrom.state} ${shipmentData.shipFrom.postalCode}<br>` : ''}
                                ${shipmentData.shipFrom?.country ? shipmentData.shipFrom.country : ''}
                                ${shipmentData.shipFrom?.phone ? `<br>Phone: ${shipmentData.shipFrom.phone}` : ''}
                            </p>
                        </div>
                        <div style="flex: 1; min-width: 200px;">
                            <h4 style="color: #000; margin: 0 0 10px 0;">Ship To:</h4>
                            <p style="margin: 0; line-height: 1.5;">
                                ${shipmentData.shipTo?.companyName ? `<strong>${shipmentData.shipTo.companyName}</strong><br>` : ''}
                                ${shipmentData.shipTo?.firstName || shipmentData.shipTo?.lastName ? `${shipmentData.shipTo.firstName || ''} ${shipmentData.shipTo.lastName || ''}<br>` : ''}
                                ${shipmentData.shipTo?.street ? `${shipmentData.shipTo.street}<br>` : ''}
                                ${shipmentData.shipTo?.street2 ? `${shipmentData.shipTo.street2}<br>` : ''}
                                ${shipmentData.shipTo ? `${shipmentData.shipTo.city}, ${shipmentData.shipTo.state} ${shipmentData.shipTo.postalCode}<br>` : ''}
                                ${shipmentData.shipTo?.country ? shipmentData.shipTo.country : ''}
                                ${shipmentData.shipTo?.phone ? `<br>Phone: ${shipmentData.shipTo.phone}` : ''}
                            </p>
                        </div>
                    </div>
                </div>

                ${shipmentData.shipmentID || shipmentData.id ? `
                <div style="background: #f5f5f5; padding: 20px; border-radius: 0; text-align: center; margin-bottom: 20px;">
                    <h3 style="color: #1c277d; margin: 0 0 10px 0;">Track Your Shipment</h3>
                    <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold; color: #1c277d;">${shipmentData.shipmentID || shipmentData.id}</p>
                    <a href="https://solushipx.web.app/tracking/${shipmentData.shipmentID || shipmentData.id}" 
                       style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 0; display: inline-block; border: 2px solid #000;">
                       Track Shipment
                    </a>
                </div>
                ` : ''}

                <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                    <p style="margin: 0;">Need help? Contact us at <a href="mailto:support@integratedcarriers.com" style="color: #1c277d;">support@integratedcarriers.com</a></p>
                    <p style="margin: 10px 0 0 0; font-size: 14px;">© 2025 Integrated Carrier. All rights reserved.</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate text content for customer notification (matching QuickShip template)
 */
function generateCreateShipmentXCustomerText(shipmentData, totalPieces, totalWeight) {
    // Get carrier and service information
    const carrierName = shipmentData.carrier || 
                       shipmentData.selectedRate?.carrier?.name ||
                       shipmentData.selectedRate?.sourceCarrierName ||
                       shipmentData.selectedCarrier?.name ||
                       'Selected Carrier';
                       
    const serviceName = shipmentData.selectedRate?.service?.name ||
                       shipmentData.selectedRate?.service ||
                       shipmentData.selectedService ||
                       'Standard Service';

    return `
Shipment Confirmation

Your shipment ${shipmentData.shipmentID || shipmentData.id} has been successfully booked.

SHIPMENT SUMMARY
- Shipment #: ${shipmentData.shipmentID || shipmentData.id}
- Created: ${new Date().toLocaleDateString()}
- Status: Pending

SHIPMENT INFORMATION
- Type: ${shipmentData.shipmentInfo?.shipmentType || 'freight'}
- Reference #: ${shipmentData.shipmentInfo?.shipperReferenceNumber || shipmentData.shipmentID || shipmentData.id}
- Bill Type: ${getBillTypeLabel(shipmentData.shipmentInfo?.billType || 'third_party')}
- Ship Date: ${formatDate(shipmentData.shipmentInfo?.shipmentDate)}
${shipmentData.shipmentInfo?.eta1 ? `- ETA 1: ${formatDate(shipmentData.shipmentInfo.eta1)}` : ''}
${shipmentData.shipmentInfo?.eta2 ? `- ETA 2: ${formatDate(shipmentData.shipmentInfo.eta2)}` : ''}
${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber ? `- Tracking #: ${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber}` : ''}

CARRIER & SERVICE
- Carrier: ${carrierName}
- Service: ${getServiceName(shipmentData)}
- Tracking #: ${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber || 'Pending'}

PACKAGE INFORMATION
Total: ${totalPieces} package${totalPieces > 1 ? 's' : ''}, ${totalWeight.toFixed(1)} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}

${shipmentData.packages?.slice(0, 3).map((pkg, index) => 
    `Package ${index + 1}: ${pkg.itemDescription || 'Package'}\nQty: ${pkg.packagingQuantity || 1}, Weight: ${pkg.weight || 0} ${pkg.unitSystem === 'metric' ? 'kg' : 'lbs'}, Dimensions: ${pkg.length || 0}" × ${pkg.width || 0}" × ${pkg.height || 0}" ${pkg.unitSystem === 'metric' ? 'cm' : 'in'}, Type: ${getPackagingTypeName(pkg.packagingType)}`
).join('\n\n') || ''}${(shipmentData.packages?.length || 0) > 3 ? `\n\n...and ${(shipmentData.packages?.length || 0) - 3} more package${((shipmentData.packages?.length || 0) - 3) > 1 ? 's' : ''}` : ''}

ADDRESSES
Ship From:
${shipmentData.shipFrom?.companyName ? `${shipmentData.shipFrom.companyName}\n` : ''}${shipmentData.shipFrom?.firstName || shipmentData.shipFrom?.lastName ? `${shipmentData.shipFrom.firstName || ''} ${shipmentData.shipFrom.lastName || ''}<br>` : ''}
${shipmentData.shipFrom?.street ? `${shipmentData.shipFrom.street}\n` : ''}${shipmentData.shipFrom?.street2 ? `${shipmentData.shipFrom.street2}\n` : ''}${shipmentData.shipFrom ? `${shipmentData.shipFrom.city}, ${shipmentData.shipFrom.state} ${shipmentData.shipFrom.postalCode}\n` : ''}${shipmentData.shipFrom?.country ? shipmentData.shipFrom.country : ''}${shipmentData.shipFrom?.phone ? `\nPhone: ${shipmentData.shipFrom.phone}` : ''}

Ship To:
${shipmentData.shipTo?.companyName ? `${shipmentData.shipTo.companyName}\n` : ''}${shipmentData.shipTo?.firstName || shipmentData.shipTo?.lastName ? `${shipmentData.shipTo.firstName || ''} ${shipmentData.shipTo.lastName || ''}<br>` : ''}
${shipmentData.shipTo?.street ? `${shipmentData.shipTo.street}\n` : ''}${shipmentData.shipTo?.street2 ? `${shipmentData.shipTo.street2}\n` : ''}${shipmentData.shipTo ? `${shipmentData.shipTo.city}, ${shipmentData.shipTo.state} ${shipmentData.shipTo.postalCode}\n` : ''}${shipmentData.shipTo?.country ? shipmentData.shipTo.country : ''}${shipmentData.shipTo?.phone ? `\nPhone: ${shipmentData.shipTo.phone}` : ''}

✅ SHIPMENT CONFIRMED
Your shipment has been processed successfully! Your shipping documents are attachments to this email.

${shipmentData.shipmentID || shipmentData.id ? `Track your shipment: https://solushipx.web.app/tracking/${shipmentData.shipmentID || shipmentData.id}` : ''}

Need help? Contact us at support@integratedcarriers.com
© 2025 Integrated Carrier. All rights reserved.
    `;
}

/**
 * Generate HTML content for carrier notification (matching QuickShip template design)
 */
function generateCreateShipmentXCarrierHTML(shipmentData, totalPieces, totalWeight) {
    // Format addresses consistently
    const shipFromFormatted = formatAddress(shipmentData.shipFrom);
    const shipToFormatted = formatAddress(shipmentData.shipTo);
    
    // Get carrier information
    const carrierName = shipmentData.carrier || 
                       shipmentData.selectedRate?.carrier?.name ||
                       shipmentData.selectedRate?.sourceCarrierName ||
                       shipmentData.selectedCarrier?.name ||
                       'Selected Carrier';
                       
    const carrierDetails = {
        name: carrierName,
        contactName: shipmentData.selectedCarrier?.contactName || 'N/A',
        contactEmail: shipmentData.selectedCarrier?.contactEmail || 'N/A',
        contactPhone: shipmentData.selectedCarrier?.contactPhone || 'N/A'
    };

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                <h1 style="margin: 0; font-size: 24px;">Carrier Confirmation</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">New pickup request for order ${shipmentData.shipmentID || shipmentData.id}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                <!-- Pickup Required Notice -->
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 0; margin-bottom: 20px;">
                    <h3 style="color: #1d4ed8; margin: 0 0 10px 0; font-size: 16px;">📦 Pickup Required</h3>
                    <p style="color: #1e40af; margin: 0; font-size: 14px;">Please coordinate pickup time with the shipper and confirm receipt of this assignment. You should receive the shipping documents as attachments to this email.</p>
                </div>

                <!-- Pickup Assignment Summary -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Pickup Assignment</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Order #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${shipmentData.shipmentID || shipmentData.id}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Company ID:</strong></td><td style="padding: 8px 0;">${shipmentData.companyID || 'N/A'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Assigned Carrier:</strong></td><td style="padding: 8px 0; font-weight: bold; color: #1c277d;">${carrierDetails.name}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Created:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleDateString()}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td><td style="padding: 8px 0; color: #1c277d; font-weight: bold;">Pending</td></tr>

                    </table>
                </div>

                <!-- Shipment Information -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Shipment Information</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${shipmentData.shipmentInfo?.shipmentType || 'freight'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Reference #:</strong></td><td style="padding: 8px 0;">${shipmentData.shipmentInfo?.shipperReferenceNumber || shipmentData.shipmentID || shipmentData.id}</td></tr>
                        ${shipmentData.shipmentInfo?.referenceNumbers && shipmentData.shipmentInfo.referenceNumbers.length > 0 ? 
                            shipmentData.shipmentInfo.referenceNumbers.map((ref, index) => 
                                `<tr><td style="padding: 8px 0; color: #666;"><strong>Reference ${index + 2}:</strong></td><td style="padding: 8px 0;">${ref}</td></tr>`
                            ).join('') : ''
                        }
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Bill Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${shipmentData.shipmentInfo?.billType || 'third_party'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Ship Date:</strong></td><td style="padding: 8px 0;">${formatDate(shipmentData.shipmentInfo?.shipmentDate)}</td></tr>
                        ${shipmentData.shipmentInfo?.eta1 ? `<tr><td style="padding: 8px 0; color: #666;"><strong>ETA 1:</strong></td><td style="padding: 8px 0;">${formatDate(shipmentData.shipmentInfo.eta1)}</td></tr>` : ''}
                        ${shipmentData.shipmentInfo?.eta2 ? `<tr><td style="padding: 8px 0; color: #666;"><strong>ETA 2:</strong></td><td style="padding: 8px 0;">${formatDate(shipmentData.shipmentInfo.eta2)}</td></tr>` : ''}
                        ${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Tracking #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber}</td></tr>` : ''}
                    </table>
                </div>

                <!-- Carrier Contact Information -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Carrier Contact Information</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Carrier:</strong></td><td style="padding: 8px 0;">${carrierDetails.name}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Contact Person:</strong></td><td style="padding: 8px 0;">${carrierDetails.contactName}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Email:</strong></td><td style="padding: 8px 0;">${carrierDetails.contactEmail}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Phone:</strong></td><td style="padding: 8px 0;">${carrierDetails.contactPhone}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Service:</strong></td><td style="padding: 8px 0;">CreateShipmentX Booking</td></tr>
                    </table>
                </div>

                <!-- Package Information -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Package Information</h2>
                    <p style="margin: 0 0 15px 0; color: #666;"><strong>Total: ${totalPieces} package${totalPieces > 1 ? 's' : ''}, ${totalWeight.toFixed(1)} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}</strong></p>
                    ${shipmentData.packages?.slice(0, 3).map((pkg, index) => `
                        <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                            <strong>Package ${index + 1}:</strong> ${pkg.itemDescription || 'Package'}<br>
                            <span style="color: #666;">
                                Qty: ${pkg.packagingQuantity || 1}, 
                                Weight: ${pkg.weight || 0} ${pkg.unitSystem === 'metric' ? 'kg' : 'lbs'}, 
                                Dimensions: ${pkg.length || 0}" × ${pkg.width || 0}" × ${pkg.height || 0}" ${pkg.unitSystem === 'metric' ? 'cm' : 'in'},
                                Type: ${getPackagingTypeName(pkg.packagingType)}
                                ${pkg.freightClass ? `<br>Freight Class: ${pkg.freightClass}` : ''}
                            </span>
                        </div>
                    `).join('')}
                    ${(shipmentData.packages?.length || 0) > 3 ? `<p style="margin: 10px 0 0 0; color: #666; font-style: italic;">...and ${(shipmentData.packages?.length || 0) - 3} more package${((shipmentData.packages?.length || 0) - 3) > 1 ? 's' : ''}</p>` : ''}
                </div>

                <!-- Addresses -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Pickup & Delivery Addresses</h2>
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 200px; margin-right: 20px;">
                            <h4 style="color: #000; margin: 0 0 10px 0;">📍 Pickup From:</h4>
                            <p style="margin: 0; line-height: 1.5;">
                                ${shipmentData.shipFrom?.companyName ? `<strong>${shipmentData.shipFrom.companyName}</strong><br>` : ''}
                                ${shipmentData.shipFrom?.firstName || shipmentData.shipFrom?.lastName ? `${shipmentData.shipFrom.firstName || ''} ${shipmentData.shipFrom.lastName || ''}<br>` : ''}
                                ${shipmentData.shipFrom?.street ? `${shipmentData.shipFrom.street}<br>` : ''}
                                ${shipmentData.shipFrom?.street2 ? `${shipmentData.shipFrom.street2}<br>` : ''}
                                ${shipmentData.shipFrom ? `${shipmentData.shipFrom.city}, ${shipmentData.shipFrom.state} ${shipmentData.shipFrom.postalCode}<br>` : ''}
                                ${shipmentData.shipFrom?.country ? shipmentData.shipFrom.country : ''}
                                ${shipmentData.shipFrom?.phone ? `<br><strong>Phone:</strong> ${shipmentData.shipFrom.phone}` : ''}
                            </p>
                        </div>
                        <div style="flex: 1; min-width: 200px;">
                            <h4 style="color: #000; margin: 0 0 10px 0;">🚚 Deliver To:</h4>
                            <p style="margin: 0; line-height: 1.5;">
                                ${shipmentData.shipTo?.companyName ? `<strong>${shipmentData.shipTo.companyName}</strong><br>` : ''}
                                ${shipmentData.shipTo?.firstName || shipmentData.shipTo?.lastName ? `${shipmentData.shipTo.firstName || ''} ${shipmentData.shipTo.lastName || ''}<br>` : ''}
                                ${shipmentData.shipTo?.street ? `${shipmentData.shipTo.street}<br>` : ''}
                                ${shipmentData.shipTo?.street2 ? `${shipmentData.shipTo.street2}<br>` : ''}
                                ${shipmentData.shipTo ? `${shipmentData.shipTo.city}, ${shipmentData.shipTo.state} ${shipmentData.shipTo.postalCode}<br>` : ''}
                                ${shipmentData.shipTo?.country ? shipmentData.shipTo.country : ''}
                                ${shipmentData.shipTo?.phone ? `<br><strong>Phone:</strong> ${shipmentData.shipTo.phone}` : ''}
                            </p>
                        </div>
                    </div>
                </div>

                ${shipmentData.shipmentInfo?.notes ? `
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Special Instructions</h2>
                    <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #1c277d; font-size: 14px; line-height: 1.6;">
                        ${shipmentData.shipmentInfo.notes.replace(/\n/g, '<br>')}
                    </div>
                </div>
                ` : ''}

                <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                    <p style="margin: 0;">Questions? Contact us at <a href="mailto:support@integratedcarriers.com" style="color: #1c277d;">support@integratedcarriers.com</a></p>
                    <p style="margin: 10px 0 0 0; font-size: 14px;">© 2025 Integrated Carrier. All rights reserved.</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate text content for carrier notification (matching QuickShip template)
 */
function generateCreateShipmentXCarrierText(shipmentData, totalPieces, totalWeight) {
    // Get carrier information
    const carrierName = shipmentData.carrier || 
                       shipmentData.selectedRate?.carrier?.name ||
                       shipmentData.selectedRate?.sourceCarrierName ||
                       shipmentData.selectedCarrier?.name ||
                       'Selected Carrier';
                       
    const carrierDetails = {
        name: carrierName,
        contactName: shipmentData.selectedCarrier?.contactName || 'N/A',
        contactEmail: shipmentData.selectedCarrier?.contactEmail || 'N/A',
        contactPhone: shipmentData.selectedCarrier?.contactPhone || 'N/A'
    };

    return `
Carrier Confirmation

New pickup request for order ${shipmentData.shipmentID || shipmentData.id}

ORDER DETAILS
- Order #: ${shipmentData.shipmentID || shipmentData.id}
- Assigned Carrier: ${carrierDetails.name}
- Created: ${new Date().toLocaleDateString()}
- Status: Pending

SHIPMENT INFORMATION
- Type: ${shipmentData.shipmentInfo?.shipmentType || 'freight'}
- Reference #: ${shipmentData.shipmentInfo?.shipperReferenceNumber || shipmentData.shipmentID || shipmentData.id}
- Bill Type: ${getBillTypeLabel(shipmentData.shipmentInfo?.billType || 'third_party')}
- Ship Date: ${formatDate(shipmentData.shipmentInfo?.shipmentDate)}
${shipmentData.shipmentInfo?.eta1 ? `- ETA 1: ${formatDate(shipmentData.shipmentInfo.eta1)}` : ''}
${shipmentData.shipmentInfo?.eta2 ? `- ETA 2: ${formatDate(shipmentData.shipmentInfo.eta2)}` : ''}
${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber ? `- Tracking #: ${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber}` : ''}

CARRIER CONTACT INFORMATION
- Carrier: ${carrierDetails.name}
- Contact Person: ${carrierDetails.contactName}
- Email: ${carrierDetails.contactEmail}
- Phone: ${carrierDetails.contactPhone}
- Service: ${getServiceName(shipmentData)}

PACKAGE INFORMATION
Total: ${totalPieces} package${totalPieces > 1 ? 's' : ''}, ${totalWeight.toFixed(1)} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}

${shipmentData.packages?.slice(0, 3).map((pkg, index) => 
    `Package ${index + 1}: ${pkg.itemDescription || 'Package'}\nQty: ${pkg.packagingQuantity || 1}, Weight: ${pkg.weight || 0} ${pkg.unitSystem === 'metric' ? 'kg' : 'lbs'}, Dimensions: ${pkg.length || 0}" × ${pkg.width || 0}" × ${pkg.height || 0}" ${pkg.unitSystem === 'metric' ? 'cm' : 'in'}, Type: ${getPackagingTypeName(pkg.packagingType)}`
).join('\n\n') || ''}${(shipmentData.packages?.length || 0) > 3 ? `\n\n...and ${(shipmentData.packages?.length || 0) - 3} more package${((shipmentData.packages?.length || 0) - 3) > 1 ? 's' : ''}` : ''}

PICKUP & DELIVERY ADDRESSES
📍 Pickup From:
${shipmentData.shipFrom?.companyName ? `${shipmentData.shipFrom.companyName}\n` : ''}${shipmentData.shipFrom?.firstName || shipmentData.shipFrom?.lastName ? `${shipmentData.shipFrom.firstName || ''} ${shipmentData.shipFrom.lastName || ''}<br>` : ''}
${shipmentData.shipFrom?.street ? `${shipmentData.shipFrom.street}\n` : ''}${shipmentData.shipFrom?.street2 ? `${shipmentData.shipFrom.street2}\n` : ''}${shipmentData.shipFrom ? `${shipmentData.shipFrom.city}, ${shipmentData.shipFrom.state} ${shipmentData.shipFrom.postalCode}\n` : ''}${shipmentData.shipFrom?.country ? shipmentData.shipFrom.country : ''}${shipmentData.shipFrom?.phone ? `\nPhone: ${shipmentData.shipFrom.phone}` : ''}

🚚 Deliver To:
${shipmentData.shipTo?.companyName ? `${shipmentData.shipTo.companyName}\n` : ''}${shipmentData.shipTo?.firstName || shipmentData.shipTo?.lastName ? `${shipmentData.shipTo.firstName || ''} ${shipmentData.shipTo.lastName || ''}<br>` : ''}
${shipmentData.shipTo?.street ? `${shipmentData.shipTo.street}\n` : ''}${shipmentData.shipTo?.street2 ? `${shipmentData.shipTo.street2}\n` : ''}${shipmentData.shipTo ? `${shipmentData.shipTo.city}, ${shipmentData.shipTo.state} ${shipmentData.shipTo.postalCode}\n` : ''}${shipmentData.shipTo?.country ? shipmentData.shipTo.country : ''}${shipmentData.shipTo?.phone ? `\nPhone: ${shipmentData.shipTo.phone}` : ''}

${shipmentData.shipmentInfo?.notes ? `SPECIAL INSTRUCTIONS\n${shipmentData.shipmentInfo.notes}\n\n` : ''}📦 PICKUP REQUIRED
Please coordinate pickup time with the shipper and confirm receipt of this assignment. You should receive the shipping documents as attachments to this email.

Questions? Contact us at support@integratedcarriers.com
© 2025 Integrated Carrier. All rights reserved.
    `;
}

/**
 * Generate HTML content for internal notification (matching QuickShip design)
 */
function generateCreateShipmentXInternalHTML(shipmentData, totalPieces, totalWeight) {
    // Get carrier and service information
    const carrierName = shipmentData.carrier || 
                       shipmentData.selectedRate?.carrier?.name ||
                       shipmentData.selectedRate?.sourceCarrierName ||
                       shipmentData.selectedCarrier?.name ||
                       'Selected Carrier';
                       
    const serviceName = shipmentData.selectedRate?.service?.name ||
                       shipmentData.selectedRate?.service ||
                       shipmentData.selectedService ||
                       'Standard Service';

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1c277d; color: white; padding: 30px; text-align: center;">
                <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px;" />
                <h1 style="margin: 0; font-size: 24px;">New Shipment Created</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">A new shipment has been created in the system</p>
            </div>
            
            <div style="background-color: #f5f5f5; padding: 30px;">
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Shipment Details</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 40%;"><strong>Shipment ID:</strong></td><td style="padding: 8px 0;">${shipmentData.shipmentID || shipmentData.id}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Company ID:</strong></td><td style="padding: 8px 0;">${shipmentData.companyID || 'N/A'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Created:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleDateString()}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td><td style="padding: 8px 0; color: #1c277d; font-weight: bold;">Pending</td></tr>
                    </table>
                </div>

                <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Carrier & Service</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 40%;"><strong>Carrier:</strong></td><td style="padding: 8px 0;">${carrierName}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Service:</strong></td><td style="padding: 8px 0;">${serviceName}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Tracking #:</strong></td><td style="padding: 8px 0;">${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber || 'Pending'}</td></tr>
                    </table>
                </div>

                <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Shipment Summary</h2>
                    <p style="margin: 0 0 10px 0;"><strong>From:</strong> ${formatAddress(shipmentData.shipFrom)}</p>
                    <p style="margin: 0 0 10px 0;"><strong>To:</strong> ${formatAddress(shipmentData.shipTo)}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Packages:</strong> ${totalPieces} package${totalPieces > 1 ? 's' : ''}, ${totalWeight.toFixed(1)} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}</p>
                </div>

                <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                    <p style="margin: 0;">This is an automated notification from Integrated Carriers</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate text content for internal notification
 */
function generateCreateShipmentXInternalText(shipmentData, totalPieces, totalWeight) {
    // Get carrier and service information
    const carrierName = shipmentData.carrier || 
                       shipmentData.selectedRate?.carrier?.name ||
                       shipmentData.selectedRate?.sourceCarrierName ||
                       shipmentData.selectedCarrier?.name ||
                       'Selected Carrier';
                       
    const serviceName = shipmentData.selectedRate?.service?.name ||
                       shipmentData.selectedRate?.service ||
                       shipmentData.selectedService ||
                       'Standard Service';

    return `
New Shipment Created

A new shipment has been created in the system.

SHIPMENT DETAILS
- Shipment ID: ${shipmentData.shipmentID || shipmentData.id}
- Created: ${new Date().toLocaleDateString()}
- Status: Pending

CARRIER & SERVICE
- Carrier: ${carrierName}
- Service: ${getServiceName(shipmentData)}
- Tracking #: ${shipmentData.trackingNumber || shipmentData.shipmentInfo?.carrierTrackingNumber || 'Pending'}

SHIPMENT SUMMARY
From: ${formatAddress(shipmentData.shipFrom)}
To: ${formatAddress(shipmentData.shipTo)}
Packages: ${totalPieces} package${totalPieces > 1 ? 's' : ''}, ${totalWeight.toFixed(1)} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}

This is an automated notification from Integrated Carriers
    `;
}

/**
 * Internal notification function that can be called directly from other functions
 * This follows the exact same pattern as QuickShip's sendQuickShipNotifications
 * @param {Object} params - Notification parameters
 * @param {Object} params.shipmentData - Complete shipment data
 * @param {Array} params.documentResults - Generated document results
 */
async function sendCreateShipmentXNotificationsInternal({ shipmentData, documentResults }) {
    try {
        logger.info('Starting CreateShipmentX notifications process (internal)', {
            shipmentId: shipmentData.shipmentID || shipmentData.id,
            documentCount: documentResults?.length || 0
        });

        // Validate input data
        if (!shipmentData || (!shipmentData.shipmentID && !shipmentData.id)) {
            throw new Error('Missing required shipment data or shipmentID');
        }

        if (!documentResults || !Array.isArray(documentResults)) {
            throw new Error('Missing or invalid document results');
        }

        // Verify all documents are accessible before proceeding
        logger.info('Verifying all documents are accessible before sending emails...');
        await verifyDocumentsAccessible(documentResults);

        const results = [];

        // 1. Send customer notification
        try {
            await sendCustomerNotification(shipmentData, documentResults);
            results.push({ type: 'customer', success: true });
        } catch (error) {
            logger.error('Failed to send customer notification:', error);
            results.push({ type: 'customer', success: false, error: error.message });
        }

        // 2. Send carrier notification (skip for Canpar courier shipments)
        const shipmentType = shipmentData.shipmentInfo?.shipmentType || 'freight';
        const carrierName = shipmentData.carrier || '';
        const isCanparCourier = shipmentType === 'courier' && carrierName.toLowerCase().includes('canpar');
        
        if (isCanparCourier) {
            logger.info('Skipping carrier notification for Canpar courier shipment - Canpar handles their own notifications');
            results.push({ type: 'carrier', success: true, skipped: true, reason: 'Canpar handles own notifications' });
        } else {
            try {
                await sendCarrierNotification(shipmentData, documentResults);
                results.push({ type: 'carrier', success: true });
            } catch (error) {
                logger.error('Failed to send carrier notification:', error);
                results.push({ type: 'carrier', success: false, error: error.message });
            }
        }

        // 3. Send internal notifications
        try {
            logger.info('Attempting to send internal notifications...');
            await sendInternalNotification(shipmentData, documentResults);
            logger.info('Internal notifications sent successfully');
            results.push({ type: 'internal', success: true });
        } catch (error) {
            logger.error('Failed to send internal notification:', error);
            results.push({ type: 'internal', success: false, error: error.message });
        }

        logger.info('CreateShipmentX notifications completed (internal):', {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        });

        return {
            success: true,
            message: 'CreateShipmentX notifications completed',
            results
        };

    } catch (error) {
        logger.error('Error in sendCreateShipmentXNotificationsInternal:', error);
        throw error;
    }
}

module.exports = {
    sendCreateShipmentXNotifications,
    sendCreateShipmentXNotificationsInternal
}; 