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
    Chip as MuiChip, // Renamed to avoid conflict with StatusChip
    IconButton
} from '@mui/material';
import {
    Search as SearchIcon,
    LocalShipping,
    LocationOn,
    CalendarToday,
    HelpOutline,
    CheckCircle as CheckCircleIcon,
    LocalShipping as LocalShippingIcon,
    AccessTime as AccessTimeIcon,
    Pause as PauseIcon,
    Cancel as CancelIcon,
    Edit as EditIcon,
    CheckCircleOutline as CheckCircleOutlineIcon,
    CalendarMonth as CalendarIcon,
    HelpOutline as HelpOutlineIcon,
    ContentCopy as ContentCopyIcon,
    QrCode as QrCodeIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { db, functions } from '../../firebase'; // Firebase setup
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import ShipmentTimeline from './ShipmentTimeline';
import StatusChip from '../StatusChip/StatusChip'; // Import StatusChip
import { listenToShipmentEvents } from '../../utils/shipmentEvents'; // Import shipment events utilities
import { useSmartStatusUpdate } from '../../hooks/useSmartStatusUpdate'; // Import smart status update hook
import QRCode from 'qrcode'; // Import QR code library

// Helper functions (copied from ShipmentDetail.jsx)
const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
        // Draft/Initial States - Grey
        case 'draft':
            return '#64748b';
        case 'unknown':
            return '#6b7280';

        // Early Processing - Amber
        case 'pending':
        case 'created':
            return '#d97706';

        // Scheduled - Purple
        case 'scheduled':
            return '#7c3aed';

        // Confirmed - Blue
        case 'booked':
            return '#2563eb';

        // Ready to Ship - Orange
        case 'awaiting_shipment':
        case 'awaiting shipment':
        case 'label_created':
            return '#ea580c';

        // In Motion - Purple
        case 'in_transit':
        case 'in transit':
            return '#7c2d92';

        // Success - Green
        case 'delivered':
            return '#16a34a';

        // Problem States - Red variants
        case 'on_hold':
        case 'on hold':
            return '#dc2626';
        case 'canceled':
        case 'cancelled':
            return '#b91c1c';
        case 'void':
            return '#7f1d1d';

        default:
            return '#6b7280';  // Grey
    }
};

