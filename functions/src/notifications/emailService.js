const { onDocumentWritten, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const { sendNotificationEmail } = require('../email/sendgridService');
const { sampleShipments, sampleUsers } = require('./sampleData');
const { areNotificationsEnabled } = require('../admin-system-settings');

const db = getFirestore();

/**
 * Cloud Function triggered when a shipment is created
 */
exports.onShipmentCreated = onDocumentWritten('shipments/{shipmentId}', async (event) => {
    // CRITICAL: Check if notifications are globally enabled
    const notificationsEnabled = await areNotificationsEnabled();
    if (!notificationsEnabled) {
        logger.info('Shipment creation notification skipped - global notifications disabled', {
            shipmentId: event.params.shipmentId
        });
        return;
    }

    const shipmentData = event.data?.after?.data();
    const previousData = event.data?.before?.data();

    // Only trigger when shipment is actually created (becomes bookable)
    if (!shipmentData) {
        return;
    }

    // Check if this is a booking notification (shipment just moved to pending status)
    const isBeingBooked = shipmentData.status === 'pending' && (!previousData || previousData.status !== 'pending');
    
    logger.info('onShipmentCreated: Shipment creation detected', {
        shipmentId: shipmentData.shipmentID || shipmentData.shipmentNumber,
        status: shipmentData.status,
        isBeingBooked,
        previousStatus: previousData?.status || 'none',
        creationMethod: shipmentData.creationMethod
    });

    // Only send notifications for newly booked shipments (status = pending)
    if (shipmentData.status !== 'pending') {
        return;
    }
    
    // Additional safety check: only send if the shipment has actually been successfully processed
    if (shipmentData.status !== 'booked') {
        logger.info(`Shipment ${shipmentData.shipmentNumber || shipmentData.shipmentID} is not booked yet (status: ${shipmentData.status}), skipping creation notification`);
        return;
    }
    
    // CRITICAL: Ensure we have the final shipment ID (not draft) before sending emails
    const currentShipmentId = shipmentData.shipmentID || shipmentData.readableShipmentID || shipmentData.shipmentNumber;
    
    // Check if this is a QuickShip booking
    const isQuickShip = shipmentData.bookingMethod === 'quickship_manual' || shipmentData.creationMethod === 'quickship';
    
    if (isQuickShip) {
        logger.info('QuickShip shipment detected - notifications handled directly by bookQuickShipment function to avoid race conditions', { 
            shipmentId: currentShipmentId 
        });
        
        // Skip QuickShip notifications here as they're handled directly by bookQuickShipment function
        // This prevents race conditions where emails are sent before documents are fully accessible
        
        // Continue with regular shipment creation notification processing below for internal notifications
    }

    // Regular shipment creation notification processing
    logger.info(`Processing shipment creation notification for ${currentShipmentId}`);

    // Get company ID and extract notification subscribers
    const companyId = shipmentData.companyID || shipmentData.companyId || shipmentData.userCompanyId;
    
    if (!companyId) {
        logger.error('No company ID found in shipment data', {
            shipmentId: currentShipmentId
        });
        return;
    }

    try {
        logger.info(`Sending shipment_created notification for company ${companyId}`);
        
        // Import enhanced status display function
        const { getEnhancedStatusDisplay } = require('../email/sendgridService');
        
        // Get enhanced status display for the shipment status
        const statusDisplay = await getEnhancedStatusDisplay(shipmentData.status || 'booked');
        
        // Get notification subscribers for this company
        const result = await sendNotificationEmail(
            'shipment_created',
            companyId,
            {
                shipmentNumber: currentShipmentId,
                statusDisplay: statusDisplay,
                status: shipmentData.status || 'booked',
                carrierName: shipmentData.carrier || 'Unknown Carrier',
                trackingNumber: shipmentData.trackingNumber || currentShipmentId,
                shipFrom: `${shipmentData.shipFrom?.companyName || shipmentData.shipFrom?.company || 'Unknown'}, ${shipmentData.shipFrom?.city || 'Unknown'}`,
                shipTo: `${shipmentData.shipTo?.companyName || shipmentData.shipTo?.company || 'Unknown'}, ${shipmentData.shipTo?.city || 'Unknown'}`,
                totalCharges: shipmentData.totalCharges || 0,
                currency: shipmentData.currency || 'CAD',
                createdAt: new Date().toLocaleDateString()
            }
        );

        if (result.success) {
            logger.info(`Shipment creation notification sent successfully`, {
                shipmentNumber: currentShipmentId,
                recipientCount: result.count,
                companyId: companyId
            });
        } else {
            logger.error(`Failed to send shipment creation notification: ${result.error}`, {
                shipmentNumber: currentShipmentId,
                companyId: companyId
            });
        }

    } catch (error) {
        logger.error(`Failed to send shipment creation notification`, {
            error: error.message,
            shipmentNumber: currentShipmentId,
            shipmentId: event.params.shipmentId
        });
    }
});

/**
 * Handles QuickShip notifications (documents already generated during booking)
 * Called after the shipment is written to the database
 */
async function handleQuickShipProcessing(shipmentData, firestoreDocId) {
    logger.info('Starting QuickShip email notifications (documents already generated during booking)');
    
    const shipmentId = shipmentData.shipmentID;
    const carrierDetails = shipmentData.quickShipCarrierDetails;
    
    if (!shipmentId) {
        throw new Error('Shipment ID is required for QuickShip processing');
    }
    
    // Documents should already be generated by bookQuickShipment function
    // So we just need to find them and send email notifications
    try {
        logger.info('Searching for QuickShip documents using multiple approaches...', {
            firestoreDocId,
            shipmentId
        });
        
        const foundDocuments = [];
        
        // Approach 1: Direct document lookups in top-level collection (most reliable)
        logger.info('Approach 1: Direct document lookups in shipmentDocuments collection');
        const bolDocId = `${firestoreDocId}_bol`;
        const confirmationDocId = `${firestoreDocId}_carrier_confirmation`;
        
        try {
            const [bolDoc, confirmationDoc] = await Promise.all([
                db.collection('shipmentDocuments').doc(bolDocId).get(),
                db.collection('shipmentDocuments').doc(confirmationDocId).get()
            ]);
            
            if (bolDoc.exists) {
                const bolData = bolDoc.data();
                logger.info('Found BOL document in shipmentDocuments:', {
                    id: bolDoc.id,
                    fileName: bolData.fileName || bolData.filename,
                    hasDownloadUrl: !!bolData.downloadUrl
                });
                
                foundDocuments.push({
                    success: true,
                    data: {
                        downloadUrl: bolData.downloadUrl,
                        publicUrl: bolData.publicUrl || bolData.downloadUrl,
                        fileName: bolData.fileName || bolData.filename,
                        documentType: bolData.documentType || 'bol',
                        docType: bolData.docType
                    }
                });
            } else {
                logger.warn('BOL document not found with ID:', bolDocId);
            }
            
            if (confirmationDoc.exists) {
                const confirmationData = confirmationDoc.data();
                logger.info('Found carrier confirmation document in shipmentDocuments:', {
                    id: confirmationDoc.id,
                    fileName: confirmationData.fileName || confirmationData.filename,
                    hasDownloadUrl: !!confirmationData.downloadUrl
                });
                
                foundDocuments.push({
                    success: true,
                    data: {
                        downloadUrl: confirmationData.downloadUrl,
                        publicUrl: confirmationData.publicUrl || confirmationData.downloadUrl,
                        fileName: confirmationData.fileName || confirmationData.filename,
                        documentType: confirmationData.documentType || 'carrier_confirmation',
                        docType: confirmationData.docType
                    }
                });
            } else {
                logger.warn('Carrier confirmation document not found with ID:', confirmationDocId);
            }
        } catch (error) {
            logger.error('Error in direct document lookups:', error);
        }
        
        // Approach 2: If no documents found, try subcollection lookups
        if (foundDocuments.length === 0) {
            logger.info('Approach 2: Searching in shipment subcollections');
            try {
                const subcollectionSnapshot = await db.collection('shipments').doc(firestoreDocId)
                    .collection('documents').get();
                    
                if (!subcollectionSnapshot.empty) {
                    subcollectionSnapshot.docs.forEach(doc => {
                        const docData = doc.data();
                        logger.info('Found document in subcollection:', {
                            id: doc.id,
                            fileName: docData.fileName || docData.filename,
                            documentType: docData.documentType,
                            hasDownloadUrl: !!docData.downloadUrl
                        });
                        
                        if (docData.downloadUrl) {
                            foundDocuments.push({
                                success: true,
                                data: {
                                    downloadUrl: docData.downloadUrl,
                                    publicUrl: docData.publicUrl || docData.downloadUrl,
                                    fileName: docData.fileName || docData.filename,
                                    documentType: docData.documentType,
                                    docType: docData.docType
                                }
                            });
                        }
                    });
                } else {
                    logger.warn('No documents found in subcollection either');
                }
            } catch (error) {
                logger.error('Error searching subcollections:', error);
            }
        }
        
        // Approach 3: Query-based search as final fallback
        if (foundDocuments.length === 0) {
            logger.info('Approach 3: Query-based search in shipmentDocuments collection');
            try {
                let documentsSnapshot = await db.collection('shipmentDocuments')
                    .where('shipmentId', '==', firestoreDocId)
                    .get();
                
                // If no documents found with firestoreDocId, try with shipmentID
                if (documentsSnapshot.empty && shipmentId !== firestoreDocId) {
                    logger.info('Trying query with shipmentID:', shipmentId);
                    documentsSnapshot = await db.collection('shipmentDocuments')
                        .where('shipmentId', '==', shipmentId)
                        .get();
                }
                
                if (!documentsSnapshot.empty) {
                    documentsSnapshot.docs.forEach(doc => {
                        const docData = doc.data();
                        logger.info('Found document via query:', {
                            id: doc.id,
                            fileName: docData.fileName || docData.filename,
                            documentType: docData.documentType,
                            hasDownloadUrl: !!docData.downloadUrl
                        });
                        
                        if (docData.downloadUrl) {
                            foundDocuments.push({
                                success: true,
                                data: {
                                    downloadUrl: docData.downloadUrl,
                                    publicUrl: docData.publicUrl || docData.downloadUrl,
                                    fileName: docData.fileName || docData.filename,
                                    documentType: docData.documentType,
                                    docType: docData.docType
                                }
                            });
                        }
                    });
                } else {
                    logger.warn('No documents found via any query approach');
                }
            } catch (error) {
                logger.error('Error in query-based search:', error);
            }
        }
        
        logger.info('Found existing documents for QuickShip notifications:', {
            totalDocuments: foundDocuments.length,
            documentsWithUrls: foundDocuments.filter(r => r.success && r.data?.downloadUrl).length,
            documentDetails: foundDocuments.map(r => ({
                fileName: r.data?.fileName,
                hasUrl: !!r.data?.downloadUrl
            }))
        });
        
        // Send QuickShip notifications with existing document attachments
        const { sendQuickShipNotifications } = require('../carrier-api/generic/sendQuickShipNotifications');
        await sendQuickShipNotifications({
            shipmentData: shipmentData,
            carrierDetails: carrierDetails,
            documentResults: foundDocuments
        });
        logger.info('QuickShip notifications sent successfully with existing document attachments');
        
    } catch (notificationError) {
        logger.error('Error sending QuickShip notifications:', notificationError);
        // Don't fail the entire process if notifications fail
    }
}

/**
 * Cloud Function triggered when shipment status changes
 */
exports.onShipmentStatusChanged = onDocumentUpdated('shipments/{shipmentId}', async (event) => {
<<<<<<< HEAD
    // CRITICAL DEBUG: Log all trigger events
    logger.info('🔔 onShipmentStatusChanged TRIGGER FIRED', {
        shipmentId: event.params.shipmentId,
        hasAfterData: !!event.data?.after,
        hasBeforeData: !!event.data?.before,
        timestamp: new Date().toISOString()
    });
=======
    // CRITICAL: Check if notifications are globally enabled
    const notificationsEnabled = await areNotificationsEnabled();
    if (!notificationsEnabled) {
        logger.info('Status change notification skipped - global notifications disabled', {
            shipmentId: event.params.shipmentId
        });
        return;
    }

    const newData = event.data?.after?.data();
    const oldData = event.data?.before?.data();
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df

    // CRITICAL: Check if notifications are globally enabled
    const notificationsEnabled = await areNotificationsEnabled();
    logger.info('🌐 Global notifications check', {
        shipmentId: event.params.shipmentId,
        notificationsEnabled: notificationsEnabled
    });
    
    if (!notificationsEnabled) {
        logger.info('📧 Notifications are globally disabled, skipping email notification');
        return;
    }

    // Check if this is a real status change by comparing status-related fields
    const newData = event.data.after.data();
    const oldData = event.data.before ? event.data.before.data() : {};
    
    // COMPREHENSIVE DEBUG: Log all changed fields
    const allChangedFields = [];
    const allNewFields = Object.keys(newData);
    const allOldFields = Object.keys(oldData);
    
    // Check for new fields
    allNewFields.forEach(key => {
        if (!(key in oldData)) {
            allChangedFields.push({ field: key, type: 'new', oldValue: undefined, newValue: newData[key] });
        }
    });
    
    // Check for changed fields
    allNewFields.forEach(key => {
        if (key in oldData) {
            const oldValue = oldData[key];
            const newValue = newData[key];
            
            // Handle different data types
            let isChanged = false;
            if (typeof oldValue === 'object' && typeof newValue === 'object') {
                isChanged = JSON.stringify(oldValue) !== JSON.stringify(newValue);
            } else {
                isChanged = oldValue !== newValue;
            }
            
            if (isChanged) {
                allChangedFields.push({ field: key, type: 'changed', oldValue, newValue });
            }
        }
    });
    
    // Check for removed fields
    allOldFields.forEach(key => {
        if (!(key in newData)) {
            allChangedFields.push({ field: key, type: 'removed', oldValue: oldData[key], newValue: undefined });
        }
    });
    
    logger.info('🔍 COMPREHENSIVE FIELD CHANGE ANALYSIS', {
        shipmentId: event.params.shipmentId,
        totalChangedFields: allChangedFields.length,
        changedFields: allChangedFields.map(f => ({
            field: f.field,
            type: f.type,
            oldValue: typeof f.oldValue === 'object' ? '[object]' : f.oldValue,
            newValue: typeof f.newValue === 'object' ? '[object]' : f.newValue
        }))
    });
    
    const oldStatus = oldData.status || 'unknown';
    const newStatus = newData.status || 'unknown';
    
    // ENHANCED: Check for any status-related changes, not just legacy status
    // Helper function to safely compare timestamps
    const compareTimestamps = (oldTimestamp, newTimestamp) => {
        // If both are null/undefined, they're equal
        if (!oldTimestamp && !newTimestamp) return false; // no change
        
        // If one is null/undefined and the other isn't, they're different
        if (!oldTimestamp || !newTimestamp) return true; // changed
        
        // If both are Firestore Timestamps, compare their seconds and nanoseconds
        if (oldTimestamp._seconds && newTimestamp._seconds) {
            return oldTimestamp._seconds !== newTimestamp._seconds || 
                   oldTimestamp._nanoseconds !== newTimestamp._nanoseconds;
        }
        
        // If both are Date objects, compare their time values
        if (oldTimestamp instanceof Date && newTimestamp instanceof Date) {
            return oldTimestamp.getTime() !== newTimestamp.getTime();
        }
        
        // Fallback to string comparison
        return String(oldTimestamp) !== String(newTimestamp);
    };
    
    const statusFieldsChanged = (
        oldStatus !== newStatus ||
        JSON.stringify(oldData.statusOverride) !== JSON.stringify(newData.statusOverride) ||
        JSON.stringify(oldData.enhancedStatus) !== JSON.stringify(newData.enhancedStatus) ||
        oldData.statusChangeCounter !== newData.statusChangeCounter ||
        compareTimestamps(oldData.lastStatusChange, newData.lastStatusChange) ||
        oldData.statusChangeId !== newData.statusChangeId
    );

    // DETAILED STATUS FIELD ANALYSIS
    const statusFieldAnalysis = {
        statusChanged: oldStatus !== newStatus,
        statusOverrideChanged: JSON.stringify(oldData.statusOverride) !== JSON.stringify(newData.statusOverride),
        enhancedStatusChanged: JSON.stringify(oldData.enhancedStatus) !== JSON.stringify(newData.enhancedStatus),
        statusChangeCounterChanged: oldData.statusChangeCounter !== newData.statusChangeCounter,
        lastStatusChangeChanged: compareTimestamps(oldData.lastStatusChange, newData.lastStatusChange),
        statusChangeIdChanged: oldData.statusChangeId !== newData.statusChangeId
    };

    logger.info('📊 DETAILED STATUS CHANGE ANALYSIS', {
        shipmentId: event.params.shipmentId,
        oldStatus,
        newStatus,
        statusFieldsChanged,
        statusFieldAnalysis,
        statusOverride: { old: oldData.statusOverride, new: newData.statusOverride },
        enhancedStatus: { old: oldData.enhancedStatus, new: newData.enhancedStatus },
        statusChangeCounter: { old: oldData.statusChangeCounter, new: newData.statusChangeCounter },
        lastStatusChange: { old: oldData.lastStatusChange, new: newData.lastStatusChange },
        statusChangeId: { old: oldData.statusChangeId, new: newData.statusChangeId }
    });
    
    // Only proceed if there are actual status-related changes
    if (!statusFieldsChanged) {
        logger.info('📧 No status-related changes detected, skipping notification', {
            shipmentId: event.params.shipmentId,
            oldStatus,
            newStatus,
            message: 'Shipment was updated but status did not change'
        });
        return;
    }

    // SKIP redundant notifications for draft -> pending transitions
    // These are already handled by booking-specific notification systems
    // (QuickShip notifications, CreateShipmentX notifications, etc.)
    if (oldStatus === 'draft' && newStatus === 'pending') {
        logger.info(`⏭️ Skipping redundant status change notification for draft -> pending transition`, {
            shipmentId: event.params.shipmentId,
            shipmentNumber: newData.shipmentID || newData.shipmentNumber
        });
        return;
    }

    // Get company ID and shipment number first - check multiple possible fields (moved outside try block for error logging)
    const companyId = newData.companyID || newData.companyId || newData.userCompanyId;
    
    // Get shipment number (should now be the final ID after booking updates)
    const shipmentNumber = newData.shipmentID || 
                          newData.readableShipmentID || 
                          newData.shipmentNumber ||
                          newData.shipmentInfo?.shipperReferenceNumber;

    logger.info('🏢 Company and shipment info extracted', {
        shipmentId: event.params.shipmentId,
        companyId: companyId,
        shipmentNumber: shipmentNumber,
        availableFields: Object.keys(newData)
    });

    try {
        logger.info(`🔄 Processing status change notification: ${oldStatus} -> ${newStatus}`, {
            shipmentNumber: shipmentNumber,
            companyId: companyId
        });

        // Determine notification type based on new status
        let notificationType = 'status_changed';
        
        if (newStatus === 'delivered' || newStatus === 'DELIVERED') {
            notificationType = 'shipment_delivered';
        } else if (newStatus === 'delayed' || newStatus === 'DELAYED' || 
                   (newData.estimatedDelivery && oldData.estimatedDelivery && 
                    new Date(newData.estimatedDelivery) > new Date(oldData.estimatedDelivery))) {
            notificationType = 'shipment_delayed';
        }
        
        logger.info('📧 Notification type determined', {
            shipmentNumber: shipmentNumber,
            notificationType: notificationType,
            newStatus: newStatus
        });
        
        if (!companyId) {
            logger.warn(`❌ No company ID found for shipment ${shipmentNumber}. Available fields: ${Object.keys(newData).join(', ')}`);
            return;
        }

        // Import enhanced status display function
        const { getEnhancedStatusDisplay } = require('../email/sendgridService');

        // Extract comprehensive shipment data for status updates (like Tracking.jsx)
        const carrierBookingConfirmation = newData.carrierBookingConfirmation || {};
        const rateInfo = newData.selectedRate || newData.selectedRateRef || {};
        const shipFrom = newData.shipFrom || newData.origin || {};
        const shipTo = newData.shipTo || newData.destination || {};
        const packages = newData.packages || [];
        
        // Extract tracking number with carrier-specific logic
        let trackingNumber = carrierBookingConfirmation.proNumber || 
                           carrierBookingConfirmation.confirmationNumber ||
                           carrierBookingConfirmation.trackingNumber ||
                           newData.trackingNumber ||
                           newData.id;

        // Get enhanced status displays for both old and new status
        let previousStatusDisplay, currentStatusDisplay;
        
        try {
            // Pass shipment data to extract enhanced status information
            previousStatusDisplay = await getEnhancedStatusDisplay(oldStatus, oldData);
            currentStatusDisplay = await getEnhancedStatusDisplay(newStatus, newData);
            
            logger.info('📧 Enhanced status display generated', {
                shipmentNumber: shipmentNumber,
                previousStatus: previousStatusDisplay.displayText,
                currentStatus: currentStatusDisplay.displayText,
                hasSubStatus: !currentStatusDisplay.isMasterOnly
            });
            
        } catch (statusError) {
            logger.error('Error getting enhanced status display:', statusError);
            // Fallback to basic status display
            previousStatusDisplay = { displayText: oldStatus, statusChip: null };
            currentStatusDisplay = { displayText: newStatus, statusChip: null };
        }

        logger.info('📝 Status displays prepared', {
            shipmentNumber: shipmentNumber,
            currentStatusDisplay: currentStatusDisplay?.displayText,
            previousStatusDisplay: previousStatusDisplay?.displayText
        });

        // Prepare comprehensive email data for status updates
        let emailData = {
            // Basic Information
            shipmentNumber: shipmentNumber,
            shipmentId: newData.shipmentID,
            companyID: companyId,
            
            // Enhanced Status Information
            previousStatus: oldStatus,
            currentStatus: newStatus,
            updatedAt: new Date(),
            statusDisplay: currentStatusDisplay,
            previousStatusDisplay: previousStatusDisplay,
            
            // Carrier and Service Information
            carrier: {
                name: rateInfo.carrier || newData.carrier || 'Unknown',
                service: (rateInfo.service && typeof rateInfo.service === 'object' ? rateInfo.service.name : rateInfo.service) || 
                        (rateInfo.serviceName && typeof rateInfo.serviceName === 'object' ? rateInfo.serviceName.name : rateInfo.serviceName) || 
                        'Standard Service',
                displayCarrierId: rateInfo.displayCarrierId,
                sourceCarrierName: rateInfo.sourceCarrierName
            },
            
            // Tracking Information
            trackingNumber: trackingNumber,
            status: newData.status || 'pending',
            
            // Timing Information
            estimatedDeliveryDate: carrierBookingConfirmation.estimatedDeliveryDate || 
                                 rateInfo.estimatedDeliveryDate || 
                                 rateInfo.transit?.estimatedDelivery || null,
            transitDays: rateInfo.transitDays || rateInfo.transit?.days || 0,
            
            // Rate Information
            rate: {
                totalCharges: rateInfo.totalCharges || rateInfo.pricing?.total || 0,
                currency: rateInfo.currency || rateInfo.pricing?.currency || 'USD'
            },
            
            // Address Information
            origin: {
                company: shipFrom.company || '',
                street: shipFrom.street || '',
                street2: shipFrom.street2 || '',
                city: shipFrom.city || 'Unknown',
                state: shipFrom.state || '',
                postalCode: shipFrom.postalCode || '',
                country: shipFrom.country || 'Unknown',
                contact: shipFrom.contact || '',
                phone: shipFrom.phone || ''
            },
            destination: {
                company: shipTo.company || '',
                street: shipTo.street || '',
                street2: shipTo.street2 || '',
                city: shipTo.city || 'Unknown',
                state: shipTo.state || '',
                postalCode: shipTo.postalCode || '',
                country: shipTo.country || 'Unknown',
                contact: shipTo.contact || '',
                phone: shipTo.phone || '',
                customerID: shipTo.customerID || ''
            },
            
            // Package Summary
            totalPackages: packages.length,
            totalWeight: packages.reduce((sum, pkg) => sum + (pkg.weight || 0), 0),
            isInternational: shipFrom.country && shipTo.country && shipFrom.country !== shipTo.country,
            isFreight: (newData.shipmentInfo?.shipmentType || '').toLowerCase() === 'freight'
        };

        // Add notification-specific data
        if (notificationType === 'shipment_delivered') {
            emailData.deliveredAt = new Date();
            emailData.signature = newData.deliverySignature || null;
        } else if (notificationType === 'shipment_delayed') {
            emailData.originalETA = oldData.estimatedDelivery?.toDate?.() || new Date();
            emailData.newETA = newData.estimatedDelivery?.toDate?.() || new Date();
            emailData.reason = newData.delayReason || 'Carrier-reported delay';
        }

        // Add status description for all notification types
        emailData.description = getStatusDescription(newStatus);

        logger.info('📧 About to send notification email', {
            shipmentNumber: shipmentNumber,
            notificationType: notificationType,
            companyId: companyId,
            emailDataKeys: Object.keys(emailData)
        });

        // Send notification email using new subscription system
        const result = await sendNotificationEmail(
            notificationType,
            companyId,
            emailData,
            `${notificationType}_${shipmentNumber}_${Date.now()}`
        );

        logger.info(`✅ Status change notification sent successfully`, {
            shipmentNumber: shipmentNumber,
            statusChange: `${oldStatus} -> ${newStatus}`,
            notificationType,
            recipientCount: result.count,
            companyId: companyId,
            success: result.success
        });

    } catch (error) {
        logger.error(`❌ Failed to send status change notification`, {
            error: error.message,
            errorStack: error.stack,
            shipmentNumber: shipmentNumber,
            statusChange: `${oldStatus} -> ${newStatus}`,
            shipmentId: event.params.shipmentId
        });
    }
});

/**
 * Callable function to send test notifications
 */
exports.sendTestNotification = onCall(async (request) => {
    const { type, shipmentId, userId } = request.data;

    if (!type || !shipmentId) {
        throw new Error('Missing required parameters: type and shipmentId');
    }

    try {
        // Get shipment data - try database first, then sample data
        let shipmentData;
        
        const shipmentDoc = await db.collection('shipments').doc(shipmentId).get();
        if (shipmentDoc.exists) {
            shipmentData = shipmentDoc.data();
        } else if (sampleShipments[shipmentId]) {
            // Use sample data for testing
            shipmentData = sampleShipments[shipmentId];
            logger.info(`Using sample shipment data for ${shipmentId}`);
        } else {
            throw new Error('Shipment not found');
        }

        // Get test recipient (current user or company users)
        let recipients;
        if (userId) {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                recipients = [{
                    userId: userId,
                    email: userData.email,
                    firstName: userData.firstName,
                    lastName: userData.lastName
                }];
            }
        }

        if (!recipients) {
            // Try to get real recipients, or use sample data
                    const companyId = shipmentData.companyID || shipmentData.companyId || shipmentData.userCompanyId;
        if (companyId && companyId !== 'sample_company_1') {
            recipients = await getNotificationRecipients(companyId, type);
            } else {
                // Use sample users for testing
                recipients = sampleUsers.sample_company_1 || [];
                logger.info(`Using sample users for testing: ${recipients.length} recipients`);
            }
        }

        if (recipients.length === 0) {
            throw new Error('No valid recipients found');
        }

        // Prepare test email data
        const emailData = {
            shipmentNumber: shipmentData.shipmentNumber,
            carrier: shipmentData.selectedRate?.displayCarrierId || 'Test Carrier',
            service: shipmentData.selectedRate?.serviceName || 'Test Service',
            createdAt: new Date(),
            deliveredAt: new Date(),
            trackingNumber: shipmentData.trackingNumber || 'TEST123456789',
            origin: {
                city: shipmentData.origin?.city || 'Test Origin',
                state: shipmentData.origin?.state || 'ON',
                country: shipmentData.origin?.country || 'Canada'
            },
            destination: {
                city: shipmentData.destination?.city || 'Test Destination',
                state: shipmentData.destination?.state || 'NY',
                country: shipmentData.destination?.country || 'USA'
            },
            previousStatus: 'in_transit',
            currentStatus: 'delivered',
            updatedAt: new Date(),
            description: 'This is a test notification'
        };

        await sendNotificationEmail(
            type,
            recipients,
            emailData,
            `test_${type}_${Date.now()}`
        );

        return { 
            success: true, 
            message: `Test ${type} notification sent to ${recipients.length} recipients` 
        };

    } catch (error) {
        logger.error(`Failed to send test notification`, { error: error.message, type, shipmentId });
        throw new Error(`Failed to send test notification: ${error.message}`);
    }
});

