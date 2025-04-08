import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Box,
    Typography,
    Paper,
    IconButton,
    Collapse,
    Divider,
    Button,
    Chip,
    Grid,
    useTheme,
    CircularProgress,
    Skeleton,
    Stack
} from '@mui/material';
import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineConnector,
    TimelineContent,
    TimelineDot
} from '@mui/lab';
import {
    ExpandMore as ExpandMoreIcon,
    ArrowBack as ArrowBackIcon,
    LocationOn as LocationIcon,
    LocalShipping as ShippingIcon,
    LocalShipping,
    Inventory as BoxIcon,
    AttachMoney as MoneyIcon,
    AccessTime as TimeIcon,
    Business as BusinessIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    Map as MapIcon,
    ExpandLess as ExpandLessIcon,
    NavigateNext as NavigateNextIcon,
    Home as HomeIcon,
    Download as DownloadIcon,
    Print as PrintIcon,
    AccessTime as AccessTimeIcon,
    LocationOn as LocationOnIcon,
    SwapHoriz as SwapHorizIcon,
    CheckCircle as CheckCircleIcon,
    Schedule as ScheduleIcon,
    Assignment as AssignmentIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';
import './ShipmentDetail.css';
import { Link } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { getMapsApiKey } from '../../utils/maps';

// Define libraries array as a static constant outside the component
const GOOGLE_MAPS_LIBRARIES = ["places", "geometry", "routes"];

// Add at the top with other helper functions
const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
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
const ShipmentTimeline = React.memo(({ events }) => (
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
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {event.location.city}, {event.location.state} {event.location.postalCode}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            {formatTimestamp(event.timestamp)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {event.description}
                        </Typography>
                    </Box>
                </TimelineContent>
            </TimelineItem>
        ))}
    </Timeline>
));

