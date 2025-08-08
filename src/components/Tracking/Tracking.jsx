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
    Menu as MenuIcon,
    AttachMoney as AttachMoneyIcon,
    Description as DescriptionIcon
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
import { dynamicStatusService } from '../../services/DynamicStatusService';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { getDisplayCarrierName } from '../../utils/carrierDisplayService';

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

        // QuickShip-specific event types
        case 'rate_entry':
        case 'rate entry':
            return '#8b5cf6';
        case 'carrier_selection':
        case 'carrier selection':
            return '#0891b2';
        case 'document_generated':
        case 'document generated':
            return '#059669';

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
        // QuickShip-specific event types
        case 'rate_entry':
        case 'rate entry':
            return <AttachMoneyIcon sx={{ fontSize: 'inherit' }} />;
        case 'carrier_selection':
        case 'carrier selection':
            return <LocalShippingIcon sx={{ fontSize: 'inherit' }} />;
        case 'document_generated':
        case 'document generated':
            return <DescriptionIcon sx={{ fontSize: 'inherit' }} />;
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
    const { trackingIdentifier: trackingId } = useParams();
    const { userRole } = useAuth() || {};
    const { companyIdForAddress, companyData } = useCompany() || {};
    const [trackingNumberInput, setTrackingNumberInput] = useState('');
    const [shipmentData, setShipmentData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [displayError, setDisplayError] = useState('');
    const [mergedEvents, setMergedEvents] = useState([]);
    const [eventUnsubscribe, setEventUnsubscribe] = useState(null);
    const [overallStatus, setOverallStatus] = useState('');
    const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [carrier, setCarrier] = useState('');
    const [hasAutoSearched, setHasAutoSearched] = useState(false);
    const [statusService, setStatusService] = useState(null);
    // Check if mobile device for responsive design
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Create a stable fallback date to prevent infinite re-renders
    const stableFallbackDate = useMemo(() => new Date(), []);

    // Use smart status update hook
    const { updateShipmentStatus } = useSmartStatusUpdate();

    // Initialize DynamicStatusService
    useEffect(() => {
        const initializeStatusService = async () => {
            try {
                await dynamicStatusService.initialize();
                setStatusService(dynamicStatusService);
                console.log('📊 [Tracking] DynamicStatusService initialized');
            } catch (error) {
                console.error('📊 [Tracking] Failed to initialize DynamicStatusService:', error);
            }
        };

        initializeStatusService();
    }, []);

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

    const parseTimestamp = (timestamp, fallbackDate = stableFallbackDate) => {
        if (!timestamp) return null;

        try {
            // Handle serverTimestamp placeholders
            if (timestamp._methodName === 'serverTimestamp') {
                return fallbackDate; // Use stable date for pending timestamps
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

    // Helper function to format event status using DynamicStatusService
    const formatEventStatus = (rawStatus) => {
        if (!statusService) {
            return rawStatus;
        }

        try {
            const statusDisplay = statusService.getStatusDisplay(rawStatus);
            if (statusDisplay && statusDisplay.masterStatus) {
                const { masterStatus, subStatus } = statusDisplay;
                if (subStatus) {
                    return `${masterStatus.displayLabel}: ${subStatus.statusLabel}`;
                } else {
                    return masterStatus.displayLabel;
                }
            }
        } catch (error) {
            console.warn('📊 [Tracking] Error formatting event status:', error);
        }

        return rawStatus;
    };

    const searchShipment = useCallback(async (identifier) => {
        console.log('🔍 [Tracking] searchShipment called with identifier:', identifier);

        // Mobile debugging information
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const screenWidth = window.screen.width;
        const viewportWidth = window.innerWidth;

        const deviceInfo = {
            isMobile,
            userAgent: navigator.userAgent,
            screenWidth,
            viewportWidth,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine
        };

        console.log('📱 [Tracking] Device Info:', deviceInfo);

        setLoading(true);
        setError('');
        setDisplayError('');
        setShipmentData(null);
        setMergedEvents([]);

        try {
            console.log('🔍 [Tracking] Starting Firebase query for identifier:', identifier);


            // First, try to find by shipmentID
            const shipmentsRef = collection(db, 'shipments');
            console.log('🔍 [Tracking] Created shipmentsRef:', !!shipmentsRef);

            const shipmentQuery = query(shipmentsRef, where('shipmentID', '==', identifier));
            console.log('🔍 [Tracking] Created shipmentQuery:', !!shipmentQuery);

            console.log('🔍 [Tracking] Executing getDocs...');
            const shipmentSnapshot = await getDocs(shipmentQuery);
            console.log('🔍 [Tracking] Query completed. Empty?:', shipmentSnapshot.empty, 'Size:', shipmentSnapshot.size);


            let shipmentDoc = null;
            if (!shipmentSnapshot.empty) {
                shipmentDoc = shipmentSnapshot.docs[0];
                console.log('✅ [Tracking] Found shipment by shipmentID:', shipmentDoc.id);
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
                console.log('❌ [Tracking] No shipment found for identifier:', identifier);

                setDisplayError('Shipment not found. Please check your tracking number and try again.');
                setLoading(false);
                return;
            }

            console.log('📋 [Tracking] Found shipment document:', shipmentDoc.id);
            const shipmentData = shipmentDoc.data();
            console.log('📋 [Tracking] Raw shipment data keys:', Object.keys(shipmentData));
            console.log('📋 [Tracking] Shipment status:', shipmentData.status);
            console.log('📋 [Tracking] Shipment carrier:', shipmentData.carrier || shipmentData.selectedCarrier);


            // Apply encoding fixes
            const fixedShipmentData = fixShipmentEncoding(shipmentData);
            console.log('📋 [Tracking] Fixed shipment data status:', fixedShipmentData.status);

            setShipmentData(fixedShipmentData);

            // Extract carrier information (real)
            const rawCarrierName = fixedShipmentData.carrier ||
                fixedShipmentData.selectedRate?.carrier?.name ||
                fixedShipmentData.selectedRate?.carrier ||
                'Unknown';

            // Apply company override for non-admin users when company context is available
            const isAdmin = userRole === 'admin' || userRole === 'superadmin';
            const displayCarrierName = getDisplayCarrierName(
                rawCarrierName,
                companyIdForAddress || fixedShipmentData.companyID || fixedShipmentData.companyId,
                companyData || null,
                isAdmin
            );
            setCarrier(displayCarrierName);

            // Set up real-time event listening like ShipmentDetailX
            console.log('📋 [Tracking] Setting up real-time event listening for shipment:', identifier);

            // Use the same event loading mechanism as ShipmentDetailX
            const unsubscribe = listenToShipmentEvents(identifier, (events) => {
                console.log('📋 [Tracking] Received real-time events:', events);

                // Transform events to match ShipmentTimeline format (same as ShipmentDetailX)
                const transformedEvents = (events || []).map(event => {
                    const rawStatus = event.title || event.status || event.eventType || 'Status Update';
                    const formattedStatus = formatEventStatus(rawStatus);

                    return {
                        id: event.eventId || event.id || `event-${Date.now()}-${Math.random()}`,
                        status: formattedStatus,
                        description: event.description || event.message || `Event: ${formattedStatus}`,
                        location: event.location || { city: '', state: '', postalCode: '' },
                        timestamp: parseTimestamp(event.timestamp) || stableFallbackDate,
                        color: getStatusColor(event.eventType || event.status || event.title),
                        icon: getStatusIcon(event.eventType || event.status || event.title),
                        eventType: event.eventType || event.status || event.title,
                        source: event.source || 'system',
                        userData: event.userData || {}
                    };
                });

                // Add synthetic events from shipment data - ENHANCED FOR QUICKSHIP
                const syntheticEvents = [];
                const isQuickShip = fixedShipmentData.creationMethod === 'quickship' || fixedShipmentData.isQuickShip;

                console.log('📋 [Tracking] Shipment type detection:', {
                    isQuickShip,
                    creationMethod: fixedShipmentData.creationMethod,
                    isQuickShipFlag: fixedShipmentData.isQuickShip,
                    status: fixedShipmentData.status,
                    bookedAt: fixedShipmentData.bookedAt,
                    createdAt: fixedShipmentData.createdAt
                });

                // Add created event if not present
                const hasCreated = transformedEvents.some(e => (e.eventType === 'created' || (e.status && typeof e.status === 'string' && e.status.toLowerCase().includes('created'))));
                if (!hasCreated && fixedShipmentData?.createdAt) {
                    syntheticEvents.push({
                        id: 'created-' + identifier,
                        status: 'Created',
                        description: isQuickShip ? 'QuickShip shipment was created' : 'Shipment was created',
                        location: { city: '', state: '', postalCode: '' },
                        timestamp: parseTimestamp(fixedShipmentData.createdAt) || stableFallbackDate,
                        color: getStatusColor('created'),
                        icon: getStatusIcon('created'),
                        eventType: 'created',
                        source: 'user',
                        userData: {
                            email: fixedShipmentData.createdByEmail || fixedShipmentData.createdBy || fixedShipmentData.userEmail || null,
                            userId: fixedShipmentData.createdBy || null,
                            userName: fixedShipmentData.createdByName || null
                        }
                    });
                }

                // Add booked event if present - ENHANCED FOR QUICKSHIP
                const bookingTimestamp = fixedShipmentData?.bookedAt || fixedShipmentData?.bookingTimestamp;
                if (bookingTimestamp && fixedShipmentData.status !== 'draft') {
                    const hasBooked = transformedEvents.some(e => (e.eventType === 'booked' || (e.status && typeof e.status === 'string' && e.status.toLowerCase().includes('booked'))));
                    if (!hasBooked) {
                        const carrierName = fixedShipmentData.carrier || fixedShipmentData.selectedCarrier || 'carrier';
                        syntheticEvents.push({
                            id: 'booked-' + identifier,
                            status: 'Booked',
                            description: isQuickShip ?
                                `QuickShip shipment booked with ${carrierName}` :
                                'Shipment was booked with carrier',
                            location: { city: '', state: '', postalCode: '' },
                            timestamp: parseTimestamp(bookingTimestamp) || stableFallbackDate,
                            color: getStatusColor('booked'),
                            icon: getStatusIcon('booked'),
                            eventType: 'booked',
                            source: 'system',
                            userData: {}
                        });
                    }
                }

                // Add current status event if different from existing events
                if (fixedShipmentData?.status && fixedShipmentData.status !== 'draft') {
                    const hasCurrentStatus = transformedEvents.some(e =>
                        e.eventType === fixedShipmentData.status ||
                        (e.status && typeof e.status === 'string' && e.status.toLowerCase() === fixedShipmentData.status.toLowerCase())
                    );
                    if (!hasCurrentStatus) {
                        const formattedStatus = formatEventStatus(fixedShipmentData.status);
                        syntheticEvents.push({
                            id: 'current-status-' + identifier,
                            status: formattedStatus,
                            description: `Shipment status updated to ${formattedStatus}`,
                            location: { city: '', state: '', postalCode: '' },
                            timestamp: parseTimestamp(fixedShipmentData.updatedAt) || parseTimestamp(fixedShipmentData.createdAt) || stableFallbackDate,
                            color: getStatusColor(fixedShipmentData.status),
                            icon: getStatusIcon(fixedShipmentData.status),
                            eventType: fixedShipmentData.status,
                            source: 'system',
                            userData: {}
                        });
                    }
                }

                // Add QuickShip-specific events if this is a QuickShip shipment
                if (isQuickShip) {
                    // Add rate entry event
                    if (fixedShipmentData.manualRates && fixedShipmentData.manualRates.length > 0) {
                        const hasRateEntry = transformedEvents.some(e => e.eventType === 'rate_entry' || (e.status && e.status.toLowerCase().includes('rate')));
                        if (!hasRateEntry) {
                            syntheticEvents.push({
                                id: 'rate-entry-' + identifier,
                                status: 'Rate Entry',
                                description: `Manual rates entered (${fixedShipmentData.manualRates.length} line items)`,
                                location: { city: '', state: '', postalCode: '' },
                                timestamp: parseTimestamp(fixedShipmentData.createdAt) || stableFallbackDate,
                                color: getStatusColor('rate_entry'),
                                icon: getStatusIcon('rate_entry'),
                                eventType: 'rate_entry',
                                source: 'user',
                                userData: {}
                            });
                        }
                    }

                    // Add carrier selection event
                    if (fixedShipmentData.carrier || fixedShipmentData.selectedCarrier) {
                        const hasCarrierSelection = transformedEvents.some(e => e.eventType === 'carrier_selection' || (e.status && e.status.toLowerCase().includes('carrier')));
                        if (!hasCarrierSelection) {
                            const rawCarrierNameForEvent = fixedShipmentData.carrier || fixedShipmentData.selectedCarrier;
                            const displayCarrierNameForEvent = getDisplayCarrierName(
                                rawCarrierNameForEvent,
                                companyIdForAddress || fixedShipmentData.companyID || fixedShipmentData.companyId,
                                companyData || null,
                                isAdmin
                            );
                            syntheticEvents.push({
                                id: 'carrier-selection-' + identifier,
                                status: 'Carrier Selected',
                                description: `Carrier selected: ${displayCarrierNameForEvent}`,
                                location: { city: '', state: '', postalCode: '' },
                                timestamp: parseTimestamp(fixedShipmentData.createdAt) || stableFallbackDate,
                                color: getStatusColor('carrier_selection'),
                                icon: getStatusIcon('carrier_selection'),
                                eventType: 'carrier_selection',
                                source: 'user',
                                userData: {}
                            });
                        }
                    }

                    // Add document generation events if documents exist
                    if (fixedShipmentData.documents || fixedShipmentData.generatedDocuments) {
                        const hasDocumentGeneration = transformedEvents.some(e => e.eventType === 'document_generated' || (e.status && e.status.toLowerCase().includes('document')));
                        if (!hasDocumentGeneration) {
                            syntheticEvents.push({
                                id: 'documents-generated-' + identifier,
                                status: 'Documents Generated',
                                description: 'BOL and carrier confirmation documents generated',
                                location: { city: '', state: '', postalCode: '' },
                                timestamp: parseTimestamp(bookingTimestamp) || parseTimestamp(fixedShipmentData.createdAt) || stableFallbackDate,
                                color: getStatusColor('document_generated'),
                                icon: getStatusIcon('document_generated'),
                                eventType: 'document_generated',
                                source: 'system',
                                userData: {}
                            });
                        }
                    }
                }

                // Combine and sort all events
                const allEvents = [...transformedEvents, ...syntheticEvents];
                const sortedEvents = allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                console.log('📋 [Tracking] Final events for timeline:', sortedEvents);
                setMergedEvents(sortedEvents);
            });

            // Store the unsubscribe function to clean up later
            setEventUnsubscribe(() => unsubscribe);

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
                // Check for delivered date in shipment data
                const deliveredDate = fixedShipmentData.deliveredDate ||
                    fixedShipmentData.deliveryDate ||
                    fixedShipmentData.actualDeliveryDate ||
                    fixedShipmentData.completedAt;

                if (deliveredDate) {
                    const deliveryDate = parseTimestamp(deliveredDate);
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
                // Check multiple possible ETA field names - ENHANCED FOR QUICKSHIP
                const eta1 = fixedShipmentData.ETA1 ||
                    fixedShipmentData.eta1 ||
                    fixedShipmentData.ETA_1 ||
                    fixedShipmentData.estimatedDeliveryDate1 ||
                    fixedShipmentData.shipmentInfo?.eta1; // QuickShip ETA1
                const eta2 = fixedShipmentData.ETA2 ||
                    fixedShipmentData.eta2 ||
                    fixedShipmentData.ETA_2 ||
                    fixedShipmentData.estimatedDeliveryDate2 ||
                    fixedShipmentData.shipmentInfo?.eta2; // QuickShip ETA2
                const estimatedDelivery = fixedShipmentData.estimatedDelivery ||
                    fixedShipmentData.estimatedDeliveryDate;
                const carrierEstimatedDelivery = fixedShipmentData.carrierBookingConfirmation?.estimatedDeliveryDate ||
                    fixedShipmentData.selectedRate?.transit?.estimatedDelivery ||
                    fixedShipmentData.selectedRate?.estimatedDeliveryDate;

                console.log('🗓️ [Tracking] ETA Debug:', {
                    eta1: eta1,
                    eta2: eta2,
                    estimatedDelivery: estimatedDelivery,
                    carrierEstimatedDelivery: carrierEstimatedDelivery,
                    allFields: Object.keys(fixedShipmentData).filter(key =>
                        key.toLowerCase().includes('eta') ||
                        key.toLowerCase().includes('delivery') ||
                        key.toLowerCase().includes('due')
                    )
                });

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
            console.error('❌ [Tracking] Error searching for shipment:', error);

            console.error('❌ [Tracking] Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack,
                name: error.name
            });

            // Provide more specific error messages for mobile debugging
            let errorMessage = 'An error occurred while searching for your shipment. Please try again.';
            if (error.code === 'permission-denied') {
                errorMessage = 'Access denied. Please check your internet connection and try again.';
            } else if (error.code === 'unavailable') {
                errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
            } else if (error.message.includes('network')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            }

            setDisplayError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    // Cleanup event listener when component unmounts or tracking ID changes
    useEffect(() => {
        return () => {
            if (eventUnsubscribe) {
                console.log('📋 [Tracking] Cleaning up event listener');
                eventUnsubscribe();
            }
        };
    }, [eventUnsubscribe]);

    // Effect to handle URL tracking ID and prop tracking identifier
    useEffect(() => {
        console.log('🔍 [Tracking] URL Effect - trackingId:', trackingId, 'propTrackingIdentifier:', propTrackingIdentifier, 'hasAutoSearched:', hasAutoSearched, 'isDrawer:', isDrawer);

        const identifier = trackingId || propTrackingIdentifier;

        if (identifier) {
            // For drawer mode, always search when trackingIdentifier changes (even if we've searched before)
            // For standalone mode, only search if we haven't auto-searched yet
            const shouldSearch = isDrawer || !hasAutoSearched;

            if (shouldSearch) {
                console.log('🔍 [Tracking] Auto-searching from URL/prop:', identifier, '(drawer mode:', isDrawer, ')');

                setTrackingNumberInput(identifier);
                setHasAutoSearched(true);
                searchShipment(identifier);
            }
        }
    }, [trackingId, propTrackingIdentifier, hasAutoSearched, isDrawer]);

    // Reset hasAutoSearched when propTrackingIdentifier changes (for drawer mode)
    useEffect(() => {
        if (isDrawer && propTrackingIdentifier) {
            console.log('🔄 [Tracking] Drawer mode - resetting hasAutoSearched for new tracking identifier:', propTrackingIdentifier);
            setHasAutoSearched(false);
        }
    }, [propTrackingIdentifier, isDrawer]);

    // Main content component
    const MainContent = (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f8f9fa' }}>
            {/* Compact Search Section - Hide in drawer mode */}
            {!isDrawer && (
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
            )}



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
                <Container
                    maxWidth={isDrawer ? false : "lg"}
                    sx={{
                        py: isDrawer ? 1 : 2,
                        px: isDrawer ? 2 : 3,
                        maxWidth: isDrawer ? 'none' : undefined
                    }}
                >
                    <Paper elevation={0} sx={{
                        p: isDrawer ? 1.5 : 2,
                        bgcolor: '#ffffff',
                        borderRadius: 2,
                        boxShadow: isDrawer ? 'none' : '0 2px 4px rgba(0,0,0,0.05)',
                        border: isDrawer ? '1px solid #e5e7eb' : 'none'
                    }}>
                        {/* Compact Tracking Info Cards */}
                        <Grid container spacing={2} sx={{ mb: isDrawer ? 2 : 3 }}>
                            <Grid item xs={12} sm={isDrawer ? 12 : 6}>
                                <Paper elevation={1} sx={{ p: isDrawer ? 1.5 : 2, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
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

                            <Grid item xs={12} sm={isDrawer ? 12 : 6}>
                                <Paper elevation={1} sx={{ p: isDrawer ? 1.5 : 2, borderRadius: 2, bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
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

                        <Grid container spacing={isDrawer ? 2 : 3}>
                            {/* Left Column: Route Map & Shipment Details */}
                            <Grid item xs={12} md={isDrawer ? 12 : 6}>
                                {/* Compact Route Map */}
                                <Box sx={{ mb: isDrawer ? 2 : 3 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, fontSize: '14px', color: 'text.primary' }}>
                                        Route Overview
                                    </Typography>
                                    <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                                        <TrackingRouteMap
                                            shipmentData={shipmentData}
                                            carrier={carrier}
                                            height={isDrawer ? 140 : 200}
                                            loading={loading}

                                        />
                                    </Paper>
                                </Box>

                                {/* Shipment Details */}
                                <Box sx={{ mb: isDrawer ? 2 : 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isDrawer ? 1 : 2 }}>
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

                                    <Box sx={{
                                        display: 'flex',
                                        flexDirection: isDrawer ? 'column' : 'column',
                                        gap: isDrawer ? 1.5 : 2
                                    }}>
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
                                </Box>
                            </Grid>

                            {/* Right Column: Tracking History */}
                            <Grid item xs={12} md={isDrawer ? 12 : 6}>
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, fontSize: '14px', color: 'text.primary' }}>
                                        Tracking History
                                    </Typography>
                                    <Box sx={{
                                        overflowY: 'auto',
                                        pr: 1,
                                        maxHeight: isDrawer ? '400px' : 'none',
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
