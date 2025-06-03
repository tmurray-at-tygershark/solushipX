/**
 * Universal Tracking Service
 * Handles tracking for shipments using shipment IDs and carrier-agnostic APIs
 */

import { db, functions } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

/**
 * Track shipment by shipment ID or tracking number
 * @param {string} identifier - Shipment ID or tracking number
 * @returns {Promise<Object>} - Tracking result
 */
export async function trackShipment(identifier) {
    try {
        console.log(`Tracking shipment: ${identifier}`);

        // Try to determine if this is a shipment ID or tracking number
        const isShipmentId = identifier.includes('-') && (identifier.includes('IC-') || identifier.length > 15);
        
        let shipmentData = null;
        let trackingInfo = null;

        if (isShipmentId) {
            // Handle shipment ID lookup
            trackingInfo = await trackByShipmentId(identifier);
        } else {
            // Handle direct tracking number lookup
            trackingInfo = await trackByTrackingNumber(identifier);
        }

        return trackingInfo;

    } catch (error) {
        console.error('Error in trackShipment:', error);
        return {
            success: false,
            error: error.message,
            identifier
        };
    }
}

/**
 * Track shipment by shipment ID
 * @param {string} shipmentId - The primary shipment ID
 * @returns {Promise<Object>} - Tracking result
 */
async function trackByShipmentId(shipmentId) {
    try {
        // First, get the shipment data from Firestore
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);

        if (!shipmentDoc.exists()) {
            // Try to find by shipmentID field
            const shipmentsRef = collection(db, 'shipments');
            const q = query(shipmentsRef, where('shipmentID', '==', shipmentId));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                throw new Error(`Shipment not found: ${shipmentId}`);
            }

            const foundDoc = querySnapshot.docs[0];
            const shipmentData = { id: foundDoc.id, ...foundDoc.data() };
            return await getTrackingFromShipmentData(shipmentData);
        }

        const shipmentData = { id: shipmentDoc.id, ...shipmentDoc.data() };
        return await getTrackingFromShipmentData(shipmentData);

    } catch (error) {
        console.error('Error tracking by shipment ID:', error);
        throw error;
    }
}

/**
 * Track shipment by tracking number (direct lookup)
 * @param {string} trackingNumber - The carrier tracking number
 * @returns {Promise<Object>} - Tracking result
 */
