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
    Delete as DeleteIcon,
    NearMe as ArrowIcon
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
    const mapModeRef = useRef('pan'); // Track current map mode state

    // State Management
    const [mapLoaded, setMapLoaded] = useState(false);
    const [cityMarkers, setCityMarkers] = useState([]); // Visual markers for cities
    const [loading, setLoading] = useState(true);
    const [mapMode, setMapMode] = useState('pan');
    const [deleteMode, setDeleteMode] = useState(false); // Toggle between add/delete mode
    const [drawingToolsReady, setDrawingToolsReady] = useState(false);
    const [detecting, setDetecting] = useState(false);

    // PERFORMANCE OPTIMIZATION: Local visual state separate from database state
    const [visualCities, setVisualCities] = useState([]); // Cities currently visible on map
    const [pendingDatabaseChanges, setPendingDatabaseChanges] = useState([]); // Changes to apply on DONE

    // Confirmation dialog state
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [pendingCities, setPendingCities] = useState([]);
    const [pendingOverlay, setPendingOverlay] = useState(null);
    const [pendingAction, setPendingAction] = useState('add'); // 'add' or 'delete'

    // Distance measurement state
    const [measurementLabels, setMeasurementLabels] = useState([]);
    const measurementLabelsRef = useRef([]);

    // City dataset cache
    const citiesCacheRef = useRef({ loaded: false, cities: [] });

    // Initialize and sync visual cities with selectedCities prop
    useEffect(() => {
        setVisualCities(selectedCities);
    }, [selectedCities]); // Sync whenever selectedCities changes

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


    // Calculate marker size based on zoom level
    const getMarkerSize = useCallback((zoom) => {
        // Base size at zoom level 6
        const baseSize = 12;
        const baseZoom = 6;

        // Scale factor: markers get bigger as you zoom in
        const scaleFactor = Math.pow(1.2, zoom - baseZoom);
        const size = Math.max(8, Math.min(32, baseSize * scaleFactor));

        return Math.round(size);
    }, []);

    // Update marker sizes based on current zoom level with debouncing
    const updateMarkerSizes = useCallback(() => {
        const markersFromRef = cityMarkersRef.current || [];
        console.log(`🔍 [MapCitySelector] updateMarkerSizes called - Map: ${!!googleMapRef.current}, Markers: ${markersFromRef.length}`);

        if (!googleMapRef.current) {
            console.warn('❌ [MapCitySelector] No map reference available');
            return;
        }

        if (markersFromRef.length === 0) {
            console.warn('❌ [MapCitySelector] No city markers available in ref');
            return;
        }

        const currentZoom = googleMapRef.current.getZoom();
        const newSize = getMarkerSize(currentZoom);

        console.log(`🔍 [MapCitySelector] Updating ${markersFromRef.length} markers to size ${newSize}px (zoom: ${currentZoom})`);

        // Batch update markers with error handling to prevent flashing
        markersFromRef.forEach((marker, index) => {
            try {
                if (marker && marker.setIcon && marker.cityData) {
                    // Check if city is disabled - more robust status checking
                    const cityStatus = marker.cityData.status || 'enabled';
                    const isDisabled = cityStatus !== 'enabled';

                    // Debug status for first few markers
                    if (index < 3) {
                        console.log(`🔍 [MapCitySelector] Marker ${index} (${marker.cityData.city}):`, {
                            status: cityStatus,
                            isDisabled: isDisabled,
                            iconType: isDisabled ? 'RED_X' : 'PINK_CIRCLE'
                        });
                    }

                    // Create appropriate icon based on status with consistent styling
                    const iconSvg = isDisabled ?
                        // Red X for disabled cities - Enhanced with better contrast
                        `<svg width="${newSize}" height="${newSize}" viewBox="0 0 ${newSize} ${newSize}" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="${newSize / 2}" cy="${newSize / 2}" r="${newSize / 2 - 2}" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
                            <line x1="${newSize * 0.25}" y1="${newSize * 0.25}" x2="${newSize * 0.75}" y2="${newSize * 0.75}" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
                            <line x1="${newSize * 0.75}" y1="${newSize * 0.25}" x2="${newSize * 0.25}" y2="${newSize * 0.75}" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
                        </svg>` :
                        // Pink circle for enabled cities
                        `<svg width="${newSize}" height="${newSize}" viewBox="0 0 ${newSize} ${newSize}" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="${newSize / 2}" cy="${newSize / 2}" r="${newSize / 2 - 2}" fill="#ff69b4" stroke="#ffffff" stroke-width="2"/>
                        </svg>`;

                    // Update marker icon with error handling
                    marker.setIcon({
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(iconSvg),
                        scaledSize: new window.google.maps.Size(newSize, newSize),
                        anchor: new window.google.maps.Point(newSize / 2, newSize / 2)
                    });

                    if (index < 3) {
                        console.log(`✅ [MapCitySelector] Updated marker ${index} to size ${newSize}px (${isDisabled ? 'RED_X' : 'PINK_CIRCLE'})`);
                    }
                } else {
                    console.warn(`❌ [MapCitySelector] Invalid marker at index ${index}:`, {
                        hasMarker: !!marker,
                        hasSetIcon: !!(marker?.setIcon),
                        hasCityData: !!(marker?.cityData),
                        cityName: marker?.cityData?.city
                    });
                }
            } catch (error) {
                console.error(`❌ [MapCitySelector] Error updating marker ${index}:`, error);
            }
        });

        console.log(`✅ [MapCitySelector] Successfully updated ${markersFromRef.length} markers to size ${newSize}px (zoom: ${currentZoom})`);
    }, [getMarkerSize]);

    // Handle direct marker removal (arrow tool)
    const handleDirectMarkerRemoval = useCallback((city) => {
        console.log(`🎯 [MapCitySelector] Direct removal of city: ${city.city}`);

        // Remove city from visual state immediately (this will trigger re-render via useEffect)
        const updatedVisualCities = visualCities.filter(c => c.id !== city.id);
        setVisualCities(updatedVisualCities);

        // Add to pending database changes
        setPendingDatabaseChanges(prev => [
            ...prev,
            { type: 'delete', city }
        ]);

        enqueueSnackbar(`🗑️ Removed ${city.city} (click Done to save)`, { variant: 'warning' });
    }, [visualCities, enqueueSnackbar]);

    // Find closest city to a click location (for smart arrow tool)
    const findClosestCityToClick = useCallback(async (clickLatLng) => {
        // Extract coordinates from Google Maps LatLng object
        const clickLat = clickLatLng.lat();
        const clickLng = clickLatLng.lng();

        console.log(`🔍 [MapCitySelector] findClosestCityToClick called with:`, {
            lat: clickLat,
            lng: clickLng,
            latLngObject: clickLatLng
        });

        try {
            console.log(`🔍 [MapCitySelector] Loading all cities with coordinates...`);
            const allCities = await getAllCitiesWithCoordinatesCached();
            console.log(`🔍 [MapCitySelector] Loaded ${allCities.length} cities for distance calculation`);

            let closestCity = null;
            let minDistance = Infinity;
            let citiesChecked = 0;
            let citiesWithCoords = 0;
            const maxSearchRadius = 50000; // 50km max search radius

            allCities.forEach((city, index) => {
                if (!city.latitude || !city.longitude) {
                    if (index < 5) console.log(`⚠️ [MapCitySelector] City ${index} missing coords:`, city.city);
                    return;
                }

                citiesWithCoords++;

                const cityLatLng = new window.google.maps.LatLng(city.latitude, city.longitude);
                const distance = window.google.maps.geometry.spherical.computeDistanceBetween(clickLatLng, cityLatLng);
                citiesChecked++;

                if (distance < minDistance && distance <= maxSearchRadius) {
                    minDistance = distance;
                    closestCity = { ...city, distance };

                    if (index < 10) {
                        console.log(`🎯 [MapCitySelector] New closest city: ${city.city} (${Math.round(distance / 1000)}km)`);
                    }
                }
            });

            console.log(`🎯 [MapCitySelector] Search complete:`, {
                totalCities: allCities.length,
                citiesWithCoords,
                citiesChecked,
                closestCity: closestCity?.city || 'none',
                distance: closestCity ? Math.round(minDistance / 1000) + 'km' : 'N/A',
                found: !!closestCity
            });

            return closestCity;
        } catch (error) {
            console.error('❌ [MapCitySelector] Error finding closest city:', error);
            return null;
        }
    }, [getAllCitiesWithCoordinatesCached]);

    // Smart arrow tool handler - add or remove based on delete mode
    const handleSmartArrowClick = useCallback(async (clickEvent) => {
        const clickLatLng = clickEvent.latLng;

        // Extract coordinates from Google Maps LatLng object
        const clickLat = clickLatLng.lat();
        const clickLng = clickLatLng.lng();

        console.log(`🎯 [MapCitySelector] Smart arrow click at:`, {
            lat: clickLat,
            lng: clickLng,
            deleteMode: deleteMode
        });

        // Show persistent loading notification for city search (no auto-hide)
        enqueueSnackbar('🔍 Searching for closest city...', {
            variant: 'info',
            persist: true, // Stay visible until manually dismissed
            key: 'city-search-loading'
        });

        // Check if click was near an existing marker (within ~5km)
        console.log(`🔍 [MapCitySelector] Checking for existing cities near click (${visualCities.length} cities to check)`);

        const existingCity = visualCities.find(city => {
            if (!city.latitude || !city.longitude) return false;
            const cityLatLng = new window.google.maps.LatLng(city.latitude, city.longitude);
            const distance = window.google.maps.geometry.spherical.computeDistanceBetween(clickLatLng, cityLatLng);
            return distance <= 5000; // 5km radius for existing marker detection
        });

        console.log(`🔍 [MapCitySelector] Existing city found:`, existingCity?.city || 'none');

        if (existingCity && deleteMode) {
            // In delete mode: Remove existing city when clicking near markers
            console.log(`🗑️ [MapCitySelector] Delete mode: removing ${existingCity.city}`);

            // Dismiss loading notification
            enqueueSnackbar('', { key: 'city-search-loading', persist: false, autoHideDuration: 1 });

            handleDirectMarkerRemoval(existingCity);
        } else {
            // In add mode OR clicking empty areas: Find closest city to add
            console.log(`➕ [MapCitySelector] Add mode: finding closest city to click`);

            try {
                const closestCity = await findClosestCityToClick(clickLatLng);
                console.log(`🔍 [MapCitySelector] findClosestCityToClick returned:`, closestCity?.city || 'null');

                if (closestCity) {
                    // Check if city is already selected
                    const isAlreadySelected = visualCities.some(c =>
                        (c.searchKey || c.id) === (closestCity.searchKey || closestCity.id)
                    );

                    console.log(`🔍 [MapCitySelector] Is ${closestCity.city} already selected?`, isAlreadySelected);

                    // Dismiss loading notification first
                    enqueueSnackbar('', { key: 'city-search-loading', persist: false, autoHideDuration: 1 });

                    if (isAlreadySelected) {
                        enqueueSnackbar(`${closestCity.city} is already selected`, { variant: 'info' });
                    } else {
                        // Add the closest city
                        console.log(`➕ [MapCitySelector] Adding ${closestCity.city} to visual cities`);

                        const updatedVisualCities = [...visualCities, closestCity];
                        setVisualCities(updatedVisualCities);

                        // Add to pending database changes
                        setPendingDatabaseChanges(prev => [
                            ...prev,
                            { type: 'add', city: closestCity }
                        ]);

                        enqueueSnackbar(`➕ Added ${closestCity.city} (${Math.round(closestCity.distance / 1000)}km away)`, { variant: 'success' });
                    }
                } else {
                    console.log(`❌ [MapCitySelector] No closest city found`);

                    // Dismiss loading notification
                    enqueueSnackbar('', { key: 'city-search-loading', persist: false, autoHideDuration: 1 });

                    enqueueSnackbar('No cities found within 50km of click location', { variant: 'warning' });
                }
            } catch (error) {
                console.error('❌ [MapCitySelector] Error in findClosestCityToClick:', error);

                // Dismiss loading notification on error
                enqueueSnackbar('', { key: 'city-search-loading', persist: false, autoHideDuration: 1 });

                enqueueSnackbar('Error finding closest city', { variant: 'error' });
            }
        }
    }, [visualCities, handleDirectMarkerRemoval, findClosestCityToClick, enqueueSnackbar, deleteMode]);

    // Clear all measurement labels
    const clearMeasurementLabels = useCallback(() => {
        measurementLabelsRef.current.forEach(label => {
            if (label && label.setMap) label.setMap(null);
        });
        measurementLabelsRef.current = [];
        setMeasurementLabels([]);
        console.log(`🧹 [MapCitySelector] Cleared all measurement labels`);
    }, []);

    // Real-time distance measurement for shapes during drawing
    const addRealTimeDistanceMeasurement = useCallback((overlay, type) => {
        if (!googleMapRef.current) return;

        // Only clear existing measurements for the same overlay to avoid clearing other shapes
        const existingLabelsForThisOverlay = measurementLabelsRef.current.filter(label =>
            label.overlayId === overlay.id || label.overlay === overlay
        );
        existingLabelsForThisOverlay.forEach(label => {
            if (label && label.setMap) label.setMap(null);
        });

        // Remove cleared labels from the ref
        measurementLabelsRef.current = measurementLabelsRef.current.filter(label =>
            !existingLabelsForThisOverlay.includes(label)
        );

        const labels = [];

        if (type === 'rectangle') {
            const bounds = overlay.getBounds();
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const nw = new window.google.maps.LatLng(ne.lat(), sw.lng());
            const se = new window.google.maps.LatLng(sw.lat(), ne.lng());

            // Calculate distances for each side
            const topDistance = window.google.maps.geometry.spherical.computeDistanceBetween(nw, ne);
            const rightDistance = window.google.maps.geometry.spherical.computeDistanceBetween(ne, se);
            const bottomDistance = window.google.maps.geometry.spherical.computeDistanceBetween(se, sw);
            const leftDistance = window.google.maps.geometry.spherical.computeDistanceBetween(sw, nw);

            // Create labels for each side (on the edge, not center)
            const sideLabels = [
                { pos: new window.google.maps.LatLng((nw.lat() + ne.lat()) / 2, (nw.lng() + ne.lng()) / 2), text: `${Math.round(topDistance / 1000)}km` },
                { pos: new window.google.maps.LatLng((ne.lat() + se.lat()) / 2, (ne.lng() + se.lng()) / 2), text: `${Math.round(rightDistance / 1000)}km` },
                { pos: new window.google.maps.LatLng((se.lat() + sw.lat()) / 2, (se.lng() + sw.lng()) / 2), text: `${Math.round(bottomDistance / 1000)}km` },
                { pos: new window.google.maps.LatLng((sw.lat() + nw.lat()) / 2, (sw.lng() + nw.lng()) / 2), text: `${Math.round(leftDistance / 1000)}km` }
            ];

            sideLabels.forEach(side => {
                const label = new window.google.maps.Marker({
                    position: side.pos,
                    map: googleMapRef.current,
                    icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="20">
                                <rect width="40" height="20" fill="rgba(255,255,255,0.95)" stroke="#000000" stroke-width="1.5" rx="4"/>
                                <text x="20" y="14" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#000000" stroke="#ffffff" stroke-width="0.5">${side.text}</text>
                            </svg>
                        `),
                        scaledSize: new window.google.maps.Size(40, 20),
                        anchor: new window.google.maps.Point(20, 10)
                    },
                    clickable: false,
                    zIndex: 9999 // High z-index to ensure labels appear above all other elements
                });

                // Add overlay reference for tracking
                label.overlay = overlay;
                labels.push(label);
            });

        } else if (type === 'circle') {
            const radius = overlay.getRadius();
            const center = overlay.getCenter();

            // Create label on the radius line (not center)
            const radiusEndPoint = new window.google.maps.LatLng(
                center.lat(),
                center.lng() + (radius / 111320) // Approximate degrees per meter at equator
            );

            const midPoint = new window.google.maps.LatLng(
                center.lat(),
                (center.lng() + radiusEndPoint.lng()) / 2
            );

            const label = new window.google.maps.Marker({
                position: midPoint,
                map: googleMapRef.current,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="20">
                            <rect width="40" height="20" fill="rgba(255,255,255,0.95)" stroke="#000000" stroke-width="1.5" rx="4"/>
                            <text x="20" y="14" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#000000" stroke="#ffffff" stroke-width="0.5">${Math.round(radius / 1000)}km</text>
                        </svg>
                    `),
                    scaledSize: new window.google.maps.Size(40, 20),
                    anchor: new window.google.maps.Point(20, 10)
                },
                clickable: false,
                zIndex: 9999 // High z-index to ensure labels appear above all other elements
            });

            // Add overlay reference for tracking
            label.overlay = overlay;
            labels.push(label);

        } else if (type === 'polygon') {
            const path = overlay.getPath();
            const pathArray = path.getArray();

            // Create labels for each edge
            for (let i = 0; i < pathArray.length; i++) {
                const current = pathArray[i];
                const next = pathArray[(i + 1) % pathArray.length];
                const edgeDistance = window.google.maps.geometry.spherical.computeDistanceBetween(current, next);

                // Position label at midpoint of edge
                const midPoint = new window.google.maps.LatLng(
                    (current.lat() + next.lat()) / 2,
                    (current.lng() + next.lng()) / 2
                );

                const label = new window.google.maps.Marker({
                    position: midPoint,
                    map: googleMapRef.current,
                    icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="20">
                                <rect width="40" height="20" fill="rgba(255,255,255,0.95)" stroke="#000000" stroke-width="1.5" rx="4"/>
                                <text x="20" y="14" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#000000" stroke="#ffffff" stroke-width="0.5">${Math.round(edgeDistance / 1000)}km</text>
                            </svg>
                        `),
                        scaledSize: new window.google.maps.Size(40, 20),
                        anchor: new window.google.maps.Point(20, 10)
                    },
                    clickable: false,
                    zIndex: 9999 // High z-index to ensure labels appear above all other elements
                });

                // Add overlay reference for tracking
                label.overlay = overlay;
                labels.push(label);
            }
        }

        // Store all labels for cleanup (append to existing labels)
        measurementLabelsRef.current = [...measurementLabelsRef.current, ...labels];
        setMeasurementLabels(measurementLabelsRef.current);

        console.log(`📏 [MapCitySelector] Added ${labels.length} ${type} distance labels`);
    }, [clearMeasurementLabels]);

    // PERFORMANCE OPTIMIZED: Render city markers with efficient batching
    const renderCityMarkers = useCallback(() => {
        if (!googleMapRef.current) return;

        // PERFORMANCE: Only log summary, not individual operations
        console.log(`🗺️ [MapCitySelector] Rendering ${visualCities.length} city markers`);

        // EFFICIENT CLEAR: Batch remove all existing markers from ref
        const existingMarkers = cityMarkersRef.current || [];
        existingMarkers.forEach(marker => {
            if (marker?.setMap) marker.setMap(null);
        });

        console.log(`🧹 [MapCitySelector] Cleared ${existingMarkers.length} existing markers from map`);

        // PERFORMANCE: Early return for empty cities
        if (visualCities.length === 0) {
            setCityMarkers([]);
            cityMarkersRef.current = []; // Also clear ref
            return;
        }

        // RENDER ALL MARKERS: Create markers for ALL cities regardless of zoom level
        let validMarkers = 0;
        let skippedCities = 0;

        console.log(`🔍 [MapCitySelector] Processing ${visualCities.length} cities for marker creation`);

        const newMarkers = visualCities.reduce((markers, city, index) => {
            const lat = city.latitude || city.lat;
            const lng = city.longitude || city.lng;

            // Debug first few cities
            if (index < 5) {
                console.log(`🔍 [MapCitySelector] City ${index}: ${city.city}`, {
                    lat, lng,
                    hasLatitude: !!city.latitude,
                    hasLat: !!city.lat,
                    hasLongitude: !!city.longitude,
                    hasLng: !!city.lng,
                    latType: typeof lat,
                    lngType: typeof lng
                });
            }

            // Check for valid coordinates
            if (!lat || !lng || typeof lat !== 'number' || typeof lng !== 'number') {
                skippedCities++;
                return markers;
            }

            validMarkers++;

            // Get current zoom level for marker sizing
            const currentZoom = googleMapRef.current.getZoom() || 6;
            const markerSize = getMarkerSize(currentZoom);

            // Check if city is disabled (status !== 'enabled')
            const isDisabled = city.status && city.status !== 'enabled';

            // Debug status for first few cities
            if (index < 3) {
                console.log(`🔍 [MapCitySelector] Creating marker ${index} for ${city.city}:`, {
                    status: city.status,
                    isDisabled: isDisabled,
                    iconType: isDisabled ? 'RED_X' : 'PINK_CIRCLE'
                });
            }

            // Create different icons based on status - Enhanced visibility
            const iconSvg = isDisabled ?
                // Red X for disabled cities - Enhanced with better contrast
                `<svg width="${markerSize}" height="${markerSize}" viewBox="0 0 ${markerSize} ${markerSize}" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="${markerSize / 2}" cy="${markerSize / 2}" r="${markerSize / 2 - 2}" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
                    <line x1="${markerSize * 0.25}" y1="${markerSize * 0.25}" x2="${markerSize * 0.75}" y2="${markerSize * 0.75}" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
                    <line x1="${markerSize * 0.75}" y1="${markerSize * 0.25}" x2="${markerSize * 0.25}" y2="${markerSize * 0.75}" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
                </svg>` :
                // Pink circle for enabled cities
                `<svg width="${markerSize}" height="${markerSize}" viewBox="0 0 ${markerSize} ${markerSize}" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="${markerSize / 2}" cy="${markerSize / 2}" r="${markerSize / 2 - 2}" fill="#ff69b4" stroke="#ffffff" stroke-width="2"/>
                </svg>`;

            const marker = new window.google.maps.Marker({
                position: { lat, lng },
                map: googleMapRef.current,
                title: `${city.city}, ${city.provinceState || city.province}, ${city.country}${isDisabled ? ' (DISABLED)' : ''}`,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(iconSvg),
                    scaledSize: new window.google.maps.Size(markerSize, markerSize),
                    anchor: new window.google.maps.Point(markerSize / 2, markerSize / 2)
                }
            });

            // Store city data with marker for status-based resizing
            marker.cityData = city;

            // Enhanced click handler for marker-specific actions
            marker.addListener('click', (event) => {
                // Stop event propagation to prevent map click handler from firing
                event.stop();

                if (mapMode === 'arrow' && deleteMode) {
                    // Arrow tool in delete mode: Remove marker
                    handleDirectMarkerRemoval(city);
                } else if (mapMode === 'arrow' && !deleteMode) {
                    // Arrow tool in add mode: Just show info (add mode focuses on empty area clicks)
                    enqueueSnackbar(`📍 ${city.city} is already selected (click empty areas to add new cities)`, { variant: 'info' });
                } else {
                    // Default info mode for other tools
                    enqueueSnackbar(`📍 ${city.city}, ${city.provinceState || city.province}`, { variant: 'info' });
                }
            });

            markers.push(marker);
            return markers;
        }, []);

        console.log(`✅ [MapCitySelector] MARKER SUMMARY:`, {
            totalCities: visualCities.length,
            validMarkers,
            skippedCities,
            markersCreated: newMarkers.length,
            sampleCities: visualCities.slice(0, 3).map(c => ({
                city: c.city,
                lat: c.latitude || c.lat,
                lng: c.longitude || c.lng
            }))
        });

        if (skippedCities > 0) {
            console.warn(`⚠️ [MapCitySelector] Skipped ${skippedCities} cities due to missing coordinates`);
        }

        setCityMarkers(newMarkers);
        cityMarkersRef.current = newMarkers; // Immediately update ref for zoom listener

        console.log(`🔍 [MapCitySelector] Stored ${newMarkers.length} markers in both state and ref`);
    }, [visualCities, enqueueSnackbar, getMarkerSize, mapMode, handleDirectMarkerRemoval, deleteMode]); // Added deleteMode dependency


    // Find cities in shapes - OPTIMIZED for delete mode
    const findCitiesInShape = useCallback(async (overlay, type) => {
        setDetecting(true);
        try {
            // PERFORMANCE OPTIMIZATION: For delete mode, only check currently visible cities
            // For add mode, check all cities in database
            const citiesToCheck = deleteMode ? visualCities : await getAllCitiesWithCoordinatesCached();

            console.log(`🔍 [MapCitySelector] ${deleteMode ? 'DELETE' : 'ADD'} mode: Checking ${citiesToCheck.length} cities in shape`);

            let citiesInShape = [];

            if (type === 'polygon') {
                citiesInShape = citiesToCheck.filter(city => {
                    if (!city.latitude || !city.longitude) return false;
                    const cityLatLng = new window.google.maps.LatLng(city.latitude, city.longitude);
                    return window.google.maps.geometry.poly.containsLocation(cityLatLng, overlay);
                });
            } else if (type === 'rectangle') {
                const bounds = overlay.getBounds();
                citiesInShape = citiesToCheck.filter(city => {
                    if (!city.latitude || !city.longitude) return false;
                    const cityLatLng = new window.google.maps.LatLng(city.latitude, city.longitude);
                    return bounds.contains(cityLatLng);
                });
            } else if (type === 'circle') {
                const center = overlay.getCenter();
                const radius = overlay.getRadius();
                citiesInShape = citiesToCheck.filter(city => {
                    if (!city.latitude || !city.longitude) return false;
                    const cityLatLng = new window.google.maps.LatLng(city.latitude, city.longitude);
                    const distance = window.google.maps.geometry.spherical.computeDistanceBetween(center, cityLatLng);
                    return distance <= radius;
                });
            }

            console.log(`✅ [MapCitySelector] Found ${citiesInShape.length} cities in ${type} shape`);
            return citiesInShape;
        } finally {
            setDetecting(false);
        }
    }, [getAllCitiesWithCoordinatesCached, deleteMode, visualCities]);

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

    // STEP 3: Confirm action - Update visual state immediately, queue database changes
    const confirmAction = useCallback(() => {
        try {
            if (pendingAction === 'delete') {
                // STEP 3: Visual deletion - Remove from map immediately
                const cityIdsToDelete = new Set(pendingCities.map(c => c.searchKey || c.id));
                const remainingVisualCities = visualCities.filter(city =>
                    !cityIdsToDelete.has(city.searchKey || city.id)
                );

                console.log(`🗑️ [STEP 3] Visual deletion: ${pendingCities.length} cities removed from map`);

                // Update visual state immediately (map updates instantly)
                setVisualCities(remainingVisualCities);

                // Queue for database deletion when DONE is pressed
                setPendingDatabaseChanges(prev => [...prev, {
                    action: 'delete',
                    cities: pendingCities,
                    finalCities: remainingVisualCities,
                    timestamp: Date.now()
                }]);

                enqueueSnackbar(`🗑️ Removed ${pendingCities.length} cities from map (press DONE to save)`, {
                    variant: 'warning'
                });
            } else {
                // STEP 3: Visual addition - Add to map immediately
                const existingKeys = new Set(visualCities.map(c => c.searchKey || c.id));
                const newCities = pendingCities.filter(city => !existingKeys.has(city.searchKey || city.id));

                if (newCities.length === 0) {
                    enqueueSnackbar('All cities in this area are already selected', { variant: 'info' });
                } else {
                    console.log(`➕ [STEP 3] Visual addition: ${newCities.length} cities added to map`);

                    const newVisualCities = [...visualCities, ...newCities];

                    // Update visual state immediately (map updates instantly)
                    setVisualCities(newVisualCities);

                    // Queue for database addition when DONE is pressed
                    setPendingDatabaseChanges(prev => [...prev, {
                        action: 'add',
                        cities: newCities,
                        finalCities: newVisualCities,
                        timestamp: Date.now()
                    }]);

                    enqueueSnackbar(`✅ Added ${newCities.length} cities to map (press DONE to save)`, {
                        variant: 'success'
                    });
                }
            }

            // Clean up overlay and measurement labels
            if (pendingOverlay) {
                pendingOverlay.setMap(null);
            }
            clearMeasurementLabels();

        } catch (error) {
            console.error('❌ Error confirming action:', error);
            enqueueSnackbar('Error processing cities', { variant: 'error' });
        } finally {
            setConfirmDialogOpen(false);
            setPendingCities([]);
            setPendingOverlay(null);
            setPendingAction('add');
        }
    }, [pendingAction, pendingCities, visualCities, enqueueSnackbar, pendingOverlay]);

    // Cancel action from dialog
    const cancelAction = useCallback(() => {
        setConfirmDialogOpen(false);
        setPendingCities([]);
        setPendingAction('add');

        // Remove the drawing overlay and measurement labels
        if (pendingOverlay) {
            pendingOverlay.setMap(null);
            setPendingOverlay(null);
        }
        clearMeasurementLabels();
    }, [pendingOverlay, clearMeasurementLabels]);

    // STEP 4: Handle DONE button - Apply all pending database changes
    const handleDone = useCallback(async () => {
        if (pendingDatabaseChanges.length === 0) {
            // No pending changes, just close
            if (onDone) onDone();
            return;
        }

        console.log(`💾 [STEP 4] Processing ${pendingDatabaseChanges.length} database changes`);

        try {
            // Apply the final visual state to the database
            const finalCities = visualCities;

            console.log(`💾 [STEP 4] Saving ${finalCities.length} cities to database`);

            // Call parent's onSelectionComplete with final cities
            onSelectionComplete(finalCities);

            // Clear pending changes
            setPendingDatabaseChanges([]);

            enqueueSnackbar(`💾 Saved ${finalCities.length} cities to database`, {
                variant: 'success'
            });

            // Close the map view
            if (onDone) onDone();

        } catch (error) {
            console.error('❌ Error saving database changes:', error);
            enqueueSnackbar('Failed to save changes to database', { variant: 'error' });
        }
    }, [pendingDatabaseChanges, visualCities, onSelectionComplete, onDone, enqueueSnackbar]);

    // Handle CANCEL button - Revert all pending changes
    const handleCancel = useCallback(() => {
        console.log(`🚫 [MapCitySelector] Cancelling ${pendingDatabaseChanges.length} pending changes`);

        // Revert visual cities back to original selectedCities prop
        setVisualCities(selectedCities);

        // Clear all pending changes
        setPendingDatabaseChanges([]);

        // Close any open dialogs
        setConfirmDialogOpen(false);
        setPendingCities([]);
        setPendingOverlay(null);

        enqueueSnackbar('🚫 Changes cancelled - reverted to original state', { variant: 'info' });
    }, [pendingDatabaseChanges, selectedCities, enqueueSnackbar]);

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

            // Add debounced zoom change listener to prevent flashing
            let zoomTimeout;
            map.addListener('zoom_changed', () => {
                console.log('🔍 [MapCitySelector] Zoom changed, debouncing marker size update...');

                // Clear previous timeout
                if (zoomTimeout) {
                    clearTimeout(zoomTimeout);
                }

                // Debounce marker updates to prevent flashing
                zoomTimeout = setTimeout(() => {
                    console.log('🔍 [MapCitySelector] Executing debounced marker size update');
                    updateMarkerSizes();
                }, 150); // 150ms debounce
            });

            // Add map click listener for smart arrow tool
            map.addListener('click', (event) => {
                const currentMapMode = mapModeRef.current;
                console.log(`🗺️ [MapCitySelector] Map clicked - Mode: ${currentMapMode}, Event:`, event);

                if (currentMapMode === 'arrow') {
                    console.log(`🎯 [MapCitySelector] Arrow mode detected, calling handleSmartArrowClick`);
                    handleSmartArrowClick(event);
                } else {
                    console.log(`🗺️ [MapCitySelector] Not in arrow mode (${currentMapMode}), ignoring click`);
                }
            });

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

                // Add real-time distance measurement labels
                addRealTimeDistanceMeasurement(event.overlay, shapeType);

                // Add real-time update listeners for live measurement updates
                if (shapeType === 'rectangle') {
                    event.overlay.addListener('bounds_changed', () => {
                        addRealTimeDistanceMeasurement(event.overlay, shapeType);
                    });
                } else if (shapeType === 'circle') {
                    event.overlay.addListener('radius_changed', () => {
                        addRealTimeDistanceMeasurement(event.overlay, shapeType);
                    });
                    event.overlay.addListener('center_changed', () => {
                        addRealTimeDistanceMeasurement(event.overlay, shapeType);
                    });
                } else if (shapeType === 'polygon') {
                    event.overlay.getPath().addListener('set_at', () => {
                        addRealTimeDistanceMeasurement(event.overlay, shapeType);
                    });
                    event.overlay.getPath().addListener('insert_at', () => {
                        addRealTimeDistanceMeasurement(event.overlay, shapeType);
                    });
                    event.overlay.getPath().addListener('remove_at', () => {
                        addRealTimeDistanceMeasurement(event.overlay, shapeType);
                    });
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
    }, [handleShapeComplete, enqueueSnackbar, handleSmartArrowClick, mapMode, addRealTimeDistanceMeasurement]);

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

    // Update city markers when visual cities change (performance optimized)
    useEffect(() => {
        if (mapLoaded && googleMapRef.current && mapMode !== 'draw') {
            renderCityMarkers();
        }
    }, [mapLoaded, visualCities, mapMode, renderCityMarkers]); // Use visualCities for immediate updates



    useEffect(() => {
        cityMarkersRef.current = cityMarkers;
    }, [cityMarkers]);

    // Sync refs with state for click handlers
    useEffect(() => {
        mapModeRef.current = mapMode;
        console.log(`🔄 [MapCitySelector] mapModeRef updated to: ${mapMode}`);
    }, [mapMode]);

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
            case 'arrow':
                // Arrow mode is for direct marker clicking, not drawing
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

                {/* Arrow Tool - Smart selection */}
                <Tooltip title={deleteMode ? "Click markers to remove • Click empty areas to add closest city" : "Click anywhere to add closest city • Enable delete mode to remove"} placement="right">
                    <Fab
                        size="small"
                        color={mapMode === 'arrow' ? (deleteMode ? 'error' : 'success') : 'default'}
                        onClick={() => setDrawingMode('arrow')}
                        disabled={!drawingToolsReady}
                        sx={{
                            width: 40,
                            height: 40,
                            backgroundColor: mapMode === 'arrow' ? (deleteMode ? '#ef4444' : '#10b981') : undefined
                        }}
                    >
                        <ArrowIcon fontSize="small" />
                    </Fab>
                </Tooltip>

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
                        label={
                            mapMode === 'arrow' ?
                                (deleteMode ? "🎯 CLICK TO REMOVE" : "🎯 SMART SELECT") :
                                deleteMode ? "🗑️ DELETE MODE" : "➕ ADD MODE"
                        }
                        color={
                            mapMode === 'arrow' ?
                                (deleteMode ? "error" : "success") :
                                deleteMode ? "error" : "success"
                        }
                        size="small"
                        sx={{
                            fontSize: '10px',
                            fontWeight: 600,
                            backgroundColor:
                                mapMode === 'arrow' ?
                                    (deleteMode ? '#fef2f2' : '#f0fdf4') :
                                    deleteMode ? '#fef2f2' : '#f0fdf4',
                            color:
                                mapMode === 'arrow' ?
                                    (deleteMode ? '#dc2626' : '#16a34a') :
                                    deleteMode ? '#dc2626' : '#16a34a'
                        }}
                    />
                    <Chip
                        label={`${visualCities.length} cities`}
                        color="primary"
                        size="small"
                        sx={{ fontSize: '11px' }}
                    />
                    {pendingDatabaseChanges.length > 0 && (
                        <Chip
                            label={`${pendingDatabaseChanges.length} pending`}
                            color="warning"
                            size="small"
                            sx={{ fontSize: '10px' }}
                        />
                    )}
                </Card>

                {/* Action Buttons */}
                <Card sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {pendingDatabaseChanges.length > 0 && (
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleCancel}
                            color="error"
                            sx={{ fontSize: '11px' }}
                        >
                            Cancel Changes
                        </Button>
                    )}
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={handleDone}
                        sx={{ fontSize: '11px' }}
                    >
                        {pendingDatabaseChanges.length > 0 ? `Save ${pendingDatabaseChanges.length} Changes` : 'Done'}
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

            {/* Detection Overlay - Bottom left to avoid UI overlap */}
            {detecting && (
                <Box sx={{
                    position: 'absolute',
                    bottom: 20,
                    left: 20,
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
                            {pendingCities.map((city, index) => (
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
                        </List>
                    </Box>

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