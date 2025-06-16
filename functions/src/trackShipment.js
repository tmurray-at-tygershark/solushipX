const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

// Get Firestore instance
const db = admin.firestore();

/**
 * Track a shipment by shipment ID or tracking number
 * Called by the AI agent to get shipment status and tracking information
 */
exports.trackShipment = onCall(async (request) => {
    try {
        const { identifier, companyId } = request.data;

        // Validate required parameters
        if (!identifier) {
            throw new HttpsError('invalid-argument', 'identifier (shipment ID or tracking number) is required');
        }

        logger.info(`Tracking shipment with identifier: ${identifier}`);

        // Try to determine if this is a shipment ID or tracking number
        const isShipmentId = identifier.includes('-') && (identifier.includes('IC-') || identifier.includes('SID-'));
        const isTrackingNumber = !isShipmentId && (identifier.length > 10 || /^\d+$/.test(identifier));
        
        let shipmentData = null;
        let trackingInfo = null;

        if (isShipmentId) {
            // Handle shipment ID lookup - enforce company ID check
            trackingInfo = await trackByShipmentId(identifier, companyId);
        } else {
            // Handle direct tracking number lookup - be more flexible with company ID
            trackingInfo = await trackByTrackingNumber(identifier, isTrackingNumber ? null : companyId);
        }

        if (!trackingInfo || !trackingInfo.success) {
            throw new HttpsError('not-found', `No shipment found with identifier: ${identifier}`);
        }

        return {
            success: true,
            data: trackingInfo.data
        };

    } catch (error) {
        logger.error('Error tracking shipment:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Failed to track shipment: ${error.message}`);
    }
});

/**
 * Track shipment by shipment ID
 */
async function trackByShipmentId(shipmentId, companyId) {
    try {
        logger.info(`Searching for shipment ID: ${shipmentId}`);
        
        // First try direct lookup by document ID
        let shipmentRef = db.collection('shipments').doc(shipmentId);
        let shipmentDoc = await shipmentRef.get();
        logger.info(`Direct document lookup result: ${shipmentDoc.exists}`);

        // If not found by document ID, try multiple search patterns
        if (!shipmentDoc.exists) {
            const searchFields = [
                'shipmentID',
                'shipmentId', 
                'id',
                'shipmentNumber',
                'referenceNumber',
                'bookingReference',
                'carrierBookingConfirmation.shipmentID',
                'carrierBookingConfirmation.referenceNumber'
            ];

            for (const field of searchFields) {
                logger.info(`Searching by field: ${field}`);
                const shipmentQuery = db.collection('shipments').where(field, '==', shipmentId);
                const shipmentSnapshot = await shipmentQuery.get();
                
                if (!shipmentSnapshot.empty) {
                    logger.info(`Found shipment using field: ${field}`);
                    shipmentDoc = shipmentSnapshot.docs[0];
                    shipmentRef = shipmentDoc.ref;
                    break;
                }
            }
        }

        // If still not found, try case-insensitive search on common fields
        if (!shipmentDoc.exists) {
            logger.info('Trying case-insensitive search...');
            const allShipments = await db.collection('shipments').get();
            
            for (const doc of allShipments.docs) {
                const data = doc.data();
                const fieldsToCheck = [
                    data.shipmentID,
                    data.shipmentId,
                    data.id,
                    data.shipmentNumber,
                    data.referenceNumber,
                    data.bookingReference,
                    data.carrierBookingConfirmation?.shipmentID,
                    data.carrierBookingConfirmation?.referenceNumber
                ];
                
                for (const fieldValue of fieldsToCheck) {
                    if (fieldValue && typeof fieldValue === 'string' && 
                        fieldValue.toLowerCase() === shipmentId.toLowerCase()) {
                        logger.info(`Found shipment with case-insensitive match on: ${fieldValue}`);
                        shipmentDoc = doc;
                        shipmentRef = doc.ref;
                        break;
                    }
                }
                
                if (shipmentDoc.exists) break;
            }
        }

        if (!shipmentDoc.exists) {
            logger.warn(`Shipment with ID ${shipmentId} not found after comprehensive search`);
            return {
                success: false,
                error: `Shipment with ID ${shipmentId} not found`
            };
        }

        const shipmentData = shipmentDoc.data();

        // If companyId is provided, verify the shipment belongs to this company
        // Check both companyId and companyID fields for compatibility
        if (companyId && shipmentData.companyId !== companyId && shipmentData.companyID !== companyId) {
            logger.warn(`Company ID mismatch: provided=${companyId}, shipment.companyId=${shipmentData.companyId}, shipment.companyID=${shipmentData.companyID}`);
            return {
                success: false,
                error: 'Shipment not found for this company'
            };
        }

        // Get the latest tracking information
        const trackingData = await getShipmentTrackingData(shipmentData, shipmentDoc.id);

        return {
            success: true,
            data: {
                shipment: {
                    id: shipmentDoc.id,
                    shipmentID: shipmentData.shipmentID,
                    status: shipmentData.status,
                    carrier: getCarrierInfo(shipmentData),
                    trackingNumber: getTrackingNumber(shipmentData),
                    origin: shipmentData.origin || shipmentData.shipFrom,
                    destination: shipmentData.destination || shipmentData.shipTo,
                    packages: shipmentData.packages || shipmentData.items,
                    createdAt: shipmentData.createdAt,
                    estimatedDelivery: shipmentData.estimatedDelivery,
                    actualDelivery: shipmentData.actualDelivery
                },
                tracking: trackingData
            }
        };

    } catch (error) {
        logger.error('Error in trackByShipmentId:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Track shipment by tracking number
 */
async function trackByTrackingNumber(trackingNumber, companyId) {
    try {
        // Search for shipments with this tracking number
        let shipmentsQuery = db.collection('shipments');
        
        // Add company filter if provided - try both field variations
        if (companyId) {
            // Note: We'll filter by company after fetching since we need to check both companyId and companyID
            // shipmentsQuery = shipmentsQuery.where('companyId', '==', companyId);
        }

        // Try multiple tracking number fields
        const trackingFields = [
            'trackingNumber',
            'carrierBookingConfirmation.trackingNumber',
            'carrierBookingConfirmation.proNumber',
            'carrierBookingConfirmation.confirmationNumber',
            'selectedRate.TrackingNumber',
            'selectedRate.Barcode'
        ];

        let shipmentDoc = null;
        let shipmentData = null;

        // Try each tracking field
        for (const field of trackingFields) {
            const query = shipmentsQuery.where(field, '==', trackingNumber);
            const snapshot = await query.get();
            
            if (!snapshot.empty) {
                shipmentDoc = snapshot.docs[0];
                shipmentData = shipmentDoc.data();
                break;
            }
        }

        if (!shipmentDoc) {
            return {
                success: false,
                error: `No shipment found with tracking number: ${trackingNumber}`
            };
        }

        // For tracking numbers, be more flexible with company validation
        // Only enforce company check if this looks like a shipment ID (not a tracking number)
        const isLikelyTrackingNumber = /^\d+$/.test(trackingNumber) && trackingNumber.length > 10;
        
        if (companyId && !isLikelyTrackingNumber && shipmentData.companyId !== companyId && shipmentData.companyID !== companyId) {
            logger.warn(`Company ID mismatch for tracking number: provided=${companyId}, shipment.companyId=${shipmentData.companyId}, shipment.companyID=${shipmentData.companyID}`);
            return {
                success: false,
                error: 'Shipment not found for this company'
            };
        }
        
        // Log company info for tracking numbers but don't block access
        if (isLikelyTrackingNumber) {
            logger.info(`Tracking number ${trackingNumber} found for company: ${shipmentData.companyID || shipmentData.companyId || 'unknown'}`);
        }

        // Get the latest tracking information
        const trackingData = await getShipmentTrackingData(shipmentData, shipmentDoc.id);

        return {
            success: true,
            data: {
                shipment: {
                    id: shipmentDoc.id,
                    shipmentID: shipmentData.shipmentID,
                    status: shipmentData.status,
                    carrier: getCarrierInfo(shipmentData),
                    trackingNumber: getTrackingNumber(shipmentData),
                    origin: shipmentData.origin || shipmentData.shipFrom,
                    destination: shipmentData.destination || shipmentData.shipTo,
                    packages: shipmentData.packages || shipmentData.items,
                    createdAt: shipmentData.createdAt,
                    estimatedDelivery: shipmentData.estimatedDelivery,
                    actualDelivery: shipmentData.actualDelivery
                },
                tracking: trackingData
            }
        };

    } catch (error) {
        logger.error('Error in trackByTrackingNumber:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get detailed tracking data for a shipment
 */
async function getShipmentTrackingData(shipmentData, shipmentId) {
    try {
        // Check if we have recent tracking data
        const carrierTrackingData = shipmentData.carrierTrackingData;
        const statusLastChecked = shipmentData.statusLastChecked;
        
        // If we have recent data (less than 1 hour old), return it
        if (carrierTrackingData && statusLastChecked) {
            const lastChecked = new Date(statusLastChecked.toDate ? statusLastChecked.toDate() : statusLastChecked);
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            
            if (lastChecked > oneHourAgo) {
                return formatTrackingData(carrierTrackingData);
            }
        }

        // Otherwise, try to get fresh tracking data
        const carrier = getCarrierInfo(shipmentData);
        const trackingNumber = getTrackingNumber(shipmentData);

        if (!carrier || !trackingNumber) {
            return {
                status: shipmentData.status || 'unknown',
                statusDisplay: getStatusDisplay(shipmentData.status),
                lastUpdated: statusLastChecked || shipmentData.updatedAt,
                events: [],
                message: 'Limited tracking information available'
            };
        }

        // Call the existing checkShipmentStatus function
        try {
            const { checkShipmentStatus } = require('./checkShipmentStatus');
            const statusResult = await checkShipmentStatus({
                shipmentId: shipmentId,
                trackingNumber: trackingNumber,
                carrier: carrier.name
            }, { auth: { uid: 'system-tracking' } });

            if (statusResult && statusResult.success) {
                return formatTrackingData(statusResult);
            }
        } catch (statusError) {
            logger.warn('Failed to get fresh tracking data:', statusError);
        }

        // Fallback to existing data
        return formatTrackingData(carrierTrackingData || {
            status: shipmentData.status,
            statusDisplay: getStatusDisplay(shipmentData.status),
            lastUpdated: statusLastChecked || shipmentData.updatedAt
        });

    } catch (error) {
        logger.error('Error getting tracking data:', error);
        return {
            status: shipmentData.status || 'unknown',
            statusDisplay: getStatusDisplay(shipmentData.status),
            lastUpdated: shipmentData.updatedAt,
            events: [],
            error: 'Failed to retrieve tracking information'
        };
    }
}

/**
 * Format tracking data for consistent response
 */
function formatTrackingData(trackingData) {
    return {
        status: trackingData.status || 'unknown',
        statusDisplay: trackingData.statusDisplay || getStatusDisplay(trackingData.status),
        lastUpdated: trackingData.lastUpdated || trackingData.statusLastChecked,
        estimatedDelivery: trackingData.estimatedDelivery,
        actualDelivery: trackingData.actualDelivery,
        events: trackingData.trackingEvents || trackingData.events || [],
        carrierInfo: trackingData.carrierInfo || {},
        shipmentDates: trackingData.shipmentDates || {},
        location: trackingData.currentLocation || trackingData.location,
        message: trackingData.message || trackingData.statusMessage
    };
}

/**
 * Extract carrier information from shipment data
 */
function getCarrierInfo(shipmentData) {
    // Try multiple sources for carrier information
    if (shipmentData.selectedRate?.CarrierName) {
        return {
            name: shipmentData.selectedRate.CarrierName,
            code: shipmentData.selectedRate.CarrierCode || shipmentData.selectedRate.carrierScac
        };
    }
    
    if (shipmentData.selectedRateRef?.carrier) {
        return {
            name: shipmentData.selectedRateRef.carrier,
            code: shipmentData.selectedRateRef.carrierCode
        };
    }
    
    if (shipmentData.carrier) {
        return {
            name: shipmentData.carrier,
            code: shipmentData.carrierCode
        };
    }
    
    if (shipmentData.carrierBookingConfirmation?.carrier) {
        return {
            name: shipmentData.carrierBookingConfirmation.carrier,
            code: shipmentData.carrierBookingConfirmation.carrierCode
        };
    }
    
    return null;
}

/**
 * Extract tracking number from shipment data
 */
function getTrackingNumber(shipmentData) {
    // Try multiple sources for tracking number
    return shipmentData.trackingNumber ||
           shipmentData.carrierBookingConfirmation?.trackingNumber ||
           shipmentData.carrierBookingConfirmation?.proNumber ||
           shipmentData.carrierBookingConfirmation?.confirmationNumber ||
           shipmentData.selectedRate?.TrackingNumber ||
           shipmentData.selectedRate?.Barcode ||
           null;
}

/**
 * Get display name for status
 */
function getStatusDisplay(status) {
    const statusMap = {
        'draft': 'Draft',
        'booked': 'Booked',
        'scheduled': 'Scheduled',
        'in_transit': 'In Transit',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled',
        'void': 'Void',
        'pending': 'Pending'
    };
    
    return statusMap[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown');
} 