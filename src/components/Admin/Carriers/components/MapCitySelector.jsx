/**
 * MapCitySelector Component - REDESIGNED WITH PROPER ARCHITECTURE
 * 
 * Separates shape storage from city storage with proper visualization
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Typography, Button, Chip, CircularProgress, Card, Fab, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText,
    CardHeader, CardContent, IconButton, TextField, Checkbox, FormControlLabel,
    FormControl, InputLabel, Select, MenuItem, InputAdornment,
    Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import {
    PanTool as PanToolIcon,
    Crop32 as RectangleIcon,
    RadioButtonUnchecked as CircleIcon,
    Pentagon as PolygonIcon,
    Delete as DeleteIcon,
    NearMe as ArrowIcon,
    Layers as ZonesIcon,
    Add as AddIcon,
    Edit as EditIcon,
    ChevronRight as ChevronRightIcon,
    ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { loadGoogleMaps } from '../../../../utils/googleMapsLoader';
import { collection, query, where, getDocs, limit, orderBy, startAfter } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../../firebase';
import { useAuth } from '../../../../contexts/AuthContext';

// Zone color palette for visual distinction
const ZONE_COLORS = [
    { primary: '#3b82f6', secondary: '#dbeafe', name: 'Blue' },      // Blue
    { primary: '#10b981', secondary: '#d1fae5', name: 'Green' },     // Green  
    { primary: '#f59e0b', secondary: '#fef3c7', name: 'Orange' },    // Orange
    { primary: '#ef4444', secondary: '#fee2e2', name: 'Red' },       // Red
    { primary: '#8b5cf6', secondary: '#ede9fe', name: 'Purple' },    // Purple
    { primary: '#06b6d4', secondary: '#cffafe', name: 'Cyan' },      // Cyan
    { primary: '#ec4899', secondary: '#fce7f3', name: 'Pink' },      // Pink
    { primary: '#84cc16', secondary: '#ecfccb', name: 'Lime' },      // Lime
    { primary: '#f97316', secondary: '#fed7aa', name: 'Amber' },     // Amber
    { primary: '#6366f1', secondary: '#e0e7ff', name: 'Indigo' }     // Indigo
];

const MapCitySelector = ({
    selectedCities = [],
    onSelectionComplete,
    zoneCategory = 'pickupZones',
    onDone,
    zonesWithColors = [],
    carrierId
}) => {
    const { enqueueSnackbar } = useSnackbar();
    const { currentUser, isAuthenticated } = useAuth();
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

    // Zone visualization state
    const zoneOverlaysRef = useRef([]);
    const [showZones, setShowZones] = useState(true);

    // Zone creation flow state - Two Phase Process
    const [zoneCreationPhase, setZoneCreationPhase] = useState(null); // null | 'form' | 'polygon' | 'confirmation'
    const zoneCreationPhaseRef = useRef(null);
    const [zoneFormData, setZoneFormData] = useState({
        name: '',
        code: '',
        description: '',
        serviceType: 'standard',
        priority: 1
    });
    const [generatingCode, setGeneratingCode] = useState(false);
    const [currentPolygon, setCurrentPolygon] = useState(null);
    const [polygonConfirmed, setPolygonConfirmed] = useState(false);
    const [detectedCities, setDetectedCities] = useState([]);
    const [savingZone, setSavingZone] = useState(false);
    const [detectingCities, setDetectingCities] = useState(false);

    // Zone management state
    const [editingZone, setEditingZone] = useState(null);
    const customZoneBoundariesRef = useRef([]);

    // Legacy state (keeping for compatibility)
    const [zoneDrawingMode, setZoneDrawingMode] = useState(false);
    const [selectedZoneForDrawing, setSelectedZoneForDrawing] = useState(null);
    const [creatingNewZone, setCreatingNewZone] = useState(false);
    const [zoneFormOpen, setZoneFormOpen] = useState(false);
    const [editingZoneBoundary, setEditingZoneBoundary] = useState(null);

    // Zone legend and controls
    const [zoneLegendOpen, setZoneLegendOpen] = useState(false);
    const [showSystemZones, setShowSystemZones] = useState(true);
    const [showCustomZones, setShowCustomZones] = useState(true);
    const [customCarrierZones, setCustomCarrierZones] = useState([]);
    const [customZonesFlat, setCustomZonesFlat] = useState([]);

    // Accordion section states - only zone creation expanded by default
    const [expandedSections, setExpandedSections] = useState({
        zoneCreation: true,
        zoneLayers: false,
        systemZones: false,
        customZones: false
    });

    // Initialize and sync visual cities with selectedCities prop
    useEffect(() => {
        setVisualCities(selectedCities);
    }, [selectedCities]); // Sync whenever selectedCities changes

    // Load existing custom carrier zones
    const loadCustomCarrierZones = useCallback(async () => {
        if (!carrierId) {
            console.log('⏸️ No carrierId provided, skipping zone loading');
            return;
        }

        try {
            console.log('🔄 Loading custom zones for carrier:', carrierId);
            // Load zone boundaries (polygon shapes)
            const loadZoneBoundariesFn = httpsCallable(functions, 'loadZoneBoundaries');
            const [boundariesRes, customZonesRes] = await Promise.all([
                loadZoneBoundariesFn({ carrierId, zoneCategory: zoneCategory || 'pickupZones' }),
                httpsCallable(functions, 'getCarrierCustomZones')({ carrierId })
            ]);

            if (boundariesRes.data.success && boundariesRes.data.boundaries) {
                console.log('✅ Loaded custom zone boundaries:', boundariesRes.data.boundaries.length);
                setCustomCarrierZones(boundariesRes.data.boundaries);

                boundariesRes.data.boundaries.forEach(zone => {
                    if (zone.boundary && zone.boundary.coordinates && googleMapRef.current) {
                        renderCustomZoneBoundary(zone);
                    }
                });
            } else {
                setCustomCarrierZones([]);
            }

            if (customZonesRes.data.success) {
                const zones = (customZonesRes.data.zones || []).map((z, idx) => ({
                    ...z,
                    color: z.color || ZONE_COLORS[idx % ZONE_COLORS.length]
                }));
                setCustomZonesFlat(zones);
            } else {
                setCustomZonesFlat([]);
            }
        } catch (error) {
            console.error('❌ Error loading custom carrier zones:', error);

            // Handle specific error types
            if (error.code === 'unauthenticated') {
                console.warn('🔐 Authentication required for loading zones');
                // Don't show error to user for auth issues, just log
            } else if (error.code === 'permission-denied') {
                console.warn('🚫 Permission denied for loading zones');
            } else {
                // Show user-friendly error for other issues
                enqueueSnackbar('Unable to load existing zones', { variant: 'warning' });
            }

            // Set empty zones on error to prevent UI issues
            setCustomCarrierZones([]);
        }
    }, [carrierId, zoneCategory, enqueueSnackbar]);

    // Load custom zones when component mounts or carrierId changes
    useEffect(() => {
        loadCustomCarrierZones();
    }, [loadCustomCarrierZones]);

    // Sync zone creation phase ref with state
    useEffect(() => {
        zoneCreationPhaseRef.current = zoneCreationPhase;
    }, [zoneCreationPhase]);

    // Render zone overlays on the map
    const renderZoneOverlays = useCallback(() => {
        if (!googleMapRef.current || !showZones) return;

        // Clear existing zone overlays
        zoneOverlaysRef.current.forEach(overlay => {
            if (overlay.setMap) {
                overlay.setMap(null);
            } else if (overlay.close) {
                // InfoWindow
                overlay.close();
            }
        });
        zoneOverlaysRef.current = [];

        // Close any open InfoWindows
        if (window.currentZoneInfoWindow) {
            window.currentZoneInfoWindow.close();
            window.currentZoneInfoWindow = null;
        }

        // Combine provided zonesWithColors with flat custom zones (city-based)
        const allZones = [...zonesWithColors, ...customZonesFlat];
        console.log('🗺️ Rendering zone overlays:', allZones.length, 'zones');

        allZones.forEach((zone, index) => {
            console.log(`🏷️ Processing zone ${index + 1}:`, zone.zoneName || zone.name, `(${zone.cities?.length || 0} cities)`);

            if (zone.cities && zone.cities.length > 0) {
                // Create a polygon around the zone's cities
                const coordinates = zone.cities
                    .filter(city => city.latitude && city.longitude)
                    .map(city => ({
                        lat: parseFloat(city.latitude),
                        lng: parseFloat(city.longitude)
                    }));

                if (coordinates.length >= 3) {
                    // Create convex hull for zone boundary
                    const hull = getConvexHull(coordinates);

                    if (hull.length >= 3) {
                        const zonePolygon = new window.google.maps.Polygon({
                            paths: hull,
                            fillColor: zone.color.primary,
                            fillOpacity: 0.15,
                            strokeColor: zone.color.primary,
                            strokeWeight: 2,
                            strokeOpacity: 0.8,
                            map: googleMapRef.current,
                            clickable: true
                        });

                        // Add zone label
                        const bounds = new window.google.maps.LatLngBounds();
                        hull.forEach(coord => bounds.extend(coord));
                        const center = bounds.getCenter();

                        // Create simple zone label with Google Maps InfoWindow (but minimal)
                        const zoneLabel = new window.google.maps.InfoWindow({
                            content: `<div style="font-size: 11px; font-weight: 600; color: ${zone.color.primary}; text-align: center; padding: 2px 4px;">
                                        ${zone.zoneName || zone.name}<br>
                                        <span style="font-size: 9px; color: #6b7280;">${zone.cities.length} cities</span>
                                      </div>`,
                            position: center,
                            disableAutoPan: true,
                            disableCloseButton: true
                        });

                        // Show label on polygon click with console logging
                        zonePolygon.addListener('click', (event) => {
                            console.log('🖱️ Zone polygon clicked:', zone.zoneName || zone.name);

                            // Close any existing InfoWindows
                            if (window.currentZoneInfoWindow) {
                                window.currentZoneInfoWindow.close();
                            }

                            // Open this InfoWindow
                            zoneLabel.open(googleMapRef.current);
                            window.currentZoneInfoWindow = zoneLabel;
                        });

                        zoneOverlaysRef.current.push(zonePolygon, zoneLabel);
                    }
                } else if (coordinates.length >= 1) {
                    // Fallback for zones with 1-2 cities: Create circular area around cities
                    coordinates.forEach((coord, index) => {
                        const circle = new window.google.maps.Circle({
                            center: coord,
                            radius: coordinates.length === 1 ? 25000 : 15000, // 25km for single city, 15km for 2 cities
                            fillColor: zone.color.primary,
                            fillOpacity: 0.1,
                            strokeColor: zone.color.primary,
                            strokeWeight: 2,
                            strokeOpacity: 0.6,
                            map: googleMapRef.current,
                            clickable: true
                        });

                        zoneOverlaysRef.current.push(circle);
                    });

                    // Add zone label at first city
                    const circleZoneLabel = new window.google.maps.InfoWindow({
                        content: `<div style="font-size: 11px; font-weight: 600; color: ${zone.color.primary}; text-align: center; padding: 2px 4px;">
                                    ${zone.zoneName || zone.name}<br>
                                    <span style="font-size: 9px; color: #6b7280;">${zone.cities.length} cities</span>
                                  </div>`,
                        position: coordinates[0],
                        disableAutoPan: true,
                        disableCloseButton: true
                    });

                    // Show label on circle click with console logging
                    coordinates.forEach((coord, index) => {
                        const circle = zoneOverlaysRef.current[zoneOverlaysRef.current.length - coordinates.length + index];
                        if (circle) {
                            circle.addListener('click', (event) => {
                                console.log('🖱️ Zone circle clicked:', zone.zoneName || zone.name);

                                // Close any existing InfoWindows
                                if (window.currentZoneInfoWindow) {
                                    window.currentZoneInfoWindow.close();
                                }

                                // Open this InfoWindow
                                circleZoneLabel.open(googleMapRef.current);
                                window.currentZoneInfoWindow = circleZoneLabel;
                            });
                        }
                    });

                    zoneOverlaysRef.current.push(circleZoneLabel);
                }
            }
        });
    }, [zonesWithColors, showZones]);

    // Simple convex hull algorithm for zone boundaries
    const getConvexHull = useCallback((points) => {
        if (points.length < 3) return points;

        // Find the bottom-most point (and left-most in case of tie)
        let start = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].lat < points[start].lat ||
                (points[i].lat === points[start].lat && points[i].lng < points[start].lng)) {
                start = i;
            }
        }

        // Sort points by polar angle with respect to start point
        const startPoint = points[start];
        const sortedPoints = points.filter((_, i) => i !== start).sort((a, b) => {
            const angleA = Math.atan2(a.lat - startPoint.lat, a.lng - startPoint.lng);
            const angleB = Math.atan2(b.lat - startPoint.lat, b.lng - startPoint.lng);
            return angleA - angleB;
        });

        // Build convex hull
        const hull = [startPoint];
        for (const point of sortedPoints) {
            while (hull.length > 1) {
                const cross = (hull[hull.length - 1].lng - hull[hull.length - 2].lng) * (point.lat - hull[hull.length - 2].lat) -
                    (hull[hull.length - 1].lat - hull[hull.length - 2].lat) * (point.lng - hull[hull.length - 2].lng);
                if (cross > 0) break;
                hull.pop();
            }
            hull.push(point);
        }

        return hull;
    }, []);

    // Handle zone boundary drawing completion - NEW TWO-PHASE APPROACH
    const handleZoneBoundaryComplete = useCallback(async (overlay) => {
        if (!overlay) return;

        try {
            console.log('🗺️ Polygon completion handler triggered');
            console.log('📊 Current zone creation phase:', zoneCreationPhase);
            console.log('✏️ Editing zone:', editingZone ? editingZone.name : 'none');

            // Get polygon path coordinates
            const path = overlay.getPath();
            const coordinates = [];

            for (let i = 0; i < path.getLength(); i++) {
                const latLng = path.getAt(i);
                coordinates.push({
                    lat: latLng.lat(),
                    lng: latLng.lng()
                });
            }

            console.log('🗺️ Polygon drawn with coordinates:', coordinates.length, 'points');

            // Assign color for preview
            const colorIndex = customCarrierZones.length % ZONE_COLORS.length;
            const zoneColor = ZONE_COLORS[colorIndex];

            // Style the polygon for preview with distances
            overlay.setOptions({
                fillColor: zoneColor.primary,
                fillOpacity: 0.3,
                strokeColor: zoneColor.primary,
                strokeWeight: 3,
                strokeOpacity: 0.9,
                clickable: true,
                editable: true // Allow editing during confirmation phase
            });

            // Store the polygon data
            setCurrentPolygon({
                overlay: overlay,
                coordinates: coordinates,
                color: zoneColor
            });

            // Check current zone creation phase from ref (more reliable)
            const currentPhase = zoneCreationPhaseRef.current;
            console.log('🔍 Zone phase check - state:', zoneCreationPhase, 'ref:', currentPhase);

            if (editingZone) {
                // Editing existing zone - go straight to confirmation
                console.log('✏️ Editing existing zone - setting confirmation phase');
                setZoneCreationPhase('confirmation');
            } else if (currentPhase === 'polygon') {
                // New zone creation - STOP at shape confirmation (DO NOT detect cities automatically)
                console.log('🛑 Zone polygon phase detected - moving to confirmation');
                setZoneCreationPhase('confirmation');
                zoneCreationPhaseRef.current = 'confirmation'; // Keep ref in sync
                setZoneDrawingMode(false);
                setDrawingMode('pan');

                // Ensure city detection state is reset - user must manually confirm
                setPolygonConfirmed(false);
                setDetectedCities([]);

                // Auto-open the zone legend panel to show confirmation UI
                setZoneLegendOpen(true);

                console.log('🛑 Polygon complete - STOPPING at shape confirmation phase');
                enqueueSnackbar('Polygon created! Check the zone panel to review and confirm the shape', { variant: 'success' });

                // DO NOT CALL confirmPolygonAndDetectCities automatically
                return; // Exit early to prevent any automatic city detection
            } else {
                console.log('⚠️ Polygon completed but not in zone creation mode - phase:', currentPhase);
            }

        } catch (error) {
            console.error('❌ Error handling polygon completion:', error);
            enqueueSnackbar('Error processing polygon', { variant: 'error' });
        }
    }, [customCarrierZones.length, editingZone, zoneCreationPhase, enqueueSnackbar]);

    // Render a custom zone boundary on the map
    const renderCustomZoneBoundary = useCallback((zone) => {
        if (!googleMapRef.current || !zone.boundary || !zone.boundary.coordinates) return;

        try {
            // Create polygon overlay
            const polygon = new window.google.maps.Polygon({
                paths: zone.boundary.coordinates.map(coord => ({
                    lat: coord.lat,
                    lng: coord.lng
                })),
                fillColor: zone.color?.primary || '#6b7280',
                fillOpacity: 0.2,
                strokeColor: zone.color?.primary || '#6b7280',
                strokeWeight: 3,
                strokeOpacity: 0.8,
                clickable: true,
                editable: false
            });

            polygon.setMap(googleMapRef.current);

            // Add to persistent overlays
            customZoneBoundariesRef.current.push({
                overlay: polygon,
                zone: zone,
                coordinates: zone.boundary.coordinates
            });

            console.log('✅ Rendered custom zone boundary:', zone.name || zone.zoneName);
        } catch (error) {
            console.error('❌ Error rendering custom zone boundary:', error);
        }
    }, []);

    // Generate unique zone code - MATCH EXISTING CARRIER PROCESS
    const generateZoneCode = useCallback(async (zoneName) => {
        if (!zoneName.trim() || !carrierId) return '';

        try {
            // Get existing carrier zones to check for duplicates
            const getCarrierZoneSets = httpsCallable(functions, 'getCarrierCustomZoneSets');
            const result = await getCarrierZoneSets({ carrierId });

            const existingZoneCodes = new Set();
            if (result.data.success) {
                const zoneSets = result.data.zoneSets || [];
                zoneSets.forEach(zoneSet => {
                    if (zoneSet.zones && Array.isArray(zoneSet.zones)) {
                        zoneSet.zones.forEach(zone => {
                            if (zone.zoneId || zone.zoneCode) {
                                existingZoneCodes.add((zone.zoneId || zone.zoneCode).toUpperCase());
                            }
                        });
                    }
                });
            }

            // Generate base code from zone name - EXACT SAME LOGIC
            const baseCode = zoneName
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9\s]/g, '') // Remove special characters
                .replace(/\s+/g, '_') // Replace spaces with underscores
                .substring(0, 20); // Limit length

            // Find unique code
            let uniqueCode = baseCode;
            let counter = 1;

            while (existingZoneCodes.has(uniqueCode)) {
                uniqueCode = `${baseCode}${counter}`;
                counter++;
            }

            return uniqueCode;
        } catch (error) {
            console.error('Error generating zone code:', error);
            // Fallback to simple generation
            return zoneName
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9\s]/g, '')
                .replace(/\s+/g, '_')
                .substring(0, 20);
        }
    }, [carrierId]);

    // Reset zone creation flow
    const resetZoneCreation = useCallback(() => {
        console.log('🔄 Resetting zone creation flow');
        setZoneCreationPhase(null);
        zoneCreationPhaseRef.current = null; // Keep ref in sync
        setZoneFormData({
            name: '',
            code: '',
            description: '',
            serviceType: 'standard',
            priority: 1
        });
        setCurrentPolygon(null);
        setPolygonConfirmed(false);
        setDetectedCities([]);
        setZoneDrawingMode(false);
        setDrawingMode('pan');
        setSavingZone(false);
        setDetectingCities(false);
        setEditingZone(null);

        // Remove any temporary polygon
        if (currentPolygon?.overlay) {
            currentPolygon.overlay.setMap(null);
        }
    }, [currentPolygon]);

    // Start Phase 1: Zone Form
    const startZoneCreation = useCallback(() => {
        console.log('🚀 Starting zone creation - Phase 1: Form');
        setZoneCreationPhase('form');

        // Also open the zone legend panel if it's closed
        if (!zoneLegendOpen) {
            setZoneLegendOpen(true);
        }
    }, [zoneLegendOpen]);

    // Handle accordion section toggle
    const handleAccordionToggle = useCallback((section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    }, []);

    // Move to Phase 2: Polygon Drawing
    const proceedToPolygonDrawing = useCallback(() => {
        if (!zoneFormData.name.trim()) {
            enqueueSnackbar('Please enter a zone name', { variant: 'warning' });
            return;
        }

        console.log('🚀 Moving to polygon drawing phase');
        setZoneCreationPhase('polygon');
        zoneCreationPhaseRef.current = 'polygon'; // Keep ref in sync
        setZoneDrawingMode(true);
        setDrawingMode('polygon');

        // Generate zone code if not provided
        if (!zoneFormData.code.trim()) {
            const generatedCode = generateZoneCode(zoneFormData.name);
            setZoneFormData(prev => ({ ...prev, code: generatedCode }));
        }

        enqueueSnackbar('Draw the zone boundary on the map', { variant: 'info' });
    }, [zoneFormData.name, zoneFormData.code, enqueueSnackbar]);

    // Move to Phase 3: Confirmation
    const proceedToConfirmation = useCallback(() => {
        if (!currentPolygon) {
            enqueueSnackbar('Please draw a polygon first', { variant: 'warning' });
            return;
        }

        setZoneCreationPhase('confirmation');
        setZoneDrawingMode(false);
        setDrawingMode('pan');
    }, [currentPolygon, enqueueSnackbar]);

    // Handle zone name change with async code generation - MATCH EXISTING PROCESS
    const handleZoneNameChange = useCallback(async (name) => {
        setZoneFormData(prev => ({ ...prev, name: name }));

        // Auto-generate zone code if name provided
        if (name.trim()) {
            setGeneratingCode(true);
            try {
                const generatedCode = await generateZoneCode(name);
                setZoneFormData(prev => ({ ...prev, code: generatedCode }));
            } catch (error) {
                console.error('Error generating zone code:', error);
            } finally {
                setGeneratingCode(false);
            }
        } else {
            setZoneFormData(prev => ({ ...prev, code: '' }));
        }
    }, [generateZoneCode]);

    // Handle other form field changes
    const handleZoneFormChange = useCallback((field, value) => {
        setZoneFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Save new custom zone with detected cities
    const handleSaveNewZone = useCallback(async () => {
        if (!currentPolygon || !zoneFormData.name.trim() || !polygonConfirmed) {
            enqueueSnackbar('Please complete all steps before saving', { variant: 'warning' });
            return;
        }

        // Check authentication before proceeding
        if (!isAuthenticated || !currentUser) {
            enqueueSnackbar('Authentication required. Please refresh the page and log in again.', { variant: 'error' });
            return;
        }

        setSavingZone(true);
        try {
            const zoneData = {
                name: zoneFormData.name.trim(), // Updated to match cloud function
                code: zoneFormData.code.trim() || generateZoneCode(zoneFormData.name),
                description: zoneFormData.description.trim(),
                serviceType: zoneFormData.serviceType || 'standard',
                priority: parseInt(zoneFormData.priority) || 1,
                active: true,
                zoneType: 'custom_carrier_zone',
                boundary: {
                    type: 'polygon',
                    coordinates: currentPolygon.coordinates
                },
                carrierId: carrierId,
                zoneCategory: zoneCategory,
                color: currentPolygon.color || { primary: '#6b7280', secondary: '#f3f4f6' },
                cities: detectedCities.map(city => ({
                    id: city.id || city.searchKey,
                    city: city.city,
                    provinceState: city.provinceState,
                    country: city.country,
                    latitude: city.latitude,
                    longitude: city.longitude,
                    searchKey: city.searchKey || city.id
                })),
                cityCount: detectedCities.length,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            console.log('💾 Saving zone with data:', zoneData);
            console.log('🔐 Authentication status:', {
                isAuthenticated,
                hasCurrentUser: !!currentUser,
                userId: currentUser?.uid,
                email: currentUser?.email
            });

            // Save to database
            const saveZoneBoundaryFn = httpsCallable(functions, 'saveZoneBoundary');
            const result = await saveZoneBoundaryFn(zoneData);

            if (result.data && result.data.success) {
                console.log('✅ Zone saved successfully:', result.data);

                // Create the new zone object
                const newZone = {
                    id: result.data.id || result.data.boundaryId,
                    ...zoneData,
                    overlay: currentPolygon.overlay,
                    cities: detectedCities,
                    cityCount: detectedCities.length
                };

                // Add to custom zones list
                setCustomCarrierZones(prev => [...prev, newZone]);

                // Update overlay styling to final state
                if (currentPolygon.overlay && currentPolygon.color) {
                    currentPolygon.overlay.setOptions({
                        fillColor: currentPolygon.color.primary,
                        fillOpacity: 0.2,
                        strokeColor: currentPolygon.color.primary,
                        strokeWeight: 3,
                        strokeOpacity: 0.8,
                        clickable: true,
                        editable: false
                    });
                }

                // Add to persistent overlays
                customZoneBoundariesRef.current.push({
                    overlay: currentPolygon.overlay,
                    zone: newZone,
                    coordinates: currentPolygon.coordinates
                });

                // Add detected cities to the visual cities list
                const updatedVisualCities = [...visualCities];
                detectedCities.forEach(city => {
                    if (!updatedVisualCities.some(vc =>
                        (vc.searchKey || vc.id) === (city.searchKey || city.id)
                    )) {
                        updatedVisualCities.push(city);
                    }
                });
                setVisualCities(updatedVisualCities);

                // Notify parent component of the changes
                if (onSelectionComplete) {
                    onSelectionComplete(updatedVisualCities);
                }

                enqueueSnackbar(`Zone "${zoneFormData.name}" created with ${detectedCities.length} cities`, { variant: 'success' });

                // Reset the creation flow
                resetZoneCreation();

            } else {
                throw new Error(result.data?.message || 'Failed to save zone - no success response');
            }
        } catch (error) {
            console.error('❌ Error saving zone:', error);
            let errorMessage = 'Failed to save zone';

            if (error.code === 'functions/unauthenticated') {
                errorMessage = 'Authentication session expired. Please refresh the page and try again.';
            } else if (error.code === 'functions/invalid-argument') {
                errorMessage = 'Invalid zone data provided';
            } else if (error.code === 'functions/internal') {
                errorMessage = 'Server error occurred. Please try again or contact support.';
            } else if (error.message) {
                errorMessage = `Failed to save zone: ${error.message}`;
            }

            enqueueSnackbar(errorMessage, { variant: 'error' });
        } finally {
            setSavingZone(false);
        }
    }, [currentPolygon, zoneFormData, polygonConfirmed, detectedCities, carrierId, zoneCategory, generateZoneCode, enqueueSnackbar, resetZoneCreation, visualCities, onSelectionComplete, isAuthenticated, currentUser]);

    // Update existing zone boundary
    const handleUpdateZoneBoundary = useCallback(async (zone, coordinates, overlay) => {
        try {
            const updateData = {
                boundaryId: zone.id,
                boundary: {
                    type: 'polygon',
                    coordinates: coordinates
                },
                updatedAt: new Date().toISOString()
            };

            // Update in database
            const updateZoneBoundaryFn = httpsCallable(functions, 'updateZoneBoundary');
            const result = await updateZoneBoundaryFn(updateData);

            if (result.data.success) {
                // Update local state
                setCustomCarrierZones(prev => prev.map(z =>
                    z.id === zone.id
                        ? { ...z, boundary: updateData.boundary, overlay: overlay }
                        : z
                ));

                // Update overlay reference
                const overlayIndex = customZoneBoundariesRef.current.findIndex(
                    boundary => boundary.zone.id === zone.id
                );
                if (overlayIndex !== -1) {
                    customZoneBoundariesRef.current[overlayIndex] = {
                        overlay: overlay,
                        zone: { ...zone, boundary: updateData.boundary },
                        coordinates: coordinates
                    };
                }

                enqueueSnackbar(`Zone "${zone.name}" updated successfully`, { variant: 'success' });
                setEditingZone(null);
                setZoneDrawingMode(false);
                setDrawingMode('pan');
            }
        } catch (error) {
            console.error('❌ Error updating zone:', error);
            enqueueSnackbar('Failed to update zone', { variant: 'error' });
        }
    }, [enqueueSnackbar]);

    // Detect cities within polygon boundary
    const detectCitiesInPolygon = useCallback(async (polygon) => {
        if (!polygon || !polygon.coordinates || !window.google) return [];

        try {
            console.log('🔍 Detecting cities within polygon...');
            console.log('📊 Polygon coordinates:', polygon.coordinates.length, 'points');

            // Ensure geometry library is loaded
            if (!window.google.maps.geometry || !window.google.maps.geometry.poly) {
                console.error('❌ Google Maps geometry library not loaded');
                return [];
            }

            // Create Google Maps polygon for point-in-polygon testing
            const googlePolygon = new window.google.maps.Polygon({
                paths: polygon.coordinates
            });

            // Get all cities from cached function (this ensures cities are loaded)
            console.log('🏙️ Loading all cities from cache...');
            const allCities = await getAllCitiesWithCoordinatesCached();
            console.log('🏙️ Loaded', allCities.length, 'cities for polygon testing');

            if (allCities.length === 0) {
                console.warn('⚠️ No cities loaded from cache');
                return [];
            }

            const citiesInPolygon = [];
            let citiesChecked = 0;
            let citiesWithCoords = 0;

            // Test each city to see if it's inside the polygon
            allCities.forEach((city, index) => {
                if (city.latitude && city.longitude) {
                    citiesWithCoords++;
                    const cityLatLng = new window.google.maps.LatLng(city.latitude, city.longitude);

                    try {
                        if (window.google.maps.geometry.poly.containsLocation(cityLatLng, googlePolygon)) {
                            citiesInPolygon.push(city);
                            console.log(`✅ City inside polygon: ${city.city}, ${city.provinceState} (${city.latitude}, ${city.longitude})`);
                        }
                        citiesChecked++;
                    } catch (pointError) {
                        console.error(`❌ Error checking city ${city.city}:`, pointError);
                    }
                } else if (index < 5) {
                    console.warn(`⚠️ City ${city.city} missing coordinates:`, { lat: city.latitude, lng: city.longitude });
                }
            });

            console.log('🔍 Polygon detection stats:', {
                totalCities: allCities.length,
                citiesWithCoords,
                citiesChecked,
                citiesFound: citiesInPolygon.length,
                polygonPoints: polygon.coordinates.length
            });

            console.log('✅ Found', citiesInPolygon.length, 'cities within polygon');
            return citiesInPolygon;

        } catch (error) {
            console.error('❌ Error detecting cities in polygon:', error);
            return [];
        }
    }, []); // getAllCitiesWithCoordinatesCached is stable, no need to include in deps

    // Confirm polygon and detect cities - MANUAL TRIGGER ONLY
    const confirmPolygonAndDetectCities = useCallback(async () => {
        console.log('🔍 Manual city detection triggered by user');

        if (!currentPolygon) {
            console.log('❌ No polygon available for city detection');
            return;
        }

        setDetectingCities(true);
        try {
            console.log('🏙️ Starting city detection within polygon...');

            // Detect cities within the polygon
            const cities = await detectCitiesInPolygon(currentPolygon);
            setDetectedCities(cities);
            setPolygonConfirmed(true);

            console.log('✅ City detection complete:', cities.length, 'cities found');
            enqueueSnackbar(`Found ${cities.length} cities within the zone boundary`, { variant: 'success' });

        } catch (error) {
            console.error('❌ Error confirming polygon:', error);
            enqueueSnackbar('Error detecting cities in zone', { variant: 'error' });
        } finally {
            setDetectingCities(false);
        }
    }, [currentPolygon, detectCitiesInPolygon, enqueueSnackbar]);

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

            // Update drawing manager options - green for add, red for delete, zone color for zone drawing
            const updateDrawingOptions = (isDeleteMode, zoneColor = null) => {
                let fillColor, strokeColor;

                if (zoneColor) {
                    // Zone drawing mode - use zone color
                    fillColor = zoneColor.primary;
                    strokeColor = zoneColor.primary;
                } else {
                    // Regular city selection mode
                    fillColor = isDeleteMode ? '#ef4444' : '#10b981'; // Red for delete, green for add
                    strokeColor = isDeleteMode ? '#dc2626' : '#059669'; // Dark red for delete, dark green for add
                }

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

                // Use ref to check current zone creation phase (avoid closure issues)
                const currentZonePhase = zoneCreationPhaseRef.current;

                // Check if we're in zone creation polygon phase
                if (currentZonePhase === 'polygon' && shapeType === 'polygon') {
                    console.log('🎯 [Zone Creation] Polygon completed - calling handleZoneBoundaryComplete');
                    // Handle zone boundary drawing completion
                    handleZoneBoundaryComplete(event.overlay);
                    return;
                }

                // Check if we're editing an existing zone
                if (editingZone && shapeType === 'polygon') {
                    console.log('✏️ [Zone Editing] Polygon completed - calling handleZoneBoundaryComplete');
                    // Handle zone boundary editing
                    handleZoneBoundaryComplete(event.overlay);
                    return;
                }

                // Regular city selection mode - Add real-time distance measurement labels
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

                // Use ref to get current zone creation phase (avoids closure issues)
                const currentZonePhaseForShapeHandler = zoneCreationPhaseRef.current;

                // Only call handleShapeComplete for regular city selection, NOT zone creation
                if (currentZonePhaseForShapeHandler !== 'polygon' && !editingZone) {
                    handleShapeComplete(event.overlay, shapeType);
                }
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

    // Render zone overlays when zones change
    useEffect(() => {
        if (mapLoaded && googleMapRef.current && zonesWithColors.length > 0) {
            setTimeout(() => {
                renderZoneOverlays();
            }, 500); // Small delay to ensure map is fully loaded
        }
    }, [mapLoaded, zonesWithColors, renderZoneOverlays]);

    // Toggle zone visibility
    useEffect(() => {
        if (mapLoaded && googleMapRef.current) {
            if (showZones) {
                renderZoneOverlays();
            } else {
                // Hide all zone overlays
                zoneOverlaysRef.current.forEach(overlay => {
                    overlay.setMap(null);
                });
                zoneOverlaysRef.current = [];
            }
        }
    }, [showZones, mapLoaded, renderZoneOverlays]);

    // Update drawing options when zone drawing mode changes
    useEffect(() => {
        if (drawingManagerRef.current && drawingManagerRef.current.updateDrawingOptions) {
            if (zoneDrawingMode && selectedZoneForDrawing) {
                drawingManagerRef.current.updateDrawingOptions(false, selectedZoneForDrawing.color);
            } else {
                drawingManagerRef.current.updateDrawingOptions(deleteMode);
            }
        }
    }, [zoneDrawingMode, selectedZoneForDrawing, deleteMode]);

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
            <Box
                ref={mapRef}
                sx={{
                    width: '100%',
                    height: '100%',
                    bgcolor: '#e0e0e0',
                    cursor: zoneCreationPhase === 'polygon' ? 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23000000\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'m12 19 7-7 3 3-7 7-3-3z\'></path><path d=\'m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z\'></path><path d=\'m2 2 7.586 7.586\'></path><circle cx=\'11\' cy=\'11\' r=\'2\'></circle></svg>") 12 12, crosshair' : 'default'
                }}
            />

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

                {/* Zone Visibility Toggle */}
                {zonesWithColors.length > 0 && (
                    <Tooltip title={showZones ? "Hide Zone Boundaries" : "Show Zone Boundaries"} placement="right">
                        <Fab
                            size="small"
                            color={showZones ? 'primary' : 'default'}
                            onClick={() => setShowZones(!showZones)}
                            sx={{
                                width: 40,
                                height: 40,
                                backgroundColor: showZones ? '#3b82f6' : undefined
                            }}
                        >
                            <ZonesIcon fontSize="small" />
                        </Fab>
                    </Tooltip>
                )}

                <Box sx={{ width: '100%', height: 1, bgcolor: '#e5e7eb', my: 1 }} />

                {/* Create New Custom Zone */}
                <Tooltip title={zoneCreationPhase ? "Zone Creation in Progress" : "Create New Custom Zone"} placement="right">
                    <Fab
                        size="small"
                        color="secondary"
                        onClick={startZoneCreation}
                        sx={{
                            width: 40,
                            height: 40,
                            backgroundColor: zoneCreationPhase ? '#8b5cf6' : undefined,
                            transform: zoneCreationPhase ? 'scale(1.1)' : 'scale(1)',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'scale(1.1)',
                                backgroundColor: zoneCreationPhase ? '#7c3aed' : undefined
                            }
                        }}
                    >
                        <AddIcon fontSize="small" />
                    </Fab>
                </Tooltip>

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

            {/* Zone Legend Panel - Always Show for Carriers */}
            {carrierId && (
                <Card sx={{
                    position: 'absolute',
                    top: 120,
                    right: 16,
                    width: zoneLegendOpen ? 320 : 48,
                    maxHeight: '80vh',
                    zIndex: 1000,
                    transition: 'width 0.3s ease-in-out',
                    overflow: 'hidden'
                }}>
                    <CardHeader
                        title={
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                {zoneLegendOpen && (
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                        Zone Management
                                    </Typography>
                                )}
                                <IconButton
                                    size="small"
                                    onClick={() => setZoneLegendOpen(!zoneLegendOpen)}
                                >
                                    {zoneLegendOpen ? <ChevronRightIcon /> : <ZonesIcon />}
                                </IconButton>
                            </Box>
                        }
                        sx={{
                            py: 1,
                            px: 2,
                            '& .MuiCardHeader-title': {
                                fontSize: '14px'
                            }
                        }}
                    />

                    {zoneLegendOpen && (
                        <CardContent sx={{ p: 0, maxHeight: 'calc(80vh - 80px)', overflow: 'auto' }}>
                            {/* Zone Creation Section - Expanded by Default */}
                            <Accordion
                                expanded={expandedSections.zoneCreation}
                                onChange={() => handleAccordionToggle('zoneCreation')}
                                sx={{
                                    boxShadow: 'none',
                                    '&:before': { display: 'none' },
                                    borderBottom: '1px solid #e5e7eb'
                                }}
                            >
                                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: '16px' }} />}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                        🆕 Create Custom Zone
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ p: 2 }}>
                                    {/* Phase Indicator */}
                                    {zoneCreationPhase && (
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            mb: 2,
                                            gap: 1
                                        }}>
                                            <Chip
                                                label="1. Form"
                                                size="small"
                                                color={zoneCreationPhase === 'form' ? 'secondary' : 'default'}
                                                variant={zoneCreationPhase === 'form' ? 'filled' : 'outlined'}
                                                sx={{ fontSize: '9px' }}
                                            />
                                            <Chip
                                                label="2. Polygon"
                                                size="small"
                                                color={zoneCreationPhase === 'polygon' ? 'secondary' : 'default'}
                                                variant={zoneCreationPhase === 'polygon' ? 'filled' : 'outlined'}
                                                sx={{ fontSize: '9px' }}
                                            />
                                            <Chip
                                                label="3. Confirm"
                                                size="small"
                                                color={zoneCreationPhase === 'confirmation' ? 'secondary' : 'default'}
                                                variant={zoneCreationPhase === 'confirmation' ? 'filled' : 'outlined'}
                                                sx={{ fontSize: '9px' }}
                                            />
                                        </Box>
                                    )}

                                    {/* Start Creation Button */}
                                    {!zoneCreationPhase && (
                                        <Button
                                            variant="contained"
                                            color="secondary"
                                            size="small"
                                            startIcon={<AddIcon />}
                                            onClick={startZoneCreation}
                                            fullWidth
                                            sx={{ fontSize: '11px' }}
                                        >
                                            Create New Zone
                                        </Button>
                                    )}

                                    {/* Phase 2: Polygon Drawing */}
                                    {zoneCreationPhase === 'polygon' && (
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography sx={{
                                                fontSize: '10px',
                                                color: '#8b5cf6',
                                                fontWeight: 500,
                                                mb: 2
                                            }}>
                                                🗺️ Draw the zone boundary on the map
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                size="small"
                                                onClick={resetZoneCreation}
                                                fullWidth
                                                sx={{ fontSize: '10px' }}
                                            >
                                                Cancel
                                            </Button>
                                        </Box>
                                    )}

                                    {/* Phase 3: Shape Confirmation */}
                                    {zoneCreationPhase === 'confirmation' && (
                                        <Box>
                                            {!polygonConfirmed ? (
                                                // Step 1: Confirm Shape
                                                <>
                                                    <Typography sx={{
                                                        fontSize: '11px',
                                                        color: '#374151',
                                                        fontWeight: 500,
                                                        mb: 1,
                                                        textAlign: 'center'
                                                    }}>
                                                        🎯 Review & Confirm Zone Shape
                                                    </Typography>

                                                    {currentPolygon && (
                                                        <Box sx={{
                                                            p: 1.5,
                                                            backgroundColor: '#fef3c7',
                                                            borderRadius: 1,
                                                            border: '1px solid #f59e0b',
                                                            mb: 2
                                                        }}>
                                                            <Typography sx={{ fontSize: '10px', fontWeight: 500, color: '#92400e' }}>
                                                                📍 Polygon: {currentPolygon.coordinates.length} coordinate points
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '9px', color: '#92400e', mt: 0.5 }}>
                                                                ⚠️ Review the shape before detecting cities
                                                            </Typography>
                                                        </Box>
                                                    )}

                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                        <Button
                                                            variant="contained"
                                                            color="secondary"
                                                            size="small"
                                                            onClick={confirmPolygonAndDetectCities}
                                                            disabled={detectingCities}
                                                            fullWidth
                                                            sx={{ fontSize: '11px' }}
                                                            startIcon={detectingCities ? <CircularProgress size={14} /> : null}
                                                        >
                                                            {detectingCities ? 'Detecting Cities...' : '✅ Confirm Shape & Detect Cities'}
                                                        </Button>
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            onClick={() => {
                                                                setZoneCreationPhase('polygon');
                                                                setZoneDrawingMode(true);
                                                                setDrawingMode('polygon');
                                                                // Remove current polygon to redraw
                                                                if (currentPolygon?.overlay) {
                                                                    currentPolygon.overlay.setMap(null);
                                                                    setCurrentPolygon(null);
                                                                }
                                                            }}
                                                            fullWidth
                                                            sx={{ fontSize: '11px' }}
                                                        >
                                                            ✏️ Edit Shape
                                                        </Button>
                                                    </Box>
                                                </>
                                            ) : (
                                                // Step 2: Save Zone with Cities
                                                <>
                                                    <Typography sx={{
                                                        fontSize: '11px',
                                                        color: '#374151',
                                                        fontWeight: 500,
                                                        mb: 1,
                                                        textAlign: 'center'
                                                    }}>
                                                        ✅ Cities Detected - Ready to Save
                                                    </Typography>

                                                    {currentPolygon && (
                                                        <Box sx={{
                                                            p: 1.5,
                                                            backgroundColor: '#f0fdf4',
                                                            borderRadius: 1,
                                                            border: '1px solid #10b981',
                                                            mb: 2
                                                        }}>
                                                            <Typography sx={{ fontSize: '10px', fontWeight: 500, color: '#047857' }}>
                                                                📍 Polygon: {currentPolygon.coordinates.length} points
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '10px', color: '#047857', mt: 0.5 }}>
                                                                🏙️ Cities: {detectedCities.length} detected within boundary
                                                            </Typography>
                                                        </Box>
                                                    )}

                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                        <Button
                                                            variant="contained"
                                                            color="primary"
                                                            size="small"
                                                            onClick={handleSaveNewZone}
                                                            disabled={savingZone}
                                                            fullWidth
                                                            sx={{ fontSize: '11px' }}
                                                            startIcon={savingZone ? <CircularProgress size={14} /> : null}
                                                        >
                                                            {savingZone ? 'Saving Zone...' : `💾 Save Zone (${detectedCities.length} cities)`}
                                                        </Button>
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            onClick={() => {
                                                                // Go back to shape confirmation
                                                                setPolygonConfirmed(false);
                                                                setDetectedCities([]);
                                                            }}
                                                            fullWidth
                                                            sx={{ fontSize: '11px' }}
                                                        >
                                                            ↩️ Back to Shape Review
                                                        </Button>
                                                        <Button
                                                            variant="outlined"
                                                            color="error"
                                                            size="small"
                                                            onClick={resetZoneCreation}
                                                            fullWidth
                                                            sx={{ fontSize: '10px' }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </Box>
                                                </>
                                            )}
                                        </Box>
                                    )}
                                </AccordionDetails>
                            </Accordion>

                            {/* Zone Layer Controls Section */}
                            <Accordion
                                expanded={expandedSections.zoneLayers}
                                onChange={() => handleAccordionToggle('zoneLayers')}
                                sx={{
                                    boxShadow: 'none',
                                    '&:before': { display: 'none' },
                                    borderBottom: '1px solid #e5e7eb'
                                }}
                            >
                                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: '16px' }} />}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                        🎛️ Zone Layers
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ p: 2 }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={showSystemZones}
                                                onChange={(e) => setShowSystemZones(e.target.checked)}
                                                size="small"
                                            />
                                        }
                                        label={
                                            <Typography sx={{ fontSize: '11px' }}>
                                                System Zones ({zonesWithColors.filter(z => z.type.includes('system')).length})
                                            </Typography>
                                        }
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={showCustomZones}
                                                onChange={(e) => setShowCustomZones(e.target.checked)}
                                                size="small"
                                            />
                                        }
                                        label={
                                            <Typography sx={{ fontSize: '11px' }}>
                                                Custom Zones ({customCarrierZones.length})
                                            </Typography>
                                        }
                                    />
                                </AccordionDetails>
                            </Accordion>

                            {/* System Zones Section */}
                            {showSystemZones && zonesWithColors.filter(z => z.type.includes('system')).length > 0 && (
                                <Accordion
                                    expanded={expandedSections.systemZones}
                                    onChange={() => handleAccordionToggle('systemZones')}
                                    sx={{
                                        boxShadow: 'none',
                                        '&:before': { display: 'none' },
                                        borderBottom: '1px solid #e5e7eb'
                                    }}
                                >
                                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: '16px' }} />}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                            📋 System Zones ({zonesWithColors.filter(z => z.type.includes('system')).length})
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ p: 2 }}>
                                        {zonesWithColors.filter(z => z.type.includes('system')).map((zone) => (
                                            <Box key={zone.id} sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                p: 1,
                                                mb: 0.5,
                                                border: '1px solid #e5e7eb',
                                                borderRadius: 1,
                                                backgroundColor: zone.color.secondary
                                            }}>
                                                <Box sx={{
                                                    width: 12,
                                                    height: 12,
                                                    backgroundColor: zone.color.primary,
                                                    borderRadius: '50%',
                                                    mr: 1
                                                }} />
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography sx={{ fontSize: '10px', fontWeight: 500 }}>
                                                        {zone.zoneName || zone.name}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '9px', color: '#6b7280' }}>
                                                        {zone.cities.length} cities
                                                    </Typography>
                                                </Box>
                                                <Chip
                                                    label="System"
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{
                                                        fontSize: '8px',
                                                        height: 16,
                                                        borderColor: zone.color.primary,
                                                        color: zone.color.primary
                                                    }}
                                                />
                                            </Box>
                                        ))}
                                    </AccordionDetails>
                                </Accordion>
                            )}

                            {/* Custom Zones Section */}
                            {showCustomZones && (
                                <Accordion
                                    expanded={expandedSections.customZones}
                                    onChange={() => handleAccordionToggle('customZones')}
                                    sx={{
                                        boxShadow: 'none',
                                        '&:before': { display: 'none' }
                                    }}
                                >
                                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: '16px' }} />}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                            ✏️ Custom Carrier Zones ({customCarrierZones.length})
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ p: 2 }}>
                                        {customCarrierZones.length === 0 ? (
                                            <Typography sx={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic' }}>
                                                No custom zones created yet
                                            </Typography>
                                        ) : (
                                            customCarrierZones.map((zone) => (
                                                <Box key={zone.id} sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    p: 1,
                                                    mb: 0.5,
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: 1,
                                                    backgroundColor: '#f8fafc'
                                                }}>
                                                    <Box sx={{
                                                        width: 12,
                                                        height: 12,
                                                        backgroundColor: zone.color?.primary || '#6b7280',
                                                        borderRadius: '50%',
                                                        mr: 1
                                                    }} />
                                                    <Box sx={{ flex: 1 }}>
                                                        <Typography sx={{ fontSize: '10px', fontWeight: 500 }}>
                                                            {zone.name}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '9px', color: '#6b7280' }}>
                                                            Custom boundary
                                                        </Typography>
                                                    </Box>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            // Start editing zone boundary
                                                            setEditingZone(zone);
                                                            setZoneDrawingMode(true);
                                                            setDrawingMode('polygon');

                                                            // Remove current overlay to redraw
                                                            const overlayIndex = customZoneBoundariesRef.current.findIndex(
                                                                boundary => boundary.zone.id === zone.id
                                                            );
                                                            if (overlayIndex !== -1) {
                                                                const boundary = customZoneBoundariesRef.current[overlayIndex];
                                                                boundary.overlay.setMap(null);
                                                                customZoneBoundariesRef.current.splice(overlayIndex, 1);
                                                            }
                                                        }}
                                                        sx={{ p: 0.5 }}
                                                    >
                                                        <EditIcon sx={{ fontSize: '12px' }} />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        onClick={async () => {
                                                            try {
                                                                // Delete zone boundary from database
                                                                const deleteZoneBoundaryFn = httpsCallable(functions, 'deleteZoneBoundary');
                                                                const result = await deleteZoneBoundaryFn({
                                                                    boundaryId: zone.id,
                                                                    carrierId: carrierId
                                                                });

                                                                if (result.data.success) {
                                                                    // Remove from custom zones list
                                                                    setCustomCarrierZones(prev => prev.filter(z => z.id !== zone.id));

                                                                    // Remove overlay from map
                                                                    const overlayIndex = customZoneBoundariesRef.current.findIndex(
                                                                        boundary => boundary.zone.id === zone.id
                                                                    );
                                                                    if (overlayIndex !== -1) {
                                                                        const boundary = customZoneBoundariesRef.current[overlayIndex];
                                                                        boundary.overlay.setMap(null);
                                                                        customZoneBoundariesRef.current.splice(overlayIndex, 1);
                                                                    }

                                                                    enqueueSnackbar(`Zone "${zone.name}" deleted successfully`, { variant: 'success' });
                                                                }
                                                            } catch (error) {
                                                                console.error('❌ Error deleting zone:', error);
                                                                enqueueSnackbar('Failed to delete zone', { variant: 'error' });
                                                            }
                                                        }}
                                                        sx={{ p: 0.5, color: '#ef4444' }}
                                                    >
                                                        <DeleteIcon sx={{ fontSize: '12px' }} />
                                                    </IconButton>
                                                </Box>
                                            ))
                                        )}
                                    </AccordionDetails>
                                </Accordion>
                            )}
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Phase 1: Zone Form Sliding Panel */}
            {zoneCreationPhase === 'form' && (
                <Card sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 400,
                    height: '100%',
                    zIndex: 1200,
                    backgroundColor: 'white',
                    borderLeft: '1px solid #e5e7eb',
                    boxShadow: '-4px 0 20px rgba(0,0,0,0.1)'
                }}>
                    <CardHeader
                        title={
                            <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                📝 Phase 1: Zone Information
                            </Typography>
                        }
                        action={
                            <IconButton onClick={resetZoneCreation} size="small">
                                <ChevronRightIcon />
                            </IconButton>
                        }
                        sx={{ borderBottom: '1px solid #e5e7eb' }}
                    />

                    <CardContent sx={{ p: 3, height: 'calc(100% - 140px)', overflow: 'auto' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {/* Zone Name */}
                            <TextField
                                label="Zone Name"
                                value={zoneFormData.name}
                                onChange={(e) => handleZoneNameChange(e.target.value)}
                                placeholder="e.g., Downtown Toronto"
                                required
                                fullWidth
                                size="small"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                                helperText="Enter a descriptive name for this zone"
                            />

                            {/* Zone Code */}
                            <TextField
                                label="Zone Code"
                                value={zoneFormData.code}
                                onChange={(e) => handleZoneFormChange('code', e.target.value.toUpperCase())}
                                placeholder="Auto-generated from zone name"
                                fullWidth
                                size="small"
                                InputProps={{
                                    sx: { fontSize: '12px' },
                                    readOnly: true, // Auto-generated, read-only like existing process
                                    endAdornment: generatingCode && (
                                        <CircularProgress size={16} />
                                    )
                                }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                helperText="Auto-generated from zone name"
                                required
                            />

                            {/* Description */}
                            <TextField
                                label="Description"
                                value={zoneFormData.description}
                                onChange={(e) => handleZoneFormChange('description', e.target.value)}
                                placeholder="Optional description of the zone"
                                fullWidth
                                size="small"
                                multiline
                                rows={2}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                }}
                                helperText="Optional description for this zone"
                            />
                        </Box>
                    </CardContent>

                    <Box sx={{
                        p: 3,
                        borderTop: '1px solid #e5e7eb',
                        display: 'flex',
                        gap: 2,
                        justifyContent: 'flex-end'
                    }}>
                        <Button
                            onClick={resetZoneCreation}
                            size="small"
                            sx={{
                                fontSize: '12px',
                                textTransform: 'none'
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={proceedToPolygonDrawing}
                            variant="contained"
                            color="secondary"
                            size="small"
                            disabled={!zoneFormData.name.trim()}
                            sx={{
                                fontSize: '12px',
                                textTransform: 'none'
                            }}
                        >
                            Continue to Draw Boundary →
                        </Button>
                    </Box>
                </Card>
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