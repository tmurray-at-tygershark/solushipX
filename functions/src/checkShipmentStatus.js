const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const axios = require('axios');

// Import carrier-specific status checkers
const { getEShipPlusStatus } = require('./carrier-api/eshipplus/getStatus');
const { getCanparStatus } = require('./carrier-api/canpar/getStatus');

// Initialize Firebase Admin if not already initialized
try {
    initializeApp();
} catch (error) {
    // App already initialized
}

const db = getFirestore();

/**
 * Check shipment status across different carriers
 * Updated: Added carrier name normalization for better carrier matching
 */
exports.checkShipmentStatus = onRequest(
    {
        cors: true,
        timeoutSeconds: 540,
        memory: '1GiB'
    },
    async (req, res) => {
        try {
            const { trackingNumber, shipmentId, carrier, bookingReferenceNumber } = req.body;

            if (!trackingNumber && !shipmentId) {
                return res.status(400).json({
                    success: false,
                    error: 'Either trackingNumber or shipmentId is required'
                });
            }

            const result = await checkShipmentStatusInternal({
                trackingNumber,
                shipmentId,
                carrier,
                bookingReferenceNumber
            });

            if (!result.success) {
                return res.status(result.statusCode || 500).json(result);
            }

            return res.status(200).json(result);

        } catch (error) {
            logger.error('Error in checkShipmentStatus:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * Internal function to check shipment status - can be called by HTTP endpoint or polling system
 */
async function checkShipmentStatusInternal({ trackingNumber, shipmentId, carrier, bookingReferenceNumber }) {
    try {
        let shipmentData = null;
        let carrierInfo = null;

        // If shipmentId is provided, get shipment data from Firestore
        if (shipmentId) {
            const shipmentRef = db.collection('shipments').doc(shipmentId);
            const shipmentDoc = await shipmentRef.get();
            
            if (!shipmentDoc.exists) {
                return {
                    success: false,
                    statusCode: 404,
                    error: 'Shipment not found'
                };
            }
            
            shipmentData = shipmentDoc.data();
            
            // Determine carrier from shipment data if not provided
            if (!carrier) {
                carrierInfo = getShipmentCarrier(shipmentData);
            } else {
                carrierInfo = { name: carrier, type: carrier };
            }
        } else {
            // Use provided carrier
            carrierInfo = { name: carrier, type: carrier };
        }

        if (!carrierInfo || !carrierInfo.name) {
            return {
                success: false,
                statusCode: 400,
                error: 'Could not determine carrier'
            };
        }

        // Get carrier configuration
        const carrierConfig = await getCarrierConfig(carrierInfo.name);
        if (!carrierConfig) {
            return {
                success: false,
                statusCode: 404,
                error: `Carrier configuration not found for: ${carrierInfo.name}`
            };
        }

        // Determine the correct tracking identifier
        let trackingIdentifier = trackingNumber;
        
        // For eShip Plus, use booking reference number if available
        if (carrierInfo.name.toLowerCase().includes('eshipplus') || carrierInfo.name.includes('eship')) {
            // Match the logic from ShipmentDetail.jsx - prioritize proNumber/confirmationNumber
            trackingIdentifier = shipmentData?.carrierBookingConfirmation?.proNumber ||
                               shipmentData?.carrierBookingConfirmation?.confirmationNumber ||
                               bookingReferenceNumber || 
                               shipmentData?.selectedRate?.BookingReferenceNumber || 
                               shipmentData?.bookingReferenceNumber ||
                               trackingNumber;
            
            logger.info(`Using eShip Plus identifier: ${trackingIdentifier} (type: ${
                shipmentData?.carrierBookingConfirmation?.proNumber ? 'proNumber' :
                shipmentData?.carrierBookingConfirmation?.confirmationNumber ? 'confirmationNumber' :
                bookingReferenceNumber ? 'bookingReferenceNumber from request' :
                'other'
            })`);
        }
        // For Canpar, use barcode from selected rate
        else if (carrierInfo.name.toLowerCase().includes('canpar')) {
            trackingIdentifier = shipmentData?.selectedRate?.TrackingNumber ||
                               shipmentData?.selectedRate?.Barcode ||
                               shipmentData?.trackingNumber ||
                               trackingNumber;
            
            logger.info(`Using Canpar barcode: ${trackingIdentifier}`);
        }

        // Check status based on carrier
        let statusResult;
        const carrierName = carrierInfo.name.toLowerCase();

        logger.info(`Checking status for carrier: "${carrierInfo.name}" (normalized: "${carrierName}") with tracking identifier: ${trackingIdentifier}`);

        if (carrierName.includes('eshipplus') || carrierName.includes('eship') || carrierName.includes('e-ship')) {
            statusResult = await checkEShipPlusStatus(trackingIdentifier, carrierConfig);
        } else if (carrierName.includes('canpar')) {
            statusResult = await checkCanparStatus(trackingIdentifier, carrierConfig);
        } else if (carrierName.includes('fedex')) {
            statusResult = await checkFedExStatus(trackingIdentifier, carrierConfig);
        } else if (carrierName.includes('ups')) {
            statusResult = await checkUPSStatus(trackingIdentifier, carrierConfig);
        } else if (carrierName.includes('polaris') || carrierInfo.name.includes('POLARISTRANSPORTATION') || carrierConfig?.carrierID === 'POLARISTRANSPORTATION') {
            logger.info(`Detected Polaris Transportation shipment - calling checkPolarisTransportationStatus`);
            statusResult = await checkPolarisTransportationStatus(trackingIdentifier, carrierConfig);
        } else {
            logger.error(`Unsupported carrier detected: "${carrierInfo.name}" (normalized: "${carrierName}")`);
            return {
                success: false,
                statusCode: 400,
                error: `Unsupported carrier: ${carrierInfo.name}`
            };
        }

        // Update shipment with new status if it has changed and shipmentId was provided
        if (shipmentId && shipmentData && statusResult.status !== shipmentData.status) {
            logger.info(`Status changed from ${shipmentData.status} to ${statusResult.status} for shipment ${shipmentId}`);
            
            // Clean the status result for Firestore storage
            const cleanStatusResult = Object.keys(statusResult).reduce((acc, key) => {
                const value = statusResult[key];
                if (value !== null && value !== undefined) {
                    // Convert functions to string representation if any
                    if (typeof value === 'function') {
                        acc[key] = '[Function]';
                    } else {
                        acc[key] = value;
                    }
                }
                return acc;
            }, {});

            const updateData = {
                status: statusResult.status,
                statusLastChecked: new Date(),
                carrierTrackingData: cleanStatusResult
            };

            // Add estimated delivery if available
            if (statusResult.estimatedDelivery) {
                updateData.estimatedDelivery = new Date(statusResult.estimatedDelivery);
            }

            // Add actual delivery if available
            if (statusResult.actualDelivery) {
                updateData.actualDelivery = new Date(statusResult.actualDelivery);
            }

            await db.collection('shipments').doc(shipmentId).update(updateData);
            logger.info(`Updated shipment ${shipmentId} with new status: ${statusResult.status}`);
            
            // Record the status change event with proper validation and duplicate prevention
            try {
                const { recordStatusChange, getShipmentEvents } = require('./utils/shipmentEvents');
                
                // Normalize status values to handle undefined/null cases
                const fromStatus = shipmentData.status || 'unknown';
                const toStatus = statusResult.status || 'unknown';
                
                // Only record the event if we have valid status values and they're actually different
                if (fromStatus !== toStatus && toStatus !== 'unknown') {
                    // Check for recent duplicate events (within last 5 minutes)
                    const recentEvents = await getShipmentEvents(shipmentId);
                    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                    
                    const isDuplicate = recentEvents.some(event => {
                        const eventTime = new Date(event.timestamp);
                        return (
                            event.eventType === 'status_update' &&
                            event.metadata?.statusChange?.from === fromStatus &&
                            event.metadata?.statusChange?.to === toStatus &&
                            eventTime > fiveMinutesAgo
                        );
                    });
                    
                    if (!isDuplicate) {
                        await recordStatusChange(
                            shipmentId,
                            fromStatus,
                            toStatus,
                            null,
                            'Status updated via carrier API check'
                        );
                        logger.info(`Recorded status change event for shipment ${shipmentId}: ${fromStatus} -> ${toStatus}`);
                    } else {
                        logger.info(`Skipped duplicate status change event for shipment ${shipmentId}: ${fromStatus} -> ${toStatus}`);
                    }
                } else {
                    logger.info(`Skipped recording status change event for shipment ${shipmentId}: invalid or unchanged status (${fromStatus} -> ${toStatus})`);
                }
            } catch (eventError) {
                logger.error('Error recording status change event:', eventError);
                // Don't fail the status check for event recording errors
            }
        }

        return statusResult;

    } catch (error) {
        logger.error('Error in checkShipmentStatusInternal:', error);
        return {
            success: false,
            statusCode: 500,
            error: 'Internal server error',
            details: error.message
        };
    }
}

// Export the internal function for use by polling system
exports.checkShipmentStatusInternal = checkShipmentStatusInternal;

/**
 * Get carrier configuration from Firestore
 */
async function getCarrierConfig(carrierKey) {
    try {
        // Normalize carrier key to handle variations
        const normalizeCarrierKey = (key) => {
            const normalized = key.toUpperCase();
            // Handle common variations
            if (normalized.includes('CANPAR')) return 'CANPAR';
            if (normalized.includes('ESHIP') || normalized.includes('E-SHIP')) return 'ESHIPPLUS';
            if (normalized.includes('FEDEX')) return 'FEDEX';
            if (normalized.includes('UPS')) return 'UPS';
            if (normalized.includes('DHL')) return 'DHL';
            if (normalized.includes('PUROLATOR')) return 'PUROLATOR';
            if (normalized.includes('CANADA POST')) return 'CANADAPOST';
            if (normalized.includes('USPS')) return 'USPS';
            if (normalized.includes('POLARIS')) return 'POLARISTRANSPORTATION';
            return normalized;
        };

        const normalizedKey = normalizeCarrierKey(carrierKey);
        logger.info(`Looking for carrier config with key: ${normalizedKey} (original: ${carrierKey})`);

        const carriersRef = db.collection('carriers');
        
        // First try with carrierKey
        let snapshot = await carriersRef
            .where('carrierKey', '==', normalizedKey)
            .where('enabled', '==', true)
            .limit(1)
            .get();

        // If not found, try with carrierID
        if (snapshot.empty) {
            logger.info(`No carrier found with carrierKey, trying carrierID: ${normalizedKey}`);
            snapshot = await carriersRef
                .where('carrierID', '==', normalizedKey)
                .where('enabled', '==', true)
                .limit(1)
                .get();
        }

        if (snapshot.empty) {
            logger.warn(`No enabled carrier found for key/ID: ${normalizedKey} (original: ${carrierKey})`);
            return null;
        }

        const carrierDoc = snapshot.docs[0];
        const carrierData = carrierDoc.data();

        logger.info(`Found carrier config for: ${normalizedKey} (original: ${carrierKey})`);
        logger.info(`Carrier config:`, {
            id: carrierData.id || carrierDoc.id,
            name: carrierData.name,
            enabled: carrierData.enabled,
            hasApiCredentials: !!carrierData.apiCredentials,
            hostURL: carrierData.apiCredentials?.hostURL
        });
        
        return carrierData;

    } catch (error) {
        logger.error(`Error getting carrier config for ${carrierKey}:`, error);
        return null;
    }
}

/**
 * Determine carrier from shipment data
 */
function getShipmentCarrier(shipmentData) {
    try {
        // Try to get carrier from selected rate
        if (shipmentData.selectedRate?.CarrierName) {
            return {
                name: shipmentData.selectedRate.CarrierName,
                type: shipmentData.selectedRate.CarrierName.toLowerCase()
            };
        }
        
        // Try to get from carrier field
        if (shipmentData.carrier) {
            return {
                name: shipmentData.carrier,
                type: shipmentData.carrier.toLowerCase()
            };
        }
        
        // Try to get from rate data
        if (shipmentData.rates && shipmentData.rates.length > 0) {
            const firstRate = shipmentData.rates[0];
            if (firstRate.CarrierName) {
                return {
                    name: firstRate.CarrierName,
                    type: firstRate.CarrierName.toLowerCase()
                };
            }
        }
        
        logger.warn('Could not determine carrier from shipment data');
        return null;
        
    } catch (error) {
        logger.error('Error determining carrier from shipment data:', error);
        return null;
    }
}

/**
 * Check eShip Plus shipment status
 */
async function checkEShipPlusStatus(trackingNumber, carrierConfig) {
    try {
        logger.info(`Checking eShip Plus status for tracking number: ${trackingNumber}`);

        if (!carrierConfig.apiCredentials) {
            throw new Error('eShip Plus API credentials not configured');
        }

        // Use the new eShip Plus status checker
        const statusResult = await getEShipPlusStatus(trackingNumber, carrierConfig.apiCredentials);

        // Make sure trackingNumber is not undefined - use the booking reference we passed in
        return {
            success: true,
            carrier: 'eshipplus',
            trackingNumber: statusResult.trackingNumber || trackingNumber, // Fallback to input tracking number
            bookingReferenceNumber: trackingNumber, // Store the booking reference
            ...statusResult
        };

    } catch (error) {
        logger.error(`Error checking eShip Plus status:`, error);
        return {
            success: false,
            carrier: 'eshipplus',
            trackingNumber: trackingNumber, // Use the input tracking number
            bookingReferenceNumber: trackingNumber,
            error: error.message,
            status: 'unknown',
            statusDisplay: 'Unknown'
        };
    }
}

/**
 * Check Canpar shipment status
 */
async function checkCanparStatus(trackingNumber, carrierConfig) {
    try {
        logger.info(`Checking Canpar status for tracking number: ${trackingNumber}`);

        if (!carrierConfig.apiCredentials) {
            throw new Error('Canpar API credentials not configured');
        }

        // Use the new Canpar status checker
        const statusResult = await getCanparStatus(trackingNumber, carrierConfig.apiCredentials);

        return {
            success: true,
            carrier: 'canpar',
            trackingNumber,
            ...statusResult
        };

    } catch (error) {
        logger.error(`Error checking Canpar status:`, error);
        return {
            success: false,
            carrier: 'canpar',
            trackingNumber,
            error: error.message,
            status: 'unknown',
            statusDisplay: 'Unknown'
        };
    }
}

/**
 * Placeholder for FedEx status checking
 */
async function checkFedExStatus(trackingNumber, carrierConfig) {
    // TODO: Implement FedEx status checking
    logger.info(`FedEx status check requested for: ${trackingNumber}`);
    
    return {
        status: 'Unknown',
        location: '',
        timestamp: new Date().toISOString(),
        statusHistory: [],
        trackingUpdates: [],
        carrier: 'FEDEX',
        message: 'FedEx status checking not yet implemented'
    };
}

/**
 * Placeholder for UPS status checking
 */
async function checkUPSStatus(trackingNumber, carrierConfig) {
    // TODO: Implement UPS status checking
    logger.info(`UPS status check requested for: ${trackingNumber}`);
    
    return {
        status: 'Unknown',
        location: '',
        timestamp: new Date().toISOString(),
        statusHistory: [],
        trackingUpdates: [],
        carrier: 'UPS',
        message: 'UPS status checking not yet implemented'
    };
}

/**
 * Check Polaris Transportation shipment status
 */
async function checkPolarisTransportationStatus(trackingNumber, carrierConfig) {
    try {
        logger.info(`Checking Polaris Transportation status for tracking number: ${trackingNumber}`);
        logger.info(`Carrier config details:`, {
            hasApiCredentials: !!carrierConfig?.apiCredentials,
            carrierID: carrierConfig?.carrierID,
            name: carrierConfig?.name,
            hostURL: carrierConfig?.apiCredentials?.hostURL,
            hasEndpoints: !!carrierConfig?.apiCredentials?.endpoints,
            hasSecret: !!carrierConfig?.apiCredentials?.secret
        });

        if (!carrierConfig || !carrierConfig.apiCredentials) {
            throw new Error('Polaris Transportation API credentials not configured');
        }

        const credentials = carrierConfig.apiCredentials;

        // Get URL components from credentials
        const baseUrl = credentials.hostURL;
        const endpoint = credentials.endpoints?.tracking;
        const apiKey = credentials.secret; // API key is stored in 'secret' field
        
        if (!baseUrl) {
            throw new Error('Polaris Transportation hostURL not configured in carrier settings');
        }
        
        if (!endpoint) {
            throw new Error('Polaris Transportation tracking endpoint not configured in carrier settings');
        }

        if (!apiKey) {
            throw new Error('Polaris Transportation API key (secret) not configured in carrier settings');
        }
        
        // Build full URL with query parameters (GET request)
        const cleanBaseUrl = baseUrl.replace(/\/$/, '');
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const baseApiUrl = `${cleanBaseUrl}${cleanEndpoint}`;
        
        // Add query parameters for Polaris API: APIKey and Probill
        const url = `${baseApiUrl}?APIKey=${encodeURIComponent(apiKey)}&Probill=${encodeURIComponent(trackingNumber)}`;

        logger.info(`Polaris Transportation tracking URL: ${url.replace(apiKey, '[REDACTED]')}`);

        // Make the GET API call (no body, no special headers needed)
        const response = await axios.get(url, {
            timeout: 30000,
            validateStatus: function (status) {
                return status < 600;
            }
        });

        logger.info(`Polaris Transportation response status: ${response.status}`);
        
        // Check for HTTP errors
        if (response.status >= 400) {
            // Handle test API errors (like JMS ConnectionFactory issues)
            if (response.status >= 500) {
                const errorText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                if (errorText.includes('javax.jms.ConnectionFactory') || errorText.includes('TRACEREST')) {
                    logger.warn(`Polaris test API error (${response.status}): ${errorText}`);
                    return {
                        success: true, // Don't fail the request, just return unknown status
                        carrier: 'polaris',
                        trackingNumber,
                        status: 'unknown',
                        statusDisplay: 'Test API Unavailable',
                        lastUpdated: new Date().toISOString(),
                        message: 'Test API unavailable - status checking will work in production environment'
                    };
                }
            }
            throw new Error(`API request failed - ${response.status} ${response.statusText}`);
        }

        const statusData = response.data;
        logger.info(`Polaris Transportation response data:`, statusData);

        // Handle raw error text responses (test API issues)
        if (typeof statusData === 'string' && statusData.includes('javax.jms.ConnectionFactory')) {
            logger.warn(`Polaris test API JMS error: ${statusData}`);
            return {
                success: true,
                carrier: 'polaris',
                trackingNumber,
                status: 'unknown',
                statusDisplay: 'Test API Unavailable',
                lastUpdated: new Date().toISOString(),
                message: 'Test API unavailable - status checking will work in production environment'
            };
        }

        // If no data or empty response
        if (!statusData) {
            logger.warn('Empty response from Polaris Transportation API');
            return {
                success: true,
                carrier: 'polaris',
                trackingNumber,
                status: 'unknown',
                statusDisplay: 'No Response',
                lastUpdated: new Date().toISOString(),
                message: 'No tracking data available'
            };
        }

        // Check for API errors in the response
        if (statusData.Error || (statusData.TRACE_API_Response && statusData.TRACE_API_Response.Error)) {
            throw new Error(`Polaris Transportation API Error: ${statusData.Error || statusData.TRACE_API_Response?.Error || 'Unknown error'}`);
        }

        // Check if we have the expected response structure
        if (!statusData.TRACE_API_Response) {
            throw new Error('Invalid response format from Polaris Transportation API - missing TRACE_API_Response');
        }

        // Handle "not found" responses from production API
        const traceResponse = statusData.TRACE_API_Response;
        if (traceResponse.Message && traceResponse.Message.includes('could not be found')) {
            logger.info(`Polaris shipment not found: ${traceResponse.Message}`);
            return {
                success: true,
                carrier: 'polaris', 
                trackingNumber,
                status: 'unknown',
                statusDisplay: 'Not Found',
                lastUpdated: new Date().toISOString(),
                message: traceResponse.Message || 'Shipment not found in carrier system'
            };
        }

        // Handle test responses with all null values
        if (!traceResponse.Current_Status && !traceResponse.Probill_Number && !traceResponse.Origin) {
            logger.info('Polaris response contains no tracking data (likely test environment)');
            return {
                success: true,
                carrier: 'polaris',
                trackingNumber,
                status: 'unknown', 
                statusDisplay: 'No Data',
                lastUpdated: new Date().toISOString(),
                message: traceResponse.Message || 'No tracking data available (test environment)'
            };
        }

        // Map to universal format
        const universalStatus = mapPolarisStatusToUniversal(statusData, trackingNumber);
        
        logger.info(`Mapped Polaris status to:`, { status: universalStatus.status });
        
        return {
            success: true,
            carrier: 'polaris',
            trackingNumber,
            ...universalStatus
        };

    } catch (error) {
        logger.error(`Error checking Polaris Transportation status:`, {
            error: error.message,
            stack: error.stack,
            trackingNumber,
            carrierConfigPresent: !!carrierConfig,
            apiCredentialsPresent: !!carrierConfig?.apiCredentials
        });
        return {
            success: false,
            carrier: 'polaris',
            trackingNumber,
            error: error.message,
            status: 'unknown',
            statusDisplay: 'Unknown'
        };
    }
}

/**
 * Map Polaris Transportation status response to universal format
 */
function mapPolarisStatusToUniversal(polarisData, trackingNumber) {
    // Status mapping for Polaris Transportation
    const POLARIS_STATUS_MAP = {
        // Booking and scheduling statuses
        'BOOKED': 'booked',
        'SCHEDULED': 'scheduled',
        'PICKUP_SCHEDULED': 'scheduled',
        'READY_FOR_PICKUP': 'scheduled',
        
        // In transit statuses
        'PICKED_UP': 'in_transit',
        'IN_TRANSIT': 'in_transit',
        'OUT_FOR_DELIVERY': 'in_transit',
        'ON_TRUCK': 'in_transit',
        'AT_TERMINAL': 'in_transit',
        'CUSTOMS_CLEARED': 'in_transit', // From the example response
        'CUSTOMS_PROCESSING': 'in_transit',
        
        // Delivery statuses
        'DELIVERED': 'delivered',
        'COMPLETED': 'delivered',
        'POD_RECEIVED': 'delivered',
        
        // Problem statuses
        'CANCELLED': 'canceled',
        'CANCELED': 'canceled',
        'ON_HOLD': 'on_hold',
        'DELAYED': 'on_hold',
        'EXCEPTION': 'on_hold',
        'DAMAGED': 'on_hold',
        'REFUSED': 'on_hold',
        'CUSTOMS_HELD': 'on_hold'
    };

    // Get the shipment info from the TRACE_API_Response wrapper
    const traceResponse = polarisData.TRACE_API_Response;
    
    if (!traceResponse) {
        logger.warn('No TRACE_API_Response found in Polaris data');
        return {
            trackingNumber,
            status: 'unknown',
            statusDisplay: 'Unknown',
            lastUpdated: new Date().toISOString()
        };
    }

    let universalStatus = 'unknown';

    // Determine status from Current_Status field
    if (traceResponse.Current_Status) {
        const normalizedStatus = traceResponse.Current_Status.toUpperCase();
        if (POLARIS_STATUS_MAP[normalizedStatus]) {
            universalStatus = POLARIS_STATUS_MAP[normalizedStatus];
        } else {
            logger.warn(`Unknown Polaris status: ${traceResponse.Current_Status}`);
            // If we have delivery info, assume delivered
            if (traceResponse.Actual_Delivery || traceResponse.POD_signed_date) {
                universalStatus = 'delivered';
            }
            // If we have pickup info but no delivery, assume in transit
            else if (traceResponse.Actual_Pickup) {
                universalStatus = 'in_transit';
            }
        }
    }

    // Override based on actual delivery/pickup dates
    if (traceResponse.Actual_Delivery || traceResponse.POD_signed_date) {
        universalStatus = 'delivered';
    } else if (traceResponse.Actual_Pickup && universalStatus === 'unknown') {
        universalStatus = 'in_transit';
    }

    // Status display names
    const displayNames = {
        'draft': 'Draft',
        'pending': 'Pending',
        'scheduled': 'Scheduled',
        'booked': 'Booked',
        'awaiting_shipment': 'Awaiting Shipment',
        'in_transit': 'In Transit',
        'delivered': 'Delivered',
        'on_hold': 'On Hold',
        'canceled': 'Canceled',
        'cancelled': 'Cancelled',
        'void': 'Void',
        'unknown': 'Unknown'
    };

    // Parse dates safely
    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        try {
            return new Date(dateStr).toISOString();
        } catch (error) {
            logger.warn(`Failed to parse date: ${dateStr}`);
            return null;
        }
    };

    return {
        trackingNumber: traceResponse.Probill_Number || trackingNumber,
        status: universalStatus,
        statusDisplay: displayNames[universalStatus] || universalStatus,
        lastUpdated: new Date().toISOString(),
        
        // Delivery information
        estimatedDelivery: parseDate(traceResponse.Deliver_by),
        actualDelivery: parseDate(traceResponse.Actual_Delivery),
        
        // Pickup information
        estimatedPickup: parseDate(traceResponse.Pickup_by),
        actualPickup: parseDate(traceResponse.Actual_Pickup),
        
        // Location and status details
        currentLocation: traceResponse.Current_Location || '',
        currentStatus: traceResponse.Current_Status || '',
        
        // Additional shipment details
        origin: traceResponse.Origin || '',
        destination: traceResponse.Destination || '',
        
        // Proof of delivery
        podSignedBy: traceResponse.POD_signed_by || null,
        podSignedDate: parseDate(traceResponse.POD_signed_date),
        
        // Shipment details
        pallets: traceResponse.Pallets || '',
        weight: traceResponse.Weight_LBS || '',
        
        // Carrier-specific info
        carrierInfo: {
            carrierName: 'Polaris Transportation',
            carrierCode: 'POLT',
            serviceType: 'LTL Freight',
            trackingNumber: traceResponse.Probill_Number || trackingNumber,
            proNumber: traceResponse.Probill_Number || trackingNumber,
            
            // Raw response for debugging
            rawStatus: traceResponse.Current_Status,
            customsDocReceived: traceResponse.Customs_Doc_Rcv === 'True',
            trackingUrl: traceResponse.Message || null
        }
    };
} 