/**
 * Cloud Function to send customer note notifications
 * Updated: 2025-01-04
 */
exports.sendCustomerNoteNotification = onCall({
    cors: true,
    region: 'us-central1'
}, async (request) => {
    const { noteId, customerID, customerName, companyID, content, createdBy, createdByName, createdAt, attachments, noteUrl } = request.data;

    if (!noteId || !customerID || !companyID || !content) {
        throw new Error('Missing required parameters');
    }

    try {
        logger.info(`Processing customer note notification`, {
            noteId,
            customerID,
            customerName,
            companyID,
            createdBy
        });

        // Prepare comprehensive email data
        const emailData = {
            noteId: noteId,
            customerID: customerID,
            customerName: customerName || 'Unknown Customer',
            companyID: companyID,
            content: content,
            createdBy: createdBy,
            createdByName: createdByName || createdBy,
            createdAt: createdAt || new Date(),
            attachments: attachments || [],
            noteUrl: noteUrl || `https://solushipx.web.app/customers/${customerID}`
        };

        // Send notification email using new subscription system
        const result = await sendNotificationEmail(
            'customer_note_added',
            companyID,
            emailData,
            `customer_note_${noteId}_${Date.now()}`
        );

        logger.info(`Customer note notification sent successfully`, {
            noteId: noteId,
            recipientCount: result.count,
            companyID: companyID,
            customerID: customerID
        });

        return { 
            success: true, 
            message: `Customer note notification sent to ${result.count} recipients`,
            recipientCount: result.count
        };

    } catch (error) {
        logger.error(`Failed to send customer note notification`, { 
            error: error.message, 
            noteId, 
            customerID, 
            companyID 
        });
        throw new Error(`Failed to send customer note notification: ${error.message}`);
    }
});

