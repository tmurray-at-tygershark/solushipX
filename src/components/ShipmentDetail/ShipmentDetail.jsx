import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Chip,
    Stack,
    Button,
    ButtonGroup,
    Collapse,
    Link as MuiLink,
    Avatar,
    CircularProgress,
    IconButton,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    TextField,
    Divider,
    Tooltip,
    Backdrop,
    Card,
    CardContent,
    CardActions,
    InputAdornment,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    ToggleButtonGroup,
    ToggleButton,
    Slider,
    Switch,
    FormControlLabel,
    Alert,
    Snackbar,
    Fade,
    Zoom,
    useTheme,
    alpha,
    Skeleton
} from '@mui/material';
import {
    ExpandMore,
    ExpandLess,
    LocationOn as LocationOnIcon,
    Business as BusinessIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    LocalShipping as LocalShippingIcon,
    Print as PrintIcon,
    Download as DownloadIcon,
    NavigateNext as NavigateNextIcon,
    Home as HomeIcon,
    KeyboardArrowDown as KeyboardArrowDownIcon,
    Description as DescriptionIcon,
    Assignment as AssignmentIcon,
    AccessTime as AccessTimeIcon,
    Inventory2 as Inventory2Icon,
    Route as RouteIcon,
    Timeline as TimelineIcon,
    Schedule as ScheduleIcon,
    CheckCircle as CheckCircleIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
    Visibility as VisibilityIcon,
    Close as CloseIcon,
    Add as AddIcon,
    Remove as RemoveIcon,
    GetApp as GetAppIcon,
    FileDownload as FileDownloadIcon,
    PictureAsPdf as PictureAsPdfIcon,
    Settings as SettingsIcon,
    SwapHoriz as SwapHorizIcon,
    Map as MapIcon,
    LocationOn as LocationIcon,
    AttachMoney as MoneyIcon,
    ExpandMore as ExpandMoreIcon,
    Inventory as BoxIcon,
    Person as PersonIcon,
    CalendarToday as CalendarIcon,
    FileCopy as FileCopyIcon,
    Refresh as RefreshIcon,
    ArrowBack as ArrowBackIcon,
    ZoomIn as ZoomInIcon,
    CheckCircleOutline as CheckCircleOutlineIcon,
    Pause as PauseIcon,
    Cancel as CancelIcon,
    Edit as EditIcon,
    HelpOutline as HelpOutlineIcon,
    ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';

import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, LoadScript } from '@react-google-maps/api';
import html2pdf from 'html2pdf.js';
import { PDFDocument } from 'pdf-lib'; // For PDF manipulation
import StatusChip from '../StatusChip/StatusChip';
import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineConnector,
    TimelineContent,
    TimelineDot
} from '@mui/lab';
import { getRateDetailsByDocumentId, getRatesForShipment } from '../../utils/rateUtils';
import { getShipmentEvents, recordShipmentEvent, EVENT_TYPES, EVENT_SOURCES, recordStatusChange, recordTrackingUpdate, listenToShipmentEvents, subscribeToShipmentEvents } from "../../utils/shipmentEvents";
import { useSmartStatusUpdate } from '../../hooks/useSmartStatusUpdate';
import './ShipmentDetail.css';

// Define libraries array as a static constant outside the component
const GOOGLE_MAPS_LIBRARIES = ["places", "geometry", "routes"];

// Add at the top with other helper functions
const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';

    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'Invalid Date';

        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return 'Invalid Date';
    }
};

// Add this helper function to determine the most recent update timestamp
const getLastUpdatedTimestamp = (shipment, mergedEvents) => {
    const timestamps = [];

    // 1. Latest event timestamp from tracking/shipment events
    if (mergedEvents && mergedEvents.length > 0) {
        const latestEventTimestamp = mergedEvents[0]?.timestamp; // mergedEvents are sorted newest first
        if (latestEventTimestamp) {
            timestamps.push(new Date(latestEventTimestamp));
        }
    }

    // 2. Status last checked timestamp
    if (shipment?.statusLastChecked) {
        timestamps.push(new Date(shipment.statusLastChecked));
    }

    // 3. Tracking last updated timestamp
    if (shipment?.tracking?.lastUpdated) {
        timestamps.push(new Date(shipment.tracking.lastUpdated));
    }

    // 4. Shipment updated timestamp
    if (shipment?.updatedAt) {
        const updatedAt = shipment.updatedAt.toDate ? shipment.updatedAt.toDate() : new Date(shipment.updatedAt);
        timestamps.push(updatedAt);
    }

    // 5. Carrier tracking data timestamp (from refresh status)
    if (shipment?.carrierTrackingData?.lastChecked) {
        timestamps.push(new Date(shipment.carrierTrackingData.lastChecked));
    }

    // Return the most recent timestamp
    if (timestamps.length > 0) {
        return new Date(Math.max(...timestamps.map(t => t.getTime())));
    }

    return null;
};

// Add ErrorBoundary component at the top
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            return (
                <Box sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: '#fff3f3',
                    border: '1px solid #ffcdd2'
                }}>
                    <Typography color="error" variant="subtitle2" gutterBottom>
                        Something went wrong loading this component
                    </Typography>
                    <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => window.location.reload()}
                    >
                        Reload Page
                    </Button>
                </Box>
            );
        }
        return this.props.children;
    }
}