async function trackByTrackingNumber(trackingNumber) {
    try {
        console.log(`Attempting to track by raw tracking number: ${trackingNumber}`);
        let trackingResult = {
            success: false,
            type: 'tracking_number',
            identifier: trackingNumber,
            events: [],
            carrier: null,
            error: null
        };

        // Try Canpar first
        try {
            console.log(`Tracking ${trackingNumber} with Canpar...`);
            const getHistoryCanpar = httpsCallable(functions, 'getHistoryCanpar');
            const canparResponse = await getHistoryCanpar({ trackingNumber });

            if (canparResponse.data && canparResponse.data.success && canparResponse.data.trackingUpdates && canparResponse.data.trackingUpdates.length > 0) {
                console.log('Canpar success:', canparResponse.data);
                trackingResult = {
                    ...trackingResult,
                    success: true,
                    carrier: 'Canpar',
                    events: canparResponse.data.trackingUpdates,
                    status: canparResponse.data.currentStatus || (canparResponse.data.trackingUpdates[0]?.status || 'In Transit'), // Best guess for overall status
                    statusDetails: canparResponse.data.currentStatusDetails || (canparResponse.data.trackingUpdates[0]?.description || '-'),
                    rawResponse: canparResponse.data
                };
                return trackingResult;
            } else if (canparResponse.data && !canparResponse.data.success) {
                console.warn(`Canpar attempt for ${trackingNumber} failed or no data:`, canparResponse.data.error);
            }
        } catch (canparError) {
            console.warn(`Error calling getHistoryCanpar for ${trackingNumber}:`, canparError.message);
        }

        // If Canpar fails or no data, try eShipPlus
        try {
            console.log(`Tracking ${trackingNumber} with eShipPlus...`);
            const getHistoryEShipPlus = httpsCallable(functions, 'getHistoryEShipPlus');
            const eshipplusResponse = await getHistoryEShipPlus({ shipmentNumber: trackingNumber });

            // eShipPlus responses are wrapped in { data: { success: ..., trackingUpdates: ...}}
            if (eshipplusResponse.data && eshipplusResponse.data.data?.success && eshipplusResponse.data.data.trackingUpdates && eshipplusResponse.data.data.trackingUpdates.length > 0) {
                console.log('eShipPlus success:', eshipplusResponse.data.data);
                trackingResult = {
                    ...trackingResult,
                    success: true,
                    carrier: 'eShipPlus',
                    events: eshipplusResponse.data.data.trackingUpdates,
                    status: eshipplusResponse.data.data.currentStatus || (eshipplusResponse.data.data.trackingUpdates[0]?.status || 'In Transit'),
                    statusDetails: eshipplusResponse.data.data.currentStatusDetails || (eshipplusResponse.data.data.trackingUpdates[0]?.description || '-'),
                    rawResponse: eshipplusResponse.data.data
                };
                return trackingResult;
            } else if (eshipplusResponse.data && eshipplusResponse.data.data && !eshipplusResponse.data.data.success) {
                 console.warn(`eShipPlus attempt for ${trackingNumber} failed or no data:`, eshipplusResponse.data.data.error || eshipplusResponse.data.error);
            } else if (eshipplusResponse.data && eshipplusResponse.data.error) {
                 console.warn(`eShipPlus attempt for ${trackingNumber} returned top-level error:`, eshipplusResponse.data.error);
            }

        } catch (eshipplusError) {
            console.warn(`Error calling getHistoryEShipPlus for ${trackingNumber}:`, eshipplusError.message);
        }
        
        // If neither worked
        if (!trackingResult.success) {
            trackingResult.error = `Could not determine carrier or no tracking information found for ${trackingNumber}.`;
            console.log(trackingResult.error);
            throw new Error(trackingResult.error);
        }
        
        // This part should ideally not be reached if one of the above returns
        return trackingResult; 

    } catch (error) {
        console.error('Error in trackByTrackingNumber service:', error.message);
        // Ensure the thrown error is an instance of Error for consistent handling upstream
        if (error instanceof Error) {
            throw error;
        } else {
            throw new Error(error.message || 'Failed to track by tracking number due to an unexpected issue.');
        }
    }
}

/**
 * Extract tracking information from shipment data
 * @param {Object} shipmentData - Complete shipment data from Firestore
 * @returns {Promise<Object>} - Tracking result
 */