/**
 * Callable function to update user notification preferences
 */
exports.updateNotificationPreferences = onCall({
    cors: true,
    region: 'us-central1'
}, async (request) => {
    const { userId, companyId, preferences } = request.data;

    if (!userId || !companyId || !preferences) {
        throw new Error('Missing required parameters: userId, companyId, and preferences');
    }

    try {
        // Import the new V2 function from sendgridService
        const { updateUserNotificationSubscriptionsV2 } = require('../email/sendgridService');
        
        logger.info(`Attempting to update notification preferences`, {
            userId,
            companyId,
            preferences
        });
        
        // Update subscriptions in separate collection
        const result = await updateUserNotificationSubscriptionsV2(userId, companyId, preferences);
        
        // Also update user's preferences document for backward compatibility
        const userDocRef = db.collection('users').doc(userId);
        await userDocRef.update({
            notifications: preferences,
            updatedAt: new Date()
        });

        logger.info(`Updated notification preferences for user ${userId}`, {
            companyId,
            preferences,
            subscriptions: result.subscriptions
        });

        return { 
            success: true, 
            message: 'Notification preferences updated successfully',
            subscriptions: result.subscriptions
        };

    } catch (error) {
        logger.error(`Failed to update notification preferences`, { 
            error: error.message, 
            userId, 
            companyId, 
            preferences 
        });
        throw new Error(`Failed to update notification preferences: ${error.message}`);
    }
});

