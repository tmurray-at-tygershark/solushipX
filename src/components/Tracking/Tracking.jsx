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
    Refresh as RefreshIcon,
    Menu as MenuIcon
} from '@mui/icons-material';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { db, functions } from '../../firebase'; // Firebase setup
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import ShipmentTimeline from './ShipmentTimeline';
import EnhancedStatusChip from '../StatusChip/EnhancedStatusChip';
import { listenToShipmentEvents } from '../../utils/shipmentEvents'; // Import shipment events utilities
import { useSmartStatusUpdate } from '../../hooks/useSmartStatusUpdate'; // Import smart status update hook
import { fixShipmentEncoding, fixAddressEncoding } from '../../utils/textUtils'; // Import encoding fix utilities
import TrackingDetailSidebar from './TrackingDetailSidebar';
import TrackingRouteMap from './TrackingRouteMap';
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
        small: { logoSize: 20, fontSize: '12px' },
        medium: { logoSize: 24, fontSize: '12px' },
        large: { logoSize: 28, fontSize: '12px' }
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
    const navigate = useNavigate();
    const { trackingId } = useParams();
    const [trackingNumberInput, setTrackingNumberInput] = useState('');
    const [shipmentData, setShipmentData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [displayError, setDisplayError] = useState('');
    const [mergedEvents, setMergedEvents] = useState([]);
    const [overallStatus, setOverallStatus] = useState('');
    const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [carrier, setCarrier] = useState('');

    // Use smart status update hook
    const { updateShipmentStatus } = useSmartStatusUpdate();

    // Copy to clipboard function
    const copyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            // You might want to show a toast notification here
            console.log(`${label} copied to clipboard: ${text}`);
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    };

    // Refresh status function
    const handleRefreshStatus = async () => {
        if (!shipmentData?.shipmentID) return;

        setLoading(true);
        try {
            await updateShipmentStatus(shipmentData.shipmentID);
            // Reload the shipment data after status update
            await handleSubmit({ preventDefault: () => { } }, shipmentData.shipmentID);
        } catch (error) {
            console.error('Error refreshing status:', error);
            setError('Failed to refresh tracking status. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const identifier = trackingNumberInput.trim();
        if (identifier) {
            searchShipment(identifier);
        }
    };

    const handleInputChange = (e) => {
        setTrackingNumberInput(e.target.value);
    };

    const parseTimestamp = (timestamp) => {
        if (!timestamp) return null;

        try {
            // Handle serverTimestamp placeholders
            if (timestamp._methodName === 'serverTimestamp') {
                return new Date(); // Use current date for pending timestamps
            }

            // Handle Firestore Timestamp
            if (timestamp && typeof timestamp === 'object' && timestamp.toDate && typeof timestamp.toDate === 'function') {
                try {
                    return timestamp.toDate();
                } catch (error) {
                    console.warn('Error calling toDate():', error);
                    return null;
                }
            }
            // Handle timestamp objects with seconds and nanoseconds
            if (timestamp && typeof timestamp === 'object' && typeof timestamp.seconds === 'number') {
                return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
            }
            // Handle timestamp objects with _seconds (alternative format)
            if (timestamp && typeof timestamp === 'object' && typeof timestamp._seconds === 'number') {
                return new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000);
            }
            // Handle numeric timestamps
            if (typeof timestamp === 'number') {
                return new Date(timestamp);
            }
            // Handle Date objects
            if (timestamp instanceof Date) {
                return timestamp;
            }
            // Handle string timestamps
            if (typeof timestamp === 'string') {
                return new Date(timestamp);
            }

            console.warn('Unknown timestamp format:', timestamp);
            return null;
        } catch (error) {
            console.error('Error parsing timestamp:', error);
            return null;
        }
    };

    const searchShipment = async (identifier) => {
        setLoading(true);
        setError('');
        setDisplayError('');
        setShipmentData(null);
        setMergedEvents([]);

        try {
            // First, try to find by shipmentID
            const shipmentsRef = collection(db, 'shipments');
            const shipmentQuery = query(shipmentsRef, where('shipmentID', '==', identifier));
            const shipmentSnapshot = await getDocs(shipmentQuery);

            let shipmentDoc = null;
            if (!shipmentSnapshot.empty) {
                shipmentDoc = shipmentSnapshot.docs[0];
            } else {
                // If not found by shipmentID, try to find by trackingNumber
                const trackingQuery = query(shipmentsRef, where('trackingNumber', '==', identifier));
                const trackingSnapshot = await getDocs(trackingQuery);

                if (!trackingSnapshot.empty) {
                    shipmentDoc = trackingSnapshot.docs[0];
                } else {
                    // Try to find by carrierBookingConfirmation.proNumber
                    const proNumberQuery = query(shipmentsRef, where('carrierBookingConfirmation.proNumber', '==', identifier));
                    const proNumberSnapshot = await getDocs(proNumberQuery);

                    if (!proNumberSnapshot.empty) {
                        shipmentDoc = proNumberSnapshot.docs[0];
                    } else {
                        // Try to find by carrierBookingConfirmation.confirmationNumber
                        const confirmationQuery = query(shipmentsRef, where('carrierBookingConfirmation.confirmationNumber', '==', identifier));
                        const confirmationSnapshot = await getDocs(confirmationQuery);

                        if (!confirmationSnapshot.empty) {
                            shipmentDoc = confirmationSnapshot.docs[0];
                        }
                    }
                }
            }

            if (!shipmentDoc) {
                setDisplayError('Shipment not found. Please check your tracking number and try again.');
                setLoading(false);
                return;
            }

            const shipmentData = shipmentDoc.data();

            // Apply encoding fixes
            const fixedShipmentData = fixShipmentEncoding(shipmentData);

            setShipmentData(fixedShipmentData);

            // Extract carrier information
            const carrierName = fixedShipmentData.carrier ||
                fixedShipmentData.selectedRate?.carrier?.name ||
                fixedShipmentData.selectedRate?.carrier ||
                'Unknown';
            setCarrier(carrierName);

            // Get shipment events
            const eventsRef = collection(db, 'shipmentEvents');
            const eventsQuery = query(eventsRef, where('shipmentID', '==', identifier));
            const eventsSnapshot = await getDocs(eventsQuery);

            const events = eventsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Merge with shipment status history if available
            const statusHistory = fixedShipmentData.statusHistory || [];
            const mergedEventsList = [...events, ...statusHistory];

            // Sort events by timestamp (newest first)
            mergedEventsList.sort((a, b) => {
                const dateA = parseTimestamp(a.timestamp);
                const dateB = parseTimestamp(b.timestamp);
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateB - dateA;
            });

            setMergedEvents(mergedEventsList);

            // Determine overall status
            const currentStatus = fixedShipmentData.status || 'unknown';
            setOverallStatus(currentStatus);

            // Determine estimated delivery date
            const formatEtaDate = (etaValue) => {
                if (!etaValue) return null;

                try {
                    // Handle Firestore Timestamp
                    if (etaValue && typeof etaValue === 'object' && etaValue.toDate && typeof etaValue.toDate === 'function') {
                        return etaValue.toDate().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        });
                    }

                    // Handle timestamp objects with seconds
                    if (etaValue && typeof etaValue === 'object' && typeof etaValue.seconds === 'number') {
                        const date = new Date(etaValue.seconds * 1000 + (etaValue.nanoseconds || 0) / 1000000);
                        return date.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        });
                    }

                    // Handle string dates
                    if (typeof etaValue === 'string') {
                        const date = new Date(etaValue);
                        if (!isNaN(date.getTime())) {
                            return date.toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                            });
                        }
                        return etaValue; // Return as-is if it's already a formatted string
                    }

                    // Handle Date objects
                    if (etaValue instanceof Date) {
                        return etaValue.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        });
                    }

                    return etaValue.toString();
                } catch (error) {
                    console.error('Error formatting ETA date:', error);
                    return 'Invalid Date';
                }
            };

            // Check if shipment is delivered and get delivery date
            if (currentStatus?.toLowerCase() === 'delivered') {
                // Look for delivery event in merged events
                const deliveryEvent = mergedEventsList.find(event =>
                    event.status?.toLowerCase().includes('delivered') ||
                    event.title?.toLowerCase().includes('delivered')
                );

                if (deliveryEvent && deliveryEvent.timestamp) {
                    const deliveryDate = parseTimestamp(deliveryEvent.timestamp);
                    if (deliveryDate) {
                        setEstimatedDeliveryDate(deliveryDate.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        }));
                    } else {
                        setEstimatedDeliveryDate('Delivered');
                    }
                } else {
                    setEstimatedDeliveryDate('Delivered');
                }
            } else {
                // For non-delivered shipments, use ETA fields
                const eta1 = fixedShipmentData.ETA1;
                const eta2 = fixedShipmentData.ETA2;
                const estimatedDelivery = fixedShipmentData.estimatedDelivery;
                const carrierEstimatedDelivery = fixedShipmentData.carrierBookingConfirmation?.estimatedDeliveryDate ||
                    fixedShipmentData.selectedRate?.transit?.estimatedDelivery ||
                    fixedShipmentData.selectedRate?.estimatedDeliveryDate;

                if (eta1 && eta2) {
                    const formattedEta1 = formatEtaDate(eta1);
                    const formattedEta2 = formatEtaDate(eta2);
                    setEstimatedDeliveryDate({
                        eta1: formattedEta1,
                        eta2: formattedEta2,
                        hasBothETAs: true
                    });
                } else if (eta1) {
                    setEstimatedDeliveryDate(formatEtaDate(eta1));
                } else if (eta2) {
                    setEstimatedDeliveryDate(formatEtaDate(eta2));
                } else if (estimatedDelivery) {
                    setEstimatedDeliveryDate(formatEtaDate(estimatedDelivery));
                } else if (carrierEstimatedDelivery) {
                    setEstimatedDeliveryDate(formatEtaDate(carrierEstimatedDelivery));
                } else {
                    setEstimatedDeliveryDate('N/A');
                }
            }

        } catch (error) {
            console.error('Error searching shipment:', error);
            setDisplayError('An error occurred while searching for your shipment. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Effect to handle URL tracking ID
    useEffect(() => {
        if (trackingId) {
            setTrackingNumberInput(trackingId);
            searchShipment(trackingId);
        } else if (propTrackingIdentifier) {
            setTrackingNumberInput(propTrackingIdentifier);
            searchShipment(propTrackingIdentifier);
        }
    }, [trackingId, propTrackingIdentifier]);

    // Main content component
    const MainContent = (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f8f9fa' }}>
            {/* Compact Search Section */}
            <Container maxWidth="lg" sx={{ pt: 2, pb: 2 }}>
                <Paper elevation={0} sx={{
                    p: 2,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #1c277d 0%, #2563eb 100%)',
                    color: 'white'
                }}>
                    <Typography variant="h6" sx={{
                        fontWeight: 600,
                        fontSize: '16px',
                        mb: 1,
                        textAlign: 'center'
                    }}>
                        Track Your Shipment
                    </Typography>
                    <Typography variant="body2" sx={{
                        fontSize: '12px',
                        mb: 2,
                        opacity: 0.9,
                        textAlign: 'center'
                    }}>
                        Enter your shipment ID or carrier tracking number
                    </Typography>

                    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1, maxWidth: '500px', mx: 'auto' }}>
                        <TextField
                            fullWidth
                            size="small"
                            variant="outlined"
                            placeholder="e.g., IC-DWSLOGISTICS-22OC79"
                            value={trackingNumberInput}
                            onChange={handleInputChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ fontSize: '16px', color: 'action.main' }} />
                                    </InputAdornment>
                                ),
                                sx: {
                                    bgcolor: 'white',
                                    fontSize: '12px',
                                    '& input': {
                                        fontSize: '12px',
                                        padding: '8px 12px'
                                    }
                                }
                            }}
                        />
                        <Button
                            type="submit"
                            variant="contained"
                            size="small"
                            disabled={loading}
                            sx={{
                                bgcolor: 'rgba(255,255,255,0.2)',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.3)',
                                '&:hover': {
                                    bgcolor: 'rgba(255,255,255,0.3)'
                                },
                                fontSize: '12px',
                                fontWeight: 600,
                                px: 3,
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {loading ? <CircularProgress size={16} color="inherit" /> : 'Track'}
                        </Button>
                    </Box>
                </Paper>
            </Container>

            {/* Loading State */}
            {loading && (
                <Container maxWidth="lg" sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                        <Box sx={{ textAlign: 'center' }}>
                            <CircularProgress size={32} />
                            <Typography variant="body2" sx={{ mt: 1, fontSize: '12px', color: 'text.secondary' }}>
                                Searching for your shipment...
                            </Typography>
                        </Box>
                    </Box>
                </Container>
            )}

            {/* Error State */}
            {displayError && !loading && (
                <Container maxWidth="lg" sx={{ py: 2 }}>
                    <Alert severity="error" sx={{ fontSize: '12px' }}>
                        {displayError}
                    </Alert>
                </Container>
            )}

            {/* Results Section */}
            {shipmentData && !loading && (
                <Container maxWidth="lg" sx={{ py: 2 }}>
                    <Paper elevation={0} sx={{
                        p: 2,
                        bgcolor: '#ffffff',
                        borderRadius: 2,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                        {/* Compact Tracking Info Cards */}
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={12} sm={6}>
                                <Paper elevation={1} sx={{ p: 2, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                                    <Typography variant="overline" sx={{ fontSize: '10px', fontWeight: 600, opacity: 0.8 }}>
                                        SolushipX ID
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                        <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '12px', wordBreak: 'break-all' }}>
                                            {shipmentData?.shipmentID || 'N/A'}
                                        </Typography>
                                        {shipmentData?.shipmentID && shipmentData.shipmentID !== 'N/A' && (
                                            <IconButton
                                                size="small"
                                                onClick={() => copyToClipboard(shipmentData.shipmentID, 'SolushipX Shipment ID')}
                                                sx={{ p: 0.5, color: 'inherit' }}
                                            >
                                                <ContentCopyIcon sx={{ fontSize: '12px' }} />
                                            </IconButton>
                                        )}
                                    </Box>
                                </Paper>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <Paper elevation={1} sx={{ p: 2, borderRadius: 2, bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
                                    <Typography variant="overline" sx={{ fontSize: '10px', fontWeight: 600, opacity: 0.8 }}>
                                        Carrier Tracking #
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                        <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '12px', wordBreak: 'break-all' }}>
                                            {(() => {
                                                const isCanparShipment = carrier?.toLowerCase().includes('canpar');
                                                if (isCanparShipment) {
                                                    return shipmentData?.trackingNumber ||
                                                        shipmentData?.carrierBookingConfirmation?.trackingNumber ||
                                                        shipmentData?.selectedRate?.TrackingNumber ||
                                                        shipmentData?.selectedRate?.Barcode ||
                                                        'N/A';
                                                } else {
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
                                                    const isCanparShipment = carrier?.toLowerCase().includes('canpar');
                                                    if (isCanparShipment) {
                                                        return shipmentData?.trackingNumber ||
                                                            shipmentData?.carrierBookingConfirmation?.trackingNumber ||
                                                            shipmentData?.selectedRate?.TrackingNumber ||
                                                            shipmentData?.selectedRate?.Barcode ||
                                                            'N/A';
                                                    } else {
                                                        return shipmentData?.carrierBookingConfirmation?.proNumber ||
                                                            shipmentData?.carrierBookingConfirmation?.confirmationNumber ||
                                                            shipmentData?.trackingNumber ||
                                                            'N/A';
                                                    }
                                                })();
                                                copyToClipboard(trackingNumberToCopy, 'Carrier confirmation number');
                                            }}
                                            sx={{ p: 0.5, color: 'inherit' }}
                                        >
                                            <ContentCopyIcon sx={{ fontSize: '12px' }} />
                                        </IconButton>
                                    </Box>
                                </Paper>
                            </Grid>
                        </Grid>

                        <Grid container spacing={3}>
                            {/* Left Column: Primary Shipment Details */}
                            <Grid item xs={12} lg={6}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '14px', color: 'primary.main' }}>
                                        Shipment Details
                                    </Typography>
                                    {shipmentData?.status !== 'draft' && shipmentData?.status !== 'delivered' && (
                                        <IconButton
                                            size="small"
                                            onClick={handleRefreshStatus}
                                            disabled={loading}
                                            title="Refresh tracking information"
                                        >
                                            {loading ? <CircularProgress size={16} /> : <RefreshIcon sx={{ fontSize: '16px' }} />}
                                        </IconButton>
                                    )}
                                </Box>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Box>
                                        <Typography variant="overline" color="text.secondary" sx={{ fontSize: '10px', fontWeight: 600, display: 'block', mb: 0.5 }}>
                                            Carrier
                                        </Typography>
                                        <CarrierDisplay carrierName={carrier || (shipmentData?.carrier || 'Unknown')} size="small" />
                                    </Box>

                                    <Box>
                                        <Typography variant="overline" color="text.secondary" sx={{ fontSize: '10px', fontWeight: 600, display: 'block', mb: 0.5 }}>
                                            Current Status
                                        </Typography>
                                        <EnhancedStatusChip status={overallStatus} />
                                    </Box>

                                    <Box>
                                        <Typography variant="overline" color="text.secondary" sx={{ fontSize: '10px', fontWeight: 600, display: 'block', mb: 0.5 }}>
                                            {overallStatus?.toLowerCase() === 'delivered' ? 'Delivered On' : 'Estimated Delivery'}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CalendarToday sx={{ fontSize: '16px', color: 'text.secondary' }} />
                                            <Box>
                                                {estimatedDeliveryDate?.hasBothETAs ? (
                                                    <Box>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500, color: overallStatus?.toLowerCase() === 'delivered' ? 'success.main' : 'text.primary' }}>
                                                            ETA 1: {estimatedDeliveryDate.eta1}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500, color: overallStatus?.toLowerCase() === 'delivered' ? 'success.main' : 'text.primary' }}>
                                                            ETA 2: {estimatedDeliveryDate.eta2}
                                                        </Typography>
                                                    </Box>
                                                ) : (
                                                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500, color: overallStatus?.toLowerCase() === 'delivered' ? 'success.main' : 'text.primary' }}>
                                                        {estimatedDeliveryDate}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                    </Box>

                                    {shipmentData?.shipFrom && (
                                        <Box>
                                            <Typography variant="overline" color="text.secondary" sx={{ fontSize: '10px', fontWeight: 600, display: 'block', mb: 0.5 }}>
                                                Origin
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <LocationOn sx={{ fontSize: '16px', color: 'success.main' }} />
                                                <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {formatAddressDisplay(shipmentData.shipFrom)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    )}

                                    {shipmentData?.shipTo && (
                                        <Box>
                                            <Typography variant="overline" color="text.secondary" sx={{ fontSize: '10px', fontWeight: 600, display: 'block', mb: 0.5 }}>
                                                Destination
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <LocationOn sx={{ fontSize: '16px', color: 'error.main' }} />
                                                <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {formatAddressDisplay(shipmentData.shipTo)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            </Grid>

                            {/* Right Column: Route Map & Timeline */}
                            <Grid item xs={12} lg={6}>
                                {/* Compact Route Map */}
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, fontSize: '14px', color: 'text.primary' }}>
                                        Route Overview
                                    </Typography>
                                    <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                                        <TrackingRouteMap
                                            shipmentData={shipmentData}
                                            carrier={carrier}
                                            height={200}
                                            loading={loading}
                                        />
                                    </Paper>
                                </Box>

                                {/* Timeline */}
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, fontSize: '14px', color: 'text.primary' }}>
                                        Tracking History
                                    </Typography>
                                    <Box sx={{
                                        maxHeight: '400px',
                                        overflowY: 'auto',
                                        pr: 1,
                                        '&::-webkit-scrollbar': { width: '4px' },
                                        '&::-webkit-scrollbar-thumb': { backgroundColor: 'grey.300', borderRadius: '2px' }
                                    }}>
                                        <ShipmentTimeline events={mergedEvents} />
                                    </Box>
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>
                </Container>
            )}
        </Box>
    );

    if (isDrawer) {
        return MainContent;
    }

    return (
        <>
            {/* Static Public Website Header */}
            <Box sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1100,
                bgcolor: 'transparent'
            }}>
                <Navigation />
            </Box>

            {/* Main Content */}
            <Box sx={{ paddingTop: { xs: '70px', sm: '80px', md: '90px' } }}>
                {MainContent}
            </Box>
            <Footer />
        </>
    );
};

export default Tracking;
