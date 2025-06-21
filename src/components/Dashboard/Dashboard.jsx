import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense, useRef, forwardRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Box,
    CircularProgress,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
    TextField,
    InputAdornment,
    Dialog,
    Slide,
    AppBar,
    Toolbar,
    Typography,
    LinearProgress,
    Fade,
    Button,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Stack,
    Card,
    CardContent,
    CardActions,
    Grid,
    Tooltip,
    Avatar,
    Menu,
    MenuItem,
    Divider,
    Collapse,
    Paper
} from '@mui/material';
import {
    Menu as MenuIcon,
    Search as SearchIcon,
    Assessment as AssessmentIcon,
    People as PeopleIcon,
    LocalShipping as LocalShippingIcon,
    Settings as SettingsIcon,
    Notifications as NotificationsIcon,
    AccountCircle as AccountCircleIcon,
    Business as BusinessIcon,
    Logout as LogoutIcon,
    Fullscreen as FullscreenIcon,
    Close as CloseIcon,
    QrCodeScanner as BarcodeIcon,
    Add as AddIcon,
    ContactMail as ContactMailIcon,
    FlightTakeoff as TrackingIcon,
    ArrowBack as ArrowBackIcon,
    RocketLaunch as RocketLaunchIcon,
    Calculate as CalculateIcon,
    ExpandLess,
    ExpandMore,
    AccountBalanceWallet as AccountBalanceWalletIcon,
    AdminPanelSettings as AdminPanelSettingsIcon,
    LocationOn as LocationOnIcon,
    SwapHoriz as SwapHorizIcon,
    Route as RouteIcon,
    TrendingUp as TrendingUpIcon,
    Map as MapIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { Timestamp } from 'firebase/firestore';
import { collection, query, orderBy, limit, onSnapshot, where, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { ShipmentFormProvider } from '../../contexts/ShipmentFormContext';
import { motion as framerMotion } from 'framer-motion';

// Import responsive CSS
import './Dashboard.css';

// Google Maps components (lazy loaded when needed)
let GoogleMap, DirectionsRenderer, Marker;
const loadGoogleMapsComponents = async () => {
    if (!GoogleMap) {
        const googleMapsApi = await import('@react-google-maps/api');
        GoogleMap = googleMapsApi.GoogleMap;
        DirectionsRenderer = googleMapsApi.DirectionsRenderer;
        Marker = googleMapsApi.Marker;
    }
    return { GoogleMap, DirectionsRenderer, Marker };
};

// Lazy load the Globe component to prevent it from loading on other pages
const ShipmentGlobe = lazy(() => import('../Globe/Globe'));

// Lazy load the LogisticsCommandCenter component
const LogisticsCommandCenter = lazy(() => import('./LogisticsCommandCenter'));

// Lazy load the AdvancedLogisticsMap component  
const AdvancedLogisticsMap = lazy(() => import('./AdvancedLogisticsMap'));

// Lazy load the Tracking component for the drawer
const TrackingDrawerContent = lazy(() => import('../Tracking/Tracking'));

// Lazy load the Shipments component for the modal
const ShipmentsComponent = lazy(() => import('../Shipments/ShipmentsX'));

// Lazy load the CreateShipment component for the modal (step-by-step process)
const CreateShipmentComponent = lazy(() => import('../CreateShipment'));

// Lazy load the CreateShipmentX component for the modal (advanced single-page)
const CreateShipmentXComponent = lazy(() => import('../CreateShipment/CreateShipmentX'));

// Lazy load the QuickShip component for the modal
const QuickShipComponent = lazy(() => import('../CreateShipment/QuickShip'));

// Lazy load the Customers component for the modal
const CustomersComponent = lazy(() => import('../Customers/Customers'));

// Lazy load the Carriers component for the modal
const CarriersComponent = lazy(() => import('../Carriers/Carriers'));

// Lazy load the Reports component for the modal
const ReportsComponent = lazy(() => import('../Reports/Reports'));

// Lazy load the NotificationPreferences component for the modal
const NotificationPreferencesComponent = lazy(() => import('../NotificationPreferences/NotificationPreferences'));

// Lazy load the Profile component for the modal
const ProfileComponent = lazy(() => import('../Profile/Profile'));

// Lazy load the Company component for the modal
const CompanyComponent = lazy(() => import('../Company/Company'));

// Lazy load the AddressBook component for the modal
const AddressBookComponent = lazy(() => import('../AddressBook/AddressBook'));

// Lazy load the Billing component for the modal
const BillingComponent = lazy(() => import('../Billing/Billing'));

// Import ShipmentAgent for the main dashboard overlay
const ShipmentAgent = lazy(() => import('../ShipmentAgent/ShipmentAgent'));

// Route View Badge Component
const RouteViewBadge = ({ shipments, onRouteClick }) => {
    const [selectedRoute, setSelectedRoute] = useState(0);
    const [useMetric, setUseMetric] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [mapDirections, setMapDirections] = useState(null);
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [mapsApiKey, setMapsApiKey] = useState(null);

    // Get recent shipments with valid routes
    const routeShipments = useMemo(() => {
        const validShipments = shipments
            .filter(shipment => {
                try {
                    return shipment &&
                        shipment.shipFrom &&
                        shipment.shipTo &&
                        shipment.status !== 'delivered' &&
                        shipment.status !== 'cancelled';
                } catch (error) {
                    console.warn('Error filtering shipment:', error, shipment);
                    return false;
                }
            })
            .slice(0, 5); // Show max 5 recent routes

        // Debug carrier data structure
        validShipments.forEach((shipment, index) => {
            console.log(`RouteViewBadge Shipment ${index}:`, {
                id: shipment.id,
                carrier: shipment.carrier,
                carrierType: typeof shipment.carrier,
                hasCarrier: !!shipment.carrier
            });
        });

        return validShipments;
    }, [shipments]);

    // Initialize Google Maps
    useEffect(() => {
        const initializeMaps = async () => {
            try {
                if (window.google && window.google.maps) {
                    setIsGoogleMapsLoaded(true);

                    // Fetch API key from Firestore for Routes API
                    const keysRef = collection(db, 'keys');
                    const keysSnapshot = await getDocs(keysRef);

                    if (!keysSnapshot.empty) {
                        const firstDoc = keysSnapshot.docs[0];
                        const key = firstDoc.data().googleAPI;
                        if (key) {
                            setMapsApiKey(key);
                        }
                    }
                    return;
                }

                // Check periodically if Google Maps is loaded (from Globe component)
                const checkMaps = setInterval(async () => {
                    if (window.google && window.google.maps) {
                        setIsGoogleMapsLoaded(true);

                        // Fetch API key when maps become available
                        try {
                            const keysRef = collection(db, 'keys');
                            const keysSnapshot = await getDocs(keysRef);

                            if (!keysSnapshot.empty) {
                                const firstDoc = keysSnapshot.docs[0];
                                const key = firstDoc.data().googleAPI;
                                if (key) {
                                    setMapsApiKey(key);
                                }
                            }
                        } catch (error) {
                            console.error('Error fetching API key:', error);
                        }

                        clearInterval(checkMaps);
                    }
                }, 1000);

                // Clean up after 10 seconds if not loaded
                setTimeout(() => clearInterval(checkMaps), 10000);
            } catch (error) {
                console.error('Error initializing Maps:', error);
                setMapError('Failed to load Google Maps API key');
            }
        };

        initializeMaps();
    }, []);

    // Get carrier logo URL
    const getCarrierLogo = useCallback((shipment) => {
        if (!shipment || !shipment.carrier) return null;

        // Handle both string and object carrier data
        let carrierName = '';
        if (typeof shipment.carrier === 'string') {
            carrierName = shipment.carrier.toLowerCase();
        } else if (typeof shipment.carrier === 'object' && shipment.carrier.name) {
            carrierName = shipment.carrier.name.toLowerCase();
        } else if (typeof shipment.carrier === 'object' && shipment.carrier.carrierName) {
            carrierName = shipment.carrier.carrierName.toLowerCase();
        } else {
            return null;
        }

        const logoMap = {
            'eshipplus': '/images/carrier-badges/eshipplus.png',
            'canpar': '/images/carrier-badges/canpar.png',
            'fedex': '/images/carrier-badges/fedex.png',
            'ups': '/images/carrier-badges/ups.png',
            'purolator': '/images/carrier-badges/purolator.png',
            'dhl': '/images/carrier-badges/dhl.png',
            'tnt': '/images/carrier-badges/tnt.png',
            'polaris': '/images/carrier-badges/polaris.png',
            'polaris transportation': '/images/carrier-badges/polaris.png'
        };

        return logoMap[carrierName] || null;
    }, []);

    // Calculate route directions using modern Routes API v2 (same as ShipmentDetailX)
    const calculateRouteDirections = useCallback(async (shipment) => {
        if (!isGoogleMapsLoaded || !shipment?.shipFrom || !shipment?.shipTo || !mapsApiKey) {
            return null;
        }

        try {
            setMapError(null);

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

                    geocoder.geocode({
                        address: formattedAddress,
                        region: address.country?.toLowerCase() || 'us'
                    }, (results, status) => {
                        if (status === 'OK' && results && results.length > 0) {
                            resolve(results[0]);
                        } else {
                            reject(new Error(`Geocoding failed for ${type}: ${status}`));
                        }
                    });
                });
            };

            const [originResult, destinationResult] = await Promise.all([
                geocodeAddress(shipment.shipFrom, 'origin'),
                geocodeAddress(shipment.shipTo, 'destination')
            ]);

            // Prepare the request body for Routes API v2
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
                    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Route calculation failed: ${errorData.error?.message || response.statusText}`);
            }

            const routeData = await response.json();

            if (!routeData.routes || routeData.routes.length === 0) {
                throw new Error('No routes found');
            }

            const route = routeData.routes[0];
            if (!route.polyline || !route.polyline.encodedPolyline) {
                throw new Error('Route polyline data is missing');
            }

            const decodedPath = window.google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
            const durationInSeconds = parseInt(route.duration);
            const durationInMinutes = Math.round(durationInSeconds / 60);

            // Create bounds for the route
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend(originResult.geometry.location);
            bounds.extend(destinationResult.geometry.location);

            // Extend bounds to include the entire route path
            decodedPath.forEach(point => {
                bounds.extend(point);
            });

            // Create a properly structured directions object that matches DirectionsService format
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
                    bounds: bounds,
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

            return directionsResult;
        } catch (error) {
            console.error('Error calculating directions:', error);
            setMapError('Error calculating route: ' + error.message);
            return null;
        }
    }, [isGoogleMapsLoaded, useMetric, mapsApiKey]);

    // Load directions when route changes or map is shown
    useEffect(() => {
        if (showMap && routeShipments[selectedRoute] && mapsApiKey) {
            console.log('RouteViewBadge: Loading directions for shipment:', routeShipments[selectedRoute].shipmentId);
            calculateRouteDirections(routeShipments[selectedRoute]).then((directions) => {
                console.log('RouteViewBadge: Directions calculated:', directions);
                setMapDirections(directions);
            });
        } else {
            console.log('RouteViewBadge: Not loading directions:', {
                showMap,
                hasShipment: !!routeShipments[selectedRoute],
                hasMapsApiKey: !!mapsApiKey
            });
        }
    }, [showMap, selectedRoute, routeShipments, calculateRouteDirections, mapsApiKey]);

    // Calculate route distance (simplified estimation)
    const calculateDistance = useCallback((shipFrom, shipTo) => {
        if (!shipFrom || !shipTo) return null;

        // Simple distance calculation using coordinates if available
        // This is a rough estimation - in production you'd use Google Maps API
        const R = 6371; // Earth's radius in km

        // For demo purposes, create rough coordinates based on postal codes/cities
        const getCoordinates = (address) => {
            // This is a simplified approach - in real implementation you'd geocode
            const city = address.city?.toLowerCase() || '';
            const state = address.state?.toLowerCase() || '';

            // Sample coordinates for common cities (you'd expand this or use geocoding)
            const cityCoords = {
                'toronto': { lat: 43.6532, lng: -79.3832 },
                'vancouver': { lat: 49.2827, lng: -123.1207 },
                'montreal': { lat: 45.5017, lng: -73.5673 },
                'calgary': { lat: 51.0447, lng: -114.0719 },
                'ottawa': { lat: 45.4215, lng: -75.6972 },
                'new york': { lat: 40.7128, lng: -74.0060 },
                'los angeles': { lat: 34.0522, lng: -118.2437 },
                'chicago': { lat: 41.8781, lng: -87.6298 },
                'houston': { lat: 29.7604, lng: -95.3698 },
                'miami': { lat: 25.7617, lng: -80.1918 }
            };

            return cityCoords[city] || cityCoords[`${city}, ${state}`] || { lat: 43.6532, lng: -79.3832 };
        };

        const coord1 = getCoordinates(shipFrom);
        const coord2 = getCoordinates(shipTo);

        const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
        const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return useMetric ? `${Math.round(distance)} km` : `${Math.round(distance * 0.621371)} mi`;
    }, [useMetric]);

    // Format address for display
    const formatShortAddress = (address) => {
        if (!address) return 'Unknown';
        return `${address.city || 'Unknown'}, ${address.state || address.country || ''}`.trim().replace(/,$/, '');
    };

    // Get carrier name for display
    const getCarrierName = useCallback((shipment) => {
        if (!shipment || !shipment.carrier) return 'Unknown Carrier';

        if (typeof shipment.carrier === 'string') {
            return shipment.carrier;
        } else if (typeof shipment.carrier === 'object') {
            return shipment.carrier.name || shipment.carrier.carrierName || 'Unknown Carrier';
        }

        return 'Unknown Carrier';
    }, []);

    if (routeShipments.length === 0) {
        return null;
    }

    const currentShipment = routeShipments[selectedRoute];

    // Safe distance calculation with error handling
    let distance = null;
    try {
        distance = calculateDistance(currentShipment?.shipFrom, currentShipment?.shipTo);
    } catch (error) {
        console.warn('Error calculating distance:', error);
    }

    // Error boundary for the component
    try {
        return (
            <Box sx={{
                position: 'absolute',
                top: { xs: 80, sm: 90, md: 100 },
                left: { xs: '220px', sm: '240px', md: '260px' },
                right: 16,
                zIndex: 8,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none'
            }}>
                <Card sx={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '20px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    maxWidth: '600px',
                    width: '100%',
                    pointerEvents: 'auto',
                    overflow: 'hidden'
                }}>
                    <CardContent sx={{ p: 2 }}>
                        {/* Header */}
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mb: 2
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <RouteIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
                                <Typography variant="subtitle2" sx={{
                                    fontWeight: 600,
                                    color: '#333',
                                    fontSize: '0.85rem'
                                }}>
                                    Active Routes ({routeShipments.length})
                                </Typography>
                            </Box>

                            {/* Route Navigation */}
                            {routeShipments.length > 1 && (
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    {routeShipments.map((_, index) => (
                                        <Box
                                            key={index}
                                            onClick={() => setSelectedRoute(index)}
                                            sx={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                backgroundColor: index === selectedRoute ? '#4CAF50' : 'rgba(0,0,0,0.2)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                '&:hover': {
                                                    backgroundColor: index === selectedRoute ? '#4CAF50' : 'rgba(0,0,0,0.4)'
                                                }
                                            }}
                                        />
                                    ))}
                                </Box>
                            )}
                        </Box>

                        {/* Route Information */}
                        {currentShipment && (
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                p: 1.5,
                                background: 'rgba(76, 175, 80, 0.05)',
                                borderRadius: '12px',
                                border: '1px solid rgba(76, 175, 80, 0.1)'
                            }}>
                                {/* Carrier Logo */}
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    minWidth: '40px',
                                    height: '40px'
                                }}>
                                    {getCarrierLogo(currentShipment) ? (
                                        <img
                                            src={getCarrierLogo(currentShipment)}
                                            alt={getCarrierName(currentShipment)}
                                            style={{
                                                width: '36px',
                                                height: '36px',
                                                objectFit: 'contain',
                                                borderRadius: '6px',
                                                backgroundColor: 'white',
                                                padding: '4px',
                                                border: '1px solid rgba(0,0,0,0.1)'
                                            }}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <Box sx={{
                                            width: '36px',
                                            height: '36px',
                                            backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid rgba(76, 175, 80, 0.2)'
                                        }}>
                                            <LocalShippingIcon sx={{
                                                color: '#4CAF50',
                                                fontSize: 20
                                            }} />
                                        </Box>
                                    )}
                                </Box>

                                {/* Origin */}
                                <Box sx={{ flex: 1, textAlign: 'left' }}>
                                    <Typography variant="caption" sx={{
                                        color: 'rgba(0,0,0,0.6)',
                                        fontSize: '0.7rem',
                                        fontWeight: 500,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        From
                                    </Typography>
                                    <Typography variant="body2" sx={{
                                        fontWeight: 600,
                                        color: '#333',
                                        fontSize: '0.8rem',
                                        lineHeight: 1.2
                                    }}>
                                        {formatShortAddress(currentShipment.shipFrom)}
                                    </Typography>
                                </Box>

                                {/* Route Arrow with Distance */}
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    minWidth: '80px'
                                }}>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5
                                    }}>
                                        <Box sx={{
                                            width: '20px',
                                            height: '2px',
                                            background: 'linear-gradient(90deg, #4CAF50, #66BB6A)',
                                            borderRadius: '1px'
                                        }} />
                                        <LocationOnIcon sx={{
                                            color: '#4CAF50',
                                            fontSize: 16,
                                            transform: 'rotate(90deg)'
                                        }} />
                                        <Box sx={{
                                            width: '20px',
                                            height: '2px',
                                            background: 'linear-gradient(90deg, #66BB6A, #4CAF50)',
                                            borderRadius: '1px'
                                        }} />
                                    </Box>
                                    {distance && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography variant="caption" sx={{
                                                color: '#4CAF50',
                                                fontWeight: 600,
                                                fontSize: '0.7rem'
                                            }}>
                                                {distance}
                                            </Typography>
                                            <IconButton
                                                size="small"
                                                onClick={() => setUseMetric(!useMetric)}
                                                sx={{
                                                    p: 0.25,
                                                    color: '#4CAF50',
                                                    '&:hover': { backgroundColor: 'rgba(76, 175, 80, 0.1)' }
                                                }}
                                            >
                                                <SwapHorizIcon sx={{ fontSize: 12 }} />
                                            </IconButton>
                                        </Box>
                                    )}
                                </Box>

                                {/* Destination */}
                                <Box sx={{ flex: 1, textAlign: 'right' }}>
                                    <Typography variant="caption" sx={{
                                        color: 'rgba(0,0,0,0.6)',
                                        fontSize: '0.7rem',
                                        fontWeight: 500,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        To
                                    </Typography>
                                    <Typography variant="body2" sx={{
                                        fontWeight: 600,
                                        color: '#333',
                                        fontSize: '0.8rem',
                                        lineHeight: 1.2
                                    }}>
                                        {formatShortAddress(currentShipment.shipTo)}
                                    </Typography>
                                </Box>
                            </Box>
                        )}

                        {/* Google Maps Route */}
                        <Collapse in={showMap} timeout={300}>
                            <Box sx={{ mt: 2 }}>
                                {mapError ? (
                                    <Box sx={{
                                        height: '200px',
                                        borderRadius: '12px',
                                        backgroundColor: 'rgba(244, 67, 54, 0.05)',
                                        border: '1px solid rgba(244, 67, 54, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'column',
                                        gap: 1
                                    }}>
                                        <MapIcon sx={{ color: '#f44336', fontSize: 32 }} />
                                        <Typography variant="body2" sx={{
                                            color: '#f44336',
                                            fontSize: '0.8rem',
                                            textAlign: 'center'
                                        }}>
                                            {mapError}
                                        </Typography>
                                    </Box>
                                ) : !isGoogleMapsLoaded ? (
                                    <Box sx={{
                                        height: '200px',
                                        borderRadius: '12px',
                                        backgroundColor: 'rgba(0,0,0,0.02)',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 2
                                    }}>
                                        <CircularProgress size={24} sx={{ color: '#4CAF50' }} />
                                        <Typography variant="body2" sx={{
                                            color: 'rgba(0,0,0,0.6)',
                                            fontSize: '0.8rem'
                                        }}>
                                            Loading Google Maps...
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Box sx={{
                                        height: '200px',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        border: '1px solid rgba(0,0,0,0.1)'
                                    }}>
                                        <GoogleMapComponent
                                            directions={mapDirections}
                                            shipment={currentShipment}
                                        />
                                    </Box>
                                )}
                            </Box>
                        </Collapse>

                        {/* Shipment Details */}
                        {currentShipment && (
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                mt: 1.5,
                                pt: 1.5,
                                borderTop: '1px solid rgba(0,0,0,0.08)'
                            }}>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Chip
                                        label={currentShipment.shipmentId}
                                        size="small"
                                        sx={{
                                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                                            color: '#1976D2',
                                            fontWeight: 500,
                                            fontSize: '0.7rem',
                                            height: '24px'
                                        }}
                                    />
                                    <Chip
                                        label={currentShipment.status?.replace(/_/g, ' ').toUpperCase()}
                                        size="small"
                                        sx={{
                                            backgroundColor: currentShipment.status === 'in_transit'
                                                ? 'rgba(255, 193, 7, 0.1)'
                                                : 'rgba(76, 175, 80, 0.1)',
                                            color: currentShipment.status === 'in_transit'
                                                ? '#F57C00'
                                                : '#4CAF50',
                                            fontWeight: 500,
                                            fontSize: '0.7rem',
                                            height: '24px'
                                        }}
                                    />
                                </Box>

                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        size="small"
                                        onClick={() => setShowMap(!showMap)}
                                        startIcon={showMap ? <ExpandLessIcon /> : <MapIcon />}
                                        sx={{
                                            minWidth: 'auto',
                                            px: 1.5,
                                            py: 0.5,
                                            fontSize: '0.7rem',
                                            fontWeight: 500,
                                            borderRadius: '8px',
                                            textTransform: 'none',
                                            color: showMap ? '#1976D2' : '#4CAF50',
                                            backgroundColor: showMap ? 'rgba(25, 118, 210, 0.08)' : 'rgba(76, 175, 80, 0.08)',
                                            '&:hover': {
                                                backgroundColor: showMap ? 'rgba(25, 118, 210, 0.15)' : 'rgba(76, 175, 80, 0.15)'
                                            }
                                        }}
                                    >
                                        {showMap ? 'Hide Map' : 'Show Map'}
                                    </Button>

                                    <Button
                                        size="small"
                                        onClick={() => onRouteClick && onRouteClick(currentShipment)}
                                        sx={{
                                            minWidth: 'auto',
                                            px: 1.5,
                                            py: 0.5,
                                            fontSize: '0.7rem',
                                            fontWeight: 500,
                                            borderRadius: '8px',
                                            textTransform: 'none',
                                            color: '#4CAF50',
                                            backgroundColor: 'rgba(76, 175, 80, 0.08)',
                                            '&:hover': {
                                                backgroundColor: 'rgba(76, 175, 80, 0.15)'
                                            }
                                        }}
                                    >
                                        View Details
                                    </Button>
                                </Box>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            </Box>
        );
    } catch (error) {
        console.error('Error rendering RouteViewBadge:', error);
        return (
            <Box sx={{
                position: 'absolute',
                top: { xs: 80, sm: 90, md: 100 },
                left: { xs: '220px', sm: '240px', md: '260px' },
                right: 16,
                zIndex: 8,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none'
            }}>
                <Card sx={{
                    background: 'rgba(244, 67, 54, 0.95)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '20px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgba(244, 67, 54, 0.2)',
                    maxWidth: '400px',
                    width: '100%',
                    pointerEvents: 'auto'
                }}>
                    <CardContent sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: 'white', fontSize: '0.8rem' }}>
                            Route information temporarily unavailable
                        </Typography>
                    </CardContent>
                </Card>
            </Box>
        );
    }
};

// Google Map Component for Route Display
const GoogleMapComponent = ({ directions, shipment }) => {
    const [map, setMap] = useState(null);
    const [GoogleMap, setGoogleMap] = useState(null);
    const [DirectionsRenderer, setDirectionsRenderer] = useState(null);

    // Load Google Maps components
    useEffect(() => {
        const loadComponents = async () => {
            try {
                const components = await loadGoogleMapsComponents();
                setGoogleMap(() => components.GoogleMap);
                setDirectionsRenderer(() => components.DirectionsRenderer);
            } catch (error) {
                console.error('Error loading Google Maps components:', error);
            }
        };

        loadComponents();
    }, []);

    const mapOptions = {
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        styles: [
            {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#e9e9e9' }, { lightness: 17 }]
            },
            {
                featureType: 'landscape',
                elementType: 'geometry',
                stylers: [{ color: '#f5f5f5' }, { lightness: 20 }]
            }
        ]
    };

    // Calculate map center from directions
    const mapCenter = useMemo(() => {
        if (directions?.routes?.[0]?.bounds) {
            return directions.routes[0].bounds.getCenter();
        }
        if (directions?.routes?.[0]?.legs?.[0]) {
            const leg = directions.routes[0].legs[0];
            const startLat = leg.start_location.lat();
            const startLng = leg.start_location.lng();
            const endLat = leg.end_location.lat();
            const endLng = leg.end_location.lng();

            return {
                lat: (startLat + endLat) / 2,
                lng: (startLng + endLng) / 2
            };
        }
        return { lat: 43.6532, lng: -79.3832 };
    }, [directions]);

    // Handle map load and fit bounds
    const handleMapLoadWithBounds = useCallback((mapInstance) => {
        setMap(mapInstance);

        // Fit bounds to show the entire route
        if (directions?.routes?.[0]?.bounds) {
            const bounds = directions.routes[0].bounds;
            mapInstance.fitBounds(bounds, { padding: 20 });
        }
    }, [directions]);

    const handleMapLoad = useCallback((mapInstance) => {
        setMap(mapInstance);
    }, []);

    if (!GoogleMap || !DirectionsRenderer) {
        return (
            <Box sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f5f5f5'
            }}>
                <CircularProgress size={24} sx={{ color: '#4CAF50' }} />
            </Box>
        );
    }

    return (
        <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={mapCenter}
            zoom={6}
            onLoad={handleMapLoadWithBounds}
            options={mapOptions}
        >
            {directions && directions.routes && directions.routes.length > 0 && (
                <DirectionsRenderer
                    directions={directions}
                    options={{
                        suppressMarkers: false,
                        preserveViewport: true, // Changed to true to prevent auto-zooming
                        polylineOptions: {
                            strokeColor: '#4CAF50',
                            strokeWeight: 4,
                            strokeOpacity: 0.8,
                            geodesic: true
                        },
                        markerOptions: {
                            icon: {
                                path: window.google?.maps?.SymbolPath?.CIRCLE,
                                scale: 8,
                                fillColor: '#4CAF50',
                                fillOpacity: 1,
                                strokeColor: '#ffffff',
                                strokeWeight: 2
                            }
                        }
                    }}
                />
            )}
        </GoogleMap>
    );
};

// Dashboard Stats Overlay Component
const DashboardStatsOverlay = ({ shipments }) => {
    const stats = useMemo(() => {
        const activeShipments = shipments.filter(s =>
            s.status !== 'delivered' &&
            s.status !== 'cancelled' &&
            s.status !== 'draft'
        );

        const inTransit = shipments.filter(s => s.status === 'in_transit').length;
        const delivered = shipments.filter(s => s.status === 'delivered').length;
        const pending = shipments.filter(s => s.status === 'pending').length;

        return {
            total: shipments.length,
            active: activeShipments.length,
            inTransit,
            delivered,
            pending
        };
    }, [shipments]);

    return (
        <Box sx={{
            position: 'absolute',
            top: { xs: 80, sm: 90, md: 100 },
            left: { xs: '240px', sm: '260px', md: '280px' },
            zIndex: 8,
            display: 'flex',
            gap: 2,
            pointerEvents: 'none'
        }}>
            {/* Stats Cards */}
            <Card sx={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                pointerEvents: 'auto'
            }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#4CAF50' }}>
                                {stats.active}
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>
                                Active
                            </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#2196F3' }}>
                                {stats.inTransit}
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>
                                In Transit
                            </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#FF9800' }}>
                                {stats.pending}
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>
                                Pending
                            </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#9C27B0' }}>
                                {stats.delivered}
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>
                                Delivered
                            </Typography>
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};

// Google Maps Dashboard Component - Main background map with routes and shipments
const GoogleMapsDashboard = ({ shipments, onShipmentClick, onTrackingClick }) => {
    const [map, setMap] = useState(null);
    const [GoogleMap, setGoogleMap] = useState(null);
    const [DirectionsRenderer, setDirectionsRenderer] = useState(null);
    const [Marker, setMarker] = useState(null);
    const [InfoWindow, setInfoWindow] = useState(null);
    const [mapsApiKey, setMapsApiKey] = useState(null);
    const [allDirections, setAllDirections] = useState([]);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [infoWindowOpen, setInfoWindowOpen] = useState(false);
    const [mapCenter, setMapCenter] = useState({ lat: 43.6532, lng: -79.3832 }); // Default to Toronto
    const [mapZoom, setMapZoom] = useState(6);

    // Load Google Maps components and API for Command Center
    useEffect(() => {
        const loadMapsAndComponents = async () => {
            try {
                if (!mapsApiKey) {
                    console.log('Dashboard: Waiting for API key...');
                    return;
                }

                // Check if Google Maps is already loaded
                if (window.google && window.google.maps) {
                    console.log('Dashboard: Google Maps already loaded globally');
                } else {
                    console.log('Dashboard: Loading Google Maps API for Command Center...');

                    // Load Google Maps API script
                    const script = document.createElement('script');
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places,geometry,routes`;
                    script.async = true;
                    script.defer = true;

                    // Wait for the script to load
                    await new Promise((resolve, reject) => {
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });

                    console.log('Dashboard: Google Maps API loaded successfully');
                }

                // Import React Google Maps components
                const googleMapsApi = await import('@react-google-maps/api');
                setGoogleMap(() => googleMapsApi.GoogleMap);
                setDirectionsRenderer(() => googleMapsApi.DirectionsRenderer);
                setMarker(() => googleMapsApi.Marker);
                setInfoWindow(() => googleMapsApi.InfoWindow);

                console.log('Dashboard: React Google Maps components loaded');
            } catch (error) {
                console.error('Dashboard: Error loading Maps API or components:', error);
            }
        };

        loadMapsAndComponents();
    }, [mapsApiKey]);

    // Fetch Maps API key from keys collection (same as ShipmentDetailX)
    useEffect(() => {
        const fetchApiKey = async () => {
            try {
                const keysRef = collection(db, 'keys');
                const keysSnapshot = await getDocs(keysRef);

                if (!keysSnapshot.empty) {
                    const firstDoc = keysSnapshot.docs[0];
                    const key = firstDoc.data().googleAPI;
                    if (key) {
                        setMapsApiKey(key);
                        console.log('GoogleMapsDashboard: API key loaded successfully');
                    } else {
                        console.warn('GoogleMapsDashboard: No API key found in keys collection');
                    }
                } else {
                    console.warn('GoogleMapsDashboard: No keys document found');
                }
            } catch (error) {
                console.error('GoogleMapsDashboard: Error fetching Maps API key:', error);
            }
        };

        fetchApiKey();
    }, []);

    // Get active shipments for route display
    const activeShipments = useMemo(() => {
        return shipments
            .filter(shipment =>
                shipment &&
                shipment.shipFrom &&
                shipment.shipTo &&
                shipment.status !== 'delivered' &&
                shipment.status !== 'cancelled' &&
                shipment.status !== 'draft'
            )
            .slice(0, 10); // Limit to 10 routes for performance
    }, [shipments]);

    // Calculate routes for active shipments using Routes API v2 (modern API)
    const calculateAllRoutes = useCallback(async () => {
        if (!mapsApiKey || !window.google || activeShipments.length === 0) {
            return;
        }

        console.log('GoogleMapsDashboard: Calculating routes for', activeShipments.length, 'shipments');

        const routePromises = activeShipments.slice(0, 5).map(async (shipment, index) => {
            try {
                // Add delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, index * 300));

                const formatAddress = (address) => {
                    const components = [];
                    if (address.street) components.push(address.street);
                    if (address.city) components.push(address.city);
                    if (address.state) components.push(address.state);
                    if (address.postalCode) components.push(address.postalCode);
                    if (address.country) components.push(address.country);
                    return components.join(', ');
                };

                const originAddress = formatAddress(shipment.shipFrom);
                const destinationAddress = formatAddress(shipment.shipTo);

                const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': mapsApiKey,
                        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.legs.duration,routes.legs.distanceMeters,routes.legs.startLocation,routes.legs.endLocation'
                    },
                    body: JSON.stringify({
                        origin: { address: originAddress },
                        destination: { address: destinationAddress },
                        travelMode: "DRIVE",
                        routingPreference: "TRAFFIC_UNAWARE",
                        computeAlternativeRoutes: false,
                        languageCode: "en-US",
                        units: "IMPERIAL"
                    })
                });

                if (!response.ok) {
                    throw new Error(`Routes API error: ${response.status} - ${response.statusText}`);
                }

                const data = await response.json();

                if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];

                    // Decode polyline
                    const decodedPath = window.google.maps.geometry.encoding.decodePath(
                        route.polyline.encodedPolyline
                    );

                    // Create directions object compatible with DirectionsRenderer
                    const startLocation = new window.google.maps.LatLng(
                        route.legs[0].startLocation.latLng.latitude,
                        route.legs[0].startLocation.latLng.longitude
                    );
                    const endLocation = new window.google.maps.LatLng(
                        route.legs[0].endLocation.latLng.latitude,
                        route.legs[0].endLocation.latLng.longitude
                    );

                    // Create bounds from the route
                    const bounds = new window.google.maps.LatLngBounds();
                    bounds.extend(startLocation);
                    bounds.extend(endLocation);
                    decodedPath.forEach(point => bounds.extend(point));

                    const directions = {
                        routes: [{
                            legs: [{
                                start_location: startLocation,
                                end_location: endLocation,
                                distance: {
                                    text: `${Math.round(route.distanceMeters / 1609.34)} mi`,
                                    value: route.distanceMeters
                                },
                                duration: {
                                    text: `${Math.round(parseInt(route.duration.replace('s', '')) / 60)} mins`,
                                    value: parseInt(route.duration.replace('s', ''))
                                },
                                steps: [{
                                    distance: {
                                        text: `${Math.round(route.distanceMeters / 1609.34)} mi`,
                                        value: route.distanceMeters
                                    },
                                    duration: {
                                        text: `${Math.round(parseInt(route.duration.replace('s', '')) / 60)} mins`,
                                        value: parseInt(route.duration.replace('s', ''))
                                    },
                                    start_location: startLocation,
                                    end_location: endLocation,
                                    instructions: "Follow the route",
                                    path: decodedPath,
                                    travel_mode: "DRIVING"
                                }]
                            }],
                            overview_path: decodedPath,
                            bounds: bounds,
                            overview_polyline: {
                                points: route.polyline.encodedPolyline
                            },
                            copyrights: "© Google Maps",
                            warnings: [],
                            waypoint_order: []
                        }],
                        request: {
                            origin: startLocation,
                            destination: endLocation,
                            travelMode: "DRIVING"
                        },
                        status: "OK",
                        geocoded_waypoints: [
                            { status: "OK" },
                            { status: "OK" }
                        ]
                    };

                    console.log('GoogleMapsDashboard: Route calculated for shipment:', shipment.shipmentId);
                    return {
                        shipment,
                        directions,
                        color: getRouteColor(index)
                    };
                }
            } catch (error) {
                console.warn('Failed to calculate route for shipment:', shipment.shipmentId, error);
                return null;
            }
        });

        const results = await Promise.all(routePromises);
        const validRoutes = results.filter(Boolean);

        console.log('GoogleMapsDashboard: Calculated', validRoutes.length, 'valid routes');
        setAllDirections(validRoutes);

        // Auto-fit map to show all routes
        if (validRoutes.length > 0 && map) {
            const bounds = new window.google.maps.LatLngBounds();
            validRoutes.forEach(({ directions }) => {
                if (directions.routes && directions.routes[0] && directions.routes[0].overview_path) {
                    directions.routes[0].overview_path.forEach(point => {
                        bounds.extend(point);
                    });
                }
            });
            map.fitBounds(bounds, { padding: 50 });
        }
    }, [mapsApiKey, activeShipments, map]);

    // Get route color based on index
    const getRouteColor = (index) => {
        const colors = [
            '#4CAF50', // Green
            '#2196F3', // Blue  
            '#FF9800', // Orange
            '#9C27B0', // Purple
            '#F44336', // Red
            '#00BCD4', // Cyan
            '#FFEB3B', // Yellow
            '#795548', // Brown
            '#607D8B', // Blue Grey
            '#E91E63'  // Pink
        ];
        return colors[index % colors.length];
    };

    // Calculate routes when shipments change
    useEffect(() => {
        if (mapsApiKey && window.google?.maps?.geometry && activeShipments.length > 0) {
            calculateAllRoutes();
        }
    }, [calculateAllRoutes]);

    // Handle map load
    const handleMapLoad = useCallback((mapInstance) => {
        setMap(mapInstance);
        console.log('GoogleMapsDashboard: Map loaded');
    }, []);

    // Handle marker click
    const handleMarkerClick = useCallback((shipment, position) => {
        setSelectedShipment(shipment);
        setInfoWindowOpen(true);
        if (onShipmentClick) {
            onShipmentClick(shipment);
        }
    }, [onShipmentClick]);

    const mapOptions = {
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
        styles: [
            {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#e3f2fd' }]
            },
            {
                featureType: 'landscape',
                elementType: 'geometry',
                stylers: [{ color: '#f5f5f5' }]
            },
            {
                featureType: 'road.highway',
                elementType: 'geometry',
                stylers: [{ color: '#ffffff' }]
            },
            {
                featureType: 'road.arterial',
                elementType: 'geometry',
                stylers: [{ color: '#ffffff' }]
            }
        ]
    };

    if (!GoogleMap || !DirectionsRenderer || !Marker || !InfoWindow) {
        return (
            <Box sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f5f5f5',
                flexDirection: 'column',
                gap: 2
            }}>
                <CircularProgress size={40} sx={{ color: '#4CAF50' }} />
                <Typography variant="body2" sx={{ color: '#666' }}>
                    Loading Maps Dashboard...
                </Typography>
            </Box>
        );
    }

    return (
        <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={mapCenter}
            zoom={mapZoom}
            onLoad={handleMapLoad}
            options={mapOptions}
        >
            {/* Render all route directions */}
            {allDirections.map(({ directions, color, shipment }, index) => (
                <DirectionsRenderer
                    key={`route-${shipment.shipmentId || index}`}
                    directions={directions}
                    options={{
                        suppressMarkers: true, // We'll add custom markers
                        preserveViewport: true,
                        polylineOptions: {
                            strokeColor: color,
                            strokeWeight: 4,
                            strokeOpacity: 0.8,
                            geodesic: true
                        }
                    }}
                />
            ))}

            {/* Render markers from actual route data */}
            {allDirections.map(({ directions, color, shipment }, index) => {
                if (!directions?.routes?.[0]?.legs?.[0]) return null;

                const leg = directions.routes[0].legs[0];

                return (
                    <React.Fragment key={`markers-${shipment.shipmentId || index}`}>
                        {/* Origin Marker (A) */}
                        <Marker
                            position={leg.start_location}
                            onClick={() => handleMarkerClick(shipment, leg.start_location)}
                            icon={{
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                    <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
                                        <text x="12" y="16" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="bold">A</text>
                                    </svg>
                                `),
                                scaledSize: new window.google.maps.Size(24, 36),
                                anchor: new window.google.maps.Point(12, 36)
                            }}
                        />

                        {/* Destination Marker (B) */}
                        <Marker
                            position={leg.end_location}
                            onClick={() => handleMarkerClick(shipment, leg.end_location)}
                            icon={{
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                    <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#f44336" stroke="#ffffff" stroke-width="2"/>
                                        <text x="12" y="16" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="bold">B</text>
                                    </svg>
                                `),
                                scaledSize: new window.google.maps.Size(24, 36),
                                anchor: new window.google.maps.Point(12, 36)
                            }}
                        />
                    </React.Fragment>
                );
            })}

            {/* Info Window for selected shipment */}
            {selectedShipment && infoWindowOpen && (
                <InfoWindow
                    position={{ lat: 43.6532, lng: -79.3832 }} // You'd calculate this from shipment
                    onCloseClick={() => setInfoWindowOpen(false)}
                >
                    <Box sx={{ p: 1, minWidth: 200 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            {selectedShipment.shipmentId}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <strong>Status:</strong> {selectedShipment.status}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <strong>Customer:</strong> {selectedShipment.customer}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Carrier:</strong> {(() => {
                                const carrier = selectedShipment.carrier;
                                if (!carrier) return 'N/A';
                                if (typeof carrier === 'string') return carrier;
                                if (typeof carrier === 'object') {
                                    return carrier.name || carrier.carrierName || carrier.id || 'Unknown Carrier';
                                }
                                return 'N/A';
                            })()}
                        </Typography>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={() => onTrackingClick && onTrackingClick(selectedShipment.shipmentId)}
                            sx={{ fontSize: '11px' }}
                        >
                            Track Shipment
                        </Button>
                    </Box>
                </InfoWindow>
            )}
        </GoogleMap>
    );
};