/**
 * Callable function to get user notification preferences
 */
exports.getNotificationPreferences = onCall({
    cors: true,
    region: 'us-central1'
}, async (request) => {
    const { userId, companyId } = request.data;

    if (!userId || !companyId) {
        throw new Error('Missing required parameters: userId and companyId');
    }

    try {
        // Import the new V2 function from sendgridService
        const { getUserCompanyNotificationStatusV2 } = require('../email/sendgridService');
        
        // Get current subscription status from separate collection
        const currentStatus = await getUserCompanyNotificationStatusV2(userId, companyId);

        logger.info(`Retrieved notification preferences for user ${userId}`, {
            companyId,
            preferences: currentStatus
        });

        return { 
            success: true, 
            preferences: currentStatus
        };

    } catch (error) {
        logger.error(`Failed to get notification preferences`, { 
            error: error.message, 
            userId, 
            companyId 
        });
        throw new Error(`Failed to get notification preferences: ${error.message}`);
    }
});

/**
 * Migration function to convert from company record subscriptions to separate collection
 * This should be run once to migrate from the old system to the new collection-based system
 */
exports.migrateToCollectionSystem = onCall({
    cors: true,
    region: 'us-central1'
}, async (request) => {
    const { companyId } = request.data;

    if (!companyId) {
        throw new Error('Missing required parameter: companyId');
    }

    try {
        logger.info(`Starting migration from company record to collection system for company ${companyId}`);

        // Import the migration function from sendgridService
        const { migrateNotificationSubscriptionsToCollection } = require('../email/sendgridService');

        // Run the migration
        const migrationResult = await migrateNotificationSubscriptionsToCollection(companyId);

        logger.info(`Collection migration completed for company ${companyId}`, migrationResult);

        return {
            success: true,
            message: `Collection migration completed for company ${companyId}`,
            migratedCount: migrationResult.migratedCount
        };

    } catch (error) {
        logger.error(`Failed to migrate to collection system for company ${companyId}`, {
            error: error.message
        });
        throw new Error(`Collection migration failed: ${error.message}`);
    }
});