const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
        case 'delivered':
            return <CheckCircleIcon sx={{ fontSize: 'inherit' }} />;
        case 'in_transit':
        case 'in transit':
            return <LocalShippingIcon sx={{ fontSize: 'inherit' }} />;
        case 'awaiting_shipment':
        case 'awaiting shipment':
            return <AccessTimeIcon sx={{ fontSize: 'inherit' }} />;
        case 'on_hold':
        case 'on hold':
            return <PauseIcon sx={{ fontSize: 'inherit' }} />;
        case 'canceled':
        case 'cancelled':
            return <CancelIcon sx={{ fontSize: 'inherit' }} />;
        case 'draft':
            return <EditIcon sx={{ fontSize: 'inherit' }} />;
        case 'booked':
            return <CheckCircleOutlineIcon sx={{ fontSize: 'inherit' }} />;
        case 'scheduled':
            return <CalendarIcon sx={{ fontSize: 'inherit' }} />;
        case 'pending':
        case 'created':
            return <AccessTimeIcon sx={{ fontSize: 'inherit' }} />;
        case 'void':
            return <CancelIcon sx={{ fontSize: 'inherit' }} />;
        default:
            return <HelpOutlineIcon sx={{ fontSize: 'inherit' }} />;
    }
};

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
    const [shipmentEvents, setShipmentEvents] = useState([]); // SolushipX shipment events
    const [trackingRecords, setTrackingRecords] = useState([]); // Carrier tracking records (like ShipmentDetail)
    const [loading, setLoading] = useState(false);
    const [displayError, setDisplayError] = useState('');

    // QR Code state
    const [qrCodeUrl, setQrCodeUrl] = useState(null);
    const [qrCodeLoading, setQrCodeLoading] = useState(false);

    // Add smart status update hook
    const {
        loading: smartUpdateLoading,
        error: smartUpdateError,
        updateResult,
        performSmartUpdate,
        getUpdateStatusMessage,
        clearUpdateState,
        hasUpdates
    } = useSmartStatusUpdate(shipmentData?.id, shipmentData);

    // Copy to clipboard function
    const copyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            // You could add a toast notification here if desired
            console.log(`${label} copied to clipboard: ${text}`);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    };

    // Generate QR code for tracking URL
    const generateQRCode = async (trackingId) => {
        if (!trackingId || trackingId === 'N/A') {
            setQrCodeUrl(null);
            return;
        }

        try {
            setQrCodeLoading(true);
            const trackingUrl = `${window.location.origin}/tracking/${encodeURIComponent(trackingId)}`;
            const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            setQrCodeUrl(qrDataUrl);
        } catch (error) {
            console.error('Error generating QR code:', error);
            setQrCodeUrl(null);
        } finally {
            setQrCodeLoading(false);
        }
    };

    // Enhanced refresh status function using smart update system
    const handleRefreshStatus = async () => {
        if (!shipmentData?.id) {
            console.warn('Cannot refresh status: no shipment data available');
            return;
        }

        try {
            clearUpdateState();
            console.log(`🔄 Refreshing status for tracking ${currentTrackingId} using smart update system`);

            const result = await performSmartUpdate(true); // Force update for manual refresh

            if (result && result.success) {
                if (result.statusChanged) {
                    // Status changed - update local state
                    setShipmentData(prev => ({
                        ...prev,
                        status: result.newStatus,
                        statusLastChecked: new Date().toISOString(),
                        lastSmartUpdate: new Date().toISOString()
                    }));

                    console.log(`✅ Status updated for ${currentTrackingId}: ${result.previousStatus} → ${result.newStatus}`);
                } else if (result.updated) {
                    // Status confirmed but no change
                    setShipmentData(prev => ({
                        ...prev,
                        statusLastChecked: new Date().toISOString(),
                        lastSmartUpdate: new Date().toISOString()
                    }));
                }
            }

        } catch (error) {
            console.error('Error refreshing tracking status:', error);
        }
    };

    useEffect(() => {
        if (initialTrackingIdentifier) {
            setTrackingNumberInput(initialTrackingIdentifier);
            setCurrentTrackingId(initialTrackingIdentifier);
        }
    }, [initialTrackingIdentifier]);

    // Listen to shipment events when we have shipment data (like ShipmentDetail)
    useEffect(() => {
        if (!shipmentData?.shipmentID && !shipmentData?.id) {
            setShipmentEvents([]); // Clear events if no ID
            return;
        }

        // Determine the ID to use for listening (like ShipmentDetail)
        const idToListen = shipmentData.id || shipmentData.shipmentID;

        // Subscribe to real-time shipment events updates
        const unsubscribe = listenToShipmentEvents(idToListen, (events) => {
            setShipmentEvents(events || []);
        });

        // Cleanup: Unsubscribe when component unmounts or shipment ID changes
        return () => {
            unsubscribe();
        };
    }, [shipmentData?.id, shipmentData?.shipmentID]); // Re-run if shipment.id or shipment.shipmentID changes

    const fetchTrackingData = async () => {
        if (!currentTrackingId) {
            setLoading(false);
            return;
        }
        console.log(`Fetching tracking data for: ${currentTrackingId}`);
        setLoading(true);
        setDisplayError('');
        setShipmentData(null);
        setCarrier(null);
        setTrackingRecords([]); // Clear previous tracking records

        try {
            let isSolushipXId = currentTrackingId.startsWith('IC-') || currentTrackingId.startsWith('SID-');
            let foundShipment = null;

            if (isSolushipXId) {
                console.log(`Identified ${currentTrackingId} as SolushipX ID.`);

                // Query for shipment by shipmentID field
                const shipmentsRef = collection(db, 'shipments');
                const q = query(shipmentsRef, where('shipmentID', '==', currentTrackingId));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    foundShipment = querySnapshot.docs[0];
                    console.log(`Found SolushipX shipment with ID "${currentTrackingId}"`);
                } else {
                    console.log(`SolushipX ID "${currentTrackingId}" not found in Firestore.`);
                    setDisplayError(`SolushipX shipment "${currentTrackingId}" not found. Please verify the shipment ID is correct.`);
                    setLoading(false);
                    return;
                }
            } else {
                // For non-SolushipX IDs, try to find if this tracking number belongs to an existing shipment
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

                if (!foundShipment) {
                    console.log(`No SolushipX shipment found for "${currentTrackingId}".`);
                    setDisplayError(`No tracking information found for "${currentTrackingId}". Please verify this is a valid SolushipX shipment ID or tracking number.`);
                    setLoading(false);
                    return;
                }
            }

            // If we found a shipment, set the data and fetch tracking records
            if (foundShipment) {
                const data = { id: foundShipment.id, ...foundShipment.data() };
                setShipmentData(data);

                // Fetch tracking data from 'tracking' collection (like ShipmentDetail.jsx)
                if (data.shipmentId) {
                    try {
                        const trackingRef = collection(db, 'tracking');
                        const trackingQuery = query(trackingRef, where('shipmentId', '==', data.shipmentId));
                        const trackingSnapshot = await getDocs(trackingQuery);

                        if (!trackingSnapshot.empty) {
                            const trackingDoc = trackingSnapshot.docs[0];
                            const trackingData = trackingDoc.data();

                            // Ensure events array exists and is valid
                            if (trackingData.events && Array.isArray(trackingData.events)) {
                                // Process tracking events and sort by timestamp
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
                                console.log(`Loaded ${processedEvents.length} tracking records`);
                            }
                        } else {
                            console.log('No tracking collection document found');
                        }
                    } catch (trackingError) {
                        console.error('Error fetching tracking data:', trackingError);
                        // Continue without tracking data if fetch fails
                        setTrackingRecords([]);
                    }
                } else {
                    console.warn('No shipmentId found for tracking lookup');
                    setTrackingRecords([]);
                }

                // Determine carrier for display
                let determinedCarrierName = data.selectedRateRef?.displayCarrierId || data.selectedRate?.displayCarrierId ||
                    data.selectedRateRef?.carrier || data.selectedRate?.carrier || data.carrier;

                if (data.selectedRateRef?.sourceCarrierName) {
                    determinedCarrierName = data.selectedRateRef.sourceCarrierName;
                }

                // Enhanced carrier detection for eShipPlus
                if (data.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
                    data.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                    data.selectedRateRef?.sourceCarrierName === 'eShipPlus' ||
                    data.selectedRate?.sourceCarrierName === 'eShipPlus') {
                    setCarrier('eShipPlus');
                    console.log('Detected eShipPlus shipment via displayCarrierId/sourceCarrierName');
                } else if (determinedCarrierName) {
                    const dcLower = determinedCarrierName.toLowerCase();
                    if (dcLower.includes('canpar')) setCarrier('Canpar');
                    else if (dcLower.includes('eshipplus') || dcLower.includes('e-ship') || determinedCarrierName === 'ESHIPPLUS') {
                        setCarrier('eShipPlus');
                    } else {
                        setCarrier(determinedCarrierName);
                    }
                }

                console.log('Shipment found. Events will be loaded via shipmentEvents listener and tracking records.');

                setShipmentData(data);
                setLoading(false);
            }

        } catch (err) {
            console.error("Error in fetchTrackingData:", err);
            setDisplayError(err.message || 'Failed to fetch tracking information.');
            setShipmentEvents([]); // Clear events on error
            setTrackingRecords([]); // Clear tracking records on error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentTrackingId) {
            fetchTrackingData();
        }
    }, [currentTrackingId]);

    // Generate QR code when shipment data is available
    useEffect(() => {
        if (shipmentData?.shipmentID || currentTrackingId) {
            const trackingId = shipmentData?.shipmentID || currentTrackingId;
            generateQRCode(trackingId);
        }
    }, [shipmentData?.shipmentID, currentTrackingId]);

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

    // Merge tracking and shipment events, exactly like ShipmentDetail.jsx
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
        // Add a synthetic 'created' event if not present
        const hasCreated = all.some(e => (e.eventType === 'created' || (e.status && e.status.toLowerCase().includes('created'))));
        if (!hasCreated && shipmentData?.createdAt) {
            all.push({
                id: 'created-' + (shipmentData.id || shipmentData.shipmentID || currentTrackingId),
                status: 'Created',
                description: 'Shipment was created',
                location: { city: '', state: '', postalCode: '' },
                timestamp: shipmentData.createdAt.toDate ? shipmentData.createdAt.toDate() : new Date(shipmentData.createdAt),
                color: getStatusColor('created'),
                icon: getStatusIcon('created'),
                eventType: 'created',
                source: 'user',
                userData: {
                    email: shipmentData.createdByEmail || shipmentData.createdBy || shipmentData.userEmail || null,
                    userId: shipmentData.createdBy || null,
                    userName: shipmentData.createdByName || null
                }
            });
        }
        // Sort by timestamp descending
        return all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [trackingRecords, shipmentEvents, shipmentData, currentTrackingId]);

    const overallStatus = useMemo(() => {
        // Prioritize the shipment's actual status field (consistent with shipment detail page)
        if (shipmentData?.status) {
            return shipmentData.status;
        }
        // Fallback to latest event status if shipment status is not available
        if (mergedEvents.length > 0) {
            return mergedEvents[0].status;
        }
        return 'Pending'; // Default if no other status
    }, [shipmentData, mergedEvents]);

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
        if (mergedEvents.length > 0 && mergedEvents[0].estimatedDelivery) {
            return formatDate(mergedEvents[0].estimatedDelivery);
        }
        return 'N/A';
    }, [shipmentData, mergedEvents, carrier]);


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

                {!loading && !displayError && currentTrackingId && (mergedEvents.length > 0 || shipmentData) && (
                    <Paper elevation={0} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 3, border: '1px solid #eee', bgcolor: 'background.paper' }}>
                        <Grid container spacing={3}>
                            {/* Left Column: Tracking Details */}
                            <Grid item xs={12} md={4}>
                                {/* Enhanced header with smart refresh button */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        Shipment Details
                                    </Typography>
                                    {shipmentData?.status !== 'draft' && shipmentData?.status !== 'delivered' && (
                                        <IconButton
                                            size="small"
                                            onClick={handleRefreshStatus}
                                            disabled={smartUpdateLoading}
                                            title="Refresh status (smart update)"
                                            sx={{
                                                '&:hover': { bgcolor: 'action.hover' }
                                            }}
                                        >
                                            {smartUpdateLoading ? (
                                                <CircularProgress size={16} />
                                            ) : (
                                                <RefreshIcon sx={{ fontSize: 18 }} />
                                            )}
                                        </IconButton>
                                    )}
                                </Box>

                                {/* Smart update status message */}
                                {hasUpdates && (
                                    <Alert severity="info" sx={{ mb: 2, fontSize: '0.875rem' }}>
                                        {getUpdateStatusMessage()}
                                    </Alert>
                                )}

                                {/* QR Code Section - Moved to top and full width */}
                                <Box sx={{ mb: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                        {qrCodeLoading ? (
                                            <Box sx={{
                                                width: '100%',
                                                height: 200,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 1
                                            }}>
                                                <CircularProgress size={24} />
                                            </Box>
                                        ) : qrCodeUrl ? (
                                            <Box sx={{
                                                width: '100%',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 1,
                                                p: 2,
                                                bgcolor: 'background.paper'
                                            }}>
                                                <img
                                                    src={qrCodeUrl}
                                                    alt="Tracking QR Code"
                                                    style={{
                                                        width: 180,
                                                        height: 180,
                                                        display: 'block'
                                                    }}
                                                />
                                            </Box>
                                        ) : (
                                            <Box sx={{
                                                width: '100%',
                                                height: 200,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '1px dashed',
                                                borderColor: 'divider',
                                                borderRadius: 1,
                                                bgcolor: 'grey.50'
                                            }}>
                                                <QrCodeIcon sx={{ fontSize: '3rem', color: 'text.secondary' }} />
                                            </Box>
                                        )}
                                    </Box>
                                </Box>

                                <Box sx={{ mb: 2.5 }}>
                                    <Typography variant="caption" color="text.secondary" display="block">SolushipX Shipment ID</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                            {shipmentData?.shipmentID || 'N/A'}
                                        </Typography>
                                        {shipmentData?.shipmentID && shipmentData.shipmentID !== 'N/A' && (
                                            <IconButton
                                                size="small"
                                                onClick={() => copyToClipboard(shipmentData.shipmentID, 'SolushipX Shipment ID')}
                                                sx={{ padding: '2px' }}
                                                title="Copy SolushipX Shipment ID"
                                            >
                                                <ContentCopyIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                            </IconButton>
                                        )}
                                    </Box>
                                </Box>

                                {/* Carrier Tracking Number */}
                                <Box sx={{ mb: 2.5 }}>
                                    <Typography variant="caption" color="text.secondary" display="block">Carrier Tracking Number</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="body1" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                                            {(() => {
                                                // Use the exact same logic as ShipmentDetail.jsx
                                                const isCanparShipment = carrier?.toLowerCase().includes('canpar');

                                                if (isCanparShipment) {
                                                    return shipmentData?.trackingNumber ||
                                                        shipmentData?.carrierBookingConfirmation?.trackingNumber ||
                                                        shipmentData?.selectedRate?.TrackingNumber ||
                                                        shipmentData?.selectedRate?.Barcode ||
                                                        currentTrackingId ||
                                                        'N/A';
                                                } else {
                                                    // For eShipPlus and other carriers, use proNumber then confirmationNumber
                                                    return shipmentData?.carrierBookingConfirmation?.proNumber ||
                                                        shipmentData?.carrierBookingConfirmation?.confirmationNumber ||
                                                        shipmentData?.trackingNumber ||
                                                        currentTrackingId ||
                                                        'N/A';
                                                }
                                            })()}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                const trackingNumberToCopy = (() => {
                                                    // Use the exact same logic as display
                                                    const isCanparShipment = carrier?.toLowerCase().includes('canpar');

                                                    if (isCanparShipment) {
                                                        return shipmentData?.trackingNumber ||
                                                            shipmentData?.carrierBookingConfirmation?.trackingNumber ||
                                                            shipmentData?.selectedRate?.TrackingNumber ||
                                                            shipmentData?.selectedRate?.Barcode ||
                                                            currentTrackingId ||
                                                            'N/A';
                                                    } else {
                                                        // For eShipPlus and other carriers, use proNumber then confirmationNumber
                                                        return shipmentData?.carrierBookingConfirmation?.proNumber ||
                                                            shipmentData?.carrierBookingConfirmation?.confirmationNumber ||
                                                            shipmentData?.trackingNumber ||
                                                            currentTrackingId ||
                                                            'N/A';
                                                    }
                                                })();
                                                copyToClipboard(trackingNumberToCopy, 'Carrier confirmation number');
                                            }}
                                            title="Copy carrier confirmation number"
                                        >
                                            <ContentCopyIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                        </IconButton>
                                    </Box>
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
                                    <ShipmentTimeline events={mergedEvents} />
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