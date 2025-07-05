import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { getRateDetailsByDocumentId, getRatesForShipment } from '../../../utils/rateUtils';
import { listenToShipmentEvents } from '../../../utils/shipmentEvents';

export const useShipmentData = (shipmentId) => {
    const [shipment, setShipment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [trackingRecords, setTrackingRecords] = useState([]);
    const [shipmentEvents, setShipmentEvents] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [carrierData, setCarrierData] = useState(null);
    const [detailedRateInfo, setDetailedRateInfo] = useState(null);
    const [allShipmentRates, setAllShipmentRates] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Fetch main shipment data
    useEffect(() => {
        const fetchShipment = async () => {
            if (!shipmentId) return;
            
            try {
                setLoading(true);
                console.log('ShipmentDetail: Fetching shipment with ID:', shipmentId);
                
                let shipmentData = null;
                let docId = null;

                // First attempt: Query by shipmentID field
                const shipmentsRef = collection(db, 'shipments');
                const q = query(shipmentsRef, where('shipmentID', '==', shipmentId), limit(1));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const docSnap = querySnapshot.docs[0];
                    docId = docSnap.id;
                    shipmentData = { id: docSnap.id, ...docSnap.data() };
                } else {
                    // Second attempt: Try direct document ID lookup
                    try {
                        const docRef = doc(db, 'shipments', shipmentId);
                        const docSnap = await getDoc(docRef);

                        if (docSnap.exists()) {
                            docId = docSnap.id;
                            shipmentData = { id: docSnap.id, ...docSnap.data() };
                        }
                    } catch (directLookupError) {
                        console.error('ShipmentDetail: Error in direct document lookup:', directLookupError);
                    }
                }

                if (shipmentData && docId) {
                    // Fetch tracking data
                    await fetchTrackingData(shipmentData);
                    
                    // Fetch rates
                    await fetchRateData(shipmentData, docId);
                    
                    // Fetch packages
                    await fetchPackageData(shipmentData, docId);

                    // Set tracking number based on carrier type
                    setTrackingNumber(shipmentData);

                    setShipment(shipmentData);
                    console.log('ShipmentDetail: Final shipmentData loaded');
                } else {
                    setError(`Shipment not found with ID: ${shipmentId}`);
                }
            } catch (err) {
                console.error('Error fetching shipment:', err);
                setError('Error loading shipment details');
                setTrackingRecords([]);
            } finally {
                setLoading(false);
            }
        };

        fetchShipment();
    }, [shipmentId, refreshTrigger]);

    // Listen to shipment events
    useEffect(() => {
        if (!shipment?.id && !shipment?.shipmentID) {
            setHistoryLoading(false);
            setShipmentEvents([]);
            return;
        }

        setHistoryLoading(true);
        const idToListen = shipment.id || shipment.shipmentID;

        const unsubscribe = listenToShipmentEvents(idToListen, (events) => {
            setShipmentEvents(events || []);
            setHistoryLoading(false);
        });

        return () => unsubscribe();
    }, [shipment?.id, shipment?.shipmentID]);

    // Computed values - MOVED UP: Define getBestRateInfo before it's used in carrier fetching
    const getBestRateInfo = useMemo(() => {
        // PRIORITY 1: Check if we have dual rate storage system data
        if (shipment?.selectedRate && (shipment?.actualRates || shipment?.markupRates)) {
            console.log('Using dual rate storage system data for rate display');
            
            // Use the selectedRate data which contains the complete rate information
            const selectedRate = shipment.selectedRate;
            
            // Check if it's in universal format
            if (selectedRate.carrier && selectedRate.pricing && selectedRate.transit) {
                return {
                    carrier: selectedRate.carrier.name,
                    service: selectedRate.service?.name || 'Standard',
                    totalCharges: selectedRate.pricing.total,
                    freightCharge: selectedRate.pricing.freight,
                    freightCharges: selectedRate.pricing.freight,
                    fuelCharge: selectedRate.pricing.fuel,
                    fuelCharges: selectedRate.pricing.fuel,
                    serviceCharges: selectedRate.pricing.service,
                    accessorialCharges: selectedRate.pricing.accessorial,
                    transitDays: selectedRate.transit.days,
                    estimatedDeliveryDate: selectedRate.transit.estimatedDelivery,
                    guaranteed: selectedRate.transit.guaranteed,
                    currency: selectedRate.pricing.currency,
                    _isUniversalFormat: true
                };
            }
            
            // Fallback for non-universal format selectedRate
            return {
                carrier: selectedRate.carrier?.name || selectedRate.carrierName || selectedRate.sourceCarrierName || 'Unknown',
                service: selectedRate.service?.name || selectedRate.serviceName || 'Standard',
                totalCharges: selectedRate.totalCharges || selectedRate.pricing?.total || 0,
                freightCharge: selectedRate.freightCharges || selectedRate.pricing?.freight || 0,
                freightCharges: selectedRate.freightCharges || selectedRate.pricing?.freight || 0,
                fuelCharge: selectedRate.fuelCharges || selectedRate.pricing?.fuel || 0,
                fuelCharges: selectedRate.fuelCharges || selectedRate.pricing?.fuel || 0,
                serviceCharges: selectedRate.serviceCharges || selectedRate.pricing?.service || 0,
                accessorialCharges: selectedRate.accessorialCharges || selectedRate.pricing?.accessorial || 0,
                transitDays: selectedRate.transitDays || selectedRate.transit?.days || 0,
                estimatedDeliveryDate: selectedRate.estimatedDeliveryDate || selectedRate.transit?.estimatedDelivery,
                guaranteed: selectedRate.guaranteed || selectedRate.transit?.guaranteed || false,
                currency: selectedRate.currency || selectedRate.pricing?.currency || 'USD'
            };
        }

        // PRIORITY 2: Legacy detailed rate info from separate rates collection
        if (detailedRateInfo) {
            if (detailedRateInfo.universalRateData) {
                const universal = detailedRateInfo.universalRateData;
                return {
                    carrier: universal.carrier?.name || detailedRateInfo.carrier,
                    service: universal.service?.name || detailedRateInfo.service,
                    totalCharges: universal.pricing?.total || detailedRateInfo.totalCharges,
                    freightCharge: universal.pricing?.freight || detailedRateInfo.freightCharges,
                    freightCharges: universal.pricing?.freight || detailedRateInfo.freightCharges,
                    fuelCharge: universal.pricing?.fuel || detailedRateInfo.fuelCharges,
                    fuelCharges: universal.pricing?.fuel || detailedRateInfo.fuelCharges,
                    serviceCharges: universal.pricing?.service || detailedRateInfo.serviceCharges,
                    accessorialCharges: universal.pricing?.accessorial || detailedRateInfo.accessorialCharges,
                    transitDays: universal.transit?.days || detailedRateInfo.transitDays,
                    estimatedDeliveryDate: universal.transit?.estimatedDelivery || detailedRateInfo.estimatedDeliveryDate,
                    guaranteed: universal.transit?.guaranteed || detailedRateInfo.guaranteed,
                    currency: universal.pricing?.currency || detailedRateInfo.currency,
                    ...detailedRateInfo,
                    _isUniversalFormat: true
                };
            }
            return detailedRateInfo;
        }

        // PRIORITY 3: Legacy shipment.selectedRate (without dual rate storage)
        if (shipment?.selectedRate) {
            if (shipment.selectedRate.carrier && shipment.selectedRate.pricing && shipment.selectedRate.transit) {
                return {
                    carrier: shipment.selectedRate.carrier.name,
                    service: shipment.selectedRate.service.name,
                    totalCharges: shipment.selectedRate.pricing.total,
                    freightCharge: shipment.selectedRate.pricing.freight,
                    freightCharges: shipment.selectedRate.pricing.freight,
                    fuelCharge: shipment.selectedRate.pricing.fuel,
                    fuelCharges: shipment.selectedRate.pricing.fuel,
                    serviceCharges: shipment.selectedRate.pricing.service,
                    accessorialCharges: shipment.selectedRate.pricing.accessorial,
                    transitDays: shipment.selectedRate.transit.days,
                    estimatedDeliveryDate: shipment.selectedRate.transit.estimatedDelivery,
                    guaranteed: shipment.selectedRate.transit.guaranteed,
                    currency: shipment.selectedRate.pricing.currency,
                    _isUniversalFormat: true
                };
            }
            return shipment.selectedRate;
        }

        // PRIORITY 4: Legacy selectedRateRef
        if (shipment?.selectedRateRef) {
            return shipment.selectedRateRef;
        }

        // PRIORITY 5: Fallback to allShipmentRates
        if (allShipmentRates.length > 0) {
            const bookedRate = allShipmentRates.find(rate => rate.status === 'pending') ||
                allShipmentRates.find(rate => rate.status === 'selected') ||
                allShipmentRates[0];

            if (bookedRate?.universalRateData) {
                const universal = bookedRate.universalRateData;
                return {
                    carrier: universal.carrier?.name || bookedRate.carrier,
                    service: universal.service?.name || bookedRate.service,
                    totalCharges: universal.pricing?.total || bookedRate.totalCharges,
                    freightCharge: universal.pricing?.freight || bookedRate.freightCharges,
                    freightCharges: universal.pricing?.freight || bookedRate.freightCharges,
                    fuelCharge: universal.pricing?.fuel || bookedRate.fuelCharges,
                    fuelCharges: universal.pricing?.fuel || bookedRate.fuelCharges,
                    serviceCharges: universal.pricing?.service || bookedRate.serviceCharges,
                    accessorialCharges: universal.pricing?.accessorial || bookedRate.accessorialCharges,
                    transitDays: universal.transit?.days || bookedRate.transitDays,
                    estimatedDeliveryDate: universal.transit?.estimatedDelivery || bookedRate.estimatedDeliveryDate,
                    guaranteed: universal.transit?.guaranteed || bookedRate.guaranteed,
                    currency: universal.pricing?.currency || bookedRate.currency,
                    ...bookedRate,
                    _isUniversalFormat: true
                };
            }
            return bookedRate;
        }

        console.log('No rate information available - checked all sources');
        return null;
    }, [detailedRateInfo, shipment?.selectedRate, shipment?.selectedRateRef, shipment?.actualRates, shipment?.markupRates, allShipmentRates]);

    // Fetch carrier data
    useEffect(() => {
        const fetchCarrierData = async () => {
            const bestRate = getBestRateInfo;
            if (!bestRate?.carrier && !shipment?.selectedCarrier && !shipment?.carrier) return;

            try {
                let carrierFound = false;
                
                // For QuickShip shipments, check quickshipCarriers collection first
                if (shipment?.creationMethod === 'quickship') {
                    console.log('🔍 QuickShip detected - searching quickshipCarriers collection');
                    
                    const quickshipCarriersRef = collection(db, 'quickshipCarriers');
                    
                    // Try to find by carrier name from shipment
                    const carrierName = shipment?.selectedCarrier || shipment?.carrier;
                    if (carrierName) {
                        const nameQuery = query(quickshipCarriersRef, where('name', '==', carrierName));
                        const nameSnapshot = await getDocs(nameQuery);
                        
                        if (!nameSnapshot.empty) {
                            const carrierDoc = nameSnapshot.docs[0];
                            const carrierData = carrierDoc.data();
                            console.log('✅ Found QuickShip carrier data:', carrierData);
                            setCarrierData(carrierData);
                            carrierFound = true;
                        } else {
                            // Try by carrierId if name doesn't work
                            const idQuery = query(quickshipCarriersRef, where('carrierId', '==', carrierName));
                            const idSnapshot = await getDocs(idQuery);
                            
                            if (!idSnapshot.empty) {
                                const carrierDoc = idSnapshot.docs[0];
                                const carrierData = carrierDoc.data();
                                console.log('✅ Found QuickShip carrier by ID:', carrierData);
                                setCarrierData(carrierData);
                                carrierFound = true;
                            }
                        }
                    }
                }
                
                // If not found in quickshipCarriers or not a QuickShip shipment, check regular carriers collection
                if (!carrierFound) {
                    const carriersRef = collection(db, 'carriers');
                    
                    let carrierIdentifier = bestRate?.carrier || shipment?.selectedCarrier || shipment?.carrier;
                    
                    // Check if this is an eShipPlus integration
                    if (bestRate?.displayCarrierId === 'ESHIPPLUS' ||
                        bestRate?.sourceCarrierName === 'eShipPlus' ||
                        bestRate?.displayCarrierId === 'eshipplus') {
                        carrierIdentifier = 'ESHIPPLUS';
                    }

                    const q = query(carriersRef, where('carrierID', '==', carrierIdentifier));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const carrierDoc = querySnapshot.docs[0];
                        console.log('✅ Found regular carrier data:', carrierDoc.data());
                        setCarrierData(carrierDoc.data());
                    } else {
                        // Try by name
                        const nameQuery = query(carriersRef, where('name', '==', carrierIdentifier));
                        const nameSnapshot = await getDocs(nameQuery);
                        
                        if (!nameSnapshot.empty) {
                            const carrierDoc = nameSnapshot.docs[0];
                            console.log('✅ Found regular carrier by name:', carrierDoc.data());
                            setCarrierData(carrierDoc.data());
                        } else {
                            console.warn('❌ No carrier found in either collection for:', carrierIdentifier);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching carrier data:', error);
            }
        };

        fetchCarrierData();
    }, [shipment, getBestRateInfo]);

    // Helper functions
    const fetchTrackingData = async (shipmentData) => {
        if (!shipmentData.shipmentId) {
            setTrackingRecords([]);
            return;
        }

        try {
            const trackingRef = collection(db, 'tracking');
            const trackingQuery = query(trackingRef, where('shipmentId', '==', shipmentData.shipmentId));
            const trackingSnapshot = await getDocs(trackingQuery);

            if (!trackingSnapshot.empty) {
                const trackingDoc = trackingSnapshot.docs[0];
                const trackingData = trackingDoc.data();

                if (trackingData.events && Array.isArray(trackingData.events)) {
                    const processedEvents = trackingData.events
                        .map(event => ({
                            id: Math.random().toString(36).substr(2, 9),
                            status: event.status,
                            description: event.description,
                            location: event.location,
                            timestamp: event.timestamp?.toDate() || new Date(),
                            color: getStatusColor(event.status),
                            icon: getStatusIcon(event.status)
                        }))
                        .sort((a, b) => b.timestamp - a.timestamp);

                    setTrackingRecords(processedEvents);
                }

                shipmentData.tracking = {
                    carrier: trackingData.carrier,
                    trackingNumber: trackingData.trackingNumber,
                    estimatedDeliveryDate: trackingData.estimatedDeliveryDate?.toDate(),
                    status: trackingData.status,
                    lastUpdated: trackingData.lastUpdated?.toDate()
                };
            }
        } catch (error) {
            console.error('Error fetching tracking data:', error);
            setTrackingRecords([]);
        }
    };

    const fetchRateData = async (shipmentData, docId) => {
        try {
            // Fetch rates using new data structure
            if (shipmentData.selectedRateRef?.rateDocumentId) {
                const detailedRate = await getRateDetailsByDocumentId(shipmentData.selectedRateRef.rateDocumentId);
                if (detailedRate) {
                    shipmentData.selectedRate = {
                        ...shipmentData.selectedRateRef,
                        ...detailedRate
                    };
                    setDetailedRateInfo(detailedRate);
                } else {
                    shipmentData.selectedRate = shipmentData.selectedRateRef;
                }
            }

            // Fetch all rates for this shipment
            const allRates = await getRatesForShipment(docId);
            shipmentData.allRates = allRates;
            setAllShipmentRates(allRates);

            // If no selectedRate, find a booked/selected rate
            if (!shipmentData.selectedRate && allRates.length > 0) {
                const bookedRate = allRates.find(rate => rate.status === 'pending') ||
                    allRates.find(rate => rate.status === 'selected') ||
                    allRates[0];
                if (bookedRate) {
                    shipmentData.selectedRate = bookedRate;
                }
            }

            // Legacy support for subcollection structure
            if (!shipmentData.selectedRate) {
                const ratesRef = collection(db, 'shipments', docId, 'rates');
                const ratesSnapshot = await getDocs(ratesRef);

                if (!ratesSnapshot.empty) {
                    const rates = ratesSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    shipmentData.rates = rates;
                    shipmentData.selectedRate = rates[0];
                }
            }
        } catch (error) {
            console.error('Error fetching rate data:', error);
        }
    };

    const fetchPackageData = async (shipmentData, docId) => {
        try {
            const packagesRef = collection(db, 'shipments', docId, 'packages');
            const packagesSnapshot = await getDocs(packagesRef);

            if (!packagesSnapshot.empty) {
                const packages = packagesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                shipmentData.packages = packages;
            }
        } catch (error) {
            console.error('Error fetching packages:', error);
        }
    };

    const setTrackingNumber = (shipmentData) => {
        // Helper function to safely get carrier name as string
        const getCarrierString = (carrier) => {
            if (!carrier) return '';
            if (typeof carrier === 'string') return carrier;
            if (typeof carrier === 'object' && carrier.name) return carrier.name;
            return String(carrier);
        };

        const isCanparShipment = getCarrierString(shipmentData.selectedRate?.carrier).toLowerCase().includes('canpar') ||
            getCarrierString(shipmentData.carrier).toLowerCase().includes('canpar') ||
            (shipmentData.selectedRate?.CarrierName || '').toLowerCase().includes('canpar');

        if (isCanparShipment) {
            const canparTrackingNumber = shipmentData.selectedRate?.TrackingNumber ||
                shipmentData.selectedRate?.Barcode ||
                shipmentData.carrierBookingConfirmation?.trackingNumber ||
                shipmentData.trackingNumber;

            if (canparTrackingNumber && !shipmentData.trackingNumber) {
                shipmentData.trackingNumber = canparTrackingNumber;
            }
        } else if (shipmentData.carrierBookingConfirmation?.proNumber) {
            shipmentData.trackingNumber = shipmentData.carrierBookingConfirmation.proNumber;
        }
    };

    const isEShipPlusCarrier = useMemo(() => {
        return getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' ||
            getBestRateInfo?.sourceCarrierName === 'eShipPlus' ||
            getBestRateInfo?.sourceCarrier?.key === 'ESHIPPLUS' ||
            (carrierData?.name && typeof carrierData.name === 'string' && carrierData.name.toLowerCase().includes('eshipplus')) ||
            carrierData?.carrierID === 'ESHIPPLUS';
    }, [getBestRateInfo, carrierData]);

    // Merge tracking and shipment events
    const mergedEvents = useMemo(() => {
        let all = [
            ...(trackingRecords || []),
            ...(shipmentEvents || []).map(event => ({
                id: event.eventId,
                status: event.title,
                description: event.description,
                location: { city: '', state: '', postalCode: '' },
                timestamp: new Date(event.timestamp),
                color: getStatusColor(event.eventType || event.status),
                icon: getStatusIcon(event.eventType || event.status),
                eventType: event.eventType,
                source: event.source,
                userData: event.userData
            }))
        ];

        // Add synthetic 'created' event if not present
        const hasCreated = all.some(e => (e.eventType === 'created' || (e.status && typeof e.status === 'string' && e.status.toLowerCase().includes('created'))));
        if (!hasCreated && shipment?.createdAt) {
            // Parse the createdAt timestamp properly
            let createdTimestamp;
            try {
                if (shipment.createdAt.toDate && typeof shipment.createdAt.toDate === 'function') {
                    createdTimestamp = shipment.createdAt.toDate();
                } else if (shipment.createdAt.seconds !== undefined) {
                    createdTimestamp = new Date(shipment.createdAt.seconds * 1000 + (shipment.createdAt.nanoseconds || 0) / 1000000);
                } else if (shipment.createdAt._seconds !== undefined) {
                    createdTimestamp = new Date(shipment.createdAt._seconds * 1000 + (shipment.createdAt._nanoseconds || 0) / 1000000);
                } else {
                    createdTimestamp = new Date(shipment.createdAt);
                }
                
                // Validate the timestamp
                if (isNaN(createdTimestamp.getTime())) {
                    console.warn('Invalid createdAt timestamp:', shipment.createdAt);
                    createdTimestamp = new Date(); // Fallback to current date
                }
            } catch (error) {
                console.error('Error parsing createdAt timestamp:', error, shipment.createdAt);
                createdTimestamp = new Date(); // Fallback to current date
            }
            
            all.push({
                id: 'created-' + (shipment.id || shipment.shipmentID),
                status: 'Created',
                description: 'Shipment was created',
                location: { city: '', state: '', postalCode: '' },
                timestamp: createdTimestamp,
                color: getStatusColor('created'),
                icon: getStatusIcon('created'),
                eventType: 'created',
                source: 'user',
                userData: {
                    email: shipment.createdByEmail || shipment.createdBy || shipment.userEmail || null,
                    userId: shipment.createdBy || null,
                    userName: shipment.createdByName || null
                }
            });
        }

        return all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [trackingRecords, shipmentEvents, shipment]);

    const refreshShipment = useCallback(() => {
        console.log('ShipmentDetail: Refreshing shipment data for:', shipmentId);
        // Reset all state to trigger a fresh fetch
        setShipment(null);
        setError(null);
        setTrackingRecords([]);
        setShipmentEvents([]);
        setCarrierData(null);
        setDetailedRateInfo(null);
        setAllShipmentRates([]);
        setLoading(true);
        setHistoryLoading(true);
        
        // Force a fresh fetch by updating a dependency
        setRefreshTrigger(prev => prev + 1);
    }, [shipmentId]);

    return {
        shipment,
        loading,
        error,
        carrierData,
        mergedEvents,
        getBestRateInfo,
        isEShipPlusCarrier,
        historyLoading,
        refreshShipment
    };
};

// Helper functions (moved from the original file)
const getStatusColor = (status) => {
    const statusStr = status && typeof status === 'string' ? status : String(status || '');
    switch (statusStr.toLowerCase()) {
        case 'draft': return '#64748b';
        case 'unknown': return '#6b7280';
        case 'pending':
        case 'created': return '#d97706';
        case 'scheduled': return '#7c3aed';
        case 'booked': return '#2563eb';
        case 'awaiting_shipment':
        case 'awaiting shipment':
        case 'label_created': return '#ea580c';
        case 'in_transit':
        case 'in transit': return '#7c2d92';
        case 'delivered': return '#16a34a';
        case 'on_hold':
        case 'on hold': return '#dc2626';
        case 'canceled':
        case 'cancelled': return '#b91c1c';
        case 'void': return '#7f1d1d';
        default: return '#6b7280';
    }
};

const getStatusIcon = (status) => {
    // This would need to be implemented with the actual icon components
    // For now, returning null as we'll handle icons in the components
    return null;
}; 