/**
 * Callable function to automatically setup notification subscriptions for company admins
 */
exports.setupAdminNotifications = onCall({
    cors: true,
    region: 'us-central1'
}, async (request) => {
    const { usersToAdd, usersToRemove, companyId } = request.data;

    if (!companyId) {
        throw new Error('Missing required parameter: companyId');
    }

    if ((!usersToAdd || !Array.isArray(usersToAdd)) && (!usersToRemove || !Array.isArray(usersToRemove))) {
        throw new Error('Must provide usersToAdd or usersToRemove arrays');
    }

    try {
        logger.info(`Setting up admin notifications for company ${companyId}`, {
            usersToAdd: usersToAdd || [],
            usersToRemove: usersToRemove || []
        });

        // Import the V2 function from sendgridService
        const { updateUserNotificationSubscriptionsV2 } = require('../email/sendgridService');
        
        const results = {
            added: [],
            removed: [],
            errors: []
        };

        // Default admin notification preferences (hawkeye mode enabled)
        const defaultAdminPreferences = {
            shipment_created: true,
            shipment_delivered: true,
            shipment_delayed: true,
            status_changed: true,
            customer_note_added: true,
            hawkeye_mode: true
        };

        // Disabled preferences for removal
        const disabledPreferences = {
            shipment_created: false,
            shipment_delivered: false,
            shipment_delayed: false,
            status_changed: false,
            customer_note_added: false,
            hawkeye_mode: false
        };

        // Add notification subscriptions for new admins
        if (usersToAdd && usersToAdd.length > 0) {
            for (const userId of usersToAdd) {
                try {
                    await updateUserNotificationSubscriptionsV2(userId, companyId, defaultAdminPreferences);
                    results.added.push(userId);
                    logger.info(`Successfully added notification subscriptions for admin user ${userId}`);
                } catch (error) {
                    logger.error(`Failed to add notification subscriptions for user ${userId}`, {
                        error: error.message,
                        companyId
                    });
                    results.errors.push({ userId, operation: 'add', error: error.message });
                }
            }
        }

        // Remove notification subscriptions for removed admins
        if (usersToRemove && usersToRemove.length > 0) {
            for (const userId of usersToRemove) {
                try {
                    await updateUserNotificationSubscriptionsV2(userId, companyId, disabledPreferences);
                    results.removed.push(userId);
                    logger.info(`Successfully removed notification subscriptions for admin user ${userId}`);
                } catch (error) {
                    logger.error(`Failed to remove notification subscriptions for user ${userId}`, {
                        error: error.message,
                        companyId
                    });
                    results.errors.push({ userId, operation: 'remove', error: error.message });
                }
            }
        }

        logger.info(`Admin notification setup completed for company ${companyId}`, results);

        return {
            success: true,
            message: `Admin notification setup completed`,
            results: results
        };

    } catch (error) {
        logger.error(`Failed to setup admin notifications for company ${companyId}`, {
            error: error.message,
            usersToAdd: usersToAdd || [],
            usersToRemove: usersToRemove || []
        });
        throw new Error(`Failed to setup admin notifications: ${error.message}`);
    }
});

