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
    Skeleton
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
    Delete as DeleteIcon
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';
import './ShipmentDetail.css';
import { Link } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

// Define libraries array as a static constant outside the component
const GOOGLE_MAPS_LIBRARIES = ["places", "geometry"];

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
                                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                                scaledSize: new window.google.maps.Size(30, 30)
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
    const [mapsApiKey, setMapsApiKey] = useState('AIzaSyCf3rYCEhFA2ed0VIhLfJxerIlQqsbC4Gw');
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

    const mapStyles = [
        {
            featureType: 'all',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#000000' }]
        }
    ];

    // Memoize the map options to prevent unnecessary re-renders
    const mapOptions = React.useMemo(() => ({
        styles: mapStyles,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
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
                const response = await fetch('https://getmapsapikey-xedyh5vw7a-uc.a.run.app');
                const data = await response.json();
                if (data.key) {
                    setMapsApiKey(data.key);
                }
            } catch (error) {
                console.error('Error fetching Maps API key:', error);
                setMapError('Failed to fetch Maps API key');
            }
        };

        fetchMapsApiKey();
    }, []);

    useEffect(() => {
        const calculateRoute = async () => {
            if (!shipment?.from || !shipment?.to || !window.google || !window.google.maps || !isGoogleMapsLoaded) {
                console.log('Missing required data for route calculation');
                return;
            }

            try {
                const geocoder = new window.google.maps.Geocoder();

                const fromAddress = `${shipment.from.street}${shipment.from.street2 ? ', ' + shipment.from.street2 : ''}, ${shipment.from.city}, ${shipment.from.state} ${shipment.from.postalCode}`;
                const toAddress = `${shipment.to.street}${shipment.to.street2 ? ', ' + shipment.to.street2 : ''}, ${shipment.to.city}, ${shipment.to.state} ${shipment.to.postalCode}`;

                const [originResult, destinationResult] = await Promise.all([
                    new Promise((resolve, reject) => {
                        geocoder.geocode({ address: fromAddress }, (results, status) => {
                            if (status === 'OK') resolve(results[0]);
                            else reject(new Error(`Geocoding failed for origin: ${status}`));
                        });
                    }),
                    new Promise((resolve, reject) => {
                        geocoder.geocode({ address: toAddress }, (results, status) => {
                            if (status === 'OK') resolve(results[0]);
                            else reject(new Error(`Geocoding failed for destination: ${status}`));
                        });
                    })
                ]);

                const bounds = new window.google.maps.LatLngBounds();
                bounds.extend(originResult.geometry.location);
                bounds.extend(destinationResult.geometry.location);
                setMapBounds(bounds);

                const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': mapsApiKey,
                        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
                    },
                    body: JSON.stringify({
                        origin: {
                            location: {
                                latLng: {
                                    latitude: originResult.geometry.location.lat(),
                                    longitude: originResult.geometry.location.lng()
                                }
                            }
                        },
                        destination: {
                            location: {
                                latLng: {
                                    latitude: destinationResult.geometry.location.lat(),
                                    longitude: destinationResult.geometry.location.lng()
                                }
                            }
                        },
                        travelMode: "DRIVE",
                        routingPreference: "TRAFFIC_AWARE",
                        computeAlternativeRoutes: false,
                        languageCode: "en-US",
                        units: useMetric ? "METRIC" : "IMPERIAL"
                    })
                });

                if (!response.ok) {
                    throw new Error(`Route calculation failed: ${response.statusText}`);
                }

                const routeData = await response.json();
                const route = routeData.routes[0];
                const decodedPath = window.google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);

                const directionsResult = {
                    routes: [{
                        legs: [{
                            start_location: originResult.geometry.location,
                            end_location: destinationResult.geometry.location,
                            distance: { text: useMetric ? `${Math.round(route.distanceMeters / 1000)} km` : `${Math.round(route.distanceMeters / 1609.34)} mi`, value: route.distanceMeters },
                            duration: { text: `${Math.round(parseInt(route.duration.replace('s', '')) / 60)} mins`, value: parseInt(route.duration.replace('s', '')) }
                        }],
                        overview_path: decodedPath
                    }],
                    request: {
                        origin: originResult.geometry.location,
                        destination: destinationResult.geometry.location,
                        travelMode: "DRIVING"
                    }
                };

                setDirections(directionsResult);
            } catch (error) {
                console.error('Error calculating route:', error);
                setMapError('Error calculating route');
            }
        };

        calculateRoute();
    }, [shipment, isGoogleMapsLoaded, useMetric, mapsApiKey]);

    // Handle map load and bounds
    const handleMapLoad = React.useCallback((map) => {
        setMap(map);
        setIsMapLoaded(true);

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
                            {/* Shipment Information Section - Full Width */}
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
                                        <ShippingIcon sx={{ color: '#000' }} />
                                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                            Shipment Information
                                        </Typography>
                                    </Box>
                                    <IconButton onClick={() => toggleSection('shipment')}>
                                        <ExpandMoreIcon
                                            sx={{
                                                transform: expandedSections.shipment ? 'rotate(180deg)' : 'none',
                                                transition: 'transform 0.3s',
                                                color: '#666'
                                            }}
                                        />
                                    </IconButton>
                                </Box>
                                <Collapse in={expandedSections.shipment}>
                                    <Box sx={{ p: 3 }}>
                                        <Grid container spacing={2}>
                                            {/* Left Column - Basic Info */}
                                            <Grid item xs={12} md={4}>
                                                <Box sx={{ display: 'grid', gap: 2 }}>
                                                    <Box>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                            Shipment Type
                                                        </Typography>
                                                        <Typography variant="body1">
                                                            {shipment?.shipmentInfo?.shipmentType || 'N/A'}
                                                        </Typography>
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                            Reference Number
                                                        </Typography>
                                                        <Typography variant="body1">
                                                            {shipment?.shipmentInfo?.referenceNumber || 'N/A'}
                                                        </Typography>
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                            Shipment Date
                                                        </Typography>
                                                        <Typography variant="body1">
                                                            {shipment?.shipmentInfo?.shipmentDate || 'N/A'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Grid>

                                            {/* Middle Column - Timing Info */}
                                            <Grid item xs={12} md={4}>
                                                <Box sx={{ display: 'grid', gap: 2 }}>
                                                    <Box>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                            Pickup Window
                                                        </Typography>
                                                        <Typography variant="body1">
                                                            {shipment.shipmentInfo.earliestPickup} - {shipment.shipmentInfo.latestPickup}
                                                        </Typography>
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                            Dropoff Window
                                                        </Typography>
                                                        <Typography variant="body1">
                                                            {shipment.shipmentInfo.earliestDelivery} - {shipment.shipmentInfo.latestDelivery}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Grid>

                                            {/* Right Column - Status & Tracking */}
                                            <Grid item xs={12} md={4}>
                                                <Box sx={{ display: 'grid', gap: 2 }}>
                                                    <Box>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                            Status
                                                        </Typography>
                                                        <Chip
                                                            label={shipment.status}
                                                            color={
                                                                shipment.status === 'Delivered' ? 'success' :
                                                                    shipment.status === 'In Transit' ? 'primary' :
                                                                        shipment.status === 'Awaiting Shipment' ? 'info' : 'default'
                                                            }
                                                            size="small"
                                                            sx={{
                                                                mt: 0.5,
                                                                '& .MuiChip-label': {
                                                                    fontWeight: 500
                                                                }
                                                            }}
                                                        />
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                            Carrier
                                                        </Typography>
                                                        <Typography variant="body1">
                                                            {shipment?.selectedRate?.carrier || 'N/A'}
                                                        </Typography>
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                            Tracking Number
                                                        </Typography>
                                                        <Typography
                                                            variant="body1"
                                                            component={Link}
                                                            to={`/tracking/${shipment.id}`}
                                                            sx={{
                                                                color: '#2196f3',
                                                                textDecoration: 'none',
                                                                '&:hover': {
                                                                    textDecoration: 'underline'
                                                                }
                                                            }}
                                                        >
                                                            {shipment.id}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Collapse>
                            </Paper>

                            {/* Main Content Grid - Two Columns */}
                            <Grid container spacing={3}>
                                {/* Left Column - Shipping Locations */}
                                <Grid item xs={12} md={8}>
                                    {/* Shipping Locations Section */}
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
                                                <LocationIcon sx={{ color: '#000' }} />
                                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                                    Shipping Locations
                                                </Typography>
                                            </Box>
                                            <IconButton onClick={() => toggleSection('locations')}>
                                                <ExpandMoreIcon
                                                    sx={{
                                                        transform: expandedSections.locations ? 'rotate(180deg)' : 'none',
                                                        transition: 'transform 0.3s',
                                                        color: '#666'
                                                    }}
                                                />
                                            </IconButton>
                                        </Box>
                                        <Collapse in={expandedSections.locations}>
                                            <Box sx={{ p: 3 }}>
                                                <Grid container spacing={3}>
                                                    {/* Ship From Address */}
                                                    <Grid item xs={12} md={6}>
                                                        <Box sx={{ mb: 2 }}>
                                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                                                Ship From
                                                            </Typography>
                                                            <Paper sx={{ p: 2, borderRadius: '12px' }}>
                                                                <Typography variant="body1" sx={{ mb: 1 }}>
                                                                    {shipment?.shipFrom?.company || 'N/A'}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                                                                    {formatAddress(shipment?.shipFrom)}
                                                                </Typography>
                                                                {isGoogleMapsLoaded && shipment?.shipFrom && (
                                                                    <SimpleMap
                                                                        address={shipment.shipFrom}
                                                                        title="Ship From Location"
                                                                    />
                                                                )}
                                                            </Paper>
                                                        </Box>
                                                    </Grid>

                                                    {/* Ship To Address */}
                                                    <Grid item xs={12} md={6}>
                                                        <Box sx={{ mb: 2 }}>
                                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                                                Ship To
                                                            </Typography>
                                                            <Paper sx={{ p: 2, borderRadius: '12px' }}>
                                                                <Typography variant="body1" sx={{ mb: 1 }}>
                                                                    {shipment?.shipTo?.company || 'N/A'}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                                                                    {formatAddress(shipment?.shipTo)}
                                                                </Typography>
                                                                {isGoogleMapsLoaded && shipment?.shipTo && (
                                                                    <SimpleMap
                                                                        address={shipment.shipTo}
                                                                        title="Ship To Location"
                                                                    />
                                                                )}
                                                            </Paper>
                                                        </Box>
                                                    </Grid>
                                                </Grid>
                                            </Box>
                                        </Collapse>
                                    </Paper>
                                </Grid>

                                {/* Right Column - Rate Details */}
                                <Grid item xs={12} md={4}>
                                    {/* Rate Details Section */}
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
                                                {/* Rate Selection UI */}
                                                {shipment?.rates && shipment.rates.length > 1 && (
                                                    <Box sx={{ mb: 3 }}>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>
                                                            Available Rates
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                            {shipment.rates.map((rate) => (
                                                                <Chip
                                                                    key={rate.id}
                                                                    label={`${rate.carrier} - ${rate.service} - $${rate.totalCharges.toFixed(2)}`}
                                                                    onClick={() => handleRateSelect(rate)}
                                                                    color={shipment.selectedRate?.id === rate.id ? 'primary' : 'default'}
                                                                    variant={shipment.selectedRate?.id === rate.id ? 'filled' : 'outlined'}
                                                                    sx={{ mb: 1 }}
                                                                />
                                                            ))}
                                                        </Box>
                                                    </Box>
                                                )}

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
                                                <Divider sx={{ my: 2 }} />
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
                                                <Divider sx={{ my: 2 }} />
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                        Total Charges
                                                    </Typography>
                                                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#000' }}>
                                                        ${(shipment?.selectedRate?.totalCharges || 0).toFixed(2)} {shipment?.selectedRate?.currency || 'USD'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Collapse>
                                    </Paper>
                                </Grid>

                                {/* Full Width Sections */}
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
                                                            <Box sx={{ height: '600px', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                                                                <GoogleMap
                                                                    mapContainerStyle={{ width: '100%', height: '100%' }}
                                                                    center={directions?.request?.origin || mapCenter}
                                                                    zoom={8}
                                                                    onLoad={handleMapLoad}
                                                                    options={mapOptions}
                                                                >
                                                                    {directions && (
                                                                        <DirectionsRenderer
                                                                            directions={directions}
                                                                            options={{
                                                                                suppressMarkers: true,
                                                                                preserveViewport: true,
                                                                                polylineOptions: {
                                                                                    strokeColor: '#2196f3',
                                                                                    strokeWeight: 4
                                                                                }
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
                                                                    right: 16,
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

                                                                    {/* Selected Rate Info */}
                                                                    {shipment?.selectedRate && (
                                                                        <Box sx={{
                                                                            mt: 1,
                                                                            p: 1.5,
                                                                            borderRadius: '12px',
                                                                            background: 'rgba(76, 175, 80, 0.04)',
                                                                            border: '1px solid rgba(76, 175, 80, 0.1)'
                                                                        }}>
                                                                            <Typography variant="subtitle2" sx={{
                                                                                color: 'text.secondary',
                                                                                fontSize: '0.75rem',
                                                                                fontWeight: 500,
                                                                                textTransform: 'uppercase',
                                                                                letterSpacing: '0.5px',
                                                                                mb: 0.5
                                                                            }}>
                                                                                Selected Rate
                                                                            </Typography>
                                                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                                {shipment.selectedRate.carrier} - {shipment.selectedRate.service}
                                                                            </Typography>
                                                                            <Typography variant="body2" color="text.secondary">
                                                                                Transit: {shipment.selectedRate.transitDays} {shipment.selectedRate.transitDays === 1 ? 'day' : 'days'}
                                                                            </Typography>
                                                                            <Typography variant="body2" color="text.secondary">
                                                                                Delivery: {shipment.selectedRate.deliveryDate}
                                                                            </Typography>
                                                                            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                                                                                ${shipment.selectedRate.totalCharges.toFixed(2)} {shipment.selectedRate.currency}
                                                                            </Typography>
                                                                        </Box>
                                                                    )}
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