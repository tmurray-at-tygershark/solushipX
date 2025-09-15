/**
 * Route Visualization Map Component
 * Interactive map showing pickup/delivery cities with route polylines
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    IconButton,
    Chip,
    CircularProgress,
    FormControlLabel,
    Switch,
    Grid,
    Slider,
    Alert
} from '@mui/material';
import {
    Visibility as ViewIcon,
    VisibilityOff as HideIcon,
    Refresh as RefreshIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    MyLocation as CenterIcon
} from '@mui/icons-material';
import { loadGoogleMaps } from '../../../../utils/googleMapsLoader';

const RouteVisualizationMap = ({
    routes = [],
    pickupCities = [],
    deliveryCities = [],
    selectedRoutes = [],
    onRouteClick,
    height = 400
}) => {
    // Map state
    const mapRef = useRef(null);
    const googleMapRef = useRef(null);
    const markersRef = useRef([]);
    const polylinesRef = useRef([]);

    // UI state
    const [mapLoaded, setMapLoaded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showPickupMarkers, setShowPickupMarkers] = useState(true);
    const [showDeliveryMarkers, setShowDeliveryMarkers] = useState(true);
    const [showRouteLines, setShowRouteLines] = useState(true);
    const [showSelectedOnly, setShowSelectedOnly] = useState(false);
    const [routeOpacity, setRouteOpacity] = useState(0.6);
    const [mapCenter, setMapCenter] = useState({ lat: 43.6532, lng: -79.3832 }); // Toronto default

    // Color schemes for different route types
    const colorSchemes = {
        pickup: '#10b981', // Green
        delivery: '#ef4444', // Red
        dual: '#8b5cf6', // Purple for pickup + delivery
        route: '#3b82f6', // Blue
        selected: '#f59e0b' // Orange for selected routes
    };

    // Initialize Google Maps
    const initializeMap = useCallback(async () => {
        if (!mapRef.current) return;

        try {
            setLoading(true);
            await loadGoogleMaps();

            // Calculate map bounds from all cities
            const allCities = [...pickupCities, ...deliveryCities];
            let bounds = null;
            let center = mapCenter;

            if (allCities.length > 0) {
                bounds = new window.google.maps.LatLngBounds();
                allCities.forEach(city => {
                    if (city.latitude && city.longitude) {
                        bounds.extend(new window.google.maps.LatLng(city.latitude, city.longitude));
                    }
                });
                center = bounds.getCenter();
            }

            // Create map
            const map = new window.google.maps.Map(mapRef.current, {
                center,
                zoom: allCities.length > 0 ? 10 : 8,
                mapTypeId: window.google.maps.MapTypeId.ROADMAP,
                styles: [
                    {
                        featureType: 'poi',
                        elementType: 'labels',
                        stylers: [{ visibility: 'off' }]
                    }
                ],
                mapTypeControl: true,
                streetViewControl: false,
                fullscreenControl: true,
                zoomControl: true
            });

            googleMapRef.current = map;

            // Fit bounds if we have cities
            if (bounds && allCities.length > 1) {
                map.fitBounds(bounds, { padding: 50 });
            }

            setMapLoaded(true);
            console.log('🗺️ Route visualization map initialized');

        } catch (error) {
            console.error('❌ Error initializing map:', error);
        } finally {
            setLoading(false);
        }
    }, [pickupCities, deliveryCities, mapCenter]);

    // Clear all map overlays
    const clearMapOverlays = useCallback(() => {
        // Clear markers
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        // Clear polylines
        polylinesRef.current.forEach(polyline => polyline.setMap(null));
        polylinesRef.current = [];
    }, []);

    // Create city markers with smart overlap detection
    const createCityMarkers = useCallback(() => {
        if (!googleMapRef.current || !mapLoaded) return;

        console.log('📍 Creating city markers with overlap detection...');

        // Create a map to track city locations and detect overlaps
        const cityLocationMap = new Map();

        // First pass: identify all unique locations and their types
        if (showPickupMarkers) {
            pickupCities.forEach(city => {
                if (!city.latitude || !city.longitude) return;
                const key = `${city.latitude}_${city.longitude}`;
                const existing = cityLocationMap.get(key) || { types: [], cities: [] };
                existing.types.push('pickup');
                existing.cities.push(city);
                cityLocationMap.set(key, existing);
            });
        }

        if (showDeliveryMarkers) {
            deliveryCities.forEach(city => {
                if (!city.latitude || !city.longitude) return;
                const key = `${city.latitude}_${city.longitude}`;
                const existing = cityLocationMap.get(key) || { types: [], cities: [] };
                existing.types.push('delivery');
                existing.cities.push(city);
                cityLocationMap.set(key, existing);
            });
        }

        // Second pass: create markers based on location types
        cityLocationMap.forEach((locationData, locationKey) => {
            const [lat, lng] = locationKey.split('_').map(Number);
            const city = locationData.cities[0]; // Use first city for display info
            const types = [...new Set(locationData.types)]; // Remove duplicates

            let markerConfig;
            let title;
            let infoContent;

            if (types.length === 2) {
                // Both pickup and delivery - use special dual marker
                markerConfig = {
                    position: { lat, lng },
                    map: googleMapRef.current,
                    title: `🔄 Pickup & Delivery: ${city.city}, ${city.provinceState}`,
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 10, // Slightly larger
                        fillColor: '#8b5cf6', // Purple for dual locations
                        fillOpacity: 0.9,
                        strokeColor: '#ffffff',
                        strokeWeight: 3 // Thicker border
                    },
                    zIndex: 200 // Higher priority
                };

                infoContent = `
                    <div style="font-size: 12px; padding: 6px;">
                        <strong>🔄 Pickup & Delivery Location</strong><br>
                        ${city.city}, ${city.provinceState}<br>
                        <small style="color: #6b7280;">${city.country}</small><br>
                        <div style="margin-top: 4px; padding: 4px; background: #f3f4f6; border-radius: 4px;">
                            <span style="color: #10b981;">📍 Pickup</span> + <span style="color: #ef4444;">🎯 Delivery</span>
                        </div>
                    </div>
                `;
            } else if (types.includes('pickup')) {
                // Pickup only
                markerConfig = {
                    position: { lat, lng },
                    map: googleMapRef.current,
                    title: `📍 Pickup: ${city.city}, ${city.provinceState}`,
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: colorSchemes.pickup,
                        fillOpacity: 0.8,
                        strokeColor: '#ffffff',
                        strokeWeight: 2
                    },
                    zIndex: 100
                };

                infoContent = `
                    <div style="font-size: 12px; padding: 4px;">
                        <strong>📍 Pickup Location</strong><br>
                        ${city.city}, ${city.provinceState}<br>
                        <small style="color: #6b7280;">${city.country}</small>
                    </div>
                `;
            } else {
                // Delivery only
                markerConfig = {
                    position: { lat, lng },
                    map: googleMapRef.current,
                    title: `🎯 Delivery: ${city.city}, ${city.provinceState}`,
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: colorSchemes.delivery,
                        fillOpacity: 0.8,
                        strokeColor: '#ffffff',
                        strokeWeight: 2
                    },
                    zIndex: 100
                };

                infoContent = `
                    <div style="font-size: 12px; padding: 4px;">
                        <strong>🎯 Delivery Location</strong><br>
                        ${city.city}, ${city.provinceState}<br>
                        <small style="color: #6b7280;">${city.country}</small>
                    </div>
                `;
            }

            // Create the marker
            const marker = new window.google.maps.Marker(markerConfig);

            // Add info window
            const infoWindow = new window.google.maps.InfoWindow({
                content: infoContent
            });

            marker.addListener('click', () => {
                infoWindow.open(googleMapRef.current, marker);
            });

            markersRef.current.push(marker);
        });

        console.log(`✅ Created ${markersRef.current.length} smart city markers (${cityLocationMap.size} unique locations)`);
    }, [pickupCities, deliveryCities, showPickupMarkers, showDeliveryMarkers, mapLoaded, colorSchemes]);

    // Create route polylines
    const createRoutePolylines = useCallback(() => {
        if (!googleMapRef.current || !mapLoaded || !showRouteLines) return;

        console.log('🛣️ Creating route polylines...');

        const routesToShow = showSelectedOnly
            ? routes.filter(route => selectedRoutes.includes(route.id))
            : routes;

        routesToShow.forEach((route, index) => {
            const origin = route.origin;
            const destination = route.destination;

            if (!origin?.latitude || !origin?.longitude ||
                !destination?.latitude || !destination?.longitude) {
                return;
            }

            const isSelected = selectedRoutes.includes(route.id);
            const lineColor = isSelected ? colorSchemes.selected : colorSchemes.route;

            const polyline = new window.google.maps.Polyline({
                path: [
                    { lat: origin.latitude, lng: origin.longitude },
                    { lat: destination.latitude, lng: destination.longitude }
                ],
                geodesic: true,
                strokeColor: lineColor,
                strokeOpacity: routeOpacity,
                strokeWeight: isSelected ? 3 : 2,
                map: googleMapRef.current,
                zIndex: isSelected ? 50 : 10
            });

            // Add click listener
            polyline.addListener('click', () => {
                if (onRouteClick) {
                    onRouteClick(route);
                }

                // Show route info
                const infoWindow = new window.google.maps.InfoWindow({
                    content: `
                        <div style="font-size: 12px; padding: 8px;">
                            <strong>🛣️ ${route.routeName}</strong><br>
                            <div style="margin: 4px 0;">
                                📍 <strong>From:</strong> ${origin.city}, ${origin.provinceState}<br>
                                🎯 <strong>To:</strong> ${destination.city}, ${destination.provinceState}
                            </div>
                            ${route.distance ? `
                                <div style="margin: 4px 0; padding: 4px; background: #f8fafc; border-radius: 4px;">
                                    📏 <strong>Distance:</strong> ${route.distance.km} km (${route.distance.miles} miles)<br>
                                    ⏱️ <strong>Duration:</strong> ${route.duration?.text || 'N/A'}
                                </div>
                            ` : `
                                <div style="margin: 4px 0; padding: 4px; background: #fef3f2; border-radius: 4px; color: #dc2626;">
                                    ⚠️ Distance calculation unavailable
                                </div>
                            `}
                        </div>
                    `,
                    position: {
                        lat: (origin.latitude + destination.latitude) / 2,
                        lng: (origin.longitude + destination.longitude) / 2
                    }
                });

                infoWindow.open(googleMapRef.current);
            });

            polylinesRef.current.push(polyline);
        });

        console.log(`✅ Created ${polylinesRef.current.length} route polylines`);
    }, [routes, selectedRoutes, showRouteLines, showSelectedOnly, routeOpacity, mapLoaded, colorSchemes, onRouteClick]);

    // Update map overlays when settings change
    const updateMapOverlays = useCallback(() => {
        if (!mapLoaded) return;

        clearMapOverlays();
        createCityMarkers();
        createRoutePolylines();
    }, [mapLoaded, clearMapOverlays, createCityMarkers, createRoutePolylines, showPickupMarkers, showDeliveryMarkers, showRouteLines, showSelectedOnly]);

    // Center map on all routes
    const centerMapOnRoutes = useCallback(() => {
        if (!googleMapRef.current || routes.length === 0) return;

        const bounds = new window.google.maps.LatLngBounds();
        let hasValidCoordinates = false;

        routes.forEach(route => {
            if (route.origin?.latitude && route.origin?.longitude) {
                bounds.extend(new window.google.maps.LatLng(route.origin.latitude, route.origin.longitude));
                hasValidCoordinates = true;
            }
            if (route.destination?.latitude && route.destination?.longitude) {
                bounds.extend(new window.google.maps.LatLng(route.destination.latitude, route.destination.longitude));
                hasValidCoordinates = true;
            }
        });

        if (hasValidCoordinates) {
            googleMapRef.current.fitBounds(bounds, { padding: 50 });
        }
    }, [routes]);

    // Initialize map on component mount
    useEffect(() => {
        initializeMap();
    }, [initializeMap]);

    // Update overlays when data or settings change
    useEffect(() => {
        updateMapOverlays();
    }, [updateMapOverlays, showPickupMarkers, showDeliveryMarkers, showRouteLines, showSelectedOnly, routeOpacity]);

    // Statistics
    const stats = {
        totalRoutes: routes.length,
        selectedRoutes: selectedRoutes.length,
        pickupCities: pickupCities.length,
        deliveryCities: deliveryCities.length,
        routesWithDistance: routes.filter(r => r.distance && r.distance.km > 0).length
    };

    return (
        <Paper sx={{ border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {/* Map Controls Header */}
            <Box sx={{
                p: 2,
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                    🗺️ Route Visualization Map
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <IconButton
                        size="small"
                        onClick={centerMapOnRoutes}
                        disabled={routes.length === 0}
                        title="Center on all routes"
                    >
                        <CenterIcon fontSize="small" />
                    </IconButton>

                    <IconButton
                        size="small"
                        onClick={updateMapOverlays}
                        title="Refresh map"
                    >
                        <RefreshIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>

            {/* Map Controls */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={showPickupMarkers}
                                    onChange={(e) => setShowPickupMarkers(e.target.checked)}
                                    size="small"
                                />
                            }
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        backgroundColor: colorSchemes.pickup
                                    }} />
                                    <Typography sx={{ fontSize: '11px' }}>
                                        Pickup ({stats.pickupCities})
                                    </Typography>
                                </Box>
                            }
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={showDeliveryMarkers}
                                    onChange={(e) => setShowDeliveryMarkers(e.target.checked)}
                                    size="small"
                                />
                            }
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        backgroundColor: colorSchemes.delivery
                                    }} />
                                    <Typography sx={{ fontSize: '11px' }}>
                                        Delivery ({stats.deliveryCities})
                                    </Typography>
                                </Box>
                            }
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={showRouteLines}
                                    onChange={(e) => setShowRouteLines(e.target.checked)}
                                    size="small"
                                />
                            }
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{
                                        width: 12,
                                        height: 2,
                                        backgroundColor: colorSchemes.route
                                    }} />
                                    <Typography sx={{ fontSize: '11px' }}>
                                        Routes ({stats.totalRoutes})
                                    </Typography>
                                </Box>
                            }
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={showSelectedOnly}
                                    onChange={(e) => setShowSelectedOnly(e.target.checked)}
                                    size="small"
                                    disabled={stats.selectedRoutes === 0}
                                />
                            }
                            label={
                                <Typography sx={{ fontSize: '11px' }}>
                                    Selected Only ({stats.selectedRoutes})
                                </Typography>
                            }
                        />
                    </Grid>
                </Grid>

                {/* Route Opacity Slider */}
                {showRouteLines && (
                    <Box sx={{ mt: 2 }}>
                        <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 1 }}>
                            Route Line Opacity
                        </Typography>
                        <Slider
                            value={routeOpacity}
                            onChange={(e, value) => setRouteOpacity(value)}
                            min={0.1}
                            max={1}
                            step={0.1}
                            size="small"
                            sx={{ width: 120 }}
                            valueLabelDisplay="auto"
                            valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                        />
                    </Box>
                )}
            </Box>

            {/* Map Container */}
            <Box sx={{ position: 'relative' }}>
                <div
                    ref={mapRef}
                    style={{
                        width: '100%',
                        height: height,
                        backgroundColor: '#f8fafc'
                    }}
                />

                {/* Loading Overlay */}
                {loading && (
                    <Box sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <CircularProgress size={32} sx={{ mb: 2 }} />
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Loading route visualization...
                        </Typography>
                    </Box>
                )}

                {/* Map Statistics Overlay */}
                {mapLoaded && !loading && (
                    <Box sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: 1,
                        p: 1.5,
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        zIndex: 100
                    }}>
                        <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#374151', mb: 1 }}>
                            Map Statistics
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                📍 Pickup: {stats.pickupCities} cities
                            </Typography>
                            <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                🎯 Delivery: {stats.deliveryCities} cities
                            </Typography>
                            <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                🛣️ Routes: {stats.totalRoutes} total
                            </Typography>
                            {stats.selectedRoutes > 0 && (
                                <Typography sx={{ fontSize: '10px', color: '#8b5cf6', fontWeight: 500 }}>
                                    ✅ Selected: {stats.selectedRoutes}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Map Legend */}
            <Box sx={{ p: 2, borderTop: '1px solid #e5e7eb', backgroundColor: '#f8fafc' }}>
                <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#374151', mb: 1 }}>
                    Map Legend
                </Typography>
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: colorSchemes.pickup,
                            border: '2px solid white'
                        }} />
                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                            Pickup Only
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: colorSchemes.delivery,
                            border: '2px solid white'
                        }} />
                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                            Delivery Only
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            backgroundColor: colorSchemes.dual,
                            border: '3px solid white'
                        }} />
                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                            Pickup + Delivery
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                            width: 16,
                            height: 2,
                            backgroundColor: colorSchemes.route
                        }} />
                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                            Route Lines
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                            width: 16,
                            height: 3,
                            backgroundColor: colorSchemes.selected
                        }} />
                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                            Selected Routes
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Paper>
    );
};

export default RouteVisualizationMap;
