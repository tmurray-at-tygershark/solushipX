import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Container,
    Paper,
    Typography,
    TextField,
    Button,
    InputAdornment,
    Alert,
    CircularProgress,
    Grid,
    Divider,
    Avatar,
    Chip as MuiChip // Renamed to avoid conflict with StatusChip
} from '@mui/material';
import { Search as SearchIcon, LocalShipping, LocationOn, CalendarToday, HelpOutline } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { db, functions } from '../../firebase'; // Firebase setup
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import ShipmentTimeline from './ShipmentTimeline';
import StatusChip from '../StatusChip/StatusChip'; // Import StatusChip

// Helper to format address (simplified version)
const formatAddressDisplay = (address) => {
    if (!address) return 'N/A';
    const parts = [address.city, address.state, address.country].filter(Boolean);
    return parts.join(', ');
};

// Helper to format date
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch (error) {
        return 'Invalid Date';
    }
};

// CarrierDisplay component (copied from ShipmentDetail.jsx and adapted)
const CarrierDisplay = React.memo(({ carrierName, size = 'medium' }) => {
    const sizeConfig = {
        small: { logoSize: 24, fontSize: '0.875rem' },
        medium: { logoSize: 32, fontSize: '1rem' },
        large: { logoSize: 40, fontSize: '1.125rem' }
    };

    const { logoSize, fontSize } = sizeConfig[size] || sizeConfig.medium;

    if (!carrierName || carrierName === 'N/A' || carrierName.toLowerCase() === 'unknown') {
        return <Typography variant="body1" sx={{ fontSize, fontWeight: 500 }}>Carrier: Unknown</Typography>;
    }

    // Simplified logo fetching or display logic for Tracking page
    // In a real app, you might fetch carrier details (including logo) from a DB
    let logoUrl = null;
    const lcCarrierName = carrierName.toLowerCase();
    if (lcCarrierName.includes('canpar')) {
        logoUrl = '/assets/logos/canpar-logo.png'; // Placeholder path
    } else if (lcCarrierName.includes('eshipplus') || lcCarrierName.includes('e-ship')) {
        logoUrl = '/assets/logos/eshipplus-logo.png'; // Placeholder path
    } else if (lcCarrierName.includes('fedex')) {
        logoUrl = '/assets/logos/fedex-logo.png';
    } else if (lcCarrierName.includes('ups')) {
        logoUrl = '/assets/logos/ups-logo.png';
    }


    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {logoUrl ? (
                <Avatar
                    src={logoUrl}
                    alt={`${carrierName} logo`}
                    sx={{ width: logoSize, height: logoSize, borderRadius: 1 }}
                    imgProps={{ style: { objectFit: 'contain' } }}
                    onError={(e) => { e.target.style.display = 'none'; /* Hide if logo fails */ }}
                />
            ) : (
                <Avatar sx={{ width: logoSize, height: logoSize, bgcolor: 'primary.main', fontSize: fontSize }}>
                    {carrierName.charAt(0).toUpperCase()}
                </Avatar>
            )}
            <Typography variant="body1" sx={{ fontSize, fontWeight: 500 }}>
                {carrierName}
            </Typography>
        </Box>
    );
});


