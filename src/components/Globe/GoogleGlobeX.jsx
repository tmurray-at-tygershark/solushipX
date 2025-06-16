import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Paper, IconButton, Tooltip, CircularProgress } from '@mui/material';
import {
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    MyLocation as MyLocationIcon,
    Layers as LayersIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
    Satellite as SatelliteIcon,
    Map as MapIcon
} from '@mui/icons-material';

// Google Maps configuration
const GOOGLE_MAPS_CONFIG = {
    defaultCenter: { lat: 43.6532, lng: -79.3832 }, // Toronto
    defaultZoom: 10,
    minZoom: 2,
    maxZoom: 20,
    mapTypeControlOptions: {
        style: window.google?.maps?.MapTypeControlStyle?.HORIZONTAL_BAR,
        position: window.google?.maps?.ControlPosition?.TOP_CENTER,
    },
    zoomControlOptions: {
        position: window.google?.maps?.ControlPosition?.RIGHT_CENTER,
    },
    streetViewControlOptions: {
        position: window.google?.maps?.ControlPosition?.RIGHT_CENTER,
    },
    fullscreenControlOptions: {
        position: window.google?.maps?.ControlPosition?.TOP_RIGHT,
    }
};

// Map styles for different themes
const MAP_STYLES = {
    standard: [],
    satellite: [],
    hybrid: [],
    terrain: [],
    dark: [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        {
            featureType: "administrative.locality",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
        },
        {
            featureType: "poi",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
        },
        {
            featureType: "poi.park",
            elementType: "geometry",
            stylers: [{ color: "#263c3f" }],
        },
        {
            featureType: "poi.park",
            elementType: "labels.text.fill",
            stylers: [{ color: "#6b9a76" }],
        },
        {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#38414e" }],
        },
        {
            featureType: "road",
            elementType: "geometry.stroke",
            stylers: [{ color: "#212a37" }],
        },
        {
            featureType: "road",
            elementType: "labels.text.fill",
            stylers: [{ color: "#9ca5b3" }],
        },
        {
            featureType: "road.highway",
            elementType: "geometry",
            stylers: [{ color: "#746855" }],
        },
        {
            featureType: "road.highway",
            elementType: "geometry.stroke",
            stylers: [{ color: "#1f2835" }],
        },
        {
            featureType: "road.highway",
            elementType: "labels.text.fill",
            stylers: [{ color: "#f3d19c" }],
        },
        {
            featureType: "transit",
            elementType: "geometry",
            stylers: [{ color: "#2f3948" }],
        },
        {
            featureType: "transit.station",
            elementType: "labels.text.fill",
            stylers: [{ color: "#d59563" }],
        },
        {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#17263c" }],
        },
        {
            featureType: "water",
            elementType: "labels.text.fill",
            stylers: [{ color: "#515c6d" }],
        },
        {
            featureType: "water",
            elementType: "labels.text.stroke",
            stylers: [{ color: "#17263c" }],
        },
    ]
};

