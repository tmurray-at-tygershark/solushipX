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
    loading = false,
    onDebugInfo = () => { } // Callback to send debug info to parent
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

        // Define addresses at function scope so they're available in catch blocks
        const originAddress = formatAddress(shipmentData.shipFrom);
        const destinationAddress = formatAddress(shipmentData.shipTo);

        try {
            console.log('🗺️ [TrackingRouteMap] Raw address data:', {
                shipFrom: shipmentData.shipFrom,
                shipTo: shipmentData.shipTo,
                originFormatted: originAddress,
                destinationFormatted: destinationAddress
            });

            if (!originAddress || !destinationAddress) {
                console.error('❌ [TrackingRouteMap] Missing addresses:', { originAddress, destinationAddress });
                throw new Error('Missing origin or destination address');
            }

            console.log('🗺️ [TrackingRouteMap] Using advanced routing logic from ShipmentDetailX...');

            // Step 1: Geocode both addresses first (like ShipmentDetailX)
            const geocodeAddress = async (address, type) => {
                return new Promise((resolve, reject) => {
                    const geocoder = new window.google.maps.Geocoder();

                    console.log(`Attempting to geocode ${type} address:`, address);

                    geocoder.geocode({
                        address: address,
                        region: shipmentData.shipFrom?.country?.toLowerCase() || 'us'
                    }, (results, status) => {
                        if (status === 'OK' && results && results.length > 0) {
                            console.log(`${type} geocoding successful:`, {
                                address: results[0].formatted_address,
                                location: results[0].geometry.location.toJSON(),
                                placeId: results[0].place_id
                            });
                            resolve(results[0]);
                        } else {
                            console.error(`${type} geocoding failed:`, status);
                            reject(new Error(`Geocoding failed for ${type}: ${status}`));
                        }
                    });
                });
            };

            // Check if Google Maps is loaded
            if (!window.google || !window.google.maps) {
                throw new Error('Google Maps not loaded - falling back to simple routing');
            }

            // Geocode both addresses
            const [originResult, destinationResult] = await Promise.all([
                geocodeAddress(originAddress, 'origin'),
                geocodeAddress(destinationAddress, 'destination')
            ]);

            // Step 2: Use Google Routes API v2 with geocoded coordinates (like ShipmentDetailX)
            const routeRequestBody = {
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

            // Add region code if available
            if (shipmentData.shipFrom?.country) {
                const countryCode = shipmentData.shipFrom.country.toLowerCase();
                if (countryCode.length === 2) {
                    routeRequestBody.regionCode = countryCode;
                }
            }

            console.log('🗺️ [TrackingRouteMap] Advanced route request:', routeRequestBody);

            const routeResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': mapsApiKey,
                    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs'
                },
                body: JSON.stringify(routeRequestBody)
            });

            console.log('🗺️ [TrackingRouteMap] Route response status:', routeResponse.status);

            if (!routeResponse.ok) {
                const errorData = await routeResponse.json();
                console.error('❌ [TrackingRouteMap] Routes API error response:', errorData);
                throw new Error(`Route calculation failed: ${errorData.error?.message || routeResponse.statusText}`);
            }

            const routeData = await routeResponse.json();

            if (!routeData.routes || routeData.routes.length === 0) {
                console.error('❌ [TrackingRouteMap] No routes in API response:', routeData);
                throw new Error('No routes found in the response');
            }

            const route = routeData.routes[0];

            if (!route.polyline || !route.polyline.encodedPolyline) {
                console.error('❌ [TrackingRouteMap] Route polyline data is missing');
                throw new Error('Route polyline data is missing');
            }

            const polyline = route.polyline.encodedPolyline;
            const distanceMeters = route.distanceMeters;
            const durationInSeconds = parseInt(route.duration);
            const durationInMinutes = Math.round(durationInSeconds / 60);

            // Determine distance display format (like ShipmentDetailX)
            const originCountry = shipmentData.shipFrom?.country?.toUpperCase() || 'US';
            const destinationCountry = shipmentData.shipTo?.country?.toUpperCase() || 'US';
            const isCanadaToCanada = originCountry === 'CA' && destinationCountry === 'CA';

            let distanceDisplay;
            if (isCanadaToCanada) {
                const distanceKm = Math.round(distanceMeters / 1000);
                distanceDisplay = `${distanceKm} km`;
            } else {
                const distanceMiles = Math.round(distanceMeters * 0.000621371);
                distanceDisplay = `${distanceMiles} mi`;
            }

            console.log('🗺️ [TrackingRouteMap] Advanced route calculated successfully:', {
                distance: distanceDisplay,
                duration: `${durationInMinutes} mins`,
                polylineLength: polyline.length
            });

            setRouteInfo({
                distance: distanceDisplay,
                duration: `${durationInMinutes} mins`
            });

            // Step 3: Calculate optimal zoom and center using geocoded results (like ShipmentDetailX)
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend(originResult.geometry.location);
            bounds.extend(destinationResult.geometry.location);

            const center = bounds.getCenter();
            const centerLat = center.lat();
            const centerLng = center.lng();

            // Calculate zoom based on distance (like ShipmentDetailX)
            const latDiff = Math.abs(originResult.geometry.location.lat() - destinationResult.geometry.location.lat());
            const lngDiff = Math.abs(originResult.geometry.location.lng() - destinationResult.geometry.location.lng());
            const maxDiff = Math.max(latDiff, lngDiff);

            let zoom;
            if (maxDiff > 50) zoom = 3;
            else if (maxDiff > 20) zoom = 4;
            else if (maxDiff > 10) zoom = 5;
            else if (maxDiff > 5) zoom = 6;
            else if (maxDiff > 2) zoom = 7;
            else if (maxDiff > 1) zoom = 8;
            else if (maxDiff > 0.5) zoom = 9;
            else zoom = 10;

            // Step 4: Generate static map URL with advanced polyline (like ShipmentDetailX)
            const baseUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
                `size=1600x600&` +
                `scale=2&` +
                `format=png&` +
                `maptype=roadmap&` +
                `zoom=${zoom}&` +
                `center=${centerLat},${centerLng}&` +
                `key=${mapsApiKey}&` +
                `markers=size:mid|color:green|label:A|${encodeURIComponent(originAddress)}&` +
                `markers=size:mid|color:red|label:B|${encodeURIComponent(destinationAddress)}`;

            // Try enhanced polyline path (like ShipmentDetailX)
            const pathParam = `&path=color:0x0066cc|weight:4|enc:${polyline}`;
            const totalLength = baseUrl.length + pathParam.length;

            let staticMapUrl = baseUrl;
            if (totalLength < 8000) {
                staticMapUrl += pathParam;
                console.log('✅ [TrackingRouteMap] Using advanced route polyline with color and weight');
            } else {
                console.log('⚠️ [TrackingRouteMap] Polyline too long, using markers only');
            }

            console.log('🖼️ Advanced static map URL generated:', staticMapUrl);

            setMapImageUrl(staticMapUrl);
            setIsCalculating(false);

        } catch (error) {
            console.error('❌ [TrackingRouteMap] Error calculating route:', error);

            // Try fallback with older Directions API
            try {
                console.log('🔄 [TrackingRouteMap] Trying fallback with Directions API...');

                const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?` +
                    `origin=${encodeURIComponent(originAddress)}&` +
                    `destination=${encodeURIComponent(destinationAddress)}&` +
                    `key=${mapsApiKey}`;

                const directionsResponse = await fetch(directionsUrl);

                if (directionsResponse.ok) {
                    const directionsData = await directionsResponse.json();

                    if (directionsData.routes && directionsData.routes.length > 0) {
                        const route = directionsData.routes[0];
                        const overviewPolyline = route.overview_polyline?.points;

                        if (overviewPolyline) {
                            console.log('✅ [TrackingRouteMap] Got polyline from Directions API');

                            // Calculate optimal zoom and center
                            const { center, zoom } = await calculateOptimalZoomAndCenter(originAddress, destinationAddress);

                            const baseUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
                                `size=1600x600&` +
                                `scale=2&` +
                                `format=png&` +
                                `maptype=roadmap&` +
                                `zoom=${zoom}&` +
                                `key=${mapsApiKey}&` +
                                `markers=size:mid|color:green|label:A|${encodeURIComponent(originAddress)}&` +
                                `markers=size:mid|color:red|label:B|${encodeURIComponent(destinationAddress)}`;

                            const centerParam = center ? `&center=${center}` : '';
                            const pathParam = `&path=color:0x0066cc|weight:4|enc:${overviewPolyline}`;

                            let staticMapUrl = baseUrl + centerParam;
                            const totalLength = staticMapUrl.length + pathParam.length;

                            if (totalLength < 8000) {
                                staticMapUrl += pathParam;
                                console.log('✅ [TrackingRouteMap] Using Directions API polyline');
                                setMapImageUrl(staticMapUrl);
                                setIsCalculating(false);
                                return; // Success - exit here
                            }
                        }
                    }
                }
            } catch (directionsError) {
                console.error('❌ [TrackingRouteMap] Directions API fallback also failed:', directionsError);
            }

            // Final fallback to simple markers without route
            try {
                const fallbackOriginAddress = formatAddress(shipmentData.shipFrom);
                const fallbackDestinationAddress = formatAddress(shipmentData.shipTo);

                console.log('🔄 [TrackingRouteMap] Fallback addresses:', {
                    origin: fallbackOriginAddress,
                    destination: fallbackDestinationAddress
                });

                if (!fallbackOriginAddress || !fallbackDestinationAddress) {
                    throw new Error('Fallback addresses are also missing');
                }

                // Calculate optimal zoom for fallback too
                const { center: fallbackCenter, zoom: fallbackZoom } = await calculateOptimalZoomAndCenter(fallbackOriginAddress, fallbackDestinationAddress);

                let fallbackUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
                    `size=1600x600&` +
                    `scale=2&` +
                    `format=png&` +
                    `maptype=roadmap&` +
                    `zoom=${fallbackZoom}&` +
                    `key=${mapsApiKey}&` +
                    `markers=size:mid|color:green|label:A|${encodeURIComponent(fallbackOriginAddress)}&` +
                    `markers=size:mid|color:red|label:B|${encodeURIComponent(fallbackDestinationAddress)}`;

                // Add center if calculated
                if (fallbackCenter) {
                    fallbackUrl += `&center=${fallbackCenter}`;
                }

                // Try to add a simple straight line path between the two points
                try {
                    const straightLinePath = `&path=color:0x0066cc|weight:2|${encodeURIComponent(fallbackOriginAddress)}|${encodeURIComponent(fallbackDestinationAddress)}`;
                    if ((fallbackUrl.length + straightLinePath.length) < 7500) { // Leave room for safety
                        fallbackUrl += straightLinePath;
                        console.log('🔄 [TrackingRouteMap] Added straight line path to fallback');

                    }
                } catch (pathError) {
                    console.log('⚠️ [TrackingRouteMap] Could not add straight line path:', pathError);
                }

                console.log('🔄 [TrackingRouteMap] Using fallback map without route');
                console.log('🔄 [TrackingRouteMap] Fallback URL:', fallbackUrl);

                setMapImageUrl(fallbackUrl);
                setIsCalculating(false);
            } catch (fallbackError) {
                console.error('❌ [TrackingRouteMap] Fallback also failed:', fallbackError);

                // Last resort: simple map with just the API key
                const lastResortUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
                    `size=1600x600&` +
                    `scale=2&` +
                    `format=png&` +
                    `maptype=roadmap&` +
                    `zoom=6&` +
                    `center=45.421532,-75.697189&` + // Ottawa, Canada as default center
                    `key=${mapsApiKey}`;

                console.log('🆘 [TrackingRouteMap] Using last resort map');
                console.log('🆘 [TrackingRouteMap] Last resort URL:', lastResortUrl);
                setMapImageUrl(lastResortUrl);
                setIsCalculating(false);
            }
        }
    };

    useEffect(() => {
        const fetchMapsApiKey = async () => {
            try {
                console.log('🗺️ [TrackingRouteMap] Fetching Maps API key...');

                // Mobile debugging information
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                console.log('🗺️ [TrackingRouteMap] Device Info:', {
                    isMobile,
                    userAgent: navigator.userAgent,
                    onLine: navigator.onLine
                });

                const keysSnapshot = await getDocs(collection(db, 'keys'));
                console.log('🗺️ [TrackingRouteMap] Keys query completed. Empty?:', keysSnapshot.empty, 'Size:', keysSnapshot.size);

                if (!keysSnapshot.empty) {
                    const firstDoc = keysSnapshot.docs[0];
                    const keyData = firstDoc.data();
                    console.log('🗺️ [TrackingRouteMap] Key document data keys:', Object.keys(keyData));

                    const key = keyData.googleAPI;
                    if (key) {
                        console.log('✅ [TrackingRouteMap] Maps API key found:', key.substring(0, 10) + '...');

                        setMapsApiKey(key);
                    } else {
                        console.warn('❌ [TrackingRouteMap] Google Maps API key not found in keys collection');

                        setMapError('Maps configuration not available');
                    }
                } else {
                    console.warn('❌ [TrackingRouteMap] Keys collection is empty');
                    setMapError('Maps configuration not available');
                }
            } catch (error) {
                console.error('❌ [TrackingRouteMap] Error fetching Maps API key:', error);

                console.error('❌ [TrackingRouteMap] Error details:', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                });
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