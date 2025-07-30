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
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

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

        // Check if Google Maps is loaded
        if (!window.google || !window.google.maps) {
            console.error('❌ [TrackingRouteMap] Google Maps not loaded yet');
            setMapError('Google Maps is still loading. Please wait...');
            setIsCalculating(false);
            return;
        }

        // Check if API key is available
        if (!mapsApiKey) {
            console.error('❌ [TrackingRouteMap] Google Maps API key not available');
            setMapError('Google Maps API key not available. Please wait...');
            setIsCalculating(false);
            return;
        }

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
            console.log('🗺️ [TrackingRouteMap] Full route API response:', routeData);

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

            // Calculate zoom based on distance (more conservative for long routes)
            const latDiff = Math.abs(originResult.geometry.location.lat() - destinationResult.geometry.location.lat());
            const lngDiff = Math.abs(originResult.geometry.location.lng() - destinationResult.geometry.location.lng());
            const maxDiff = Math.max(latDiff, lngDiff);

            let zoom;
            if (maxDiff > 50) zoom = 2;      // Trans-continental routes
            else if (maxDiff > 25) zoom = 3; // Very long routes like Toronto-Orlando  
            else if (maxDiff > 15) zoom = 4; // Long cross-country
            else if (maxDiff > 10) zoom = 5; // Regional long distance
            else if (maxDiff > 5) zoom = 6;  // State-to-state
            else if (maxDiff > 2) zoom = 7;  // Regional
            else if (maxDiff > 1) zoom = 8;  // City-to-city
            else if (maxDiff > 0.5) zoom = 9; // Local
            else zoom = 10;                   // Very local

            console.log('🗺️ [TrackingRouteMap] Route bounds calculation:', {
                originLat: originResult.geometry.location.lat(),
                originLng: originResult.geometry.location.lng(),
                destinationLat: destinationResult.geometry.location.lat(),
                destinationLng: destinationResult.geometry.location.lng(),
                latDiff,
                lngDiff,
                maxDiff,
                calculatedZoom: zoom
            });

            // Step 4: Generate static map URL with advanced polyline (square format for better height)
            const baseUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
                `size=800x800&` +
                `scale=2&` +
                `format=png&` +
                `maptype=roadmap&` +
                `zoom=${zoom}&` +
                `center=${centerLat},${centerLng}&` +
                `key=${mapsApiKey}&` +
                `markers=size:mid|color:green|label:A|${encodeURIComponent(originAddress)}&` +
                `markers=size:mid|color:red|label:B|${encodeURIComponent(destinationAddress)}`;

            // Try enhanced polyline path (like ShipmentDetailX) with simplification
            let finalPolyline = polyline;
            let pathParam = `&path=color:0x0066cc|weight:4|enc:${finalPolyline}`;
            let totalLength = baseUrl.length + pathParam.length;

            // If the polyline is too long, try to simplify it
            if (totalLength >= 8000) {
                console.log('🔧 [TrackingRouteMap] Polyline too long, attempting simplification...');
                console.log('📏 [TrackingRouteMap] Original polyline length:', polyline.length);

                // Decode polyline to coordinates using Google Maps geometry library
                if (window.google && window.google.maps && window.google.maps.geometry) {
                    try {
                        const path = window.google.maps.geometry.encoding.decodePath(polyline);
                        console.log('📍 [TrackingRouteMap] Original path points:', path.length);

                        // Simplify by taking every Nth point (more aggressive simplification for longer routes)
                        const simplificationFactor = Math.max(2, Math.ceil(path.length / 100));
                        const simplifiedPath = path.filter((point, index) =>
                            index === 0 || index === path.length - 1 || index % simplificationFactor === 0
                        );

                        console.log('📍 [TrackingRouteMap] Simplified path points:', simplifiedPath.length, 'using factor:', simplificationFactor);

                        // Re-encode the simplified path
                        const simplifiedPolyline = window.google.maps.geometry.encoding.encodePath(simplifiedPath);
                        console.log('📏 [TrackingRouteMap] Simplified polyline length:', simplifiedPolyline.length);

                        pathParam = `&path=color:0x0066cc|weight:4|enc:${simplifiedPolyline}`;
                        totalLength = baseUrl.length + pathParam.length;

                        console.log('📏 [TrackingRouteMap] Simplified URL length:', totalLength);

                        if (totalLength < 8000) {
                            finalPolyline = simplifiedPolyline;
                            console.log('✅ [TrackingRouteMap] Using simplified polyline');
                        } else {
                            console.log('⚠️ [TrackingRouteMap] Even simplified polyline too long, using markers only');
                        }
                    } catch (simplifyError) {
                        console.error('❌ [TrackingRouteMap] Error simplifying polyline:', simplifyError);
                    }
                } else {
                    console.log('⚠️ [TrackingRouteMap] Google Maps geometry library not available for simplification');
                }
            }

            let staticMapUrl = baseUrl;
            if (totalLength < 8000) {
                staticMapUrl += pathParam;
                console.log('✅ [TrackingRouteMap] Using route polyline with color and weight');
                console.log('🛣️ [TrackingRouteMap] Polyline data:', finalPolyline.substring(0, 100) + '...');
                console.log('🔢 [TrackingRouteMap] Final URL length:', totalLength);
            } else {
                console.log('⚠️ [TrackingRouteMap] Polyline too long, using markers only');
                console.log('🔢 [TrackingRouteMap] URL would be:', totalLength, 'characters');
            }

            console.log('🖼️ [TrackingRouteMap] Final static map URL:', staticMapUrl.substring(0, 200) + '...');

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

                const keysRef = collection(db, 'keys');
                console.log('🗺️ [TrackingRouteMap] About to query keys collection...');
                console.log('🗺️ [TrackingRouteMap] Keys collection reference:', keysRef);

                // Add timeout to detect hanging queries
                const queryPromise = getDocs(keysRef);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Firestore query timeout after 10 seconds')), 10000)
                );

                console.log('🗺️ [TrackingRouteMap] Starting Firestore query with 10s timeout...');
                const keysSnapshot = await Promise.race([queryPromise, timeoutPromise]);
                console.log('🗺️ [TrackingRouteMap] Keys query completed. Empty?:', keysSnapshot.empty, 'Size:', keysSnapshot.size);

                if (!keysSnapshot.empty) {
                    const firstDoc = keysSnapshot.docs[0];
                    const keyData = firstDoc.data();
                    const key = keyData.googleAPI;
                    if (key) {
                        console.log('✅ [TrackingRouteMap] Maps API key found and loaded successfully');

                        setMapsApiKey(key);

                        // Load Google Maps script if not already loaded
                        if (!window.google || !window.google.maps) {
                            console.log('🔄 [TrackingRouteMap] Loading Google Maps script...');
                            const script = document.createElement('script');
                            script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry,places`;
                            script.async = true;
                            script.defer = true;

                            script.onload = () => {
                                console.log('✅ [TrackingRouteMap] Google Maps script loaded successfully');
                                setIsGoogleMapsLoaded(true);
                                // Don't trigger route calculation here - let the second useEffect handle it
                                // when both mapsApiKey state and Google Maps are ready
                            };

                            script.onerror = (error) => {
                                console.error('❌ [TrackingRouteMap] Failed to load Google Maps script:', error);
                                setMapError('Failed to load Google Maps script');
                            };

                            // Check if script already exists
                            const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
                            if (!existingScript) {
                                document.head.appendChild(script);
                            } else {
                                console.log('🔄 [TrackingRouteMap] Google Maps script already exists, waiting for load...');
                                // Wait for existing script to load
                                const checkMaps = setInterval(() => {
                                    if (window.google && window.google.maps) {
                                        console.log('✅ [TrackingRouteMap] Google Maps loaded from existing script');
                                        setIsGoogleMapsLoaded(true);
                                        clearInterval(checkMaps);
                                        // Don't trigger route calculation here - let the second useEffect handle it
                                        // when both mapsApiKey state and Google Maps are ready
                                    }
                                }, 500);

                                // Clean up after 15 seconds if not loaded
                                setTimeout(() => {
                                    clearInterval(checkMaps);
                                    if (!window.google || !window.google.maps) {
                                        console.log('⚠️ [TrackingRouteMap] Google Maps failed to load within 15 seconds');
                                        setMapError('Failed to load Google Maps within timeout');
                                    }
                                }, 15000);
                            }
                        } else {
                            console.log('✅ [TrackingRouteMap] Google Maps already loaded');
                        }
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
        if (mapsApiKey && shipmentData && shipmentData.shipFrom && shipmentData.shipTo && isGoogleMapsLoaded) {
            console.log('🗺️ [TrackingRouteMap] All conditions met, calculating route...', {
                hasMapsApiKey: !!mapsApiKey,
                hasShipmentData: !!shipmentData,
                hasAddresses: !!(shipmentData?.shipFrom && shipmentData?.shipTo),
                isGoogleMapsLoaded: !!isGoogleMapsLoaded
            });
            calculateRouteAndGenerateMap();
        } else {
            console.log('🗺️ [TrackingRouteMap] Waiting for dependencies...', {
                hasMapsApiKey: !!mapsApiKey,
                hasShipmentData: !!shipmentData,
                hasAddresses: !!(shipmentData?.shipFrom && shipmentData?.shipTo),
                isGoogleMapsLoaded: !!isGoogleMapsLoaded,
                shipFromData: shipmentData?.shipFrom ? 'Present' : 'Missing',
                shipToData: shipmentData?.shipTo ? 'Present' : 'Missing',
                mapsApiKeyLength: mapsApiKey ? `${mapsApiKey.length} chars` : 'None'
            });

            // Call onDebugInfo to send debug info to parent component
            if (onDebugInfo) {
                onDebugInfo({
                    status: 'waiting_for_dependencies',
                    missing: {
                        mapsApiKey: !mapsApiKey,
                        shipmentData: !shipmentData,
                        addresses: !shipmentData?.shipFrom || !shipmentData?.shipTo,
                        googleMapsLoaded: !isGoogleMapsLoaded
                    }
                });
            }
        }
    }, [mapsApiKey, shipmentData, isGoogleMapsLoaded]);

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

    // Show helpful message if conditions aren't met
    if (!mapsApiKey || !shipmentData?.shipFrom || !shipmentData?.shipTo || !isGoogleMapsLoaded) {
        const missingItems = [];
        if (!mapsApiKey) missingItems.push('Maps API key');
        if (!shipmentData?.shipFrom) missingItems.push('Origin address');
        if (!shipmentData?.shipTo) missingItems.push('Destination address');
        if (!isGoogleMapsLoaded) missingItems.push('Google Maps library');

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
                    severity="info"
                    icon={<ScheduleIcon />}
                    sx={{ maxWidth: 400, textAlign: 'center' }}
                >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Route map unavailable
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                        Missing: {missingItems.join(', ')}
                    </Typography>
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

            {/* Clean Map Container - Square format for better route visibility */}
            <Box sx={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1', // Makes it square regardless of container width
                overflow: 'hidden',
                borderRadius: 1,
                maxWidth: 800, // Limit maximum size
                mx: 'auto' // Center the map
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