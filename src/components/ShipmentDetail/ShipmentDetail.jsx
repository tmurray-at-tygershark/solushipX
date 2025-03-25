import React, { useState, useEffect } from 'react';
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
    ExpandMore as ExpandMoreIcon,
    ArrowBack as ArrowBackIcon,
    LocationOn as LocationIcon,
    LocalShipping as ShippingIcon,
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
    Print as PrintIcon
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';
import './ShipmentDetail.css';
import { Link } from 'react-router-dom';

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

    const mapStyles = [
        {
            featureType: 'all',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#000000' }]
        }
    ];

    const fromMarkerPosition = { lat: 43.6532, lng: -79.3832 };
    const toMarkerPosition = { lat: 49.2827, lng: -123.1207 };

    // Get the previous path from location state or default to dashboard
    const previousPath = location.state?.from || '/dashboard';

    // Mock data generation for a single shipment
    const generateMockShipment = () => {
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
                referenceNumber: 'REF-' + Math.random().toString(36).substring(7).toUpperCase()
            },
            shipFrom: {
                company: 'Tech Solutions Inc.',
                contactName: 'John Smith',
                contactPhone: '(555) 123-4567',
                contactEmail: 'john@techsolutions.com',
                address1: '123 Business Ave',
                address2: 'Suite 200',
                city: 'Toronto',
                state: 'ON',
                postalCode: 'M5V 2T6',
                country: 'CA'
            },
            shipTo: {
                company: 'Global Enterprises',
                contactName: 'Emma Wilson',
                contactPhone: '(555) 987-6543',
                contactEmail: 'emma@globalent.com',
                address1: '456 Corporate Blvd',
                address2: 'Floor 15',
                city: 'Vancouver',
                state: 'BC',
                postalCode: 'V6B 4N7',
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
    };

    const shipment = generateMockShipment();

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
            if (!shipment.shipFrom || !shipment.shipTo || !window.google || !window.google.maps) {
                setMapError('Google Maps not loaded');
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

                const response = await fetch('https://getmapsapikey-xedyh5vw7a-uc.a.run.app/route', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
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
                        units: "IMPERIAL",
                        polylineEncoding: "ENCODED_POLYLINE"
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

                // Create a DirectionsResult object that DirectionsRenderer can understand
                const directionsResult = {
                    routes: [{
                        legs: [{
                            steps: decodedPath.map((point, index) => ({
                                path: [point],
                                start_location: point,
                                end_location: decodedPath[index + 1] || point,
                                distance: { text: `${Math.round(route.distanceMeters / 1609.34)} mi` },
                                duration: { text: `${Math.round(parseInt(route.duration.replace('s', '')) / 3600)} hours` }
                            })),
                            start_location: decodedPath[0],
                            end_location: decodedPath[decodedPath.length - 1],
                            distance: { text: `${Math.round(route.distanceMeters / 1609.34)} mi` },
                            duration: { text: `${Math.round(parseInt(route.duration.replace('s', '')) / 3600)} hours` }
                        }],
                        overview_path: decodedPath,
                        bounds: new window.google.maps.LatLngBounds(
                            new window.google.maps.LatLng(route.bounds.southwest.latitude, route.bounds.southwest.longitude),
                            new window.google.maps.LatLng(route.bounds.northeast.latitude, route.bounds.northeast.longitude)
                        )
                    }]
                };

                setDirections(directionsResult);

                // Update map center and zoom based on the route bounds
                const bounds = new window.google.maps.LatLngBounds();
                decodedPath.forEach(point => bounds.extend(point));
                setMapCenter({
                    lat: bounds.getCenter().lat(),
                    lng: bounds.getCenter().lng()
                });
            } catch (error) {
                console.error('Error calculating route:', error);
                setMapError('Failed to calculate route');
            }
        };

        if (isGoogleMapsLoaded && window.google && window.google.maps) {
            calculateRoute();
        }
    }, [shipment.shipFrom, shipment.shipTo, isGoogleMapsLoaded]);

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
                                    <Grid item xs={12} sm={6}>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                Shipment Type
                                            </Typography>
                                            <Typography variant="body1">
                                                {shipment.shipmentInfo.shipmentType}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                Reference Number
                                            </Typography>
                                            <Typography variant="body1">
                                                {shipment.shipmentInfo.referenceNumber}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                Shipment Date
                                            </Typography>
                                            <Typography variant="body1">
                                                {shipment.shipmentInfo.shipmentDate}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                Pickup Window
                                            </Typography>
                                            <Typography variant="body1">
                                                {shipment.shipmentInfo.earliestPickup} - {shipment.shipmentInfo.latestPickup}
                                            </Typography>
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

                            {/* Route Map Section */}
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
                                        <Box sx={{ height: '400px', borderRadius: '12px', overflow: 'hidden' }}>
                                            <GoogleMap
                                                mapContainerStyle={{ width: '100%', height: '100%' }}
                                                center={mapCenter}
                                                zoom={mapZoom}
                                                onLoad={setIsMapLoaded}
                                                options={{
                                                    styles: mapStyles,
                                                    disableDefaultUI: true,
                                                    zoomControl: true,
                                                    streetViewControl: false,
                                                    mapTypeControl: false,
                                                    fullscreenControl: false
                                                }}
                                            >
                                                <Marker position={fromMarkerPosition} />
                                                <Marker position={toMarkerPosition} />
                                                {directions && <DirectionsRenderer directions={directions} />}
                                            </GoogleMap>
                                        </Box>
                                    ) : (
                                        <Box sx={{
                                            height: '400px',
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
                    </Grid>
                </Box>
            </Box>
        </LoadScript>
    );
};

export default ShipmentDetail; 