async function getTrackingFromShipmentData(shipmentData) {
    try {
        console.log('Getting tracking from shipment data:', shipmentData.id);

        // First try to determine carrier from shipment data
        let carrierInfo = determineCarrier(shipmentData);
        
        // If no carrier found in shipment, check shipmentRates collection
        if (!carrierInfo) {
            console.log('No carrier found in shipment data, checking shipmentRates collection...');
            carrierInfo = await getCarrierFromShipmentRates(shipmentData.id, shipmentData.shipmentID);
        }
        
        if (!carrierInfo) {
            // Return detailed error with shipment info for debugging
            return {
                success: false,
                error: `Could not determine carrier for shipment ${shipmentData.id || shipmentData.shipmentID}. Please check that the shipment has carrier information saved.`,
                identifier: shipmentData.shipmentID || shipmentData.id,
                shipmentData: {
                    id: shipmentData.id,
                    shipmentID: shipmentData.shipmentID,
                    status: shipmentData.status,
                    createdAt: shipmentData.createdAt,
                    shipFrom: shipmentData.shipFrom,
                    shipTo: shipmentData.shipTo,
                    selectedRate: shipmentData.selectedRate,
                    selectedRateRef: shipmentData.selectedRateRef,
                    carrier: shipmentData.carrier,
                    rates: shipmentData.rates,
                    availableKeys: Object.keys(shipmentData),
                    allFieldsPreview: Object.fromEntries(
                        Object.keys(shipmentData).map(key => [
                            key, 
                            typeof shipmentData[key] === 'object' && shipmentData[key] !== null 
                                ? `[${typeof shipmentData[key]}] ${Array.isArray(shipmentData[key]) ? `Array(${shipmentData[key].length})` : 'Object'}`
                                : shipmentData[key]
                        ])
                    )
                },
                debugInfo: {
                    hasSelectedRate: !!shipmentData.selectedRate,
                    hasSelectedRateRef: !!shipmentData.selectedRateRef,
                    hasCarrierField: !!shipmentData.carrier,
                    hasRates: !!(shipmentData.rates && shipmentData.rates.length > 0),
                    availableFields: `Available Fields (${Object.keys(shipmentData).length}): ${Object.keys(shipmentData).join(', ')}`,
                    fieldTypes: Object.fromEntries(
                        Object.keys(shipmentData).map(key => [key, typeof shipmentData[key]])
                    ),
                    allShipmentFieldsPreview: Object.fromEntries(
                        Object.keys(shipmentData).map(key => [
                            key, 
                            typeof shipmentData[key] === 'object' && shipmentData[key] !== null 
                                ? `[${typeof shipmentData[key]}] ${Array.isArray(shipmentData[key]) ? `Array(${shipmentData[key].length})` : 'Object'}`
                                : shipmentData[key]
                        ])
                    ),
                    suggestion: shipmentData.status === 'booked' 
                        ? "This shipment shows as 'booked' but is missing rate information. The booking may have completed partially. Check the booking process or manually add carrier information."
                        : "The shipment may be missing carrier information. Check if the booking process completed successfully."
                }
            };
        }

        // Extract tracking identifiers using carrier info and potentially the rates data
        const trackingIdentifiers = await extractTrackingIdentifiers(shipmentData, carrierInfo);

        if (!trackingIdentifiers.primary) {
            const earlyStatuses = ['scheduled', 'pending', 'created', 'booked'];
            const currentStatus = shipmentData.status ? String(shipmentData.status).toLowerCase() : '';

            if (earlyStatuses.includes(currentStatus)) {
                console.log(`Shipment ${shipmentData.id || shipmentData.shipmentID} is in status '${shipmentData.status}' and no primary tracking ID found. Returning current status as event.`);
                
                let eventDate;
                if (shipmentData.statusTimestamp) { // Prefer a specific status timestamp if available
                    eventDate = shipmentData.statusTimestamp.toDate ? shipmentData.statusTimestamp.toDate() : new Date(shipmentData.statusTimestamp);
                } else if (shipmentData.updatedAt) { // Fallback to last document update
                    eventDate = shipmentData.updatedAt.toDate ? shipmentData.updatedAt.toDate() : new Date(shipmentData.updatedAt);
                } else { // Fallback to creation date
                    eventDate = shipmentData.createdAt.toDate();
                }
                const eventTimestampStr = eventDate.toISOString();

                return {
                    success: true,
                    type: 'shipment_id',
                    identifier: shipmentData.shipmentID || shipmentData.id,
                    shipmentData: {
                        id: shipmentData.id,
                        shipmentID: shipmentData.shipmentID,
                        status: shipmentData.status,
                        createdAt: shipmentData.createdAt,
                        shipFrom: shipmentData.shipFrom,
                        shipTo: shipmentData.shipTo,
                        selectedRate: shipmentData.selectedRate,
                        selectedRateRef: shipmentData.selectedRateRef
                    },
                    carrierInfo,
                    trackingIdentifiers, // Provide for context, even if primary is null
                    currentStatus: shipmentData.status, // Report current DB status
                    currentStatusDetails: `Shipment is ${shipmentData.status}. Live tracking updates from the carrier are not yet available.`,
                    events: [{
                        timestamp: eventTimestampStr,
                        status: shipmentData.status,
                        description: `Shipment status: ${shipmentData.status}.`,
                        location: shipmentData.shipFrom?.city || shipmentData.shipFrom?.country || 'Origin',
                        isCurrent: true 
                    }],
                    message: `Shipment is ${shipmentData.status}. Carrier tracking details will be available once the carrier processes the shipment.`
                };
            } else {
                // If status is beyond 'scheduled' etc., and still no tracking ID, then it's an error
                console.error(`No tracking identifier found for ${carrierInfo.name} shipment ${shipmentData.id || shipmentData.shipmentID} which is in status '${shipmentData.status}'. This is unexpected.`);
                return {
                    success: false,
                    error: `No tracking identifier found for ${carrierInfo.name} shipment ${shipmentData.id || shipmentData.shipmentID}. Current status: ${shipmentData.status}.`,
                    identifier: shipmentData.shipmentID || shipmentData.id,
                    carrierInfo,
                    shipmentData: {
                        id: shipmentData.id,
                        shipmentID: shipmentData.shipmentID,
                        status: shipmentData.status
                    },
                    debugInfo: {
                        carrierType: carrierInfo.type,
                        expectedFields: getExpectedTrackingFields(carrierInfo.type),
                        actualFieldsInSelectedRate: shipmentData.selectedRate ? Object.keys(shipmentData.selectedRate) : 'N/A',
                        trackingNumberOnShipmentDoc: shipmentData.trackingNumber || 'N/A',
                        rateDataUsedForExtraction: carrierInfo.rateData ? Object.keys(carrierInfo.rateData) : 'N/A'
                    }
                };
            }
        }

        // Call the universal status checking function
        const response = await fetch('https://checkshipmentstatus-xedyh5vw7a-uc.a.run.app', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                shipmentId: shipmentData.id,
                trackingNumber: trackingIdentifiers.primary,
                bookingReferenceNumber: trackingIdentifiers.bookingReference,
                carrier: carrierInfo.name
            })
        });

        const result = await response.json();
        
        if (result.success) {
            return {
                success: true,
                type: 'shipment_id',
                identifier: shipmentData.shipmentID || shipmentData.id,
                shipmentData: {
                    id: shipmentData.id,
                    shipmentID: shipmentData.shipmentID,
                    status: shipmentData.status,
                    createdAt: shipmentData.createdAt,
                    shipFrom: shipmentData.shipFrom,
                    shipTo: shipmentData.shipTo,
                    selectedRate: shipmentData.selectedRate,
                    selectedRateRef: shipmentData.selectedRateRef
                },
                carrierInfo,
                trackingIdentifiers,
                ...result
            };
        } else {
            throw new Error(result.error || 'Failed to get tracking information');
        }

    } catch (error) {
        console.error('Error getting tracking from shipment data:', error);
        throw error;
    }
}