// Optimize SimpleMap component
const SimpleMap = React.memo(({ address, title }) => {
    const [position, setPosition] = useState(null);
    const [error, setError] = useState(null);
    const mapRef = useRef(null);

    useEffect(() => {
        if (!window.google || !window.google.maps) {
            setError('Google Maps not loaded');
            return;
        }

        if (!address) {
            setError('Address information is missing');
            return;
        }

        const geocoder = new window.google.maps.Geocoder();
        const addressString = `${address.street || ''}${address.street2 ? ', ' + address.street2 : ''}, ${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}, ${address.country || ''}`;

        geocoder.geocode({ address: addressString }, (results, status) => {
            if (status === 'OK') {
                const location = results[0].geometry.location;
                setPosition({
                    lat: location.lat(),
                    lng: location.lng()
                });

                // Fit bounds with padding
                if (mapRef.current) {
                    const bounds = new window.google.maps.LatLngBounds();
                    bounds.extend(location);
                    mapRef.current.fitBounds(bounds, {
                        padding: { top: 50, right: 50, bottom: 50, left: 50 }
                    });
                }
            } else {
                console.error('Geocoding failed:', status);
                setError('Failed to geocode address');
            }
        });
    }, [address]);

    const handleMapLoad = React.useCallback((map) => {
        mapRef.current = map;
    }, []);

    if (error) {
        return (
            <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                    {title}
                </Typography>
                <Box sx={{
                    height: '200px',
                    borderRadius: '12px',
                    bgcolor: '#f5f5f5',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1
                }}>
                    <Typography color="error">{error}</Typography>
                    <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={() => window.location.reload()}
                    >
                        Retry
                    </Button>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                {title}
            </Typography>
            <Box sx={{
                height: '200px',
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {position ? (
                    <GoogleMap
                        mapContainerStyle={{
                            width: '100%',
                            height: '100%'
                        }}
                        center={position}
                        zoom={15}
                        onLoad={handleMapLoad}
                        options={{
                            disableDefaultUI: false,
                            zoomControl: true,
                            streetViewControl: false,
                            mapTypeControl: false,
                            fullscreenControl: false,
                            styles: [
                                {
                                    featureType: 'poi',
                                    elementType: 'labels',
                                    stylers: [{ visibility: 'off' }]
                                },
                                {
                                    featureType: 'transit',
                                    elementType: 'labels',
                                    stylers: [{ visibility: 'off' }]
                                }
                            ]
                        }}
                    >
                        <Marker
                            position={position}
                            icon={{
                                path: window.google.maps.SymbolPath.CIRCLE,
                                scale: 12,
                                fillColor: title.includes('From') ? '#2196f3' : '#f44336',
                                fillOpacity: 1,
                                strokeColor: '#ffffff',
                                strokeWeight: 2
                            }}
                            label={{
                                text: title.includes('From') ? 'A' : 'B',
                                color: '#ffffff',
                                fontSize: '14px',
                                fontWeight: 'bold'
                            }}
                        />
                    </GoogleMap>
                ) : (
                    <Box sx={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: '#f5f5f5'
                    }}>
                        <CircularProgress size={24} />
                    </Box>
                )}
            </Box>
        </Box>
    );
});

// Add LoadingSkeleton component
const LoadingSkeleton = () => (
    <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
        <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header Skeleton */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skeleton width={300} height={40} />
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Skeleton width={100} height={40} />
                    <Skeleton width={100} height={40} />
                </Box>
            </Box>

            {/* Shipment Info Skeleton */}
            <Paper sx={{ mb: 3 }}>
                <Box sx={{ p: 2 }}>
                    <Skeleton width={200} height={32} />
                </Box>
                <Box sx={{ p: 3 }}>
                    <Grid container spacing={2}>
                        {[1, 2, 3].map((i) => (
                            <Grid item xs={12} md={4} key={i}>
                                <Box sx={{ display: 'grid', gap: 2 }}>
                                    <Skeleton width={150} height={24} />
                                    <Skeleton width={200} height={24} />
                                    <Skeleton width={180} height={24} />
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </Paper>

            {/* Locations and Rate Details Skeleton */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <Paper sx={{ mb: 3 }}>
                        <Box sx={{ p: 2 }}>
                            <Skeleton width={200} height={32} />
                        </Box>
                        <Box sx={{ p: 3 }}>
                            <Grid container spacing={3}>
                                {[1, 2].map((i) => (
                                    <Grid item xs={12} md={6} key={i}>
                                        <Skeleton width={150} height={32} />
                                        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, my: 2 }} />
                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                            <Skeleton width={200} height={24} />
                                            <Skeleton width={180} height={24} />
                                            <Skeleton width={160} height={24} />
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper>
                        <Box sx={{ p: 2 }}>
                            <Skeleton width={150} height={32} />
                        </Box>
                        <Box sx={{ p: 3 }}>
                            <Box sx={{ display: 'grid', gap: 2 }}>
                                {[1, 2, 3, 4].map((i) => (
                                    <Skeleton key={i} width={200} height={24} />
                                ))}
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    </Box>
);

// Add optimized Timeline component
const ShipmentTimeline = React.memo(({ events, shipmentId }) => (
    <Timeline
        sx={{
            [`& .MuiTimelineItem-root`]: {
                minHeight: 'auto',
                '&:before': {
                    display: 'none',
                },
            },
            [`& .MuiTimelineDot-root`]: {
                margin: 0,
                padding: 1,
                borderWidth: 0,
            },
            [`& .MuiTimelineConnector-root`]: {
                width: 2,
                backgroundColor: '#e0e0e0',
            },
            [`& .MuiTimelineContent-root`]: {
                padding: '0 16px 24px',
            },
        }}
    >
        {events.map((event, index) => (
            <TimelineItem key={event.id}>
                <TimelineSeparator>
                    <TimelineDot
                        sx={{
                            bgcolor: event.color,
                            boxShadow: 'none',
                            margin: 0,
                        }}
                    >
                        {event.icon}
                    </TimelineDot>
                    {index < events.length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent>
                    <Box
                        sx={{
                            bgcolor: 'background.paper',
                            p: 2,
                            borderRadius: 2,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            border: '1px solid',
                            borderColor: 'divider',
                            transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                            },
                        }}
                    >
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                            {event.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </Typography>
                        {event.location && (event.location.city || event.location.state || event.location.postalCode) && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {[
                                    event.location.city,
                                    event.location.state,
                                    event.location.postalCode
                                ].filter(Boolean).join(', ')}
                            </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            {formatTimestamp(event.timestamp)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {event.description}
                        </Typography>
                        {event.userData && event.userData.email && (
                            <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    {`User: ${event.userData.email}`}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </TimelineContent>
            </TimelineItem>
        ))}
    </Timeline>
));


// Helper function to capitalize shipment type
const capitalizeShipmentType = (type) => {
    if (!type) return 'N/A';
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

// CarrierDisplay component to show carrier logo and name
const CarrierDisplay = React.memo(({ carrierName, carrierData, size = 'medium', isIntegrationCarrier }) => {
    const sizeConfig = {
        small: { logoSize: 24, fontSize: '0.875rem' },
        medium: { logoSize: 32, fontSize: '1rem' },
        large: { logoSize: 40, fontSize: '1.125rem' }
    };

    const { logoSize, fontSize } = sizeConfig[size] || sizeConfig.medium;

    if (!carrierName || carrierName === 'N/A') {
        return <Typography variant="body1" sx={{ fontSize }}>N/A</Typography>;
    }

    const logoUrl = carrierData?.logoUrl || carrierData?.image;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {logoUrl ? (
                <Box
                    component="img"
                    src={logoUrl}
                    alt={`${carrierName} logo`}
                    sx={{
                        width: logoSize,
                        height: logoSize,
                        objectFit: 'contain',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        p: 0.5
                    }}
                    onError={(e) => {
                        e.target.style.display = 'none';
                    }}
                />
            ) : (
                <Avatar
                    sx={{
                        width: logoSize,
                        height: logoSize,
                        bgcolor: 'primary.main',
                        fontSize: fontSize,
                        fontWeight: 600
                    }}
                >
                    {carrierName.charAt(0).toUpperCase()}
                </Avatar>
            )}
            <Typography variant="body1" sx={{ fontSize, fontWeight: 500 }}>
                {carrierName}
                {isIntegrationCarrier && (
                    <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
                        (via eShipPlus)
                    </Typography>
                )}
            </Typography>
        </Box>
    );
});

const ShipmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const [expandedSections, setExpandedSections] = useState({
        shipment: true,
        locations: true,
        packages: true,
        rate: true,
        route: true,
        documents: true
    });
    const [showAllPackages, setShowAllPackages] = useState(false);
    const [mapsApiKey, setMapsApiKey] = useState(null);
    const [directions, setDirections] = useState(null);
    const [mapError, setMapError] = useState(null);
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [mapCenter, setMapCenter] = useState({ lat: 43.6532, lng: -79.3832 });
    const [mapZoom, setMapZoom] = useState(5);
    const [mapBounds, setMapBounds] = useState(null);
    const [map, setMap] = useState(null);
    const [useMetric, setUseMetric] = useState(false);
    const [shipment, setShipment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [trackingRecords, setTrackingRecords] = useState([]);
    const [isMapReady, setIsMapReady] = useState(false);
    const [customers, setCustomers] = useState({});
    const [carrierData, setCarrierData] = useState(null);
    const [isRefreshingHistory, setIsRefreshingHistory] = useState(false); // Added this line

    // Enhanced state for action buttons with individual loading states
    const [actionStates, setActionStates] = useState({
        printLabel: { loading: false, error: null },
        printBOL: { loading: false, error: null },
        printShipment: { loading: false, error: null },
        refreshStatus: { loading: false, error: null },
        generateBOL: { loading: false, error: null }
    });

    // PDF Viewer Modal state
    const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
    const [currentPdfUrl, setCurrentPdfUrl] = useState(null);
    const [currentPdfTitle, setCurrentPdfTitle] = useState('');

    // Label printing configuration state
    const [labelConfig, setLabelConfig] = useState({
        quantity: 1,
        labelType: '4x6', // '4x6' or 'avery3x4' for eShipPlus
        selectedLabelId: null,
        availableTypes: []
    });

    // Enhanced print label menu state
    const [printLabelMenuOpen, setPrintLabelMenuOpen] = useState(false);
    const [printLabelAnchorEl, setPrintLabelAnchorEl] = useState(null);
    const [showLabelTypeSelector, setShowLabelTypeSelector] = useState(false);

    // State for document management
    const [shipmentDocuments, setShipmentDocuments] = useState({
        labels: [],
        bol: [],
        other: []
    });
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const [documentsError, setDocumentsError] = useState(null);

    // Rate-related state for new data structure
    const [detailedRateInfo, setDetailedRateInfo] = useState(null);
    const [rateLoading, setRateLoading] = useState(false);
    const [allShipmentRates, setAllShipmentRates] = useState([]);

    // Snackbar for user feedback
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // Add at the top of the component:
    const [shipmentEvents, setShipmentEvents] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('info');

    // Cancel shipment state
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);

    // Replace the old refresh status logic with smart status update
    const {
        loading: smartUpdateLoading,
        error: smartUpdateError,
        updateResult,
        performSmartUpdate,
        forceRefresh: forceSmartRefresh,
        getUpdateStatusMessage,
        clearUpdateState,
        hasUpdates,
        wasSkipped
    } = useSmartStatusUpdate(shipment?.id, shipment);

    useEffect(() => {
        if (!shipment?.id && !shipment?.shipmentID) {
            setHistoryLoading(false);
            setShipmentEvents([]); // Clear events if no ID
            return;
        }

        setHistoryLoading(true);
        // Determine the ID to use for listening
        const idToListen = shipment.id || shipment.shipmentID;

        // Subscribe to real-time updates
        const unsubscribe = listenToShipmentEvents(idToListen, (events) => {
            setShipmentEvents(events || []);
            setHistoryLoading(false);
        });

        // Cleanup: Unsubscribe when component unmounts or shipment ID changes
        return () => {
            unsubscribe();
        };
    }, [shipment?.id, shipment?.shipmentID]); // Re-run if shipment.id or shipment.shipmentID changes

    // Merge tracking and shipment events, always include a 'created' event
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
        if (!hasCreated && shipment?.createdAt) {
            all.push({
                id: 'created-' + (shipment.id || shipment.shipmentID),
                status: 'Created',
                description: 'Shipment was created',
                location: { city: '', state: '', postalCode: '' },
                timestamp: shipment.createdAt.toDate ? shipment.createdAt.toDate() : new Date(shipment.createdAt),
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
        // Sort by timestamp descending
        return all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [trackingRecords, shipmentEvents, shipment]);

    // Helper to update action loading states
    const setActionLoading = (action, loading, error = null) => {
        setActionStates(prev => ({
            ...prev,
            [action]: { loading, error }
        }));
    };

    // Helper to show snackbar messages
    const showSnackbar = (message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    // Enhanced handler functions for action buttons
    const handlePrintLabelClick = (event) => {
        // Check if we have eShipPlus labels with different types
        const labels = shipmentDocuments.labels || [];
        if (isEShipPlusCarrier && labels.length > 1) { // Restored isEShipPlusCarrier
            setShowLabelTypeSelector(true);
        }
        setPrintLabelAnchorEl(event.currentTarget);
        setPrintLabelMenuOpen(true);
    };

    const handlePrintLabelClose = () => {
        setPrintLabelAnchorEl(null);
        setPrintLabelMenuOpen(false);
        setShowLabelTypeSelector(false);
    };

    // Enhanced PDF viewer function
    const viewPdfInModal = async (documentId, filename, title, actionType = 'printLabel') => {
        try {
            setActionLoading(actionType, true);

            const getDocumentDownloadUrlFunction = httpsCallable(functions, 'getDocumentDownloadUrl');
            const result = await getDocumentDownloadUrlFunction({
                documentId: documentId,
                shipmentId: shipment?.id // Pass shipmentId for unified structure support
            });

            if (result.data && result.data.success) {
                setCurrentPdfUrl(result.data.downloadUrl);
                setCurrentPdfTitle(title || filename || 'Document');
                setPdfViewerOpen(true);
                console.log('PDF viewer opened for document:', {
                    documentId,
                    title,
                    foundInUnified: result.data.metadata?.foundInUnified,
                    storagePath: result.data.metadata?.storagePath
                });
            } else {
                throw new Error(result.data?.error || 'Failed to get document URL');
            }

        } catch (error) {
            console.error('Error viewing document:', error);
            showSnackbar('Failed to load document: ' + error.message, 'error');
        } finally {
            setActionLoading(actionType, false);
        }
    };

    // Enhanced PDF multiplication function
    const multiplyPdfLabels = async (pdfArrayBuffer, quantity) => {
        try {
            if (quantity <= 1) return pdfArrayBuffer;

            const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
            const pages = pdfDoc.getPages();

            // Create a new PDF with repeated pages
            const newPdfDoc = await PDFDocument.create();

            for (let i = 0; i < quantity; i++) {
                for (const page of pages) {
                    const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pages.indexOf(page)]);
                    newPdfDoc.addPage(copiedPage);
                }
            }

            return await newPdfDoc.save();
        } catch (error) {
            console.error('Error multiplying PDF labels:', error);
            throw new Error('Failed to create multiple labels');
        }
    };

    // Enhanced print label function with quantity and type selection
    const handlePrintLabel = async (quantity = 1, labelType = '4x6') => {
        try {
            setActionLoading('printLabel', true);
            showSnackbar(`Generating ${quantity} label(s)...`, 'info');

            let labels = shipmentDocuments.labels || [];

            // Fallback: If no labels but we have other documents, try to find shipping documents
            if (labels.length === 0) {
                console.log('No labels found, searching all documents for shipping documents...');
                const allDocs = Object.values(shipmentDocuments).flat();

                const potentialLabels = allDocs.filter(doc => {
                    const filename = (doc.filename || '').toLowerCase();
                    const documentType = (doc.documentType || '').toLowerCase();

                    // Look for shipping-related documents
                    return filename.includes('label') ||
                        filename.includes('shipping') ||
                        filename.includes('ship') ||
                        filename.includes('print') ||
                        // Specific eShipPlus ProLabel patterns
                        filename.includes('prolabel') ||
                        filename.includes('pro-label') ||
                        filename.includes('prolabel4x6') ||
                        filename.includes('prolabelavery') ||
                        filename.includes('4x6inch') ||
                        filename.includes('3x4inch') ||
                        documentType.includes('label') ||
                        documentType.includes('shipping') ||
                        // For freight shipments, any PDF might be a label
                        (shipment?.shipmentInfo?.shipmentType === 'freight' &&
                            filename.includes('.pdf') &&
                            !filename.includes('bol') &&
                            !filename.includes('billoflading') &&  // eShipPlus BOL pattern
                            !filename.includes('invoice'));
                });

                if (potentialLabels.length > 0) {
                    console.log('Found potential shipping labels:', potentialLabels);
                    labels = potentialLabels;
                    showSnackbar('Found shipping documents to print', 'info');
                } else {
                    throw new Error('No shipping labels or documents available for this shipment');
                }
            }

            let selectedLabel = labels[0];

            // For eShipPlus, select based on label type if multiple are available
            if (isEShipPlusCarrier && labels.length > 1) {
                const typeToSearch = labelType === 'Thermal' ? 'avery3x4' : labelType;
                const typeBasedLabel = labels.find(label => {
                    const isAvery = label.filename?.toLowerCase().includes('avery') ||
                        label.docType === 1 ||
                        label.metadata?.eshipplus?.docType === 1;
                    return typeToSearch === 'avery3x4' ? isAvery : !isAvery;
                });
                if (typeBasedLabel) selectedLabel = typeBasedLabel;
            }

            const getDocumentDownloadUrlFunction = httpsCallable(functions, 'getDocumentDownloadUrl');
            const result = await getDocumentDownloadUrlFunction({
                documentId: selectedLabel.id,
                shipmentId: shipment?.id // Pass shipmentId for unified structure support
            });

            if (result.data.success) {
                if (quantity === 1) {
                    // Single label - view in modal
                    await viewPdfInModal(
                        selectedLabel.id,
                        selectedLabel.filename,
                        `${labelType.toUpperCase()} ${labels.length > 0 ? 'Label' : 'Document'} - ${shipment?.shipmentID}`,
                        'printLabel'
                    );
                } else {
                    // Multiple labels - fetch PDF, multiply, and show in modal
                    const response = await fetch(result.data.downloadUrl);
                    const pdfArrayBuffer = await response.arrayBuffer();
                    const multipliedPdf = await multiplyPdfLabels(pdfArrayBuffer, quantity);

                    // Create blob URL for the multiplied PDF
                    const blob = new Blob([multipliedPdf], { type: 'application/pdf' });
                    const multipliedPdfUrl = URL.createObjectURL(blob);

                    setCurrentPdfUrl(multipliedPdfUrl);
                    setCurrentPdfTitle(`${quantity}x ${labelType.toUpperCase()} ${labels.length > 0 ? 'Labels' : 'Documents'} - ${shipment?.shipmentID}`);
                    setPdfViewerOpen(true);
                }

                showSnackbar(`${quantity} ${labels.length > 0 ? 'label(s)' : 'document(s)'} ready for printing`, 'success');
            } else {
                throw new Error('Failed to get download URL');
            }
        } catch (error) {
            console.error('Error printing label:', error);
            showSnackbar('Failed to print document: ' + error.message, 'error');
        } finally {
            setActionLoading('printLabel', false);
            handlePrintLabelClose();
        }
    };

    // Enhanced BOL handler
    const handlePrintBOL = async () => {
        try {
            setActionLoading('printBOL', true);
            showSnackbar('Loading Bill of Lading...', 'info');

            const bolDocuments = shipmentDocuments.bol || [];

            if (bolDocuments.length > 0) {
                // Enhanced BOL selection with priority for generated BOL
                console.log('🔍 BOL Selection - Available BOL documents:', bolDocuments.map(doc => ({
                    id: doc.id,
                    filename: doc.filename,
                    isGeneratedBOL: doc.isGeneratedBOL,
                    replacesApiBOL: doc.replacesApiBOL,
                    docType: doc.docType,
                    carrier: doc.carrier,
                    metadata: doc.metadata
                })));

                // Priority 1: Look for explicitly generated BOL with our flags
                let generatedBOL = bolDocuments.find(doc =>
                    doc.isGeneratedBOL === true ||
                    doc.metadata?.generated === true ||
                    doc.metadata?.eshipplus?.generated === true ||
                    doc.metadata?.polaris?.generated === true ||
                    doc.metadata?.canpar?.generated === true
                );

                // Priority 2: Look for BOL with generated filename pattern
                if (!generatedBOL) {
                    generatedBOL = bolDocuments.find(doc =>
                        doc.filename?.includes('-bol') ||
                        doc.filename?.includes('generated-bol') ||
                        doc.filename?.includes('professional-bol')
                    );
                }

                if (generatedBOL) {
                    console.log('✅ Selected generated BOL document:', {
                        id: generatedBOL.id,
                        filename: generatedBOL.filename,
                        isGeneratedBOL: generatedBOL.isGeneratedBOL,
                        carrier: generatedBOL.carrier
                    });

                    showSnackbar('Opening generated BOL...', 'success');

                    // Use PDF modal instead of new tab
                    await viewPdfInModal(
                        generatedBOL.id,
                        generatedBOL.filename,
                        `Generated BOL - ${shipment?.shipmentID}`,
                        'printBOL'
                    );
                } else {
                    // No generated BOL found, use the first available BOL
                    showSnackbar('Opening BOL document...', 'success');
                    await viewPdfInModal(
                        bolDocuments[0].id,
                        bolDocuments[0].filename,
                        `BOL - ${shipment?.shipmentID}`,
                        'printBOL'
                    );
                }
            } else {
                // No BOL documents exist - offer to generate one
                const shouldGenerate = window.confirm(
                    'No BOL document found. Would you like to generate a professional BOL document?'
                );

                if (shouldGenerate) {
                    // Check carrier type and call appropriate generation function
                    const carrierName = carrierData?.name?.toLowerCase() || '';
                    if (carrierName.includes('eshipplus')) {
                        await generateEShipPlusBOLDocument();
                    } else if (carrierName.includes('polaris')) {
                        await generatePolarisTransportationBOLDocument();
                    } else {
                        showSnackbar('BOL generation not available for this carrier', 'warning');
                    }
                } else {
                    showSnackbar('BOL generation cancelled', 'info');
                }
            }

        } catch (error) {
            console.error('Error printing BOL:', error);
            showSnackbar(`Failed to print BOL: ${error.message}`, 'error');
        } finally {
            setActionLoading('printBOL', false);
        }
    };

    // Helper function to generate eShipPlus BOL
    const generateEShipPlusBOLDocument = async () => {
        try {
            setActionLoading('generateBOL', true);
            showSnackbar('Generating professional BOL...', 'info');

            const generateEShipPlusBOLFunction = httpsCallable(functions, 'generateEShipPlusBOL');

            const confirmationNumber = shipment?.carrierBookingConfirmation?.confirmationNumber ||
                shipment?.carrierBookingConfirmation?.proNumber ||
                shipment?.shipmentID;

            const result = await generateEShipPlusBOLFunction({
                shipmentId: confirmationNumber,
                firebaseDocId: shipment?.id
            });

            if (result.data && result.data.success) {
                showSnackbar('Professional BOL generated successfully!', 'success');

                // Refresh documents to show the new BOL
                await fetchShipmentDocuments();

                // Auto-open the generated BOL
                const documentId = result.data.data.documentId;
                await viewPdfInModal(
                    documentId,
                    result.data.data.fileName,
                    `Generated BOL - ${shipment?.shipmentID}`,
                    'printBOL'
                );

            } else {
                throw new Error(result.data?.error || 'Failed to generate BOL');
            }

        } catch (error) {
            console.error('Error generating eShipPlus BOL:', error);
            showSnackbar('Failed to generate BOL: ' + error.message, 'error');
        } finally {
            setActionLoading('generateBOL', false);
        }
    };

    // Enhanced shipment print handler
    const handlePrintShipment = async () => {
        try {
            setActionLoading('printShipment', true);
            showSnackbar('Generating shipment PDF...', 'info');

            const element = document.getElementById('shipment-detail-content');
            const opt = {
                margin: 0.5,
                filename: `shipment-${shipment?.shipmentID || shipment?.id}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false
                },
                jsPDF: {
                    unit: 'in',
                    format: 'a4',
                    orientation: 'portrait'
                }
            };

            await html2pdf().set(opt).from(element).save();
            showSnackbar('Shipment PDF downloaded successfully', 'success');
        } catch (error) {
            console.error('Error generating shipment PDF:', error);
            showSnackbar('Failed to generate shipment PDF: ' + error.message, 'error');
        } finally {
            setActionLoading('printShipment', false);
        }
    };

    // Quantity selector handlers
    const handleQuantityChange = (newQuantity) => {
        setLabelConfig(prev => ({ ...prev, quantity: newQuantity }));
    };

    const handleLabelTypeChange = (newType) => {
        setLabelConfig(prev => ({ ...prev, labelType: newType }));
    };

    /**
     * Refresh shipment status using smart status update system
     */
    const handleRefreshStatus = async () => {
        try {
            // Clear any previous update state
            clearUpdateState();

            // Show initial loading message
            showSnackbar('Checking shipment status...', 'info');

            // Use the smart status update system
            const result = await forceSmartRefresh();

            if (result && result.success) {
                if (result.statusChanged) {
                    // Status changed - update local state and show success
                    setShipment(prev => {
                        const updatedShipment = {
                            ...prev,
                            status: result.newStatus,
                            statusLastChecked: new Date().toISOString(),
                            lastSmartUpdate: new Date().toISOString(),
                            carrierTrackingData: result.carrierData || prev.carrierTrackingData
                        };

                        // Force a re-render by updating the state
                        setTimeout(() => {
                            setShipment(updatedShipment);
                        }, 0);

                        return updatedShipment;
                    });

                    showSnackbar(
                        `Status updated: ${result.previousStatus} → ${result.newStatus}`,
                        'success'
                    );

                    // If tracking updates were also received, mention them
                    if (result.trackingUpdatesCount > 0) {
                        setTimeout(() => {
                            showSnackbar(
                                `${result.trackingUpdatesCount} new tracking events added to history`,
                                'info'
                            );
                        }, 2000);
                    }
                } else if (result.skipped) {
                    // Update was skipped due to intelligent rules
                    showSnackbar(result.reason || 'Status check skipped', 'info');
                } else if (result.updated) {
                    // Status confirmed but no change
                    setShipment(prev => {
                        const updatedShipment = {
                            ...prev,
                            statusLastChecked: new Date().toISOString(),
                            lastSmartUpdate: new Date().toISOString(),
                            carrierTrackingData: result.carrierData || prev.carrierTrackingData
                        };

                        // Force a re-render by updating the state
                        setTimeout(() => {
                            setShipment(updatedShipment);
                        }, 0);

                        return updatedShipment;
                    });

                    if (result.trackingUpdatesCount > 0) {
                        showSnackbar(
                            `Status confirmed. ${result.trackingUpdatesCount} new tracking events added.`,
                            'success'
                        );
                    } else {
                        showSnackbar('Status confirmed - no new updates', 'success');
                    }
                }

                // Handle eShipPlus history refresh if applicable
                await handleEShipPlusHistoryRefresh();

            } else {
                // Handle error case
                const errorMessage = result?.error || smartUpdateError || 'Failed to refresh status';
                showSnackbar(`Failed to check status: ${errorMessage}`, 'error');
            }

        } catch (error) {
            console.error('Error in smart status refresh:', error);
            showSnackbar('Failed to refresh status. Please try again.', 'error');
        }
    };

    /**
     * Handle eShipPlus-specific history refresh
     */
    const handleEShipPlusHistoryRefresh = async () => {
        try {
            // Check if this is an eShipPlus shipment with confirmation number
            const isEShipPlusShipment = getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' ||
                getBestRateInfo?.sourceCarrierName === 'eShipPlus' ||
                carrierData?.name?.toLowerCase().includes('eshipplus') ||
                carrierData?.carrierID === 'ESHIPPLUS';

            if (isEShipPlusShipment && shipment?.carrierBookingConfirmation?.confirmationNumber) {
                setIsRefreshingHistory(true);
                showSnackbar('Fetching detailed eShipPlus history...', 'info');

                const getHistoryEShipPlusCallable = httpsCallable(functions, 'getHistoryEShipPlus');
                const historyResult = await getHistoryEShipPlusCallable({
                    shipmentNumber: shipment.carrierBookingConfirmation.confirmationNumber
                });

                if (historyResult.data.success && historyResult.data.trackingUpdates && historyResult.data.trackingUpdates.length > 0) {
                    // Enhanced validation that uses existing eShipPlus translation logic
                    const validTrackingUpdates = historyResult.data.trackingUpdates.filter(update => {
                        // More lenient timestamp validation - allow future dates since eShipPlus API sometimes has year errors
                        const updateTimestamp = new Date(update.timestamp);
                        const now = new Date();
                        const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
                        const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());

                        const hasValidTimestamp = updateTimestamp >= twoYearsAgo && updateTimestamp <= twoYearsFromNow;

                        // Check for placeholder/invalid tracking numbers
                        const trackingNumber = update.trackingNumber || update.proNumber || '';
                        const hasValidTrackingNumber = trackingNumber &&
                            !trackingNumber.includes('WWW0000000') &&
                            !trackingNumber.includes('PLACEHOLDER') &&
                            !trackingNumber.match(/^[W]{3}[0]+$/); // Pattern like WWW0000000

                        // Use existing eShipPlus status code mapping logic instead of filtering
                        const statusCode = update.statusCode || update.rawStatusCode || '';
                        const status = update.status || update.description || '';

                        // Define valid eShipPlus status codes (from existing getStatus.js logic)
                        const validStatusCodes = [
                            'AF', 'CP', 'X3', 'X8', 'BA', 'L1', 'AN', 'AM', 'P1', 'X6', 'X4', 'B6', 'C1', 'BC', 'CD',
                            'I1', 'K1', 'OA', 'R1', 'AR', 'RL', 'CL', 'AG', 'AH', 'AJ', 'AV', 'X1', 'X2', 'X5', 'S1',
                            'D1', 'J1', 'A3', 'A7', 'A9', 'AP', 'SD', 'CA', 'PR', 'AI', 'XB', 'OO', 'AA'
                        ];

                        // Check if we have a valid status code OR meaningful status description
                        const hasValidStatus = (statusCode && validStatusCodes.includes(statusCode)) ||
                            (status && status.length > 2 && status !== 'undefined' && status !== 'null');

                        // More lenient validation - only require valid status, be flexible with timestamps and tracking numbers
                        const isValid = hasValidTimestamp && hasValidStatus;

                        if (!isValid) {
                            console.log(`🚫 Filtering out invalid eShipPlus tracking update:`, {
                                timestamp: update.timestamp,
                                timestampValid: hasValidTimestamp,
                                trackingNumber: trackingNumber,
                                trackingNumberValid: hasValidTrackingNumber,
                                statusCode: statusCode,
                                status: status,
                                statusValid: hasValidStatus,
                                update: update
                            });
                        } else {
                            console.log(`✅ Accepting valid eShipPlus tracking update:`, {
                                timestamp: update.timestamp,
                                statusCode: statusCode,
                                status: status,
                                trackingNumber: trackingNumber
                            });
                        }

                        return isValid;
                    });

                    if (validTrackingUpdates.length > 0) {
                        // The smart status update system will handle deduplication
                        await recordTrackingUpdate(
                            shipment.id,
                            validTrackingUpdates,
                            'eShipPlus'
                        );
                        showSnackbar(`Fetched ${validTrackingUpdates.length} valid eShipPlus history events.`, 'success');

                        // Log filtered count if any were removed
                        const filteredCount = historyResult.data.trackingUpdates.length - validTrackingUpdates.length;
                        if (filteredCount > 0) {
                            console.log(`🧹 Filtered out ${filteredCount} invalid eShipPlus tracking updates`);
                        }
                    } else {
                        const totalCount = historyResult.data.trackingUpdates.length;
                        console.log(`🚫 All ${totalCount} eShipPlus tracking updates were invalid and filtered out`);
                        showSnackbar('eShipPlus history contained only invalid data - no updates recorded.', 'warning');
                    }
                } else if (historyResult.data.success) {
                    showSnackbar('No new history events found for eShipPlus shipment.', 'info');
                } else {
                    showSnackbar(historyResult.data.error || 'Failed to fetch eShipPlus history.', 'error');
                    console.error("Error fetching eShipPlus history:", historyResult.data.error);
                }
            }
        } catch (historyError) {
            console.error('Error calling getHistoryEShipPlus callable:', historyError);
            showSnackbar(`Error fetching eShipPlus history: ${historyError.message}`, 'error');
        } finally {
            setIsRefreshingHistory(false);
        }
    };

    // Cancel shipment handlers
    const handleCancelShipmentClick = () => {
        setCancelModalOpen(true);
    };

    const handleCancelModalClose = () => {
        setCancelModalOpen(false);
    };

    const handleCancelShipment = async () => {
        try {
            setCancelLoading(true);

            // Check if shipment can be cancelled based on status
            const currentStatus = shipment?.status?.toLowerCase();
            if (currentStatus === 'delivered' || currentStatus === 'in_transit' || currentStatus === 'in transit') {
                showSnackbar('Shipment cannot be cancelled after delivery or when in transit. Contact your Soluship rep.', 'error');
                setCancelModalOpen(false);
                return;
            }

            // Check carrier type for automatic cancellation
            const isEShipPlusShipment = getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' ||
                getBestRateInfo?.sourceCarrierName === 'eShipPlus' ||
                getBestRateInfo?.carrier?.toLowerCase().includes('eshipplus');

            const isCanparShipment = getBestRateInfo?.displayCarrierId === 'CANPAR' ||
                getBestRateInfo?.sourceCarrierName === 'Canpar' ||
                getBestRateInfo?.carrier?.toLowerCase().includes('canpar');

            if (isEShipPlusShipment || isCanparShipment) {
                // Handle automatic cancellation for supported carriers
                const bookingReferenceNumber = shipment?.carrierBookingConfirmation?.proNumber ||
                    shipment?.carrierBookingConfirmation?.confirmationNumber ||
                    shipment?.carrierBookingConfirmation?.bookingReferenceNumber ||
                    shipment?.carrierBookingConfirmation?.shipmentId ||
                    shipment?.bookingReferenceNumber;

                if (!bookingReferenceNumber) {
                    showSnackbar('No booking reference number found for cancellation. Contact your Soluship rep.', 'error');
                    setCancelModalOpen(false);
                    return;
                }

                // Determine which cancel function to call
                const cancelFunctionName = isEShipPlusShipment ? 'cancelShipmentEShipPlus' : 'cancelShipmentCanpar';
                const carrierName = isEShipPlusShipment ? 'eShipPlus' : 'CanPar';

                // Call the appropriate carrier cancel cloud function
                const cancelFunction = httpsCallable(functions, cancelFunctionName);
                const result = await cancelFunction({ bookingReferenceNumber });

                if (result.data.success && result.data.data.cancelled) {
                    // Successfully cancelled
                    showSnackbar(`Shipment successfully cancelled with ${carrierName}`, 'success');

                    // Update shipment status locally
                    setShipment(prev => ({
                        ...prev,
                        status: 'cancelled'
                    }));

                    // Record the cancellation event
                    try {
                        await recordStatusChange(
                            shipment.shipmentId || shipment.id,
                            shipment.status,
                            'cancelled',
                            null,
                            `Shipment cancelled by user via ${carrierName} API`
                        );
                    } catch (eventError) {
                        console.warn('Failed to record cancellation event:', eventError);
                    }

                } else if (result.data.success && !result.data.data.cancelled) {
                    // Cancellation request failed
                    showSnackbar(result.data.data.message || `Shipment cannot be cancelled with ${carrierName}. Contact your Soluship rep for assistance.`, 'error');
                } else {
                    // API call failed
                    showSnackbar(`Failed to cancel shipment with ${carrierName}. Please contact your Soluship rep for assistance.`, 'error');
                }
            } else {
                // For other carriers, direct to contact rep
                const carrierName = getBestRateInfo?.carrier || 'Unknown carrier';
                showSnackbar(`Cancellation for ${carrierName} shipments requires manual processing. Please contact your Soluship representative for assistance.`, 'info');

                // Still update status locally to cancelled for user feedback
                setShipment(prev => ({
                    ...prev,
                    status: 'cancelled'
                }));

                // Record the cancellation request event
                try {
                    await recordStatusChange(
                        shipment.shipmentId || shipment.id,
                        shipment.status,
                        'cancelled',
                        null,
                        `Cancellation requested by user for ${carrierName} shipment - requires manual processing`
                    );
                } catch (eventError) {
                    console.warn('Failed to record cancellation request event:', eventError);
                }
            }

        } catch (error) {
            console.error('Error cancelling shipment:', error);
            showSnackbar('Cannot cancel shipment. Please try again or contact your Soluship rep.', 'error');
        } finally {
            setCancelLoading(false);
            setCancelModalOpen(false);
        }
    };

    // Check if shipment can be cancelled
    const canCancelShipment = () => {
        const currentStatus = shipment?.status?.toLowerCase();
        const isEShipPlusShipment = getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' ||
            getBestRateInfo?.sourceCarrierName === 'eShipPlus' ||
            getBestRateInfo?.carrier?.toLowerCase().includes('eshipplus');

        const isCanparShipment = getBestRateInfo?.displayCarrierId === 'CANPAR' ||
            getBestRateInfo?.sourceCarrierName === 'Canpar' ||
            getBestRateInfo?.carrier?.toLowerCase().includes('canpar');

        // Debug information - expose to window for debugging
        if (typeof window !== 'undefined') {
            window.shipmentDebug = {
                shipment,
                getBestRateInfo,
                currentStatus,
                isEShipPlusShipment,
                isCanparShipment,
                canCancel: currentStatus !== 'delivered' &&
                    currentStatus !== 'in_transit' &&
                    currentStatus !== 'in transit' &&
                    currentStatus !== 'cancelled' &&
                    currentStatus !== 'void' &&
                    currentStatus !== 'draft'
            };
        }

        // Allow cancellation for all shipments that are not delivered, in transit, cancelled, void, or draft
        return currentStatus !== 'delivered' &&
            currentStatus !== 'in_transit' &&
            currentStatus !== 'in transit' &&
            currentStatus !== 'cancelled' &&
            currentStatus !== 'void' &&
            currentStatus !== 'draft';
    };

    // Enhanced function to fetch shipment documents
    const fetchShipmentDocuments = useCallback(async () => {
        if (!shipment?.id) {
            console.log('No shipment ID available for document fetch');
            return;
        }

        try {
            setDocumentsLoading(true);
            setDocumentsError(null);
            console.log('Fetching documents for shipment:', shipment.id);

            const getShipmentDocumentsFunction = httpsCallable(functions, 'getShipmentDocuments');
            const result = await getShipmentDocumentsFunction({
                shipmentId: shipment.id,
                organized: true // Request organized structure
            });

            if (result.data && result.data.success) {
                const documents = result.data.data;

                // Enhanced debugging for document categorization
                console.log('Raw documents fetched:', result.data.metadata?.documentDetails);
                console.log('Categorized documents:', {
                    labels: documents.labels?.length || 0,
                    bol: documents.bol?.length || 0,
                    other: documents.other?.length || 0,
                    allDocuments: Object.values(documents).flat().length
                });

                // Enhanced BOL debugging for eShipPlus shipments
                if (getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' ||
                    getBestRateInfo?.sourceCarrierName === 'eShipPlus' ||
                    carrierData?.name?.toLowerCase().includes('eshipplus')) {

                    console.log('🔍 eShipPlus Shipment - BOL Document Analysis:', {
                        totalBOLDocuments: documents.bol?.length || 0,
                        bolDocuments: documents.bol?.map(doc => ({
                            id: doc.id,
                            filename: doc.filename,
                            docType: doc.docType,
                            carrier: doc.carrier,
                            isGeneratedBOL: doc.isGeneratedBOL,
                            replacesApiBOL: doc.replacesApiBOL,
                            source: doc.source,
                            createdAt: doc.createdAt,
                            metadata: {
                                eshipplus: doc.metadata?.eshipplus,
                                documentType: doc.metadata?.documentType,
                                documentCategory: doc.metadata?.documentCategory
                            }
                        })) || []
                    });
                }

                // Fallback: If no labels detected but we have "other" documents that might be labels
                if (documents.labels?.length === 0 && documents.other?.length > 0) {
                    console.log('No labels detected, checking "other" documents for potential labels...');

                    // Check if any "other" documents might be labels based on filename or metadata
                    const potentialLabels = documents.other.filter(doc => {
                        const filename = (doc.filename || '').toLowerCase();
                        const documentType = (doc.documentType || '').toLowerCase();

                        return filename.includes('label') ||
                            filename.includes('shipping') ||
                            filename.includes('ship') ||
                            filename.includes('print') ||
                            // Specific eShipPlus ProLabel patterns
                            filename.includes('prolabel') ||
                            filename.includes('pro-label') ||
                            filename.includes('prolabel4x6') ||
                            filename.includes('prolabelavery') ||
                            filename.includes('4x6inch') ||
                            filename.includes('3x4inch') ||
                            documentType.includes('label') ||
                            documentType.includes('shipping');
                    });

                    if (potentialLabels.length > 0) {
                        console.log('Found potential labels in "other" category:', potentialLabels);
                        // Move potential labels to the labels array
                        documents.labels = [...(documents.labels || []), ...potentialLabels];
                        // Remove them from other
                        documents.other = documents.other.filter(doc =>
                            !potentialLabels.some(label => label.id === doc.id)
                        );
                        console.log('Moved potential labels to labels category. New counts:', {
                            labels: documents.labels.length,
                            other: documents.other.length
                        });
                    }
                }

                setShipmentDocuments(documents);

                console.log('Documents fetched successfully with fallback processing:', {
                    labels: documents.labels?.length || 0,
                    bol: documents.bol?.length || 0,
                    other: documents.other?.length || 0,
                    metadata: result.data.metadata
                });
            } else {
                throw new Error(result.data?.error || 'Failed to fetch documents');
            }

        } catch (error) {
            console.error('Error fetching shipment documents:', error);
            setDocumentsError(error.message);
            // Set empty structure on error
            setShipmentDocuments({
                labels: [],
                bol: [],
                other: []
            });
        } finally {
            setDocumentsLoading(false);
        }
    }, [shipment?.id]);

    const downloadDocument = async (documentId, filename) => {
        try {
            console.log('Downloading document:', documentId);

            const getDocumentDownloadUrlFunction = httpsCallable(functions, 'getDocumentDownloadUrl');
            const result = await getDocumentDownloadUrlFunction({
                documentId
            });

            if (result.data.success) {
                // Open the document in a new tab for printing
                const downloadUrl = result.data.downloadUrl;
                window.open(downloadUrl, '_blank');
            } else {
                throw new Error('Failed to get download URL');
            }
        } catch (error) {
            console.error('Error downloading document:', error);
            alert('Failed to download document: ' + error.message);
        }
    };

    const printDocument = async (documentId, filename) => {
        try {
            const getDocumentDownloadUrlFunction = httpsCallable(functions, 'getDocumentDownloadUrl');
            const result = await getDocumentDownloadUrlFunction({
                documentId
            });

            if (result.data.success) {
                // Create a hidden iframe for printing
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = result.data.downloadUrl;

                document.body.appendChild(iframe);

                iframe.onload = () => {
                    try {
                        iframe.contentWindow.print();
                        // Remove iframe after a delay
                        setTimeout(() => {
                            document.body.removeChild(iframe);
                        }, 1000);
                    } catch (error) {
                        console.error('Error printing document:', error);
                        // Fallback: open in new tab
                        window.open(result.data.downloadUrl, '_blank');
                        document.body.removeChild(iframe);
                    }
                };
            }
        } catch (error) {
            console.error('Error printing document:', error);
            alert('Failed to print document: ' + error.message);
        }
    };

    // Check if shipment is freight type
    const isFreightShipment = shipment?.shipmentInfo?.shipmentType?.toLowerCase() === 'freight';

    const mapStyles = [
        {
            "elementType": "geometry",
            "stylers": [{ "color": "#242f3e" }]
        },
        {
            "elementType": "labels.text.stroke",
            "stylers": [{ "color": "#242f3e" }]
        },
        {
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "administrative.locality",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "poi",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "poi.park",
            "elementType": "geometry",
            "stylers": [{ "color": "#263c3f" }]
        },
        {
            "featureType": "poi.park",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "road",
            "elementType": "geometry",
            "stylers": [{ "color": "#38414e" }]
        },
        {
            "featureType": "road",
            "elementType": "geometry.stroke",
            "stylers": [{ "color": "#212a37" }]
        },
        {
            "featureType": "road",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry",
            "stylers": [{ "color": "#746855" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry.stroke",
            "stylers": [{ "color": "#1f2835" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "transit",
            "elementType": "geometry",
            "stylers": [{ "color": "#2f3948" }]
        },
        {
            "featureType": "transit.station",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [{ "color": "#17263c" }]
        },
        {
            "featureType": "water",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "water",
            "elementType": "labels.text.stroke",
            "stylers": [{ "color": "#17263c" }]
        }
    ];

    // Memoize the map options to prevent unnecessary re-renders
    const mapOptions = React.useMemo(() => ({
        styles: mapStyles,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        maxZoom: 20,
        minZoom: 5,
        gestureHandling: 'greedy',
        preserveViewport: false
    }), []);

    const fromMarkerPosition = { lat: 43.6532, lng: -79.3832 };
    const toMarkerPosition = { lat: 49.2827, lng: -123.1207 };

    // Get the previous path from location state or default to dashboard
    const previousPath = location.state?.from || '/dashboard';

    useEffect(() => {
        const fetchShipment = async () => {
            try {
                setLoading(true);

                // Query by shipmentID instead of document ID
                console.log('ShipmentDetail: Fetching shipment by shipmentID:', id);

                const shipmentsRef = collection(db, 'shipments');
                const q = query(shipmentsRef, where('shipmentID', '==', id), limit(1));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const docSnap = querySnapshot.docs[0];
                    const shipmentData = { id: docSnap.id, ...docSnap.data() };

                    console.log('ShipmentDetail: Found shipment by shipmentID:', {
                        shipmentID: shipmentData.shipmentID,
                        firestoreDocId: docSnap.id
                    });

                    // Fetch tracking data only if shipmentId exists
                    if (shipmentData.shipmentId) {
                        try {
                            const trackingRef = collection(db, 'tracking');
                            const trackingQuery = query(trackingRef, where('shipmentId', '==', shipmentData.shipmentId));
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
                                }

                                // Update shipment data with tracking info
                                shipmentData.tracking = {
                                    carrier: trackingData.carrier,
                                    trackingNumber: trackingData.trackingNumber,
                                    estimatedDeliveryDate: trackingData.estimatedDeliveryDate?.toDate(),
                                    status: trackingData.status,
                                    lastUpdated: trackingData.lastUpdated?.toDate()
                                };
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

                    // Fetch rates using new data structure
                    console.log('Fetching rates with new structure for shipment:', docSnap.id);

                    // Check if we have selectedRateRef (new structure)
                    if (shipmentData.selectedRateRef?.rateDocumentId) {
                        console.log('Found selectedRateRef, fetching detailed rate info:', shipmentData.selectedRateRef);
                        try {
                            const detailedRate = await getRateDetailsByDocumentId(shipmentData.selectedRateRef.rateDocumentId);
                            if (detailedRate) {
                                // Merge the detailed rate info with the reference
                                shipmentData.selectedRate = {
                                    ...shipmentData.selectedRateRef,
                                    ...detailedRate
                                };
                                console.log('Successfully merged detailed rate info:', shipmentData.selectedRate);
                            } else {
                                console.warn('No detailed rate found, using reference only');
                                shipmentData.selectedRate = shipmentData.selectedRateRef;
                            }
                        } catch (error) {
                            console.error('Error fetching detailed rate info:', error);
                            // Fallback to using just the reference
                            shipmentData.selectedRate = shipmentData.selectedRateRef;
                        }
                    }

                    // Fetch all rates for this shipment (for potential future use)
                    try {
                        const allRates = await getRatesForShipment(docSnap.id);
                        shipmentData.allRates = allRates;
                        console.log(`Found ${allRates.length} total rates for shipment:`, allRates);

                        // If we don't have a selectedRate from selectedRateRef, try to find a booked/selected rate
                        if (!shipmentData.selectedRate && allRates.length > 0) {
                            console.log('No selectedRateRef found, looking for booked/selected rate in collection');
                            const bookedRate = allRates.find(rate => rate.status === 'booked') ||
                                allRates.find(rate => rate.status === 'selected') ||
                                allRates[0]; // Fallback to first rate
                            if (bookedRate) {
                                shipmentData.selectedRate = bookedRate;
                                console.log('Using rate from collection:', bookedRate);
                            }
                        }
                    } catch (ratesError) {
                        console.error('Error fetching rates from shipmentRates collection:', ratesError);
                        // Continue without rates data if fetch fails
                    }

                    // Legacy support: Also check for old subcollection structure
                    if (!shipmentData.selectedRate) {
                        try {
                            console.log('No rate found with new structure, checking legacy subcollection');
                            const ratesRef = collection(db, 'shipments', docSnap.id, 'rates');
                            const ratesSnapshot = await getDocs(ratesRef);

                            if (!ratesSnapshot.empty) {
                                const rates = ratesSnapshot.docs.map(doc => ({
                                    id: doc.id,
                                    ...doc.data()
                                }));
                                shipmentData.rates = rates;
                                shipmentData.selectedRate = rates[0];
                                console.log('Using legacy rate structure:', rates[0]);
                            }
                        } catch (legacyRatesError) {
                            console.error('Error fetching legacy rates:', legacyRatesError);
                        }
                    }

                    // Fetch packages from the subcollection
                    try {
                        const packagesRef = collection(db, 'shipments', docSnap.id, 'packages');
                        const packagesSnapshot = await getDocs(packagesRef);

                        if (!packagesSnapshot.empty) {
                            const packages = packagesSnapshot.docs.map(doc => ({
                                id: doc.id,
                                ...doc.data()
                            }));
                            shipmentData.packages = packages;
                        }
                    } catch (packagesError) {
                        console.error('Error fetching packages:', packagesError);
                        // Continue without packages data if fetch fails
                    }

                    console.log('Processed shipment data:', shipmentData);

                    // Log selectedRate data structure for debugging
                    if (shipmentData.selectedRate) {
                        console.log('Selected Rate charge breakdown:', {
                            carrier: shipmentData.selectedRate.carrier,
                            totalCharges: shipmentData.selectedRate.totalCharges,
                            freightCharge: shipmentData.selectedRate.freightCharge,
                            fuelCharge: shipmentData.selectedRate.fuelCharge,
                            serviceCharges: shipmentData.selectedRate.serviceCharges,
                            accessorialCharges: shipmentData.selectedRate.accessorialCharges,
                            guaranteeCharge: shipmentData.selectedRate.guaranteeCharge,
                            guaranteed: shipmentData.selectedRate.guaranteed,
                            // Also check legacy field names
                            legacyFreightCharges: shipmentData.selectedRate.freightCharges,
                            legacyFuelCharges: shipmentData.selectedRate.fuelCharges
                        });
                    }

                    // Set the tracking number based on carrier type
                    const isCanparShipment = shipmentData.selectedRate?.carrier?.toLowerCase().includes('canpar') ||
                        shipmentData.carrier?.toLowerCase().includes('canpar') ||
                        shipmentData.selectedRate?.CarrierName?.toLowerCase().includes('canpar');

                    if (isCanparShipment) {
                        // For Canpar, prioritize the trackingNumber from various sources
                        const canparTrackingNumber = shipmentData.selectedRate?.TrackingNumber ||
                            shipmentData.selectedRate?.Barcode ||
                            shipmentData.carrierBookingConfirmation?.trackingNumber ||
                            shipmentData.trackingNumber;

                        if (canparTrackingNumber && !shipmentData.trackingNumber) {
                            shipmentData.trackingNumber = canparTrackingNumber;
                            console.log('ShipmentDetail: Set Canpar trackingNumber:', shipmentData.trackingNumber);
                        }
                    } else if (shipmentData.carrierBookingConfirmation?.proNumber) {
                        // For eShipPlus and other carriers, keep existing logic
                        shipmentData.trackingNumber = shipmentData.carrierBookingConfirmation.proNumber;
                        console.log('ShipmentDetail: Set shipment.trackingNumber from carrierBookingConfirmation.proNumber:', shipmentData.trackingNumber);
                    }

                    setShipment(shipmentData);
                    console.log('ShipmentDetail: Final shipmentData object before setLoading(false):', JSON.parse(JSON.stringify(shipmentData))); // ADDED LOG

                } else {
                    console.error('ShipmentDetail: No shipment found with shipmentID:', id);
                    setError(`Shipment not found with ID: ${id}`);
                }
            } catch (err) {
                console.error('Error fetching shipment:', err);
                setError('Error loading shipment details');
                setTrackingRecords([]); // Ensure trackingRecords is initialized even on error
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchShipment();
        }
    }, [id]);

    useEffect(() => {
        const fetchMapsApiKey = async () => {
            try {
                setMapError(null);
                // Fetch API key from Firestore
                const keysRef = collection(db, 'keys');
                const keysSnapshot = await getDocs(keysRef);

                if (!keysSnapshot.empty) {
                    const firstDoc = keysSnapshot.docs[0];
                    const key = firstDoc.data().googleAPI;
                    if (!key) {
                        throw new Error('No API key found in Firestore');
                    }
                    setMapsApiKey(key);
                    setIsGoogleMapsLoaded(true);
                } else {
                    throw new Error('API key document not found in Firestore');
                }
            } catch (error) {
                console.error('Error fetching Maps API key:', error);
                setMapError('Failed to load Google Maps. Please try refreshing the page.');
                setIsGoogleMapsLoaded(false);
            }
        };

        fetchMapsApiKey();
    }, []);

    useEffect(() => {
        const calculateRoute = async () => {
            if (!shipment?.shipFrom || !shipment?.shipTo || !window.google || !window.google.maps || !isGoogleMapsLoaded) {
                console.log('Missing required data for route calculation:', {
                    hasShipFrom: !!shipment?.shipFrom,
                    hasShipTo: !!shipment?.shipTo,
                    hasGoogleMaps: !!window.google?.maps,
                    isGoogleMapsLoaded
                });
                return;
            }

            try {
                const formatAddress = (address) => {
                    if (!address) return '';

                    const components = [];

                    // Add company name if available
                    if (address.company) {
                        components.push(address.company);
                    }

                    // Add street address
                    if (address.street) {
                        components.push(address.street);
                    }

                    // Add street2 if available
                    if (address.street2) {
                        components.push(address.street2);
                    }

                    // Add city, state, and postal code
                    const cityStateZip = [];
                    if (address.city) cityStateZip.push(address.city);
                    if (address.state) cityStateZip.push(address.state);
                    if (address.postalCode) cityStateZip.push(address.postalCode);

                    if (cityStateZip.length > 0) {
                        components.push(cityStateZip.join(', '));
                    }

                    // Add country
                    if (address.country) {
                        components.push(address.country);
                    }

                    return components.join(', ');
                };

                const geocodeAddress = async (address, type) => {
                    return new Promise((resolve, reject) => {
                        const geocoder = new window.google.maps.Geocoder();
                        const formattedAddress = formatAddress(address);

                        console.log(`Attempting to geocode ${type} address:`, {
                            address: formattedAddress,
                            originalAddress: address
                        });

                        geocoder.geocode({
                            address: formattedAddress,
                            region: address.country?.toLowerCase() || 'us'
                        }, (results, status) => {
                            if (status === 'OK' && results && results.length > 0) {
                                console.log(`${type} geocoding successful:`, {
                                    address: results[0].formatted_address,
                                    location: results[0].geometry.location.toJSON(),
                                    placeId: results[0].place_id
                                });
                                resolve(results[0]);
                            } else {
                                console.error(`${type} geocoding failed:`, {
                                    status,
                                    address: formattedAddress,
                                    error: status === 'ZERO_RESULTS' ? 'No results found' : `Geocoding error: ${status}`
                                });
                                reject(new Error(`Geocoding failed for ${type}: ${status}`));
                            }
                        });
                    });
                };

                const geocodeWithRetry = async (address, type, maxRetries = 3) => {
                    for (let i = 0; i < maxRetries; i++) {
                        try {
                            return await geocodeAddress(address, type);
                        } catch (error) {
                            if (i === maxRetries - 1) throw error;
                            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
                        }
                    }
                };

                const [originResult, destinationResult] = await Promise.all([
                    geocodeWithRetry(shipment.shipFrom, 'origin'),
                    geocodeWithRetry(shipment.shipTo, 'destination')
                ]);

                // Validate geocoding results
                if (!originResult || !originResult.geometry || !originResult.geometry.location) {
                    throw new Error('Invalid origin location data');
                }

                if (!destinationResult || !destinationResult.geometry || !destinationResult.geometry.location) {
                    throw new Error('Invalid destination location data');
                }

                const bounds = new window.google.maps.LatLngBounds();
                bounds.extend(originResult.geometry.location);
                bounds.extend(destinationResult.geometry.location);
                setMapBounds(bounds);

                // Prepare the request body with place IDs if available
                const requestBody = {
                    origin: originResult.place_id ?
                        { placeId: originResult.place_id } :
                        {
                            location: {
                                latLng: {
                                    latitude: originResult.geometry.location.lat(),
                                    longitude: originResult.geometry.location.lng()
                                }
                            }
                        },
                    destination: destinationResult.place_id ?
                        { placeId: destinationResult.place_id } :
                        {
                            location: {
                                latLng: {
                                    latitude: destinationResult.geometry.location.lat(),
                                    longitude: destinationResult.geometry.location.lng()
                                }
                            }
                        },
                    travelMode: "DRIVE",
                    routingPreference: "TRAFFIC_UNAWARE",
                    computeAlternativeRoutes: false,
                    languageCode: "en-US",
                    units: useMetric ? "METRIC" : "IMPERIAL"
                };

                // Add region code if country is available
                if (shipment.shipFrom.country) {
                    const countryCode = shipment.shipFrom.country.toLowerCase();
                    if (countryCode.length === 2) {
                        requestBody.regionCode = countryCode;
                    }
                }

                const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': mapsApiKey,
                        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.legs.duration,routes.legs.distanceMeters,routes.legs.startLocation,routes.legs.endLocation'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Route calculation API error:', errorData);
                    throw new Error(`Route calculation failed: ${errorData.error?.message || response.statusText}`);
                }

                const routeData = await response.json();

                // Check if route data is valid
                if (!routeData.routes || routeData.routes.length === 0) {
                    throw new Error('No routes found in the response');
                }

                const route = routeData.routes[0];

                // Check if the route has the required polyline data
                if (!route.polyline || !route.polyline.encodedPolyline) {
                    throw new Error('Route polyline data is missing');
                }

                const decodedPath = window.google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);

                // Parse duration safely
                const durationInSeconds = parseInt(route.duration);
                const durationInMinutes = Math.round(durationInSeconds / 60);

                // Create a properly structured directions object that matches what DirectionsRenderer expects
                const directionsResult = {
                    routes: [{
                        legs: [{
                            start_location: originResult.geometry.location,
                            end_location: destinationResult.geometry.location,
                            distance: {
                                text: useMetric ? `${Math.round(route.distanceMeters / 1000)} km` : `${Math.round(route.distanceMeters / 1609.34)} mi`,
                                value: route.distanceMeters
                            },
                            duration: {
                                text: `${durationInMinutes} mins`,
                                value: durationInSeconds
                            },
                            steps: [{
                                distance: {
                                    text: useMetric ? `${Math.round(route.distanceMeters / 1000)} km` : `${Math.round(route.distanceMeters / 1609.34)} mi`,
                                    value: route.distanceMeters
                                },
                                duration: {
                                    text: `${durationInMinutes} mins`,
                                    value: durationInSeconds
                                },
                                start_location: originResult.geometry.location,
                                end_location: destinationResult.geometry.location,
                                instructions: "Follow the route",
                                path: decodedPath
                            }]
                        }],
                        overview_path: decodedPath,
                        bounds: new window.google.maps.LatLngBounds(originResult.geometry.location, destinationResult.geometry.location),
                        copyrights: "© Google Maps",
                        warnings: [],
                        waypoint_order: [],
                        overview_polyline: {
                            points: route.polyline.encodedPolyline
                        }
                    }],
                    request: {
                        origin: originResult.geometry.location,
                        destination: destinationResult.geometry.location,
                        travelMode: "DRIVING"
                    },
                    status: "OK",
                    geocoded_waypoints: [
                        { status: "OK", place_id: originResult.place_id },
                        { status: "OK", place_id: destinationResult.place_id }
                    ]
                };

                setDirections(directionsResult);
            } catch (error) {
                console.error('Error calculating route:', error);
                setMapError('Error calculating route');
            }
        };

        // Only calculate route when all required components are ready
        if (shipment && isGoogleMapsLoaded && mapsApiKey && isMapReady) {
            calculateRoute();
        }
    }, [shipment, isGoogleMapsLoaded, mapsApiKey, useMetric, isMapReady]);

    // Handle map load and bounds
    const handleMapLoad = React.useCallback((map) => {
        setMap(map);
        setIsMapLoaded(true);
        setIsMapReady(true); // Set map as ready when it's fully loaded

        if (directions?.request?.origin && directions?.request?.destination) {
            // Create bounds that include both markers
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend(directions.request.origin);
            bounds.extend(directions.request.destination);

            // Add padding to the bounds
            const padding = 15; // reduced from 25 to 15 pixels
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const latPadding = (ne.lat() - sw.lat()) * 0.02; // reduced from 0.05 to 0.02 (2% padding)
            const lngPadding = (ne.lng() - sw.lng()) * 0.02; // reduced from 0.05 to 0.02 (2% padding)
            bounds.extend(new window.google.maps.LatLng(ne.lat() + latPadding, ne.lng() + lngPadding));
            bounds.extend(new window.google.maps.LatLng(sw.lat() - latPadding, sw.lng() - lngPadding));

            // Fit the map to the bounds
            map.fitBounds(bounds, {
                padding: {
                    top: padding,
                    right: padding,
                    bottom: padding,
                    left: padding
                }
            });

            // Set a closer zoom level
            const currentZoom = map.getZoom();
            if (currentZoom) {
                map.setZoom(currentZoom + 2); // reduced from 5 to 2 for a more moderate zoom
            }
        }
    }, [directions]);

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const formatAddress = (address) => {
        if (!address) return 'N/A';
        return `${address.street}${address.street2 ? ', ' + address.street2 : ''}\n${address.city}, ${address.state} ${address.postalCode}\n${address.country}`;
    };

    const formatPhone = (phone) => {
        if (!phone) return 'N/A';
        return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    };

    // Combine packages from main record and subcollection (if both exist)
    const allPackages = useMemo(() => {
        let pkgs = [];
        if (Array.isArray(shipment?.packages)) pkgs = pkgs.concat(shipment.packages);
        // If subcollection packages are stored elsewhere, merge here as needed
        // (Assume shipment.packages already includes both if loaded)
        return pkgs;
    }, [shipment]);

    // Add conversion function for distance
    const convertDistance = (distanceInMeters) => {
        if (useMetric) {
            return `${Math.round(distanceInMeters / 1000)} km`;
        }
        return `${Math.round(distanceInMeters / 1609.34)} mi`;
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = async () => {
        const element = document.getElementById('shipment-detail-content');
        const opt = {
            margin: 1,
            filename: `shipment-${shipment.id}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false
            },
            jsPDF: {
                unit: 'in',
                format: 'a4',
                orientation: 'portrait'
            }
        };

        try {
            await html2pdf().set(opt).from(element).save();
        } catch (error) {
            console.error('Error generating PDF:', error);
            // You might want to show an error message to the user here
        }
    };

    // Add a function to handle rate selection
    const handleRateSelect = (rate) => {
        if (shipment) {
            setShipment({
                ...shipment,
                selectedRate: rate
            });
        }
    };

    // Add this helper function to safely get history
    const getShipmentHistory = (shipment) => {
        if (!shipment) return [];
        return shipment.history || [];
    };

    useEffect(() => {
        // Fetch customers for name lookup
        const fetchCustomers = async () => {
            try {
                const customersRef = collection(db, 'customers');
                const querySnapshot = await getDocs(customersRef);
                const customersMap = {};
                querySnapshot.forEach(doc => {
                    const customer = doc.data();
                    customersMap[customer.customerID] = customer.name;
                });
                setCustomers(customersMap);
            } catch (error) {
                console.error('Error fetching customers:', error);
            }
        };
        fetchCustomers();
    }, []);

    // Helper function to get the best available rate information
    const getBestRateInfo = useMemo(() => {
        // Priority order:
        // 1. detailedRateInfo (from shipmentRates collection via selectedRateRef)
        // 2. shipment.selectedRate (merged or legacy)
        // 3. selectedRateRef (basic reference)
        // 4. First booked/selected rate from allShipmentRates

        if (detailedRateInfo) {
            console.log('Using detailedRateInfo for rate display');
            // Check if it's in universal format and normalize for display
            if (detailedRateInfo.universalRateData) {
                const universal = detailedRateInfo.universalRateData;
                return {
                    // Universal format fields
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
                    // Keep original data for fallback
                    ...detailedRateInfo,
                    // Mark as universal for other components
                    _isUniversalFormat: true
                };
            }
            return detailedRateInfo;
        }

        if (shipment?.selectedRate) {
            console.log('Using shipment.selectedRate for rate display');
            // Check if it's in universal format
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

        if (shipment?.selectedRateRef) {
            console.log('Using shipment.selectedRateRef for rate display');
            return shipment.selectedRateRef;
        }

        // Fallback to allShipmentRates
        if (allShipmentRates.length > 0) {
            const bookedRate = allShipmentRates.find(rate => rate.status === 'booked') ||
                allShipmentRates.find(rate => rate.status === 'selected') ||
                allShipmentRates[0];
            console.log('Using rate from allShipmentRates for rate display:', bookedRate);

            // Check if it's in universal format
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

        console.log('No rate information available');
        return null;
    }, [detailedRateInfo, shipment?.selectedRate, shipment?.selectedRateRef, allShipmentRates]);

    // Check if carrier is eShipPlus to show label type options - ADDED HERE
    const isEShipPlusCarrier = useMemo(() => {
        return getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' ||
            getBestRateInfo?.sourceCarrierName === 'eShipPlus' ||
            carrierData?.name?.toLowerCase().includes('eshipplus');
    }, [getBestRateInfo, carrierData]);

    // Fetch carrier data for logo display
    useEffect(() => {
        const fetchCarrierData = async () => {
            if (!getBestRateInfo?.carrier) return;

            try {
                const carriersRef = collection(db, 'carriers');

                // For integration carriers like eShipPlus, use the integration carrier ID instead of sub-carrier name
                let carrierIdentifier = getBestRateInfo.carrier;

                // Check if this is an eShipPlus integration with a sub-carrier
                if (getBestRateInfo.displayCarrierId === 'ESHIPPLUS' ||
                    getBestRateInfo.sourceCarrierName === 'eShipPlus' ||
                    getBestRateInfo.displayCarrierId === 'eshipplus') {
                    carrierIdentifier = 'ESHIPPLUS';
                    console.log('Using ESHIPPLUS carrier for sub-carrier:', getBestRateInfo.carrier);
                }

                // Try carrierID lookup first
                const q = query(carriersRef, where('carrierID', '==', carrierIdentifier));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const carrierDoc = querySnapshot.docs[0];
                    const carrier = carrierDoc.data();
                    console.log('Fetched carrier data:', carrier);
                    setCarrierData(carrier);
                } else {
                    // Try to find by carrier name if carrierID lookup fails
                    const nameQuery = query(carriersRef, where('name', '==', carrierIdentifier));
                    const nameSnapshot = await getDocs(nameQuery);

                    if (!nameSnapshot.empty) {
                        const carrierDoc = nameSnapshot.docs[0];
                        const carrier = carrierDoc.data();
                        console.log('Fetched carrier data by name:', carrier);
                        setCarrierData(carrier);
                    } else {
                        console.warn('No carrier found for:', carrierIdentifier, '(original:', getBestRateInfo.carrier + ')');
                    }
                }
            } catch (error) {
                console.error('Error fetching carrier data:', error);
            }
        };

        fetchCarrierData();
    }, [getBestRateInfo?.carrier, getBestRateInfo?.displayCarrierId, getBestRateInfo?.sourceCarrierName]);

    // Robust address getter
    const getAddress = (shipment, type) => {
        return shipment?.[type] || shipment?.[type.toLowerCase()] || null;
    };

    // Separate effect to fetch detailed rate information when needed
    useEffect(() => {
        const fetchDetailedRateInfo = async () => {
            if (!shipment?.selectedRateRef?.rateDocumentId) {
                return;
            }

            // Check if we're already loading to prevent duplicate calls
            if (rateLoading) {
                return;
            }

            setRateLoading(true);
            try {
                console.log('Fetching detailed rate info for document ID:', shipment.selectedRateRef.rateDocumentId);
                const detailedRate = await getRateDetailsByDocumentId(shipment.selectedRateRef.rateDocumentId);

                if (detailedRate) {
                    setDetailedRateInfo(detailedRate);
                    console.log('Detailed rate info fetched successfully:', detailedRate);
                } else {
                    console.warn('No detailed rate information found');
                }
            } catch (error) {
                console.error('Error fetching detailed rate info in useEffect:', error);
            } finally {
                setRateLoading(false);
            }
        };

        fetchDetailedRateInfo();
    }, [shipment?.selectedRateRef?.rateDocumentId]); // Removed rateLoading dependency

    // Effect to fetch all shipment rates
    useEffect(() => {
        const fetchAllRates = async () => {
            if (!shipment?.id) return;

            try {
                const rates = await getRatesForShipment(shipment.id);
                setAllShipmentRates(rates);
                console.log(`Fetched ${rates.length} rates for shipment ${shipment.id}`);
            } catch (error) {
                console.error('Error fetching all shipment rates:', error);
            }
        };

        fetchAllRates();
    }, [shipment?.id]);

    // Effect to fetch shipment documents
    useEffect(() => {
        // Fetch documents for all shipments except draft status
        if (shipment?.id && shipment?.status !== 'draft') {
            fetchShipmentDocuments();
        }
    }, [shipment?.id, shipment?.status, fetchShipmentDocuments]);

    // On initial load, after shipment is loaded and set, check if status is 'pending' or 'booked' and if no event exists, log it:
    // useEffect(() => {
    //     if (shipment && shipment.status && (shipment.status === 'pending' || shipment.status === 'booked')) {
    //         // Check if a status_update event already exists marking the transition from 'created' to the current status.
    //         const hasCreationToCurrentStatusEvent = (shipmentEvents || []).some(event =>
    //             event.eventType === 'status_update' &&
    //             event.statusChange &&
    //             event.statusChange.from === 'created' &&
    //             event.statusChange.to === shipment.status
    //         );

    //         if (!hasCreationToCurrentStatusEvent) {
    //             recordStatusChange(
    //                 shipment.id || shipment.shipmentID,
    //                 'created', // fromStatus
    //                 shipment.status, // toStatus
    //                 null, // userData - consider adding user info if available
    //                 'Initial status set on shipment creation or booking' // reason
    //             );
    //         }
    //     }
    // }, [shipment, shipmentEvents]);

    // Add this after the other useEffect hooks
    useEffect(() => {
        if (shipment?.status) {
            // Force a re-render when status changes
            setShipment(prev => ({ ...prev }));
        }
    }, [shipment?.status]);

    // Helper function to generate Polaris Transportation BOL
    const generatePolarisTransportationBOLDocument = async () => {
        try {
            setActionLoading('generateBOL', true);
            showSnackbar('Generating professional BOL...', 'info');

            const generatePolarisTransportationBOLFunction = httpsCallable(functions, 'generatePolarisTransportationBOL');

            const confirmationNumber = shipment?.carrierBookingConfirmation?.confirmationNumber ||
                shipment?.carrierBookingConfirmation?.proNumber ||
                shipment?.shipmentID;

            const result = await generatePolarisTransportationBOLFunction({
                shipmentId: confirmationNumber,
                firebaseDocId: shipment?.id
            });

            if (result.data && result.data.success) {
                showSnackbar('Professional BOL generated successfully!', 'success');

                // Refresh documents to show the new BOL
                await fetchShipmentDocuments();

                // Auto-open the generated BOL
                const documentId = result.data.data.documentId;
                await viewPdfInModal(
                    documentId,
                    result.data.data.fileName,
                    `Generated BOL - ${shipment?.shipmentID}`,
                    'printBOL'
                );

            } else {
                throw new Error(result.data?.error || 'Failed to generate BOL');
            }

        } catch (error) {
            console.error('Error generating Polaris Transportation BOL:', error);
            showSnackbar('Failed to generate BOL: ' + error.message, 'error');
        } finally {
            setActionLoading('generateBOL', false);
        }
    };

    if (loading) {
        return <LoadingSkeleton />;
    }

    if (error) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <Typography color="error">{error}</Typography>
            </Box>
        );
    }

    if (!shipment) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <Typography>No shipment data available</Typography>
            </Box>
        );
    }

    return (
        <LoadScript
            googleMapsApiKey={mapsApiKey}
            libraries={GOOGLE_MAPS_LIBRARIES}
            onLoad={() => setIsGoogleMapsLoaded(true)}
            onError={(error) => {
                console.error('Google Maps loading error:', error);
                setMapError('Failed to load Google Maps');
            }}
        >
            <ErrorBoundary>
                <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
                    <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
                        <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, mb: 3 }}>
                            {/* Breadcrumb Navigation and Action Buttons */}
                            <Box sx={{ mb: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                        Shipment Detail
                                    </Typography>

                                    {/* Enhanced Action Buttons */}
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                        {/* Print Label Button - Only show when labels exist */}
                                        {!isFreightShipment && shipment?.status !== 'draft' && !documentsLoading && shipmentDocuments.labels?.length > 0 && (
                                            <Button
                                                onClick={handlePrintLabelClick}
                                                startIcon={actionStates.printLabel.loading ?
                                                    <CircularProgress size={16} /> : <PrintIcon />}
                                                disabled={actionStates.printLabel.loading}
                                                sx={{
                                                    textTransform: 'none',
                                                    fontWeight: 500,
                                                    px: 2,
                                                    minWidth: 140
                                                }}
                                                color="primary"
                                            >
                                                {actionStates.printLabel.loading ? 'Loading...' : 'Print Labels'}
                                            </Button>
                                        )}

                                        {/* BOL Button - For Freight shipments */}
                                        {isFreightShipment && shipment?.status !== 'draft' && !documentsLoading && (
                                            <Button
                                                onClick={handlePrintBOL}
                                                startIcon={actionStates.printBOL.loading ?
                                                    <CircularProgress size={16} /> : <DescriptionIcon />}
                                                disabled={actionStates.printBOL.loading}
                                                sx={{
                                                    textTransform: 'none',
                                                    fontWeight: 500,
                                                    px: 2
                                                }}
                                            >
                                                {actionStates.printBOL.loading ? 'Loading...' : 'Print BOL'}
                                            </Button>
                                        )}

                                        {/* Print Shipment - Always available */}
                                        <Button
                                            onClick={handlePrintShipment}
                                            startIcon={actionStates.printShipment.loading ?
                                                <CircularProgress size={16} /> : <LocalShippingIcon />}
                                            disabled={actionStates.printShipment.loading}
                                            sx={{
                                                textTransform: 'none',
                                                fontWeight: 500,
                                                px: 2
                                            }}
                                        >
                                            {actionStates.printShipment.loading ? 'Generating...' : 'Print Shipment'}
                                        </Button>

                                        {/* Document Status Indicator */}
                                        {(documentsLoading || actionStates.generateBOL.loading) && (
                                            <Chip
                                                size="small"
                                                label={actionStates.generateBOL.loading ? "Generating BOL..." : "Loading documents..."}
                                                icon={<CircularProgress size={16} />}
                                                variant="outlined"
                                                sx={{ ml: 1 }}
                                            />
                                        )}

                                        {documentsError && (
                                            <Chip
                                                size="small"
                                                label="Document error"
                                                color="error"
                                                variant="outlined"
                                                sx={{ ml: 1 }}
                                                onClick={() => fetchShipmentDocuments()}
                                                clickable
                                            />
                                        )}

                                        {!documentsLoading && !documentsError && !actionStates.generateBOL.loading && shipment?.status !== 'draft' && (
                                            <Chip
                                                size="small"
                                                label={`${(shipmentDocuments.labels?.length || 0) + (shipmentDocuments.bol?.length || 0) + (shipmentDocuments.other?.length || 0)} docs`}
                                                color={(shipmentDocuments.labels?.length || 0) + (shipmentDocuments.bol?.length || 0) + (shipmentDocuments.other?.length || 0) > 0 ? "success" : "default"}
                                                variant="outlined"
                                                sx={{ ml: 1 }}
                                            />
                                        )}
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <HomeIcon sx={{ color: 'primary.main', fontSize: 22 }} />
                                    <Typography
                                        component={Link}
                                        to="/dashboard"
                                        sx={{ textDecoration: 'none', color: 'inherit', fontWeight: 500, mr: 1 }}
                                    >
                                        Dashboard
                                    </Typography>
                                    <NavigateNextIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                                    <Typography
                                        component={Link}
                                        to="/shipments"
                                        sx={{ textDecoration: 'none', color: 'inherit', fontWeight: 500, mr: 1 }}
                                    >
                                        Shipments
                                    </Typography>
                                    <NavigateNextIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                                    <Typography color="text.primary" sx={{ fontWeight: 600 }}>
                                        {shipment?.shipmentID || 'Shipment'}
                                    </Typography>
                                </Box>
                            </Box>
                            {/* Add id to the main content container */}
                            <Box id="shipment-detail-content">
                                {/* Customer and Shipment Summary Section */}
                                <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <BusinessIcon sx={{ mr: 1, color: 'primary.main' }} />
                                            <Typography variant="h6">Shipment Summary</Typography>
                                        </Box>
                                        {/* Cancel Button */}
                                        {canCancelShipment() && (
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={handleCancelShipmentClick}
                                                sx={{
                                                    borderColor: 'text.secondary',
                                                    color: 'text.secondary',
                                                    textTransform: 'none',
                                                    fontSize: '0.875rem',
                                                    minWidth: 'auto',
                                                    px: 2,
                                                    '&:hover': {
                                                        borderColor: 'error.main',
                                                        color: 'error.main',
                                                        bgcolor: 'transparent'
                                                    }
                                                }}
                                            >
                                                Cancel Shipment
                                            </Button>
                                        )}
                                    </Box>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Shipment ID</Typography>
                                            <Link
                                                to={`/tracking/${encodeURIComponent(shipment?.shipmentID || 'N/A')}`}
                                                style={{ textDecoration: 'none' }}
                                            >
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontWeight: 600,
                                                        color: 'primary.main',
                                                        cursor: 'pointer',
                                                        '&:hover': {
                                                            textDecoration: 'underline',
                                                            color: 'primary.dark'
                                                        }
                                                    }}
                                                >
                                                    {shipment?.shipmentID || 'N/A'}
                                                </Typography>
                                            </Link>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Company ID</Typography>
                                            <Typography variant="body2">{shipment?.companyID || 'N/A'}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Customer ID</Typography>
                                            <Typography variant="body2">{shipment?.shipTo?.customerID || 'N/A'}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Created At</Typography>
                                            <Typography variant="body2">{shipment?.createdAt?.toDate ? shipment.createdAt.toDate().toLocaleString() : (shipment?.createdAt ? new Date(shipment.createdAt).toLocaleString() : 'N/A')}</Typography>
                                        </Grid>
                                    </Grid>
                                </Paper>

                                {/* Shipment Information Section */}
                                <Grid item xs={12}>
                                    <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                            <LocalShippingIcon sx={{ mr: 1, color: 'primary.main' }} />
                                            <Typography variant="h6">Shipment Information</Typography>
                                        </Box>

                                        <Grid container spacing={3}>
                                            {/* Basic Information */}
                                            <Grid item xs={12} md={3}>
                                                <Box sx={{
                                                    p: 2,
                                                    bgcolor: 'background.default',
                                                    borderRadius: 1,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    height: '100%'
                                                }}>
                                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                        Basic Information
                                                    </Typography>
                                                    <Stack spacing={2}>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary">Shipment Type</Typography>
                                                            <Typography variant="body2">{capitalizeShipmentType(shipment?.shipmentInfo?.shipmentType || 'N/A')}</Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary">Reference Number</Typography>
                                                            <Typography variant="body2">{shipment?.shipmentInfo?.shipperReferenceNumber || shipment?.shipmentID || 'N/A'}</Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary">Bill Type</Typography>
                                                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                                                {shipment?.shipmentInfo?.shipmentBillType?.toLowerCase() || 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                </Box>
                                            </Grid>

                                            {/* Timing Information */}
                                            <Grid item xs={12} md={3}>
                                                <Box sx={{
                                                    p: 2,
                                                    bgcolor: 'background.default',
                                                    borderRadius: 1,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    height: '100%'
                                                }}>
                                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                        Timing Information
                                                    </Typography>
                                                    <Stack spacing={2}>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary">Shipment Date</Typography>
                                                            <Typography variant="body2">
                                                                {shipment?.shipmentInfo?.shipmentDate ? new Date(shipment.shipmentInfo.shipmentDate).toLocaleDateString() : 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary">Estimated Delivery</Typography>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                <AccessTimeIcon sx={{ color: 'text.secondary', fontSize: '0.9rem' }} />
                                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                    {(() => {
                                                                        const deliveryDate =
                                                                            shipment?.carrierBookingConfirmation?.estimatedDeliveryDate ||
                                                                            getBestRateInfo?.transit?.estimatedDelivery ||
                                                                            getBestRateInfo?.estimatedDeliveryDate;

                                                                        if (deliveryDate) {
                                                                            try {
                                                                                const date = deliveryDate.toDate ? deliveryDate.toDate() : new Date(deliveryDate);
                                                                                return date.toLocaleDateString('en-US', {
                                                                                    weekday: 'short',
                                                                                    month: 'short',
                                                                                    day: 'numeric',
                                                                                    year: 'numeric'
                                                                                });
                                                                            } catch (error) {
                                                                                return 'Invalid Date';
                                                                            }
                                                                        }
                                                                        return 'N/A';
                                                                    })()}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary">Pickup Window</Typography>
                                                            <Typography variant="body2">
                                                                {shipment?.shipmentInfo?.earliestPickupTime && shipment?.shipmentInfo?.latestPickupTime
                                                                    ? `${shipment.shipmentInfo.earliestPickupTime} - ${shipment.shipmentInfo.latestPickupTime}`
                                                                    : '09:00 - 17:00'}
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                </Box>
                                            </Grid>

                                            {/* Tracking Information */}
                                            <Grid item xs={12} md={3}>
                                                <Box sx={{
                                                    p: 2,
                                                    bgcolor: 'background.default',
                                                    borderRadius: 1,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    height: '100%'
                                                }}>
                                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                        Tracking & Status
                                                    </Typography>
                                                    <Stack spacing={2}>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary">Current Status</Typography>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                                                <StatusChip status={shipment?.status} />
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={handleRefreshStatus}
                                                                    disabled={smartUpdateLoading || actionStates.refreshStatus.loading || shipment?.status === 'draft'}
                                                                    sx={{
                                                                        padding: '4px',
                                                                        '&:hover': { bgcolor: 'action.hover' }
                                                                    }}
                                                                    title="Refresh status"
                                                                >
                                                                    {smartUpdateLoading || actionStates.refreshStatus.loading ?
                                                                        <CircularProgress size={14} /> :
                                                                        <RefreshIcon sx={{ fontSize: 16 }} />
                                                                    }
                                                                </IconButton>
                                                            </Box>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary">Carrier</Typography>
                                                            <CarrierDisplay
                                                                carrierName={getBestRateInfo?.carrier}
                                                                carrierData={carrierData}
                                                                size="small"
                                                                isIntegrationCarrier={getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' || getBestRateInfo?.sourceCarrierName === 'eShipPlus'}
                                                            />
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary">Tracking Number</Typography>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                <Link
                                                                    to={`/tracking/${(() => {
                                                                        const isCanparShipment = getBestRateInfo?.carrier?.toLowerCase().includes('canpar') ||
                                                                            carrierData?.name?.toLowerCase().includes('canpar') ||
                                                                            carrierData?.carrierID === 'CANPAR';

                                                                        if (isCanparShipment) {
                                                                            return shipment?.trackingNumber ||
                                                                                shipment?.carrierBookingConfirmation?.trackingNumber ||
                                                                                shipment?.selectedRate?.TrackingNumber ||
                                                                                shipment?.selectedRate?.Barcode ||
                                                                                shipment?.id;
                                                                        } else {
                                                                            return shipment?.carrierBookingConfirmation?.proNumber ||
                                                                                shipment?.carrierBookingConfirmation?.confirmationNumber ||
                                                                                shipment?.trackingNumber ||
                                                                                shipment?.id;
                                                                        }
                                                                    })()}`}
                                                                    style={{ textDecoration: 'none' }}
                                                                >
                                                                    <Box sx={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 0.5,
                                                                        '&:hover': { color: 'primary.dark' }
                                                                    }}>
                                                                        <AssignmentIcon sx={{ color: 'primary.main', fontSize: '0.9rem' }} />
                                                                        <Typography
                                                                            variant="body2"
                                                                            sx={{
                                                                                fontWeight: 500,
                                                                                color: 'primary.main',
                                                                                '&:hover': { textDecoration: 'underline' }
                                                                            }}
                                                                        >
                                                                            {(() => {
                                                                                const isCanparShipment = getBestRateInfo?.carrier?.toLowerCase().includes('canpar') ||
                                                                                    carrierData?.name?.toLowerCase().includes('canpar') ||
                                                                                    carrierData?.carrierID === 'CANPAR';

                                                                                if (isCanparShipment) {
                                                                                    return shipment?.trackingNumber ||
                                                                                        shipment?.carrierBookingConfirmation?.trackingNumber ||
                                                                                        shipment?.selectedRate?.TrackingNumber ||
                                                                                        shipment?.selectedRate?.Barcode ||
                                                                                        shipment?.id ||
                                                                                        'N/A';
                                                                                } else {
                                                                                    return shipment?.carrierBookingConfirmation?.proNumber ||
                                                                                        shipment?.carrierBookingConfirmation?.confirmationNumber ||
                                                                                        shipment?.trackingNumber ||
                                                                                        shipment?.id ||
                                                                                        'N/A';
                                                                                }
                                                                            })()}
                                                                        </Typography>
                                                                    </Box>
                                                                </Link>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => {
                                                                        const trackingNum = (() => {
                                                                            const isCanparShipment = getBestRateInfo?.carrier?.toLowerCase().includes('canpar') ||
                                                                                carrierData?.name?.toLowerCase().includes('canpar') ||
                                                                                carrierData?.carrierID === 'CANPAR';
                                                                            if (isCanparShipment) {
                                                                                return shipment?.trackingNumber ||
                                                                                    shipment?.carrierBookingConfirmation?.trackingNumber ||
                                                                                    shipment?.selectedRate?.TrackingNumber ||
                                                                                    shipment?.selectedRate?.Barcode ||
                                                                                    shipment?.id;
                                                                            } else {
                                                                                return shipment?.carrierBookingConfirmation?.proNumber ||
                                                                                    shipment?.carrierBookingConfirmation?.confirmationNumber ||
                                                                                    shipment?.trackingNumber ||
                                                                                    shipment?.id;
                                                                            }
                                                                        })();
                                                                        if (trackingNum && trackingNum !== 'N/A') {
                                                                            navigator.clipboard.writeText(trackingNum);
                                                                            showSnackbar('Tracking number copied!', 'success');
                                                                        } else {
                                                                            showSnackbar('No tracking number to copy.', 'warning');
                                                                        }
                                                                    }}
                                                                    sx={{ padding: '2px' }}
                                                                    title="Copy tracking number"
                                                                >
                                                                    <ContentCopyIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                                                </IconButton>
                                                            </Box>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary">Last Updated</Typography>
                                                            <Typography variant="body2">
                                                                {(() => {
                                                                    const lastUpdated = getLastUpdatedTimestamp(shipment, mergedEvents);
                                                                    return lastUpdated ? formatTimestamp(lastUpdated) : 'N/A';
                                                                })()}
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                </Box>
                                            </Grid>

                                            {/* Service Options */}
                                            <Grid item xs={12} md={3}>
                                                {console.log("ShipmentDetail Service Options - shipment.shipmentInfo:", shipment?.shipmentInfo)}
                                                <Box sx={{
                                                    p: 2,
                                                    bgcolor: 'background.default',
                                                    borderRadius: 1,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    height: '100%'
                                                }}>
                                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                        Service Options
                                                    </Typography>
                                                    <Stack spacing={2}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="caption" color="text.secondary">Hold for Pickup</Typography>
                                                            <Chip
                                                                size="small"
                                                                label={(shipment?.shipmentInfo?.holdForPickup === true || String(shipment?.shipmentInfo?.holdForPickup).toLowerCase() === "true") ? "Yes" : "No"}
                                                                color={(shipment?.shipmentInfo?.holdForPickup === true || String(shipment?.shipmentInfo?.holdForPickup).toLowerCase() === "true") ? "primary" : "default"}
                                                                variant="outlined"
                                                            />
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="caption" color="text.secondary">International</Typography>
                                                            <Chip
                                                                size="small"
                                                                label={shipment?.shipFrom?.country && shipment?.shipTo?.country && shipment.shipFrom.country !== shipment.shipTo.country ? "Yes" : "No"}
                                                                color={shipment?.shipFrom?.country && shipment?.shipTo?.country && shipment.shipFrom.country !== shipment.shipTo.country ? "primary" : "default"}
                                                                variant="outlined"
                                                            />
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="caption" color="text.secondary">Saturday Delivery</Typography>
                                                            <Chip
                                                                size="small"
                                                                label={(shipment?.shipmentInfo?.saturdayDelivery === true || String(shipment?.shipmentInfo?.saturdayDelivery).toLowerCase() === "true") ? "Yes" : "No"}
                                                                color={(shipment?.shipmentInfo?.saturdayDelivery === true || String(shipment?.shipmentInfo?.saturdayDelivery).toLowerCase() === "true") ? "primary" : "default"}
                                                                variant="outlined"
                                                            />
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="caption" color="text.secondary">Signature Required</Typography>
                                                            <Chip
                                                                size="small"
                                                                label={(shipment?.shipmentInfo?.signatureRequired === true || String(shipment?.shipmentInfo?.signatureRequired).toLowerCase() === "true") ? "Yes" : "No"}
                                                                color={(shipment?.shipmentInfo?.signatureRequired === true || String(shipment?.shipmentInfo?.signatureRequired).toLowerCase() === "true") ? "primary" : "default"}
                                                                variant="outlined"
                                                            />
                                                        </Box>
                                                    </Stack>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                </Grid>                                {/* Documents Section - Only show for non-draft shipments */}
                                {shipment?.status !== 'draft' && (
                                    <Grid item xs={12}>
                                        <Paper sx={{ mt: 3 }}>
                                            <Box
                                                sx={{
                                                    p: 2,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    borderBottom: '1px solid #e0e0e0'
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <DescriptionIcon sx={{ color: '#000' }} />
                                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                                        Documents
                                                    </Typography>
                                                </Box>
                                                <IconButton onClick={() => toggleSection('documents')}>
                                                    <ExpandMoreIcon
                                                        sx={{
                                                            transform: expandedSections.documents ? 'rotate(180deg)' : 'none',
                                                            transition: 'transform 0.3s',
                                                            color: '#666'
                                                        }}
                                                    />
                                                </IconButton>
                                            </Box>
                                            <Collapse in={expandedSections.documents}>
                                                <Box sx={{ p: 3 }}>
                                                    {documentsLoading ? (
                                                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                                            <CircularProgress />
                                                        </Box>
                                                    ) : documentsError ? (
                                                        <Alert
                                                            severity="error"
                                                            action={
                                                                <Button
                                                                    color="inherit"
                                                                    size="small"
                                                                    onClick={() => fetchShipmentDocuments()}
                                                                >
                                                                    Retry
                                                                </Button>
                                                            }
                                                        >
                                                            Failed to load documents: {documentsError}
                                                        </Alert>
                                                    ) : Object.values(shipmentDocuments).flat().length === 0 ? (
                                                        <Alert severity="info">
                                                            No documents available yet. Documents will be available after the shipment is booked.
                                                        </Alert>
                                                    ) : (
                                                        <Grid container spacing={2}>
                                                            {/* Labels */}
                                                            {shipmentDocuments.labels?.length > 0 && (
                                                                <Grid item xs={12}>
                                                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                                                        Shipping Labels
                                                                    </Typography>
                                                                    <Grid container spacing={1}>
                                                                        {shipmentDocuments.labels
                                                                            .filter(label => {
                                                                                const filename = (label.filename || '').toLowerCase();
                                                                                const docType = (label.documentType || '').toLowerCase();
                                                                                const isBOL = label.isGeneratedBOL === true ||
                                                                                    label.metadata?.generated === true ||
                                                                                    label.metadata?.eshipplus?.generated === true ||
                                                                                    label.metadata?.polaris?.generated === true ||
                                                                                    label.metadata?.canpar?.generated === true ||
                                                                                    filename.includes('bol') ||
                                                                                    filename.includes('bill-of-lading') ||
                                                                                    filename.includes('bill_of_lading') ||
                                                                                    filename.includes('billoflading') ||
                                                                                    docType.includes('bol') ||
                                                                                    docType.includes('bill of lading');
                                                                                return !isBOL;
                                                                            })
                                                                            .map((label) => (
                                                                                <Grid item key={label.id}>
                                                                                    <Chip
                                                                                        icon={<PictureAsPdfIcon />}
                                                                                        label={label.filename || 'Label'}
                                                                                        onClick={() => viewPdfInModal(label.id, label.filename, 'Shipping Label')}
                                                                                        clickable
                                                                                        color="primary"
                                                                                        variant="outlined"
                                                                                    />
                                                                                </Grid>
                                                                            ))}
                                                                    </Grid>
                                                                </Grid>
                                                            )}

                                                            {/* BOL */}
                                                            <Grid item xs={12}>
                                                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                                                    Bill of Lading
                                                                </Typography>
                                                                <Grid container spacing={1}>
                                                                    {shipmentDocuments.bol
                                                                        .filter(bol => {
                                                                            const filename = (bol.filename || '').toUpperCase();
                                                                            return filename.startsWith('SOLUSHIP-') && filename.endsWith('-BOL.PDF');
                                                                        })
                                                                        .map((bol) => (
                                                                            <Grid item key={bol.id}>
                                                                                <Chip
                                                                                    icon={<DescriptionIcon />}
                                                                                    label={bol.filename || 'BOL'}
                                                                                    onClick={() => viewPdfInModal(bol.id, bol.filename, 'Bill of Lading')}
                                                                                    clickable
                                                                                    color="secondary"
                                                                                    variant="outlined"
                                                                                />
                                                                            </Grid>
                                                                        ))}
                                                                </Grid>
                                                            </Grid>

                                                            {/* Other Documents */}
                                                            {shipmentDocuments.other?.length > 0 && (
                                                                <Grid item xs={12}>
                                                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                                                        Other Documents
                                                                    </Typography>
                                                                    <Grid container spacing={1}>
                                                                        {shipmentDocuments.other.map((doc) => (
                                                                            <Grid item key={doc.id}>
                                                                                <Chip
                                                                                    icon={<DescriptionIcon />}
                                                                                    label={doc.filename || 'Document'}
                                                                                    onClick={() => viewPdfInModal(doc.id, doc.filename, 'Document')}
                                                                                    clickable
                                                                                    variant="outlined"
                                                                                />
                                                                            </Grid>
                                                                        ))}
                                                                    </Grid>
                                                                </Grid>
                                                            )}
                                                        </Grid>
                                                    )}
                                                </Box>
                                            </Collapse>
                                        </Paper>
                                    </Grid>
                                )}


                                {/* Main Content Grid - Two Columns */}
                                <Grid container spacing={3} sx={{ mt: 2 }}>
                                    {/* Maps Row */}
                                    <Grid item xs={12} sx={{ mb: 3 }}>
                                        <Grid container spacing={3}>
                                            {/* Ship From Map */}
                                            <Grid item xs={12} md={6}>
                                                <Paper>
                                                    <Box
                                                        sx={{
                                                            p: 2,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            borderBottom: '1px solid #e0e0e0'
                                                        }}
                                                    >
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <LocationOnIcon sx={{ color: '#000' }} />
                                                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                                                Ship From Location
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                    <Box sx={{ p: 2 }}>
                                                        <Typography variant="body1" sx={{ mb: 1 }}>
                                                            {getAddress(shipment, 'shipFrom')?.company || 'N/A'}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', mb: 2 }}>
                                                            {formatAddress(getAddress(shipment, 'shipFrom'))}
                                                        </Typography>
                                                        {isGoogleMapsLoaded && getAddress(shipment, 'shipFrom') && (
                                                            <SimpleMap
                                                                address={getAddress(shipment, 'shipFrom')}
                                                                title="Ship From Location"
                                                            />
                                                        )}
                                                    </Box>
                                                </Paper>
                                            </Grid>

                                            {/* Ship To Map */}
                                            <Grid item xs={12} md={6}>
                                                <Paper>
                                                    <Box
                                                        sx={{
                                                            p: 2,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            borderBottom: '1px solid #e0e0e0'
                                                        }}
                                                    >
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <LocationOnIcon sx={{ color: '#000' }} />
                                                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                                                Ship To Location
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                    <Box sx={{ p: 2 }}>
                                                        <Typography variant="body1" sx={{ mb: 1 }}>
                                                            {getAddress(shipment, 'shipTo')?.company || 'N/A'}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', mb: 2 }}>
                                                            {formatAddress(getAddress(shipment, 'shipTo'))}
                                                        </Typography>
                                                        {isGoogleMapsLoaded && getAddress(shipment, 'shipTo') && (
                                                            <SimpleMap
                                                                address={getAddress(shipment, 'shipTo')}
                                                                title="Ship To Location"
                                                            />
                                                        )}
                                                    </Box>
                                                </Paper>
                                            </Grid>
                                        </Grid>
                                    </Grid>

                                    {/* Rates Row */}
                                    <Grid item xs={12} sx={{ mb: 3 }}>
                                        <Paper>
                                            <Box
                                                sx={{
                                                    p: 2,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    borderBottom: '1px solid #e0e0e0'
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <MoneyIcon sx={{ color: '#000' }} />
                                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                                        Rate Details
                                                    </Typography>
                                                </Box>
                                                <IconButton onClick={() => toggleSection('rate')}>
                                                    <ExpandMoreIcon
                                                        sx={{
                                                            transform: expandedSections.rate ? 'rotate(180deg)' : 'none',
                                                            transition: 'transform 0.3s',
                                                            color: '#666'
                                                        }}
                                                    />
                                                </IconButton>
                                            </Box>
                                            <Collapse in={expandedSections.rate}>
                                                <Box sx={{ p: 3 }}>
                                                    {console.log('ShipmentDetail Rate Details bestRateInfo:', JSON.stringify(getBestRateInfo))}
                                                    <Grid container spacing={3}>
                                                        {/* Left Column - Service Details */}
                                                        <Grid item xs={12} md={4}>
                                                            <Box sx={{ display: 'grid', gap: 2 }}>
                                                                <Box>
                                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                        Carrier & Service
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                                                        <CarrierDisplay
                                                                            carrierName={getBestRateInfo?.carrier}
                                                                            carrierData={carrierData}
                                                                            size="small"
                                                                            isIntegrationCarrier={getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' || getBestRateInfo?.sourceCarrierName === 'eShipPlus'}
                                                                        />
                                                                        {getBestRateInfo?.service && (
                                                                            <>
                                                                                <Typography variant="body2" color="text.secondary">-</Typography>
                                                                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                                                    {getBestRateInfo.service}
                                                                                </Typography>
                                                                            </>
                                                                        )}
                                                                    </Box>
                                                                </Box>
                                                                <Box>
                                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                        Transit Time
                                                                    </Typography>
                                                                    <Typography variant="body1">
                                                                        {getBestRateInfo?.transitDays || 0} {getBestRateInfo?.transitDays === 1 ? 'day' : 'days'}
                                                                    </Typography>
                                                                </Box>
                                                                <Box>
                                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                        Delivery Date
                                                                    </Typography>
                                                                    <Typography variant="body1">
                                                                        {(() => {
                                                                            const deliveryDate =
                                                                                shipment?.carrierBookingConfirmation?.estimatedDeliveryDate ||
                                                                                getBestRateInfo?.transit?.estimatedDelivery ||
                                                                                getBestRateInfo?.estimatedDeliveryDate;

                                                                            if (deliveryDate) {
                                                                                try {
                                                                                    const date = deliveryDate.toDate ? deliveryDate.toDate() : new Date(deliveryDate);
                                                                                    return date.toLocaleDateString('en-US', {
                                                                                        weekday: 'short',
                                                                                        year: 'numeric',
                                                                                        month: 'short',
                                                                                        day: 'numeric'
                                                                                    });
                                                                                } catch (error) {
                                                                                    console.error('Error formatting delivery date:', error);
                                                                                    return 'Invalid Date';
                                                                                }
                                                                            }
                                                                            return 'N/A';
                                                                        })()}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        </Grid>

                                                        {/* Middle Column - Charges */}
                                                        <Grid item xs={12} md={4}>
                                                            {(() => {
                                                                const safeNumber = (value) => {
                                                                    const num = parseFloat(value);
                                                                    return isNaN(num) ? 0 : num;
                                                                };

                                                                if (getBestRateInfo?.billingDetails && Array.isArray(getBestRateInfo.billingDetails) && getBestRateInfo.billingDetails.length > 0) {
                                                                    const validDetails = getBestRateInfo.billingDetails.filter(detail =>
                                                                        detail &&
                                                                        detail.name &&
                                                                        (detail.amount !== undefined && detail.amount !== null)
                                                                    );

                                                                    if (validDetails.length > 0) {
                                                                        return (
                                                                            <Box sx={{ display: 'grid', gap: 2 }}>
                                                                                {validDetails.map((detail, index) => (
                                                                                    <Box key={index}>
                                                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                                            {detail.name}
                                                                                        </Typography>
                                                                                        <Typography variant="body1">
                                                                                            ${safeNumber(detail.amount).toFixed(2)}
                                                                                        </Typography>
                                                                                    </Box>
                                                                                ))}
                                                                            </Box>
                                                                        );
                                                                    }
                                                                }

                                                                const breakdownItems = [];
                                                                const freight = safeNumber(getBestRateInfo?.pricing?.freight || getBestRateInfo?.freightCharge || getBestRateInfo?.freightCharges);
                                                                if (freight > 0) {
                                                                    breakdownItems.push({ name: 'Freight Charges', amount: freight });
                                                                }

                                                                const fuel = safeNumber(getBestRateInfo?.pricing?.fuel || getBestRateInfo?.fuelCharge || getBestRateInfo?.fuelCharges);
                                                                if (fuel > 0) {
                                                                    breakdownItems.push({ name: 'Fuel Charges', amount: fuel });
                                                                }

                                                                const service = safeNumber(getBestRateInfo?.pricing?.service || getBestRateInfo?.serviceCharges);
                                                                if (service > 0) {
                                                                    breakdownItems.push({ name: 'Service Charges', amount: service });
                                                                }

                                                                const accessorial = safeNumber(getBestRateInfo?.pricing?.accessorial || getBestRateInfo?.accessorialCharges);
                                                                if (accessorial > 0) {
                                                                    breakdownItems.push({ name: 'Accessorial Charges', amount: accessorial });
                                                                }

                                                                if (getBestRateInfo?.guaranteed) {
                                                                    const guarantee = safeNumber(getBestRateInfo?.pricing?.guarantee || getBestRateInfo?.guaranteeCharge);
                                                                    if (guarantee > 0) {
                                                                        breakdownItems.push({ name: 'Guarantee Charge', amount: guarantee });
                                                                    }
                                                                }

                                                                if (breakdownItems.length > 0) {
                                                                    return (
                                                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                                                            {breakdownItems.map((item, index) => (
                                                                                <Box key={index}>
                                                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                                        {item.name}
                                                                                    </Typography>
                                                                                    <Typography variant="body1">
                                                                                        ${item.amount.toFixed(2)}
                                                                                    </Typography>
                                                                                </Box>
                                                                            ))}
                                                                        </Box>
                                                                    );
                                                                }

                                                                return (
                                                                    <Box sx={{ display: 'grid', gap: 2 }}>
                                                                        <Box>
                                                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                                Freight Charges
                                                                            </Typography>
                                                                            <Typography variant="body1">
                                                                                ${(getBestRateInfo?.pricing?.freight ||
                                                                                    getBestRateInfo?.freightCharge ||
                                                                                    getBestRateInfo?.freightCharges || 0).toFixed(2)}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box>
                                                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                                Fuel Charges
                                                                            </Typography>
                                                                            <Typography variant="body1">
                                                                                ${(getBestRateInfo?.pricing?.fuel ||
                                                                                    getBestRateInfo?.fuelCharge ||
                                                                                    getBestRateInfo?.fuelCharges || 0).toFixed(2)}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box>
                                                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                                Service Charges
                                                                            </Typography>
                                                                            <Typography variant="body1">
                                                                                ${(getBestRateInfo?.pricing?.service ||
                                                                                    getBestRateInfo?.serviceCharges || 0).toFixed(2)}
                                                                            </Typography>
                                                                        </Box>
                                                                    </Box>
                                                                );
                                                            })()}
                                                        </Grid>

                                                        {/* Right Column - Total */}
                                                        <Grid item xs={12} md={4}>
                                                            <Paper
                                                                elevation={0}
                                                                sx={{
                                                                    p: 2,
                                                                    borderRadius: 2,
                                                                    border: '1px solid #e0e0e0',
                                                                    bgcolor: 'background.default',
                                                                    height: '100%',
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    justifyContent: 'center'
                                                                }}
                                                            >
                                                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, textAlign: 'center' }}>
                                                                    Total Charges
                                                                </Typography>
                                                                <Typography variant="h4" sx={{ fontWeight: 700, color: '#000', textAlign: 'center' }}>
                                                                    ${(getBestRateInfo?.pricing?.total ||
                                                                        getBestRateInfo?.totalCharges || 0).toFixed(2)}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                                                                    {getBestRateInfo?.pricing?.currency ||
                                                                        getBestRateInfo?.currency || 'USD'}
                                                                </Typography>
                                                            </Paper>
                                                        </Grid>
                                                    </Grid>
                                                </Box>
                                            </Collapse>
                                        </Paper>
                                    </Grid>

                                    {/* Packages Section */}
                                    <Grid item xs={12}>
                                        <Paper sx={{ mb: 3 }}>
                                            <Box
                                                sx={{
                                                    p: 2,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    borderBottom: '1px solid #e0e0e0'
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <BoxIcon sx={{ color: '#000' }} />
                                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                                        Packages
                                                    </Typography>
                                                </Box>
                                                <IconButton onClick={() => toggleSection('packages')}>
                                                    <ExpandMoreIcon
                                                        sx={{
                                                            transform: expandedSections.packages ? 'rotate(180deg)' : 'none',
                                                            transition: 'transform 0.3s',
                                                            color: '#666'
                                                        }}
                                                    />
                                                </IconButton>
                                            </Box>
                                            <Collapse in={expandedSections.packages}>
                                                <Box sx={{ p: 3 }}>
                                                    <Grid container spacing={2}>
                                                        {allPackages.length === 0 && (
                                                            <Grid item xs={12}><Typography>No packages found</Typography></Grid>
                                                        )}
                                                        {allPackages.map((pkg, index) => (
                                                            <Grid item xs={12} sm={6} md={4} key={index}>
                                                                <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e0e0e0', bgcolor: 'background.default' }}>
                                                                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                                                                        Package {index + 1}
                                                                    </Typography>
                                                                    <Box sx={{ display: 'grid', gap: 1 }}>
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                                Description
                                                                            </Typography>
                                                                            <Typography variant="body1">{pkg.description || pkg.itemDescription || 'N/A'}</Typography>
                                                                        </Box>
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                                Quantity
                                                                            </Typography>
                                                                            <Typography variant="body1">{pkg.quantity || pkg.packagingQuantity || 1} {parseInt(pkg.quantity || pkg.packagingQuantity || 1) > 1 ? 'pieces' : 'piece'}</Typography>
                                                                        </Box>
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                                Weight
                                                                            </Typography>
                                                                            <Typography variant="body1">{pkg.weight || 'N/A'} lbs</Typography>
                                                                        </Box>
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                                Dimensions
                                                                            </Typography>
                                                                            <Typography variant="body1">
                                                                                {pkg.dimensions ?
                                                                                    `${pkg.dimensions.length || 0}" × ${pkg.dimensions.width || 0}" × ${pkg.dimensions.height || 0}"` :
                                                                                    (pkg.length && pkg.width && pkg.height ? `${pkg.length}" × ${pkg.width}" × ${pkg.height}"` : 'N/A')
                                                                                }
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                                Freight Class
                                                                            </Typography>
                                                                            <Typography variant="body1">{pkg.freightClass || 'N/A'}</Typography>
                                                                        </Box>
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                                Declared Value
                                                                            </Typography>
                                                                            <Typography variant="body1">${(pkg.value || pkg.declaredValue || 0).toFixed(2)}</Typography>
                                                                        </Box>
                                                                    </Box>
                                                                </Paper>
                                                            </Grid>
                                                        ))}
                                                    </Grid>
                                                    {allPackages.length > 3 && (
                                                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                                                            <Button
                                                                onClick={() => setShowAllPackages(!showAllPackages)}
                                                                sx={{ color: '#000', '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' } }}
                                                            >
                                                                {showAllPackages ? 'Show Less' : `Show ${allPackages.length - 3} More Packages`}
                                                            </Button>
                                                        </Box>
                                                    )}
                                                </Box>
                                            </Collapse>
                                        </Paper>
                                    </Grid>

                                    {/* Route Map and Shipment History in one row */}
                                    <Grid container spacing={3}>
                                        {/* Route Map Section - Left Column */}
                                        <Grid item xs={12} md={6}>
                                            <Paper>
                                                <Box
                                                    sx={{
                                                        p: 2,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        borderBottom: '1px solid #e0e0e0'
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <MapIcon sx={{ color: '#000' }} />
                                                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                                            Route Map
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Box sx={{ p: 3 }}>
                                                    {isGoogleMapsLoaded ? (
                                                        <Box>
                                                            <Box sx={{
                                                                height: '600px',
                                                                borderRadius: '12px',
                                                                overflow: 'hidden',
                                                                position: 'relative'
                                                            }}>
                                                                <GoogleMap
                                                                    mapContainerStyle={{ width: '100%', height: '100%' }}
                                                                    center={directions?.request?.origin || mapCenter}
                                                                    zoom={8}
                                                                    onLoad={handleMapLoad}
                                                                    options={mapOptions}
                                                                >
                                                                    {directions && directions.routes && directions.routes.length > 0 && directions.routes[0].overview_polyline && directions.routes[0].legs && directions.routes[0].legs.length > 0 && (
                                                                        <DirectionsRenderer
                                                                            directions={directions}
                                                                            options={{
                                                                                suppressMarkers: true,
                                                                                preserveViewport: true,
                                                                                polylineOptions: {
                                                                                    strokeWeight: 10,
                                                                                    strokeOpacity: 1.0,
                                                                                    geodesic: true,
                                                                                    clickable: false
                                                                                },
                                                                                routeIndex: 0,
                                                                                draggable: false
                                                                            }}
                                                                        />
                                                                    )}
                                                                    {directions?.request?.origin && (
                                                                        <Marker
                                                                            position={directions.request.origin}
                                                                            icon={{
                                                                                path: window.google.maps.SymbolPath.CIRCLE,
                                                                                scale: 12,
                                                                                fillColor: '#2196f3',
                                                                                fillOpacity: 1,
                                                                                strokeColor: '#ffffff',
                                                                                strokeWeight: 2
                                                                            }}
                                                                            label={{
                                                                                text: 'A',
                                                                                color: '#ffffff',
                                                                                fontSize: '14px',
                                                                                fontWeight: 'bold'
                                                                            }}
                                                                        />
                                                                    )}
                                                                    {directions?.request?.destination && (
                                                                        <Marker
                                                                            position={directions.request.destination}
                                                                            icon={{
                                                                                path: window.google.maps.SymbolPath.CIRCLE,
                                                                                scale: 12,
                                                                                fillColor: '#f44336',
                                                                                fillOpacity: 1,
                                                                                strokeColor: '#ffffff',
                                                                                strokeWeight: 2
                                                                            }}
                                                                            label={{
                                                                                text: 'B',
                                                                                color: '#ffffff',
                                                                                fontSize: '14px',
                                                                                fontWeight: 'bold'
                                                                            }}
                                                                        />
                                                                    )}
                                                                </GoogleMap>
                                                                {/* Route Summary Overlay */}
                                                                <Box sx={{
                                                                    position: 'absolute',
                                                                    top: 16,
                                                                    left: 16,
                                                                    background: 'rgba(255, 255, 255, 0.95)',
                                                                    backdropFilter: 'blur(10px)',
                                                                    borderRadius: '16px',
                                                                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                                                                    p: 2,
                                                                    zIndex: 1,
                                                                    minWidth: '200px'
                                                                }}>
                                                                    <Box sx={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 2,
                                                                        p: 1.5,
                                                                        borderRadius: '12px',
                                                                        background: 'rgba(25, 118, 210, 0.04)'
                                                                    }}>
                                                                        <LocationIcon sx={{
                                                                            color: 'primary.main',
                                                                            fontSize: 28,
                                                                            opacity: 0.9
                                                                        }} />
                                                                        <Box sx={{ flex: 1 }}>
                                                                            <Typography variant="subtitle2" sx={{
                                                                                color: 'text.secondary',
                                                                                fontSize: '0.75rem',
                                                                                fontWeight: 500,
                                                                                textTransform: 'uppercase',
                                                                                letterSpacing: '0.5px'
                                                                            }}>
                                                                                Total Distance
                                                                            </Typography>
                                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                <Typography variant="h6" sx={{
                                                                                    color: 'primary.main',
                                                                                    fontWeight: 700,
                                                                                    fontSize: '1.25rem',
                                                                                    lineHeight: 1.2
                                                                                }}>
                                                                                    {directions?.routes[0]?.legs[0]?.distance?.value &&
                                                                                        convertDistance(directions.routes[0].legs[0].distance.value)}
                                                                                </Typography>
                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                    <Typography component="span" sx={{
                                                                                        fontSize: '0.875rem',
                                                                                        fontWeight: 500,
                                                                                        color: 'text.secondary'
                                                                                    }}>
                                                                                        {useMetric ? 'km' : 'mi'}
                                                                                    </Typography>
                                                                                    <Button
                                                                                        onClick={() => setUseMetric(!useMetric)}
                                                                                        sx={{
                                                                                            minWidth: 'auto',
                                                                                            p: 1,
                                                                                            borderRadius: '8px',
                                                                                            background: 'rgba(25, 118, 210, 0.08)',
                                                                                            color: 'primary.main',
                                                                                            '&:hover': {
                                                                                                background: 'rgba(25, 118, 210, 0.12)'
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <SwapHorizIcon sx={{ fontSize: 20 }} />
                                                                                    </Button>
                                                                                </Box>
                                                                            </Box>
                                                                        </Box>
                                                                    </Box>
                                                                </Box>
                                                            </Box>
                                                        </Box>
                                                    ) : (
                                                        <Box sx={{
                                                            height: '600px',
                                                            borderRadius: '12px',
                                                            bgcolor: '#f5f5f5',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            <Typography color="text.secondary">Loading map...</Typography>
                                                        </Box>
                                                    )}
                                                </Box>
                                            </Paper>
                                        </Grid>

                                        {/* Shipment History Section - Right Column */}
                                        <Grid item xs={12} md={6}>
                                            <Paper sx={{ height: '100%' }} elevation={1}>
                                                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                                                    <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <AccessTimeIcon />
                                                        Shipment History
                                                    </Typography>
                                                </Box>
                                                <Box sx={{
                                                    p: 2,
                                                    height: '600px',
                                                    overflowY: 'auto',
                                                    '&::-webkit-scrollbar': {
                                                        width: '8px',
                                                    },
                                                    '&::-webkit-scrollbar-track': {
                                                        background: '#f1f1f1',
                                                        borderRadius: '4px',
                                                    },
                                                    '&::-webkit-scrollbar-thumb': {
                                                        background: '#888',
                                                        borderRadius: '4px',
                                                        '&:hover': {
                                                            background: '#555',
                                                        },
                                                    },
                                                }}>
                                                    {historyLoading ? (
                                                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                                            <CircularProgress size={24} />
                                                        </Box>
                                                    ) : mergedEvents.length === 0 ? (
                                                        <Box sx={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            p: 4,
                                                            textAlign: 'center'
                                                        }}>
                                                            <TimelineIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                                                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                                                No History Available
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Tracking and event information will appear here as they become available.
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        <ShipmentTimeline events={mergedEvents} shipmentId={shipment?.id} />
                                                    )}
                                                </Box>
                                            </Paper>
                                        </Grid>
                                    </Grid>
                                </Grid>
                            </Box>
                        </Paper>
                    </Box>
                </Box >
            </ErrorBoundary >
            <style>
                {`
                    @media print {
                        @page {
                            size: A4;
                            margin: 0.5in;
                        }
                        body {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                            color-adjust: exact;
                        }
                        .MuiPaper-root {
                            box-shadow: none !important;
                            border: 1px solid #e0e0e0 !important;
                            break-inside: avoid !important;
                        }
                        .MuiCollapse-root {
                            height: auto !important;
                        }
                        .MuiIconButton-root {
                            display: none !important;
                        }
                        .MuiButton-root:not(.print-visible) {
                            display: none !important;
                        }
                        .MuiChip-root {
                            border: 1px solid #e0e0e0 !important;
                            background-color: transparent !important;
                        }
                        .MuiChip-label {
                            color: #000 !important;
                        }
                        .MuiTypography-root {
                            color: #000 !important;
                        }
                        .MuiTypography-colorTextSecondary {
                            color: #666 !important;
                        }
                        .MuiDivider-root {
                            border-color: #e0e0e0 !important;
                        }
                        .MuiGrid-container {
                            display: block !important;
                        }
                        .MuiGrid-item {
                            width: 100% !important;
                            max-width: 100% !important;
                            flex-basis: 100% !important;
                            page-break-inside: avoid !important;
                        }
                        .MuiBox-root {
                            break-inside: avoid !important;
                        }
                        .MuiTimelineItem-root {
                            break-inside: avoid !important;
                        }
                        .google-map {
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                        .print-only {
                            display: block !important;
                        }
                        @supports (-webkit-appearance:none) {
                            .MuiTimelineDot-root {
                                print-color-adjust: exact;
                                -webkit-print-color-adjust: exact;
                            }
                        }
                    }
                `}
            </style>
            {/* Enhanced Print Label Configuration Dialog */}
            <Dialog
                open={printLabelMenuOpen}
                onClose={handlePrintLabelClose}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 2 }
                }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PrintIcon color="primary" />
                        <Typography variant="h6">Print Shipping Labels</Typography>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Grid container spacing={3}>
                        {/* Label Type Selection for eShipPlus */}
                        {isEShipPlusCarrier && shipmentDocuments.labels?.length > 1 && ( // Restored isEShipPlusCarrier
                            <Grid item xs={12}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Label Type
                                </Typography>
                                <ToggleButtonGroup
                                    value={labelConfig.labelType}
                                    exclusive
                                    onChange={(e, newType) => newType && handleLabelTypeChange(newType)}
                                    size="small"
                                    fullWidth
                                >
                                    <ToggleButton value="4x6" sx={{ textTransform: 'none' }}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                4" x 6" Standard
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Standard thermal labels
                                            </Typography>
                                        </Box>
                                    </ToggleButton>
                                    <ToggleButton value="Thermal" sx={{ textTransform: 'none' }}> {/* Changed value to 'Thermal' */}
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                Thermal Printer
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                e.g., Avery 3" x 4", specialized thermal
                                            </Typography>
                                        </Box>
                                    </ToggleButton>
                                </ToggleButtonGroup>
                            </Grid>
                        )}

                        {/* Quantity Selection */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle2" gutterBottom>
                                Number of Labels
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <IconButton
                                    onClick={() => handleQuantityChange(Math.max(1, labelConfig.quantity - 1))}
                                    disabled={labelConfig.quantity <= 1}
                                    size="small"
                                >
                                    <RemoveIcon />
                                </IconButton>
                                <TextField
                                    type="number" // Explicitly set type to number
                                    value={labelConfig.quantity}
                                    onChange={(e) => {
                                        const inputValue = e.target.value;

                                        if (inputValue === '') {
                                            handleQuantityChange(''); // Allow state to hold empty string
                                            return;
                                        }
                                        const num = parseInt(inputValue, 10);

                                        if (!isNaN(num)) {
                                            const clampedValue = Math.min(Math.max(1, num), 10);
                                            handleQuantityChange(clampedValue);
                                        }
                                        // If !isNaN(num) is false, do nothing, keeping the last valid state or empty string.
                                        // The browser's type="number" handling should prevent most truly invalid characters.
                                    }}
                                    size="small"
                                    sx={{ width: 80 }}
                                    inputProps={{
                                        min: 1,
                                        max: 10,
                                        style: { textAlign: 'center' }
                                    }}
                                />
                                <IconButton
                                    onClick={() => handleQuantityChange(Math.min(10, labelConfig.quantity + 1))}
                                    disabled={labelConfig.quantity >= 10}
                                    size="small"
                                >
                                    <AddIcon />
                                </IconButton>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Slider
                                        value={Number(labelConfig.quantity) || 1} // Ensure Slider gets a number
                                        onChange={(e, newValue) => handleQuantityChange(newValue)}
                                        min={1}
                                        max={10}
                                        marks
                                        valueLabelDisplay="auto"
                                        size="small"
                                    />
                                </Box>
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                {labelConfig.quantity > 1 &&
                                    `All ${labelConfig.quantity} labels will be combined into a single PDF document`
                                }
                            </Typography>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 1 }}>
                    <Button
                        onClick={handlePrintLabelClose}
                        color="inherit"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => handlePrintLabel(Number(labelConfig.quantity) || 1, labelConfig.labelType)} // Ensure numeric quantity
                        variant="contained"
                        startIcon={<PrintIcon />}
                        disabled={actionStates.printLabel.loading}
                    >
                        {actionStates.printLabel.loading ? 'Generating...' :
                            `Generate ${Number(labelConfig.quantity) || 1} Label${(Number(labelConfig.quantity) || 1) > 1 ? 's' : ''}` // Ensure numeric display
                        }
                    </Button>
                </DialogActions>
            </Dialog>

            {/* PDF Viewer Modal */}
            <Dialog
                open={pdfViewerOpen}
                onClose={() => {
                    setPdfViewerOpen(false);
                    if (currentPdfUrl?.startsWith('blob:')) {
                        URL.revokeObjectURL(currentPdfUrl);
                    }
                    setCurrentPdfUrl(null);
                }}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        height: '90vh',
                        borderRadius: 2
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PictureAsPdfIcon color="error" />
                        <Typography variant="h6">{currentPdfTitle}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            onClick={() => {
                                if (currentPdfUrl) {
                                    window.open(currentPdfUrl, '_blank');
                                }
                            }}
                            startIcon={<FileDownloadIcon />}
                            size="small"
                        >
                            Download
                        </Button>
                        <IconButton onClick={() => {
                            setPdfViewerOpen(false);
                            if (currentPdfUrl?.startsWith('blob:')) {
                                URL.revokeObjectURL(currentPdfUrl);
                            }
                            setCurrentPdfUrl(null);
                        }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ p: 0, height: '100%' }}>
                    {currentPdfUrl && (
                        <Box sx={{ height: '100%', width: '100%' }}>
                            <iframe
                                src={currentPdfUrl}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none'
                                }}
                                title={currentPdfTitle}
                            />
                        </Box>
                    )}
                </DialogContent>
            </Dialog>

            {/* Cancel Shipment Confirmation Modal */}
            <Dialog
                open={cancelModalOpen}
                onClose={handleCancelModalClose}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        p: 1
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    pb: 2
                }}>
                    <CancelIcon sx={{ color: 'warning.main' }} />
                    <Typography variant="h6">Cancel Shipment</Typography>
                </DialogTitle>
                <DialogContent>
                    {(() => {
                        const isEShipPlusShipment = getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' ||
                            getBestRateInfo?.sourceCarrierName === 'eShipPlus' ||
                            getBestRateInfo?.carrier?.toLowerCase().includes('eshipplus');

                        const isCanparShipment = getBestRateInfo?.displayCarrierId === 'CANPAR' ||
                            getBestRateInfo?.sourceCarrierName === 'Canpar' ||
                            getBestRateInfo?.carrier?.toLowerCase().includes('canpar');

                        const carrierName = getBestRateInfo?.carrier || 'Unknown carrier';

                        return (
                            <>
                                <Typography variant="body1" sx={{ mb: 2 }}>
                                    Are you sure you want to cancel this shipment?
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    <strong>Shipment ID:</strong> {shipment?.shipmentID}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    <strong>Carrier:</strong> {carrierName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    <strong>Tracking Number:</strong> {(() => {
                                        return shipment?.carrierBookingConfirmation?.proNumber ||
                                            shipment?.carrierBookingConfirmation?.confirmationNumber ||
                                            shipment?.trackingNumber ||
                                            'N/A';
                                    })()}
                                </Typography>

                                {(() => {
                                    const isEShipPlusShipment = getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' ||
                                        getBestRateInfo?.sourceCarrierName === 'eShipPlus' ||
                                        getBestRateInfo?.carrier?.toLowerCase().includes('eshipplus');

                                    const isCanparShipment = getBestRateInfo?.displayCarrierId === 'CANPAR' ||
                                        getBestRateInfo?.sourceCarrierName === 'Canpar' ||
                                        getBestRateInfo?.carrier?.toLowerCase().includes('canpar');

                                    const hasCancellationEndpoint = isEShipPlusShipment || isCanparShipment;
                                    const carrierName = getBestRateInfo?.carrier || 'Unknown carrier';

                                    return (
                                        <>
                                            <Typography variant="body1" sx={{ mb: 2 }}>
                                                Are you sure you want to cancel this shipment?
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                <strong>Shipment ID:</strong> {shipment?.shipmentID}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                <strong>Carrier:</strong> {carrierName}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                <strong>Tracking Number:</strong> {(() => {
                                                    return shipment?.carrierBookingConfirmation?.proNumber ||
                                                        shipment?.carrierBookingConfirmation?.confirmationNumber ||
                                                        shipment?.trackingNumber ||
                                                        'N/A';
                                                })()}
                                            </Typography>

                                            {hasCancellationEndpoint ? (
                                                <Alert severity="warning" sx={{ mt: 2 }}>
                                                    This action will immediately cancel the shipment with {carrierName}. This cannot be undone.
                                                </Alert>
                                            ) : (
                                                <Alert severity="info" sx={{ mt: 2 }}>
                                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                                        <strong>Manual Processing Required:</strong>
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        Cancellation for {carrierName} shipments requires manual processing by your Soluship representative.
                                                        This will mark the shipment as cancelled in the system and notify your rep to process the cancellation with the carrier.
                                                    </Typography>
                                                </Alert>
                                            )}
                                        </>
                                    );
                                })()}
                            </>
                        );
                    })()}
                </DialogContent>
                <DialogActions sx={{ p: 3, gap: 1 }}>
                    <Button
                        onClick={handleCancelModalClose}
                        disabled={cancelLoading}
                        sx={{ textTransform: 'none' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCancelShipment}
                        variant="contained"
                        color="error"
                        disabled={cancelLoading}
                        sx={{ textTransform: 'none' }}
                    >
                        {cancelLoading ? (
                            <>
                                <CircularProgress size={16} sx={{ mr: 1 }} />
                                Processing...
                            </>
                        ) : (() => {
                            const isEShipPlusShipment = getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' ||
                                getBestRateInfo?.sourceCarrierName === 'eShipPlus' ||
                                getBestRateInfo?.carrier?.toLowerCase().includes('eshipplus');

                            const isCanparShipment = getBestRateInfo?.displayCarrierId === 'CANPAR' ||
                                getBestRateInfo?.sourceCarrierName === 'Canpar' ||
                                getBestRateInfo?.carrier?.toLowerCase().includes('canpar');

                            return (isEShipPlusShipment || isCanparShipment) ? 'Cancel Shipment' : 'Request Cancellation';
                        })()}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Enhanced Snackbar for User Feedback */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={snackbar.severity === 'error' ? 8000 : 4000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{
                        width: '100%',
                        borderRadius: 2,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
                    }}
                >
                    {snackbar.message}
                    {/* Show additional smart update info if available */}
                    {updateResult && hasUpdates && (
                        <Box sx={{ mt: 1, fontSize: '0.875rem', opacity: 0.9 }}>
                            {getUpdateStatusMessage()}
                        </Box>
                    )}
                </Alert>
            </Snackbar>
        </LoadScript >
    );
};

// Add helper functions at the end of the file, before the export
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
            return <AccessTimeIcon sx={{ fontSize: 'inherit' }} />;
        case 'void':
            return <CancelIcon sx={{ fontSize: 'inherit' }} />;
        default:
            return <HelpOutlineIcon sx={{ fontSize: 'inherit' }} />;
    }
};

/**
 * Get display name for status
 */
const getStatusDisplayName = (status) => {
    const displayNames = {
        'draft': 'Draft',
        'pending': 'Pending',
        'created': 'Created',
        'scheduled': 'Scheduled',
        'booked': 'Booked',
        'awaiting_shipment': 'Awaiting Shipment',
        'awaiting shipment': 'Awaiting Shipment',
        'label_created': 'Awaiting Shipment',
        'in_transit': 'In Transit',
        'in transit': 'In Transit',
        'delivered': 'Delivered',
        'on_hold': 'On Hold',
        'on hold': 'On Hold',
        'canceled': 'Canceled',
        'cancelled': 'Cancelled',
        'void': 'Void',
        'unknown': 'Unknown'
    };
    return displayNames[status?.toLowerCase()] || status || 'Unknown';
};

export default ShipmentDetail; 