import React, { useState, useEffect, useMemo } from 'react';
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
    useTheme
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

// Define libraries array as a static constant outside the component
const GOOGLE_MAPS_LIBRARIES = ["places", "geometry"];

const SimpleMap = ({ address, title }) => {
    const [position, setPosition] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!window.google || !window.google.maps) {
            setError('Google Maps not loaded');
            return;
        }

        // Simple geocoding
        const geocoder = new window.google.maps.Geocoder();
        const addressString = `${address.address1}${address.address2 ? ', ' + address.address2 : ''}, ${address.city}, ${address.state} ${address.postalCode}`;

        geocoder.geocode({ address: addressString }, (results, status) => {
            if (status === 'OK') {
                const location = results[0].geometry.location;
                setPosition({
                    lat: location.lat(),
                    lng: location.lng()
                });
            } else {
                console.error('Geocoding failed:', status);
                setError('Failed to geocode address');
            }
        });
    }, [address]);

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
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Typography color="text.secondary">{error}</Typography>
                </Box>
            </Box>
        );
    }

    if (!position) {
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
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Typography color="text.secondary">Loading map...</Typography>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                {title}
            </Typography>
            <GoogleMap
                mapContainerStyle={{
                    width: '100%',
                    height: '200px',
                    borderRadius: '12px'
                }}
                center={position}
                zoom={15}
            >
                <Marker
                    position={position}
                    icon={{
                        url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                        scaledSize: new window.google.maps.Size(30, 30)
                    }}
                />
            </GoogleMap>
        </Box>
    );
};

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

    // Mock data generation for a single shipment
    const shipment = React.useMemo(() => {
        const mockData = {
            id: id,
            status: 'Awaiting Shipment',
            date: new Date().toLocaleString(),
            shipmentInfo: {
                shipmentType: 'Courier',
                shipmentDate: new Date().toISOString().split('T')[0],
                earliestPickup: '09:00',
                latestPickup: '17:00',
                earliestDelivery: '09:00',
                latestDelivery: '17:00',
                referenceNumber: 'REF-' + id.toUpperCase()
            },
            shipFrom: {
                company: 'Tech Solutions Inc.',
                contactName: 'John Smith',
                contactPhone: '(555) 123-4567',
                contactEmail: 'john@techsolutions.com',
                address1: '55 Scollard St',
                address2: '',
                city: 'Toronto',
                state: 'ON',
                postalCode: 'M5R 0A1',
                country: 'CA'
            },
            shipTo: {
                company: 'Global Enterprises',
                contactName: 'Emma Wilson',
                contactPhone: '(555) 987-6543',
                contactEmail: 'emma@globalent.com',
                address1: '4 Plunkett Court',
                address2: '',
                city: 'Barrie',
                state: 'ON',
                postalCode: 'L4N 6M3',
                country: 'CA'
            },
            packages: [
                {
                    description: 'Electronics Equipment',
                    quantity: 2,
                    weight: '15.5',
                    dimensions: {
                        length: '24',
                        width: '18',
                        height: '12'
                    },
                    freightClass: '60',
                    value: 1200.00
                },
                {
                    description: 'Office Supplies',
                    quantity: 1,
                    weight: '8.2',
                    dimensions: {
                        length: '15',
                        width: '12',
                        height: '10'
                    },
                    freightClass: '50',
                    value: 450.00
                },
                {
                    description: 'Industrial Parts',
                    quantity: 3,
                    weight: '25.0',
                    dimensions: {
                        length: '30',
                        width: '20',
                        height: '15'
                    },
                    freightClass: '70',
                    value: 2800.00
                },
                {
                    description: 'Safety Equipment',
                    quantity: 1,
                    weight: '12.5',
                    dimensions: {
                        length: '20',
                        width: '15',
                        height: '10'
                    },
                    freightClass: '55',
                    value: 850.00
                },
                {
                    description: 'Tools and Equipment',
                    quantity: 2,
                    weight: '18.0',
                    dimensions: {
                        length: '25',
                        width: '15',
                        height: '12'
                    },
                    freightClass: '65',
                    value: 1500.00
                },
                {
                    description: 'Spare Parts',
                    quantity: 1,
                    weight: '10.0',
                    dimensions: {
                        length: '18',
                        width: '12',
                        height: '8'
                    },
                    freightClass: '50',
                    value: 600.00
                },
                {
                    description: 'Maintenance Supplies',
                    quantity: 2,
                    weight: '14.5',
                    dimensions: {
                        length: '22',
                        width: '16',
                        height: '10'
                    },
                    freightClass: '55',
                    value: 950.00
                }
            ],
            rate: {
                carrier: 'FedEx',
                service: 'Express',
                transitDays: 2,
                deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                freightCharges: 175.50,
                fuelCharges: 25.30,
                serviceCharges: 15.00,
                totalCharges: 215.80,
                currency: 'CAD',
                guaranteed: true,
                guaranteeCharge: 25.00
            }
        };

        return mockData;
    }, [id]);

    // Add mock shipment history data
    const shipmentHistory = React.useMemo(() => {
        const now = new Date();
        return [
            {
                id: 1,
                status: 'Order Created',
                location: 'Online System',
                timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'Shipment order created in the system',
                icon: <ScheduleIcon />,
                color: 'grey.500'
            },
            {
                id: 2,
                status: 'Pickup Scheduled',
                location: 'Sender Location',
                timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'Pickup scheduled with carrier',
                icon: <AccessTimeIcon />,
                color: 'info.main'
            },
            {
                id: 3,
                status: 'Picked Up',
                location: 'Sender Warehouse',
                timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'Package picked up by carrier',
                icon: <LocalShipping />,
                color: 'primary.main'
            },
            {
                id: 4,
                status: 'In Transit',
                location: 'Distribution Center',
                timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'Package in transit to destination',
                icon: <LocationOnIcon />,
                color: 'secondary.main'
            },
            {
                id: 5,
                status: 'Out for Delivery',
                location: 'Local Delivery Center',
                timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                description: 'Package out for final delivery',
                icon: <LocalShipping />,
                color: 'warning.main'
            },
            {
                id: 6,
                status: 'Delivered',
                location: 'Recipient Address',
                timestamp: new Date().toISOString(),
                description: 'Package successfully delivered',
                icon: <CheckCircleIcon />,
                color: 'success.main'
            }
        ];
    }, []);

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

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
            if (!shipment.shipFrom || !shipment.shipTo || !window.google || !window.google.maps || !isGoogleMapsLoaded) {
                return;
            }

            try {
                const geocoder = new window.google.maps.Geocoder();
                const fromAddress = `${shipment.shipFrom.address1}, ${shipment.shipFrom.city}, ${shipment.shipFrom.state} ${shipment.shipFrom.postalCode}`;
                const toAddress = `${shipment.shipTo.address1}, ${shipment.shipTo.city}, ${shipment.shipTo.state} ${shipment.shipTo.postalCode}`;

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

                // Create bounds from origin and destination
                const bounds = new window.google.maps.LatLngBounds();
                bounds.extend(originResult.geometry.location);
                bounds.extend(destinationResult.geometry.location);
                setMapBounds(bounds);

                const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': 'AIzaSyCf3rYCEhFA2ed0VIhLfJxerIlQqsbC4Gw',
                        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps'
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
                        routeModifiers: {
                            avoidTolls: false,
                            avoidHighways: false,
                            avoidFerries: false
                        },
                        languageCode: "en-US",
                        units: "IMPERIAL"
                    })
                });

                if (!response.ok) {
                    throw new Error(`Route calculation failed: ${response.statusText}`);
                }

                const routeData = await response.json();

                if (!routeData.routes || routeData.routes.length === 0) {
                    throw new Error('No routes found');
                }

                const route = routeData.routes[0];
                const decodedPath = window.google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);

                // Create steps from the decoded path
                const steps = [];
                for (let i = 0; i < decodedPath.length - 1; i++) {
                    const start = decodedPath[i];
                    const end = decodedPath[i + 1];
                    const distance = window.google.maps.geometry.spherical.computeDistanceBetween(start, end);
                    const duration = Math.round(distance / 20); // Assuming average speed of 20 m/s

                    steps.push({
                        path: [start, end],
                        start_location: start,
                        end_location: end,
                        travel_mode: "DRIVING",
                        distance: { text: `${Math.round(distance / 1609.34)} mi`, value: distance },
                        duration: { text: `${Math.round(duration / 60)} mins`, value: duration },
                        instructions: `Continue on route`
                    });
                }

                const directionsResult = {
                    routes: [{
                        legs: [{
                            steps: steps,
                            start_location: decodedPath[0],
                            end_location: decodedPath[decodedPath.length - 1],
                            distance: { text: `${Math.round(route.distanceMeters / 1609.34)} mi`, value: route.distanceMeters },
                            duration: { text: `${Math.round(parseInt(route.duration.replace('s', '')) / 60)} mins`, value: parseInt(route.duration.replace('s', '')) },
                            via_waypoints: []
                        }],
                        overview_path: decodedPath,
                        warnings: [],
                        bounds: bounds,
                        copyrights: "Map data ©2024 Google",
                        summary: "Fastest route",
                        waypoint_order: []
                    }],
                    request: {
                        origin: originResult.geometry.location,
                        destination: destinationResult.geometry.location,
                        travelMode: "DRIVING"
                    },
                    status: "OK"
                };

                setDirections(directionsResult);
            } catch (error) {
                console.error('Error calculating route:', error);
                setMapError('Error calculating route');
            }
        };

        calculateRoute();
    }, [shipment.shipFrom, shipment.shipTo, isGoogleMapsLoaded]);

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
        return `${address.address1}${address.address2 ? ', ' + address.address2 : ''}\n${address.city}, ${address.state} ${address.postalCode}\n${address.country}`;
    };

    const formatPhone = (phone) => {
        return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    };

    const displayedPackages = showAllPackages ? shipment.packages : shipment.packages.slice(0, 3);

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
                                                        {shipment.shipmentInfo.shipmentType}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                        Reference Number
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {shipment.shipmentInfo.referenceNumber}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                        Shipment Date
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {shipment.shipmentInfo.shipmentDate}
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
                                                        {shipment.rate.carrier}
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
                                                {/* Ship From */}
                                                <Grid item xs={12} md={6}>
                                                    <Box>
                                                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                                                            Ship From
                                                        </Typography>
                                                        {isGoogleMapsLoaded ? (
                                                            <SimpleMap address={shipment.shipFrom} title="Location Map" />
                                                        ) : (
                                                            <Box sx={{
                                                                height: '200px',
                                                                borderRadius: '12px',
                                                                bgcolor: '#f5f5f5',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}>
                                                                <Typography color="text.secondary">Loading map...</Typography>
                                                            </Box>
                                                        )}
                                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                                                    Company Details
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                                    <BusinessIcon sx={{ color: '#000' }} />
                                                                    <Typography variant="body1">{shipment.shipFrom.company}</Typography>
                                                                </Box>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                                    <PhoneIcon sx={{ color: '#000' }} />
                                                                    <Typography variant="body1">{formatPhone(shipment.shipFrom.contactPhone)}</Typography>
                                                                </Box>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <EmailIcon sx={{ color: '#000' }} />
                                                                    <Typography variant="body1">{shipment.shipFrom.contactEmail}</Typography>
                                                                </Box>
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                                                    Address
                                                                </Typography>
                                                                <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>
                                                                    {formatAddress(shipment.shipFrom)}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </Box>
                                                </Grid>

                                                {/* Ship To */}
                                                <Grid item xs={12} md={6}>
                                                    <Box>
                                                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                                                            Ship To
                                                        </Typography>
                                                        {isGoogleMapsLoaded ? (
                                                            <SimpleMap address={shipment.shipTo} title="Location Map" />
                                                        ) : (
                                                            <Box sx={{
                                                                height: '200px',
                                                                borderRadius: '12px',
                                                                bgcolor: '#f5f5f5',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}>
                                                                <Typography color="text.secondary">Loading map...</Typography>
                                                            </Box>
                                                        )}
                                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                                                    Company Details
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                                    <BusinessIcon sx={{ color: '#000' }} />
                                                                    <Typography variant="body1">{shipment.shipTo.company}</Typography>
                                                                </Box>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                                    <PhoneIcon sx={{ color: '#000' }} />
                                                                    <Typography variant="body1">{formatPhone(shipment.shipTo.contactPhone)}</Typography>
                                                                </Box>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <EmailIcon sx={{ color: '#000' }} />
                                                                    <Typography variant="body1">{shipment.shipTo.contactEmail}</Typography>
                                                                </Box>
                                                            </Box>
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                                                    Address
                                                                </Typography>
                                                                <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>
                                                                    {formatAddress(shipment.shipTo)}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
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
                                            <Box sx={{ display: 'grid', gap: 2 }}>
                                                <Box>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                        Carrier & Service
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {shipment.rate.carrier} - {shipment.rate.service}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                        Transit Time
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {shipment.rate.transitDays} {shipment.rate.transitDays === 1 ? 'day' : 'days'}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                        Delivery Date
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {shipment.rate.deliveryDate}
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
                                                        ${shipment.rate.freightCharges.toFixed(2)}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                        Fuel Charges
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        ${shipment.rate.fuelCharges.toFixed(2)}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                        Service Charges
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        ${shipment.rate.serviceCharges.toFixed(2)}
                                                    </Typography>
                                                </Box>
                                                {shipment.rate.guaranteed && (
                                                    <Box>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                            Guarantee Charge
                                                        </Typography>
                                                        <Typography variant="body1">
                                                            ${shipment.rate.guaranteeCharge.toFixed(2)}
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
                                                    ${shipment.rate.totalCharges.toFixed(2)} {shipment.rate.currency}
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
                                                                        {pkg.dimensions.length}" × {pkg.dimensions.width}" × {pkg.dimensions.height}"
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
                                                                    <Typography variant="body1">${pkg.value.toFixed(2)}</Typography>
                                                                </Box>
                                                            </Box>
                                                        </Paper>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                            {shipment.packages.length > 3 && (
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
                                                <Typography variant="h6" component="h2">
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
                                                <Timeline
                                                    position="right"
                                                    sx={{
                                                        '& .MuiTimelineItem-root': {
                                                            minHeight: '80px',
                                                            '&:last-child': {
                                                                minHeight: 'auto',
                                                            },
                                                            pl: 0,
                                                            '&::before': {
                                                                display: 'none'
                                                            }
                                                        },
                                                        '& .MuiTimelineContent-root': {
                                                            py: 1,
                                                            textAlign: 'left',
                                                            pl: 2,
                                                        },
                                                        '& .MuiTimelineDot-root': {
                                                            p: 1,
                                                            boxShadow: 'none',
                                                        },
                                                        '& .MuiTimelineConnector-root': {
                                                            backgroundColor: '#e0e0e0',
                                                        },
                                                        '& .MuiTimelineSeparator-root': {
                                                            marginLeft: 0,
                                                            paddingLeft: 0,
                                                        },
                                                        pl: 0,
                                                    }}
                                                >
                                                    {shipmentHistory.map((event) => (
                                                        <TimelineItem key={event.id}>
                                                            <TimelineSeparator>
                                                                <TimelineDot sx={{ bgcolor: event.color }}>
                                                                    {event.icon}
                                                                </TimelineDot>
                                                                <TimelineConnector />
                                                            </TimelineSeparator>
                                                            <TimelineContent>
                                                                <Typography variant="subtitle1" component="span" sx={{ fontWeight: 600 }}>
                                                                    {event.status}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                                                    {event.location}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                                                    {formatTimestamp(event.timestamp)}
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                                                    {event.description}
                                                                </Typography>
                                                            </TimelineContent>
                                                        </TimelineItem>
                                                    ))}
                                                </Timeline>
                                            </Box>
                                        </Paper>
                                    </Grid>
                                </Grid>
                            </Grid>
                        </Grid>
                    </Box>
                </Box>
            </Box>

            {/* Add print styles */}
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
                        }
                        .MuiPaper-root {
                            box-shadow: none !important;
                            border: 1px solid #e0e0e0 !important;
                        }
                        .MuiCollapse-root {
                            height: auto !important;
                        }
                        .MuiIconButton-root {
                            display: none !important;
                        }
                        .MuiButton-root {
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
                        }
                        .MuiBox-root {
                            break-inside: avoid;
                        }
                        .MuiPaper-root {
                            break-inside: avoid;
                        }
                        .MuiGrid-root {
                            break-inside: avoid;
                        }
                    }
                `}
            </style>
        </LoadScript>
    );
};

export default ShipmentDetail; 