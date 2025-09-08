/**
 * MapCitySelector Component - REDESIGNED WITH PROPER ARCHITECTURE
 * 
 * Separates shape storage from city storage with proper visualization
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Typography, Button, Chip, CircularProgress, Card, Fab, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton
} from '@mui/material';
import {
    PanTool as PanToolIcon,
    CropFree as SelectIcon,
    Crop32 as RectangleIcon,
    RadioButtonUnchecked as CircleIcon,
    Pentagon as PolygonIcon,
    Delete as DeleteIcon,
    Clear as ClearAllIcon,
    Done as DoneIcon,
    Visibility as PreviewIcon,
    Add as AddIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { loadGoogleMaps } from '../../../../utils/googleMapsLoader';
import { collection, query, where, getDocs, limit, orderBy, startAfter, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../../../../firebase';

const MapCitySelector = ({
    selectedCities = [],
    onSelectionComplete,
    zoneCategory = 'pickupZones',
    embedded = false,
    onMapAreaSave,
    onDone,
    initialAreas = [],
    carrierId
}) => {
    const { enqueueSnackbar } = useSnackbar();
    const mapRef = useRef(null);
    const googleMapRef = useRef(null);
    const drawingManagerRef = useRef(null);
    const tempShapesRef = useRef([]);
    const cityMarkersRef = useRef([]);

    // State Management
    const [mapLoaded, setMapLoaded] = useState(false);
    const [savedShapes, setSavedShapes] = useState([]); // Shapes stored in database
    const [tempShapes, setTempShapes] = useState([]); // Temporary shapes before save
    const [cityMarkers, setCityMarkers] = useState([]); // Visual markers for cities
    const [loading, setLoading] = useState(true);
    const [mapMode, setMapMode] = useState('pan');
    const [drawingToolsReady, setDrawingToolsReady] = useState(false);
    const [selectedShape, setSelectedShape] = useState(null);
    const [shapePreviewOpen, setShapePreviewOpen] = useState(false);
    const [shapePreviewCities, setShapePreviewCities] = useState([]);
    const [detecting, setDetecting] = useState(false);

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

    // Load saved shapes from database
    const loadSavedShapes = useCallback(async () => {
        if (!carrierId) return;
        try {
            const q = query(
                collection(db, 'carrierMapShapes'),
                where('carrierId', '==', carrierId),
                where('zoneCategory', '==', zoneCategory)
            );
            const snap = await getDocs(q);
            const shapes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSavedShapes(shapes);
        } catch (error) {
            console.warn('Failed to load saved shapes:', error);
        }
    }, [carrierId, zoneCategory]);

    // Save shape to database
    const saveShapeToDatabase = useCallback(async (shapeData) => {
        if (!carrierId) return;
        try {
            await addDoc(collection(db, 'carrierMapShapes'), {
                carrierId,
                zoneCategory,
                ...shapeData,
                createdAt: new Date()
            });
        } catch (error) {
            console.error('Failed to save shape:', error);
            enqueueSnackbar('Failed to save shape', { variant: 'error' });
        }
    }, [carrierId, zoneCategory, enqueueSnackbar]);

    // Delete shape from database
    const deleteShapeFromDatabase = useCallback(async (shapeId) => {
        try {
            await deleteDoc(doc(db, 'carrierMapShapes', shapeId));
        } catch (error) {
            console.error('Failed to delete shape:', error);
            enqueueSnackbar('Failed to delete shape', { variant: 'error' });
        }
    }, [enqueueSnackbar]);

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
        setCityMarkers(newMarkers);
    }, [selectedCities, enqueueSnackbar]);

    // Render saved shapes on map
    const renderSavedShapes = useCallback(() => {
        if (!googleMapRef.current || !savedShapes.length) return;

        savedShapes.forEach(shape => {
            let overlay = null;

            if (shape.type === 'polygon' && shape.path?.length) {
                overlay = new window.google.maps.Polygon({
                    paths: shape.path,
                    fillColor: '#3b82f6',
                    fillOpacity: 0.1,
                    strokeColor: '#1d4ed8',
                    strokeWeight: 2,
                    editable: false,
                    draggable: false,
                    clickable: true
                });
            } else if (shape.type === 'rectangle' && shape.bounds) {
                overlay = new window.google.maps.Rectangle({
                    bounds: shape.bounds,
                    fillColor: '#ef4444',
                    fillOpacity: 0.1,
                    strokeColor: '#dc2626',
                    strokeWeight: 2,
                    editable: false,
                    draggable: false,
                    clickable: true
                });
            } else if (shape.type === 'circle' && shape.center && shape.radius) {
                overlay = new window.google.maps.Circle({
                    center: shape.center,
                    radius: shape.radius,
                    fillColor: '#10b981',
                    fillOpacity: 0.1,
                    strokeColor: '#059669',
                    strokeWeight: 2,
                    editable: false,
                    draggable: false,
                    clickable: true
                });
            }

            if (overlay) {
                overlay.setMap(googleMapRef.current);

                overlay.addListener('click', () => {
                    enqueueSnackbar(`📐 Saved ${shape.type}: ${shape.name}`, { variant: 'info' });
                });
            }
        });
    }, [savedShapes, enqueueSnackbar]);

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

    // Handle shape completion
    const handleShapeComplete = useCallback(async (overlay, type) => {
        console.log('🎯 [Perfect] handleShapeComplete called:', { overlay, type, tempShapesLength: tempShapes.length });

        const id = `temp_${type}_${Date.now()}`;
        const name = `${type.charAt(0).toUpperCase() + type.slice(1)} ${tempShapes.length + 1}`;

        // Add to temporary shapes (not saved yet)
        const newShape = { id, type, overlay, name, temporary: true };
        console.log('🎯 [Perfect] Adding new temp shape:', newShape);

        setTempShapes(prev => {
            const updated = [...prev, newShape];
            console.log('🎯 [Perfect] Updated tempShapes:', updated.length);
            return updated;
        });

        // Auto-switch to pan mode but keep the overlay visible
        setMapMode('pan');
        if (drawingManagerRef.current) {
            drawingManagerRef.current.setDrawingMode(null);
        }

        console.log('🎯 [Perfect] Shape should now be visible on map');
        enqueueSnackbar(`✅ Created ${name} - use "Add Cities" to include its cities`, { variant: 'success' });
    }, [tempShapes.length, enqueueSnackbar]);

    // Add cities from a specific shape
    const addCitiesFromShape = useCallback(async (shape) => {
        const cities = await findCitiesInShape(shape.overlay, shape.type);

        if (cities.length === 0) {
            enqueueSnackbar('No cities found in this shape', { variant: 'warning' });
            return;
        }

        // Add cities to selection (avoiding duplicates)
        const existingKeys = new Set(selectedCities.map(c => c.searchKey || c.id));
        const newCities = cities.filter(city => !existingKeys.has(city.searchKey || city.id));

        if (newCities.length === 0) {
            enqueueSnackbar('All cities in this shape are already selected', { variant: 'info' });
            return;
        }

        onSelectionComplete([...selectedCities, ...newCities]);
        enqueueSnackbar(`✅ Added ${newCities.length} cities from ${shape.name}`, { variant: 'success' });
    }, [selectedCities, onSelectionComplete, findCitiesInShape, enqueueSnackbar]);

    // Save temporary shape permanently
    const saveShape = useCallback(async (tempShape) => {
        const shapeData = {
            name: tempShape.name,
            type: tempShape.type
        };

        if (tempShape.type === 'polygon') {
            shapeData.path = tempShape.overlay.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));
        } else if (tempShape.type === 'rectangle') {
            const bounds = tempShape.overlay.getBounds();
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            shapeData.bounds = { north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() };
        } else if (tempShape.type === 'circle') {
            const center = tempShape.overlay.getCenter();
            shapeData.center = { lat: center.lat(), lng: center.lng() };
            shapeData.radius = tempShape.overlay.getRadius();
        }

        await saveShapeToDatabase(shapeData);

        // Remove from temp and reload saved shapes
        setTempShapes(prev => prev.filter(s => s.id !== tempShape.id));
        await loadSavedShapes();

        enqueueSnackbar(`💾 Saved ${tempShape.name}`, { variant: 'success' });
    }, [saveShapeToDatabase, loadSavedShapes, enqueueSnackbar]);

    // Delete temporary shape
    const deleteTempShape = useCallback((tempShape) => {
        tempShape.overlay?.setMap(null);
        setTempShapes(prev => prev.filter(s => s.id !== tempShape.id));
        enqueueSnackbar(`🗑️ Deleted ${tempShape.name}`, { variant: 'info' });
    }, [enqueueSnackbar]);

    // Delete saved shape
    const deleteSavedShape = useCallback(async (savedShape) => {
        await deleteShapeFromDatabase(savedShape.id);
        await loadSavedShapes();
        enqueueSnackbar(`🗑️ Deleted saved ${savedShape.name}`, { variant: 'info' });
    }, [deleteShapeFromDatabase, loadSavedShapes, enqueueSnackbar]);

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
                    fillColor: '#3b82f6',
                    fillOpacity: 0.2,
                    strokeColor: '#1d4ed8',
                    strokeWeight: 2,
                    editable: true,
                    draggable: true,
                    clickable: true
                },
                rectangleOptions: {
                    fillColor: '#ef4444',
                    fillOpacity: 0.2,
                    strokeColor: '#dc2626',
                    strokeWeight: 2,
                    editable: true,
                    draggable: true,
                    clickable: true
                },
                circleOptions: {
                    fillColor: '#10b981',
                    fillOpacity: 0.2,
                    strokeColor: '#059669',
                    strokeWeight: 2,
                    editable: true,
                    draggable: true,
                    clickable: true
                }
            });

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

            // Load saved shapes and render them
            await loadSavedShapes();

        } catch (error) {
            console.error('❌ Map initialization failed:', error);
            enqueueSnackbar("Failed to initialize map", { variant: "error" });
        } finally {
            setLoading(false);
            setMapLoaded(true);
        }
    }, [handleShapeComplete, loadSavedShapes, enqueueSnackbar]);

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
        if (mapLoaded && googleMapRef.current && mapMode !== 'draw') {
            renderCityMarkers();
        }
    }, [mapLoaded, selectedCities.length, mapMode, renderCityMarkers]); // Don't update during drawing

    // Render saved shapes when they change
    useEffect(() => {
        if (mapLoaded) {
            renderSavedShapes();
        }
    }, [mapLoaded, renderSavedShapes]);

    // Sync state with refs for cleanup
    useEffect(() => {
        tempShapesRef.current = tempShapes;
    }, [tempShapes]);

    useEffect(() => {
        cityMarkersRef.current = cityMarkers;
    }, [cityMarkers]);

    // Cleanup - only run on component unmount
    useEffect(() => {
        return () => {
            // Clean up all overlays when component unmounts
            tempShapesRef.current.forEach(shape => shape.overlay?.setMap(null));
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

    const clearAllTempShapes = useCallback(() => {
        tempShapes.forEach(shape => shape.overlay?.setMap(null));
        setTempShapes([]);
        enqueueSnackbar('Cleared all temporary shapes', { variant: 'info' });
    }, [tempShapes, enqueueSnackbar]);

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
                <Tooltip title="Draw Rectangle" placement="right">
                    <Fab
                        size="small"
                        color={mapMode === 'rectangle' ? 'error' : 'default'}
                        onClick={() => setDrawingMode('rectangle')}
                        disabled={!drawingToolsReady}
                        sx={{ width: 40, height: 40 }}
                    >
                        <RectangleIcon fontSize="small" />
                    </Fab>
                </Tooltip>

                {/* Circle Tool */}
                <Tooltip title="Draw Circle" placement="right">
                    <Fab
                        size="small"
                        color={mapMode === 'circle' ? 'success' : 'default'}
                        onClick={() => setDrawingMode('circle')}
                        disabled={!drawingToolsReady}
                        sx={{ width: 40, height: 40 }}
                    >
                        <CircleIcon fontSize="small" />
                    </Fab>
                </Tooltip>

                {/* Polygon Tool */}
                <Tooltip title="Draw Polygon" placement="right">
                    <Fab
                        size="small"
                        color={mapMode === 'polygon' ? 'info' : 'default'}
                        onClick={() => setDrawingMode('polygon')}
                        disabled={!drawingToolsReady}
                        sx={{ width: 40, height: 40 }}
                    >
                        <PolygonIcon fontSize="small" />
                    </Fab>
                </Tooltip>

                <Box sx={{ width: '100%', height: 1, bgcolor: '#e5e7eb', my: 1 }} />

                {/* Clear Temp Shapes */}
                <Tooltip title="Clear Temporary Shapes" placement="right">
                    <Fab
                        size="small"
                        color="error"
                        onClick={clearAllTempShapes}
                        disabled={tempShapes.length === 0}
                        sx={{ width: 40, height: 40 }}
                    >
                        <ClearAllIcon fontSize="small" />
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
                        label={`${selectedCities.length} cities`}
                        color="primary"
                        size="small"
                        sx={{ fontSize: '11px' }}
                    />
                    <Chip
                        label={`${savedShapes.length} saved shapes`}
                        color="success"
                        size="small"
                        sx={{ fontSize: '11px' }}
                    />
                    {tempShapes.length > 0 && (
                        <Chip
                            label={`${tempShapes.length} temp`}
                            color="warning"
                            size="small"
                            sx={{ fontSize: '11px' }}
                        />
                    )}
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

            {/* Temporary Shapes Panel */}
            {tempShapes.length > 0 && (
                <Box sx={{
                    position: 'absolute',
                    bottom: 20,
                    left: 20,
                    width: 350,
                    zIndex: 1000
                }}>
                    <Card sx={{ p: 2 }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 1 }}>
                            Temporary Shapes ({tempShapes.length})
                        </Typography>
                        {tempShapes.map((shape) => (
                            <Box key={shape.id} sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                p: 1,
                                border: '1px solid #e5e7eb',
                                borderRadius: 1,
                                mb: 1
                            }}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                    {shape.name}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={() => addCitiesFromShape(shape)}
                                        sx={{ fontSize: '10px', minWidth: 'auto', px: 1 }}
                                    >
                                        Add Cities
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => saveShape(shape)}
                                        sx={{ fontSize: '10px', minWidth: 'auto', px: 1 }}
                                    >
                                        Save
                                    </Button>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => deleteTempShape(shape)}
                                        sx={{ width: 24, height: 24 }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Box>
                        ))}
                    </Card>
                </Box>
            )}

            {/* Saved Shapes Panel */}
            {savedShapes.length > 0 && (
                <Box sx={{
                    position: 'absolute',
                    bottom: 20,
                    right: 20,
                    width: 300,
                    zIndex: 1000
                }}>
                    <Card sx={{ p: 2 }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 1 }}>
                            Saved Shapes ({savedShapes.length})
                        </Typography>
                        {savedShapes.slice(0, 5).map((shape) => (
                            <Box key={shape.id} sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                p: 1,
                                border: '1px solid #e5e7eb',
                                borderRadius: 1,
                                mb: 1,
                                bgcolor: '#f8fafc'
                            }}>
                                <Typography sx={{ fontSize: '11px', fontWeight: 500 }}>
                                    {shape.name}
                                </Typography>
                                <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => deleteSavedShape(shape)}
                                    sx={{ width: 20, height: 20 }}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        ))}
                        {savedShapes.length > 5 && (
                            <Typography sx={{ fontSize: '10px', color: '#6b7280', textAlign: 'center' }}>
                                +{savedShapes.length - 5} more shapes
                            </Typography>
                        )}
                    </Card>
                </Box>
            )}

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
        </Box>
    );
};

export default MapCitySelector;