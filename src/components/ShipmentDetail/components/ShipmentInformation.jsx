import React, { useState, useEffect } from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Stack,
    Chip,
    IconButton,
    CircularProgress,
    Link,
    Avatar,
    Button,
    Dialog,
    DialogTitle,
    DialogContent
} from '@mui/material';
import {
    LocalShipping as LocalShippingIcon,
    AccessTime as AccessTimeIcon,
    Assignment as AssignmentIcon,
    ContentCopy as ContentCopyIcon,
    Refresh as RefreshIcon,
    Map as MapIcon,
    Route as RouteIcon,
    LocationOn as LocationOnIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { GoogleMap, Marker, DirectionsRenderer, StreetViewPanorama } from '@react-google-maps/api';
import { db } from '../../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import StatusChip from '../../StatusChip/StatusChip';

// CarrierDisplay component to show carrier logo and name
const CarrierDisplay = React.memo(({ carrierName, carrierData, size = 'medium', isIntegrationCarrier }) => {
    const sizeConfig = {
        small: { logoSize: 24, fontSize: '12px' },
        medium: { logoSize: 32, fontSize: '1rem' },
        large: { logoSize: 40, fontSize: '1.125rem' }
    };

    const { logoSize, fontSize } = sizeConfig[size] || sizeConfig.medium;

    if (!carrierName || carrierName === 'N/A') {
        return <Typography variant="body1" sx={{ fontSize }}>N/A</Typography>;
    }

    const logoUrl = carrierData?.logoUrl || carrierData?.image;

    return (
        <Typography variant="body1" sx={{ fontSize, fontWeight: 500 }}>
            {carrierName}
            {isIntegrationCarrier && (
                <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
                    (via eShipPlus)
                </Typography>
            )}
        </Typography>
    );
});

const ShipmentInformation = ({
    shipment,
    getBestRateInfo,
    carrierData,
    mergedEvents,
    actionStates,
    smartUpdateLoading,
    onRefreshStatus,
    onShowSnackbar,
    onOpenTrackingDrawer
}) => {
    // Map state
    const [openMap, setOpenMap] = useState(null);
    const [geocodedPosition, setGeocodedPosition] = useState(null);
    const [geocodingLoading, setGeocodingLoading] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
    const [directions, setDirections] = useState(null);
    const [mapsApiKey, setMapsApiKey] = useState(null);

    // Check if Google Maps is loaded and get API key
    useEffect(() => {
        const initializeMaps = async () => {
            try {
                setMapError(null);

                // Always fetch API key from Firestore (needed for Routes API v2)
                const keysRef = collection(db, 'keys');
                const keysSnapshot = await getDocs(keysRef);

                if (!keysSnapshot.empty) {
                    const firstDoc = keysSnapshot.docs[0];
                    const key = firstDoc.data().googleAPI;
                    if (!key) {
                        throw new Error('No API key found in Firestore');
                    }
                    setMapsApiKey(key);
                } else {
                    throw new Error('API key document not found in Firestore');
                }

                // Check if Google Maps is already loaded globally (from Globe component)
                if (window.google && window.google.maps) {
                    console.log('Google Maps already loaded globally');
                    setIsGoogleMapsLoaded(true);
                } else {
                    // If not loaded, we still have the API key for when it loads
                    const checkGoogleMaps = () => {
                        if (window.google && window.google.maps) {
                            setIsGoogleMapsLoaded(true);
                        } else {
                            setTimeout(checkGoogleMaps, 100);
                        }
                    };
                    checkGoogleMaps();
                }
            } catch (error) {
                console.error('Error initializing Maps:', error);
                setMapError('Failed to load Google Maps. Please try refreshing the page.');
                setIsGoogleMapsLoaded(false);
            }
        };

        initializeMaps();
    }, []);

    // Map options - normal styling with street view enabled
    const mapOptions = {
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: true,
        mapTypeControl: false,
        fullscreenControl: true
    };

    const formatAddress = (address) => {
        if (!address) return 'N/A';
        const parts = [];
        if (address.company) parts.push(address.company);
        if (address.street) parts.push(address.street);
        if (address.street2) parts.push(address.street2);
        if (address.city && address.state) {
            parts.push(`${address.city}, ${address.state} ${address.postalCode || ''}`);
        }
        if (address.country) parts.push(address.country);
        return parts.join('\n') || 'N/A';
    };

    const getAddress = (shipment, type) => {
        if (!type) return null;
        return shipment?.[type] || shipment?.[type.toLowerCase()] || null;
    };

    const handleOpenMap = (type) => {
        setOpenMap(type);
    };

    const handleCloseMap = () => {
        setOpenMap(null);
    };

    // Geocoding and map rendering logic
    useEffect(() => {
        if (!openMap || !shipment || !isGoogleMapsLoaded) return;
        setGeocodedPosition(null);
        setDirections(null);
        setMapError(null);
        setGeocodingLoading(true);

        if (openMap === 'route') {
            // Complete route calculation using Routes API v2
            const calculateRoute = async () => {
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

                    const fromAddress = getAddress(shipment, 'shipFrom');
                    const toAddress = getAddress(shipment, 'shipTo');

                    if (!fromAddress || !toAddress) {
                        setMapError('Missing origin or destination address');
                        setGeocodingLoading(false);
                        return;
                    }

                    const [originResult, destinationResult] = await Promise.all([
                        geocodeWithRetry(fromAddress, 'origin'),
                        geocodeWithRetry(toAddress, 'destination')
                    ]);

                    // Validate geocoding results
                    if (!originResult || !originResult.geometry || !originResult.geometry.location) {
                        throw new Error('Invalid origin location data');
                    }

                    if (!destinationResult || !destinationResult.geometry || !destinationResult.geometry.location) {
                        throw new Error('Invalid destination location data');
                    }

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
                        units: "IMPERIAL"
                    };

                    // Add region code if country is available
                    if (fromAddress.country) {
                        const countryCode = fromAddress.country.toLowerCase();
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
                                    text: `${Math.round(route.distanceMeters / 1609.34)} mi`,
                                    value: route.distanceMeters
                                },
                                duration: {
                                    text: `${durationInMinutes} mins`,
                                    value: durationInSeconds
                                },
                                steps: [{
                                    distance: {
                                        text: `${Math.round(route.distanceMeters / 1609.34)} mi`,
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
                    console.log('Route calculated successfully using Routes API v2');
                } catch (error) {
                    console.error('Error calculating route:', error);
                    setDirections(null);
                    setMapError('Error calculating route: ' + error.message);
                }
                setGeocodingLoading(false);
            };

            // Only calculate route when API key is available
            if (mapsApiKey) {
                calculateRoute();
            } else {
                setMapError('API key not available');
                setGeocodingLoading(false);
            }
        } else {
            // Handle single location geocoding
            const address = getAddress(shipment, openMap);
            if (!address) {
                setMapError('No address available');
                setGeocodingLoading(false);
                return;
            }

            const geocoder = new window.google.maps.Geocoder();
            const addressString = formatAddress(address).replace(/\n/g, ', ');

            geocoder.geocode({ address: addressString }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    setGeocodedPosition({
                        lat: results[0].geometry.location.lat(),
                        lng: results[0].geometry.location.lng()
                    });
                } else {
                    setMapError('Could not find location');
                }
                setGeocodingLoading(false);
            });
        }
    }, [openMap, shipment, isGoogleMapsLoaded, mapsApiKey]);

    const renderMap = () => {
        if (!isGoogleMapsLoaded || geocodingLoading) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <CircularProgress />
                </Box>
            );
        }
        if (mapError) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography color="error">{mapError}</Typography>
                </Box>
            );
        }

        // For route view
        if (openMap === 'route') {
            if (!directions) {
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <Typography color="error">No route available</Typography>
                    </Box>
                );
            }
            return (
                <Box sx={{ height: '100%', width: '100%' }}>
                    <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={directions.routes[0].bounds.getCenter()}
                        zoom={6}
                        options={mapOptions}
                        onLoad={(map) => {
                            // Fit bounds to show the entire route with appropriate padding
                            map.fitBounds(directions.routes[0].bounds, {
                                padding: {
                                    top: 50,
                                    right: 50,
                                    bottom: 50,
                                    left: 50
                                }
                            });
                            // Let Google Maps determine the optimal zoom level to show the entire route
                        }}
                    >
                        <DirectionsRenderer
                            directions={directions}
                            options={{
                                polylineOptions: {
                                    strokeColor: '#2196f3',
                                    strokeWeight: 5,
                                    strokeOpacity: 0.8
                                },
                                suppressMarkers: true
                            }}
                        />
                        {/* Custom green start marker */}
                        <Marker
                            position={directions.routes[0].legs[0].start_location}
                            icon={{
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                    <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#4caf50" stroke="#ffffff" stroke-width="2"/>
                                        <circle cx="12" cy="12" r="4" fill="#ffffff"/>
                                    </svg>
                                `),
                                scaledSize: new window.google.maps.Size(24, 36),
                                anchor: new window.google.maps.Point(12, 36)
                            }}
                            title="Start Location"
                        />
                        {/* Custom red end marker */}
                        <Marker
                            position={directions.routes[0].legs[0].end_location}
                            icon={{
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                    <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#f44336" stroke="#ffffff" stroke-width="2"/>
                                        <circle cx="12" cy="12" r="4" fill="#ffffff"/>
                                    </svg>
                                `),
                                scaledSize: new window.google.maps.Size(24, 36),
                                anchor: new window.google.maps.Point(12, 36)
                            }}
                            title="End Location"
                        />
                    </GoogleMap>
                </Box>
            );
        }

        // For single location view
        if (!geocodedPosition) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography color="error">No address available</Typography>
                </Box>
            );
        }
        return (
            <Box sx={{ height: '100%', width: '100%' }}>
                <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={geocodedPosition}
                    zoom={15}
                    options={mapOptions}
                >
                    <Marker
                        position={geocodedPosition}
                        icon={{
                            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="${openMap === 'shipFrom' ? '#4caf50' : '#f44336'}" stroke="#ffffff" stroke-width="2"/>
                                    <circle cx="12" cy="12" r="4" fill="#ffffff"/>
                                </svg>
                            `),
                            scaledSize: new window.google.maps.Size(24, 36),
                            anchor: new window.google.maps.Point(12, 36)
                        }}
                    />
                </GoogleMap>
            </Box>
        );
    };

    // Helper function to format bill type for display
    const formatBillType = (billType) => {
        if (!billType) return 'N/A';

        const billTypeMap = {
            'prepaid': 'Prepaid',
            'collect': 'Collect',
            'third_party': 'Third Party'
        };

        return billTypeMap[billType.toLowerCase()] || billType;
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';

        try {
            // Handle Firestore Timestamp
            if (timestamp.toDate && typeof timestamp.toDate === 'function') {
                return timestamp.toDate().toLocaleString();
            }
            // Handle timestamp objects with seconds (and optional nanoseconds)
            if (timestamp.seconds !== undefined) {
                const milliseconds = timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000;
                return new Date(milliseconds).toLocaleString();
            }
            // Handle regular date strings/objects
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                return 'N/A';
            }
            return date.toLocaleString();
        } catch (error) {
            console.error('Error formatting timestamp:', error, timestamp);
            return 'N/A';
        }
    };

    const getLastUpdatedTimestamp = (shipment, mergedEvents) => {
        if (!shipment && !mergedEvents) return null;

        const timestamps = [];

        if (shipment?.updatedAt) {
            timestamps.push(shipment.updatedAt);
        }

        // For QuickShip, also include bookedAt timestamp
        if (shipment?.creationMethod === 'quickship' && shipment?.bookedAt) {
            timestamps.push(shipment.bookedAt);
        }

        if (mergedEvents && Array.isArray(mergedEvents)) {
            mergedEvents.forEach(event => {
                if (event.timestamp) timestamps.push(event.timestamp);
                if (event.eventTime) timestamps.push(event.eventTime);
            });
        }

        if (timestamps.length === 0) return null;

        return timestamps.reduce((latest, current) => {
            try {
                let currentTime, latestTime;

                // Handle current timestamp
                if (current?.toDate) {
                    currentTime = current.toDate();
                } else if (current?.seconds) {
                    currentTime = new Date(current.seconds * 1000 + (current.nanoseconds || 0) / 1000000);
                } else {
                    currentTime = new Date(current);
                }

                // Handle latest timestamp
                if (latest?.toDate) {
                    latestTime = latest.toDate();
                } else if (latest?.seconds) {
                    latestTime = new Date(latest.seconds * 1000 + (latest.nanoseconds || 0) / 1000000);
                } else {
                    latestTime = new Date(latest);
                }

                return currentTime > latestTime ? current : latest;
            } catch (error) {
                console.error('Error comparing timestamps:', error);
                return latest;
            }
        });
    };

    const capitalizeShipmentType = (type) => {
        if (!type) return 'N/A';
        return type.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };

    const handleCopyTracking = () => {
        const trackingNum = (() => {
            // For QuickShip, use the carrier tracking number entered in the form first
            if (shipment?.creationMethod === 'quickship') {
                return shipment?.shipmentInfo?.carrierTrackingNumber ||
                    shipment?.trackingNumber ||
                    shipment?.shipmentID ||
                    shipment?.id;
            }

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
            onShowSnackbar('Tracking number copied!', 'success');
        } else {
            onShowSnackbar('No tracking number to copy.', 'warning');
        }
    };

    const getTrackingNumber = () => {
        // For QuickShip, use the carrier tracking number entered in the form first
        if (shipment?.creationMethod === 'quickship') {
            return shipment?.shipmentInfo?.carrierTrackingNumber ||
                shipment?.trackingNumber ||
                shipment?.shipmentID ||
                shipment?.id ||
                'N/A';
        }

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
    };

    // Function to convert 24-hour time to AM/PM format
    const formatTimeToAMPM = (time24) => {
        if (!time24) return 'N/A';

        const [hours, minutes] = time24.split(':');
        const hour = parseInt(hours, 10);
        const minute = minutes || '00';

        if (hour === 0) {
            return `12:${minute} AM`;
        } else if (hour < 12) {
            return `${hour}:${minute} AM`;
        } else if (hour === 12) {
            return `12:${minute} PM`;
        } else {
            return `${hour - 12}:${minute} PM`;
        }
    };

    return (
        <Grid item xs={12}>
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
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                            Basic Information
                        </Typography>
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Company ID</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>{shipment?.companyID || 'N/A'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Customer ID</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>{shipment?.shipTo?.customerID || 'N/A'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Shipment Type</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>{capitalizeShipmentType(shipment?.shipmentInfo?.shipmentType || 'N/A')}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Shipper Reference</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                        {shipment?.shipmentInfo?.shipperReferenceNumber || shipment?.shipmentID || 'N/A'}
                                    </Typography>
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            const referenceNumber = shipment?.shipmentInfo?.shipperReferenceNumber || shipment?.shipmentID || 'N/A';
                                            if (referenceNumber && referenceNumber !== 'N/A') {
                                                navigator.clipboard.writeText(referenceNumber);
                                                onShowSnackbar('Reference number copied!', 'success');
                                            } else {
                                                onShowSnackbar('No reference number to copy.', 'warning');
                                            }
                                        }}
                                        sx={{ padding: '2px' }}
                                        title="Copy reference number"
                                    >
                                        <ContentCopyIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                    </IconButton>
                                </Box>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Bill Type</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {formatBillType(shipment?.shipmentInfo?.shipmentBillType || shipment?.shipmentInfo?.billType)}
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
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                            Timing Information
                        </Typography>
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Created At</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {formatTimestamp(
                                        shipment?.creationMethod === 'quickship'
                                            ? (shipment?.bookedAt || shipment?.createdAt)
                                            : shipment?.createdAt
                                    )}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Shipment Date</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {shipment?.shipmentInfo?.shipmentDate ? new Date(shipment.shipmentInfo.shipmentDate).toLocaleDateString() : 'N/A'}
                                </Typography>
                            </Box>
                            {/* Hide Estimated Delivery for QuickShip */}
                            {shipment?.creationMethod !== 'quickship' && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Estimated Delivery</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <AccessTimeIcon sx={{ color: 'text.secondary', fontSize: '0.9rem' }} />
                                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12px' }}>
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
                            )}
                            <Box>
                                <Typography variant="caption" color="text.secondary">Pickup Window</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {shipment?.shipmentInfo?.earliestPickupTime && shipment?.shipmentInfo?.latestPickupTime
                                        ? `${formatTimeToAMPM(shipment.shipmentInfo.earliestPickupTime)} - ${formatTimeToAMPM(shipment.shipmentInfo.latestPickupTime)}`
                                        : '9:00 AM - 5:00 PM'}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Dropoff Window</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {shipment?.shipmentInfo?.earliestDropoffTime && shipment?.shipmentInfo?.latestDropoffTime
                                        ? `${formatTimeToAMPM(shipment.shipmentInfo.earliestDropoffTime)} - ${formatTimeToAMPM(shipment.shipmentInfo.latestDropoffTime)}`
                                        : '9:00 AM - 5:00 PM'}
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
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                            Tracking & Status
                        </Typography>
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Current Status</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                    <StatusChip status={shipment?.status} />
                                    <IconButton
                                        size="small"
                                        onClick={onRefreshStatus}
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
                                    carrierName={shipment?.creationMethod === 'quickship' ?
                                        (shipment?.selectedCarrier || shipment?.carrier) :
                                        getBestRateInfo?.carrier
                                    }
                                    carrierData={carrierData}
                                    size="small"
                                    isIntegrationCarrier={shipment?.creationMethod !== 'quickship' && (getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' || getBestRateInfo?.sourceCarrierName === 'eShipPlus')}
                                />
                            </Box>
                            {/* Hide Service for QuickShip */}
                            {shipment?.creationMethod !== 'quickship' && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Service</Typography>
                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                        {getBestRateInfo?.service || 'N/A'}
                                    </Typography>
                                </Box>
                            )}
                            <Box>
                                <Typography variant="caption" color="text.secondary">Tracking Number</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {onOpenTrackingDrawer ? (
                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            cursor: 'pointer',
                                            '&:hover .tracking-text': { textDecoration: 'underline' }
                                        }}>
                                            <AssignmentIcon sx={{ color: 'primary.main', fontSize: '0.9rem' }} />
                                            <Typography
                                                className="tracking-text"
                                                variant="body2"
                                                onClick={() => onOpenTrackingDrawer(getTrackingNumber())}
                                                sx={{
                                                    fontWeight: 500,
                                                    color: 'primary.main',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                                title="Click to open tracking details"
                                            >
                                                {getTrackingNumber()}
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5
                                        }}>
                                            <AssignmentIcon sx={{ color: 'primary.main', fontSize: '0.9rem' }} />
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontWeight: 500,
                                                    color: 'primary.main',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                {getTrackingNumber()}
                                            </Typography>
                                        </Box>
                                    )}
                                    <IconButton
                                        size="small"
                                        onClick={handleCopyTracking}
                                        sx={{ padding: '2px' }}
                                        title="Copy tracking number"
                                    >
                                        <ContentCopyIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                    </IconButton>
                                </Box>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Last Updated</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {(() => {
                                        const lastUpdated = getLastUpdatedTimestamp(shipment, mergedEvents);
                                        return lastUpdated ? formatTimestamp(lastUpdated) : 'N/A';
                                    })()}
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>
                </Grid>

                {/* Ship From/Ship To Information */}
                <Grid item xs={12} md={3}>
                    <Box sx={{
                        p: 2,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        height: '100%'
                    }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                            Locations
                        </Typography>
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Ship From</Typography>
                                <Box
                                    sx={{
                                        mb: 1,
                                        cursor: 'pointer',
                                        '&:hover': {
                                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                            borderRadius: 1
                                        },
                                        p: 0.5,
                                        borderRadius: 1
                                    }}
                                    onClick={() => handleOpenMap('shipFrom')}
                                >
                                    {(() => {
                                        const address = shipment?.shipFrom;
                                        if (!address) return <Typography variant="body2" sx={{ fontSize: '12px' }}>N/A</Typography>;

                                        const addressLines = [];
                                        if (address.company) addressLines.push(address.company);
                                        if (address.street) addressLines.push(address.street);
                                        if (address.street2) addressLines.push(address.street2);
                                        if (address.city && address.state) {
                                            addressLines.push(`${address.city}, ${address.state}`);
                                        }
                                        if (address.postalCode && address.country) {
                                            addressLines.push(`${address.postalCode} ${address.country}`);
                                        }

                                        return addressLines.map((line, index) => (
                                            <Typography
                                                key={index}
                                                variant="body2"
                                                sx={{
                                                    fontSize: '12px',
                                                    lineHeight: 1.3,
                                                    color: 'primary.main'
                                                }}
                                            >
                                                {line}
                                            </Typography>
                                        ));
                                    })()}
                                </Box>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Ship To</Typography>
                                <Box
                                    sx={{
                                        mb: 1,
                                        cursor: 'pointer',
                                        '&:hover': {
                                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                            borderRadius: 1
                                        },
                                        p: 0.5,
                                        borderRadius: 1
                                    }}
                                    onClick={() => handleOpenMap('shipTo')}
                                >
                                    {(() => {
                                        const address = shipment?.shipTo;
                                        if (!address) return <Typography variant="body2" sx={{ fontSize: '12px' }}>N/A</Typography>;

                                        const addressLines = [];
                                        if (address.company) addressLines.push(address.company);
                                        if (address.street) addressLines.push(address.street);
                                        if (address.street2) addressLines.push(address.street2);
                                        if (address.city && address.state) {
                                            addressLines.push(`${address.city}, ${address.state}`);
                                        }
                                        if (address.postalCode && address.country) {
                                            addressLines.push(`${address.postalCode} ${address.country}`);
                                        }

                                        return addressLines.map((line, index) => (
                                            <Typography
                                                key={index}
                                                variant="body2"
                                                sx={{
                                                    fontSize: '12px',
                                                    lineHeight: 1.3,
                                                    color: 'primary.main',
                                                    '&:hover': {
                                                        textDecoration: 'underline'
                                                    }
                                                }}
                                            >
                                                {line}
                                            </Typography>
                                        ));
                                    })()}
                                </Box>
                            </Box>
                            <Box>
                                <Button
                                    size="small"
                                    startIcon={<RouteIcon />}
                                    variant="contained"
                                    color="primary"
                                    fullWidth
                                    onClick={() => handleOpenMap('route')}
                                    sx={{ fontSize: '0.75rem', height: '28px' }}
                                >
                                    View Route
                                </Button>
                            </Box>
                        </Stack>
                    </Box>
                </Grid>
            </Grid>

            {/* Map Dialog */}
            <Dialog
                open={!!openMap}
                onClose={handleCloseMap}
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
                        <LocationOnIcon color="primary" />
                        <Typography variant="h6">
                            {openMap === 'route'
                                ? `Route: ${(() => {
                                    const fromAddress = getAddress(shipment, 'shipFrom');
                                    const toAddress = getAddress(shipment, 'shipTo');
                                    const fromCity = fromAddress?.city || 'Unknown';
                                    const fromState = fromAddress?.state || '';
                                    const toCity = toAddress?.city || 'Unknown';
                                    const toState = toAddress?.state || '';

                                    const fromLocation = fromState ? `${fromCity}, ${fromState}` : fromCity;
                                    const toLocation = toState ? `${toCity}, ${toState}` : toCity;

                                    return `${fromLocation} → ${toLocation}`;
                                })()}`
                                : openMap === 'shipFrom'
                                    ? `Origin: ${formatAddress(getAddress(shipment, openMap)) || 'N/A'}`
                                    : `Destination: ${formatAddress(getAddress(shipment, openMap)) || 'N/A'}`
                            }
                        </Typography>
                    </Box>
                    <IconButton onClick={handleCloseMap}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0, height: '100%' }}>
                    {renderMap()}
                </DialogContent>
            </Dialog>
        </Grid >
    );
};

export default ShipmentInformation; 