/**
 * Get expected tracking fields for a carrier type
 * @param {string} carrierType - The carrier type
 * @returns {Array} - Expected field names
 */
function getExpectedTrackingFields(carrierType) {
    const fieldMap = {
        'eshipplus': ['BookingReferenceNumber', 'ShipmentNumber'],
        'eship plus': ['BookingReferenceNumber', 'ShipmentNumber'], // Adding alias
        'canpar': ['TrackingNumber', 'Barcode', 'ReferenceNumber'],
        'canpar express': ['TrackingNumber', 'Barcode', 'ReferenceNumber'], // Adding alias
        'fedex': ['TrackingNumber'],
        'ups': ['TrackingNumber'],
        'purolator': ['TrackingNumber']
    };
    return fieldMap[carrierType] || ['TrackingNumber'];
}

/**
 * Determine carrier from shipment data
 * @param {Object} shipmentData - Shipment data
 * @returns {Object|null} - Carrier information
 */
function determineCarrier(shipmentData) {
    console.log('Determining carrier from shipment data:', {
        id: shipmentData.id,
        selectedRateCarrierName: shipmentData.selectedRate?.CarrierName,
        selectedRateCarrier: shipmentData.selectedRate?.carrier,
        selectedRateRefCarrier: shipmentData.selectedRateRef?.CarrierName || shipmentData.selectedRateRef?.carrier,
        topLevelCarrier: shipmentData.carrier,
        ratesLength: shipmentData.rates?.length
    });

    // Try to get carrier from selected rate
    if (shipmentData.selectedRate?.CarrierName) {
        console.log('Found carrier from selectedRate.CarrierName:', shipmentData.selectedRate.CarrierName);
        return {
            name: shipmentData.selectedRate.CarrierName,
            displayName: shipmentData.selectedRate.CarrierName,
            type: shipmentData.selectedRate.CarrierName.toLowerCase().replace(/\s+/g, ''), // normalize type
            rateData: shipmentData.selectedRate
        };
    }
    
    // Try alternative selectedRate carrier field names
    if (shipmentData.selectedRate?.carrier) {
        console.log('Found carrier from selectedRate.carrier:', shipmentData.selectedRate.carrier);
        return {
            name: shipmentData.selectedRate.carrier,
            displayName: shipmentData.selectedRate.carrier,
            type: shipmentData.selectedRate.carrier.toLowerCase().replace(/\s+/g, ''), // normalize type
            rateData: shipmentData.selectedRate
        };
    }

    if (shipmentData.selectedRate?.Carrier) {
        console.log('Found carrier from selectedRate.Carrier:', shipmentData.selectedRate.Carrier);
        return {
            name: shipmentData.selectedRate.Carrier,
            displayName: shipmentData.selectedRate.Carrier,
            type: shipmentData.selectedRate.Carrier.toLowerCase().replace(/\s+/g, ''), // normalize type
            rateData: shipmentData.selectedRate
        };
    }
    
    // Try to get carrier from selectedRateRef
    if (shipmentData.selectedRateRef) {
        console.log('Checking selectedRateRef for carrier info:', shipmentData.selectedRateRef);
        const carrierFromRef = extractCarrierFromRate(shipmentData.selectedRateRef);
        if (carrierFromRef) {
            console.log('Found carrier from selectedRateRef:', carrierFromRef);
            return carrierFromRef;
        }
    }
    
    // Try to get from carrier field
    if (shipmentData.carrier) {
        console.log('Found carrier from carrier field:', shipmentData.carrier);
        return {
            name: shipmentData.carrier,
            displayName: shipmentData.carrier,
            type: shipmentData.carrier.toLowerCase().replace(/\s+/g, '') // normalize type
        };
    }
    
    // Try to get from rate data
    if (shipmentData.rates && shipmentData.rates.length > 0) {
        const firstRate = shipmentData.rates[0];
        if (firstRate.CarrierName) {
            console.log('Found carrier from rates[0].CarrierName:', firstRate.CarrierName);
            return {
                name: firstRate.CarrierName,
                displayName: firstRate.CarrierName,
                type: firstRate.CarrierName.toLowerCase().replace(/\s+/g, ''), // normalize type
                rateData: firstRate
            };
        }
        if (firstRate.carrier) {
            console.log('Found carrier from rates[0].carrier:', firstRate.carrier);
            return {
                name: firstRate.carrier,
                displayName: firstRate.carrier,
                type: firstRate.carrier.toLowerCase().replace(/\s+/g, ''), // normalize type
                rateData: firstRate
            };
        }
    }

    // Try to infer from shipment ID or other fields
    if (shipmentData.id || shipmentData.shipmentID) {
        const shipmentIdString = String(shipmentData.id || shipmentData.shipmentID).toUpperCase();
        if (shipmentIdString.includes('ESHIPPLUS') || shipmentIdString.includes('ESHIP')) {
            console.log('Inferred eShip Plus from shipment ID:', shipmentIdString);
            return {
                name: 'eShip Plus',
                displayName: 'eShip Plus', 
                type: 'eshipplus'
            };
        }
        if (shipmentIdString.includes('CANPAR')) {
            console.log('Inferred Canpar from shipment ID:', shipmentIdString);
            return {
                name: 'Canpar Express', // Use consistent name
                displayName: 'Canpar Express',
                type: 'canparexpress' // normalize type
            };
        }
    }

    // Check if there's any booking or tracking number that might indicate carrier
    if (shipmentData.selectedRate?.BookingReferenceNumber || shipmentData.bookingReferenceNumber) {
        console.log('Found booking reference, assuming eShip Plus:', shipmentData.selectedRate?.BookingReferenceNumber || shipmentData.bookingReferenceNumber);
        return {
            name: 'eShip Plus',
            displayName: 'eShip Plus',
            type: 'eshipplus',
            rateData: shipmentData.selectedRate
        };
    }

    // Log all available data for debugging
    console.error('Could not determine carrier. Available data:', {
        selectedRate: shipmentData.selectedRate,
        selectedRateRef: shipmentData.selectedRateRef,
        carrier: shipmentData.carrier,
        rates: shipmentData.rates,
        id: shipmentData.id,
        shipmentID: shipmentData.shipmentID,
        allKeys: Object.keys(shipmentData),
        allValues: Object.fromEntries(
            Object.keys(shipmentData).map(key => [
                key, 
                typeof shipmentData[key] === 'object' && shipmentData[key] !== null 
                    ? `[${typeof shipmentData[key]}] ${Array.isArray(shipmentData[key]) ? `Array(${shipmentData[key].length})` : 'Object'}`
                    : shipmentData[key]
            ])
        )
    });
    
    return null;
}

