import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    CircularProgress
} from '@mui/material';
import { Close as CloseIcon, Map as MapIcon, LocationOn as LocationOnIcon } from '@mui/icons-material';
import { GoogleMap, Marker, DirectionsRenderer, StreetViewPanorama } from '@react-google-maps/api';
import { db } from '../../../firebase';
import { collection, getDocs } from 'firebase/firestore';

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

const LocationMaps = ({ shipment, formatAddress, getAddress }) => {
    const [openMap, setOpenMap] = useState(null);
    const [geocodedPosition, setGeocodedPosition] = useState(null);
    const [geocodingLoading, setGeocodingLoading] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [directions, setDirections] = useState(null);
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

    // Check if Google Maps is already loaded globally (from Globe component)
    useEffect(() => {
        const checkGoogleMaps = () => {
            if (window.google && window.google.maps) {
                setIsGoogleMapsLoaded(true);
                setMapError(null);
            } else {
                // If not loaded, try again in a short interval
                setTimeout(checkGoogleMaps, 100);
            }
        };
        checkGoogleMaps();
    }, []);

    useEffect(() => {
        if (!openMap || !shipment || !isGoogleMapsLoaded) return;
        setGeocodedPosition(null);
        setDirections(null);
        setMapError(null);
        setGeocodingLoading(true);

        if (openMap === 'route') {
            // Handle route calculation
            const geocode = (address) => {
                return new Promise((resolve, reject) => {
                    if (!address) {
                        reject(new Error('No address provided'));
                        return;
                    }
                    const geocoder = new window.google.maps.Geocoder();
                    const addressString = formatAddress(address).replace(/\n/g, ', ');
                    geocoder.geocode({ address: addressString }, (results, status) => {
                        if (status === 'OK' && results && results[0]) {
                            resolve(results[0]);
                        } else {
                            reject(new Error('Geocoding failed: ' + status));
                        }
                    });
                });
            };

            (async () => {
                try {
                    const fromAddress = getAddress(shipment, 'shipFrom');
                    const toAddress = getAddress(shipment, 'shipTo');

                    if (!fromAddress || !toAddress) {
                        setMapError('Missing origin or destination address');
                        setGeocodingLoading(false);
                        return;
                    }

                    const [originResult, destResult] = await Promise.all([
                        geocode(fromAddress),
                        geocode(toAddress)
                    ]);

                    // Use Routes API v2 instead of legacy DirectionsService
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
                        destination: destResult.place_id ?
                            { placeId: destResult.place_id } :
                            {
                                location: {
                                    latLng: {
                                        latitude: destResult.geometry.location.lat(),
                                        longitude: destResult.geometry.location.lng()
                                    }
                                }
                            },
                        travelMode: "DRIVE",
                        routingPreference: "TRAFFIC_UNAWARE",
                        computeAlternativeRoutes: false,
                        languageCode: "en-US",
                        units: "IMPERIAL"
                    };

                    // Get API key from Firestore (same as ShipmentDetailX)
                    const keysRef = collection(db, 'keys');
                    const keysSnapshot = await getDocs(keysRef);
                    let apiKey = null;

                    if (!keysSnapshot.empty) {
                        const firstDoc = keysSnapshot.docs[0];
                        apiKey = firstDoc.data().googleAPI;
                    }

                    if (!apiKey) {
                        throw new Error('No API key found');
                    }

                    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Goog-Api-Key': apiKey,
                            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.legs.duration,routes.legs.distanceMeters,routes.legs.startLocation,routes.legs.endLocation'
                        },
                        body: JSON.stringify(requestBody)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(`Route calculation failed: ${errorData.error?.message || response.statusText}`);
                    }

                    const routeData = await response.json();

                    if (!routeData.routes || routeData.routes.length === 0) {
                        throw new Error('No routes found in the response');
                    }

                    const route = routeData.routes[0];

                    if (!route.polyline || !route.polyline.encodedPolyline) {
                        throw new Error('Route polyline data is missing');
                    }

                    const decodedPath = window.google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
                    const durationInSeconds = parseInt(route.duration);
                    const durationInMinutes = Math.round(durationInSeconds / 60);

                    // Create a properly structured directions object
                    const directionsResult = {
                        routes: [{
                            legs: [{
                                start_location: originResult.geometry.location,
                                end_location: destResult.geometry.location,
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
                                    end_location: destResult.geometry.location,
                                    instructions: "Follow the route",
                                    path: decodedPath
                                }]
                            }],
                            overview_path: decodedPath,
                            bounds: new window.google.maps.LatLngBounds(originResult.geometry.location, destResult.geometry.location),
                            copyrights: "© Google Maps",
                            warnings: [],
                            waypoint_order: [],
                            overview_polyline: {
                                points: route.polyline.encodedPolyline
                            }
                        }],
                        request: {
                            origin: originResult.geometry.location,
                            destination: destResult.geometry.location,
                            travelMode: "DRIVING"
                        },
                        status: "OK",
                        geocoded_waypoints: [
                            { status: "OK", place_id: originResult.place_id },
                            { status: "OK", place_id: destResult.place_id }
                        ]
                    };

                    setDirections(directionsResult);
                    setMapError(null);
                    setGeocodingLoading(false);
                } catch (err) {
                    setDirections(null);
                    setMapError('Geocoding error: ' + err.message);
                    setGeocodingLoading(false);
                }
            })();
        } else {
            // Handle single location
            const addressObj = getAddress(shipment, openMap);
            if (!addressObj) {
                setMapError('No address available');
                setGeocodingLoading(false);
                return;
            }

            const addressString = formatAddress(addressObj).replace(/\n/g, ', ');
            const geocoder = new window.google.maps.Geocoder();

            geocoder.geocode({ address: addressString }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    setGeocodedPosition(results[0].geometry.location);
                    setMapError(null);
                } else {
                    setMapError('Failed to geocode address: ' + status);
                }
                setGeocodingLoading(false);
            });
        }
    }, [openMap, shipment, isGoogleMapsLoaded, getAddress, formatAddress]);

    const mapContainerStyle = {
        width: '100%',
        height: '100%'
    };

    const mapOptions = {
        styles: mapStyles,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: true,
        mapTypeControl: false,
        fullscreenControl: true,
        maxZoom: 20,
        minZoom: 5,
        gestureHandling: 'greedy',
        preserveViewport: false
    };

    const handleOpenMap = (type) => {
        setOpenMap(type);
    };

    const handleCloseMap = () => {
        setOpenMap(null);
    };

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
                        zoom={10}
                        options={mapOptions}
                        onLoad={(map) => {
                            map.fitBounds(directions.routes[0].bounds);
                        }}
                    >
                        <DirectionsRenderer
                            directions={directions}
                            options={{
                                polylineOptions: {
                                    strokeColor: '#2196f3',
                                    strokeWeight: 5,
                                    strokeOpacity: 0.8
                                }
                            }}
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
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: openMap === 'shipFrom' ? '#4caf50' : '#99001C',
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 2
                        }}
                    />
                    <StreetViewPanorama
                        position={geocodedPosition}
                        visible={false}
                        options={{
                            enableCloseButton: true,
                            addressControl: true,
                            showRoadLabels: true,
                            zoomControl: true,
                            motionTracking: false,
                            motionTrackingControl: false,
                            fullscreenControl: true,
                            scrollwheel: true,
                            visible: false
                        }}
                    />
                </GoogleMap>
            </Box>
        );
    };

    return (
        <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                    Location Information
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle1" gutterBottom>
                                Ship From
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                                {formatAddress(getAddress(shipment, 'shipFrom'))}
                            </Typography>
                            <Button
                                startIcon={<MapIcon />}
                                onClick={() => handleOpenMap('shipFrom')}
                                sx={{ mt: 1 }}
                            >
                                View Map
                            </Button>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle1" gutterBottom>
                                Ship To
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                                {formatAddress(getAddress(shipment, 'shipTo'))}
                            </Typography>
                            <Button
                                startIcon={<MapIcon />}
                                onClick={() => handleOpenMap('shipTo')}
                                sx={{ mt: 1 }}
                            >
                                View Map
                            </Button>
                        </Box>
                    </Grid>
                    <Grid item xs={12}>
                        <Button
                            startIcon={<MapIcon />}
                            onClick={() => handleOpenMap('route')}
                            variant="outlined"
                            fullWidth
                        >
                            View Route
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            <Dialog
                open={openMap}
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
                                ? 'Route Map'
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
        </Grid>
    );
};

export default LocationMaps; 