/**
 * Get user-friendly status descriptions
 */
function getStatusDescription(status) {
    const descriptions = {
        'draft': 'Your shipment is being prepared.',
        'booked': 'Your shipment has been booked with the carrier.',
        'scheduled': 'Your shipment is scheduled for pickup.',
        'in_transit': 'Your shipment is on its way to the destination.',
        'out_for_delivery': 'Your shipment is out for delivery.',
        'delivered': 'Your shipment has been successfully delivered.',
        'delayed': 'Your shipment has encountered a delay.',
        'exception': 'Your shipment requires attention.',
        'cancelled': 'Your shipment has been cancelled.',
        'void': 'Your shipment has been voided.'
    };

    return descriptions[status.toLowerCase()] || 'Your shipment status has been updated.';
}

module.exports = {
    onShipmentCreated: exports.onShipmentCreated,
    onShipmentStatusChanged: exports.onShipmentStatusChanged,
    sendTestNotification: exports.sendTestNotification,
    sendCustomerNoteNotification: exports.sendCustomerNoteNotification,
    updateNotificationPreferences: exports.updateNotificationPreferences,
    getNotificationPreferences: exports.getNotificationPreferences,
    migrateToCollectionSystem: exports.migrateToCollectionSystem,
    setupAdminNotifications: exports.setupAdminNotifications
}; 