// Extract StatusChip component for reusability
const StatusChip = React.memo(({ status }) => {
    const getStatusConfig = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending':
            case 'created':
                return {
                    color: '#F59E0B',
                    bgcolor: '#FEF3C7',
                    label: 'Pending'
                };
            case 'awaiting shipment':
            case 'label_created':
                return {
                    color: '#3B82F6',
                    bgcolor: '#EFF6FF',
                    label: 'Awaiting Shipment'
                };
            case 'in transit':
            case 'in_transit':
                return {
                    color: '#6366F1',
                    bgcolor: '#EEF2FF',
                    label: 'In Transit'
                };
            case 'on hold':
            case 'on_hold':
                return {
                    color: '#7C3AED',
                    bgcolor: '#F5F3FF',
                    label: 'On Hold'
                };
            case 'delivered':
                return {
                    color: '#10B981',
                    bgcolor: '#ECFDF5',
                    label: 'Delivered'
                };
            case 'cancelled':
            case 'canceled':
                return {
                    color: '#EF4444',
                    bgcolor: '#FEE2E2',
                    label: 'Cancelled'
                };
            default:
                return {
                    color: '#6B7280',
                    bgcolor: '#F3F4F6',
                    label: status || 'Unknown'
                };
        }
    };

    const { color, bgcolor, label } = getStatusConfig(status);

    return (
        <Chip
            label={label}
            sx={{
                color: color,
                bgcolor: bgcolor,
                borderRadius: '16px',
                fontWeight: 500,
                fontSize: '0.75rem',
                height: '24px',
                '& .MuiChip-label': {
                    px: 2
                }
            }}
            size="small"
        />
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
                // Query by shipmentId
                const shipmentsRef = collection(db, 'shipments');
                const q = query(shipmentsRef, where('shipmentId', '==', id));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const shipmentDoc = querySnapshot.docs[0];
                    const shipmentData = { id: shipmentDoc.id, ...shipmentDoc.data() };

                    // Fetch tracking data
                    const trackingRef = collection(db, 'tracking');
                    const trackingQuery = query(trackingRef, where('shipmentId', '==', id));
                    const trackingSnapshot = await getDocs(trackingQuery);

                    if (!trackingSnapshot.empty) {
                        const trackingDoc = trackingSnapshot.docs[0];
                        const trackingData = trackingDoc.data();

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

                        // Update shipment data with tracking info
                        shipmentData.tracking = {
                            carrier: trackingData.carrier,
                            trackingNumber: trackingData.trackingNumber,
                            estimatedDeliveryDate: trackingData.estimatedDeliveryDate?.toDate(),
                            status: trackingData.status,
                            lastUpdated: trackingData.lastUpdated?.toDate()
                        };
                    }

                    // Fetch rates from the subcollection
                    const ratesRef = collection(db, 'shipments', shipmentDoc.id, 'rates');
                    const ratesSnapshot = await getDocs(ratesRef);

                    if (!ratesSnapshot.empty) {
                        const rates = ratesSnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        shipmentData.rates = rates;
                        shipmentData.selectedRate = rates[0];
                    }

                    // Fetch packages from the subcollection
                    const packagesRef = collection(db, 'shipments', shipmentDoc.id, 'packages');
                    const packagesSnapshot = await getDocs(packagesRef);

                    if (!packagesSnapshot.empty) {
                        const packages = packagesSnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        shipmentData.packages = packages;
                    }

                    console.log('Processed shipment data:', shipmentData);
                    setShipment(shipmentData);
                } else {
                    setError('Shipment not found');
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

    // Update the displayedPackages variable to handle potential null values
    const displayedPackages = shipment?.packages ?
        (showAllPackages ? shipment.packages : shipment.packages.slice(0, 3)) :
        [];

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
                        {/* Breadcrumb Navigation and Action Buttons */}
                        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {/* Breadcrumb */}
                            <Box sx={{
                                width: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                            }}>
                                <IconButton
                                    onClick={() => navigate('/dashboard')}
                                    sx={{ p: 0.5 }}
                                >
                                    <HomeIcon />
                                </IconButton>
                                <NavigateNextIcon />
                                <Typography
                                    variant="body2"
                                    onClick={() => navigate('/shipments')}
                                    sx={{
                                        cursor: 'pointer',
                                        color: '#2196f3',
                                        textDecoration: 'underline',
                                        '&:hover': {
                                            color: '#1976d2'
                                        }
                                    }}
                                >
                                    Shipments
                                </Typography>
                                <NavigateNextIcon />
                                <Typography variant="body2">
                                    Shipment #{shipment?.id || 'Loading...'}
                                </Typography>
                            </Box>
                            {/* Action Buttons */}
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<DownloadIcon />}
                                    onClick={handleDownload}
                                    sx={{
                                        color: '#000',
                                        borderColor: '#000',
                                        '&:hover': {
                                            borderColor: '#000',
                                            backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                        }
                                    }}
                                >
                                    Export
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<PrintIcon />}
                                    onClick={handlePrint}
                                    sx={{
                                        color: '#000',
                                        borderColor: '#000',
                                        '&:hover': {
                                            borderColor: '#000',
                                            backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                        }
                                    }}
                                >
                                    Print
                                </Button>
                            </Box>
                        </Box>

                        {/* Add id to the main content container */}
                        <Box id="shipment-detail-content">
                            {/* Shipment Information Section */}
                            <Grid item xs={12}>
                                <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                        <ShippingIcon sx={{ mr: 1, color: 'primary.main' }} />
                                        <Typography variant="h6">Shipment Information</Typography>
                                    </Box>

                                    <Grid container spacing={3}>
                                        {/* Basic Information */}
                                        <Grid item xs={12} md={4}>
                                            <Box sx={{
                                                p: 2,
                                                bgcolor: 'background.default',
                                                borderRadius: 1,
                                                border: '1px solid',
                                                borderColor: 'divider'
                                            }}>
                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                    Basic Information
                                                </Typography>
                                                <Stack spacing={2}>
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary">Shipment Type</Typography>
                                                        <Typography variant="body2">{shipment?.shipmentInfo?.shipmentType || 'N/A'}</Typography>
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary">Reference Number</Typography>
                                                        <Typography variant="body2">{shipment?.shipmentInfo?.shipperReferenceNumber || 'N/A'}</Typography>
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
                                        <Grid item xs={12} md={4}>
                                            <Box sx={{
                                                p: 2,
                                                bgcolor: 'background.default',
                                                borderRadius: 1,
                                                border: '1px solid',
                                                borderColor: 'divider'
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
                                                        <Typography variant="caption" color="text.secondary">Pickup Window</Typography>
                                                        <Typography variant="body2">
                                                            {shipment?.shipmentInfo?.earliestPickupTime && shipment?.shipmentInfo?.latestPickupTime
                                                                ? `${shipment.shipmentInfo.earliestPickupTime} - ${shipment.shipmentInfo.latestPickupTime}`
                                                                : '09:00 - 17:00'}
                                                        </Typography>
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary">Delivery Window</Typography>
                                                        <Typography variant="body2">
                                                            {shipment?.shipmentInfo?.earliestDeliveryTime && shipment?.shipmentInfo?.latestDeliveryTime
                                                                ? `${shipment.shipmentInfo.earliestDeliveryTime} - ${shipment.shipmentInfo.latestDeliveryTime}`
                                                                : '09:00 - 17:00'}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </Box>
                                        </Grid>

                                        {/* Service Options */}
                                        <Grid item xs={12} md={4}>
                                            <Box sx={{
                                                p: 2,
                                                bgcolor: 'background.default',
                                                borderRadius: 1,
                                                border: '1px solid',
                                                borderColor: 'divider'
                                            }}>
                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                    Service Options
                                                </Typography>
                                                <Stack spacing={2}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <Typography variant="caption" color="text.secondary">Hold for Pickup</Typography>
                                                        <Chip
                                                            size="small"
                                                            label={shipment?.shipmentInfo?.holdForPickup ? "Yes" : "No"}
                                                            color={shipment?.shipmentInfo?.holdForPickup ? "primary" : "default"}
                                                            variant="outlined"
                                                        />
                                                    </Box>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <Typography variant="caption" color="text.secondary">International</Typography>
                                                        <Chip
                                                            size="small"
                                                            label={shipment?.shipmentInfo?.internationalShipment ? "Yes" : "No"}
                                                            color={shipment?.shipmentInfo?.internationalShipment ? "primary" : "default"}
                                                            variant="outlined"
                                                        />
                                                    </Box>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <Typography variant="caption" color="text.secondary">Saturday Delivery</Typography>
                                                        <Chip
                                                            size="small"
                                                            label={shipment?.shipmentInfo?.saturdayDelivery ? "Yes" : "No"}
                                                            color={shipment?.shipmentInfo?.saturdayDelivery ? "primary" : "default"}
                                                            variant="outlined"
                                                        />
                                                    </Box>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <Typography variant="caption" color="text.secondary">Signature Required</Typography>
                                                        <Chip
                                                            size="small"
                                                            label={shipment?.shipmentInfo?.signatureServiceType !== "none" ? "Yes" : "No"}
                                                            color={shipment?.shipmentInfo?.signatureServiceType !== "none" ? "primary" : "default"}
                                                            variant="outlined"
                                                        />
                                                    </Box>
                                                </Stack>
                                            </Box>
                                        </Grid>

                                        {/* Status & Tracking */}
                                        <Grid item xs={12}>
                                            <Box sx={{
                                                p: 3,
                                                bgcolor: 'background.default',
                                                borderRadius: 2,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                mt: 2
                                            }}>
                                                <Grid container spacing={3}>
                                                    {/* Left Column - Status and Carrier */}
                                                    <Grid item xs={12} md={4}>
                                                        <Box sx={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 2,
                                                            height: '100%',
                                                            justifyContent: 'center'
                                                        }}>
                                                            <Box>
                                                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                                                    Current Status
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <StatusChip status={shipment?.status} />
                                                                </Box>
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                                                    Carrier
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <LocalShipping sx={{ color: 'primary.main', fontSize: '1.2rem' }} />
                                                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                                        {shipment?.selectedRate?.carrier || 'N/A'}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        </Box>
                                                    </Grid>

                                                    {/* Middle Column - Tracking and Dates */}
                                                    <Grid item xs={12} md={4}>
                                                        <Box sx={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 2,
                                                            height: '100%',
                                                            justifyContent: 'center'
                                                        }}>
                                                            <Box>
                                                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                                                    Tracking Number
                                                                </Typography>
                                                                <Link
                                                                    to={`/tracking/${shipment?.trackingNumber || shipment?.id}`}
                                                                    style={{ textDecoration: 'none' }}
                                                                >
                                                                    <Box sx={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 1,
                                                                        '&:hover': { color: 'primary.dark' }
                                                                    }}>
                                                                        <AssignmentIcon sx={{ color: 'primary.main', fontSize: '1.2rem' }} />
                                                                        <Typography
                                                                            variant="body1"
                                                                            sx={{
                                                                                fontWeight: 500,
                                                                                color: 'primary.main',
                                                                                '&:hover': { textDecoration: 'underline' }
                                                                            }}
                                                                        >
                                                                            {shipment?.trackingNumber || shipment?.id || 'N/A'}
                                                                        </Typography>
                                                                    </Box>
                                                                </Link>
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                                                    Last Updated
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <AccessTimeIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                                                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                                        {shipment?.tracking?.lastUpdated ?
                                                                            formatTimestamp(shipment.tracking.lastUpdated) : 'N/A'}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        </Box>
                                                    </Grid>

                                                    {/* Right Column - Estimated Delivery */}
                                                    <Grid item xs={12} md={4}>
                                                        <Paper
                                                            elevation={0}
                                                            sx={{
                                                                p: 2,
                                                                height: '100%',
                                                                bgcolor: 'primary.main',
                                                                color: 'primary.contrastText',
                                                                borderRadius: 2,
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            <Typography variant="caption" sx={{ mb: 1, opacity: 0.9 }}>
                                                                Estimated Delivery
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <LocalShipping sx={{ fontSize: '1.5rem' }} />
                                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                                    {shipment?.tracking?.estimatedDeliveryDate ?
                                                                        formatTimestamp(shipment.tracking.estimatedDeliveryDate) : 'Not Available'}
                                                                </Typography>
                                                            </Box>
                                                        </Paper>
                                                    </Grid>
                                                </Grid>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                </Paper>
                            </Grid>

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
                                                        {shipment?.shipFrom?.company || 'N/A'}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', mb: 2 }}>
                                                        {formatAddress(shipment?.shipFrom)}
                                                    </Typography>
                                                    {isGoogleMapsLoaded && shipment?.shipFrom && (
                                                        <SimpleMap
                                                            address={shipment.shipFrom}
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
                                                        {shipment?.shipTo?.company || 'N/A'}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', mb: 2 }}>
                                                        {formatAddress(shipment?.shipTo)}
                                                    </Typography>
                                                    {isGoogleMapsLoaded && shipment?.shipTo && (
                                                        <SimpleMap
                                                            address={shipment.shipTo}
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
                                                <Grid container spacing={3}>
                                                    {/* Left Column - Service Details */}
                                                    <Grid item xs={12} md={4}>
                                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                    Carrier & Service
                                                                </Typography>
                                                                <Typography variant="body1">
                                                                    {shipment?.selectedRate?.carrier || 'N/A'} - {shipment?.selectedRate?.service || 'N/A'}
                                                                </Typography>
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                    Transit Time
                                                                </Typography>
                                                                <Typography variant="body1">
                                                                    {shipment?.selectedRate?.transitDays || 0} {shipment?.selectedRate?.transitDays === 1 ? 'day' : 'days'}
                                                                </Typography>
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                    Delivery Date
                                                                </Typography>
                                                                <Typography variant="body1">
                                                                    {shipment?.selectedRate?.deliveryDate || 'N/A'}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </Grid>

                                                    {/* Middle Column - Charges */}
                                                    <Grid item xs={12} md={4}>
                                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                    Freight Charges
                                                                </Typography>
                                                                <Typography variant="body1">
                                                                    ${(shipment?.selectedRate?.freightCharges || 0).toFixed(2)}
                                                                </Typography>
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                    Fuel Charges
                                                                </Typography>
                                                                <Typography variant="body1">
                                                                    ${(shipment?.selectedRate?.fuelCharges || 0).toFixed(2)}
                                                                </Typography>
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                    Service Charges
                                                                </Typography>
                                                                <Typography variant="body1">
                                                                    ${(shipment?.selectedRate?.serviceCharges || 0).toFixed(2)}
                                                                </Typography>
                                                            </Box>
                                                            {shipment?.selectedRate?.guaranteed && (
                                                                <Box>
                                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                        Guarantee Charge
                                                                    </Typography>
                                                                    <Typography variant="body1">
                                                                        ${(shipment?.selectedRate?.guaranteeCharge || 0).toFixed(2)}
                                                                    </Typography>
                                                                </Box>
                                                            )}
                                                        </Box>
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
                                                                ${(shipment?.selectedRate?.totalCharges || 0).toFixed(2)}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                                                                {shipment?.selectedRate?.currency || 'USD'}
                                                            </Typography>
                                                        </Paper>
                                                    </Grid>
                                                </Grid>
                                            </Box>
                                        </Collapse>
                                    </Paper>
                                </Grid>
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
                                                {displayedPackages.map((pkg, index) => (
                                                    <Grid item xs={12} sm={6} md={4} key={index}>
                                                        <Paper
                                                            elevation={0}
                                                            sx={{
                                                                p: 2,
                                                                borderRadius: 2,
                                                                border: '1px solid #e0e0e0',
                                                                bgcolor: 'background.default'
                                                            }}
                                                        >
                                                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                                                                Package {index + 1}
                                                            </Typography>
                                                            <Box sx={{ display: 'grid', gap: 1 }}>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                        Description
                                                                    </Typography>
                                                                    <Typography variant="body1">{pkg.description}</Typography>
                                                                </Box>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                        Quantity
                                                                    </Typography>
                                                                    <Typography variant="body1">
                                                                        {pkg.quantity} {parseInt(pkg.quantity) > 1 ? 'pieces' : 'piece'}
                                                                    </Typography>
                                                                </Box>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                        Weight
                                                                    </Typography>
                                                                    <Typography variant="body1">{pkg.weight} lbs</Typography>
                                                                </Box>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                        Dimensions
                                                                    </Typography>
                                                                    <Typography variant="body1">
                                                                        {pkg.dimensions ?
                                                                            `${pkg.dimensions.length || 0}" × ${pkg.dimensions.width || 0}" × ${pkg.dimensions.height || 0}"` :
                                                                            'N/A'
                                                                        }
                                                                    </Typography>
                                                                </Box>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                        Freight Class
                                                                    </Typography>
                                                                    <Typography variant="body1">{pkg.freightClass}</Typography>
                                                                </Box>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                        Declared Value
                                                                    </Typography>
                                                                    <Typography variant="body1">
                                                                        ${(pkg.value || 0).toFixed(2)}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        </Paper>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                            {shipment && shipment.packages && shipment.packages.length > 3 && (
                                                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                                                    <Button
                                                        onClick={() => setShowAllPackages(!showAllPackages)}
                                                        sx={{
                                                            color: '#000',
                                                            '&:hover': {
                                                                bgcolor: 'rgba(0, 0, 0, 0.04)'
                                                            }
                                                        }}
                                                    >
                                                        {showAllPackages ? 'Show Less' : `Show ${shipment.packages.length - 3} More Packages`}
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
                                            <ShipmentTimeline events={trackingRecords} />
                                        </Box>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </Box>
                    </Box>
                </Box>
            </ErrorBoundary>
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
        </LoadScript>
    );
};

// Add helper functions at the end of the file, before the export
const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
        case 'delivered':
            return '#4caf50';  // Green
        case 'out_for_delivery':
            return '#ff9800';  // Orange
        case 'in_transit':
            return '#2196f3';  // Blue
        case 'picked_up':
            return '#9c27b0';  // Purple
        default:
            return '#9e9e9e';  // Grey
    }
};

const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
        case 'delivered':
            return <CheckCircleIcon />;
        case 'out_for_delivery':
            return <LocalShipping />;
        case 'in_transit':
            return <SwapHorizIcon />;
        case 'picked_up':
            return <AssignmentIcon />;
        default:
            return <ScheduleIcon />;
    }
};

export default ShipmentDetail; 