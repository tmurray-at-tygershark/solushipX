const { onDocumentWritten, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const { sendNotificationEmail } = require('../email/sendgridService');
const { sampleShipments, sampleUsers } = require('./sampleData');

const db = getFirestore();

/**
 * Cloud Function triggered when a shipment is created
 */
exports.onShipmentCreated = onDocumentWritten('shipments/{shipmentId}', async (event) => {
    const shipmentData = event.data?.after?.data();
    const previousData = event.data?.before?.data();

    // Only trigger when shipment is actually created (becomes bookable)
    if (!shipmentData) {
        return;
    }

    // Check if this is a new shipment or a shipment transitioning to 'booked' status
    const isNewShipment = !previousData;
    const isBeingBooked = shipmentData.status === 'booked' && (!previousData || previousData.status !== 'booked');
    
    // Only send creation notification for new shipments or when becoming booked for the first time
    if (!isNewShipment && !isBeingBooked) {
        return;
    }
    
    // Additional safety check: only send if the shipment has actually been successfully processed
    if (shipmentData.status !== 'booked') {
        logger.info(`Shipment ${shipmentData.shipmentNumber || shipmentData.shipmentID} is not booked yet (status: ${shipmentData.status}), skipping creation notification`);
        return;
    }
    
    // CRITICAL: Ensure we have the final shipment ID (not draft) before sending emails
    const currentShipmentId = shipmentData.shipmentID || shipmentData.readableShipmentID || shipmentData.shipmentNumber;
    if (!currentShipmentId || currentShipmentId.includes('-DRAFT-')) {
        logger.info(`Shipment ${shipmentData.shipmentID} still has draft ID (${currentShipmentId}), skipping notification until final ID is set`);
        return;
    }

    try {
        // Get company ID and shipment number first - check multiple possible fields
        const companyId = shipmentData.companyID || shipmentData.companyId || shipmentData.userCompanyId;
        
        // Get shipment number - this should be the final carrier shipment ID after booking
        const shipmentNumber = shipmentData.shipmentID || shipmentData.readableShipmentID || shipmentData.shipmentNumber;

        logger.info(`Processing shipment creation notification for ${shipmentNumber}`, {
            isNewShipment,
            isBeingBooked,
            status: shipmentData.status,
            previousStatus: previousData?.status || 'none'
        });
        
        if (!companyId) {
            logger.warn(`No company ID found for shipment ${shipmentNumber}. Available fields: ${Object.keys(shipmentData).join(', ')}`);
            return;
        }

        // Send notification using new subscription system
        // The sendNotificationEmail function will handle recipient lookup internally

        // Extract comprehensive shipment data like in ShipmentDetail.jsx
        const carrierBookingConfirmation = shipmentData.carrierBookingConfirmation || {};
        
        // Get rate information (checking multiple possible sources)
        const rateInfo = shipmentData.selectedRate || shipmentData.selectedRateRef || {};
        
        // Extract addresses with fallbacks
        const shipFrom = shipmentData.shipFrom || shipmentData.origin || {};
        const shipTo = shipmentData.shipTo || shipmentData.destination || {};
        
        // Get packages information
        const packages = shipmentData.packages || [];
        
        // Extract tracking number with carrier-specific logic
        let trackingNumber = carrierBookingConfirmation.proNumber || 
                           carrierBookingConfirmation.confirmationNumber ||
                           carrierBookingConfirmation.trackingNumber ||
                           shipmentData.trackingNumber ||
                           shipmentData.id;

        // Prepare comprehensive email data
        const emailData = {
            // Basic Information
            shipmentNumber: shipmentNumber,
            shipmentId: shipmentData.shipmentID,
            companyID: companyId,
            customerID: shipTo.customerID || 'N/A',
            createdAt: shipmentData.createdAt?.toDate?.() || new Date(),
            
            // Shipment Information
            shipmentInfo: {
                shipmentType: shipmentData.shipmentInfo?.shipmentType || 'package',
                shipmentDate: shipmentData.shipmentInfo?.shipmentDate || null,
                referenceNumber: shipmentData.shipmentInfo?.shipperReferenceNumber || shipmentNumber,
                billType: shipmentData.shipmentInfo?.shipmentBillType || 'prepaid',
                holdForPickup: shipmentData.shipmentInfo?.holdForPickup || false,
                saturdayDelivery: shipmentData.shipmentInfo?.saturdayDelivery || false,
                signatureRequired: shipmentData.shipmentInfo?.signatureRequired || false,
                pickupWindow: {
                    earliest: shipmentData.shipmentInfo?.earliestPickupTime || '09:00',
                    latest: shipmentData.shipmentInfo?.latestPickupTime || '17:00'
                }
            },
            
            // Carrier and Service Information
            carrier: {
                name: rateInfo.carrier || shipmentData.carrier || 'Unknown',
                service: rateInfo.service || rateInfo.serviceName || 'Standard Service',
                displayCarrierId: rateInfo.displayCarrierId,
                sourceCarrierName: rateInfo.sourceCarrierName
            },
            
            // Tracking Information
            trackingNumber: trackingNumber,
            status: shipmentData.status || 'pending',
            
            // Timing Information
            estimatedDeliveryDate: carrierBookingConfirmation.estimatedDeliveryDate || 
                                 rateInfo.estimatedDeliveryDate || 
                                 rateInfo.transit?.estimatedDelivery || null,
            transitDays: rateInfo.transitDays || rateInfo.transit?.days || 0,
            
            // Rate Information
            rate: {
                totalCharges: rateInfo.totalCharges || rateInfo.pricing?.total || 0,
                freightCharge: rateInfo.freightCharge || rateInfo.freightCharges || rateInfo.pricing?.freight || 0,
                fuelCharge: rateInfo.fuelCharge || rateInfo.fuelCharges || rateInfo.pricing?.fuel || 0,
                serviceCharges: rateInfo.serviceCharges || rateInfo.pricing?.service || 0,
                accessorialCharges: rateInfo.accessorialCharges || rateInfo.pricing?.accessorial || 0,
                currency: rateInfo.currency || rateInfo.pricing?.currency || 'USD',
                guaranteed: rateInfo.guaranteed || rateInfo.transit?.guaranteed || false
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
                phone: shipFrom.phone || '',
                email: shipFrom.email || ''
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
                email: shipTo.email || '',
                customerID: shipTo.customerID || ''
            },
            
            // Package Information
            packages: packages.map((pkg, index) => ({
                number: index + 1,
                description: pkg.description || pkg.itemDescription || 'Package',
                quantity: pkg.quantity || pkg.packagingQuantity || 1,
                weight: pkg.weight || 0,
                dimensions: {
                    length: pkg.dimensions?.length || pkg.length || 0,
                    width: pkg.dimensions?.width || pkg.width || 0,
                    height: pkg.dimensions?.height || pkg.height || 0
                },
                freightClass: pkg.freightClass || 'N/A',
                declaredValue: pkg.value || pkg.declaredValue || 0
            })),
            
            // Calculated Information
            totalPackages: packages.length,
            totalWeight: packages.reduce((sum, pkg) => sum + (pkg.weight || 0), 0),
            isInternational: shipFrom.country && shipTo.country && shipFrom.country !== shipTo.country,
            isFreight: (shipmentData.shipmentInfo?.shipmentType || '').toLowerCase() === 'freight'
        };

        // Send notification email using new subscription system
        const result = await sendNotificationEmail(
            'shipment_created',
            companyId,
            emailData,
            `shipment_created_${shipmentNumber}_${Date.now()}`
        );

        logger.info(`Shipment creation notification sent successfully`, {
            shipmentNumber: shipmentNumber,
            recipientCount: result.count,
            companyId: companyId
        });

    } catch (error) {
        logger.error(`Failed to send shipment creation notification`, {
            error: error.message,
            shipmentNumber: shipmentNumber,
            shipmentId: event.params.shipmentId
        });
    }
});

/**
 * Cloud Function triggered when shipment status changes
 */
exports.onShipmentStatusChanged = onDocumentUpdated('shipments/{shipmentId}', async (event) => {
    const newData = event.data?.after?.data();
    const oldData = event.data?.before?.data();

    if (!newData || !oldData) {
        return;
    }

    // Check if status actually changed
    const oldStatus = oldData.status;
    const newStatus = newData.status;

    if (oldStatus === newStatus) {
        return;
    }

    try {
        // Get company ID and shipment number first - check multiple possible fields
        const companyId = newData.companyID || newData.companyId || newData.userCompanyId;
        
        // Get shipment number (should now be the final ID after booking updates)
        const shipmentNumber = newData.shipmentID || 
                              newData.readableShipmentID || 
                              newData.shipmentNumber ||
                              newData.shipmentInfo?.shipperReferenceNumber;

        logger.info(`Processing status change notification: ${oldStatus} -> ${newStatus}`, {
            shipmentNumber: shipmentNumber
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
        
        if (!companyId) {
            logger.warn(`No company ID found for shipment ${shipmentNumber}. Available fields: ${Object.keys(newData).join(', ')}`);
            return;
        }

        // Send notification using new subscription system
        // The sendNotificationEmail function will handle recipient lookup internally

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

        // Prepare comprehensive email data for status updates
        let emailData = {
            // Basic Information
            shipmentNumber: shipmentNumber,
            shipmentId: newData.shipmentID,
            companyID: companyId,
            
            // Status Information
            previousStatus: oldStatus,
            currentStatus: newStatus,
            updatedAt: new Date(),
            
            // Carrier and Service Information
            carrier: {
                name: rateInfo.carrier || newData.carrier || 'Unknown',
                service: rateInfo.service || rateInfo.serviceName || 'Standard Service',
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

        // Send notification email using new subscription system
        const result = await sendNotificationEmail(
            notificationType,
            companyId,
            emailData,
            `${notificationType}_${shipmentNumber}_${Date.now()}`
        );

        logger.info(`Status change notification sent successfully`, {
            shipmentNumber: shipmentNumber,
            statusChange: `${oldStatus} -> ${newStatus}`,
            notificationType,
            recipientCount: result.count,
            companyId: companyId
        });

    } catch (error) {
        logger.error(`Failed to send status change notification`, {
            error: error.message,
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
 */
exports.sendCustomerNoteNotification = onCall(async (request) => {
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
exports.updateNotificationPreferences = onCall(async (request) => {
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
exports.getNotificationPreferences = onCall(async (request) => {
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
exports.migrateToCollectionSystem = onCall(async (request) => {
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
    migrateToCollectionSystem: exports.migrateToCollectionSystem
}; 