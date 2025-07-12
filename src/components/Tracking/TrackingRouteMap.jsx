import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    Grid,
    Card,
    CardContent,
    Divider
} from '@mui/material';
import {
    LocationOn as LocationIcon,
    Error as ErrorIcon,
    Schedule as ScheduleIcon,
    Straighten as DistanceIcon
} from '@mui/icons-material';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

const TrackingRouteMap = ({
    shipmentData,
    carrier,
    height = 600,
    loading = false
}) => {
    const [mapImageUrl, setMapImageUrl] = useState(null);
    const [mapError, setMapError] = useState(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [routeInfo, setRouteInfo] = useState(null);
    const [mapsApiKey, setMapsApiKey] = useState(null);

    // Format addresses for API
    const formatAddress = (address) => {
        if (!address) return '';
        const parts = [
            address.street,
            address.city,
            address.state || address.province,
            address.zipCode || address.postalCode,
            address.country
        ].filter(Boolean);
        return parts.join(', ');
    };

    // Function to calculate optimal zoom level and center for two points
    const calculateOptimalZoomAndCenter = async (originAddress, destinationAddress) => {
        try {
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?key=${mapsApiKey}`;

            // Geocode both addresses
            const [originResponse, destResponse] = await Promise.all([
                fetch(`${geocodeUrl}&address=${encodeURIComponent(originAddress)}`),
                fetch(`${geocodeUrl}&address=${encodeURIComponent(destinationAddress)}`)
            ]);

            const [originData, destData] = await Promise.all([
                originResponse.json(),
                destResponse.json()
            ]);

            if (originData.results?.[0] && destData.results?.[0]) {
                const originLat = originData.results[0].geometry.location.lat;
                const originLng = originData.results[0].geometry.location.lng;
                const destLat = destData.results[0].geometry.location.lat;
                const destLng = destData.results[0].geometry.location.lng;

                // Calculate center point
                const centerLat = (originLat + destLat) / 2;
                const centerLng = (originLng + destLng) / 2;

                // Calculate distance between points (in degrees)
                const latDiff = Math.abs(originLat - destLat);
                const lngDiff = Math.abs(originLng - destLng);
                const maxDiff = Math.max(latDiff, lngDiff);

                // Calculate zoom level based on distance
                let zoom;
                if (maxDiff > 50) zoom = 3;       // Continental (very far apart)
                else if (maxDiff > 20) zoom = 4;  // Multi-country/state
                else if (maxDiff > 10) zoom = 5;  // Regional
                else if (maxDiff > 5) zoom = 6;   // State-level
                else if (maxDiff > 2) zoom = 7;   // Metropolitan area
                else if (maxDiff > 1) zoom = 8;   // City-level
                else if (maxDiff > 0.5) zoom = 9; // Local area
                else zoom = 10;                   // Neighborhood

                return {
                    center: `${centerLat},${centerLng}`,
                    zoom: zoom
                };
            } else {
                // Fallback if geocoding fails
                return { center: null, zoom: 6 };
            }
        } catch (error) {
            console.error('❌ [TrackingRouteMap] Geocoding failed:', error);
            return { center: null, zoom: 6 };
        }
    };

    const calculateRouteAndGenerateMap = async () => {
        setIsCalculating(true);
        setMapError(null);

        try {
            const originAddress = formatAddress(shipmentData.shipFrom);
            const destinationAddress = formatAddress(shipmentData.shipTo);

            if (!originAddress || !destinationAddress) {
                throw new Error('Missing origin or destination address');
            }

            console.log('🗺️ [TrackingRouteMap] Calculating route...');
            console.log('📍 Origin:', originAddress);
            console.log('📍 Destination:', destinationAddress);

            // Calculate route using Google Routes API v2
            const routeResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': mapsApiKey,
                    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
                },
                body: JSON.stringify({
                    origin: {
                        address: originAddress
                    },
                    destination: {
                        address: destinationAddress
                    },
                    travelMode: 'DRIVE',
                    routingPreference: 'TRAFFIC_AWARE',
                    computeAlternativeRoutes: false,
                    routeModifiers: {
                        avoidTolls: false,
                        avoidHighways: false,
                        avoidFerries: false
                    }
                })
            });

            if (!routeResponse.ok) {
                throw new Error(`Routes API failed: ${routeResponse.status}`);
            }

            const routeData = await routeResponse.json();

            if (!routeData.routes || routeData.routes.length === 0) {
                throw new Error('No route found');
            }

            const route = routeData.routes[0];
            const polyline = route.polyline.encodedPolyline;
            const distanceMeters = route.distanceMeters;
            const durationSeconds = parseInt(route.duration.replace('s', ''));

            // Convert to display format
            const distanceMiles = Math.round(distanceMeters * 0.000621371);
            const durationMinutes = Math.round(durationSeconds / 60);

            setRouteInfo({
                distance: `${distanceMiles} mi`,
                duration: `${durationMinutes} mins`
            });

            // Calculate optimal zoom and center
            const { center, zoom } = await calculateOptimalZoomAndCenter(originAddress, destinationAddress);

            // Generate static map URL with route and calculated zoom
            let staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
                `size=1600x600&` +
                `scale=2&` +
                `format=png&` +
                `maptype=roadmap&` +
                `zoom=${zoom}&` +
                `key=${mapsApiKey}&` +
                `path=enc:${polyline}&` +
                `markers=size:tiny|color:green|${encodeURIComponent(originAddress)}&` +
                `markers=size:tiny|color:red|${encodeURIComponent(destinationAddress)}`;

            // Add center if calculated
            if (center) {
                staticMapUrl += `&center=${center}`;
            }

            console.log('✅ [TrackingRouteMap] Route calculated successfully');
            console.log('🖼️ Static map URL generated:', staticMapUrl);

            setMapImageUrl(staticMapUrl);
            setIsCalculating(false);

        } catch (error) {
            console.error('❌ [TrackingRouteMap] Error calculating route:', error);

            // Fallback to simple markers without route
            try {
                const fallbackOriginAddress = formatAddress(shipmentData.shipFrom);
                const fallbackDestinationAddress = formatAddress(shipmentData.shipTo);

                // Calculate optimal zoom for fallback too
                const { center: fallbackCenter, zoom: fallbackZoom } = await calculateOptimalZoomAndCenter(fallbackOriginAddress, fallbackDestinationAddress);

                let fallbackUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
                    `size=1600x600&` +
                    `scale=2&` +
                    `format=png&` +
                    `maptype=roadmap&` +
                    `zoom=${fallbackZoom}&` +
                    `key=${mapsApiKey}&` +
                    `markers=size:tiny|color:green|${encodeURIComponent(fallbackOriginAddress)}&` +
                    `markers=size:tiny|color:red|${encodeURIComponent(fallbackDestinationAddress)}`;

                // Add center if calculated
                if (fallbackCenter) {
                    fallbackUrl += `&center=${fallbackCenter}`;
                }

                console.log('🔄 [TrackingRouteMap] Using fallback map without route');
                setMapImageUrl(fallbackUrl);
                setIsCalculating(false);
            } catch (fallbackError) {
                console.error('❌ [TrackingRouteMap] Fallback also failed:', fallbackError);
                setMapError('Unable to load map');
                setIsCalculating(false);
            }
        }
    };

    useEffect(() => {
        const fetchMapsApiKey = async () => {
            try {
                const keysSnapshot = await getDocs(collection(db, 'keys'));

                if (!keysSnapshot.empty) {
                    const firstDoc = keysSnapshot.docs[0];
                    const key = firstDoc.data().googleAPI;
                    if (key) {
                        setMapsApiKey(key);
                    } else {
                        console.warn('Google Maps API key not found in keys collection');
                        setMapError('Maps configuration not available');
                    }
                } else {
                    console.warn('Keys collection is empty');
                    setMapError('Maps configuration not available');
                }
            } catch (error) {
                console.error('Error fetching Maps API key:', error);
                setMapError('Failed to load maps configuration');
            }
        };

        fetchMapsApiKey();
    }, []);

    useEffect(() => {
        if (mapsApiKey && shipmentData && shipmentData.shipFrom && shipmentData.shipTo) {
            calculateRouteAndGenerateMap();
        }
    }, [mapsApiKey, shipmentData]);

    if (loading || isCalculating) {
        return (
            <Box sx={{
                height: height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0'
            }}>
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={40} sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                        Loading route information...
                    </Typography>
                </Box>
            </Box>
        );
    }

    if (mapError) {
        return (
            <Box sx={{
                height: height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0'
            }}>
                <Alert
                    severity="error"
                    icon={<ErrorIcon />}
                    sx={{ maxWidth: 400 }}
                >
                    {mapError}
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ bgcolor: '#ffffff', position: 'relative' }}>
            {/* Compact Route Info Badge */}
            {routeInfo && (
                <Box sx={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    zIndex: 10,
                    display: 'flex',
                    gap: 1
                }}>
                    <Card sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <DistanceIcon sx={{ fontSize: 16, color: '#64748b' }} />
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.8rem' }}>
                                    {routeInfo.distance}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Box>
            )}

            {/* Clean Map Container */}
            <Box sx={{
                position: 'relative',
                height: height,
                overflow: 'hidden',
                borderRadius: 1
            }}>
                {mapImageUrl && (
                    <img
                        src={mapImageUrl}
                        alt="Shipment Route Map"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block'
                        }}
                        onError={(e) => {
                            console.error('❌ [TrackingRouteMap] Failed to load map image');
                            console.error('❌ Image URL:', mapImageUrl);
                            console.error('❌ Error details:', e);
                            setMapError('Failed to load map image');
                        }}
                    />
                )}


            </Box>
        </Box>
    );
};

export default TrackingRouteMap; 