// Transition for the modal
const Transition = forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} timeout={{ enter: 500, exit: 300 }} easing={{ enter: 'cubic-bezier(0.4, 0, 0.2, 1)', exit: 'cubic-bezier(0.4, 0, 1, 1)' }} />;
});

// Enhanced Maps Loading Screen Component
const MapsLoadingScreen = ({ phase = 'initializing' }) => {
    const [progress, setProgress] = useState(0);
    const [currentPhase, setCurrentPhase] = useState(0);

    const loadingPhases = [
        { text: 'Initializing SoluShipX Maps', description: 'Preparing route visualization engine' },
        { text: 'Loading Google Maps', description: 'Connecting to mapping services' },
        { text: 'Fetching Shipment Data', description: 'Retrieving your logistics network' },
        { text: 'Calculating Routes', description: 'Computing optimal pathways' },
        { text: 'Finalizing Dashboard', description: 'Almost ready to explore' }
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((prevProgress) => {
                const newProgress = prevProgress + Math.random() * 20 + 5; // Faster progress

                // Update phase based on progress
                const newPhase = Math.floor((newProgress / 100) * loadingPhases.length);
                setCurrentPhase(Math.min(newPhase, loadingPhases.length - 1));

                return newProgress >= 100 ? 100 : newProgress;
            });
        }, 200); // Faster interval

        return () => clearInterval(timer);
    }, [loadingPhases.length]);

    const currentLoadingPhase = loadingPhases[currentPhase];

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Animated background particles */}
            <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `
                    radial-gradient(circle at 20% 50%, rgba(96, 165, 250, 0.1) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                    radial-gradient(circle at 40% 80%, rgba(34, 197, 94, 0.1) 0%, transparent 50%)
                `,
                animation: 'float 6s ease-in-out infinite'
            }} />

            {/* Main loading content */}
            <Box sx={{ textAlign: 'center', zIndex: 1, maxWidth: '400px', px: 3 }}>
                {/* Progress circle with percentage */}
                <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
                    <CircularProgress
                        variant="determinate"
                        value={progress}
                        size={100}
                        thickness={2}
                        sx={{
                            color: '#60a5fa',
                            filter: 'drop-shadow(0 0 10px rgba(96, 165, 250, 0.6))',
                            '& .MuiCircularProgress-circle': {
                                strokeLinecap: 'round',
                            }
                        }}
                    />
                    <Box sx={{
                        top: 0,
                        left: 0,
                        bottom: 0,
                        right: 0,
                        position: 'absolute',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Typography variant="h6" component="div" sx={{
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '1.2rem'
                        }}>
                            {Math.round(progress)}%
                        </Typography>
                    </Box>
                </Box>

                {/* Current phase text */}
                <Fade in key={currentPhase} timeout={500}>
                    <Box>
                        <Typography variant="h6" sx={{
                            fontSize: '1.3rem',
                            fontWeight: 600,
                            mb: 1,
                            background: 'linear-gradient(45deg, #60a5fa, #8b5cf6)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            {currentLoadingPhase.text}
                        </Typography>
                        <Typography sx={{
                            fontSize: '0.95rem',
                            opacity: 0.8,
                            color: 'rgba(255, 255, 255, 0.7)'
                        }}>
                            {currentLoadingPhase.description}
                        </Typography>
                    </Box>
                </Fade>

                {/* Phase indicators */}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 3 }}>
                    {loadingPhases.map((_, index) => (
                        <Box
                            key={index}
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: index <= currentPhase ? '#60a5fa' : 'rgba(255, 255, 255, 0.2)',
                                transition: 'all 0.3s ease',
                                boxShadow: index <= currentPhase ? '0 0 10px rgba(96, 165, 250, 0.8)' : 'none'
                            }}
                        />
                    ))}
                </Box>
            </Box>

            {/* CSS animations */}
            <style jsx>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    33% { transform: translateY(-10px) rotate(1deg); }
                    66% { transform: translateY(5px) rotate(-1deg); }
                }
                
                @keyframes pulse {
                    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
                    50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.9; }
                }
            `}</style>
        </Box>
    );
};

// Helper function to format Firestore timestamp
const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp.seconds * 1000).toISOString().split('T')[0];
};

// Helper function to format address
const formatAddress = (addressObj) => {
    if (!addressObj) return '';
    const parts = [
        addressObj.street,
        addressObj.street2,
        addressObj.city,
        addressObj.state,
        addressObj.postalCode,
        addressObj.country
    ].filter(Boolean);
    return parts.join(', ');
};

// Add error boundary wrapper for lazy components to handle chunk loading errors
const LazyComponentWrapper = ({ children, fallback = <CircularProgress /> }) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const handleChunkError = (event) => {
            if (event.target.tagName === 'SCRIPT' && event.target.src.includes('chunk')) {
                console.warn('Chunk loading failed, reloading page...');
                window.location.reload();
            }
        };

        window.addEventListener('error', handleChunkError);
        return () => window.removeEventListener('error', handleChunkError);
    }, []);

    if (hasError) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: 2 }}>
                <CircularProgress />
                <Typography>Loading component...</Typography>
            </Box>
        );
    }

    return (
        <Suspense fallback={fallback}>
            {children}
        </Suspense>
    );
};

const Dashboard = () => {
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState({});
    const { companyIdForAddress, companyData, loading: companyLoading, isAdmin, getAdminReturnPath, clearAdminReturnPath } = useCompany();
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, userRole, currentUser } = useAuth();

    // State for new UI elements
    const [isTrackingDrawerOpen, setIsTrackingDrawerOpen] = useState(false);
    const [trackingNumber, setTrackingNumber] = useState('');
    const [isShipmentsModalOpen, setIsShipmentsModalOpen] = useState(false);
    const [isCreateShipmentModalOpen, setIsCreateShipmentModalOpen] = useState(false);
    // const [isCustomersModalOpen, setIsCustomersModalOpen] = useState(false); // Replaced with Billing link
    const [isCarriersModalOpen, setIsCarriersModalOpen] = useState(false);
    const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
    const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [isAddressBookModalOpen, setIsAddressBookModalOpen] = useState(false);
    const [isQuickShipModalOpen, setIsQuickShipModalOpen] = useState(false);
    const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [createShipmentPrePopulatedData, setCreateShipmentPrePopulatedData] = useState(null);

    // Profile menu state
    const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);
    const isProfileMenuOpen = Boolean(profileMenuAnchor);

    // Settings menu state
    const [settingsMenuAnchor, setSettingsMenuAnchor] = useState(null);
    const isSettingsMenuOpen = Boolean(settingsMenuAnchor);

    // User profile data state
    const [userProfileData, setUserProfileData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        photoURL: ''
    });

    // Modal navigation stack for chaining modals (e.g., Customers -> Shipments)
    const [modalStack, setModalStack] = useState([]);
    const [shipmentsDeepLinkParams, setShipmentsDeepLinkParams] = useState(null);
    const [customersDeepLinkParams, setCustomersDeepLinkParams] = useState(null);
    const [viewMode, setViewMode] = useState('command'); // 'maps' or 'command'

    const [isMinLoadingTimePassed, setIsMinLoadingTimePassed] = useState(false);

    const globeRef = useRef(null); // Ref to access Globe's methods

    const [hasError, setHasError] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [newShipmentExpanded, setNewShipmentExpanded] = useState(false);

    useEffect(() => {
        // Ensure the loading screen is visible for at least 3 seconds
        // to allow the animation to complete while feeling fast and zippy.
        const timer = setTimeout(() => {
            setIsMinLoadingTimePassed(true);
        }, 3000);
        return () => clearTimeout(timer);
    }, []);

    const showLoadingScreen = useMemo(() => {
        return companyLoading || loading || !isMinLoadingTimePassed;
    }, [companyLoading, loading, isMinLoadingTimePassed]);

    // Calculate date range for last 30 days
    const thirtyDaysAgo = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return Timestamp.fromDate(date);
    }, []);

    // Fetch customers data
    useEffect(() => {
        if (!companyIdForAddress) return;

        const customersQuery = query(
            collection(db, 'customers'),
            where('companyID', '==', companyIdForAddress)
        );

        const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
            const customersData = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                customersData[data.customerID] = data;
            });
            setCustomers(customersData);
        }, (error) => {
            console.error('Error fetching customers:', error);
        });

        return () => unsubscribeCustomers();
    }, [companyIdForAddress]);

    // Fetch shipments from Firestore for the last 30 days
    useEffect(() => {
        if (!companyIdForAddress || companyLoading) {
            return;
        }

        console.log('Dashboard: Fetching shipments for company:', companyIdForAddress);

        const shipmentsQuery = query(
            collection(db, 'shipments'),
            where('companyID', '==', companyIdForAddress),
            where('createdAt', '>=', thirtyDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(200)
        );

        const unsubscribe = onSnapshot(shipmentsQuery, (snapshot) => {
            console.log('Dashboard: Received shipments snapshot with', snapshot.docs.length, 'documents');

            const shipmentsData = snapshot.docs.map(doc => {
                const data = doc.data();

                // Get customer data
                const customerId = data.shipTo?.customerID || data.customerId || data.customerID;
                const customerData = customers[customerId] || {};

                // Helper function to safely get rate info
                const getRateInfo = () => {
                    if (data.selectedRateRef) {
                        return {
                            carrier: data.selectedRateRef.carrier || data.selectedRateRef.carrierName || '',
                            totalCharges: data.selectedRateRef.totalCharges || 0
                        };
                    }

                    if (data.selectedRate) {
                        return {
                            carrier: data.selectedRate.carrier || data.selectedRate.carrierName || '',
                            totalCharges: data.selectedRate.totalCharges || data.selectedRate.price || 0
                        };
                    }

                    return {
                        carrier: data.carrier || '',
                        totalCharges: 0
                    };
                };

                const rateInfo = getRateInfo();

                return {
                    id: doc.id,
                    shipmentId: data.shipmentID || data.shipmentId || doc.id,
                    shipmentID: data.shipmentID, // Keep original shipmentID field for LogisticsCommandCenter
                    date: formatDate(data.createdAt),
                    createdAt: data.createdAt,
                    customer: customerData.name || data.shipTo?.company || 'Unknown Customer',
                    origin: formatAddress(data.shipFrom),
                    destination: formatAddress(data.shipTo),
                    shipFrom: data.shipFrom,
                    shipTo: data.shipTo,
                    carrier: rateInfo.carrier,
                    shipmentType: data.shipmentInfo?.shipmentType || 'Standard',
                    status: data.status || 'pending',
                    value: rateInfo.totalCharges || data.packages?.[0]?.declaredValue || 0,
                    // Include other original fields that LogisticsCommandCenter might need
                    ...data
                };
            }).filter(shipment => {
                // Exclude draft shipments
                return shipment.status?.toLowerCase() !== 'draft';
            });

            console.log('Dashboard: Processed shipments data:', shipmentsData.length, 'shipments (excluding drafts)');
            setShipments(shipmentsData);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching shipments:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [companyIdForAddress, companyLoading, thirtyDaysAgo]);

    // Load user profile data
    useEffect(() => {
        const loadUserProfileData = async () => {
            if (!currentUser) return;

            try {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setUserProfileData({
                        photoURL: userData.photoURL || currentUser.photoURL || null,
                        firstName: userData.firstName || '',
                        lastName: userData.lastName || '',
                        email: userData.email || ''
                    });
                } else {
                    // Fallback to Firebase Auth data
                    setUserProfileData({
                        photoURL: currentUser.photoURL || null,
                        firstName: currentUser.displayName?.split(' ')[0] || '',
                        lastName: currentUser.displayName?.split(' ')[1] || '',
                        email: currentUser.email || ''
                    });
                }
            } catch (error) {
                console.error('Error loading user profile data:', error);
                // Fallback to Firebase Auth data
                setUserProfileData({
                    photoURL: currentUser.photoURL || null,
                    firstName: currentUser.displayName?.split(' ')[0] || '',
                    lastName: currentUser.displayName?.split(' ')[1] || '',
                    email: currentUser.email || ''
                });
            }
        };

        loadUserProfileData();
    }, [currentUser]);

    // Handle deep link navigation from email notifications
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const modal = urlParams.get('modal');
        const customerId = urlParams.get('customerId');
        const noteId = urlParams.get('note');

        // Only process deep links if we have the required data and aren't loading
        if (modal && !loading && !companyLoading) {
            console.log('Processing deep link:', { modal, customerId, noteId });

            if (modal === 'customers' && customerId) {
                // Set deep link parameters for the customers component
                setCustomersDeepLinkParams({
                    customerId: customerId,
                    noteId: noteId
                });

                // Open customers modal with specific customer and note
                // setIsCustomersModalOpen(true); // Commented out - Customers replaced with Billing

                // Clear URL parameters after processing to avoid re-triggering
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);

                console.log('Opened customers modal via deep link for customer:', customerId, 'note:', noteId);
            }
            // Add more modal types as needed (shipments, carriers, etc.)
        }
    }, [location.search, loading, companyLoading]);

    // Listen for custom events to open shipments modal (from Review component)
    useEffect(() => {
        const handleOpenShipmentsModal = () => {
            console.log('Received openShipmentsModal event, opening shipments modal');
            setIsShipmentsModalOpen(true);
        };

        window.addEventListener('openShipmentsModal', handleOpenShipmentsModal);

        return () => {
            window.removeEventListener('openShipmentsModal', handleOpenShipmentsModal);
        };
    }, []);

    // Calculate status counts for the Globe
    const statusCounts = useMemo(() => {
        return shipments.reduce((counts, shipment) => {
            const status = shipment.status?.toLowerCase();
            if (status === 'pending' || status === 'scheduled' || status === 'awaiting_shipment' || status === 'booked') {
                counts.pending = (counts.pending || 0) + 1;
            } else if (status === 'in_transit') {
                counts.transit = (counts.transit || 0) + 1;
            } else if (status === 'delivered') {
                counts.delivered = (counts.delivered || 0) + 1;
            } else if (status === 'delayed' || status === 'exception') {
                counts.delayed = (counts.delayed || 0) + 1;
            }
            return counts;
        }, { pending: 0, transit: 0, delivered: 0, delayed: 0 });
    }, [shipments]);

    const handleTrackShipment = () => {
        if (trackingNumber.trim()) {
            // The tracking component inside the drawer will use its own logic
            // We just need to open the drawer
            setIsTrackingDrawerOpen(true);
        }
    };

    const handleToggleFullscreen = () => {
        if (globeRef.current) {
            globeRef.current.toggleFullScreen();
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    // Profile menu handlers
    const handleProfileMenuOpen = (event) => {
        setProfileMenuAnchor(event.currentTarget);
    };

    const handleProfileMenuClose = () => {
        setProfileMenuAnchor(null);
    };

    const handleProfileMenuAction = (action) => {
        handleProfileMenuClose();
        if (action === 'profile') {
            setIsProfileModalOpen(true);
        } else if (action === 'company') {
            setIsCompanyModalOpen(true);
        } else if (action === 'logout') {
            handleLogout();
        }
    };

    // Settings menu handlers
    const handleSettingsMenuOpen = (event) => {
        setSettingsMenuAnchor(event.currentTarget);
    };

    const handleSettingsMenuClose = () => {
        setSettingsMenuAnchor(null);
    };

    const handleSettingsMenuAction = (action) => {
        handleSettingsMenuClose();
        if (action === 'notifications') {
            setIsNotificationsModalOpen(true);
        } else if (action === 'carriers') {
            setIsCarriersModalOpen(true);
        }
    };

    // Function to refresh user profile data (called when profile modal closes)
    const refreshUserProfileData = async () => {
        if (!currentUser) return;

        try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setUserProfileData({
                    photoURL: userData.photoURL || currentUser.photoURL || null,
                    firstName: userData.firstName || '',
                    lastName: userData.lastName || '',
                    email: userData.email || ''
                });
            }
        } catch (error) {
            console.error('Error refreshing user profile data:', error);
        }
    };

    const handleOpenCreateShipmentModal = (prePopulatedData = null, draftId = null, quickshipDraftId = null, mode = 'advanced') => {
        console.log('🚀 Opening modal with:', { prePopulatedData, draftId, quickshipDraftId, mode });

        if (mode === 'quickship') {
            console.log('🚀 Opening QuickShip modal');

            // Close other modals first if open
            if (isShipmentsModalOpen) {
                setIsShipmentsModalOpen(false);
                setTimeout(() => {
                    setIsQuickShipModalOpen(true);
                }, 300);
            } else {
                setIsQuickShipModalOpen(true);
            }

            // Store the draft ID for QuickShip if provided
            if (quickshipDraftId) {
                console.log('🚀 Opening QuickShip modal for draft:', quickshipDraftId);
                setCreateShipmentPrePopulatedData({ quickshipDraftId: quickshipDraftId });
            } else {
                // Clear any previous data when opening QuickShip for new shipment
                setCreateShipmentPrePopulatedData(null);
            }

        } else {
            console.log('🔧 Opening CreateShipmentX modal (advanced single-page mode)');

            // Set pre-populated data if provided
            setCreateShipmentPrePopulatedData(prePopulatedData);

            // Set draft ID for editing existing drafts
            if (draftId) {
                console.log('📝 Opening CreateShipmentX modal to edit draft:', draftId);
                // We can use the prePopulatedData state to also pass the draft ID
                // The CreateShipmentX component will handle this appropriately
                setCreateShipmentPrePopulatedData(prev => ({
                    ...prev,
                    editDraftId: draftId
                }));
            }

            // Close other modals first if open
            if (isShipmentsModalOpen) {
                setIsShipmentsModalOpen(false);
                // Add a small delay to allow the first modal to close before opening the new one
                setTimeout(() => {
                    setIsCreateShipmentModalOpen(true);
                }, 300);
            } else {
                setIsCreateShipmentModalOpen(true);
            }
        }
    };

    // Handler for opening tracking drawer from Globe
    const handleOpenTrackingDrawerFromGlobe = (trackingId) => {
        setTrackingNumber(trackingId);
        setIsTrackingDrawerOpen(true);
    };

    // Handler for route click from RouteViewBadge
    const handleRouteClick = (shipment) => {
        console.log('Route clicked for shipment:', shipment);

        // Open Shipments modal directly to shipment detail
        setShipmentsDeepLinkParams({
            directToDetail: true,
            selectedShipmentId: shipment.id
        });

        // Open Shipments modal after a brief delay
        setTimeout(() => {
            setIsShipmentsModalOpen(true);
        }, 100);
    };

    // Handler for opening QuickShip modal (from CreateShipmentX)
    const handleOpenQuickShipModal = () => {
        console.log('Opening QuickShip modal, closing CreateShipmentX modal');
        // Close CreateShipmentX modal first
        setIsCreateShipmentModalOpen(false);
        // Small delay to allow modal to close before opening new one
        setTimeout(() => {
            setIsQuickShipModalOpen(true);
        }, 300);
    };

    // Handler for returning to shipments from CreateShipmentX
    const handleReturnToShipmentsFromCreateShipment = () => {
        setIsCreateShipmentModalOpen(false);
        setTimeout(() => {
            setIsShipmentsModalOpen(true);
        }, 300);
    };

    // Handler for viewing shipment from CreateShipmentX
    const handleViewShipment = (shipmentId) => {
        console.log('Viewing shipment from CreateShipmentX:', shipmentId);

        // Close CreateShipmentX modal
        setIsCreateShipmentModalOpen(false);

        // Open Shipments modal directly to shipment detail (bypassing the table)
        setShipmentsDeepLinkParams({
            directToDetail: true,
            selectedShipmentId: shipmentId
        });

        // Open Shipments modal after a brief delay
        setTimeout(() => {
            setIsShipmentsModalOpen(true);
        }, 300);
    };

    // Handler for viewing shipment detail from LogisticsCommandCenter
    const handleViewShipmentFromCommandCenter = (shipmentId) => {
        console.log('Viewing shipment from LogisticsCommandCenter:', shipmentId);

        // Open Shipments modal directly to shipment detail (bypassing the table)
        setShipmentsDeepLinkParams({
            directToDetail: true,
            selectedShipmentId: shipmentId
        });

        // Open Shipments modal
        setIsShipmentsModalOpen(true);
    };

    // Handler for clearing deep link parameters when navigating back from shipment detail
    const handleClearDeepLinkParams = useCallback(() => {
        console.log('Clearing deep link parameters to prevent auto-navigation loop');
        setShipmentsDeepLinkParams(null);
    }, []);

    // Handler for navigating from Customers to Shipments with deep linking
    const handleNavigateToShipments = useCallback((deepLinkParams = {}) => {
        console.log('Navigating to Shipments with params:', deepLinkParams);

        // Add current modal to stack
        setModalStack(prev => [...prev, 'customers']);

        // Set deep link parameters
        setShipmentsDeepLinkParams(deepLinkParams);

        // Close customers modal and open shipments modal
        // setIsCustomersModalOpen(false); // Commented out - Customers replaced with Billing
        setTimeout(() => {
            setIsShipmentsModalOpen(true);
        }, 300); // Delay to allow slide transition
    }, []);

    // Handler for modal back navigation
    const handleModalBack = useCallback(() => {
        console.log('Modal back navigation, current stack:', modalStack);

        if (modalStack.length > 0) {
            const previousModal = modalStack[modalStack.length - 1];

            // Remove from stack
            setModalStack(prev => prev.slice(0, -1));

            // Clear deep link parameters
            setShipmentsDeepLinkParams(null);

            // Close current modal and open previous
            setIsShipmentsModalOpen(false);
            setTimeout(() => {
                if (previousModal === 'customers') {
                    // setIsCustomersModalOpen(true); // Commented out - Customers replaced with Billing
                } else if (previousModal === 'shipments') {
                    // If previous modal was shipments, just close the current modal
                    setIsShipmentsModalOpen(false);
                }
                // Add more modal types as needed
            }, 300); // Delay to allow slide transition
        }
    }, [modalStack]);

    const menuItems = [
        {
            text: 'New Shipment',
            icon: <AddIcon />,
            action: () => setNewShipmentExpanded(!newShipmentExpanded),
            expandable: true,
            expanded: newShipmentExpanded,
            subItems: [
                {
                    text: 'Quick Ship',
                    icon: <RocketLaunchIcon />,
                    description: 'Fast manual entry',
                    action: () => {
                        handleOpenQuickShipModal();
                        setNewShipmentExpanded(false);
                    }
                },
                {
                    text: 'Real-Time Rates',
                    icon: <CalculateIcon />,
                    description: 'Advanced single-page rate comparison',
                    action: () => {
                        handleOpenCreateShipmentModal();
                        setNewShipmentExpanded(false);
                    }
                }
            ]
        },
        { text: 'Shipments', icon: <LocalShippingIcon />, action: () => setIsShipmentsModalOpen(true) },
        { text: 'Address Book', icon: <ContactMailIcon />, action: () => setIsAddressBookModalOpen(true) },
        { text: 'Billing', icon: <AccountBalanceWalletIcon />, action: () => setIsBillingModalOpen(true) },
        { text: 'Reports', icon: <AssessmentIcon />, action: () => setIsReportsModalOpen(true) },
    ];

    const profileMenuItems = [
        // Empty array since My Company moved to profile dropdown
    ];

    return (
        <Box className="dashboard-container" sx={{
            height: '100vh',
            width: '100vw',
            overflow: 'hidden',
            position: 'relative',
            bgcolor: '#000'
        }}>
            {/* Fixed Top Right Profile and Settings */}
            <Box sx={{
                position: 'fixed',
                top: 16,
                right: 16,
                zIndex: 1200,
                display: 'flex',
                alignItems: 'center',
                gap: 1
            }}>
                {/* Profile Avatar */}
                <IconButton
                    onClick={handleProfileMenuOpen}
                    sx={{
                        p: 0.5,
                        ml: 1,
                        '&:hover': {
                            transform: 'scale(1.05)'
                        },
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Avatar
                        src={userProfileData.photoURL}
                        sx={{
                            width: { xs: 32, sm: 36, md: 40 },
                            height: { xs: 32, sm: 36, md: 40 },
                            bgcolor: 'rgba(255, 255, 255, 0.1)',
                            border: '2px solid rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            fontSize: { xs: '1rem', sm: '1.1rem', md: '1.2rem' },
                            fontWeight: 600,
                            cursor: 'pointer',
                            '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 0.15)',
                                borderColor: 'rgba(255, 255, 255, 0.4)'
                            }
                        }}
                    >
                        {!userProfileData.photoURL && (
                            userProfileData.firstName && userProfileData.lastName
                                ? `${userProfileData.firstName[0]}${userProfileData.lastName[0]}`
                                : currentUser?.displayName?.[0] || currentUser?.email?.[0] || '?'
                        )}
                    </Avatar>
                </IconButton>

                {/* Settings Gear Icon */}
                <IconButton
                    onClick={handleSettingsMenuOpen}
                    sx={{
                        color: '#666666',
                        p: 0.5,
                        ml: 0.5,
                        '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            transform: 'scale(1.05)'
                        },
                        transition: 'all 0.2s ease'
                    }}
                >
                    <SettingsIcon sx={{
                        fontSize: { xs: '1.5rem', sm: '1.6rem', md: '1.8rem' }
                    }} />
                </IconButton>
            </Box>

            {/* Profile Menu Dropdown */}
            <Menu
                anchorEl={profileMenuAnchor}
                open={isProfileMenuOpen}
                onClose={handleProfileMenuClose}
                onClick={handleProfileMenuClose}
                PaperProps={{
                    elevation: 3,
                    sx: {
                        overflow: 'visible',
                        filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                        mt: 1.5,
                        minWidth: 180,
                        '&:before': {
                            content: '""',
                            display: 'block',
                            position: 'absolute',
                            top: 0,
                            right: 14,
                            width: 10,
                            height: 10,
                            bgcolor: 'background.paper',
                            transform: 'translateY(-50%) rotate(45deg)',
                            zIndex: 0,
                        },
                    },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MenuItem
                    onClick={() => handleProfileMenuAction('profile')}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                        }
                    }}
                >
                    <ListItemIcon sx={{ mr: 1, minWidth: 'auto' }}>
                        <AccountCircleIcon fontSize="small" />
                    </ListItemIcon>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Profile
                    </Typography>
                </MenuItem>

                <MenuItem
                    onClick={() => handleProfileMenuAction('company')}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                        }
                    }}
                >
                    <ListItemIcon sx={{ mr: 1, minWidth: 'auto' }}>
                        <BusinessIcon fontSize="small" />
                    </ListItemIcon>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Company
                    </Typography>
                </MenuItem>

                <Divider />

                <MenuItem
                    onClick={() => handleProfileMenuAction('logout')}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: 'rgba(244, 67, 54, 0.04)'
                        }
                    }}
                >
                    <ListItemIcon sx={{ mr: 1, minWidth: 'auto' }}>
                        <LogoutIcon fontSize="small" sx={{ color: '#f44336' }} />
                    </ListItemIcon>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#f44336' }}>
                        Sign Out
                    </Typography>
                </MenuItem>
            </Menu>

            {/* Settings Menu Dropdown */}
            <Menu
                anchorEl={settingsMenuAnchor}
                open={isSettingsMenuOpen}
                onClose={handleSettingsMenuClose}
                onClick={handleSettingsMenuClose}
                PaperProps={{
                    elevation: 3,
                    sx: {
                        overflow: 'visible',
                        filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                        mt: 1.5,
                        minWidth: 180,
                        '&:before': {
                            content: '""',
                            display: 'block',
                            position: 'absolute',
                            top: 0,
                            right: 14,
                            width: 10,
                            height: 10,
                            bgcolor: 'background.paper',
                            transform: 'translateY(-50%) rotate(45deg)',
                            zIndex: 0,
                        },
                    },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MenuItem
                    onClick={() => handleSettingsMenuAction('notifications')}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                        }
                    }}
                >
                    <ListItemIcon sx={{ mr: 1, minWidth: 'auto' }}>
                        <NotificationsIcon fontSize="small" />
                    </ListItemIcon>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Notifications
                    </Typography>
                </MenuItem>

                <MenuItem
                    onClick={() => handleSettingsMenuAction('carriers')}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                        }
                    }}
                >
                    <ListItemIcon sx={{ mr: 1, minWidth: 'auto' }}>
                        <BusinessIcon fontSize="small" />
                    </ListItemIcon>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Carriers
                    </Typography>
                </MenuItem>
            </Menu>

            {/* Left Side Navigation Panel */}
            <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: { xs: '220px', sm: '240px', md: '260px' },
                height: '100vh',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
                zIndex: 5,
                overflow: 'hidden'
            }}>
                {/* Animated background particles */}
                <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `
                                radial-gradient(circle at 20% 50%, rgba(96, 165, 250, 0.1) 0%, transparent 50%),
                                radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                                radial-gradient(circle at 40% 80%, rgba(34, 197, 94, 0.1) 0%, transparent 50%)
                            `,
                    animation: 'float 6s ease-in-out infinite'
                }} />

                {/* Header with Logo */}
                <Box sx={{
                    p: { xs: 1.5, sm: 2 },
                    display: 'flex',
                    justifyContent: 'flex-start',
                    position: 'relative',
                    zIndex: 1,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <img
                        src="/images/integratedcarrriers_logo_white.png"
                        alt="SoluShipX"
                        style={{ height: 60 }}
                    />
                </Box>

                {/* Tracking Search Box */}
                <Box sx={{
                    px: { xs: 1.5, sm: 2 },
                    py: 2,
                    position: 'relative',
                    zIndex: 1
                }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        size="small"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleTrackShipment()}
                        placeholder="Track Shipment"
                        className="tracking-search-box"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <BarcodeIcon sx={{
                                        color: 'rgba(0, 0, 0, 0.6)',
                                        fontSize: '20px'
                                    }} />
                                </InputAdornment>
                            ),
                            sx: {
                                '& .MuiInputBase-input': {
                                    fontSize: '12px',
                                    color: '#000',
                                    '&::placeholder': {
                                        color: 'rgba(0, 0, 0, 0.5)',
                                        opacity: 1
                                    }
                                }
                            }
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                borderRadius: '8px',
                                '& fieldset': {
                                    borderColor: 'rgba(255, 255, 255, 0.3)',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'rgba(255, 255, 255, 0.5)',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: 'rgba(255, 255, 255, 0.7)',
                                },
                            },
                            '& .MuiInputBase-input': {
                                fontSize: '12px',
                                py: 1
                            }
                        }}
                    />
                </Box>

                {/* Enhanced Menu Items */}
                <List sx={{
                    flexGrow: 1,
                    position: 'relative',
                    zIndex: 1,
                    px: { xs: 0.5, sm: 1 },
                    py: 0
                }}>
                    {menuItems.map((item, index) => (
                        <React.Fragment key={item.text}>
                            <ListItem disablePadding sx={{ mb: 0.5 }}>
                                <ListItemButton
                                    onClick={item.action}
                                    sx={{
                                        borderRadius: '12px',
                                        py: { xs: 1.25, sm: 1.5 },
                                        px: { xs: 1.5, sm: 2 },
                                        backgroundColor: item.expanded ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                            transform: 'translateX(4px)',
                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                                        },
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <ListItemIcon sx={{
                                        color: 'rgba(255,255,255,0.8) !important',
                                        minWidth: { xs: 36, sm: 40 },
                                        '& .MuiSvgIcon-root': {
                                            fontSize: { xs: '1.2rem', sm: '1.3rem', md: '1.3rem' }
                                        }
                                    }}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        primaryTypographyProps={{
                                            fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.9rem' },
                                            fontWeight: 500,
                                            color: 'white'
                                        }}
                                    />
                                    {item.expandable && (
                                        item.expanded ? (
                                            <ExpandLess sx={{ color: 'rgba(255,255,255,0.6)' }} />
                                        ) : (
                                            <ExpandMore sx={{ color: 'rgba(255,255,255,0.6)' }} />
                                        )
                                    )}
                                </ListItemButton>
                            </ListItem>

                            {/* Submenu items */}
                            {item.expandable && (
                                <Collapse in={item.expanded} timeout="auto" unmountOnExit>
                                    <List component="div" disablePadding>
                                        {item.subItems?.map((subItem) => (
                                            <ListItem key={subItem.text} disablePadding sx={{ mb: 0.5 }}>
                                                <ListItemButton
                                                    onClick={subItem.action}
                                                    sx={{
                                                        borderRadius: '12px',
                                                        py: { xs: 1.25, sm: 1.5 },
                                                        px: { xs: 1.5, sm: 2 },
                                                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                                            borderColor: 'rgba(255, 255, 255, 0.15)',
                                                            transform: 'translateX(4px)',
                                                            '& .subitem-icon': {
                                                                transform: 'scale(1.1)',
                                                            }
                                                        },
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <ListItemIcon sx={{
                                                        color: 'rgba(255,255,255,0.7) !important',
                                                        minWidth: { xs: 36, sm: 40 },
                                                        '& .MuiSvgIcon-root': {
                                                            fontSize: { xs: '1.2rem', sm: '1.3rem', md: '1.3rem' },
                                                            className: 'subitem-icon',
                                                            transition: 'transform 0.2s ease'
                                                        }
                                                    }}>
                                                        {subItem.icon}
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={subItem.text}
                                                        secondary={subItem.description}
                                                        primaryTypographyProps={{
                                                            fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.9rem' },
                                                            fontWeight: 500,
                                                            color: 'rgba(255,255,255,0.9)'
                                                        }}
                                                        secondaryTypographyProps={{
                                                            fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                                            color: 'rgba(255,255,255,0.5)'
                                                        }}
                                                    />
                                                </ListItemButton>
                                            </ListItem>
                                        ))}
                                    </List>
                                </Collapse>
                            )}
                        </React.Fragment>
                    ))}
                </List>

                {/* Footer Section */}
                <Box sx={{
                    px: { xs: 1.5, sm: 2 },
                    pb: { xs: 1.5, sm: 2 },
                    position: 'relative',
                    zIndex: 1,
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    pt: 2
                }}>
                    {/* Admin Return Button - Only visible for admin users */}
                    {(userRole === 'admin' || userRole === 'super_admin') && (
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<AdminPanelSettingsIcon />}
                            onClick={() => {
                                const returnPath = getAdminReturnPath();
                                clearAdminReturnPath();
                                navigate(returnPath);
                            }}
                            sx={{
                                borderRadius: '12px',
                                py: 1.5,
                                borderColor: 'rgba(255, 255, 255, 0.2)',
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontSize: { xs: '0.85rem', sm: '0.9rem' },
                                fontWeight: 500,
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                backdropFilter: 'blur(10px)',
                                '&:hover': {
                                    borderColor: 'rgba(255, 255, 255, 0.4)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
                                },
                                transition: 'all 0.3s ease',
                                textTransform: 'none',
                                '& .MuiButton-startIcon': {
                                    color: 'rgba(255, 255, 255, 0.7)'
                                }
                            }}
                        >
                            Return to Admin
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Enhanced Tracking Drawer (Right) */}
            {
                isTrackingDrawerOpen && (
                    <Box
                        onClick={() => setIsTrackingDrawerOpen(false)}
                        sx={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            bgcolor: 'rgba(0,0,0,0.7)',
                            zIndex: 1499,
                            transition: 'opacity 0.3s',
                        }}
                    />
                )
            }
            <Drawer
                anchor="right"
                open={isTrackingDrawerOpen}
                onClose={() => setIsTrackingDrawerOpen(false)}
                PaperProps={{
                    sx: {
                        width: {
                            xs: '100vw',
                            sm: '420px',
                            md: '480px',
                            lg: '520px'
                        },
                        maxWidth: '100vw',
                        height: '100%',
                        bgcolor: '#0a0a0a',
                        zIndex: 1500,
                        position: 'fixed',
                        right: 0,
                        top: 0,
                    }
                }}
                ModalProps={{
                    keepMounted: true,
                    sx: { zIndex: 1500 }
                }}
            >
                <Box sx={{
                    width: '100%',
                    height: '100%',
                    bgcolor: '#0a0a0a'
                }} role="presentation">
                    <LazyComponentWrapper fallback={<CircularProgress sx={{ m: 4 }} />}>
                        {/* Pass trackingNumber to the component so it can auto-fetch */}
                        <TrackingDrawerContent
                            trackingIdentifier={trackingNumber}
                            isDrawer={true}
                            onClose={() => {
                                setIsTrackingDrawerOpen(false);
                                setTrackingNumber(''); // Clear the tracking number when closing
                            }}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Drawer>

            {/* Shipments Fullscreen Modal */}
            <Dialog
                open={isShipmentsModalOpen}
                onClose={() => {
                    setIsShipmentsModalOpen(false);
                    // Clear deep link parameters when modal closes to prevent sticky navigation
                    setShipmentsDeepLinkParams(null);
                }}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflowY: 'auto' }}>
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <ShipmentsComponent
                            isModal={true}
                            onClose={() => {
                                setIsShipmentsModalOpen(false);
                                // Clear deep link parameters when modal closes to prevent sticky navigation
                                setShipmentsDeepLinkParams(null);
                            }}
                            showCloseButton={true}
                            onModalBack={modalStack.length > 0 ? handleModalBack : null}
                            deepLinkParams={shipmentsDeepLinkParams}
                            onOpenCreateShipment={handleOpenCreateShipmentModal}
                            onClearDeepLinkParams={handleClearDeepLinkParams}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Create Shipment Fullscreen Modal */}
            <Dialog
                open={isCreateShipmentModalOpen}
                onClose={() => setIsCreateShipmentModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflowY: 'auto' }}>
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <CreateShipmentXComponent
                            isModal={true}
                            onClose={() => {
                                setIsCreateShipmentModalOpen(false);
                                // Clear pre-populated data when modal closes
                                setCreateShipmentPrePopulatedData(null);
                            }}
                            onReturnToShipments={handleReturnToShipmentsFromCreateShipment}
                            onViewShipment={handleViewShipment}
                            showCloseButton={true}
                            draftId={createShipmentPrePopulatedData?.editDraftId || null}
                            prePopulatedData={createShipmentPrePopulatedData}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Customers Fullscreen Modal - Commented out, replaced with Billing link */}
            {/* <Dialog
                open={isCustomersModalOpen}
                onClose={() => setIsCustomersModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflowY: 'auto' }}>
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <CustomersComponent
                            isModal={true}
                            onClose={() => {
                                setIsCustomersModalOpen(false);
                                setCustomersDeepLinkParams(null); // Clear deep link params when modal closes
                            }}
                            showCloseButton={true}
                            onNavigateToShipments={handleNavigateToShipments}
                            deepLinkParams={customersDeepLinkParams}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog> */}

            {/* Carriers Fullscreen Modal */}
            <Dialog
                open={isCarriersModalOpen}
                onClose={() => setIsCarriersModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflowY: 'auto' }}>
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <CarriersComponent
                            isModal={true}
                            onClose={() => setIsCarriersModalOpen(false)}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Reports Fullscreen Modal */}
            <Dialog
                open={isReportsModalOpen}
                onClose={() => setIsReportsModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflowY: 'auto' }}>
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <ReportsComponent
                            isModal={true}
                            onClose={() => setIsReportsModalOpen(false)}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Notifications Fullscreen Modal */}
            <Dialog
                open={isNotificationsModalOpen}
                onClose={() => setIsNotificationsModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflowY: 'auto' }}>
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <NotificationPreferencesComponent
                            isModal={true}
                            onClose={() => setIsNotificationsModalOpen(false)}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Profile Fullscreen Modal */}
            <Dialog
                open={isProfileModalOpen}
                onClose={() => {
                    setIsProfileModalOpen(false);
                    refreshUserProfileData(); // Refresh profile data when modal closes
                }}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflowY: 'auto' }}>
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <ProfileComponent
                            isModal={true}
                            onClose={() => {
                                setIsProfileModalOpen(false);
                                refreshUserProfileData(); // Refresh profile data when modal closes
                            }}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Company Fullscreen Modal */}
            <Dialog
                open={isCompanyModalOpen}
                onClose={() => setIsCompanyModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflowY: 'auto' }}>
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <CompanyComponent
                            isModal={true}
                            onClose={() => setIsCompanyModalOpen(false)}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Address Book Fullscreen Modal */}
            <Dialog
                open={isAddressBookModalOpen}
                onClose={() => setIsAddressBookModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflow: 'hidden' }}>
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <AddressBookComponent
                            isModal={true}
                            onClose={() => setIsAddressBookModalOpen(false)}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Billing Fullscreen Modal */}
            <Dialog
                open={isBillingModalOpen}
                onClose={() => setIsBillingModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflowY: 'auto' }}>
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <BillingComponent
                            isModal={true}
                            onClose={() => setIsBillingModalOpen(false)}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* QuickShip Fullscreen Modal */}
            <Dialog
                open={isQuickShipModalOpen}
                onClose={() => setIsQuickShipModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflowY: 'auto' }}>
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <ShipmentFormProvider>
                            <QuickShipComponent
                                isModal={true}
                                onClose={() => {
                                    setIsQuickShipModalOpen(false);
                                    // Clear pre-populated data when modal closes
                                    setCreateShipmentPrePopulatedData(null);
                                }}
                                onReturnToShipments={handleReturnToShipmentsFromCreateShipment}
                                onViewShipment={handleViewShipment}
                                draftId={createShipmentPrePopulatedData?.quickshipDraftId || null}
                                showCloseButton={true}
                            />
                        </ShipmentFormProvider>
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* AI Shipping Agent Overlay - HIDDEN FOR NOW */}
            {
                false && companyData?.id && (
                    <LazyComponentWrapper fallback={null}>
                        <ShipmentAgent
                            companyId={companyData.id}
                            inModal={false}
                            isPanelOpen={isChatOpen}
                            setIsPanelOpen={setIsChatOpen}
                            currentShipmentId={null}
                            sx={{ zIndex: 1000 }}
                        />
                    </LazyComponentWrapper>
                )
            }



            {/* Logistics Command Center - Positioned to the right of sidebar */}
            <Box sx={{
                position: 'absolute',
                top: 0,
                left: { xs: '220px', sm: '240px', md: '260px' },
                width: 'calc(100% - 220px)',
                '@media (min-width: 600px)': {
                    width: 'calc(100% - 240px)'
                },
                '@media (min-width: 960px)': {
                    width: 'calc(100% - 260px)'
                },
                height: '100%',
                opacity: showLoadingScreen ? 0 : 1,
                transition: 'opacity 1s ease-in-out',
                zIndex: 1,
            }}>
                <LazyComponentWrapper fallback={
                    <Box sx={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: '#000',
                        color: 'white'
                    }}>
                        <CircularProgress color="inherit" />
                    </Box>
                }>
                    <LogisticsCommandCenter
                        shipments={shipments}
                        onShipmentSelect={handleViewShipmentFromCommandCenter}
                        onRouteClick={handleRouteClick}
                    />
                </LazyComponentWrapper>
            </Box>

            {/* Loading Screen Overlay - Now as background with lower z-index */}
            <Fade in={showLoadingScreen} timeout={{ enter: 0, exit: 1000 }}>
                <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: { xs: '220px', sm: '240px', md: '260px' },
                    width: 'calc(100% - 220px)',
                    '@media (min-width: 600px)': {
                        width: 'calc(100% - 240px)'
                    },
                    '@media (min-width: 960px)': {
                        width: 'calc(100% - 260px)'
                    },
                    height: '100%',
                    zIndex: 2,
                    pointerEvents: 'none'
                }}>
                    <MapsLoadingScreen />
                </Box>
            </Fade>

            {/* Dashboard Stats Overlay - Only show in maps mode */}
            {viewMode === 'maps' && <DashboardStatsOverlay shipments={shipments} />}
        </Box>
    );
};

export default Dashboard;