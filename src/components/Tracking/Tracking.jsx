import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    IconButton,
    Drawer
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
    Refresh as RefreshIcon,
    Menu as MenuIcon
} from '@mui/icons-material';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { db, functions } from '../../firebase'; // Firebase setup
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import ShipmentTimeline from './ShipmentTimeline';
import StatusChip from '../StatusChip/StatusChip'; // Import StatusChip
import { listenToShipmentEvents } from '../../utils/shipmentEvents'; // Import shipment events utilities
import { useSmartStatusUpdate } from '../../hooks/useSmartStatusUpdate'; // Import smart status update hook
import QRCode from 'qrcode'; // Import QR code library
import TrackingDetailSidebar from './TrackingDetailSidebar';
import { Suspense } from 'react';
import Footer from '../Footer/Footer';
import Navigation from '../Navigation/Header';

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


const Tracking = ({ isDrawer = false, trackingIdentifier: propTrackingIdentifier, onClose }) => {
    const [trackingNumberInput, setTrackingNumberInput] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    // Use the prop as the primary source in drawer mode, otherwise use URL params
    const { trackingIdentifier: urlTrackingIdentifier } = useParams();
    const initialTrackingIdentifier = isDrawer ? propTrackingIdentifier : urlTrackingIdentifier;

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

    // Handle initial tracking identifier
    useEffect(() => {
        if (initialTrackingIdentifier) {
            setTrackingNumberInput(initialTrackingIdentifier);
            fetchTrackingData(initialTrackingIdentifier);
        }
    }, [initialTrackingIdentifier]);

    // Add smart status update hook (disabled for public users)
    const {
        loading: smartUpdateLoading,
        error: smartUpdateError,
        updateResult,
        performSmartUpdate,
        getUpdateStatusMessage,
        clearUpdateState,
        hasUpdates
    } = useSmartStatusUpdate(null, null); // Disabled for public tracking page

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

    // Enhanced refresh status function (simplified for public access)
    const handleRefreshStatus = async () => {
        if (!shipmentData?.id) {
            console.warn('Cannot refresh status: no shipment data available');
            return;
        }

        try {
            console.log(`🔄 Refreshing status for tracking ${currentTrackingId} (public mode - re-fetching data)`);

            // For public users, simply re-fetch the tracking data
            await fetchTrackingData(currentTrackingId);

        } catch (error) {
            console.error('Error refreshing tracking status:', error);
        }
    };

    const fetchTrackingData = React.useCallback(async (identifier) => {
        if (!identifier) {
            setDisplayError("Please enter a tracking number.");
            return;
        }

        console.log(`Fetching tracking data for: ${identifier}`);
        setLoading(true);
        setDisplayError('');
        setShipmentData(null);
        setCarrier(null);
        setTrackingRecords([]); // Clear previous tracking records

        try {
            // Simplified approach: Just search for the identifier as a shipmentID
            console.log(`Searching for shipment with ID: ${identifier}`);
            let foundShipment = null;

            // First try: Search by shipmentID field (this covers all shipment IDs regardless of format)
            const shipmentQuery = query(
                collection(db, 'shipments'),
                where('shipmentID', '==', identifier)
            );
            const shipmentSnapshot = await getDocs(shipmentQuery);

            if (!shipmentSnapshot.empty) {
                const shipmentDoc = shipmentSnapshot.docs[0];
                foundShipment = {
                    id: shipmentDoc.id,
                    ...shipmentDoc.data()
                };
                console.log(`Found shipment by shipmentID:`, foundShipment);
            } else {
                // Second try: Search by trackingNumber field as fallback
                console.log(`No shipment found with shipmentID ${identifier}, trying trackingNumber...`);
                const trackingQuery = query(
                    collection(db, 'shipments'),
                    where('trackingNumber', '==', identifier)
                );
                const trackingSnapshot = await getDocs(trackingQuery);

                if (!trackingSnapshot.empty) {
                    const shipmentDoc = trackingSnapshot.docs[0];
                    foundShipment = {
                        id: shipmentDoc.id,
                        ...shipmentDoc.data()
                    };
                    console.log(`Found shipment by trackingNumber:`, foundShipment);
                } else {
                    // No shipment found with either shipmentID or trackingNumber
                    console.log(`No shipment found for identifier: ${identifier}`);
                    setDisplayError(`No tracking information found for "${identifier}". Please verify this is a valid shipment ID or tracking number.`);
                    setLoading(false);
                    return;
                }
            }

            // If we found a shipment, set the data and fetch tracking records
            if (foundShipment) {
                // foundShipment is already a plain object, not a Firestore document
                const data = foundShipment;
                setShipmentData(data);

                // Extract carrier tracking number from the shipment data
                const carrierTrackingNumber = data.selectedRateRef?.Barcode ||
                    data.selectedRate?.Barcode ||
                    data.carrierBookingConfirmation?.trackingNumber ||
                    data.selectedRateRef?.trackingNumber ||
                    data.selectedRate?.trackingNumber ||
                    data.bookingReferenceNumber ||
                    data.selectedRateRef?.BookingReferenceNumber ||
                    data.selectedRate?.BookingReferenceNumber ||
                    data.carrierBookingConfirmation?.confirmationNumber ||
                    data.carrierBookingConfirmation?.proNumber;

                // Set the current tracking ID to the carrier tracking number if available
                setCurrentTrackingId(carrierTrackingNumber || identifier);

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
                                        timestamp: parseTimestamp(event.timestamp),
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
                } else if (determinedCarrierName && typeof determinedCarrierName === 'string') {
                    const dcLower = determinedCarrierName.toLowerCase();
                    if (dcLower.includes('canpar')) setCarrier('Canpar');
                    else if (dcLower.includes('eshipplus') || dcLower.includes('e-ship') || determinedCarrierName === 'ESHIPPLUS') {
                        setCarrier('eShipPlus');
                    } else {
                        setCarrier(determinedCarrierName);
                    }
                } else {
                    setCarrier('Unknown');
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
    }, []);

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
        // In non-drawer mode, we navigate. In drawer mode, fetch is handled by useEffect.
        if (!isDrawer) {
            navigate(`/tracking/${trackingNumberInput}`);
        } else {
            fetchTrackingData(trackingNumberInput);
        }
    };

    const handleInputChange = (e) => {
        setTrackingNumberInput(e.target.value);
        if (error) setError('');
        if (displayError) setDisplayError(''); // Clear main display error on new input
    };

    // Helper function to safely parse timestamps
    const parseTimestamp = (timestamp) => {
        if (!timestamp) return new Date();

        try {
            // Handle Firestore Timestamp objects
            if (timestamp && typeof timestamp === 'object' && timestamp.toDate && typeof timestamp.toDate === 'function') {
                return timestamp.toDate();
            }
            // Handle timestamp objects with seconds and nanoseconds
            if (timestamp && typeof timestamp === 'object' && typeof timestamp.seconds === 'number') {
                return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
            }
            // Handle Date objects
            if (timestamp instanceof Date) {
                return isNaN(timestamp.getTime()) ? new Date() : timestamp;
            }
            // Handle string or number timestamps
            const date = new Date(timestamp);
            return isNaN(date.getTime()) ? new Date() : date;
        } catch (error) {
            console.warn('Error parsing timestamp:', timestamp, error);
            return new Date();
        }
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
                timestamp: parseTimestamp(event.timestamp),
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
                timestamp: parseTimestamp(shipmentData.createdAt),
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

    const MainContent = (
        <Box sx={{
            p: isDrawer ? 2 : { xs: 2, sm: 3, md: 4 },
            bgcolor: isDrawer ? '#ffffff' : 'transparent',
            color: 'text.primary',
            height: '100%',
            overflowY: 'auto'
        }}>
            {/* Only show search form in non-drawer mode */}
            {!isDrawer && (
                <Box component="form" onSubmit={handleSubmit} sx={{ mb: { xs: 3, md: 4 } }}>
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
                            sx: {
                                borderRadius: 2,
                                bgcolor: 'grey.50',
                                fontSize: { xs: '14px', sm: '16px' },
                                '& input': {
                                    fontSize: { xs: '14px', sm: '16px' }
                                }
                            }
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
                            bgcolor: 'primary.main',
                            '&:hover': { bgcolor: 'primary.dark' },
                            borderRadius: 2,
                            py: { xs: 1.5, sm: 1.5 },
                            textTransform: 'none',
                            fontSize: { xs: '14px', sm: '16px', md: '1rem' },
                            fontWeight: 600
                        }}
                        disabled={loading}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Track Shipment'}
                    </Button>
                </Box>
            )}

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: { xs: 3, md: 4 } }}>
                    <CircularProgress />
                </Box>
            )}

            {displayError && !loading && (
                <Alert severity="error" sx={{ mb: { xs: 3, md: 4 } }}>{displayError}</Alert>
            )}

            {/* Only show tracking details if we have shipment data or we're not in drawer mode */}
            {(shipmentData || !isDrawer) && !loading && (
                isDrawer ? (
                    <TrackingDetailSidebar
                        shipmentData={shipmentData}
                        carrier={carrier}
                        loading={loading}
                        error={displayError}
                        mergedEvents={mergedEvents}
                        onRefresh={handleRefreshStatus}
                        trackingNumber={currentTrackingId}
                        onClose={onClose}
                    />
                ) : (
                    <Paper elevation={0} sx={{
                        p: { xs: 2, sm: 3, md: 3 },
                        bgcolor: '#ffffff',
                        borderRadius: 2,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                        <Grid container spacing={{ xs: 2, md: 3 }}>
                            {/* Left Column: Tracking Details */}
                            <Grid item xs={12} md={4}>
                                {/* Enhanced header with smart refresh button */}
                                <Box sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    mb: { xs: 2, md: 2 }
                                }}>
                                    <Typography variant="h6" sx={{
                                        fontWeight: 600,
                                        fontSize: { xs: '1.1rem', sm: '1.25rem' }
                                    }}>
                                        Shipment Details
                                    </Typography>
                                    {shipmentData?.status !== 'draft' && shipmentData?.status !== 'delivered' && (
                                        <IconButton
                                            size="small"
                                            onClick={handleRefreshStatus}
                                            disabled={loading}
                                            title="Refresh tracking information"
                                            sx={{
                                                '&:hover': { bgcolor: 'action.hover' }
                                            }}
                                        >
                                            {loading ? (
                                                <CircularProgress size={16} />
                                            ) : (
                                                <RefreshIcon sx={{ fontSize: 18 }} />
                                            )}
                                        </IconButton>
                                    )}
                                </Box>

                                {/* QR Code Section - Responsive sizing */}
                                <Box sx={{ mb: { xs: 2, md: 3 } }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                        {qrCodeLoading ? (
                                            <Box sx={{
                                                width: '100%',
                                                height: { xs: 150, sm: 180, md: 200 },
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
                                                p: { xs: 1, sm: 2 },
                                                bgcolor: 'background.paper'
                                            }}>
                                                <img
                                                    src={qrCodeUrl}
                                                    alt="Tracking QR Code"
                                                    style={{
                                                        width: 'min(180px, 100%)',
                                                        height: 'min(180px, 100%)',
                                                        display: 'block'
                                                    }}
                                                />
                                            </Box>
                                        ) : (
                                            <Box sx={{
                                                width: '100%',
                                                height: { xs: 150, sm: 180, md: 200 },
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '1px dashed',
                                                borderColor: 'divider',
                                                borderRadius: 1,
                                                bgcolor: 'grey.50'
                                            }}>
                                                <QrCodeIcon sx={{ fontSize: { xs: '2rem', sm: '3rem' }, color: 'text.secondary' }} />
                                            </Box>
                                        )}
                                    </Box>
                                </Box>

                                {/* Info sections with responsive typography */}
                                <Box sx={{ mb: { xs: 2, md: 2.5 } }}>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                        SolushipX Shipment ID
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                        <Typography variant="body1" sx={{
                                            fontWeight: 600,
                                            color: 'primary.main',
                                            fontSize: { xs: '0.9rem', sm: '1rem' },
                                            wordBreak: 'break-all'
                                        }}>
                                            {shipmentData?.shipmentID || 'N/A'}
                                        </Typography>
                                        {shipmentData?.shipmentID && shipmentData.shipmentID !== 'N/A' && (
                                            <IconButton
                                                size="small"
                                                onClick={() => copyToClipboard(shipmentData.shipmentID, 'SolushipX Shipment ID')}
                                                sx={{ padding: '2px', minWidth: 'auto' }}
                                                title="Copy SolushipX Shipment ID"
                                            >
                                                <ContentCopyIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                            </IconButton>
                                        )}
                                    </Box>
                                </Box>

                                {/* Carrier Tracking Number with mobile optimization */}
                                <Box sx={{ mb: { xs: 2, md: 2.5 } }}>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                        Carrier Tracking Number
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                        <Typography variant="body1" sx={{
                                            fontWeight: 600,
                                            color: 'secondary.main',
                                            fontSize: { xs: '0.9rem', sm: '1rem' },
                                            wordBreak: 'break-all'
                                        }}>
                                            {(() => {
                                                // Use the exact same logic as ShipmentDetail.jsx
                                                const isCanparShipment = carrier?.toLowerCase().includes('canpar');

                                                if (isCanparShipment) {
                                                    return shipmentData?.trackingNumber ||
                                                        shipmentData?.carrierBookingConfirmation?.trackingNumber ||
                                                        shipmentData?.selectedRate?.TrackingNumber ||
                                                        shipmentData?.selectedRate?.Barcode ||
                                                        'N/A';
                                                } else {
                                                    // For eShipPlus and other carriers, use proNumber then confirmationNumber
                                                    return shipmentData?.carrierBookingConfirmation?.proNumber ||
                                                        shipmentData?.carrierBookingConfirmation?.confirmationNumber ||
                                                        shipmentData?.trackingNumber ||
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
                                                            'N/A';
                                                    } else {
                                                        // For eShipPlus and other carriers, use proNumber then confirmationNumber
                                                        return shipmentData?.carrierBookingConfirmation?.proNumber ||
                                                            shipmentData?.carrierBookingConfirmation?.confirmationNumber ||
                                                            shipmentData?.trackingNumber ||
                                                            'N/A';
                                                    }
                                                })();
                                                copyToClipboard(trackingNumberToCopy, 'Carrier confirmation number');
                                            }}
                                            title="Copy carrier confirmation number"
                                            sx={{ minWidth: 'auto' }}
                                        >
                                            <ContentCopyIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                        </IconButton>
                                    </Box>
                                </Box>

                                <Box sx={{ mb: { xs: 2, md: 2.5 } }}>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                        Carrier
                                    </Typography>
                                    <CarrierDisplay carrierName={carrier || (shipmentData?.carrier || 'Unknown')} size="small" />
                                </Box>

                                <Box sx={{ mb: { xs: 2, md: 2.5 } }}>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                        Status
                                    </Typography>
                                    <StatusChip status={overallStatus} />
                                </Box>

                                <Box sx={{ mb: { xs: 2, md: 2.5 } }}>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                        Estimated Delivery
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <CalendarToday sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
                                        <Typography variant="body1" sx={{ fontWeight: 500, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                                            {estimatedDeliveryDate}
                                        </Typography>
                                    </Box>
                                </Box>

                                {shipmentData?.shipFrom && (
                                    <Box sx={{ mb: { xs: 2, md: 2.5 } }}>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                            Origin
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <LocationOn sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
                                            <Typography variant="body1" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                                                {formatAddressDisplay(shipmentData.shipFrom)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                                {shipmentData?.shipTo && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                            Destination
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <LocationOn sx={{ fontSize: '1.1rem', color: 'text.secondary' }} />
                                            <Typography variant="body1" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                                                {formatAddressDisplay(shipmentData.shipTo)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Grid>

                            {/* Right Column: Timeline */}
                            <Grid item xs={12} md={8}>
                                <Typography variant="h6" sx={{
                                    fontWeight: 600,
                                    mb: 2,
                                    mt: { xs: 3, md: 0 },
                                    fontSize: { xs: '1.1rem', sm: '1.25rem' }
                                }}>
                                    Tracking History
                                </Typography>
                                <Box sx={{
                                    maxHeight: { xs: '400px', sm: '500px', md: '600px' },
                                    overflowY: 'auto',
                                    pr: 1,
                                    '&::-webkit-scrollbar': { width: '6px' },
                                    '&::-webkit-scrollbar-thumb': { backgroundColor: 'grey.300', borderRadius: '3px' }
                                }}>
                                    <ShipmentTimeline events={mergedEvents} />
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>
                )
            )}
        </Box>
    );

    if (isDrawer) {
        return MainContent;
    }

    return (
        <>
            {/* Public Website Header */}
            <Navigation />

            {/* Main Content */}
            <Box sx={{
                minHeight: '100vh',
                bgcolor: '#f8f9fa',
                paddingTop: { xs: '60px', sm: '70px', md: '80px' } // Account for header height
            }}>
                <Container maxWidth="lg" sx={{
                    pt: { xs: 2, sm: 3, md: 4 },
                    pb: { xs: 4, sm: 5, md: 6 },
                    px: { xs: 1, sm: 2, md: 3 }
                }}>
                    {/* Hero Section with Tracking Form */}
                    <Paper
                        elevation={0}
                        sx={{
                            p: { xs: 3, sm: 4, md: 4 },
                            mb: { xs: 3, sm: 4, md: 4 },
                            borderRadius: { xs: '12px', md: '16px' },
                            background: 'linear-gradient(135deg, #1c277d 0%, #2563eb 100%)',
                            color: 'white',
                            textAlign: 'center'
                        }}
                    >
                        <Typography
                            variant="h3"
                            component="h1"
                            gutterBottom
                            sx={{
                                fontWeight: 700,
                                fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' },
                                mb: { xs: 2, md: 3 }
                            }}
                        >
                            Track Your Shipment
                        </Typography>
                        <Typography
                            variant="h6"
                            sx={{
                                mb: { xs: 3, md: 4 },
                                opacity: 0.9,
                                fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },
                                maxWidth: '600px',
                                mx: 'auto'
                            }}
                        >
                            Enter your shipment ID or carrier tracking number to get real-time updates
                        </Typography>

                        {/* Search Form inside hero */}
                        <Box
                            component="form"
                            onSubmit={handleSubmit}
                            sx={{
                                maxWidth: '500px',
                                mx: 'auto'
                            }}
                        >
                            <TextField
                                fullWidth
                                variant="outlined"
                                placeholder="e.g., IC-DWSLOGISTICS-22OC79"
                                value={trackingNumberInput}
                                onChange={handleInputChange}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon color="action" />
                                        </InputAdornment>
                                    ),
                                    sx: {
                                        borderRadius: 2,
                                        bgcolor: 'white',
                                        fontSize: { xs: '14px', sm: '16px' },
                                        '& input': {
                                            fontSize: { xs: '14px', sm: '16px' },
                                            padding: { xs: '12px 14px', sm: '16.5px 14px' }
                                        }
                                    }
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
                                    bgcolor: 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    '&:hover': {
                                        bgcolor: 'rgba(255,255,255,0.3)',
                                        borderColor: 'rgba(255,255,255,0.5)'
                                    },
                                    borderRadius: 2,
                                    py: { xs: 1.5, sm: 2 },
                                    textTransform: 'none',
                                    fontSize: { xs: '14px', sm: '16px', md: '1rem' },
                                    fontWeight: 600,
                                    backdropFilter: 'blur(10px)'
                                }}
                                disabled={loading}
                            >
                                {loading ? (
                                    <CircularProgress size={24} color="inherit" />
                                ) : (
                                    'Track Shipment'
                                )}
                            </Button>
                        </Box>
                    </Paper>

                    {/* Results Section */}
                    {loading && (
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            p: { xs: 3, md: 4 },
                            textAlign: 'center'
                        }}>
                            <Box>
                                <CircularProgress size={40} />
                                <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>
                                    Searching for your shipment...
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {displayError && !loading && (
                        <Alert
                            severity="error"
                            sx={{
                                mb: { xs: 3, md: 4 },
                                borderRadius: 2,
                                '& .MuiAlert-message': {
                                    fontSize: { xs: '14px', sm: '16px' }
                                }
                            }}
                        >
                            {displayError}
                        </Alert>
                    )}

                    {/* Tracking Details */}
                    {shipmentData && !loading && (
                        <Paper elevation={0} sx={{
                            p: { xs: 2, sm: 3, md: 4 },
                            bgcolor: '#ffffff',
                            borderRadius: { xs: '12px', md: '16px' },
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                        }}>
                            <Grid container spacing={{ xs: 3, md: 4 }}>
                                {/* Left Column: Tracking Details */}
                                <Grid item xs={12} lg={4}>
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        mb: { xs: 2, md: 3 }
                                    }}>
                                        <Typography variant="h5" sx={{
                                            fontWeight: 600,
                                            fontSize: { xs: '1.25rem', sm: '1.5rem' },
                                            color: 'primary.main'
                                        }}>
                                            Shipment Details
                                        </Typography>
                                        {shipmentData?.status !== 'draft' && shipmentData?.status !== 'delivered' && (
                                            <IconButton
                                                size="small"
                                                onClick={handleRefreshStatus}
                                                disabled={loading}
                                                title="Refresh tracking information"
                                                sx={{
                                                    '&:hover': { bgcolor: 'action.hover' },
                                                    p: 1
                                                }}
                                            >
                                                {loading ? (
                                                    <CircularProgress size={18} />
                                                ) : (
                                                    <RefreshIcon sx={{ fontSize: 20 }} />
                                                )}
                                            </IconButton>
                                        )}
                                    </Box>

                                    {/* QR Code Section */}
                                    <Box sx={{ mb: { xs: 3, md: 4 } }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                            {qrCodeLoading ? (
                                                <Box sx={{
                                                    width: '100%',
                                                    height: { xs: 160, sm: 180, md: 200 },
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    borderRadius: 2,
                                                    bgcolor: 'grey.50'
                                                }}>
                                                    <CircularProgress size={32} />
                                                </Box>
                                            ) : qrCodeUrl ? (
                                                <Box sx={{
                                                    width: '100%',
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    borderRadius: 2,
                                                    p: { xs: 2, sm: 3 },
                                                    bgcolor: 'background.paper'
                                                }}>
                                                    <img
                                                        src={qrCodeUrl}
                                                        alt="Tracking QR Code"
                                                        style={{
                                                            width: 'min(200px, 100%)',
                                                            height: 'min(200px, 100%)',
                                                            display: 'block'
                                                        }}
                                                    />
                                                </Box>
                                            ) : (
                                                <Box sx={{
                                                    width: '100%',
                                                    height: { xs: 160, sm: 180, md: 200 },
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: '1px dashed',
                                                    borderColor: 'divider',
                                                    borderRadius: 2,
                                                    bgcolor: 'grey.50'
                                                }}>
                                                    <QrCodeIcon sx={{ fontSize: { xs: '2.5rem', sm: '3rem' }, color: 'text.secondary', mb: 1 }} />
                                                    <Typography variant="caption" color="text.secondary">
                                                        QR Code
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>

                                    {/* Info sections */}
                                    <Box sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: { xs: 2.5, md: 3 }
                                    }}>
                                        {/* SolushipX Shipment ID */}
                                        <Box>
                                            <Typography variant="overline" color="text.secondary" display="block" sx={{
                                                fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                                fontWeight: 600,
                                                letterSpacing: '0.5px',
                                                mb: 0.5
                                            }}>
                                                SolushipX Shipment ID
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                <Typography variant="h6" sx={{
                                                    fontWeight: 600,
                                                    color: 'primary.main',
                                                    fontSize: { xs: '1rem', sm: '1.1rem' },
                                                    wordBreak: 'break-all'
                                                }}>
                                                    {shipmentData?.shipmentID || 'N/A'}
                                                </Typography>
                                                {shipmentData?.shipmentID && shipmentData.shipmentID !== 'N/A' && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => copyToClipboard(shipmentData.shipmentID, 'SolushipX Shipment ID')}
                                                        sx={{ p: 0.5 }}
                                                        title="Copy SolushipX Shipment ID"
                                                    >
                                                        <ContentCopyIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                                                    </IconButton>
                                                )}
                                            </Box>
                                        </Box>

                                        {/* Carrier Tracking Number */}
                                        <Box>
                                            <Typography variant="overline" color="text.secondary" display="block" sx={{
                                                fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                                fontWeight: 600,
                                                letterSpacing: '0.5px',
                                                mb: 0.5
                                            }}>
                                                Carrier Tracking Number
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                <Typography variant="h6" sx={{
                                                    fontWeight: 600,
                                                    color: 'secondary.main',
                                                    fontSize: { xs: '1rem', sm: '1.1rem' },
                                                    wordBreak: 'break-all'
                                                }}>
                                                    {(() => {
                                                        // Use the exact same logic as ShipmentDetail.jsx
                                                        const isCanparShipment = carrier?.toLowerCase().includes('canpar');

                                                        if (isCanparShipment) {
                                                            return shipmentData?.trackingNumber ||
                                                                shipmentData?.carrierBookingConfirmation?.trackingNumber ||
                                                                shipmentData?.selectedRate?.TrackingNumber ||
                                                                shipmentData?.selectedRate?.Barcode ||
                                                                'N/A';
                                                        } else {
                                                            // For eShipPlus and other carriers, use proNumber then confirmationNumber
                                                            return shipmentData?.carrierBookingConfirmation?.proNumber ||
                                                                shipmentData?.carrierBookingConfirmation?.confirmationNumber ||
                                                                shipmentData?.trackingNumber ||
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
                                                                    'N/A';
                                                            } else {
                                                                // For eShipPlus and other carriers, use proNumber then confirmationNumber
                                                                return shipmentData?.carrierBookingConfirmation?.proNumber ||
                                                                    shipmentData?.carrierBookingConfirmation?.confirmationNumber ||
                                                                    shipmentData?.trackingNumber ||
                                                                    'N/A';
                                                            }
                                                        })();
                                                        copyToClipboard(trackingNumberToCopy, 'Carrier confirmation number');
                                                    }}
                                                    title="Copy carrier confirmation number"
                                                    sx={{ p: 0.5 }}
                                                >
                                                    <ContentCopyIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                                                </IconButton>
                                            </Box>
                                        </Box>

                                        {/* Other info sections - Carrier, Status, Delivery, Origin, Destination */}
                                        <Box>
                                            <Typography variant="overline" color="text.secondary" display="block" sx={{
                                                fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                                fontWeight: 600,
                                                letterSpacing: '0.5px',
                                                mb: 0.5
                                            }}>
                                                Carrier
                                            </Typography>
                                            <CarrierDisplay carrierName={carrier || (shipmentData?.carrier || 'Unknown')} size="medium" />
                                        </Box>

                                        <Box>
                                            <Typography variant="overline" color="text.secondary" display="block" sx={{
                                                fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                                fontWeight: 600,
                                                letterSpacing: '0.5px',
                                                mb: 0.5
                                            }}>
                                                Status
                                            </Typography>
                                            <StatusChip status={overallStatus} />
                                        </Box>

                                        <Box>
                                            <Typography variant="overline" color="text.secondary" display="block" sx={{
                                                fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                                fontWeight: 600,
                                                letterSpacing: '0.5px',
                                                mb: 0.5
                                            }}>
                                                Estimated Delivery
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CalendarToday sx={{ fontSize: '1.2rem', color: 'text.secondary' }} />
                                                <Typography variant="body1" sx={{
                                                    fontWeight: 500,
                                                    fontSize: { xs: '1rem', sm: '1.1rem' }
                                                }}>
                                                    {estimatedDeliveryDate}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        {shipmentData?.shipFrom && (
                                            <Box>
                                                <Typography variant="overline" color="text.secondary" display="block" sx={{
                                                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                                    fontWeight: 600,
                                                    letterSpacing: '0.5px',
                                                    mb: 0.5
                                                }}>
                                                    Origin
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <LocationOn sx={{ fontSize: '1.2rem', color: 'text.secondary' }} />
                                                    <Typography variant="body1" sx={{ fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                                                        {formatAddressDisplay(shipmentData.shipFrom)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        )}

                                        {shipmentData?.shipTo && (
                                            <Box>
                                                <Typography variant="overline" color="text.secondary" display="block" sx={{
                                                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                                    fontWeight: 600,
                                                    letterSpacing: '0.5px',
                                                    mb: 0.5
                                                }}>
                                                    Destination
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <LocationOn sx={{ fontSize: '1.2rem', color: 'text.secondary' }} />
                                                    <Typography variant="body1" sx={{ fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                                                        {formatAddressDisplay(shipmentData.shipTo)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        )}
                                    </Box>
                                </Grid>

                                {/* Right Column: Timeline */}
                                <Grid item xs={12} lg={8}>
                                    <Typography variant="h5" sx={{
                                        fontWeight: 600,
                                        mb: { xs: 2, md: 3 },
                                        mt: { xs: 4, lg: 0 },
                                        fontSize: { xs: '1.25rem', sm: '1.5rem' },
                                        color: 'primary.main'
                                    }}>
                                        Tracking History
                                    </Typography>
                                    <Box sx={{
                                        maxHeight: { xs: '500px', sm: '600px', md: '700px' },
                                        overflowY: 'auto',
                                        pr: 1,
                                        '&::-webkit-scrollbar': { width: '6px' },
                                        '&::-webkit-scrollbar-thumb': { backgroundColor: 'grey.300', borderRadius: '3px' }
                                    }}>
                                        <ShipmentTimeline events={mergedEvents} />
                                    </Box>
                                </Grid>
                            </Grid>
                        </Paper>
                    )}
                </Container>
            </Box>
            <Footer />
        </>
    );
};

export default Tracking;
