const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const { sendEmail, sendNotificationEmail } = require('../../email/sendgridService');
const { getFirestore } = require('firebase-admin/firestore');
const { areNotificationsEnabled } = require('../functions/src/admin-system-settings');

const db = admin.firestore();

// Add SendGrid direct import for working email sending
const sgMail = require('@sendgrid/mail');

// Global email configuration - centralized for easy updates
const SEND_FROM_EMAIL = 'noreply@integratedcarriers.com';
const SEND_FROM_NAME = 'Integrated Carriers';

// Get SendGrid API key from environment variables
const sendgridApiKey = process.env.SENDGRID_API_KEY;
if (sendgridApiKey) {
    sgMail.setApiKey(sendgridApiKey);
}

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

/**
 * Sends all QuickShip notifications including customer confirmations and carrier notifications
 * @param {Object} params - Notification parameters
 * @param {Object} params.shipmentData - Complete shipment data
 * @param {Object} params.carrierDetails - Carrier contact information
 * @param {Array} params.documentResults - Generated document results
 */
async function sendQuickShipNotifications({ shipmentData, carrierDetails, documentResults }) {
    try {
        // CRITICAL: Check if notifications are globally enabled
        const notificationsEnabled = await areNotificationsEnabled();
        if (!notificationsEnabled) {
            logger.info('QuickShip notifications skipped - global notifications disabled', {
                shipmentId: shipmentData.shipmentID || shipmentData.id
            });
            return {
                success: true,
                message: 'Notifications disabled globally',
                results: []
            };
        }
        
        logger.info('Starting QuickShip notifications process', {
            shipmentId: shipmentData.shipmentID || shipmentData.id,
            hasCarrierDetails: !!carrierDetails,
            documentCount: documentResults?.length || 0
        });

        // Validate input data
        if (!shipmentData || !shipmentData.shipmentID) {
            throw new Error('Invalid shipment data provided');
        }

        // Add initial delay to handle race conditions with document generation
        // This gives Firebase Storage time to make documents fully accessible
        logger.info('Adding 2-second delay to ensure document availability...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Debug: Log all document results for troubleshooting
        logger.info('DEBUG: All document results received:', JSON.stringify(documentResults, null, 2));

        const notifications = [];

        // 1. Send customer notification
        try {
            // Enhanced customer email lookup with multiple fallback options
            const customerEmail = shipmentData.shipTo?.email || 
                                 shipmentData.shipTo?.contactEmail || 
                                 shipmentData.customerEmail || 
                                 shipmentData.shipFrom?.email ||
                                 shipmentData.shipFrom?.contactEmail;
            
            logger.info('DEBUG: Main customer email lookup for notification queuing:', {
                shipToEmail: shipmentData.shipTo?.email,
                shipToContactEmail: shipmentData.shipTo?.contactEmail,
                customerEmail: shipmentData.customerEmail,
                shipFromEmail: shipmentData.shipFrom?.email,
                shipFromContactEmail: shipmentData.shipFrom?.contactEmail,
                finalCustomerEmail: customerEmail
            });
            
            if (customerEmail) {
                notifications.push(sendCustomerNotification(shipmentData, documentResults));
                logger.info('Queued customer notification for:', customerEmail);
            } else {
                logger.warn('No customer email found for notification queuing, skipping customer notification', {
                    availableShipToFields: Object.keys(shipmentData.shipTo || {}),
                    availableShipFromFields: Object.keys(shipmentData.shipFrom || {}),
                    shipmentId: shipmentData.shipmentID
                });
            }
        } catch (error) {
            logger.error('Error queuing customer notification:', error);
        }

        // 2. Send carrier notification
        try {
            // Handle both old and new carrier email structures
            let carrierEmail = null;
            
            if (carrierDetails?.emailContacts && shipmentData.creationMethod === 'quickship') {
                // NEW STRUCTURE: Terminal-based email management (QuickShip carriers only)
                logger.info('Extracting carrier email from new terminal-based structure');
                
                // Get the selected terminal ID from shipment data
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
                    logger.info('Using terminal for carrier notification email:', selectedTerminal.name);
                    
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
                    
                    logger.info('Extracted carrier email from terminal:', {
                        terminal: selectedTerminal.name,
                        email: carrierEmail,
                        totalEmails: allEmails.length
                    });
                }
            } else {
                // OLD STRUCTURE: Legacy contactEmail field (API carriers and fallback)
                logger.info('Using legacy carrier email structure');
                carrierEmail = carrierDetails?.contactEmail;
            }
            
            // If still no email found, try other legacy fallbacks
            if (!carrierEmail) {
                carrierEmail = carrierDetails?.email || carrierDetails?.billingEmail;
            }
            
            if (carrierEmail) {
                // Update carrierDetails to include the extracted email for compatibility
                const updatedCarrierDetails = {
                    ...carrierDetails,
                    contactEmail: carrierEmail
                };
                
                notifications.push(sendCarrierNotification(shipmentData, updatedCarrierDetails, documentResults));
                logger.info('Queued carrier notification for:', carrierEmail);
            } else {
                logger.warn('No carrier email found in either new or legacy structure, skipping carrier notification', {
                    hasEmailContacts: !!carrierDetails?.emailContacts,
                    hasContactEmail: !!carrierDetails?.contactEmail,
                    hasEmail: !!carrierDetails?.email,
                    creationMethod: shipmentData.creationMethod,
                    selectedCarrierContactId: shipmentData.selectedCarrierContactId
                });
            }
        } catch (error) {
            logger.error('Error queuing carrier notification:', error);
        }

        // 3. Check for internal notifications
        try {
            const hasInternalSubscribers = await checkInternalNotificationSubscribers(shipmentData.companyID);
            if (hasInternalSubscribers) {
                notifications.push(sendInternalNotification(shipmentData, documentResults));
                logger.info('Queued internal notifications');
            } else {
                logger.info('No internal notification subscribers found, skipping internal notifications');
            }
        } catch (error) {
            logger.error('Error checking internal notification subscribers:', error);
        }

        // Send all notifications in parallel
        const results = await Promise.allSettled(notifications);
        
        // Log results
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                logger.error(`Notification ${index + 1} failed:`, result.reason);
            }
        });

        logger.info(`QuickShip notifications completed: ${successful} successful, ${failed} failed`);
        
        return {
            success: true,
            results: {
                total: notifications.length,
                successful,
                failed
            }
        };

    } catch (error) {
        logger.error('Error in QuickShip notifications process:', error);
        throw error;
    }
}