const GoogleGlobeX = ({
    width = '100%',
    height = '600px',
    initialCenter = { lat: 43.6532, lng: -79.3832 }, // Toronto as default
    initialZoom = 10,
    onMapReady = null,
    className = '',
    apiKey = null // Optional API key override
}) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
    const [currentMapType, setCurrentMapType] = useState('roadmap');
    const [currentStyle, setCurrentStyle] = useState('standard');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mapCenter, setMapCenter] = useState(initialCenter);
    const [zoomLevel, setZoomLevel] = useState(initialZoom);
    const [error, setError] = useState(null);

    // Check if Google Maps is already loaded
    const checkGoogleMapsLoaded = useCallback(() => {
        return window.google && window.google.maps && window.google.maps.Map;
    }, []);

    // Load Google Maps API if not already loaded - match ShipmentDetailX pattern exactly
    const loadGoogleMapsAPI = useCallback(async () => {
        try {
            setError(null);

            // Check if Google Maps is already loaded globally (from other components)
            if (window.google && window.google.maps) {
                console.log('🗺️ Google Maps already loaded globally');
                setIsGoogleMapsLoaded(true);
                return true;
            }

            // Fetch API key from Firestore only if maps not already loaded
            const { collection, getDocs } = await import('firebase/firestore');
            const { db } = await import('../../firebase/firebase');

            const keysRef = collection(db, 'keys');
            const keysSnapshot = await getDocs(keysRef);

            if (!keysSnapshot.empty) {
                const firstDoc = keysSnapshot.docs[0];
                const key = firstDoc.data().googleAPI;
                if (!key) {
                    throw new Error('No googleAPI key found in Firestore keys collection');
                }

                console.log('🗝️ Using Google Maps API key:', key.substring(0, 10) + '...');

                // Load the script with the API key
                await loadGoogleMapsScript(key);
                setIsGoogleMapsLoaded(true);
                return true;
            } else {
                throw new Error('Keys collection not found in Firestore');
            }
        } catch (error) {
            console.error('Failed to load Google Maps API:', error);
            setError('Failed to load Google Maps. Please check your API key configuration.');
            return false;
        }
    }, []);

    // Load Google Maps script
    const loadGoogleMapsScript = (apiKey) => {
        return new Promise((resolve, reject) => {
            if (checkGoogleMapsLoaded()) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places&loading=async`;
            script.async = true;
            script.defer = true;

            script.onload = () => {
                if (checkGoogleMapsLoaded()) {
                    resolve();
                } else {
                    reject(new Error('Google Maps API failed to load properly'));
                }
            };

            script.onerror = () => {
                reject(new Error('Failed to load Google Maps script'));
            };

            document.head.appendChild(script);
        });
    };

    // Initialize Google Maps - match ShipmentDetailX pattern exactly
    useEffect(() => {
        const initializeMaps = async () => {
            try {
                setError(null);

                // Check if Google Maps is already loaded globally (from other components like Globe)
                if (window.google && window.google.maps) {
                    console.log('🗺️ Google Maps already loaded globally');
                    setIsGoogleMapsLoaded(true);
                    return;
                }

                // Only try to load if not already available - fetch API key from Firestore
                const { collection, getDocs } = await import('firebase/firestore');
                const { db } = await import('../../firebase/firebase');

                const keysRef = collection(db, 'keys');
                const keysSnapshot = await getDocs(keysRef);

                if (!keysSnapshot.empty) {
                    const firstDoc = keysSnapshot.docs[0];
                    const key = firstDoc.data().googleAPI;
                    if (!key) {
                        throw new Error('No googleAPI key found in Firestore keys collection');
                    }

                    console.log('🗝️ Loading Google Maps with API key:', key.substring(0, 10) + '...');

                    // Load the script with the API key
                    await loadGoogleMapsScript(key);
                    setIsGoogleMapsLoaded(true);
                } else {
                    throw new Error('Keys collection not found in Firestore');
                }
            } catch (error) {
                console.error('Error initializing Maps:', error);
                setError('Failed to load Google Maps. Please try refreshing the page.');
                setIsGoogleMapsLoaded(false);
            }
        };

        initializeMaps();
    }, []);

    // Initialize Google Map
    const initializeMap = useCallback(async () => {
        if (!mapContainerRef.current || !isGoogleMapsLoaded) return;

        try {
            setIsLoading(true);
            setError(null);

            // Wait a bit to ensure DOM is fully ready
            await new Promise(resolve => setTimeout(resolve, 100));

            // Double-check that the container is still available and has dimensions
            if (!mapContainerRef.current ||
                mapContainerRef.current.offsetWidth === 0 ||
                mapContainerRef.current.offsetHeight === 0) {
                throw new Error('Map container is not ready or has no dimensions');
            }

            // Ensure Google Maps API is fully loaded
            if (!window.google || !window.google.maps || !window.google.maps.Map) {
                throw new Error('Google Maps API is not fully loaded');
            }

            console.log('🗺️ Initializing map with container:', {
                width: mapContainerRef.current.offsetWidth,
                height: mapContainerRef.current.offsetHeight,
                center: mapCenter,
                zoom: zoomLevel
            });

            // Create map instance - avoid custom styles with vector maps
            const mapOptions = {
                center: mapCenter,
                zoom: zoomLevel,
                minZoom: GOOGLE_MAPS_CONFIG.minZoom,
                maxZoom: GOOGLE_MAPS_CONFIG.maxZoom,
                mapTypeId: currentMapType,
                // Remove custom styles to avoid vector map conflicts
                // styles: MAP_STYLES[currentStyle],

                // UI Controls
                zoomControl: false, // We'll use custom controls
                mapTypeControl: false,
                scaleControl: true,
                streetViewControl: false,
                rotateControl: false,
                fullscreenControl: false,

                // Interaction options
                gestureHandling: 'greedy',
                clickableIcons: true,
                disableDoubleClickZoom: false,
                scrollwheel: true,

                // Performance options
                optimized: true,
                // Remove vector rendering to avoid DOM errors
                // renderingType: window.google.maps.RenderingType?.VECTOR
            };

            const map = new window.google.maps.Map(mapContainerRef.current, mapOptions);
            mapRef.current = map;

            // Wait for map to be fully initialized with timeout
            await Promise.race([
                new Promise((resolve) => {
                    const listener = map.addListener('idle', () => {
                        window.google.maps.event.removeListener(listener);
                        resolve();
                    });
                }),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Map initialization timeout')), 10000);
                })
            ]);

            // Set up event listeners
            setupMapEventListeners(map);

            // Map is ready
            setIsLoading(false);

            if (onMapReady) {
                onMapReady(map);
            }

            console.log('✅ GoogleGlobeX map initialized successfully');

        } catch (error) {
            console.error('❌ Error initializing GoogleGlobeX map:', error);
            setError(`Failed to initialize map: ${error.message}`);
            setIsLoading(false);
        }
    }, [mapContainerRef, isGoogleMapsLoaded, mapCenter, zoomLevel, currentMapType, currentStyle, onMapReady]);

    // Set up map event listeners
    const setupMapEventListeners = (map) => {
        // Center changed
        map.addListener('center_changed', () => {
            const center = map.getCenter();
            if (center) {
                setMapCenter({
                    lat: center.lat(),
                    lng: center.lng()
                });
            }
        });

        // Zoom changed
        map.addListener('zoom_changed', () => {
            const zoom = map.getZoom();
            if (zoom !== undefined) {
                setZoomLevel(zoom);
            }
        });

        // Map type changed
        map.addListener('maptypeid_changed', () => {
            const mapTypeId = map.getMapTypeId();
            if (mapTypeId) {
                setCurrentMapType(mapTypeId);
            }
        });

        // Idle event (map finished loading/moving)
        map.addListener('idle', () => {
            // Map is ready for interaction
        });

        // Error handling
        map.addListener('tilesloaded', () => {
            // Tiles loaded successfully
        });
    };

    // Handle zoom in
    const handleZoomIn = useCallback(() => {
        if (mapRef.current) {
            const currentZoom = mapRef.current.getZoom();
            const newZoom = Math.min(currentZoom + 1, GOOGLE_MAPS_CONFIG.maxZoom);
            mapRef.current.setZoom(newZoom);
        }
    }, []);

    // Handle zoom out
    const handleZoomOut = useCallback(() => {
        if (mapRef.current) {
            const currentZoom = mapRef.current.getZoom();
            const newZoom = Math.max(currentZoom - 1, GOOGLE_MAPS_CONFIG.minZoom);
            mapRef.current.setZoom(newZoom);
        }
    }, []);

    // Handle center on user location
    const handleCenterLocation = useCallback(() => {
        if (navigator.geolocation) {
            setIsLoading(true);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const newCenter = { lat: latitude, lng: longitude };

                    if (mapRef.current) {
                        mapRef.current.setCenter(newCenter);
                        mapRef.current.setZoom(15);
                    }
                    setIsLoading(false);
                },
                (error) => {
                    console.warn('Geolocation error:', error);
                    setError('Unable to get your location. Please check your browser permissions.');
                    setIsLoading(false);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes
                }
            );
        } else {
            setError('Geolocation is not supported by this browser.');
        }
    }, []);

    // Handle map type/style change
    const handleMapTypeChange = useCallback(() => {
        if (!mapRef.current) return;

        const mapTypes = ['roadmap', 'satellite', 'hybrid', 'terrain'];
        const currentIndex = mapTypes.indexOf(currentMapType);
        const nextIndex = (currentIndex + 1) % mapTypes.length;
        const nextMapType = mapTypes[nextIndex];

        mapRef.current.setMapTypeId(nextMapType);
        setCurrentMapType(nextMapType);

        // Apply custom styles for roadmap
        if (nextMapType === 'roadmap') {
            const styles = ['standard', 'dark'];
            const styleIndex = styles.indexOf(currentStyle);
            const nextStyleIndex = (styleIndex + 1) % styles.length;
            const nextStyle = styles[nextStyleIndex];

            mapRef.current.setOptions({ styles: MAP_STYLES[nextStyle] });
            setCurrentStyle(nextStyle);
        } else {
            mapRef.current.setOptions({ styles: [] });
            setCurrentStyle('standard');
        }
    }, [currentMapType, currentStyle]);

    // Handle fullscreen toggle
    const handleFullscreenToggle = useCallback(() => {
        setIsFullscreen(!isFullscreen);

        // Trigger map resize after fullscreen change
        setTimeout(() => {
            if (mapRef.current) {
                window.google.maps.event.trigger(mapRef.current, 'resize');
            }
        }, 100);
    }, [isFullscreen]);

    // Get map type display name
    const getMapTypeDisplayName = () => {
        const names = {
            roadmap: currentStyle === 'dark' ? 'Dark' : 'Standard',
            satellite: 'Satellite',
            hybrid: 'Hybrid',
            terrain: 'Terrain'
        };
        return names[currentMapType] || 'Standard';
    };

    // Handle container resize
    useEffect(() => {
        const handleResize = () => {
            if (mapRef.current) {
                window.google.maps.event.trigger(mapRef.current, 'resize');
            }
        };

        const resizeObserver = new ResizeObserver(handleResize);
        if (mapContainerRef.current) {
            resizeObserver.observe(mapContainerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    // Cleanup
    useEffect(() => {
        return () => {
            // Clear markers
            markersRef.current.forEach(marker => {
                if (marker.setMap) {
                    marker.setMap(null);
                }
            });
            markersRef.current = [];

            // Clear map
            if (mapRef.current) {
                mapRef.current = null;
            }
        };
    }, []);

    return (
        <Box
            className={className}
            sx={{
                position: isFullscreen ? 'fixed' : 'relative',
                top: isFullscreen ? 0 : 'auto',
                left: isFullscreen ? 0 : 'auto',
                width: isFullscreen ? '100vw' : width,
                height: isFullscreen ? '100vh' : height,
                zIndex: isFullscreen ? 9999 : 'auto',
                backgroundColor: '#f0f0f0'
            }}
        >
            <Paper
                elevation={2}
                sx={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: isFullscreen ? 0 : 1
                }}
            >
                {/* Map Container */}
                <Box
                    ref={mapContainerRef}
                    sx={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        backgroundColor: '#f0f0f0'
                    }}
                />

                {/* Loading Overlay */}
                {(isLoading || !isGoogleMapsLoaded) && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            zIndex: 1000
                        }}
                    >
                        <Box sx={{ textAlign: 'center' }}>
                            <CircularProgress size={40} />
                            <Box sx={{ mt: 2, fontSize: '14px', color: '#666' }}>
                                {!isGoogleMapsLoaded ? 'Loading Google Maps...' : 'Initializing map...'}
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* Error Overlay */}
                {error && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            zIndex: 1000
                        }}
                    >
                        <Box sx={{ textAlign: 'center', maxWidth: '300px', p: 3 }}>
                            <Box sx={{ fontSize: '16px', color: '#d32f2f', mb: 2 }}>
                                Map Error
                            </Box>
                            <Box sx={{ fontSize: '14px', color: '#666', mb: 2 }}>
                                {error}
                            </Box>
                            <IconButton
                                onClick={() => {
                                    setError(null);
                                    loadGoogleMapsAPI();
                                }}
                                sx={{
                                    backgroundColor: '#1976d2',
                                    color: 'white',
                                    '&:hover': { backgroundColor: '#1565c0' }
                                }}
                            >
                                Retry
                            </IconButton>
                        </Box>
                    </Box>
                )}

                {/* Map Controls */}
                {!error && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            zIndex: 1000
                        }}
                    >
                        <Tooltip title="Zoom In">
                            <IconButton
                                onClick={handleZoomIn}
                                disabled={zoomLevel >= GOOGLE_MAPS_CONFIG.maxZoom}
                                sx={{
                                    backgroundColor: 'white',
                                    boxShadow: 1,
                                    '&:hover': { backgroundColor: '#f5f5f5' },
                                    '&:disabled': { backgroundColor: '#f0f0f0', color: '#ccc' }
                                }}
                            >
                                <ZoomInIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Zoom Out">
                            <IconButton
                                onClick={handleZoomOut}
                                disabled={zoomLevel <= GOOGLE_MAPS_CONFIG.minZoom}
                                sx={{
                                    backgroundColor: 'white',
                                    boxShadow: 1,
                                    '&:hover': { backgroundColor: '#f5f5f5' },
                                    '&:disabled': { backgroundColor: '#f0f0f0', color: '#ccc' }
                                }}
                            >
                                <ZoomOutIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="My Location">
                            <IconButton
                                onClick={handleCenterLocation}
                                sx={{
                                    backgroundColor: 'white',
                                    boxShadow: 1,
                                    '&:hover': { backgroundColor: '#f5f5f5' }
                                }}
                            >
                                <MyLocationIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={`Switch to ${getMapTypeDisplayName()}`}>
                            <IconButton
                                onClick={handleMapTypeChange}
                                sx={{
                                    backgroundColor: 'white',
                                    boxShadow: 1,
                                    '&:hover': { backgroundColor: '#f5f5f5' }
                                }}
                            >
                                {currentMapType === 'satellite' || currentMapType === 'hybrid' ?
                                    <SatelliteIcon /> : <MapIcon />
                                }
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                            <IconButton
                                onClick={handleFullscreenToggle}
                                sx={{
                                    backgroundColor: 'white',
                                    boxShadow: 1,
                                    '&:hover': { backgroundColor: '#f5f5f5' }
                                }}
                            >
                                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}

                {/* Map Info */}
                {!error && !isLoading && (
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: 16,
                            left: 16,
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            padding: '8px 12px',
                            borderRadius: 1,
                            fontSize: '12px',
                            color: '#666',
                            zIndex: 1000
                        }}
                    >
                        <Box>
                            <strong>{getMapTypeDisplayName()}</strong> |
                            Zoom: {zoomLevel} |
                            Center: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
                        </Box>
                        <Box sx={{ mt: 0.5, fontSize: '10px' }}>
                            Powered by Google Maps
                        </Box>
                    </Box>
                )}
            </Paper>
        </Box>
    );
};

export default GoogleGlobeX; 