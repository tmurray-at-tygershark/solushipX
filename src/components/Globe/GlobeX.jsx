import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Paper, IconButton, Tooltip, CircularProgress } from '@mui/material';
import {
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    MyLocation as MyLocationIcon,
    Layers as LayersIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon
} from '@mui/icons-material';

// OpenStreetMap tile servers
const TILE_SERVERS = {
    standard: {
        name: 'Standard',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    },
    humanitarian: {
        name: 'Humanitarian',
        url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors, Tiles courtesy of Humanitarian OpenStreetMap Team',
        maxZoom: 17
    }
};

const GlobeX = ({
    width = '100%',
    height = '600px',
    initialCenter = [43.6532, -79.3832], // Toronto as default
    initialZoom = 10,
    onMapReady = null,
    className = ''
}) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const renderTimeoutRef = useRef(null);
    const tileLoadQueueRef = useRef([]);
    const loadingTilesRef = useRef(new Set());

    const [isLoading, setIsLoading] = useState(true);
    const [currentTileServer, setCurrentTileServer] = useState('standard');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mapCenter, setMapCenter] = useState(initialCenter);
    const [zoomLevel, setZoomLevel] = useState(initialZoom);

    // Debounced tile rendering for better performance
    const debouncedRenderTiles = useCallback((map) => {
        if (renderTimeoutRef.current) {
            clearTimeout(renderTimeoutRef.current);
        }

        renderTimeoutRef.current = setTimeout(() => {
            renderTiles(map);
        }, 100); // 100ms debounce
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const initializeMap = async () => {
            try {
                setIsLoading(true);

                // Create map instance
                const map = createMap();
                mapRef.current = map;

                // Add tile layer
                addTileLayer(map, currentTileServer);

                // Add map controls
                addMapControls(map);

                // Set up event listeners
                setupEventListeners(map);

                // Map is ready
                setIsLoading(false);
                if (onMapReady) {
                    onMapReady(map);
                }

                console.log('✅ GlobeX map initialized successfully');

            } catch (error) {
                console.error('❌ Error initializing GlobeX map:', error);
                setIsLoading(false);
            }
        };

        initializeMap();

        // Cleanup
        return () => {
            if (renderTimeoutRef.current) {
                clearTimeout(renderTimeoutRef.current);
            }
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Create map instance with optimized tile management
    const createMap = () => {
        const mapContainer = document.createElement('div');
        mapContainer.style.width = '100%';
        mapContainer.style.height = '100%';
        mapContainer.style.position = 'relative';
        mapContainer.style.overflow = 'hidden';
        mapContainer.style.backgroundColor = '#f0f0f0';

        mapContainerRef.current.appendChild(mapContainer);

        // Create optimized map with better tile management
        const map = {
            container: mapContainer,
            center: mapCenter,
            zoom: zoomLevel,
            targetZoom: zoomLevel, // For smooth zoom transitions
            tiles: new Map(),
            tileCache: new Map(), // Enhanced caching
            tileSize: 256,
            maxZoom: TILE_SERVERS[currentTileServer].maxZoom,
            maxCacheSize: 500, // Increased cache size
            isZooming: false,

            // Optimized map methods
            setCenter: (center) => {
                map.center = center;
                setMapCenter(center);
                debouncedRenderTiles(map);
            },

            setZoom: (zoom) => {
                const newZoom = Math.max(1, Math.min(zoom, map.maxZoom));
                map.targetZoom = newZoom;

                // Smooth zoom transition
                if (Math.abs(newZoom - map.zoom) > 0.1) {
                    map.isZooming = true;
                    smoothZoomTo(map, newZoom);
                } else {
                    map.zoom = newZoom;
                    setZoomLevel(newZoom);
                    debouncedRenderTiles(map);
                }
            },

            getZoom: () => map.zoom,
            getCenter: () => map.center,

            remove: () => {
                if (map.container && map.container.parentNode) {
                    map.container.parentNode.removeChild(map.container);
                }
                map.tiles.clear();
                map.tileCache.clear();
                loadingTilesRef.current.clear();
                tileLoadQueueRef.current = [];
            }
        };

        return map;
    };

    // Smooth zoom transition
    const smoothZoomTo = (map, targetZoom) => {
        const startZoom = map.zoom;
        const zoomDiff = targetZoom - startZoom;
        const duration = 300; // 300ms transition
        const startTime = Date.now();

        const animateZoom = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function for smooth animation
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            map.zoom = startZoom + (zoomDiff * easeProgress);
            setZoomLevel(map.zoom);

            if (progress < 1) {
                requestAnimationFrame(animateZoom);
            } else {
                map.zoom = targetZoom;
                map.isZooming = false;
                setZoomLevel(targetZoom);
                renderTiles(map);
            }
        };

        requestAnimationFrame(animateZoom);
    };

    // Add tile layer to map
    const addTileLayer = (map, serverKey) => {
        const server = TILE_SERVERS[serverKey];
        map.tileServer = server;
        map.maxZoom = server.maxZoom;
        renderTiles(map);
    };

    // Optimized tile rendering with caching and queue management
    const renderTiles = (map) => {
        if (!map.container || map.isZooming) return;

        const zoom = Math.floor(map.zoom);
        const tileSize = map.tileSize;
        const containerWidth = map.container.clientWidth;
        const containerHeight = map.container.clientHeight;

        // Calculate tile bounds with smaller buffer for better performance
        const bounds = getTileBounds(map.center, zoom, containerWidth, containerHeight, tileSize);

        // Get currently needed tiles
        const neededTiles = new Set();
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            for (let y = bounds.minY; y <= bounds.maxY; y++) {
                neededTiles.add(`${x}-${y}-${zoom}`);
            }
        }

        // Remove tiles that are no longer needed
        const currentTiles = Array.from(map.tiles.keys());
        currentTiles.forEach(tileKey => {
            if (!neededTiles.has(tileKey)) {
                const tile = map.tiles.get(tileKey);
                if (tile && tile.parentNode) {
                    tile.parentNode.removeChild(tile);
                }
                map.tiles.delete(tileKey);
            }
        });

        // Load new tiles with priority queue
        const tilesToLoad = [];
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            for (let y = bounds.minY; y <= bounds.maxY; y++) {
                const tileKey = `${x}-${y}-${zoom}`;
                if (!map.tiles.has(tileKey) && !loadingTilesRef.current.has(tileKey)) {
                    // Calculate distance from center for priority
                    const centerX = Math.floor((bounds.minX + bounds.maxX) / 2);
                    const centerY = Math.floor((bounds.minY + bounds.maxY) / 2);
                    const distance = Math.abs(x - centerX) + Math.abs(y - centerY);

                    tilesToLoad.push({ x, y, zoom, distance, tileKey });
                }
            }
        }

        // Sort by distance (closest tiles first)
        tilesToLoad.sort((a, b) => a.distance - b.distance);

        // Load tiles in batches to prevent overwhelming the browser
        const batchSize = 6;
        tilesToLoad.slice(0, batchSize).forEach(tile => {
            loadTileOptimized(map, tile.x, tile.y, tile.zoom);
        });

        // Clean up cache if it gets too large
        if (map.tileCache.size > map.maxCacheSize) {
            const cacheKeys = Array.from(map.tileCache.keys());
            const keysToRemove = cacheKeys.slice(0, map.maxCacheSize * 0.2); // Remove 20%
            keysToRemove.forEach(key => map.tileCache.delete(key));
        }
    };

    // Calculate tile bounds with optimized buffer
    const getTileBounds = (center, zoom, width, height, tileSize) => {
        const [lat, lng] = center;

        // Convert lat/lng to tile coordinates
        const centerTileX = lngToTileX(lng, zoom);
        const centerTileY = latToTileY(lat, zoom);

        // Calculate how many tiles we need (smaller buffer for better performance)
        const tilesX = Math.ceil(width / tileSize) + 1; // Reduced buffer
        const tilesY = Math.ceil(height / tileSize) + 1;

        return {
            minX: Math.floor(centerTileX - tilesX / 2),
            maxX: Math.floor(centerTileX + tilesX / 2),
            minY: Math.floor(centerTileY - tilesY / 2),
            maxY: Math.floor(centerTileY + tilesY / 2)
        };
    };

    // Convert longitude to tile X coordinate
    const lngToTileX = (lng, zoom) => {
        return Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    };

    // Convert latitude to tile Y coordinate
    const latToTileY = (lat, zoom) => {
        const latRad = lat * Math.PI / 180;
        return Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
    };

    // Optimized tile loading with caching and error handling
    const loadTileOptimized = (map, x, y, z) => {
        const tileKey = `${x}-${y}-${z}`;

        if (map.tiles.has(tileKey) || loadingTilesRef.current.has(tileKey)) {
            return; // Tile already loaded or loading
        }

        loadingTilesRef.current.add(tileKey);

        // Check cache first
        if (map.tileCache.has(tileKey)) {
            const cachedTile = map.tileCache.get(tileKey).cloneNode();
            positionTile(map, cachedTile, x, y, z);
            map.tiles.set(tileKey, cachedTile);
            map.container.appendChild(cachedTile);
            loadingTilesRef.current.delete(tileKey);
            return;
        }

        // Create new tile element
        const tileImg = document.createElement('img');
        tileImg.style.position = 'absolute';
        tileImg.style.width = `${map.tileSize}px`;
        tileImg.style.height = `${map.tileSize}px`;
        tileImg.style.userSelect = 'none';
        tileImg.style.pointerEvents = 'none';
        tileImg.style.opacity = '0';
        tileImg.style.transition = 'opacity 0.2s ease-in-out';

        // Position tile
        positionTile(map, tileImg, x, y, z);

        // Set tile URL
        const server = map.tileServer;
        const subdomains = ['a', 'b', 'c'];
        const subdomain = subdomains[Math.abs(x + y) % subdomains.length];

        let tileUrl = server.url
            .replace('{s}', subdomain)
            .replace('{x}', x.toString())
            .replace('{y}', y.toString())
            .replace('{z}', z.toString());

        tileImg.onload = () => {
            tileImg.style.opacity = '1';
            map.tileCache.set(tileKey, tileImg.cloneNode());
            loadingTilesRef.current.delete(tileKey);
        };

        tileImg.onerror = () => {
            tileImg.style.opacity = '0.3';
            tileImg.style.backgroundColor = '#f0f0f0';
            loadingTilesRef.current.delete(tileKey);
        };

        tileImg.src = tileUrl;

        // Add to container and tiles map
        map.container.appendChild(tileImg);
        map.tiles.set(tileKey, tileImg);
    };

    // Position tile in container
    const positionTile = (map, tileImg, x, y, z) => {
        const centerTileX = lngToTileX(map.center[1], z);
        const centerTileY = latToTileY(map.center[0], z);

        const offsetX = (x - centerTileX) * map.tileSize + map.container.clientWidth / 2 - map.tileSize / 2;
        const offsetY = (y - centerTileY) * map.tileSize + map.container.clientHeight / 2 - map.tileSize / 2;

        tileImg.style.left = `${offsetX}px`;
        tileImg.style.top = `${offsetY}px`;
    };

    // Optimized map controls with throttling
    const addMapControls = (map) => {
        let lastWheelTime = 0;

        // Throttled mouse wheel zoom
        map.container.addEventListener('wheel', (e) => {
            e.preventDefault();

            const now = Date.now();
            if (now - lastWheelTime < 50) return; // Throttle to 20fps
            lastWheelTime = now;

            const delta = e.deltaY > 0 ? -0.5 : 0.5;
            map.setZoom(map.targetZoom + delta);
        });

        // Optimized mouse drag pan
        let isDragging = false;
        let lastMousePos = { x: 0, y: 0 };
        let lastPanTime = 0;

        map.container.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastMousePos = { x: e.clientX, y: e.clientY };
            map.container.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const now = Date.now();
            if (now - lastPanTime < 16) return; // Throttle to 60fps
            lastPanTime = now;

            const deltaX = e.clientX - lastMousePos.x;
            const deltaY = e.clientY - lastMousePos.y;

            // Convert pixel movement to lat/lng movement
            const zoom = map.zoom;
            const scale = Math.pow(2, zoom);
            const lngDelta = -deltaX / scale * 360 / map.tileSize;
            const latDelta = deltaY / scale * 180 / map.tileSize;

            const newCenter = [
                Math.max(-85, Math.min(85, map.center[0] + latDelta)),
                ((map.center[1] + lngDelta + 180) % 360) - 180
            ];

            map.setCenter(newCenter);
            lastMousePos = { x: e.clientX, y: e.clientY };
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            map.container.style.cursor = 'grab';
        });

        map.container.style.cursor = 'grab';
    };

    // Set up event listeners
    const setupEventListeners = (map) => {
        // Handle container resize with debouncing
        let resizeTimeout;
        const resizeObserver = new ResizeObserver(() => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (map.container) {
                    debouncedRenderTiles(map);
                }
            }, 150);
        });

        if (mapContainerRef.current) {
            resizeObserver.observe(mapContainerRef.current);
        }

        // Store cleanup function
        map.cleanup = () => {
            resizeObserver.disconnect();
            if (resizeTimeout) clearTimeout(resizeTimeout);
        };
    };

    // Handle zoom in with smooth animation
    const handleZoomIn = () => {
        if (mapRef.current) {
            mapRef.current.setZoom(mapRef.current.targetZoom + 1);
        }
    };

    // Handle zoom out with smooth animation
    const handleZoomOut = () => {
        if (mapRef.current) {
            mapRef.current.setZoom(mapRef.current.targetZoom - 1);
        }
    };

    // Handle center on location
    const handleCenterLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    if (mapRef.current) {
                        mapRef.current.setCenter([latitude, longitude]);
                        mapRef.current.setZoom(15);
                    }
                },
                (error) => {
                    console.warn('Geolocation error:', error);
                }
            );
        }
    };

    // Handle tile server change
    const handleTileServerChange = () => {
        const servers = Object.keys(TILE_SERVERS);
        const currentIndex = servers.indexOf(currentTileServer);
        const nextIndex = (currentIndex + 1) % servers.length;
        const nextServer = servers[nextIndex];

        setCurrentTileServer(nextServer);

        if (mapRef.current) {
            // Clear existing tiles when changing servers
            mapRef.current.tiles.clear();
            mapRef.current.tileCache.clear();
            mapRef.current.container.innerHTML = '';
            addTileLayer(mapRef.current, nextServer);
        }
    };

    // Handle fullscreen toggle
    const handleFullscreenToggle = () => {
        setIsFullscreen(!isFullscreen);
    };

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
                {isLoading && (
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
                                Loading OpenStreetMap...
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* Map Controls */}
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
                            sx={{
                                backgroundColor: 'white',
                                boxShadow: 1,
                                '&:hover': { backgroundColor: '#f5f5f5' }
                            }}
                        >
                            <ZoomInIcon />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Zoom Out">
                        <IconButton
                            onClick={handleZoomOut}
                            sx={{
                                backgroundColor: 'white',
                                boxShadow: 1,
                                '&:hover': { backgroundColor: '#f5f5f5' }
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

                    <Tooltip title="Switch Map Style">
                        <IconButton
                            onClick={handleTileServerChange}
                            sx={{
                                backgroundColor: 'white',
                                boxShadow: 1,
                                '&:hover': { backgroundColor: '#f5f5f5' }
                            }}
                        >
                            <LayersIcon />
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

                {/* Map Info */}
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
                        <strong>{TILE_SERVERS[currentTileServer].name}</strong> |
                        Zoom: {zoomLevel.toFixed(1)} |
                        Center: {mapCenter[0].toFixed(4)}, {mapCenter[1].toFixed(4)}
                    </Box>
                    <Box sx={{ mt: 0.5, fontSize: '10px' }}>
                        {TILE_SERVERS[currentTileServer].attribution}
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default GlobeX; 