/**
 * Sends notification to the customer
 */
async function sendCustomerNotification(shipmentData, documentResults) {
    try {
        // Verify all documents are accessible before proceeding
        logger.info('Verifying all documents are accessible before sending customer email...');
        await verifyDocumentsAccessible(documentResults);
        
        // Enhanced customer email lookup with multiple fallback options
        const customerEmail = shipmentData.shipTo?.email || 
                             shipmentData.shipTo?.contactEmail || 
                             shipmentData.customerEmail || 
                             shipmentData.shipFrom?.email ||
                             shipmentData.shipFrom?.contactEmail;
        
        logger.info('DEBUG: Customer email lookup details:', {
            shipToEmail: shipmentData.shipTo?.email,
            shipToContactEmail: shipmentData.shipTo?.contactEmail,
            customerEmail: shipmentData.customerEmail,
            shipFromEmail: shipmentData.shipFrom?.email,
            shipFromContactEmail: shipmentData.shipFrom?.contactEmail,
            finalCustomerEmail: customerEmail,
            shipToFields: Object.keys(shipmentData.shipTo || {}),
            shipFromFields: Object.keys(shipmentData.shipFrom || {})
        });
        
        if (!customerEmail) {
            logger.warn('No customer email found after enhanced lookup, skipping customer notification', {
                availableShipToFields: Object.keys(shipmentData.shipTo || {}),
                availableShipFromFields: Object.keys(shipmentData.shipFrom || {}),
                hasCustomerEmailField: !!shipmentData.customerEmail
            });
            return;
        }

        // Debug: Log all document results for troubleshooting
        logger.info('DEBUG: All document results received:', JSON.stringify(documentResults, null, 2));
        
        // Prepare attachments (BOL and Carrier Confirmation documents)
        const attachments = [];
        
        // Add BOL document ONLY for customer confirmation (Optimization 1)
        logger.info('DEBUG: Searching for BOL document for customer email...');
        const bolDocument = documentResults.find(doc => {
            const fileName = doc.data?.fileName || doc.data?.filename; // Check both field names
            logger.info('DEBUG: Checking document:', {
                success: doc.success,
                hasData: !!doc.data,
                fileName: fileName,
                includesBOL: fileName?.includes('BOL')
            });
            return doc.success && fileName?.includes('BOL');
        });
        
        logger.info('DEBUG: BOL document search result for customer:', bolDocument);
        
        if (bolDocument?.data?.downloadUrl) {
            // Download and attach BOL document with retry mechanism
            try {
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
                } else {
                    logger.error('Failed to download BOL document after retries');
                }
            } catch (error) {
                logger.error('Error downloading BOL document:', error);
            }
        } else {
            logger.warn('No BOL document found for customer attachment');
        }
        
        // NOTE: Customer email gets ONLY BOL attachment (per optimization requirement)

        // Calculate package totals with proper handling
        const totalPieces = shipmentData.packages?.reduce((total, pkg) => {
            const quantity = parseInt(pkg.quantity || pkg.packagingQuantity || 1);
            return total + quantity;
        }, 0) || 0;
        
        const totalWeight = shipmentData.packages?.reduce((total, pkg) => {
            const weight = parseFloat(pkg.weight || 0);
            return total + weight;
        }, 0) || 0;

        // Use centralized email configuration
        const emailContent = {
            to: customerEmail,
            from: {
                email: SEND_FROM_EMAIL,
                name: SEND_FROM_NAME
            },
            subject: `Shipment Confirmation: ${shipmentData.shipmentID}`,
            html: generateQuickShipCustomerHTML(shipmentData, totalPieces, totalWeight),
            text: generateQuickShipCustomerText(shipmentData, totalPieces, totalWeight),
            attachments: attachments
        };

        logger.info('Sending customer email with attachments', {
            to: customerEmail,
            from: emailContent.from.email,
            subject: emailContent.subject,
            attachmentCount: attachments.length
        });

        await sgMail.send(emailContent);
        logger.info('Customer notification sent successfully to:', customerEmail, {
            attachmentCount: attachments.length,
            shipmentId: shipmentData.shipmentID,
            method: 'direct-sendgrid'
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
        
        // Verify all documents are accessible before proceeding
        logger.info('Verifying all documents are accessible before sending email...');
        await verifyDocumentsAccessible(documentResults);
        
        // Debug: Log all document results for troubleshooting
        logger.info('DEBUG: Carrier notification - All document results received:', JSON.stringify(documentResults, null, 2));
        
        // Prepare attachments (BOL + Carrier Confirmation documents for carrier)
        const attachments = [];
        
        // Add BOL document for carrier email (Optimization 1)
        logger.info('DEBUG: Searching for BOL document for carrier email...');
        const bolDocument = documentResults.find(doc => {
            const fileName = doc.data?.fileName || doc.data?.filename;
            return doc.success && fileName?.includes('BOL');
        });
        
        if (bolDocument?.data?.downloadUrl) {
            try {
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
                } else {
                    logger.error('Failed to download BOL document for carrier email after retries');
                }
            } catch (error) {
                logger.error('Error downloading BOL document for carrier email:', error);
            }
        } else {
            logger.warn('No BOL document found for carrier attachment');
        }
        
        // Add Carrier Confirmation document
        logger.info('DEBUG: Searching for Carrier Confirmation document for carrier email...');
        const confirmationDocument = documentResults.find(doc => {
            const fileName = doc.data?.fileName || doc.data?.filename; // Check both field names
            const docType = doc.data?.docType;
            const documentType = doc.data?.documentType;
            
            logger.info('DEBUG: Checking document for carrier confirmation:', {
                success: doc.success,
                hasData: !!doc.data,
                fileName: fileName,
                docType: docType,
                documentType: documentType,
                includesCarrierConfirmation: fileName?.includes('CARRIER-CONFIRMATION'),
                includesCarrierConf: fileName?.includes('CARRIER'),
                docTypeIs7: docType === 7,
                documentTypeIsCarrier: documentType === 'carrier_confirmation'
            });
            
            return doc.success && (
                fileName?.includes('CARRIER-CONFIRMATION') ||
                fileName?.includes('CARRIER') ||
                docType === 7 ||
                documentType === 'carrier_confirmation'
            );
        });
        
        logger.info('DEBUG: Carrier Confirmation document search result for carrier:', {
            found: !!confirmationDocument,
            document: confirmationDocument ? {
                success: confirmationDocument.success,
                fileName: confirmationDocument.data?.fileName || confirmationDocument.data?.filename,
                downloadUrl: confirmationDocument.data?.downloadUrl ? 'Present' : 'Missing',
                docType: confirmationDocument.data?.docType,
                documentType: confirmationDocument.data?.documentType
            } : 'Not found'
        });
        
        if (confirmationDocument?.data?.downloadUrl) {
            // Download and attach Carrier Confirmation document with retry mechanism
            try {
                const carrierConfirmationFileName = confirmationDocument.data.fileName || confirmationDocument.data.filename;
                const downloadSuccess = await downloadDocumentWithRetry(
                    confirmationDocument.data.downloadUrl, 
                    carrierConfirmationFileName, 
                    attachments,
                    'Carrier Confirmation (Carrier Email)'
                );
                
                if (downloadSuccess) {
                    logger.info('Successfully attached Carrier Confirmation document to carrier email:', {
                        filename: carrierConfirmationFileName
                    });
                } else {
                    logger.error('Failed to download Carrier Confirmation document for carrier email after retries');
                }
            } catch (error) {
                logger.error('Error downloading Carrier Confirmation document for carrier email:', error);
            }
        } else {
            logger.warn('No carrier confirmation document found for attachment:', {
                confirmationDocumentExists: !!confirmationDocument,
                confirmationDocumentData: confirmationDocument?.data,
                totalDocuments: documentResults.length
            });
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

        // Use centralized email configuration
        const carrierEmailContent = {
            to: carrierDetails.contactEmail,
            from: {
                email: SEND_FROM_EMAIL,
                name: SEND_FROM_NAME
            },
            subject: `Carrier Confirmation - Order ${shipmentData.shipmentID}`,
            html: generateQuickShipCarrierHTML(shipmentData, carrierDetails, totalPieces, totalWeight),
            text: generateQuickShipCarrierText(shipmentData, carrierDetails, totalPieces, totalWeight),
            attachments: attachments
        };

        logger.info('Sending carrier email with attachments', {
            to: carrierDetails.contactEmail,
            from: carrierEmailContent.from.email,
            subject: carrierEmailContent.subject,
            attachmentCount: attachments.length
        });

        await sgMail.send(carrierEmailContent);
        logger.info('Carrier notification sent successfully to:', carrierDetails.contactEmail, {
            attachmentCount: attachments.length,
            shipmentId: shipmentData.shipmentID,
            carrierName: carrierDetails.name,
            method: 'direct-sendgrid'
        });
        
    } catch (error) {
        logger.error('Error sending carrier notification:', error);
        throw error;
    }
}

/**
 * Checks if there are internal notification subscribers for a company
 */
async function checkInternalNotificationSubscribers(companyID) {
    try {
        // Get company notification preferences by querying for the companyID field
        const companyQuery = await db.collection('companies')
            .where('companyID', '==', companyID)
            .limit(1)
            .get();
            
        if (companyQuery.empty) {
            logger.warn('Company not found for internal notifications check', {
                companyID: companyID
            });
            return false;
        }
        
        const companyDoc = companyQuery.docs[0];
        const companyData = companyDoc.data();
        const notificationEmails = companyData.notificationSubscriptions?.shipment_created || [];
        
        return notificationEmails.length > 0;
        
    } catch (error) {
        logger.error('Error checking internal notification subscribers:', error);
        return false;
    }
}

/**
 * Sends internal company notifications
 */
async function sendInternalNotification(shipmentData, documentResults) {
    try {
        // Get company notification preferences by querying for the companyID field
        const companyQuery = await db.collection('companies')
            .where('companyID', '==', shipmentData.companyID)
            .limit(1)
            .get();
            
        if (companyQuery.empty) {
            logger.warn('Company not found for internal notifications', {
                companyID: shipmentData.companyID
            });
            return;
        }
        
        const companyDoc = companyQuery.docs[0];
        const companyData = companyDoc.data();
        const notificationEmails = companyData.notificationSubscriptions?.shipment_created || [];
        
        if (notificationEmails.length === 0) {
            logger.info('No internal notification subscribers found', {
                companyID: shipmentData.companyID
            });
            return;
        }
        
        logger.info(`Found ${notificationEmails.length} internal notification subscribers`, {
            companyID: shipmentData.companyID,
            subscribers: notificationEmails
        });
        
        // Send to each subscriber
        const internalPromises = notificationEmails.map(async (email) => {
            try {
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
            } catch (emailError) {
                logger.error(`Failed to send internal notification to ${email}:`, emailError);
                // Return resolved promise to prevent Promise.all from failing
                return Promise.resolve({ success: false, email, error: emailError.message });
            }
        });
        
        const results = await Promise.allSettled(internalPromises);
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        logger.info(`Internal notifications sent to ${successCount}/${notificationEmails.length} recipients`);
        
    } catch (error) {
        logger.error('Error sending internal notifications:', error);
        throw error;
    }
}

/**
 * Verifies that all document URLs are accessible before proceeding with email sending
 * Uses exponential backoff polling instead of arbitrary timeouts
 */
async function verifyDocumentsAccessible(documentResults, maxAttempts = 15, initialDelay = 1000) {
    const documentsToVerify = documentResults.filter(doc => 
        doc.success && doc.data?.downloadUrl
    );
    
    if (documentsToVerify.length === 0) {
        logger.info('No documents to verify, proceeding with email');
        return;
    }
    
    logger.info(`Verifying ${documentsToVerify.length} documents are accessible...`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const delay = initialDelay * Math.pow(2, attempt - 1); // Enhanced exponential backoff
        
        try {
            // Check all documents in parallel
            const verificationPromises = documentsToVerify.map(async (doc) => {
                const fileName = doc.data.fileName || doc.data.filename;
                
                try {
                    logger.info(`Verifying document accessibility (attempt ${attempt}/${maxAttempts}): ${fileName}`);
                    
                    const response = await fetch(doc.data.downloadUrl, {
                        method: 'HEAD', // HEAD request is faster than GET
                        timeout: 5000 // 5 second timeout per request
                    });
                    
                    if (response.ok) {
                        logger.info(`✓ Document verified accessible: ${fileName}`);
                        return { success: true, fileName, status: response.status };
                    } else {
                        logger.warn(`✗ Document not yet accessible: ${fileName} (HTTP ${response.status})`);
                        return { success: false, fileName, status: response.status, error: `HTTP ${response.status}` };
                    }
                    
                } catch (error) {
                    logger.warn(`✗ Document verification failed: ${fileName} - ${error.message}`);
                    return { success: false, fileName, error: error.message };
                }
            });
            
            const results = await Promise.all(verificationPromises);
            const successfulCount = results.filter(r => r.success).length;
            const totalCount = results.length;
            
            logger.info(`Document verification attempt ${attempt}: ${successfulCount}/${totalCount} documents accessible`);
            
            // If all documents are accessible, we're done
            if (successfulCount === totalCount) {
                logger.info('✅ All documents verified accessible, proceeding with email');
                return;
            }
            
            // If this isn't the last attempt, wait before retrying
            if (attempt < maxAttempts) {
                logger.info(`Waiting ${delay}ms before next verification attempt...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
        } catch (error) {
            logger.error(`Error during document verification attempt ${attempt}:`, error);
            
            if (attempt < maxAttempts) {
                logger.info(`Waiting ${delay}ms before retry due to error...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // If we get here, some documents may still not be accessible
    logger.warn(`⚠️ Document verification completed after ${maxAttempts} attempts. Some documents may not be accessible yet, but proceeding with email to avoid indefinite delays.`);
}

/**
 * Helper function to download documents with retry mechanism for race condition handling
 * Addresses timing issues where Firebase Storage URLs might not be immediately accessible
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
        return new Date(dateString).toLocaleDateString('en-US', {
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
 * Generate HTML content for customer email (matching existing template design)
 */
function generateQuickShipCustomerHTML(shipmentData, totalPieces, totalWeight) {
    // Format addresses consistently
    const shipFromFormatted = formatAddress(shipmentData.shipFrom);
    const shipToFormatted = formatAddress(shipmentData.shipTo);
    
    // Calculate rate breakdown for display
    const rateBreakdown = shipmentData.manualRates?.map(rate => ({
        description: rate.chargeName || rate.code || 'Freight Charge',
        amount: parseFloat(rate.charge || 0).toFixed(2),
        currency: rate.chargeCurrency || 'CAD'
    })) || [];

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                <h1 style="margin: 0; font-size: 24px;">Shipment Confirmation</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your shipment ${shipmentData.shipmentID} has been successfully booked</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                <!-- Shipment Summary -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Shipment Summary</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Shipment #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${shipmentData.shipmentID}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Company ID:</strong></td><td style="padding: 8px 0;">${shipmentData.companyID || 'N/A'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Created:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleDateString('en-US', { timeZone: 'America/Toronto' })}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td><td style="padding: 8px 0; color: #1c277d; font-weight: bold; text-transform: capitalize;">Pending</td></tr>
                    </table>
                </div>

                <!-- Shipment Information -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Shipment Information</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${shipmentData.shipmentInfo?.shipmentType || 'freight'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Reference #:</strong></td><td style="padding: 8px 0;">${shipmentData.shipmentInfo?.shipperReferenceNumber || shipmentData.shipmentID}${(shipmentData.shipmentInfo?.referenceNumbers && shipmentData.shipmentInfo.referenceNumbers.length > 0) ? `<br>${shipmentData.shipmentInfo.referenceNumbers.filter(ref => ref).join('<br>')}` : ''}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Bill Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${shipmentData.shipmentInfo?.billType || 'third_party'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Ship Date:</strong></td><td style="padding: 8px 0;">${formatDate(shipmentData.shipmentInfo?.shipmentDate)}</td></tr>
                        ${shipmentData.shipmentInfo?.carrierTrackingNumber ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Tracking #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${shipmentData.shipmentInfo.carrierTrackingNumber}</td></tr>` : ''}
                    </table>
                </div>

                <!-- Carrier & Service -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Carrier & Service</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Carrier:</strong></td><td style="padding: 8px 0;">${shipmentData.carrier || 'Unknown'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Service:</strong></td><td style="padding: 8px 0;">QuickShip Manual Entry</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Tracking #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${shipmentData.shipmentInfo?.carrierTrackingNumber || shipmentData.trackingNumber || shipmentData.shipmentID}</td></tr>
                    </table>
                </div>

                <!-- Package Information -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Package Information</h2>
                    <p style="margin: 0 0 15px 0; color: #666;"><strong>Total: ${totalPieces} package${totalPieces > 1 ? 's' : ''}, ${totalWeight.toFixed(1)} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}</strong></p>
                    ${shipmentData.packages?.slice(0, 3).map((pkg, index) => `
                        <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                            <strong>Package ${index + 1}:</strong> ${pkg.itemDescription}<br>
                            <span style="color: #666;">
                                Qty: ${pkg.packagingQuantity}, 
                                Weight: ${pkg.weight} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}, 
                                Dimensions: ${pkg.length}" × ${pkg.width}" × ${pkg.height}" ${shipmentData.unitSystem === 'metric' ? 'cm' : 'in'},
                                Type: ${getPackagingTypeName(pkg.packagingType)}
                                ${pkg.freightClass ? `<br>Freight Class: ${pkg.freightClass}` : ''}
                            </span>
                        </div>
                    `).join('')}
                    ${(shipmentData.packages?.length || 0) > 3 ? `<p style="margin: 10px 0 0 0; color: #666; font-style: italic;">...and ${(shipmentData.packages?.length || 0) - 3} more package${((shipmentData.packages?.length || 0) - 3) > 1 ? 's' : ''}</p>` : ''}
                </div>

                <!-- Rate Information -->
                ${rateBreakdown.length > 0 ? `
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Rate Details</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        ${rateBreakdown.map(rate => `<tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>${rate.description}:</strong></td><td style="padding: 8px 0;">$${rate.amount} ${rate.currency}</td></tr>`).join('')}
                        <tr style="border-top: 2px solid #1c277d;"><td style="padding: 12px 0 8px 0; color: #1c277d; font-weight: bold;"><strong>Total:</strong></td><td style="padding: 12px 0 8px 0; font-weight: bold; font-size: 18px; color: #1c277d;">$${shipmentData.totalCharges?.toFixed(2) || '0.00'} ${shipmentData.currency || 'CAD'}</td></tr>
                    </table>
                </div>
                ` : ''}

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

                <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; border-radius: 0; margin-bottom: 20px;">
                    <h3 style="color: #065f46; margin: 0 0 10px 0; font-size: 16px;">✅ Booking Confirmed</h3>
                    <p style="color: #047857; margin: 0; font-size: 14px;">Your QuickShip booking has been processed successfully! You should receive your BOL document as an attachment to this email.</p>
                </div>

                ${shipmentData.shipmentID ? `
                <div style="background: #f5f5f5; padding: 20px; border-radius: 0; text-align: center; margin-bottom: 20px;">
                    <h3 style="color: #1c277d; margin: 0 0 10px 0;">Track Your Shipment</h3>
                    <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold; color: #1c277d;">${shipmentData.shipmentID}</p>
                    <a href="https://solushipx.web.app/tracking/${shipmentData.shipmentID}" 
                       style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 0; display: inline-block; border: 2px solid #000;">
                       Track Shipment
                    </a>
                </div>
                ` : ''}

                <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                    <p style="margin: 0;">Need help? Contact us at <a href="mailto:support@integratedcarriers.com" style="color: #1c277d;">support@integratedcarriers.com</a></p>
                    <p style="margin: 10px 0 0 0; font-size: 14px;">© 2025 SolushipX. All rights reserved.</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate text content for customer email (matching new design)
 */
function generateQuickShipCustomerText(shipmentData, totalPieces, totalWeight) {
    // Format rate breakdown for text display
    const rateBreakdown = shipmentData.manualRates?.map(rate => {
        const description = rate.chargeName || rate.code || 'Freight Charge';
        const amount = parseFloat(rate.charge || 0).toFixed(2);
        const currency = rate.chargeCurrency || 'CAD';
        return `- ${description}: $${amount} ${currency}`;
    }).join('\n') || '';

    return `
Shipment Confirmation

Your shipment ${shipmentData.shipmentID} has been successfully booked.

SHIPMENT SUMMARY
- Shipment #: ${shipmentData.shipmentID}
- Company ID: ${shipmentData.companyID || 'N/A'}
- Created: ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Toronto' })}
- Status: Pending

SHIPMENT INFORMATION
- Type: ${shipmentData.shipmentInfo?.shipmentType || 'freight'}
- Reference #: ${shipmentData.shipmentInfo?.shipperReferenceNumber || shipmentData.shipmentID}${(shipmentData.shipmentInfo?.referenceNumbers && shipmentData.shipmentInfo.referenceNumbers.length > 0) ? `\n  ${shipmentData.shipmentInfo.referenceNumbers.filter(ref => ref).join('\n  ')}` : ''}
- Bill Type: ${shipmentData.shipmentInfo?.billType || 'third_party'}
- Ship Date: ${formatDate(shipmentData.shipmentInfo?.shipmentDate)}
${shipmentData.shipmentInfo?.carrierTrackingNumber ? `- Tracking #: ${shipmentData.shipmentInfo.carrierTrackingNumber}` : ''}

CARRIER & SERVICE
- Carrier: ${shipmentData.carrier || 'Unknown'}
- Service: QuickShip Manual Entry
- Tracking #: ${shipmentData.shipmentInfo?.carrierTrackingNumber || shipmentData.trackingNumber || shipmentData.shipmentID}

PACKAGE INFORMATION
Total: ${totalPieces} package${totalPieces > 1 ? 's' : ''}, ${totalWeight.toFixed(1)} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}

${shipmentData.packages?.slice(0, 3).map((pkg, index) => 
    `Package ${index + 1}: ${pkg.itemDescription}\nQty: ${pkg.packagingQuantity}, Weight: ${pkg.weight} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}, Dimensions: ${pkg.length}" × ${pkg.width}" × ${pkg.height}" ${shipmentData.unitSystem === 'metric' ? 'cm' : 'in'}, Type: ${getPackagingTypeName(pkg.packagingType)}${pkg.freightClass ? `\nFreight Class: ${pkg.freightClass}` : ''}`
).join('\n\n') || ''}${(shipmentData.packages?.length || 0) > 3 ? `\n\n...and ${(shipmentData.packages?.length || 0) - 3} more package${((shipmentData.packages?.length || 0) - 3) > 1 ? 's' : ''}` : ''}

${rateBreakdown ? `RATE DETAILS\n${rateBreakdown}\nTotal: $${shipmentData.totalCharges?.toFixed(2) || '0.00'} ${shipmentData.currency || 'CAD'}` : ''}

ADDRESSES
Ship From:
${shipmentData.shipFrom?.companyName ? `${shipmentData.shipFrom.companyName}\n` : ''}${shipmentData.shipFrom?.firstName || shipmentData.shipFrom?.lastName ? `${shipmentData.shipFrom.firstName || ''} ${shipmentData.shipFrom.lastName || ''}<br>` : ''}
${shipmentData.shipFrom?.street ? `${shipmentData.shipFrom.street}\n` : ''}${shipmentData.shipFrom?.street2 ? `${shipmentData.shipFrom.street2}\n` : ''}${shipmentData.shipFrom ? `${shipmentData.shipFrom.city}, ${shipmentData.shipFrom.state} ${shipmentData.shipFrom.postalCode}\n` : ''}${shipmentData.shipFrom?.country ? shipmentData.shipFrom.country : ''}${shipmentData.shipFrom?.phone ? `\nPhone: ${shipmentData.shipFrom.phone}` : ''}

Ship To:
${shipmentData.shipTo?.companyName ? `${shipmentData.shipTo.companyName}\n` : ''}${shipmentData.shipTo?.firstName || shipmentData.shipTo?.lastName ? `${shipmentData.shipTo.firstName || ''} ${shipmentData.shipTo.lastName || ''}<br>` : ''}
${shipmentData.shipTo?.street ? `${shipmentData.shipTo.street}\n` : ''}${shipmentData.shipTo?.street2 ? `${shipmentData.shipTo.street2}\n` : ''}${shipmentData.shipTo ? `${shipmentData.shipTo.city}, ${shipmentData.shipTo.state} ${shipmentData.shipTo.postalCode}\n` : ''}${shipmentData.shipTo?.country ? shipmentData.shipTo.country : ''}${shipmentData.shipTo?.phone ? `\nPhone: ${shipmentData.shipTo.phone}` : ''}

✅ BOOKING CONFIRMED
Your QuickShip booking has been processed successfully! You should receive your BOL document as an attachment to this email.

${shipmentData.shipmentID ? `Track your shipment: https://solushipx.web.app/tracking/${shipmentData.shipmentID}` : ''}

Need help? Contact us at support@integratedcarriers.com
© 2025 SolushipX. All rights reserved.
    `;
}

/**
 * Generate HTML content for carrier email (matching existing template design)
 */
function generateQuickShipCarrierHTML(shipmentData, carrierDetails, totalPieces, totalWeight) {
    // Format addresses consistently
    const shipFromFormatted = formatAddress(shipmentData.shipFrom);
    const shipToFormatted = formatAddress(shipmentData.shipTo);
    
    // Calculate rate breakdown for display (carriers need this for billing/reconciliation)
    const rateBreakdown = shipmentData.manualRates?.map(rate => ({
        description: rate.chargeName || rate.code || 'Freight Charge',
        amount: parseFloat(rate.charge || 0).toFixed(2),
        currency: rate.chargeCurrency || 'CAD'
    })) || [];

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                <h1 style="margin: 0; font-size: 24px;">Carrier Confirmation</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">New pickup request for order ${shipmentData.shipmentID}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                <!-- Pickup Assignment Summary -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Pickup Assignment</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Order #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${shipmentData.shipmentID}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Assigned Carrier:</strong></td><td style="padding: 8px 0; font-weight: bold; color: #1c277d;">${carrierDetails.name || shipmentData.carrier || 'Unknown'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Created:</strong></td><td style="padding: 8px 0;">${new Date().toLocaleDateString('en-US', { timeZone: 'America/Toronto' })}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td><td style="padding: 8px 0; color: #1c277d; font-weight: bold;">Awaiting Pickup</td></tr>
                    </table>
                </div>

                <!-- Shipment Information -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Shipment Information</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${shipmentData.shipmentInfo?.shipmentType || 'freight'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Reference #:</strong></td><td style="padding: 8px 0;">${shipmentData.shipmentInfo?.shipperReferenceNumber || shipmentData.shipmentID}${(shipmentData.shipmentInfo?.referenceNumbers && shipmentData.shipmentInfo.referenceNumbers.length > 0) ? `<br>${shipmentData.shipmentInfo.referenceNumbers.filter(ref => ref).join('<br>')}` : ''}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Bill Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${getBillTypeLabel(shipmentData.shipmentInfo?.billType || 'third_party')}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Ship Date:</strong></td><td style="padding: 8px 0;">${formatDate(shipmentData.shipmentInfo?.shipmentDate)}</td></tr>
                        ${shipmentData.shipmentInfo?.carrierTrackingNumber ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Tracking #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${shipmentData.shipmentInfo.carrierTrackingNumber}</td></tr>` : ''}
                    </table>
                </div>

                <!-- Carrier Contact Information -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Carrier Contact Information</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Carrier:</strong></td><td style="padding: 8px 0;">${carrierDetails.name || shipmentData.carrier || 'Unknown'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Contact Person:</strong></td><td style="padding: 8px 0;">${carrierDetails.contactName || 'N/A'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Email:</strong></td><td style="padding: 8px 0;">${carrierDetails.contactEmail || 'N/A'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Phone:</strong></td><td style="padding: 8px 0;">${carrierDetails.contactPhone || 'N/A'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Service:</strong></td><td style="padding: 8px 0;">${getServiceName(shipmentData)}</td></tr>
                    </table>
                </div>

                <!-- Package Information -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Package Information</h2>
                    <p style="margin: 0 0 15px 0; color: #666;"><strong>Total: ${totalPieces} package${totalPieces > 1 ? 's' : ''}, ${totalWeight.toFixed(1)} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}</strong></p>
                    ${shipmentData.packages?.slice(0, 3).map((pkg, index) => `
                        <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                            <strong>Package ${index + 1}:</strong> ${pkg.itemDescription}<br>
                            <span style="color: #666;">
                                Qty: ${pkg.packagingQuantity}, 
                                Weight: ${pkg.weight} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}, 
                                Dimensions: ${pkg.length}" × ${pkg.width}" × ${pkg.height}" ${shipmentData.unitSystem === 'metric' ? 'cm' : 'in'},
                                Type: ${getPackagingTypeName(pkg.packagingType)}
                                ${pkg.freightClass ? `<br>Freight Class: ${pkg.freightClass}` : ''}
                            </span>
                        </div>
                    `).join('')}
                    ${(shipmentData.packages?.length || 0) > 3 ? `<p style="margin: 10px 0 0 0; color: #666; font-style: italic;">...and ${(shipmentData.packages?.length || 0) - 3} more package${((shipmentData.packages?.length || 0) - 3) > 1 ? 's' : ''}</p>` : ''}
                </div>

                <!-- Rate Information -->
                ${rateBreakdown.length > 0 ? `
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Rate Information</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        ${rateBreakdown.map(rate => `<tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>${rate.description}:</strong></td><td style="padding: 8px 0;">$${rate.amount} ${rate.currency}</td></tr>`).join('')}
                        <tr style="border-top: 2px solid #1c277d;"><td style="padding: 12px 0 8px 0; color: #1c277d; font-weight: bold;"><strong>Total:</strong></td><td style="padding: 12px 0 8px 0; font-weight: bold; font-size: 18px; color: #1c277d;">$${shipmentData.totalCharges?.toFixed(2) || '0.00'} ${shipmentData.currency || 'CAD'}</td></tr>
                    </table>
                </div>
                ` : ''}

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
                                ${shipmentData.shipFrom?.email ? `<br><strong>Email:</strong> ${shipmentData.shipFrom.email}` : ''}
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
                                ${shipmentData.shipTo?.email ? `<br><strong>Email:</strong> ${shipmentData.shipTo.email}` : ''}
                            </p>
                        </div>
                    </div>
                </div>

                <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 0; margin-bottom: 20px;">
                    <h3 style="color: #1d4ed8; margin: 0 0 10px 0; font-size: 16px;">📦 Pickup Required</h3>
                    <p style="color: #1e40af; margin: 0; font-size: 14px;">Please coordinate pickup time with the shipper and confirm receipt of this assignment. You should receive the BOL and Carrier Confirmation documents as attachments to this email.</p>
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
                    <p style="margin: 10px 0 0 0; font-size: 14px;">© 2025 SolushipX. All rights reserved.</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate text content for carrier email (matching new design)
 */
function generateQuickShipCarrierText(shipmentData, carrierDetails, totalPieces, totalWeight) {
    // Format rate breakdown for text display
    const rateBreakdown = shipmentData.manualRates?.map(rate => {
        const description = rate.chargeName || rate.code || 'Freight Charge';
        const amount = parseFloat(rate.charge || 0).toFixed(2);
        const currency = rate.chargeCurrency || 'CAD';
        return `- ${description}: $${amount} ${currency}`;
    }).join('\n') || '';

    return `
Carrier Confirmation

New pickup request for order ${shipmentData.shipmentID}

ORDER DETAILS
- Order #: ${shipmentData.shipmentID}
- Assigned Carrier: ${carrierDetails.name || shipmentData.carrier || 'Unknown'}
- Created: ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Toronto' })}
- Status: Awaiting Pickup

SHIPMENT INFORMATION
- Type: ${shipmentData.shipmentInfo?.shipmentType || 'freight'}
- Reference #: ${shipmentData.shipmentInfo?.shipperReferenceNumber || shipmentData.shipmentID}${(shipmentData.shipmentInfo?.referenceNumbers && shipmentData.shipmentInfo.referenceNumbers.length > 0) ? `\n  ${shipmentData.shipmentInfo.referenceNumbers.filter(ref => ref).join('\n  ')}` : ''}
- Bill Type: ${getBillTypeLabel(shipmentData.shipmentInfo?.billType || 'third_party')}
- Ship Date: ${formatDate(shipmentData.shipmentInfo?.shipmentDate)}
${shipmentData.shipmentInfo?.carrierTrackingNumber ? `- Tracking #: ${shipmentData.shipmentInfo.carrierTrackingNumber}` : ''}

CARRIER CONTACT INFORMATION
- Carrier: ${carrierDetails.name || shipmentData.carrier || 'Unknown'}
- Contact Person: ${carrierDetails.contactName || 'N/A'}
- Email: ${carrierDetails.contactEmail || 'N/A'}
- Phone: ${carrierDetails.contactPhone || 'N/A'}
- Service: ${getServiceName(shipmentData)}

PACKAGE INFORMATION
Total: ${totalPieces} package${totalPieces > 1 ? 's' : ''}, ${totalWeight.toFixed(1)} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}

${shipmentData.packages?.slice(0, 3).map((pkg, index) => 
    `Package ${index + 1}: ${pkg.itemDescription}\nQty: ${pkg.packagingQuantity}, Weight: ${pkg.weight} ${shipmentData.unitSystem === 'metric' ? 'kg' : 'lbs'}, Dimensions: ${pkg.length}" × ${pkg.width}" × ${pkg.height}" ${shipmentData.unitSystem === 'metric' ? 'cm' : 'in'}, Type: ${getPackagingTypeName(pkg.packagingType)}${pkg.freightClass ? `\nFreight Class: ${pkg.freightClass}` : ''}`
).join('\n\n') || ''}${(shipmentData.packages?.length || 0) > 3 ? `\n\n...and ${(shipmentData.packages?.length || 0) - 3} more package${((shipmentData.packages?.length || 0) - 3) > 1 ? 's' : ''}` : ''}

${rateBreakdown ? `RATE INFORMATION\n${rateBreakdown}\nTotal: $${shipmentData.totalCharges?.toFixed(2) || '0.00'} ${shipmentData.currency || 'CAD'}` : ''}

PICKUP & DELIVERY ADDRESSES
📍 Pickup From:
${shipmentData.shipFrom?.companyName ? `${shipmentData.shipFrom.companyName}\n` : ''}${shipmentData.shipFrom?.firstName || shipmentData.shipFrom?.lastName ? `${shipmentData.shipFrom.firstName || ''} ${shipmentData.shipFrom.lastName || ''}\n` : ''}${shipmentData.shipFrom?.street ? `${shipmentData.shipFrom.street}\n` : ''}${shipmentData.shipFrom?.street2 ? `${shipmentData.shipFrom.street2}\n` : ''}${shipmentData.shipFrom ? `${shipmentData.shipFrom.city}, ${shipmentData.shipFrom.state} ${shipmentData.shipFrom.postalCode}\n` : ''}${shipmentData.shipFrom?.country ? shipmentData.shipFrom.country : ''}${shipmentData.shipFrom?.phone ? `\nPhone: ${shipmentData.shipFrom.phone}` : ''}${shipmentData.shipFrom?.email ? `\nEmail: ${shipmentData.shipFrom.email}` : ''}

🚚 Deliver To:
${shipmentData.shipTo?.companyName ? `${shipmentData.shipTo.companyName}\n` : ''}${shipmentData.shipTo?.firstName || shipmentData.shipTo?.lastName ? `${shipmentData.shipTo.firstName || ''} ${shipmentData.shipTo.lastName || ''}\n` : ''}${shipmentData.shipTo?.street ? `${shipmentData.shipTo.street}\n` : ''}${shipmentData.shipTo?.street2 ? `${shipmentData.shipTo.street2}\n` : ''}${shipmentData.shipTo ? `${shipmentData.shipTo.city}, ${shipmentData.shipTo.state} ${shipmentData.shipTo.postalCode}\n` : ''}${shipmentData.shipTo?.country ? shipmentData.shipTo.country : ''}${shipmentData.shipTo?.phone ? `\nPhone: ${shipmentData.shipTo.phone}` : ''}${shipmentData.shipTo?.email ? `\nEmail: ${shipmentData.shipTo.email}` : ''}

${shipmentData.shipmentInfo?.notes ? `SPECIAL INSTRUCTIONS\n${shipmentData.shipmentInfo.notes}\n\n` : ''}📦 PICKUP REQUIRED
Please coordinate pickup time with the shipper and confirm receipt of this assignment. You should receive the BOL and Carrier Confirmation documents as attachments to this email.

Questions? Contact us at support@integratedcarriers.com
© 2025 SolushipX. All rights reserved.
    `;
}

module.exports = {
    sendQuickShipNotifications
}; 