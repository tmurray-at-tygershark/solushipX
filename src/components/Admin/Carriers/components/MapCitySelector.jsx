/**
 * MapCitySelector Component - REDESIGNED WITH PROPER ARCHITECTURE
 * 
 * Separates shape storage from city storage with proper visualization
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Typography, Button, Chip, CircularProgress, Card, Fab, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText
} from '@mui/material';
import {
    PanTool as PanToolIcon,
    Crop32 as RectangleIcon,
    RadioButtonUnchecked as CircleIcon,
    Pentagon as PolygonIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { loadGoogleMaps } from '../../../../utils/googleMapsLoader';
import { collection, query, where, getDocs, limit, orderBy, startAfter } from 'firebase/firestore';
import { db } from '../../../../firebase';

const MapCitySelector = ({
    selectedCities = [],
    onSelectionComplete,
    zoneCategory = 'pickupZones',
    onDone
}) => {
    const { enqueueSnackbar } = useSnackbar();
    const mapRef = useRef(null);
    const googleMapRef = useRef(null);
    const drawingManagerRef = useRef(null);
    const cityMarkersRef = useRef([]);
    const deleteModeRef = useRef(false); // Track current delete mode state

    // State Management
    const [mapLoaded, setMapLoaded] = useState(false);
    const [cityMarkers, setCityMarkers] = useState([]); // Visual markers for cities
    const [loading, setLoading] = useState(true);
    const [mapMode, setMapMode] = useState('pan');
    const [deleteMode, setDeleteMode] = useState(false); // Toggle between add/delete mode
    const [drawingToolsReady, setDrawingToolsReady] = useState(false);
    const [detecting, setDetecting] = useState(false);

    // Confirmation dialog state
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [pendingCities, setPendingCities] = useState([]);
    const [pendingOverlay, setPendingOverlay] = useState(null);
    const [pendingAction, setPendingAction] = useState('add'); // 'add' or 'delete'

    // City dataset cache
    const citiesCacheRef = useRef({ loaded: false, cities: [] });

    // Load and cache all cities with coordinates
    const loadAllCitiesWithCoordinates = useCallback(async () => {
        try {
            const fetchCountryDocs = async (cc) => {
                const docs = [];
                const pageSize = 10000;
                let lastDoc = null;
                while (true) {
                    const baseQuery = [
                        collection(db, 'geoLocations'),
                        where('country', '==', cc),
                        orderBy('__name__'),
                        limit(pageSize)
                    ];
                    const q = lastDoc
                        ? query(...baseQuery, startAfter(lastDoc))
                        : query(...baseQuery);
                    const snap = await getDocs(q);
                    docs.push(...snap.docs);
                    if (snap.size < pageSize) break;
                    lastDoc = snap.docs[snap.docs.length - 1];
                }
                return docs;
            };

            const [caDocs, usDocs] = await Promise.all([
                fetchCountryDocs('CA'),
                fetchCountryDocs('US')
            ]);

            const cityMap = new Map();
            [...caDocs, ...usDocs].forEach(doc => {
                const data = doc.data();
                const cityKey = `${data.city}-${data.provinceState}-${data.country}`.toLowerCase();

                if (data.latitude && data.longitude &&
                    typeof data.latitude === 'number' && typeof data.longitude === 'number') {
                    if (!cityMap.has(cityKey) || (!cityMap.get(cityKey).latitude && data.latitude)) {
                        cityMap.set(cityKey, {
                            id: doc.id,
                            city: data.city,
                            provinceState: data.provinceState,
                            provinceStateName: data.provinceStateName,
                            country: data.country,
                            countryName: data.countryName,
                            postalCode: data.postalZipCode,
                            latitude: parseFloat(data.latitude),
                            longitude: parseFloat(data.longitude),
                            searchKey: cityKey
                        });
                    }
                }
            });

            return Array.from(cityMap.values()).filter(c => c.latitude !== null);
        } catch (error) {
            console.error('❌ Error loading cities:', error);
            enqueueSnackbar('Failed to load geographic data', { variant: 'error' });
            return [];
        }
    }, [enqueueSnackbar]);

    // Cached accessor
    const getAllCitiesWithCoordinatesCached = useCallback(async () => {
        if (citiesCacheRef.current.loaded && citiesCacheRef.current.cities.length) {
            return citiesCacheRef.current.cities;
        }
        const data = await loadAllCitiesWithCoordinates();
        citiesCacheRef.current = { loaded: true, cities: data };
        return data;
    }, [loadAllCitiesWithCoordinates]);


    // Render city markers on map (persistent during drawing)
    const renderCityMarkers = useCallback(() => {
        if (!googleMapRef.current) return;

        console.log('🗺️ [MapCitySelector] Rendering city markers:', {
            selectedCitiesCount: selectedCities.length,
            mapReady: !!googleMapRef.current,
            sampleCity: selectedCities[0]
        });

        // Clear existing markers
        cityMarkers.forEach(marker => marker.setMap(null));

        // Create pink markers for currently selected cities
        const newMarkers = selectedCities.map((city, index) => {
            // Check for coordinates in multiple possible formats
            const lat = city.latitude || city.lat;
            const lng = city.longitude || city.lng;

            if (!lat || !lng || typeof lat !== 'number' || typeof lng !== 'number') {
                console.log(`⚠️ [MapCitySelector] City ${index} missing coordinates:`, {
                    city: city.city,
                    lat, lng,
                    hasLatitude: !!city.latitude,
                    hasLat: !!city.lat,
                    hasLongitude: !!city.longitude,
                    hasLng: !!city.lng
                });
                return null;
            }

            console.log(`📍 [MapCitySelector] Creating marker for:`, city.city, lat, lng);

            const marker = new window.google.maps.Marker({
                position: { lat: lat, lng: lng },
                map: googleMapRef.current,
                title: `${city.city}, ${city.provinceState || city.province}, ${city.country}`,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="6" cy="6" r="5" fill="#ff69b4" stroke="#ffffff" stroke-width="2"/>
                        </svg>
                    `),
                    scaledSize: new window.google.maps.Size(12, 12),
                    anchor: new window.google.maps.Point(6, 6)
                }
            });

            marker.addListener('click', () => {
                enqueueSnackbar(`📍 ${city.city}, ${city.provinceState || city.province}, ${city.country}`, { variant: 'info' });
            });

            return marker;
        }).filter(Boolean);

        console.log(`✅ [MapCitySelector] Created ${newMarkers.length} markers out of ${selectedCities.length} cities`);
        console.log(`📍 [MapCitySelector] City list:`, selectedCities.map(c => c.city).slice(0, 10));
        setCityMarkers(newMarkers);
    }, [selectedCities, enqueueSnackbar]);


    // Find cities in shapes
    const findCitiesInShape = useCallback(async (overlay, type) => {
        setDetecting(true);
        try {
            const allCities = await getAllCitiesWithCoordinatesCached();
            let citiesInShape = [];

            if (type === 'polygon') {
                citiesInShape = allCities.filter(city => {
                    if (!city.latitude || !city.longitude) return false;
                    const cityLatLng = new window.google.maps.LatLng(city.latitude, city.longitude);
                    return window.google.maps.geometry.poly.containsLocation(cityLatLng, overlay);
                });
            } else if (type === 'rectangle') {
                const bounds = overlay.getBounds();
                citiesInShape = allCities.filter(city => {
                    if (!city.latitude || !city.longitude) return false;
                    const cityLatLng = new window.google.maps.LatLng(city.latitude, city.longitude);
                    return bounds.contains(cityLatLng);
                });
            } else if (type === 'circle') {
                const center = overlay.getCenter();
                const radius = overlay.getRadius();
                citiesInShape = allCities.filter(city => {
                    if (!city.latitude || !city.longitude) return false;
                    const cityLatLng = new window.google.maps.LatLng(city.latitude, city.longitude);
                    const distance = window.google.maps.geometry.spherical.computeDistanceBetween(center, cityLatLng);
                    return distance <= radius;
                });
            }

            return citiesInShape;
        } finally {
            setDetecting(false);
        }
    }, [getAllCitiesWithCoordinatesCached]);

    // Show confirmation dialog for any action
    const showConfirmationDialog = useCallback(async (overlay, type, isDeleteMode) => {
        try {
            console.log(`${isDeleteMode ? '🗑️' : '➕'} [Confirm] Finding cities in ${type}, deleteMode: ${isDeleteMode}`);
            const citiesFound = await findCitiesInShape(overlay, type);

            if (citiesFound.length === 0) {
                enqueueSnackbar('No cities found in this area', { variant: 'info' });
                overlay.setMap(null);
                return;
            }

            if (isDeleteMode) {
                // Filter to only cities that are actually selected for deletion
                const citiesToDelete = citiesFound.filter(city =>
                    selectedCities.some(selected =>
                        (selected.searchKey || selected.id) === (city.searchKey || city.id)
                    )
                );

                if (citiesToDelete.length === 0) {
                    enqueueSnackbar('No selected cities found in this area to delete', { variant: 'info' });
                    overlay.setMap(null);
                    return;
                }

                setPendingCities(citiesToDelete);
                setPendingAction('delete');
            } else {
                // Filter to only new cities for addition
                const existingKeys = new Set(selectedCities.map(c => c.searchKey || c.id));
                const newCities = citiesFound.filter(city => !existingKeys.has(city.searchKey || city.id));

                if (newCities.length === 0) {
                    enqueueSnackbar('All cities in this area are already selected', { variant: 'info' });
                    overlay.setMap(null);
                    return;
                }

                setPendingCities(newCities);
                setPendingAction('add');
            }

            // Show confirmation dialog
            setPendingOverlay(overlay);
            setConfirmDialogOpen(true);

        } catch (error) {
            console.error('❌ Error processing cities:', error);
            enqueueSnackbar('Failed to process cities', { variant: 'error' });
            overlay.setMap(null);
        }
    }, [findCitiesInShape, selectedCities, enqueueSnackbar]);

    // Confirm action from dialog
    const confirmAction = useCallback(() => {
        try {
            if (pendingAction === 'delete') {
                // Remove cities from current selection
                const cityIdsToDelete = new Set(pendingCities.map(c => c.searchKey || c.id));
                const remainingCities = selectedCities.filter(city =>
                    !cityIdsToDelete.has(city.searchKey || city.id)
                );

                console.log('🗑️ [Confirm] BEFORE deletion:', {
                    totalCities: selectedCities.length,
                    citiesToDelete: pendingCities.length,
                    remainingCities: remainingCities.length,
                    deletedCityNames: pendingCities.map(c => c.city).slice(0, 5)
                });

                // Update parent component with remaining cities
                onSelectionComplete(remainingCities);

                console.log('🗑️ [Confirm] AFTER deletion - called onSelectionComplete with', remainingCities.length, 'cities');

                enqueueSnackbar(`🗑️ Deleted ${pendingCities.length} cities from ${zoneCategory}`, {
                    variant: 'warning'
                });
            } else {
                // Add cities to selection
                const newCitiesList = [...selectedCities, ...pendingCities];
                console.log('➕ [Confirm] Adding cities:', {
                    currentCities: selectedCities.length,
                    citiesToAdd: pendingCities.length,
                    newTotal: newCitiesList.length
                });

                onSelectionComplete(newCitiesList);

                enqueueSnackbar(`✅ Added ${pendingCities.length} cities to ${zoneCategory}`, {
                    variant: 'success'
                });
            }

            // Close dialog and clean up
            setConfirmDialogOpen(false);
            setPendingCities([]);
            setPendingAction('add');

            // Remove the drawing overlay
            if (pendingOverlay) {
                pendingOverlay.setMap(null);
                setPendingOverlay(null);
            }

        } catch (error) {
            console.error('❌ Error confirming action:', error);
            enqueueSnackbar('Failed to complete action', { variant: 'error' });
        }
    }, [pendingAction, pendingCities, selectedCities, onSelectionComplete, zoneCategory, pendingOverlay, enqueueSnackbar]);

    // Cancel action from dialog
    const cancelAction = useCallback(() => {
        setConfirmDialogOpen(false);
        setPendingCities([]);
        setPendingAction('add');

        // Remove the drawing overlay
        if (pendingOverlay) {
            pendingOverlay.setMap(null);
            setPendingOverlay(null);
        }
    }, [pendingOverlay]);

    // Handle shape completion - show confirmation for all actions
    const handleShapeComplete = useCallback(async (overlay, type) => {
        // Get current delete mode state from ref (not captured state)
        const currentDeleteMode = deleteModeRef.current;
        console.log('🎯 [DEBUG] handleShapeComplete called with REF deleteMode:', currentDeleteMode);
        console.log('🎯 [DEBUG] Current state:', { overlay, type, currentDeleteMode, selectedCitiesCount: selectedCities.length });

        // Always show confirmation dialog for both add and delete
        await showConfirmationDialog(overlay, type, currentDeleteMode);

        // Auto-switch to pan mode
        setMapMode('pan');
        if (drawingManagerRef.current) {
            drawingManagerRef.current.setDrawingMode(null);
        }
    }, [showConfirmationDialog, selectedCities.length]); // Removed deleteMode from dependencies


    // Map initialization
    const initializeMap = useCallback(async () => {
        if (!mapRef.current || !window.google?.maps) return;

        setLoading(true);
        try {
            const { maps, drawing } = await loadGoogleMaps();

            if (!maps || !drawing) {
                enqueueSnackbar("Failed to load Google Maps", { variant: "error" });
                return;
            }

            const map = new maps.Map(mapRef.current, {
                center: { lat: 45.4215, lng: -75.6972 },
                zoom: 6,
                mapTypeId: 'roadmap',
                gestureHandling: 'cooperative',
                zoomControl: true,
                mapTypeControl: false,
                scaleControl: true,
                streetViewControl: false,
                fullscreenControl: false,
                styles: [
                    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                    { elementType: "labels.text.fill", stylers: [{ color: "#a855f7" }] },
                    {
                        featureType: "administrative.locality",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#ffffff" }]
                    },
                    {
                        featureType: "poi",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#ffffff" }]
                    },
                    {
                        featureType: "poi.park",
                        elementType: "geometry",
                        stylers: [{ color: "#263c3f" }]
                    },
                    {
                        featureType: "poi.park",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#6b9a76" }]
                    },
                    {
                        featureType: "road",
                        elementType: "geometry",
                        stylers: [{ color: "#38414e" }]
                    },
                    {
                        featureType: "road",
                        elementType: "geometry.stroke",
                        stylers: [{ color: "#212a37" }]
                    },
                    {
                        featureType: "road",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#9ca5b3" }]
                    },
                    {
                        featureType: "road.highway",
                        elementType: "geometry",
                        stylers: [{ color: "#746855" }]
                    },
                    {
                        featureType: "road.highway",
                        elementType: "geometry.stroke",
                        stylers: [{ color: "#1f2835" }]
                    },
                    {
                        featureType: "road.highway",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#ffffff" }]
                    },
                    {
                        featureType: "transit",
                        elementType: "geometry",
                        stylers: [{ color: "#2f3948" }]
                    },
                    {
                        featureType: "transit.station",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#ffffff" }]
                    },
                    {
                        featureType: "water",
                        elementType: "geometry",
                        stylers: [{ color: "#17263c" }]
                    },
                    {
                        featureType: "water",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#515c6d" }]
                    },
                    {
                        featureType: "water",
                        elementType: "labels.text.stroke",
                        stylers: [{ color: "#17263c" }]
                    }
                ]
            });

            googleMapRef.current = map;

            const drawingManager = new drawing.DrawingManager({
                drawingMode: null,
                drawingControl: false,
                map: map,
                polygonOptions: {
                    fillColor: '#10b981', // Green for add mode (default)
                    fillOpacity: 0.2,
                    strokeColor: '#059669',
                    strokeWeight: 2,
                    editable: true,
                    draggable: true,
                    clickable: true
                },
                rectangleOptions: {
                    fillColor: '#10b981', // Green for add mode (default)
                    fillOpacity: 0.2,
                    strokeColor: '#059669',
                    strokeWeight: 2,
                    editable: true,
                    draggable: true,
                    clickable: true
                },
                circleOptions: {
                    fillColor: '#10b981', // Green for add mode (default)
                    fillOpacity: 0.2,
                    strokeColor: '#059669',
                    strokeWeight: 2,
                    editable: true,
                    draggable: true,
                    clickable: true
                }
            });

            // Update drawing manager options - green for add, red for delete
            const updateDrawingOptions = (isDeleteMode) => {
                const fillColor = isDeleteMode ? '#ef4444' : '#10b981'; // Red for delete, green for add
                const strokeColor = isDeleteMode ? '#dc2626' : '#059669'; // Dark red for delete, dark green for add

                drawingManager.setOptions({
                    polygonOptions: {
                        ...drawingManager.get('polygonOptions'),
                        fillColor: fillColor,
                        strokeColor: strokeColor
                    },
                    rectangleOptions: {
                        ...drawingManager.get('rectangleOptions'),
                        fillColor: fillColor,
                        strokeColor: strokeColor
                    },
                    circleOptions: {
                        ...drawingManager.get('circleOptions'),
                        fillColor: fillColor,
                        strokeColor: strokeColor
                    }
                });
            };

            // Store function for later use
            drawingManager.updateDrawingOptions = updateDrawingOptions;

            drawingManagerRef.current = drawingManager;

            // Handle shape completion
            drawingManager.addListener('overlaycomplete', (event) => {
                console.log('🎯 [Perfect] Shape completed:', event.type, event.overlay);

                // Convert Google Maps overlay type to our format
                let shapeType;
                const { OverlayType } = drawing;
                switch (event.type) {
                    case OverlayType.RECTANGLE:
                        shapeType = 'rectangle';
                        break;
                    case OverlayType.CIRCLE:
                        shapeType = 'circle';
                        break;
                    case OverlayType.POLYGON:
                        shapeType = 'polygon';
                        break;
                    default:
                        console.warn('Unknown overlay type:', event.type);
                        shapeType = 'unknown';
                }

                handleShapeComplete(event.overlay, shapeType);
            });

            setDrawingToolsReady(true);


        } catch (error) {
            console.error('❌ Map initialization failed:', error);
            enqueueSnackbar("Failed to initialize map", { variant: "error" });
        } finally {
            setLoading(false);
            setMapLoaded(true);
        }
    }, [handleShapeComplete, enqueueSnackbar]);

    // Initialize map and city markers
    useEffect(() => {
        if (mapRef.current && !mapLoaded) {
            initializeMap();
        }
    }, [mapRef, mapLoaded, initializeMap]);

    // Render city markers when map first loads
    useEffect(() => {
        if (mapLoaded && googleMapRef.current && selectedCities.length > 0) {
            setTimeout(() => {
                renderCityMarkers();
            }, 300);
        }
    }, [mapLoaded, renderCityMarkers, selectedCities.length]); // Include dependencies

    // Update city markers when selected cities change (but not during drawing)
    useEffect(() => {
        console.log(`🔄 [MapCitySelector] selectedCities prop changed:`, {
            count: selectedCities.length,
            mapLoaded,
            mapMode,
            cities: selectedCities.map(c => c.city).slice(0, 5)
        });

        if (mapLoaded && googleMapRef.current && mapMode !== 'draw') {
            renderCityMarkers();
        }
    }, [mapLoaded, selectedCities.length, mapMode, renderCityMarkers]); // Don't update during drawing



    useEffect(() => {
        cityMarkersRef.current = cityMarkers;
    }, [cityMarkers]);

    // Update drawing colors when delete mode changes and sync ref
    useEffect(() => {
        deleteModeRef.current = deleteMode; // Keep ref in sync
        if (drawingManagerRef.current && drawingManagerRef.current.updateDrawingOptions) {
            drawingManagerRef.current.updateDrawingOptions(deleteMode);
        }
    }, [deleteMode]);

    // Cleanup - only run on component unmount
    useEffect(() => {
        return () => {
            // Clean up city markers when component unmounts
            cityMarkersRef.current.forEach(marker => marker.setMap(null));
        };
    }, []); // Empty dependency array - only run on mount/unmount

    // Toolbar actions
    const setDrawingMode = useCallback((mode) => {
        setMapMode(mode);
        if (!drawingManagerRef.current) return;

        const { drawing } = window.google.maps;
        switch (mode) {
            case 'pan':
                drawingManagerRef.current.setDrawingMode(null);
                break;
            case 'rectangle':
                drawingManagerRef.current.setDrawingMode(drawing.OverlayType.RECTANGLE);
                break;
            case 'circle':
                drawingManagerRef.current.setDrawingMode(drawing.OverlayType.CIRCLE);
                break;
            case 'polygon':
                drawingManagerRef.current.setDrawingMode(drawing.OverlayType.POLYGON);
                break;
            default:
                drawingManagerRef.current.setDrawingMode(null);
        }
    }, []);


    return (
        <Box sx={{
            width: '100%',
            height: '100vh',
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 9999,
            bgcolor: 'background.paper'
        }}>
            {/* Map Container */}
            <Box ref={mapRef} sx={{ width: '100%', height: '100%', bgcolor: '#e0e0e0' }} />

            {/* Modern Floating Toolbar */}
            <Box sx={{
                position: 'absolute',
                top: 20,
                left: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                zIndex: 1000
            }}>
                {/* Pan Tool */}
                <Tooltip title="Pan & Zoom Map" placement="right">
                    <Fab
                        size="small"
                        color={mapMode === 'pan' ? 'primary' : 'default'}
                        onClick={() => setDrawingMode('pan')}
                        disabled={!drawingToolsReady}
                        sx={{ width: 40, height: 40 }}
                    >
                        <PanToolIcon fontSize="small" />
                    </Fab>
                </Tooltip>

                <Box sx={{ width: '100%', height: 1, bgcolor: '#e5e7eb', my: 1 }} />

                {/* Rectangle Tool */}
                <Tooltip title={deleteMode ? "Draw Rectangle to Delete Cities" : "Draw Rectangle to Add Cities"} placement="right">
                    <Fab
                        size="small"
                        color={mapMode === 'rectangle' ? (deleteMode ? 'error' : 'success') : 'default'}
                        onClick={() => setDrawingMode('rectangle')}
                        disabled={!drawingToolsReady}
                        sx={{
                            width: 40,
                            height: 40,
                            backgroundColor: mapMode === 'rectangle' ? (deleteMode ? '#ef4444' : '#10b981') : undefined
                        }}
                    >
                        <RectangleIcon fontSize="small" />
                    </Fab>
                </Tooltip>

                {/* Circle Tool */}
                <Tooltip title={deleteMode ? "Draw Circle to Delete Cities" : "Draw Circle to Add Cities"} placement="right">
                    <Fab
                        size="small"
                        color={mapMode === 'circle' ? (deleteMode ? 'error' : 'success') : 'default'}
                        onClick={() => setDrawingMode('circle')}
                        disabled={!drawingToolsReady}
                        sx={{
                            width: 40,
                            height: 40,
                            backgroundColor: mapMode === 'circle' ? (deleteMode ? '#ef4444' : '#10b981') : undefined
                        }}
                    >
                        <CircleIcon fontSize="small" />
                    </Fab>
                </Tooltip>

                {/* Polygon Tool */}
                <Tooltip title={deleteMode ? "Draw Polygon to Delete Cities" : "Draw Polygon to Add Cities"} placement="right">
                    <Fab
                        size="small"
                        color={mapMode === 'polygon' ? (deleteMode ? 'error' : 'success') : 'default'}
                        onClick={() => setDrawingMode('polygon')}
                        disabled={!drawingToolsReady}
                        sx={{
                            width: 40,
                            height: 40,
                            backgroundColor: mapMode === 'polygon' ? (deleteMode ? '#ef4444' : '#10b981') : undefined
                        }}
                    >
                        <PolygonIcon fontSize="small" />
                    </Fab>
                </Tooltip>

                <Box sx={{ width: '100%', height: 1, bgcolor: '#e5e7eb', my: 1 }} />

                {/* Delete Mode Toggle */}
                <Tooltip title={deleteMode ? "Switch to Add Mode" : "Switch to Delete Mode"} placement="right">
                    <Fab
                        size="small"
                        color={deleteMode ? "error" : "default"}
                        onClick={() => {
                            const newDeleteMode = !deleteMode;
                            console.log('🔄 [DEBUG] Toggling delete mode:', deleteMode, '->', newDeleteMode);
                            setDeleteMode(newDeleteMode);
                        }}
                        sx={{
                            width: 40,
                            height: 40,
                            backgroundColor: deleteMode ? '#ef4444' : undefined,
                            '&:hover': {
                                backgroundColor: deleteMode ? '#dc2626' : undefined
                            }
                        }}
                    >
                        <DeleteIcon fontSize="small" />
                    </Fab>
                </Tooltip>

            </Box>

            {/* Status Bar */}
            <Box sx={{
                position: 'absolute',
                top: 20,
                right: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                zIndex: 1000
            }}>
                <Card sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                        label={deleteMode ? "🗑️ DELETE MODE" : "➕ ADD MODE"}
                        color={deleteMode ? "error" : "success"}
                        size="small"
                        sx={{
                            fontSize: '10px',
                            fontWeight: 600,
                            backgroundColor: deleteMode ? '#fef2f2' : '#f0fdf4',
                            color: deleteMode ? '#dc2626' : '#16a34a'
                        }}
                    />
                    <Chip
                        label={`${selectedCities.length} cities`}
                        color="primary"
                        size="small"
                        sx={{ fontSize: '11px' }}
                    />
                </Card>

                {/* Action Buttons */}
                <Card sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => onDone && onDone()}
                        sx={{ fontSize: '11px' }}
                    >
                        Done
                    </Button>
                </Card>
            </Box>


            {/* Loading Overlay */}
            {loading && (
                <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <Card sx={{ p: 3, textAlign: 'center' }}>
                        <CircularProgress sx={{ mb: 2 }} />
                        <Typography sx={{ fontSize: '16px', fontWeight: 500 }}>
                            🗺️ Loading Map Tools
                        </Typography>
                    </Card>
                </Box>
            )}

            {/* Detection Overlay */}
            {detecting && (
                <Box sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1500
                }}>
                    <Card sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <CircularProgress size={20} />
                        <Typography sx={{ fontSize: '14px' }}>
                            Detecting cities in shape...
                        </Typography>
                    </Card>
                </Box>
            )}

            {/* Professional Confirmation Dialog */}
            <Dialog
                open={confirmDialogOpen}
                onClose={cancelAction}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: pendingAction === 'delete' ? '#dc2626' : '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                }}>
                    {pendingAction === 'delete' ? '🗑️ Delete Cities' : '➕ Add Cities'} Confirmation
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '14px', mb: 2, color: '#374151' }}>
                        You are about to {pendingAction === 'delete' ? 'remove' : 'add'} <strong>{pendingCities.length} cities</strong> {pendingAction === 'delete' ? 'from' : 'to'} your {zoneCategory}:
                    </Typography>

                    <Box sx={{
                        maxHeight: 200,
                        overflow: 'auto',
                        border: '1px solid #e5e7eb',
                        borderRadius: 1,
                        bgcolor: pendingAction === 'delete' ? '#fef2f2' : '#f0fdf4'
                    }}>
                        <List dense>
                            {pendingCities.slice(0, 20).map((city, index) => (
                                <ListItem key={city.searchKey || city.id} sx={{ py: 0.5 }}>
                                    <ListItemText
                                        primary={`${city.city}, ${city.provinceState}`}
                                        secondary={city.country === 'CA' ? '🇨🇦 Canada' : city.country === 'US' ? '🇺🇸 United States' : city.country}
                                        sx={{
                                            '& .MuiListItemText-primary': { fontSize: '13px', fontWeight: 500 },
                                            '& .MuiListItemText-secondary': { fontSize: '11px' }
                                        }}
                                    />
                                </ListItem>
                            ))}
                            {pendingCities.length > 20 && (
                                <ListItem sx={{ py: 0.5 }}>
                                    <ListItemText
                                        primary={`... and ${pendingCities.length - 20} more cities`}
                                        sx={{
                                            '& .MuiListItemText-primary': {
                                                fontSize: '12px',
                                                fontStyle: 'italic',
                                                color: '#6b7280'
                                            }
                                        }}
                                    />
                                </ListItem>
                            )}
                        </List>
                    </Box>

                    <Typography sx={{ fontSize: '12px', mt: 2, color: pendingAction === 'delete' ? '#dc2626' : '#059669', fontWeight: 500 }}>
                        {pendingAction === 'delete'
                            ? '⚠️ This action cannot be undone. The cities will be removed from your zone configuration.'
                            : '✅ These cities will be added to your zone configuration.'
                        }
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button
                        onClick={cancelAction}
                        variant="outlined"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmAction}
                        variant="contained"
                        color={pendingAction === 'delete' ? 'error' : 'success'}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        {pendingAction === 'delete' ? 'Delete' : 'Add'} {pendingCities.length} Cities
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default MapCitySelector;