const Tracking = () => {
    const [trackingNumberInput, setTrackingNumberInput] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { trackingIdentifier: initialTrackingIdentifier } = useParams();

    const [currentTrackingId, setCurrentTrackingId] = useState('');
    const [shipmentData, setShipmentData] = useState(null);
    const [carrier, setCarrier] = useState(null);
    const [trackingIdToUse, setTrackingIdToUse] = useState(null);
    const [trackingEvents, setTrackingEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [displayError, setDisplayError] = useState('');

    useEffect(() => {
        if (initialTrackingIdentifier) {
            setTrackingNumberInput(initialTrackingIdentifier);
            setCurrentTrackingId(initialTrackingIdentifier);
        }
    }, [initialTrackingIdentifier]);

    useEffect(() => {
        const fetchTrackingData = async () => {
            if (!currentTrackingId) {
                setLoading(false);
                return;
            }
            console.log(`Fetching tracking data for: ${currentTrackingId}`);
            setLoading(true);
            setDisplayError('');
            setShipmentData(null);
            setTrackingEvents([]);
            setCarrier(null);
            setTrackingIdToUse(null);

            try {
                let isSolushipXId = currentTrackingId.startsWith('IC-') || currentTrackingId.startsWith('SID-');
                let shipmentDocFromFS;
                let resolvedCarrier = null;
                let idForHistory = null;
                let eventsDirectlyFetched = false;
                let fetchedShipmentData = null;

                if (isSolushipXId) {
                    console.log(`Identified ${currentTrackingId} as SolushipX ID.`);

                    // Query for shipment by shipmentID field, not document ID
                    const shipmentsRef = collection(db, 'shipments');
                    const q = query(shipmentsRef, where('shipmentID', '==', currentTrackingId));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const shipmentDoc = querySnapshot.docs[0];
                        const data = shipmentDoc.data();
                        fetchedShipmentData = data; // Store fetched data
                        setShipmentData(data);
                        console.log('Fetched SolushipX shipment data:', data);
                    } else {
                        console.log(`SolushipX ID "${currentTrackingId}" not found in Firestore.`);
                        // Set a specific error for missing SolushipX IDs
                        setDisplayError(`SolushipX shipment "${currentTrackingId}" not found. Please verify the shipment ID is correct, or check if the shipment exists in your account.`);
                        setLoading(false);
                        return;
                    }
                } else {
                    // For non-SolushipX IDs, first try to find if this tracking number belongs to an existing shipment
                    console.log(`Checking if "${currentTrackingId}" is a tracking number for an existing SolushipX shipment.`);

                    const shipmentsRef = collection(db, 'shipments');

                    // Try multiple tracking number fields that might contain this value
                    const trackingQueries = [
                        query(shipmentsRef, where('trackingNumber', '==', currentTrackingId)),
                        query(shipmentsRef, where('selectedRateRef.Barcode', '==', currentTrackingId)),
                        query(shipmentsRef, where('selectedRate.Barcode', '==', currentTrackingId)),
                        query(shipmentsRef, where('carrierBookingConfirmation.trackingNumber', '==', currentTrackingId)),
                        query(shipmentsRef, where('selectedRateRef.trackingNumber', '==', currentTrackingId)),
                        query(shipmentsRef, where('selectedRate.trackingNumber', '==', currentTrackingId)),
                        query(shipmentsRef, where('bookingReferenceNumber', '==', currentTrackingId)),
                        query(shipmentsRef, where('selectedRateRef.BookingReferenceNumber', '==', currentTrackingId)),
                        query(shipmentsRef, where('selectedRate.BookingReferenceNumber', '==', currentTrackingId)),
                        query(shipmentsRef, where('carrierBookingConfirmation.confirmationNumber', '==', currentTrackingId)),
                        query(shipmentsRef, where('carrierBookingConfirmation.proNumber', '==', currentTrackingId))
                    ];

                    let foundShipment = null;
                    for (const q of trackingQueries) {
                        try {
                            const querySnapshot = await getDocs(q);
                            if (!querySnapshot.empty) {
                                foundShipment = querySnapshot.docs[0];
                                console.log(`Found SolushipX shipment with tracking number "${currentTrackingId}"`);
                                break;
                            }
                        } catch (queryError) {
                            console.warn(`Query failed (likely due to missing index):`, queryError.message);
                            // Continue to next query
                        }
                    }

                    if (foundShipment) {
                        const data = foundShipment.data();
                        fetchedShipmentData = data;
                        setShipmentData(data);
                        console.log('Fetched SolushipX shipment data by tracking number:', data);

                        // Mark this as found via tracking number so we handle it like a SolushipX shipment
                        isSolushipXId = true;
                    }
                }

                if (fetchedShipmentData) {
                    let determinedCarrierName = fetchedShipmentData.selectedRateRef?.displayCarrierId || fetchedShipmentData.selectedRate?.displayCarrierId ||
                        fetchedShipmentData.selectedRateRef?.carrier || fetchedShipmentData.selectedRate?.carrier || fetchedShipmentData.carrier;

                    if (fetchedShipmentData.selectedRateRef?.sourceCarrierName) { // Prefer sourceCarrierName if available
                        determinedCarrierName = fetchedShipmentData.selectedRateRef.sourceCarrierName;
                    }

                    if (determinedCarrierName) {
                        const dcLower = determinedCarrierName.toLowerCase();
                        if (dcLower.includes('canpar')) resolvedCarrier = 'Canpar';
                        else if (dcLower.includes('eshipplus') || dcLower.includes('e-ship') || determinedCarrierName === 'ESHIPPLUS') { // Check against exact ESHIPPLUS too
                            resolvedCarrier = 'eShipPlus';
                        } else {
                            resolvedCarrier = determinedCarrierName;
                        }
                    }

                    if (resolvedCarrier === 'Canpar') {
                        idForHistory = fetchedShipmentData.selectedRateRef?.Barcode || fetchedShipmentData.selectedRate?.Barcode || fetchedShipmentData.carrierBookingConfirmation?.trackingNumber || fetchedShipmentData.trackingNumber;
                    } else if (resolvedCarrier === 'eShipPlus') {
                        idForHistory = fetchedShipmentData.bookingReferenceNumber || fetchedShipmentData.selectedRateRef?.BookingReferenceNumber || fetchedShipmentData.selectedRate?.BookingReferenceNumber || fetchedShipmentData.selectedRateRef?.ProNumber || fetchedShipmentData.selectedRate?.ProNumber || fetchedShipmentData.carrierBookingConfirmation?.confirmationNumber || fetchedShipmentData.carrierBookingConfirmation?.proNumber || fetchedShipmentData.trackingNumber;
                    } else { // For other direct carriers or if carrier could not be fully resolved
                        idForHistory = fetchedShipmentData.trackingNumber || fetchedShipmentData.selectedRateRef?.trackingNumber || fetchedShipmentData.selectedRate?.trackingNumber || fetchedShipmentData.carrierBookingConfirmation?.trackingNumber || fetchedShipmentData.carrierBookingConfirmation?.proNumber;
                        if (!resolvedCarrier && idForHistory) { // If we got an ID but no specific carrier
                            resolvedCarrier = fetchedShipmentData.carrier || "Unknown";
                        }
                    }

                    if (!resolvedCarrier || !idForHistory) {
                        console.warn(`Could not fully determine carrier/tracking ID from SolushipX shipment ${currentTrackingId}. Carrier: ${resolvedCarrier}, ID: ${idForHistory}`);

                        // For early status shipments (scheduled, pending, etc.), create a basic status event
                        const shipmentStatus = fetchedShipmentData.status?.toLowerCase();
                        const isEarlyStatus = ['scheduled', 'pending', 'created', 'booked', 'draft'].includes(shipmentStatus);

                        if (isEarlyStatus && resolvedCarrier) {
                            // Create a basic status event for early stage shipments
                            const statusEvent = {
                                id: 'status-' + currentTrackingId,
                                status: fetchedShipmentData.status || 'Scheduled',
                                description: `Shipment ${fetchedShipmentData.status || 'scheduled'} with ${resolvedCarrier}. Tracking details will be available once the carrier processes the shipment.`,
                                timestamp: fetchedShipmentData.createdAt?.toDate ? fetchedShipmentData.createdAt.toDate().toISOString() : new Date().toISOString(),
                                location: fetchedShipmentData.shipFrom || {},
                                source: 'SolushipX'
                            };
                            setTrackingEvents([statusEvent]);
                            setCarrier(resolvedCarrier);
                            setLoading(false);
                            return;
                        }

                        if (!resolvedCarrier) setDisplayError('Could not determine carrier from shipment data.');
                        else if (!idForHistory) setDisplayError('Could not determine tracking identifier from shipment data.');
                        setLoading(false);
                        return;
                    }
                    console.log(`Resolved from SolushipX shipment: Carrier=${resolvedCarrier}, IDForHistory=${idForHistory}`);
                }

                if (!fetchedShipmentData) {
                    console.log(`No SolushipX shipment found. Treating "${currentTrackingId}" as a raw tracking number.`);
                    let foundEvents = [];
                    let foundCarrierForRaw = null;

                    try {
                        console.log(`Attempting to fetch history for "${currentTrackingId}" as Canpar.`);
                        const getHistoryCanparFunc = httpsCallable(functions, 'getHistoryCanpar');
                        const canparResult = await getHistoryCanparFunc({ trackingNumber: currentTrackingId });
                        if (canparResult.data && canparResult.data.success && canparResult.data.trackingUpdates && canparResult.data.trackingUpdates.length > 0) {
                            foundEvents = canparResult.data.trackingUpdates;
                            foundCarrierForRaw = 'Canpar';
                            console.log(`Fetched ${foundEvents.length} events for "${currentTrackingId}" as Canpar.`);
                        } else {
                            console.log(`No Canpar history found for "${currentTrackingId}" or error:`, canparResult.data?.error);
                        }
                    } catch (canparError) {
                        console.warn(`Error fetching Canpar history for "${currentTrackingId}":`, canparError.message);
                    }

                    if (foundEvents.length === 0) {
                        try {
                            console.log(`Attempting to fetch history for "${currentTrackingId}" as eShipPlus.`);
                            const getHistoryEShipPlusFunc = httpsCallable(functions, 'getHistoryEShipPlus');
                            const eshipplusResult = await getHistoryEShipPlusFunc({ shipmentNumber: currentTrackingId });
                            if (eshipplusResult.data && eshipplusResult.data.data?.success && eshipplusResult.data.data.trackingUpdates && eshipplusResult.data.data.trackingUpdates.length > 0) {
                                foundEvents = eshipplusResult.data.data.trackingUpdates;
                                foundCarrierForRaw = 'eShipPlus';
                                console.log(`Fetched ${foundEvents.length} events for "${currentTrackingId}" as eShipPlus.`);
                            } else {
                                console.log(`No eShipPlus history found for "${currentTrackingId}" or error:`, eshipplusResult.data?.error || eshipplusResult.data?.data?.error);
                            }
                        } catch (eshipplusError) {
                            console.warn(`Error fetching eShipPlus history for "${currentTrackingId}":`, eshipplusError.message);
                        }
                    }

                    if (foundEvents.length > 0 && foundCarrierForRaw) {
                        resolvedCarrier = foundCarrierForRaw;
                        idForHistory = currentTrackingId;
                        setTrackingEvents(foundEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
                        eventsDirectlyFetched = true;
                        console.log(`Events directly fetched for raw tracking ID. Carrier: ${resolvedCarrier}`);
                    }
                }

                if (resolvedCarrier && idForHistory && !eventsDirectlyFetched) {
                    setCarrier(resolvedCarrier);
                    setTrackingIdToUse(idForHistory);
                    console.log(`Fetching history for carrier: ${resolvedCarrier}, ID: ${idForHistory}`);
                    let finalEvents = [];
                    if (resolvedCarrier.toLowerCase().includes('canpar')) {
                        const getHistoryCanparFunc = httpsCallable(functions, 'getHistoryCanpar');
                        const result = await getHistoryCanparFunc({ trackingNumber: idForHistory });
                        if (result.data && result.data.success) {
                            finalEvents = result.data.trackingUpdates || [];
                        } else {
                            throw new Error(result.data?.error || 'Failed to fetch Canpar history');
                        }
                    } else if (resolvedCarrier.toLowerCase().includes('eshipplus')) {
                        const getHistoryEShipPlusFunc = httpsCallable(functions, 'getHistoryEShipPlus');
                        const result = await getHistoryEShipPlusFunc({ shipmentNumber: idForHistory });
                        if (result.data && result.data.data?.success) {
                            finalEvents = result.data.data.trackingUpdates || [];
                        } else {
                            throw new Error(result.data?.error || result.data?.data?.error || 'Failed to fetch eShipPlus history');
                        }
                    } else {
                        // Attempt to use the original determinedCarrierName for other carriers if it exists
                        const otherCarrierName = fetchedShipmentData?.carrier || fetchedShipmentData?.selectedRate?.carrier || resolvedCarrier;
                        setDisplayError(`History fetch for carrier "${otherCarrierName}" is not yet supported directly. Basic info may be shown.`);
                        // Potentially allow showing SolushipX data without further carrier calls if it's an unknown carrier
                        if (fetchedShipmentData) {
                            // If we have SolushipX data, try to show something
                            const createdEvent = {
                                id: 'created-' + currentTrackingId,
                                status: fetchedShipmentData.status || 'Info Retrieved',
                                description: `Shipment details retrieved from SolushipX. Carrier: ${otherCarrierName}.`,
                                timestamp: fetchedShipmentData.createdAt?.toDate ? fetchedShipmentData.createdAt.toDate().toISOString() : new Date().toISOString(),
                                location: fetchedShipmentData.shipFrom || {}
                            };
                            setTrackingEvents([createdEvent]);
                        }
                        // Do not set loading to false here, allow finally to do it
                        // setLoading(false); 
                        // return;
                    }
                    setTrackingEvents(finalEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
                } else if (!eventsDirectlyFetched && (!resolvedCarrier || !idForHistory)) {
                    if (!displayError) {
                        if (currentTrackingId.startsWith('IC-') || currentTrackingId.startsWith('SID-')) {
                            setDisplayError(`SolushipX shipment "${currentTrackingId}" not found. Please verify the shipment ID is correct.`);
                        } else {
                            setDisplayError(`No tracking information found for "${currentTrackingId}". Please verify this is a valid tracking number from a supported carrier (Canpar or eShipPlus).`);
                        }
                    }
                }

                // After all attempts, set the final carrier name for display
                setCarrier(resolvedCarrier || (fetchedShipmentData?.carrier || 'Unknown'));


            } catch (err) {
                console.error("Error in fetchTrackingData:", err);
                setDisplayError(err.message || 'Failed to fetch tracking information.');
                setTrackingEvents([]); // Clear events on error
            } finally {
                setLoading(false);
            }
        };

        if (currentTrackingId) {
            fetchTrackingData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTrackingId]); // Removed displayError from dependencies

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        if (!trackingNumberInput.trim()) {
            setError('Please enter a tracking number or shipment ID');
            return;
        }
        const trimmedId = trackingNumberInput.trim();
        setCurrentTrackingId(trimmedId);
        navigate(`/tracking/${encodeURIComponent(trimmedId)}`, { replace: true });
    };

    const handleInputChange = (e) => {
        setTrackingNumberInput(e.target.value);
        if (error) setError('');
        if (displayError) setDisplayError(''); // Clear main display error on new input
    };

    const overallStatus = useMemo(() => {
        if (trackingEvents.length > 0) {
            return trackingEvents[0].status; // Assuming sorted latest first
        }
        if (shipmentData?.status) {
            return shipmentData.status;
        }
        return 'Pending'; // Default if no other status
    }, [trackingEvents, shipmentData]);

    const estimatedDeliveryDate = useMemo(() => {
        // Prioritize eShipPlus specific field if carrier is eShipPlus
        if (carrier?.toLowerCase().includes('eshipplus') && shipmentData?.carrierBookingConfirmation?.estimatedDeliveryDate) {
            return formatDate(shipmentData.carrierBookingConfirmation.estimatedDeliveryDate.toDate ? shipmentData.carrierBookingConfirmation.estimatedDeliveryDate.toDate() : shipmentData.carrierBookingConfirmation.estimatedDeliveryDate);
        }
        // General selectedRate check
        if (shipmentData?.selectedRate?.estimatedDeliveryDate) {
            return formatDate(shipmentData.selectedRate.estimatedDeliveryDate.toDate ? shipmentData.selectedRate.estimatedDeliveryDate.toDate() : shipmentData.selectedRate.estimatedDeliveryDate);
        }
        // Check within carrierBookingConfirmation for other carriers
        if (shipmentData?.carrierBookingConfirmation?.estimatedDeliveryDate) {
            return formatDate(shipmentData.carrierBookingConfirmation.estimatedDeliveryDate.toDate ? shipmentData.carrierBookingConfirmation.estimatedDeliveryDate.toDate() : shipmentData.carrierBookingConfirmation.estimatedDeliveryDate);
        }
        // Fallback for direct tracking events if they contain it
        if (trackingEvents.length > 0 && trackingEvents[0].estimatedDelivery) {
            return formatDate(trackingEvents[0].estimatedDelivery);
        }
        return 'N/A';
    }, [shipmentData, trackingEvents, carrier]);


    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100', py: { xs: 3, sm: 5 } }}>
            <Container maxWidth="lg">
                <Paper elevation={0} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 3, border: '1px solid #eee', mb: 4, bgcolor: 'background.paper' }}>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1, textAlign: 'center' }}>
                        Track Your Shipment
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                        Enter your SolushipX ID (e.g., IC-XXXXX) or carrier tracking number.
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}
                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="e.g., IC-DWSLOGISTICS-22OC79 or carrier tracking #"
                            value={trackingNumberInput}
                            onChange={handleInputChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon color="action" />
                                    </InputAdornment>
                                ),
                                sx: { borderRadius: 2, bgcolor: 'grey.50' }
                            }}
                            sx={{ mb: 2 }}
                            autoFocus
                        />
                        <Button
                            type="submit"
                            variant="contained"
                            fullWidth
                            size="large"
                            sx={{
                                bgcolor: 'primary.main', // Updated color
                                '&:hover': { bgcolor: 'primary.dark' }, // Updated hover color
                                borderRadius: 2,
                                py: 1.5,
                                textTransform: 'none',
                                fontSize: '1rem'
                            }}
                            disabled={loading}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : 'Track'}
                        </Button>
                    </form>
                </Paper>

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 5 }}>
                        <CircularProgress />
                        <Typography sx={{ ml: 2 }}>Loading tracking information...</Typography>
                    </Box>
                )}

                {!loading && displayError && (
                    <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #eee', textAlign: 'center', bgcolor: 'background.paper' }}>
                        <HelpOutline sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="error.main" gutterBottom>Tracking Information Error</Typography>
                        <Typography color="text.secondary">{displayError}</Typography>
                        <Typography variant="body2" sx={{ mt: 2, color: 'text.hint' }}>
                            If you believe this is an error, please double-check the ID or try again later.
                        </Typography>
                    </Paper>
                )}

                {!loading && !displayError && currentTrackingId && (trackingEvents.length > 0 || shipmentData) && (
                    <Paper elevation={0} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 3, border: '1px solid #eee', bgcolor: 'background.paper' }}>
                        <Grid container spacing={3}>
                            {/* Left Column: Shipment Info Summary */}
                            <Grid item xs={12} md={4}>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2.5 }}>
                                    Shipment Summary
                                </Typography>

                                <Box sx={{ mb: 2.5 }}>
                                    <Typography variant="caption" color="text.secondary" display="block">Tracking ID</Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>{currentTrackingId}</Typography>
                                </Box>

                                <Box sx={{ mb: 2.5 }}>
                                    <Typography variant="caption" color="text.secondary" display="block">Carrier</Typography>
                                    <CarrierDisplay carrierName={carrier || (shipmentData?.carrier || 'Unknown')} size="small" />
                                </Box>

                                <Box sx={{ mb: 2.5 }}>
                                    <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
                                    <StatusChip status={overallStatus} />
                                </Box>

                                <Box sx={{ mb: 2.5 }}>
                                    <Typography variant="caption" color="text.secondary" display="block">Estimated Delivery</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <CalendarToday sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{estimatedDeliveryDate}</Typography>
                                    </Box>
                                </Box>

                                {shipmentData?.shipFrom && (
                                    <Box sx={{ mb: 2.5 }}>
                                        <Typography variant="caption" color="text.secondary" display="block">Origin</Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <LocationOn sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
                                            <Typography variant="body1">{formatAddressDisplay(shipmentData.shipFrom)}</Typography>
                                        </Box>
                                    </Box>
                                )}
                                {shipmentData?.shipTo && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block">Destination</Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <LocationOn sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
                                            <Typography variant="body1">{formatAddressDisplay(shipmentData.shipTo)}</Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Grid>

                            {/* Right Column: Timeline */}
                            <Grid item xs={12} md={8}>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, mt: { xs: 2, md: 0 } }}>
                                    Tracking History
                                </Typography>
                                <Box sx={{ maxHeight: '600px', overflowY: 'auto', pr: 1, '&::-webkit-scrollbar': { width: '6px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: 'grey.300', borderRadius: '3px' } }}>
                                    <ShipmentTimeline events={trackingEvents} />
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>
                )}
            </Container>
        </Box>
    );
};

export default Tracking; 