/**
 * Extract tracking identifiers based on carrier
 * @param {Object} shipmentData - Shipment data
 * @param {Object} carrierInfo - Carrier information
 * @returns {Promise<Object>} - Tracking identifiers
 */
async function extractTrackingIdentifiers(shipmentData, carrierInfo) {
    const identifiers = {
        primary: null,
        secondary: null,
        bookingReference: null,
        carrierSpecific: {}
    };

    if (!carrierInfo) return identifiers;

    const carrierName = carrierInfo.name.toLowerCase().replace(/\s+/g, ''); // normalize for comparison
    
    // First check if we have rate data from the carrier info
    let rateData = carrierInfo.rateData || shipmentData.selectedRate;
    
    // If no rate data in shipment, try to fetch from shipmentRates collection
    if (!rateData) {
        console.log('No rate data available, fetching from shipmentRates...');
        const ratesCarrierInfo = await getCarrierFromShipmentRates(shipmentData.id, shipmentData.shipmentID);
        if (ratesCarrierInfo && ratesCarrierInfo.rateData) {
            rateData = ratesCarrierInfo.rateData;
            console.log('Found rate data from shipmentRates collection');
        }
    }

    if (carrierName.includes('eshipplus') || carrierName.includes('eship')) {
        // eShip Plus uses booking reference number
        identifiers.primary = rateData?.BookingReferenceNumber || 
                             shipmentData.selectedRate?.BookingReferenceNumber ||
                             shipmentData.bookingReferenceNumber; // Check top-level field
        identifiers.bookingReference = identifiers.primary;
        identifiers.secondary = rateData?.ShipmentNumber || shipmentData.selectedRate?.ShipmentNumber || shipmentData.trackingNumber; // eShipPlus ShipmentNumber can act as tracking
        identifiers.carrierSpecific = {
            bookingReferenceNumber: identifiers.primary,
            shipmentNumber: identifiers.secondary
        };
    } else if (carrierName.includes('canpar')) {
        // Canpar uses barcode/tracking number
        identifiers.primary = rateData?.TrackingNumber ||
                             rateData?.Barcode ||
                             shipmentData.selectedRate?.TrackingNumber ||
                             shipmentData.selectedRate?.Barcode ||
                             shipmentData.trackingNumber; // Check top-level field
        identifiers.secondary = rateData?.ReferenceNumber || shipmentData.selectedRate?.ReferenceNumber;
        identifiers.carrierSpecific = {
            trackingNumber: identifiers.primary, // primary is usually the tracking number
            barcode: rateData?.Barcode || shipmentData.selectedRate?.Barcode, // explicit barcode
            referenceNumber: identifiers.secondary
        };
    } else if (carrierName.includes('fedex')) {
        // FedEx uses tracking number
        identifiers.primary = rateData?.TrackingNumber ||
                             shipmentData.selectedRate?.TrackingNumber ||
                             shipmentData.trackingNumber;
        identifiers.carrierSpecific = {
            trackingNumber: identifiers.primary
        };
    } else if (carrierName.includes('ups')) {
        // UPS uses tracking number
        identifiers.primary = rateData?.TrackingNumber ||
                             shipmentData.selectedRate?.TrackingNumber ||
                             shipmentData.trackingNumber;
        identifiers.carrierSpecific = {
            trackingNumber: identifiers.primary
        };
    } else {
        // Generic carrier - use tracking number
        identifiers.primary = shipmentData.trackingNumber ||
                             rateData?.TrackingNumber ||
                             shipmentData.selectedRate?.TrackingNumber;
    }

    console.log('Extracted tracking identifiers:', {
        carrier: carrierName,
        primary: identifiers.primary,
        hasRateData: !!rateData,
        rateDataKeys: rateData ? Object.keys(rateData) : []
    });

    return identifiers;
}

/**
 * Get shipment basic info without full tracking
 * @param {string} shipmentId - The shipment ID
 * @returns {Promise<Object>} - Basic shipment info
 */
export async function getShipmentInfo(shipmentId) {
    try {
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);

        if (!shipmentDoc.exists()) {
            // Try to find by shipmentID field
            const shipmentsRef = collection(db, 'shipments');
            const q = query(shipmentsRef, where('shipmentID', '==', shipmentId));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                throw new Error(`Shipment not found: ${shipmentId}`);
            }

            const foundDoc = querySnapshot.docs[0];
            return { id: foundDoc.id, ...foundDoc.data() };
        }

        return { id: shipmentDoc.id, ...shipmentDoc.data() };

    } catch (error) {
        console.error('Error getting shipment info:', error);
        throw error;
    }
}

/**
 * Get carrier information from shipmentRates collection
 * @param {string} firestoreDocId - The shipment document ID
 * @param {string} shipmentID - The shipment ID
 * @returns {Promise<Object|null>} - Carrier information
 */
async function getCarrierFromShipmentRates(firestoreDocId, shipmentID) {
    try {
        console.log('Fetching rates for shipment:', { firestoreDocId, shipmentID });
        
        // Try to find shipmentRates by firestoreDocId first
        let ratesDoc = null;
        
        if (firestoreDocId) {
            const ratesRef = doc(db, 'shipmentRates', firestoreDocId);
            const ratesSnapshot = await getDoc(ratesRef);
            if (ratesSnapshot.exists()) {
                ratesDoc = ratesSnapshot;
                console.log('Found rates by firestoreDocId:', firestoreDocId);
            }
        }
        
        // If not found and we have a shipmentID, try to find by shipmentID field
        if (!ratesDoc && shipmentID) {
            const ratesQuery = query(
                collection(db, 'shipmentRates'), 
                where('shipmentID', '==', shipmentID)
            );
            const ratesSnapshot = await getDocs(ratesQuery);
            
            if (!ratesSnapshot.empty) {
                ratesDoc = ratesSnapshot.docs[0];
                console.log('Found rates by shipmentID:', shipmentID);
            }
        }
        
        if (!ratesDoc) {
            console.log('No shipmentRates document found for:', { firestoreDocId, shipmentID });
            return null;
        }
        
        const ratesData = ratesDoc.data();
        console.log('Rates data found:', {
            hasRates: !!(ratesData.rates && ratesData.rates.length > 0),
            hasSelectedRate: !!ratesData.selectedRate,
            selectedRateIndex: ratesData.selectedRateIndex,
            ratesCount: ratesData.rates?.length || 0
        });
        
        // Try to get carrier from selected rate
        if (ratesData.selectedRate) {
            const carrierInfo = extractCarrierFromRate(ratesData.selectedRate);
            if (carrierInfo) {
                console.log('Found carrier from selected rate:', carrierInfo);
                return carrierInfo;
            }
        }
        
        // Try to get from selectedRateIndex
        if (ratesData.rates && ratesData.selectedRateIndex !== undefined) {
            const selectedRate = ratesData.rates[ratesData.selectedRateIndex];
            if (selectedRate) {
                const carrierInfo = extractCarrierFromRate(selectedRate);
                if (carrierInfo) {
                    console.log('Found carrier from indexed rate:', carrierInfo);
                    return carrierInfo;
                }
            }
        }
        
        // Try first rate if available
        if (ratesData.rates && ratesData.rates.length > 0) {
            const firstRate = ratesData.rates[0];
            const carrierInfo = extractCarrierFromRate(firstRate);
            if (carrierInfo) {
                console.log('Found carrier from first rate:', carrierInfo);
                return carrierInfo;
            }
        }
        
        console.log('Could not extract carrier from rates data');
        return null;
        
    } catch (error) {
        console.error('Error fetching carrier from shipmentRates:', error);
        return null;
    }
}

/**
 * Extract carrier information from a rate object
 * @param {Object} rate - Rate data
 * @returns {Object|null} - Carrier information
 */
function extractCarrierFromRate(rate) {
    if (!rate) return null;
    
    // Try different carrier field names
    const carrierNameValue = rate.CarrierName || 
                       rate.carrier || 
                       rate.Carrier ||
                       rate.carrierName ||
                       rate.service_name || // Some APIs use service_name
                       rate.serviceName;
    
    if (carrierNameValue) {
        // Standardize common carrier names
        let standardizedName = carrierNameValue;
        const lowerName = String(carrierNameValue).toLowerCase();
        if (lowerName.includes('eship')) standardizedName = 'eShip Plus';
        if (lowerName.includes('canpar')) standardizedName = 'Canpar Express';
        // Add more standardizations if needed

        return {
            name: standardizedName,
            displayName: standardizedName, // Use the standardized name for display
            type: standardizedName.toLowerCase().replace(/\s+/g, ''), // normalize type
            rateData: rate // Include the full rate data for tracking identifier extraction
        };
    }
    
    return null;
} 