// New Franky-style Globe implementation

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {
    Box,
    Typography,
    TextField,
    IconButton,
    Card,
    CardContent,
    Chip,
    Button,
    Slide,
    Fade,
    InputAdornment
} from '@mui/material';
import {
    Search as SearchIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
    PlayArrow as PlayIcon,
    Pause as PauseIcon
} from '@mui/icons-material';
import { collection, query, orderBy, limit, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { listenToShipmentEvents } from '../../utils/shipmentEvents';
import { loadGoogleMaps } from '../../utils/googleMapsLoader';
import StatusChip from '../StatusChip/StatusChip';
import './Globe.css';



const geocodingCache = new Map();

const extractLocationFromAddress = (address) => {
    if (!address) return null;

    // Convert address object to string if needed
    const addressString = typeof address === 'string' ? address : addressToString(address);
    if (!addressString) return null;

    const parts = addressString.split(',').map(part => part.trim());
    if (parts.length >= 2) {
        const city = parts[0].trim();
        const stateProvince = parts[1].trim();
        const country = parts.length >= 3 ? parts[2].trim() : 'North America';
        return { city, stateProvince, country, fullLocation: `${city}, ${stateProvince}, ${country}` };
    }
    return { city: parts[0]?.trim(), stateProvince: '', country: 'North America', fullLocation: `${parts[0]?.trim()}, North America` };
};

// Enhanced address formatter for detailed labels with Street, City, State/Prov
const formatDetailedAddress = (address) => {
    if (!address) return null;

    // Convert address object to string if needed
    const addressString = typeof address === 'string' ? address : addressToString(address);
    if (!addressString) return null;

    // Split address into components and clean them
    const parts = addressString.split(',').map(part => part.trim());

    if (parts.length === 0) return null;

    let street = '';
    let city = '';
    let stateProvince = '';

    if (parts.length >= 3) {
        // Format: "Street, City, State/Province, Country..."
        street = parts[0];
        city = parts[1];
        stateProvince = parts[2];
    } else if (parts.length === 2) {
        // Format: "City, State/Province" or "Street, City"
        // Check if first part contains numbers (likely street address)
        if (/\d/.test(parts[0])) {
            street = parts[0];
            city = parts[1];
        } else {
            city = parts[0];
            stateProvince = parts[1];
        }
    } else {
        // Single component - treat as city
        city = parts[0];
    }

    // Clean up components and create tight format
    const cleanedComponents = [];

    if (street && street.length > 0) {
        // Abbreviate common street types for space efficiency
        street = street
            .replace(/\bStreet\b/gi, 'St')
            .replace(/\bAvenue\b/gi, 'Ave')
            .replace(/\bBoulevard\b/gi, 'Blvd')
            .replace(/\bDrive\b/gi, 'Dr')
            .replace(/\bRoad\b/gi, 'Rd')
            .replace(/\bLane\b/gi, 'Ln')
            .replace(/\bCircle\b/gi, 'Cir');
        cleanedComponents.push(street);
    }

    if (city && city.length > 0) {
        cleanedComponents.push(city);
    }

    if (stateProvince && stateProvince.length > 0) {
        // Abbreviate common state/province names
        stateProvince = stateProvince
            .replace(/\bCalifornia\b/gi, 'CA')
            .replace(/\bNew York\b/gi, 'NY')
            .replace(/\bTexas\b/gi, 'TX')
            .replace(/\bFlorida\b/gi, 'FL')
            .replace(/\bOntario\b/gi, 'ON')
            .replace(/\bQuebec\b/gi, 'QC')
            .replace(/\bBritish Columbia\b/gi, 'BC')
            .replace(/\bAlberta\b/gi, 'AB');
        cleanedComponents.push(stateProvince);
    }

    // Join with tight formatting
    const formatted = cleanedComponents.join(', ');

    return {
        street,
        city,
        stateProvince,
        formatted,
        components: cleanedComponents
    };
};

// Helper function to convert address object to string for geocoding
const addressToString = (address) => {
    if (!address) return '';
    if (typeof address === 'string') return address;

    // Handle address object with multiple possible field names
    const parts = [];

    // Primary street address
    if (address.street1 || address.streetAddress || address.address1 || address.address) {
        parts.push(address.street1 || address.streetAddress || address.address1 || address.address);
    }

    // Secondary address (apartment, suite, unit, etc.)
    if (address.street2 || address.address2 || address.suite || address.unit || address.apartment) {
        parts.push(address.street2 || address.address2 || address.suite || address.unit || address.apartment);
    }

    // City
    if (address.city) parts.push(address.city);

    // State/Province  
    if (address.state || address.province || address.stateProvince) {
        parts.push(address.state || address.province || address.stateProvince);
    }

    // Postal code
    if (address.postalCode || address.zipCode || address.zip || address.postcode) {
        parts.push(address.postalCode || address.zipCode || address.zip || address.postcode);
    }

    // Country
    if (address.country || address.countryCode) {
        parts.push(address.country || address.countryCode);
    }

    const result = parts.filter(Boolean).join(', ');
    console.log('🔄 Address conversion:', { input: address, output: result });
    return result;
};

const getCityCoordinates = async (address) => {
    // Convert address to string format for geocoding
    const addressString = addressToString(address);

    console.log('🗺️ Geocoding request:', { originalAddress: address, convertedString: addressString });

    if (!addressString) {
        console.warn('⚠️ Empty address string, using fallback coordinates');
        return { lat: 45.0, lng: -100.0 };
    }

    // Check cache first
    if (geocodingCache.has(addressString)) {
        return geocodingCache.get(addressString);
    }

    // Try Google Maps geocoding first (if available)
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
        try {
            // Validate that addressString is actually a string and not empty
            if (typeof addressString !== 'string' || addressString.trim().length === 0) {
                throw new Error('Invalid address string provided to geocoding');
            }

            const geocoder = new window.google.maps.Geocoder();
            const result = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: addressString.trim() }, (results, status) => {
                    if (status === 'OK' && results && results.length > 0) {
                        const location = results[0].geometry.location;
                        resolve({
                            lat: location.lat(),
                            lng: location.lng()
                        });
                    } else {
                        reject(new Error(`Geocoding failed: ${status}`));
                    }
                });
            });

            console.log(`✅ Geocoded "${addressString}":`, result);
            geocodingCache.set(addressString, result);
            return result;
        } catch (error) {
            console.warn(`❌ Google geocoding failed for "${addressString}":`, error.message);
        }
    }

    // If Google Maps geocoding fails, use fallback coordinates

    // Final fallback
    const fallbackCoords = { lat: 45.0, lng: -100.0 };
    console.warn(`⚠️ Using fallback coordinates for "${addressString}"`);
    geocodingCache.set(addressString, fallbackCoords);
    return fallbackCoords;
};

const latLngToVector3 = (lat, lng, radius = 10) => {
    // Comprehensive coordinate debugging
    console.log(`\n🌍 === COORDINATE CONVERSION DEBUG ===`);
    console.log(`📍 INPUT: lat=${lat}°, lng=${lng}°`);

    // Coordinate conversion with longitude inversion for horizontally flipped Earth texture
    const phi = (90 - lat) * Math.PI / 180;  // colatitude
    const theta = (-lng) * Math.PI / 180;       // longitude INVERTED - Earth texture is horizontally flipped

    console.log(`🔄 CONVERSION: phi=${(phi * 180 / Math.PI).toFixed(1)}° (colatitude), theta=${(theta * 180 / Math.PI).toFixed(1)}° (longitude)`);

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    console.log(`📊 OUTPUT: x=${x.toFixed(3)}, y=${y.toFixed(3)}, z=${z.toFixed(3)}`);
    console.log(`📐 SPHERICAL: r=${radius}, φ=${(phi * 180 / Math.PI).toFixed(1)}°, θ=${(theta * 180 / Math.PI).toFixed(1)}°`);

    // Add reference information
    if (lat === 0 && lng === 0) {
        console.log(`🎯 THIS IS EQUATOR/PRIME MERIDIAN - Should be off west coast of Africa`);
    } else if (Math.abs(lat - 51.5) < 0.1 && Math.abs(lng - (-0.1)) < 0.1) {
        console.log(`🇬🇧 THIS IS LONDON - Should be over UK/England`);
    } else if (Math.abs(lat - 40.7) < 0.1 && Math.abs(lng - (-74.0)) < 0.1) {
        console.log(`🇺🇸 THIS IS NEW YORK - Should be over eastern USA`);
    }

    console.log(`🌍 === END DEBUG ===\n`);

    return new THREE.Vector3(x, y, z);
};

// Franky's exact parameters
const params = {
    sunIntensity: 1.8,
    speedFactor: 2.0,
    metalness: 0.1,
    atmOpacity: 0.7,
    atmPowFactor: 4.1,
    atmMultiplier: 9.5,
};

// Earth textures - ultra high resolution for crisp zoom
const EARTH_TEXTURES = {
    day: '/textures/8k_earth_daymap.jpg', // Solar System Scope 8K ultra-high resolution Earth texture
    normal: '/textures/planets/earth_normal_2048.jpg', // Normal map for terrain relief  
    bump: '/textures/planets/earth_atmos_2048.jpg', // Bump map for realistic surface details
    clouds: '/textures/planets/earth_clouds_1024.png',
    ocean: '/textures/planets/earth_specular_2048.jpg'
};

// Night lights are now integrated into the main Earth texture - no separate creation needed

const getStatusColor = (status) => {
    const statusColors = {
        'draft': '#95a5a6', 'booked': '#3498db', 'scheduled': '#f39c12',
        'in_transit': '#e74c3c', 'delivered': '#27ae60', 'cancelled': '#e74c3c',
        'void': '#7f8c8d', 'pending': '#f39c12'
    };
    return statusColors[status?.toLowerCase()] || '#95a5a6';
};

// Franky's exact atmosphere shaders
const atmosphereVertexShader = `
varying vec3 vNormal;
varying vec3 eyeVector;
void main() {
    vec4 mvPos = modelViewMatrix * vec4( position, 1.0 );
    vNormal = normalize( normalMatrix * normal );
    eyeVector = normalize(mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
}`;

const atmosphereFragmentShader = `
varying vec3 vNormal;
varying vec3 eyeVector;
uniform float atmOpacity;
uniform float atmPowFactor;
uniform float atmMultiplier;
void main() {
    float dotP = dot( vNormal, eyeVector );
    float factor = pow(dotP, atmPowFactor) * atmMultiplier;
    vec3 atmColor = vec3(0.35 + dotP/4.5, 0.35 + dotP/4.5, 1.0);
    gl_FragColor = vec4(atmColor, atmOpacity) * factor;
}`;

const ShipmentGlobe = ({ width = 500, height = 600, showOverlays = true, statusCounts = {}, shipments: propShipments = [] }) => {
    const mountRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const sceneRef = useRef(null);
    const [userInteracting, setUserInteracting] = useState(false);

    // Real-time data state
    const [realTimeShipments, setRealTimeShipments] = useState([]);
    const [realtimeStatusCounts, setRealtimeStatusCounts] = useState({});
    const [shipmentEvents, setShipmentEvents] = useState({});
    const { companyIdForAddress, companyLoading } = useCompany();

    // Enhanced UI features state
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [currentShipmentIndex, setCurrentShipmentIndex] = useState(0);
    const [activeShipment, setActiveShipment] = useState(null);
    const [showDrawer, setShowDrawer] = useState(false);
    const [streamMessages, setStreamMessages] = useState([]);
    const [isPaused, setIsPaused] = useState(false);
    const streamRef = useRef(null);

    // Use real-time shipments if available, fallback to prop shipments
    const shipments = realTimeShipments.length > 0 ? realTimeShipments : propShipments;

    // Real-time shipment data listener
    useEffect(() => {
        if (!companyIdForAddress || companyLoading) {
            return;
        }

        console.log('🌍 Globe: Setting up real-time shipment listener for company:', companyIdForAddress);

        // Calculate date range for last 7 days to get more data for the globe
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dateFilter = Timestamp.fromDate(sevenDaysAgo);

        const shipmentsQuery = query(
            collection(db, 'shipments'),
            where('companyID', '==', companyIdForAddress),
            where('createdAt', '>=', dateFilter),
            orderBy('createdAt', 'desc'),
            limit(50) // Limit for performance but get enough for good globe display
        );

        const unsubscribe = onSnapshot(shipmentsQuery, (snapshot) => {
            console.log('🌍 Globe: Received real-time shipments update:', snapshot.docs.length, 'shipments');

            const shipmentsData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    trackingNumber: data.trackingNumber || data.shipmentID || doc.id,
                    ...data,
                    // Ensure address fields are properly mapped
                    origin: data.shipFrom || data.origin,
                    destination: data.shipTo || data.destination,
                };
            }).filter(shipment => {
                // Only include shipments with valid addresses and exclude drafts
                return shipment.status?.toLowerCase() !== 'draft' &&
                    shipment.origin &&
                    shipment.destination;
            });

            // Calculate real-time status counts
            const statusCounts = shipmentsData.reduce((counts, shipment) => {
                const status = shipment.status?.toLowerCase();
                switch (status) {
                    case 'pending':
                    case 'scheduled':
                    case 'awaiting_shipment':
                    case 'awaiting shipment':
                    case 'booked':
                        counts.pending = (counts.pending || 0) + 1;
                        break;
                    case 'in_transit':
                    case 'in transit':
                        counts.transit = (counts.transit || 0) + 1;
                        break;
                    case 'delivered':
                        counts.delivered = (counts.delivered || 0) + 1;
                        break;
                    case 'delayed':
                    case 'exception':
                    case 'on_hold':
                        counts.delayed = (counts.delayed || 0) + 1;
                        break;
                }
                return counts;
            }, {});

            setRealTimeShipments(shipmentsData);
            setRealtimeStatusCounts(statusCounts);
        }, (error) => {
            console.error('🌍 Globe: Error in real-time shipments listener:', error);
        });

        return () => unsubscribe();
    }, [companyIdForAddress, companyLoading]);

    // Real-time shipment events listeners
    useEffect(() => {
        if (shipments.length === 0) return;

        console.log('🌍 Globe: Setting up real-time events listeners for', shipments.length, 'shipments');

        const unsubscribers = [];

        shipments.forEach(shipment => {
            const shipmentId = shipment.shipmentID || shipment.shipmentId || shipment.id;
            if (!shipmentId) return;

            const unsubscribe = listenToShipmentEvents(shipmentId, (events) => {
                setShipmentEvents(prev => ({
                    ...prev,
                    [shipmentId]: events || []
                }));

                // Add latest events to stream
                if (events && events.length > 0) {
                    const latestEvent = events[0]; // Events are sorted newest first
                    if (latestEvent && latestEvent.timestamp) {
                        const eventTime = new Date(latestEvent.timestamp);
                        const now = new Date();
                        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

                        // Only add to stream if it's a recent event (last 5 minutes)
                        if (eventTime > fiveMinutesAgo) {
                            const streamMessage = {
                                id: `live-${latestEvent.eventId || Date.now()}`,
                                type: 'live_event',
                                content: `🔴 LIVE: ${latestEvent.title} • ${shipment.trackingNumber}`,
                                status: shipment.status,
                                timestamp: eventTime.getTime(),
                                visible: true,
                                isLive: true
                            };

                            setStreamMessages(prev => {
                                // Avoid duplicates by checking if we already have this event
                                const exists = prev.some(msg => msg.id === streamMessage.id);
                                if (exists) return prev;

                                // Add new live message at the top, keep only last 20
                                return [streamMessage, ...prev.slice(0, 19)];
                            });
                        }
                    }
                }
            });

            unsubscribers.push(unsubscribe);
        });

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [shipments]);

    useEffect(() => {
        let scene, camera, renderer, controls, earth, clouds, atmosphere, group, animationId;
        let isInitialized = false;

        const initializeGlobe = async () => {
            if (isInitialized) {
                console.log('⚠️ Skipping duplicate initialization');
                return;
            }
            isInitialized = true;

            console.log('🔄 Cleared geocoding cache for fresh coordinates');
            geocodingCache.clear();

            // Load Google Maps API for proper geocoding
            try {
                console.log('📍 Loading Google Maps API for accurate geocoding...');
                await loadGoogleMaps();
                console.log('✅ Google Maps API loaded successfully - real coordinates available!');
            } catch (error) {
                console.warn('⚠️ Google Maps API failed to load, will use fallback coordinates:', error);
            }

            try {
                if (mountRef.current) {
                    mountRef.current.innerHTML = '';
                }

                // Get actual pixel dimensions from container
                const actualWidth = mountRef.current?.offsetWidth || width;
                const actualHeight = mountRef.current?.offsetHeight || height;

                // Debug canvas dimensions and DOM state
                console.log('🎯 Canvas setup:', {
                    originalWidth: width,
                    originalHeight: height,
                    actualWidth,
                    actualHeight,
                    containerWidth: mountRef.current?.offsetWidth,
                    containerHeight: mountRef.current?.offsetHeight,
                    mountElement: !!mountRef.current
                });

                // Enhanced setup for North America focus
                THREE.ColorManagement.enabled = true;
                scene = new THREE.Scene();
                sceneRef.current = scene;
                camera = new THREE.PerspectiveCamera(45, actualWidth / actualHeight, 1, 1000);

                // Position camera to focus on North America with optimal viewing angle
                camera.position.set(-8, 10, 28); // Optimized for North America view
                camera.lookAt(0, 0, 0); // Look at globe center

                renderer = new THREE.WebGLRenderer({
                    antialias: true,
                    alpha: true,
                    preserveDrawingBuffer: true
                });
                renderer.setSize(actualWidth, actualHeight);
                renderer.outputColorSpace = THREE.SRGBColorSpace;
                renderer.setClearColor(0x000000, 1); // Black background for subtle star field
                renderer.sortObjects = true; // Enable proper transparency sorting
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance

                // Store references for fullscreen resizing
                rendererRef.current = renderer;
                cameraRef.current = camera;

                // Debug renderer setup
                console.log('🎮 Renderer setup:', {
                    canvasWidth: renderer.domElement.width,
                    canvasHeight: renderer.domElement.height,
                    pixelRatio: renderer.getPixelRatio()
                });

                // Ensure canvas is visible and properly styled
                renderer.domElement.style.display = 'block';
                renderer.domElement.style.width = '100%';
                renderer.domElement.style.height = '100%';
                mountRef.current.appendChild(renderer.domElement);

                // Enhanced orbit controls with advanced features
                controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.08; // Smoother damping
                controls.minDistance = 10.5; // Minimum zoom - just above surface (radius=10)
                controls.maxDistance = 50; // Reduced maximum zoom level for closer view  
                controls.target.set(0, 0, 0); // Look at globe center
                controls.rotateSpeed = 0.4; // More responsive rotation
                controls.zoomSpeed = 1.2; // Better zoom responsiveness
                controls.panSpeed = 1.0;
                controls.autoRotate = false; // Can be toggled
                controls.autoRotateSpeed = 0.5;

                // Add interaction event listeners to stop auto-rotation when user drags
                controls.addEventListener('start', () => {
                    console.log('🎯 User started interacting with globe - stopping auto-rotation');
                    setUserInteracting(true);
                });

                controls.addEventListener('end', () => {
                    console.log('🎯 User finished interacting with globe - keeping position');
                    // Note: We don't restart auto-rotation - user's position is maintained
                });

                // Add rotation logging for user to find preferred view
                controls.addEventListener('change', () => {
                    if (group) {
                        const rotY = group.rotation.y;
                        const rotX = group.rotation.x;
                        const rotYDegrees = (rotY * 180 / Math.PI).toFixed(1);
                        const rotXDegrees = (rotX * 180 / Math.PI).toFixed(1);
                        console.log('🔄 Current Globe Rotation:', {
                            y: rotY.toFixed(3),
                            x: rotX.toFixed(3),
                            yDegrees: rotYDegrees + '°',
                            xDegrees: rotXDegrees + '°'
                        });
                    }
                });

                // Enable keyboard controls for advanced navigation
                controls.enableKeys = true;
                controls.keys = {
                    LEFT: 'ArrowLeft', // Pan left
                    UP: 'ArrowUp',     // Pan up  
                    RIGHT: 'ArrowRight', // Pan right
                    BOTTOM: 'ArrowDown'  // Pan down
                };
                controls.listenToKeyEvents(window); // Important: listen to window key events

                // Smooth transitions for better UX
                controls.enableZoom = true;
                controls.enableRotate = true;
                controls.enablePan = true;

                // Dramatic lighting setup inspired by Carmenta Globe documentation
                const ambientLight = new THREE.AmbientLight(0x404080, 0.4); // Cooler, lower ambient for drama
                scene.add(ambientLight);

                // Primary directional light - more dramatic and warmer
                const directionalLight = new THREE.DirectionalLight(0xfff4e6, 1.8); // Warm, bright light
                directionalLight.position.set(-10, 8, 12); // Position for North America emphasis
                directionalLight.target.position.set(0, 0, 0);
                directionalLight.castShadow = false; // Disable shadows for performance
                scene.add(directionalLight);
                scene.add(directionalLight.target);

                // Secondary fill light for subtle highlighting
                const fillLight = new THREE.DirectionalLight(0xe6f3ff, 0.6); // Cool fill light
                fillLight.position.set(8, -4, -8); // Opposite side for balance
                fillLight.target.position.set(0, 0, 0);
                scene.add(fillLight);
                scene.add(fillLight.target);

                // Add neutral environment for PBR material to prevent black appearance
                const pmremGenerator = new THREE.PMREMGenerator(renderer);
                const neutralEnv = pmremGenerator.fromScene(new THREE.Scene(), 0.04).texture;
                scene.environment = neutralEnv;
                pmremGenerator.dispose();

                // Create group for globe rotation
                group = new THREE.Group();

                // Set rotation to 0,0 for default Earth position
                // No rotation applied - showing Earth at its natural orientation
                const initialRotationY = 0; // 0° - no Y rotation
                const initialRotationX = 0; // 0° - no X rotation

                console.log('🔄 Globe rotation set to 0,0 (default position):', {
                    y: initialRotationY.toFixed(3),
                    x: initialRotationX.toFixed(3),
                    yDegrees: (initialRotationY * 180 / Math.PI).toFixed(1) + '°',
                    xDegrees: (initialRotationX * 180 / Math.PI).toFixed(1) + '°'
                });

                group.rotation.y = initialRotationY;
                group.rotation.x = initialRotationX;

                // Load textures with error handling
                const textureLoader = new THREE.TextureLoader();
                console.log('🌍 Loading Earth textures...');

                const loadTextureWithFallback = (url, fallbackFn = null) => {
                    return new Promise((resolve) => {
                        textureLoader.load(
                            url,
                            resolve, // success
                            undefined, // progress
                            (error) => { // error
                                console.warn(`Failed to load texture: ${url}`, error);
                                if (fallbackFn) {
                                    console.log('🔄 Using fallback texture');
                                    resolve(fallbackFn());
                                } else {
                                    // Create a basic colored texture as fallback
                                    const canvas = document.createElement('canvas');
                                    canvas.width = canvas.height = 64;
                                    const ctx = canvas.getContext('2d');
                                    ctx.fillStyle = '#444444';
                                    ctx.fillRect(0, 0, 64, 64);
                                    resolve(new THREE.CanvasTexture(canvas));
                                }
                            }
                        );
                    });
                };

                const [dayMap, normalMap, bumpMap, cloudsMap, oceanMap] = await Promise.all([
                    loadTextureWithFallback(EARTH_TEXTURES.day),
                    loadTextureWithFallback(EARTH_TEXTURES.normal),
                    loadTextureWithFallback(EARTH_TEXTURES.bump),
                    loadTextureWithFallback(EARTH_TEXTURES.clouds),
                    loadTextureWithFallback(EARTH_TEXTURES.ocean)
                ]);

                dayMap.colorSpace = THREE.SRGBColorSpace;

                // Debug texture loading
                console.log('✅ All Earth textures loaded successfully');
                console.log('🗻 Normal map dimensions:', normalMap.image?.width, 'x', normalMap.image?.height);
                console.log('🌍 Earth day map dimensions:', dayMap.image?.width, 'x', dayMap.image?.height);
                console.log('🏔️ Bump map dimensions:', bumpMap.image?.width, 'x', bumpMap.image?.height);
                console.log('🌊 Ocean/specular map dimensions:', oceanMap.image?.width, 'x', oceanMap.image?.height);

                // Create prominent programmatic star field
                const createProgrammaticStarField = () => {
                    const starCount = 3000; // More stars for better coverage
                    const starPositions = new Float32Array(starCount * 3);
                    const starSizes = new Float32Array(starCount);
                    const starColors = new Float32Array(starCount * 3);

                    for (let i = 0; i < starCount; i++) {
                        // Random positions on a large sphere
                        const radius = 400 + Math.random() * 100; // Variable distance for depth
                        const theta = Math.random() * Math.PI * 2;
                        const phi = Math.acos(2 * Math.random() - 1);

                        const x = radius * Math.sin(phi) * Math.cos(theta);
                        const y = radius * Math.sin(phi) * Math.sin(theta);
                        const z = radius * Math.cos(phi);

                        starPositions[i * 3] = x;
                        starPositions[i * 3 + 1] = y;
                        starPositions[i * 3 + 2] = z;

                        // More prominent star sizes with better distribution
                        const sizeRandom = Math.random();
                        if (sizeRandom < 0.05) {
                            // 5% very bright stars
                            starSizes[i] = 4 + Math.random() * 3;
                        } else if (sizeRandom < 0.2) {
                            // 15% bright stars
                            starSizes[i] = 2 + Math.random() * 2;
                        } else {
                            // 80% normal stars
                            starSizes[i] = 0.8 + Math.random() * 1.2;
                        }

                        // Brighter, more prominent star colors
                        const colorVariation = Math.random();
                        if (colorVariation < 0.6) {
                            // Most stars are bright white
                            starColors[i * 3] = 0.95 + Math.random() * 0.05;    // R
                            starColors[i * 3 + 1] = 0.95 + Math.random() * 0.05; // G
                            starColors[i * 3 + 2] = 1.0;                         // B
                        } else if (colorVariation < 0.8) {
                            // Some are bright blue
                            starColors[i * 3] = 0.8 + Math.random() * 0.2;     // R
                            starColors[i * 3 + 1] = 0.9 + Math.random() * 0.1; // G
                            starColors[i * 3 + 2] = 1.0;                        // B
                        } else {
                            // Some are bright yellow/orange
                            starColors[i * 3] = 1.0;                           // R
                            starColors[i * 3 + 1] = 0.9 + Math.random() * 0.1; // G
                            starColors[i * 3 + 2] = 0.7 + Math.random() * 0.2; // B
                        }
                    }

                    const starGeometry = new THREE.BufferGeometry();
                    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
                    starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
                    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

                    const starMaterial = new THREE.PointsMaterial({
                        size: 2, // Larger base size
                        sizeAttenuation: true,
                        vertexColors: true,
                        transparent: true,
                        opacity: 1.0, // Full opacity for prominence
                        blending: THREE.AdditiveBlending
                    });

                    const stars = new THREE.Points(starGeometry, starMaterial);
                    return stars;
                };

                const starField = createProgrammaticStarField();
                scene.add(starField); // Add directly to scene, not rotating group
                console.log('✨ Prominent programmatic star field added to scene');

                // Create realistic Earth with bump mapping and proper materials
                const earthGeo = new THREE.SphereGeometry(10, 64, 64);
                earthGeo.computeBoundingSphere();

                // Enhanced Earth material with dramatic lighting and toned-down specular
                const earthMat = new THREE.MeshStandardMaterial({
                    map: dayMap,
                    normalMap: normalMap,
                    bumpMap: bumpMap,
                    bumpScale: 0.2, // Enhanced surface detail for dramatic effect
                    roughnessMap: oceanMap, // Use ocean map for realistic water/land roughness variation
                    roughness: 0.85, // Higher roughness to reduce specular highlights
                    metalness: 0.02, // Much lower metalness for subtle specular
                    envMapIntensity: 0.3, // Reduced environment reflection intensity
                    // Enhanced for dramatic lighting response
                    emissive: new THREE.Color(0x000000), // No emission
                    emissiveIntensity: 0.0
                });

                earth = new THREE.Mesh(earthGeo, earthMat);
                // ✅ Removed arbitrary rotation - coordinates now align properly with texture
                earth.renderOrder = 0; // Render first (solid base)
                group.add(earth);

                // Create clouds - Simple translucent setup
                const cloudGeo = new THREE.SphereGeometry(10.1, 32, 32); // Slightly higher
                cloudGeo.computeBoundingSphere();
                const cloudsMat = new THREE.MeshLambertMaterial({
                    map: cloudsMap,
                    transparent: true,
                    opacity: 0.3, // Light transparency
                    depthWrite: false,
                    color: 0xffffff
                });
                clouds = new THREE.Mesh(cloudGeo, cloudsMat);
                // ✅ Removed arbitrary rotation - clouds now align with Earth texture
                clouds.renderOrder = 1; // Render after Earth
                group.add(clouds);

                // Create atmosphere - Franky's exact setup
                const atmosGeo = new THREE.SphereGeometry(12.5, 64, 64);
                atmosGeo.computeBoundingSphere();
                const atmosMat = new THREE.ShaderMaterial({
                    vertexShader: atmosphereVertexShader,
                    fragmentShader: atmosphereFragmentShader,
                    uniforms: {
                        atmOpacity: { value: params.atmOpacity },
                        atmPowFactor: { value: params.atmPowFactor },
                        atmMultiplier: { value: params.atmMultiplier }
                    },
                    blending: THREE.AdditiveBlending,
                    side: THREE.BackSide
                });
                atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
                atmosphere.renderOrder = 2; // Render last (outermost transparent layer)
                group.add(atmosphere);

                scene.add(group);



                // Remove the redundant marker since we have one in testCities

                // Add shipment routes if any exist
                if (shipments && shipments.length > 0) {
                    console.log('🚚 Adding shipment routes to globe...');
                    await addShipmentRoutes(scene, shipments);
                }

                // Click debugging removed - coordinate mapping is now correct

                console.log('✅ Globe initialized with carrier logos, reduced zoom, dramatic lighting');
                console.log('🔍 Scene objects count:', scene.children.length);
                console.log('🌍 Earth object:', earth ? 'Created' : 'Missing');
                console.log('☁️ Clouds object:', clouds ? 'Created' : 'Missing');
                console.log('🌌 Atmosphere object:', atmosphere ? 'Created' : 'Missing');
                setLoading(false);

                // Test immediate render before animation
                renderer.render(scene, camera);
                console.log('🎬 Test render completed');

                // Animation loop - with dynamic shipment animations
                let frameCount = 0;
                const animate = () => {
                    animationId = requestAnimationFrame(animate);
                    if (controls) controls.update();

                    const interval = 0.016;
                    const time = performance.now() * 0.001; // Time in seconds

                    // Only rotate if user is not interacting (maintains user's chosen position)
                    if (!userInteracting) {
                        // Rotate entire group (Earth, clouds, and all arcs together)
                        group.rotateY(interval * 0.005 * params.speedFactor);

                        // Additional cloud rotation for dynamic effect
                        clouds.rotateY(interval * 0.005 * params.speedFactor);
                    }

                    // Realistic Earth with proper bump mapping - no separate night lights needed

                    // Sequential shooting star animation with trail movement
                    if (scene.userData.animatedArcs) {
                        const currentTime = time * 1000; // Convert to milliseconds

                        scene.userData.animatedArcs.forEach(arc => {
                            if (arc.userData.isMarker) {
                                // Markers follow parent arc's visibility exactly
                                const parentArc = arc.userData.parentArc;
                                if (parentArc && parentArc.userData) {
                                    arc.material.opacity = parentArc.visible ? arc.userData.originalOpacity : 0;
                                    arc.visible = parentArc.visible;
                                }
                            } else if (arc.userData.isAnimatedArc) {
                                if (arc.userData.isShootingArc) {
                                    // Handle shooting arc animation with trail movement
                                    const animDuration = arc.userData.animationDuration || 4000;
                                    const holdDuration = arc.userData.holdDuration || 1500;
                                    const timeSinceStart = currentTime - arc.userData.animationStartTime;

                                    // Check if animation should start - include hold duration
                                    if (timeSinceStart >= 0 && timeSinceStart <= (animDuration + holdDuration)) {
                                        arc.visible = true;
                                        const progress = Math.min(timeSinceStart / animDuration, 1.0);

                                        // Sync badge with currently animating arc - EXACT timing with arc start
                                        if (timeSinceStart >= 0 && timeSinceStart < 100 && !arc.userData.badgeSynced) { // First 100ms to ensure sync
                                            arc.userData.badgeSynced = true;

                                            // Use stored shipment data from arc userData
                                            const shipmentForArc = arc.userData.shipmentData;
                                            if (shipmentForArc) {
                                                // Update active shipment and show badge at EXACT same time as arc
                                                setActiveShipment(shipmentForArc);
                                                setShowDrawer(true);
                                                console.log(`🎯 Badge synced with arc animation for shipment: ${shipmentForArc.trackingNumber || shipmentForArc.id}`);
                                            }
                                        }

                                        // Handle animation phases: active animation vs hold phase
                                        if (timeSinceStart <= animDuration) {
                                            // Active animation phase with trail movement
                                            arc.userData.progress = progress;

                                            // Calculate trail positions with movement
                                            const trailLength = arc.userData.trailLength;
                                            const positions = [];

                                            for (let i = 0; i < trailLength; i++) {
                                                // Create trailing effect - each point follows behind the main progress
                                                const trailProgress = Math.max(0, progress - (i * 0.04)); // 0.04 spacing between trail points

                                                if (trailProgress > 0) {
                                                    const point = arc.userData.curve.getPoint(trailProgress);
                                                    positions.push(point.x, point.y, point.z);
                                                } else {
                                                    // If trail point hasn't started yet, use the starting position
                                                    const startPoint = arc.userData.curve.getPoint(0);
                                                    positions.push(startPoint.x, startPoint.y, startPoint.z);
                                                }
                                            }

                                            // Update geometry with new trail positions
                                            arc.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                                            arc.geometry.attributes.position.needsUpdate = true;

                                            // Dynamic opacity for trail effect (brightest at head, fading toward tail)
                                            let intensity;
                                            if (progress < 0.1) {
                                                // Quick fade-in
                                                intensity = progress * 10;
                                            } else if (progress > 0.9) {
                                                // Quick fade-out towards end of animation
                                                intensity = (1 - progress) * 10;
                                            } else {
                                                // Full intensity in middle
                                                intensity = 1.0;
                                            }

                                            arc.material.opacity = Math.min(intensity, 1.0) * arc.userData.originalOpacity;

                                            // Enhanced color with shooting effect
                                            const baseColor = new THREE.Color(getStatusColor(arc.userData.status));
                                            const brightnessMultiplier = 1.0 + intensity * 0.5;
                                            arc.material.color = baseColor.clone().multiplyScalar(brightnessMultiplier);
                                        } else {
                                            // Hold phase - keep full arc visible
                                            const fullArcPoints = arc.userData.points;
                                            const positions = [];
                                            fullArcPoints.forEach(point => {
                                                positions.push(point.x, point.y, point.z);
                                            });
                                            arc.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                                            arc.geometry.attributes.position.needsUpdate = true;

                                            arc.material.opacity = 0.7 * arc.userData.originalOpacity; // Slightly dimmer
                                            const baseColor = new THREE.Color(getStatusColor(arc.userData.status));
                                            arc.material.color = baseColor;
                                        }

                                    } else if (timeSinceStart > (animDuration + holdDuration)) {
                                        // Animation completed - mark as done and hide
                                        arc.userData.animationComplete = true;
                                        arc.userData.hasAnimated = true;
                                        arc.visible = false;
                                        arc.material.opacity = 0;

                                        // Hide badge when arc animation completes
                                        if (arc.userData.badgeSynced && !arc.userData.badgeHidden) {
                                            arc.userData.badgeHidden = true;
                                            setShowDrawer(false);
                                        }
                                    } else {
                                        // Animation hasn't started yet
                                        arc.visible = false;
                                        arc.material.opacity = 0;
                                    }
                                } else {
                                    // Animation already completed - keep hidden
                                    arc.visible = false;
                                    arc.material.opacity = 0;
                                }
                            } else {
                                // Handle legacy static arc animation - converted to sequential timing
                                if (!arc.userData.animationComplete) {
                                    const animDuration = arc.userData.animationDuration || 4000;
                                    const holdDuration = arc.userData.holdDuration || 1500;
                                    const timeSinceStart = currentTime - arc.userData.animationStartTime;

                                    if (timeSinceStart >= 0 && timeSinceStart <= (animDuration + holdDuration)) {
                                        arc.visible = true;
                                        const progress = Math.min(timeSinceStart / animDuration, 1.0);

                                        // Sync badge with currently animating arc (legacy fallback) - EXACT timing
                                        if (timeSinceStart >= 0 && timeSinceStart < 100 && !arc.userData.badgeSynced) { // First 100ms for exact sync
                                            arc.userData.badgeSynced = true;

                                            // Use stored shipment data from arc userData
                                            const shipmentForArc = arc.userData.shipmentData;
                                            if (shipmentForArc) {
                                                // Update active shipment and show badge at EXACT same time as arc
                                                setActiveShipment(shipmentForArc);
                                                setShowDrawer(true);
                                                console.log(`🎯 Badge synced with legacy arc animation for shipment: ${shipmentForArc.trackingNumber || shipmentForArc.id}`);
                                            }
                                        }

                                        if (timeSinceStart <= animDuration) {
                                            // Active animation phase
                                            let intensity;
                                            if (progress < 0.2) {
                                                intensity = progress * 5;
                                            } else if (progress < 0.7) {
                                                intensity = 0.9 + Math.sin(progress * Math.PI * 8) * 0.1;
                                            } else {
                                                intensity = (1 - progress) * 3;
                                            }

                                            arc.material.opacity = Math.min(intensity, 1.0);
                                            const baseColor = new THREE.Color(getStatusColor(arc.userData.status));
                                            const pulseMultiplier = 1.0 + intensity * 0.8;
                                            arc.material.color = baseColor.clone().multiplyScalar(pulseMultiplier);
                                        } else {
                                            // Hold phase
                                            arc.material.opacity = 0.8;
                                            const baseColor = new THREE.Color(getStatusColor(arc.userData.status));
                                            arc.material.color = baseColor;
                                        }

                                    } else if (timeSinceStart > (animDuration + holdDuration)) {
                                        // Animation completed
                                        arc.userData.animationComplete = true;
                                        arc.visible = false;
                                        arc.material.opacity = 0;

                                        // Hide badge when legacy arc animation completes
                                        if (arc.userData.badgeSynced && !arc.userData.badgeHidden) {
                                            arc.userData.badgeHidden = true;
                                            setShowDrawer(false);
                                        }
                                    } else {
                                        arc.visible = false;
                                        arc.material.opacity = 0;
                                    }
                                } else {
                                    // Animation already completed
                                    arc.visible = false;
                                    arc.material.opacity = 0;
                                }
                            }
                        });
                    }

                    // Animate moving particles for in-transit shipments with sequential timing
                    if (scene.userData.animatedParticles) {
                        const particleCount = scene.userData.animatedParticles.length;
                        for (let i = 0; i < particleCount; i++) {
                            const particle = scene.userData.animatedParticles[i];

                            // Check if this particle should be active based on sequential timing
                            const sequentialDelay = particle.userData.sequentialIndex * 4000;
                            const particleTimeSinceStart = (time * 1000) - sequentialDelay;

                            if (particleTimeSinceStart >= 0 && particleTimeSinceStart <= 5500) { // 4s animation + 1.5s hold
                                particle.visible = true;
                                particle.userData.progress += particle.userData.speed;

                                // Reset particle when it reaches destination
                                if (particle.userData.progress >= 1.0) {
                                    particle.userData.progress = 0;
                                }

                                // Update particle position along curve
                                const point = particle.userData.curve.getPoint(particle.userData.progress);
                                particle.position.copy(point);

                                // Particle opacity based on position (fade at ends)
                                const fadeDistance = 0.1;
                                let opacity = 1.0;
                                if (particle.userData.progress < fadeDistance) {
                                    opacity = particle.userData.progress / fadeDistance;
                                } else if (particle.userData.progress > 1.0 - fadeDistance) {
                                    opacity = (1.0 - particle.userData.progress) / fadeDistance;
                                }
                                particle.material.opacity = opacity * 0.9;

                                // Optimized glow effect (less frequent calculations)
                                if (frameCount % 3 === 0) { // Update every 3rd frame for performance
                                    const glowIntensity = Math.sin(time * 15) * 0.2 + 0.8;
                                    particle.material.opacity *= glowIntensity;
                                }
                            } else {
                                particle.visible = false;
                            }
                        }
                    }

                    // Optimized rendering - only render when needed
                    renderer.render(scene, camera);

                    // Debug first few frames and performance monitoring
                    frameCount++;
                    if (frameCount < 5) {
                        console.log(`🎬 Frame ${frameCount} rendered with ${scene.userData.animatedArcs?.length || 0} animated elements`);
                    }

                    // Performance monitoring every 60 frames (~1 second)
                    if (frameCount % 60 === 0 && frameCount > 0) {
                        const renderTime = performance.now() - time * 1000;
                        if (renderTime > 16.67) { // Alert if frame takes longer than 60fps
                            console.warn(`⚠️ Performance: Frame ${frameCount} took ${renderTime.toFixed(2)}ms (should be <16.67ms for 60fps)`);
                        }
                    }
                };
                animate();

            } catch (error) {
                console.error('Error initializing globe:', error);
                setLoading(false);
            }
        };

        // Helper function to get carrier logo path
        const getCarrierLogoPath = (shipment) => {
            // First, check if this is an eShip Plus shipment - use primary carrier logo
            const carrierName = shipment.selectedRate?.carrier ||
                shipment.selectedRateRef?.carrier ||
                shipment.carrier ||
                shipment.selectedRate?.CarrierName || '';

            const isEShipPlus = shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
                shipment.selectedRate?.sourceCarrierName === 'eShipPlus' ||
                shipment.selectedRateRef?.sourceCarrierName === 'eShipPlus' ||
                // Enhanced detection for freight carriers (which are typically eShipPlus)
                carrierName.toLowerCase().includes('freight') ||
                carrierName.toLowerCase().includes('ltl') ||
                carrierName.toLowerCase().includes('fedex freight') ||
                carrierName.toLowerCase().includes('road runner') ||
                carrierName.toLowerCase().includes('roadrunner') ||
                carrierName.toLowerCase().includes('estes') ||
                carrierName.toLowerCase().includes('yrc') ||
                carrierName.toLowerCase().includes('xpo') ||
                carrierName.toLowerCase().includes('old dominion') ||
                carrierName.toLowerCase().includes('odfl') ||
                carrierName.toLowerCase().includes('saia') ||
                carrierName.toLowerCase().includes('ward');

            if (isEShipPlus) {
                console.log(`🚛 eShip Plus shipment detected for ${shipment.id}, using eShip logo`);
                return '/images/carrier-badges/eship.png';
            }

            // For non-eShip Plus shipments, use the already extracted carrier name
            if (!carrierName) {
                console.log(`🚛 No carrier name found for shipment ${shipment.id}`);
                return null;
            }

            // Normalize carrier name to match logo filenames
            const normalizedName = carrierName.toLowerCase()
                .replace(/\s+/g, '')  // Remove spaces
                .replace(/[^a-z0-9]/g, ''); // Remove special characters

            // Map common carrier names to logo files
            const carrierLogoMap = {
                'fedex': 'fedex.png',
                'ups': 'ups.png',
                'usps': 'usps.png',
                'dhl': 'dhl.png',
                'canadapost': 'canadapost.png',
                'canpar': 'canpar.png',
                'purolator': 'purolator.png',
                'polaristransportation': 'polaristransportation.png',
                'eship': 'eship.png',
                'eshipplus': 'eship.png', // Use eship logo for eshipplus
                // Add common variations
                'fedexground': 'fedex.png',
                'fedexexpress': 'fedex.png',
                'upsground': 'ups.png',
                'uspspriority': 'usps.png',
                'polaris': 'polaristransportation.png',
            };

            const logoFile = carrierLogoMap[normalizedName];
            if (logoFile) {
                console.log(`🚛 Found carrier logo for ${carrierName} -> ${logoFile}`);
                return `/images/carrier-badges/${logoFile}`;
            } else {
                console.log(`🚛 No logo mapping found for carrier: ${carrierName} (normalized: ${normalizedName})`);
                return null;
            }
        };

        const addShipmentRoutes = async (scene, shipments) => {
            console.log(`📦 Total shipments received:`, shipments.length);
            console.log(`📦 Full shipments data:`, shipments.slice(0, 3)); // Show first 3 for debugging

            // Debug shipment data structure
            if (shipments.length > 0) {
                const firstShipment = shipments[0];
                console.log(`🔍 First shipment structure:`, Object.keys(firstShipment));
                console.log(`🔍 Address fields check:`, {
                    originAddress: firstShipment.originAddress,
                    destinationAddress: firstShipment.destinationAddress,
                    shipFrom: firstShipment.shipFrom,
                    shipTo: firstShipment.shipTo,
                    origin: firstShipment.origin,
                    destination: firstShipment.destination,
                    from: firstShipment.from,
                    to: firstShipment.to
                });
                console.log(`🚛 Carrier info:`, {
                    carrier: firstShipment.carrier,
                    selectedRateCarrier: firstShipment.selectedRate?.carrier,
                    selectedRateRefCarrier: firstShipment.selectedRateRef?.carrier
                });
            }

            const validShipments = shipments.filter(s => s.status && s.status.toLowerCase() !== 'draft');
            console.log(`🚚 Valid shipments (non-draft):`, validShipments.length);
            console.log(`🚚 Valid shipments statuses:`, validShipments.map(s => s.status));
            console.log(`🚚 Starting sequential shipment processing for performance...`);

            // Arrays to track animated objects for the animation loop
            const animatedArcs = [];
            const animatedParticles = [];

            // Initialize scene metadata for sequential processing
            scene.userData.animatedArcs = animatedArcs;
            scene.userData.animatedParticles = animatedParticles;
            scene.userData.totalShipments = validShipments.length;
            scene.userData.currentShipmentIndex = 0;
            scene.userData.isProcessingShipments = true;
            scene.userData.maxDelay = validShipments.length * 4000; // Total time for one full cycle (4s per shipment)

            // Sequential processing function
            const processNextShipment = async (index) => {
                if (index >= validShipments.length) {
                    console.log(`✅ All ${validShipments.length} shipments processed sequentially`);
                    scene.userData.isProcessingShipments = false;
                    return;
                }

                const shipment = validShipments[index];
                try {
                    console.log(`🔍 Processing shipment ${index + 1}/${validShipments.length}: ${shipment.id}`);
                    console.log(`📍 Origin: ${shipment.origin}`);
                    console.log(`📍 Destination: ${shipment.destination}`);

                    const originCoords = await getCityCoordinates(shipment.origin);
                    const destCoords = await getCityCoordinates(shipment.destination);

                    console.log(`🗺️ Origin coords:`, originCoords);
                    console.log(`🗺️ Dest coords:`, destCoords);

                    if (originCoords && destCoords) {
                        const startVec = latLngToVector3(originCoords.lat, originCoords.lng, 10.05);
                        const endVec = latLngToVector3(destCoords.lat, destCoords.lng, 10.05);
                        const distance = startVec.distanceTo(endVec);

                        // Create arc with proper height based on distance
                        const arcHeight = Math.max(2, distance * 0.5);
                        const mid = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
                        mid.normalize().multiplyScalar(10 + arcHeight);

                        // Create smooth curve with more points for better arcs
                        const curve = new THREE.QuadraticBezierCurve3(startVec, mid, endVec);
                        const points = curve.getPoints(100);

                        // Create thick animated arc with trail effect for movement
                        const trailLength = 25; // Number of points in the shooting trail (increased for visibility)
                        const trailPoints = new Array(trailLength).fill().map(() => startVec.clone());
                        const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);

                        // Enhanced material for thick arc effect
                        const material = new THREE.LineBasicMaterial({
                            color: getStatusColor(shipment.status),
                            opacity: 0.95,
                            transparent: true,
                            linewidth: 12 // Much thicker line for visibility
                        });
                        const arc = new THREE.Line(trailGeometry, material);

                        // Add sequential animation timing - reduced for better flow
                        const animationDuration = 4000; // 4s animation (reduced from 6s)
                        const holdDuration = 1500; // 1.5s hold (reduced from 3s)
                        const totalDurationPerShipment = animationDuration + holdDuration; // 5.5s total
                        const animationStartDelay = index * 4000; // 4s between shipments for better spacing
                        const currentTime = performance.now(); // Get current time when creating arc

                        arc.userData = {
                            isAnimatedArc: true,
                            isShootingArc: true, // Flag for shooting animation
                            originalOpacity: 0.95,
                            status: shipment.status,
                            shipmentId: shipment.shipmentID || shipment.shipmentId || shipment.id,
                            animationStartTime: currentTime + animationStartDelay,
                            originalDelay: animationStartDelay, // Store original delay for reference
                            curve: curve,
                            points: points,
                            trailLength: trailLength,
                            trailPoints: trailPoints,
                            progress: 0, // Current position along the curve (0 to 1)
                            badgeSynced: false, // Track badge synchronization
                            badgeHidden: false, // Track badge hiding
                            lastCycle: -1, // Track animation cycles for looping
                            shipmentData: shipment, // Store full shipment data for badge
                            sequentialIndex: index, // Track processing order
                            animationDuration: animationDuration,
                            holdDuration: holdDuration
                        };
                        group.add(arc); // Add to rotating Earth group
                        animatedArcs.push(arc);

                        // No glow layers for thin line approach - keep it clean and simple

                        // Create tiny endpoint markers - just slightly bigger than the lines
                        const originGeo = new THREE.SphereGeometry(0.01, 8, 8); // Very tiny markers
                        const originMat = new THREE.MeshBasicMaterial({
                            color: 0x00ff00, // Green for origin
                            transparent: true,
                            opacity: 0.9
                        });
                        const originMarker = new THREE.Mesh(originGeo, originMat);
                        originMarker.position.copy(startVec);
                        originMarker.userData = {
                            isMarker: true,
                            parentArc: arc,
                            originalOpacity: 0.9
                        };
                        group.add(originMarker);

                        const destGeo = new THREE.SphereGeometry(0.01, 8, 8); // Very tiny markers
                        const destMat = new THREE.MeshBasicMaterial({
                            color: 0xff0000, // Red for destination
                            transparent: true,
                            opacity: 0.9
                        });
                        const destMarker = new THREE.Mesh(destGeo, destMat);
                        destMarker.position.copy(endVec);
                        destMarker.userData = {
                            isMarker: true,
                            parentArc: arc,
                            originalOpacity: 0.9
                        };
                        group.add(destMarker);

                        // Add all markers to animated arcs for visibility control
                        animatedArcs.push(originMarker, destMarker);

                        // Add enhanced animated particles for in-transit shipments
                        if (shipment.status?.toLowerCase() === 'in_transit') {
                            // Main bright particle
                            const particleGeo = new THREE.SphereGeometry(0.12, 12, 12); // Larger particle
                            const particleMat = new THREE.MeshBasicMaterial({
                                color: 0xffffff,
                                transparent: true,
                                opacity: 1.0,
                                emissive: new THREE.Color(0xffffff),
                                emissiveIntensity: 0.8
                            });
                            const particle = new THREE.Mesh(particleGeo, particleMat);
                            particle.position.copy(startVec);
                            particle.userData = {
                                isMovingParticle: true,
                                curve: curve,
                                progress: Math.random() * 0.3, // Start at different positions
                                speed: 0.008 + Math.random() * 0.004, // Faster movement
                                shipmentId: shipment.shipmentID || shipment.shipmentId || shipment.id,
                                sequentialIndex: index
                            };
                            group.add(particle); // Add to rotating Earth group
                            animatedParticles.push(particle);

                            // Trailing glow particle
                            const trailGeo = new THREE.SphereGeometry(0.2, 12, 12);
                            const trailMat = new THREE.MeshBasicMaterial({
                                color: getStatusColor(shipment.status),
                                transparent: true,
                                opacity: 0.4,
                                emissive: new THREE.Color(getStatusColor(shipment.status)),
                                emissiveIntensity: 1.0
                            });
                            const trailParticle = new THREE.Mesh(trailGeo, trailMat);
                            trailParticle.position.copy(startVec);
                            trailParticle.userData = {
                                isMovingParticle: true,
                                isTrailParticle: true,
                                parentParticle: particle,
                                curve: curve,
                                progress: Math.random() * 0.3,
                                speed: 0.006 + Math.random() * 0.003, // Slightly slower for trailing effect
                                shipmentId: shipment.shipmentID || shipment.shipmentId || shipment.id,
                                sequentialIndex: index
                            };
                            group.add(trailParticle);
                            animatedParticles.push(trailParticle);
                        }

                        console.log(`✅ Shipment ${index + 1} geocoded and added - scheduling next in 4000ms`);

                        // Schedule next shipment processing with overlap for better flow
                        setTimeout(() => {
                            processNextShipment(index + 1);
                        }, 4000); // 4 second intervals for better spacing

                    } else {
                        console.warn(`❌ Skipping shipment ${shipment.id} - missing coordinates, processing next...`);
                        // Process next shipment immediately if current one fails
                        setTimeout(() => processNextShipment(index + 1), 100);
                    }
                } catch (error) {
                    console.error(`❌ Error processing shipment ${shipment.id}:`, error);
                    // Process next shipment immediately if current one fails
                    setTimeout(() => processNextShipment(index + 1), 100);
                }
            };

            // Start sequential processing with the first shipment
            if (validShipments.length > 0) {
                processNextShipment(0);
            } else {
                console.log(`ℹ️ No valid shipments to process`);
                scene.userData.isProcessingShipments = false;
            }

            console.log(`✅ Sequential processing initialized for ${validShipments.length} shipments`);
            console.log(`🔄 Total cycle time: ${validShipments.length * 4000}ms (${((validShipments.length * 4000) / 1000 / 60).toFixed(1)} minutes)`);
            console.log(`🎯 Using thick trail arcs with 1.5s hold and 4s intervals for perfect timing`);
        };

        // Small delay to ensure DOM is ready and prevent double initialization in React Strict Mode
        const timeoutId = setTimeout(initializeGlobe, 10);

        return () => {
            clearTimeout(timeoutId);
            if (animationId) cancelAnimationFrame(animationId);
            if (renderer) renderer.dispose();
            if (mountRef.current && renderer?.domElement) {
                try {
                    mountRef.current.removeChild(renderer.domElement);
                } catch (e) {
                    // Element may already be removed
                    console.warn('Canvas cleanup warning:', e.message);
                }
            }
        };
    }, [width, height, JSON.stringify(shipments)]); // Use JSON.stringify to prevent object reference changes from causing reload

    // Enhanced UI Functions

    // Helper functions for stream messages
    const getEventIcon = (eventType) => {
        switch (eventType?.toLowerCase()) {
            case 'created':
            case 'shipment_created': return '📦';
            case 'status_update':
            case 'status_changed': return '🔄';
            case 'tracking_update':
            case 'location_update': return '📍';
            case 'booking_confirmed':
            case 'booked': return '✅';
            case 'carrier_update':
            case 'picked_up':
            case 'pickup': return '🚚';
            case 'document_generated':
            case 'label_created': return '📄';
            case 'rate_selected': return '💰';
            case 'in_transit':
            case 'transit': return '✈️';
            case 'out_for_delivery': return '🚛';
            case 'delivered': return '✅';
            case 'exception':
            case 'delayed': return '⚠️';
            case 'cancelled': return '❌';
            default: return '📦';
        }
    };

    const getLocationName = (address) => {
        if (!address) return 'Unknown';
        if (address.city && address.state) {
            return `${address.city}, ${address.state}`;
        }
        if (address.city) return address.city;
        if (address.state) return address.state;
        return 'Unknown';
    };

    // Initialize stream messages from shipments with real event data
    useEffect(() => {
        if (shipments && shipments.length > 0) {
            // Create messages from real shipment events and recent shipments
            const allEventMessages = [];

            // First, add messages from actual events
            Object.entries(shipmentEvents).forEach(([shipmentId, events]) => {
                if (events && events.length > 0) {
                    const shipment = shipments.find(s =>
                        (s.shipmentID || s.shipmentId || s.id) === shipmentId
                    );

                    if (shipment) {
                        // Add the 2 most recent events for each shipment
                        events.slice(0, 2).forEach((event, eventIndex) => {
                            allEventMessages.push({
                                id: `init-event-${event.eventId || shipmentId}-${eventIndex}`,
                                type: 'shipment_event',
                                content: `${getEventIcon(event.eventType)} ${event.title} • ${shipment.trackingNumber || shipment.id}`,
                                status: shipment.status,
                                timestamp: event.timestamp || (Date.now() - (eventIndex * 60000)), // 1 minute apart if no timestamp
                                visible: true,
                                eventType: event.eventType,
                                location: event.location
                            });
                        });
                    }
                }
            });

            // Then add fallback messages for shipments without events
            const shipmentsWithoutEvents = shipments.filter(shipment => {
                const shipmentId = shipment.shipmentID || shipment.shipmentId || shipment.id;
                return !shipmentEvents[shipmentId] || shipmentEvents[shipmentId].length === 0;
            });

            shipmentsWithoutEvents.slice(0, 10).forEach((shipment, index) => {
                allEventMessages.push({
                    id: `init-shipment-${shipment.shipmentID || shipment.shipmentId || shipment.id}`,
                    type: 'shipment',
                    content: `📦 ${shipment.trackingNumber || shipment.id} • ${getLocationName(shipment.origin)} → ${getLocationName(shipment.destination)}`,
                    status: shipment.status,
                    timestamp: shipment.createdAt ? new Date(shipment.createdAt).getTime() : (Date.now() - (index * 120000)), // 2 minutes apart
                    visible: true
                });
            });

            // Sort by timestamp and take latest 15
            allEventMessages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            const latestMessages = allEventMessages.slice(0, 15);

            setStreamMessages(prev => {
                // Only update if we don't have live messages already
                const liveMessages = prev.filter(msg => msg.isLive);
                if (liveMessages.length > 0) {
                    return [...liveMessages, ...latestMessages];
                }
                return latestMessages;
            });
        }
    }, [shipments, shipmentEvents]);

    // Auto-advance shipments when not in search mode (disabled - now synced to arc animations)
    useEffect(() => {
        // The drawer is now synchronized directly with arc animations in the animation loop
        // This provides perfect timing sync between the visual arc and the drawer information

        // Keep the currentShipmentIndex for search functionality
        if (!isSearchMode && !isPaused && shipments.length > 0) {
            const interval = setInterval(() => {
                setCurrentShipmentIndex(prev => (prev + 1) % shipments.length);
            }, 5000); // Keep index cycling for other features

            return () => clearInterval(interval);
        }
    }, [isSearchMode, isPaused, shipments.length]);

    // Real-time event stream from shipmentEvents
    useEffect(() => {
        // Process real shipment events and add them to stream
        const processedEvents = [];

        Object.entries(shipmentEvents).forEach(([shipmentId, events]) => {
            if (events && events.length > 0) {
                // Get the latest event for each shipment
                const latestEvent = events[0]; // Events are sorted newest first
                const shipment = shipments.find(s =>
                    (s.shipmentID || s.shipmentId || s.id) === shipmentId
                );

                if (latestEvent && shipment) {
                    const eventTime = new Date(latestEvent.timestamp);
                    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

                    // Only include recent events (last 5 minutes) or if no timestamp, include it
                    if (!latestEvent.timestamp || eventTime > fiveMinutesAgo) {
                        processedEvents.push({
                            id: `event-${latestEvent.eventId || shipmentId}-${latestEvent.timestamp || Date.now()}`,
                            type: 'live_event',
                            content: `${getEventIcon(latestEvent.eventType)} ${latestEvent.title} • ${shipment.trackingNumber || shipment.id}`,
                            status: shipment.status,
                            timestamp: latestEvent.timestamp || Date.now(),
                            visible: true,
                            isLive: true,
                            eventType: latestEvent.eventType,
                            location: latestEvent.location
                        });
                    }
                }
            }
        });

        // Sort by timestamp (newest first) and take latest 15
        processedEvents.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const latestEvents = processedEvents.slice(0, 15);

        if (latestEvents.length > 0) {
            setStreamMessages(prev => {
                // Merge with existing non-live messages, prioritizing live events
                const nonLiveMessages = prev.filter(msg => !msg.isLive);
                const allMessages = [...latestEvents, ...nonLiveMessages];
                return allMessages.slice(0, 20); // Keep last 20 total
            });
        }

    }, [shipmentEvents, shipments]);

    // Search functionality
    const handleSearch = useCallback((searchValue) => {
        setSearchTerm(searchValue);

        if (!searchValue.trim()) {
            setIsSearchMode(false);
            setActiveShipment(null);
            setShowDrawer(false);
            return;
        }

        const foundShipment = shipments.find(s =>
            s.trackingNumber?.toLowerCase().includes(searchValue.toLowerCase()) ||
            (s.shipmentID || s.shipmentId || s.id)?.toLowerCase().includes(searchValue.toLowerCase())
        );

        if (foundShipment) {
            // Add real-time events to the found shipment using proper shipment ID
            const actualShipmentId = foundShipment.shipmentID || foundShipment.shipmentId || foundShipment.id;
            const shipmentEventsData = shipmentEvents[actualShipmentId] || [];
            const enhancedShipment = {
                ...foundShipment,
                latestEvents: shipmentEventsData.slice(0, 3) // Show latest 3 events
            };

            setIsSearchMode(true);
            setActiveShipment(enhancedShipment);
            setShowDrawer(true);
            setUserInteracting(true); // Stop auto rotation
        }
    }, [shipments]);

    // Resume auto mode
    const handleResume = useCallback(() => {
        setIsSearchMode(false);
        setSearchTerm('');
        setActiveShipment(null);
        setShowDrawer(false);
        setIsPaused(false);
        setUserInteracting(false); // Resume auto rotation
    }, []);

    // Toggle pause/play
    const handleTogglePause = useCallback(() => {
        setIsPaused(prev => !prev);
    }, []);

    const toggleFullScreen = () => {
        const willBeFullScreen = !isFullScreen;
        console.log('🖼️ Toggling fullscreen mode:', { current: isFullScreen, willBe: willBeFullScreen });

        setIsFullScreen(willBeFullScreen);

        // Give time for DOM to update, then properly handle renderer
        setTimeout(() => {
            const renderer = rendererRef.current;
            const camera = cameraRef.current;
            const scene = sceneRef.current;

            if (renderer && camera && scene) {
                const container = mountRef.current;
                if (container) {
                    // Clear existing canvas first
                    while (container.firstChild) {
                        container.removeChild(container.firstChild);
                    }

                    // Get actual container dimensions
                    const newWidth = willBeFullScreen ? window.innerWidth : container.clientWidth || width;
                    const newHeight = willBeFullScreen ? window.innerHeight : container.clientHeight || height;

                    console.log('🖼️ Resizing renderer for fullscreen toggle:', {
                        willBeFullScreen,
                        width: newWidth,
                        height: newHeight,
                        containerSize: { w: container.clientWidth, h: container.clientHeight }
                    });

                    // Update renderer size
                    renderer.setSize(newWidth, newHeight);
                    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

                    // Update camera aspect ratio
                    camera.aspect = newWidth / newHeight;
                    camera.updateProjectionMatrix();

                    // Re-append canvas to container
                    container.appendChild(renderer.domElement);

                    // Ensure canvas is properly sized and visible
                    const canvas = renderer.domElement;
                    canvas.style.width = '100%';
                    canvas.style.height = '100%';
                    canvas.style.display = 'block';

                    // Force immediate render
                    renderer.render(scene, camera);

                    console.log('✅ Fullscreen globe re-attached and rendered');
                }
            }
        }, 300); // Longer delay for fullscreen transition
    };

    const globeContent = (
        <>
            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
            {loading && (
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', color: 'white', zIndex: 10 }}>
                    <Typography>Loading realistic Earth...</Typography>
                </Box>
            )}
            {showOverlays && !loading && (
                <Box sx={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 0.8, zIndex: 5 }}>
                    {[
                        { key: 'pending', label: 'Awaiting Shipment', color: '#FFA726', value: realtimeStatusCounts.pending || statusCounts.pending || statusCounts.awaitingShipment || 0 },
                        { key: 'transit', label: 'In Transit', color: '#42A5F5', value: realtimeStatusCounts.transit || statusCounts.transit || statusCounts.inTransit || 0 },
                        { key: 'delivered', label: 'Delivered', color: '#66BB6A', value: realtimeStatusCounts.delivered || statusCounts.delivered || 0 },
                        { key: 'delayed', label: 'Delayed', color: '#F44336', value: realtimeStatusCounts.delayed || statusCounts.delayed || 0 }
                    ].map(({ key, label, color, value }) => (
                        <Box key={key} sx={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            minWidth: '80px',
                            textAlign: 'center',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                background: 'rgba(0, 0, 0, 0.4)',
                                transform: 'translateX(4px)'
                            }
                        }}>
                            <Typography variant="caption" sx={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                fontSize: '0.65rem',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                display: 'block',
                                marginBottom: '2px'
                            }}>
                                {label}
                            </Typography>
                            <Typography variant="h4" sx={{
                                color: color,
                                fontWeight: 700,
                                fontSize: '1.8rem',
                                lineHeight: 1,
                                textShadow: `0 0 12px ${color}60`
                            }}>
                                {value}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            )}

            {/* Real-time Stream (Bottom Left) */}
            {!loading && (
                <Box sx={{
                    position: 'absolute',
                    bottom: 16,
                    left: 16,
                    width: '300px',
                    height: '200px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    zIndex: 5,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column-reverse' // Messages flow from bottom to top
                }}>
                    <Box
                        ref={streamRef}
                        sx={{
                            flex: 1,
                            overflowY: 'hidden',
                            display: 'flex',
                            flexDirection: 'column-reverse',
                            padding: '8px',
                            gap: '2px'
                        }}
                    >
                        {streamMessages.slice(0, 15).map((message, index) => (
                            <Fade
                                key={message.id}
                                in={message.visible}
                                timeout={500}
                                style={{
                                    transitionDelay: `${index * 50}ms`
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: '0.75rem',
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        fontFamily: 'monospace',
                                        lineHeight: 1.3,
                                        opacity: Math.max(0.3, 1 - (index * 0.05)), // Fade out towards top
                                        transform: `translateY(${index * -1}px)`, // Subtle movement effect
                                        transition: 'all 0.3s ease',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                                    }}
                                >
                                    {message.content}
                                </Typography>
                            </Fade>
                        ))}
                    </Box>

                    {/* Stream Header */}
                    <Box sx={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '8px',
                        background: 'rgba(0, 0, 0, 0.3)'
                    }}>
                        <Typography sx={{
                            fontSize: '0.7rem',
                            color: 'rgba(255, 255, 255, 0.6)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            🔴 LIVE FEED
                        </Typography>
                    </Box>
                </Box>
            )}

            {/* Compact Badge (Bottom Right) - Exact FedEx Style */}
            <Slide direction="up" in={showDrawer && activeShipment && !loading} mountOnEnter unmountOnExit>
                <Box sx={{
                    position: 'absolute',
                    bottom: 16,
                    right: 16,
                    zIndex: 7,
                    transition: 'all 0.3s ease'
                }}>
                    {activeShipment && (
                        <Box sx={{
                            display: 'flex',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                            minWidth: '320px',
                            height: '64px'
                        }}>
                            {/* Left: Carrier Logo Section */}
                            <Box sx={{
                                width: '96px',
                                backgroundColor: (() => {
                                    const carrierName = (activeShipment.selectedRate?.carrier ||
                                        activeShipment.selectedRateRef?.carrier ||
                                        activeShipment.carrier || '').toLowerCase();

                                    // Carrier-specific brand colors
                                    if (carrierName.includes('fedex')) return '#4B0082'; // FedEx Purple
                                    if (carrierName.includes('ups')) return '#8B4513'; // UPS Brown
                                    if (carrierName.includes('dhl')) return '#FFD320'; // DHL Yellow
                                    if (carrierName.includes('usps')) return '#1F3B69'; // USPS Blue
                                    if (carrierName.includes('canpar')) return '#E31837'; // Canpar Red
                                    if (carrierName.includes('purolator')) return '#003087'; // Purolator Blue
                                    if (carrierName.includes('polaris')) return '#1E3A8A'; // Polaris Blue
                                    return '#7C3AED'; // Default purple
                                })(),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '8px'
                            }}>
                                {(() => {
                                    const getLogoPath = (shipment) => {
                                        const carrierName = shipment.selectedRate?.carrier ||
                                            shipment.selectedRateRef?.carrier ||
                                            shipment.carrier || '';

                                        const normalizedName = carrierName.toLowerCase()
                                            .replace(/\s+/g, '')
                                            .replace(/[^a-z0-9]/g, '');

                                        const carrierLogoMap = {
                                            'fedex': 'fedex.png',
                                            'ups': 'ups.png',
                                            'usps': 'usps.png',
                                            'dhl': 'dhl.png',
                                            'canadapost': 'canadapost.png',
                                            'canpar': 'canpar.png',
                                            'purolator': 'purolator.png',
                                            'polaristransportation': 'polaristransportation.png',
                                            'eship': 'eship.png'
                                        };

                                        const logoFile = carrierLogoMap[normalizedName];
                                        return logoFile ? `/images/carrier-badges/${logoFile}` : null;
                                    };

                                    const logoPath = getLogoPath(activeShipment);
                                    return logoPath ? (
                                        <img
                                            src={logoPath}
                                            alt="Carrier Logo"
                                            style={{
                                                maxHeight: '32px',
                                                maxWidth: '80px',
                                                objectFit: 'contain',
                                                filter: 'brightness(0) invert(1)' // White logo
                                            }}
                                        />
                                    ) : (
                                        <Typography sx={{
                                            color: 'white',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            textAlign: 'center',
                                            lineHeight: 1.2
                                        }}>
                                            {(activeShipment.selectedRate?.carrier ||
                                                activeShipment.selectedRateRef?.carrier ||
                                                activeShipment.carrier || 'CARRIER').toUpperCase()}
                                        </Typography>
                                    );
                                })()}
                            </Box>

                            {/* Right: Info Section */}
                            <Box sx={{
                                flex: 1,
                                backgroundColor: '#1a1a1a', // Dark background like FedEx
                                padding: '8px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}>
                                {/* Tracking Number */}
                                <Typography sx={{
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    fontFamily: 'monospace',
                                    letterSpacing: '0.5px'
                                }}>
                                    #{activeShipment.trackingNumber || activeShipment.id}
                                </Typography>

                                {/* Route */}
                                <Typography sx={{
                                    color: 'white',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    lineHeight: 1
                                }}>
                                    {activeShipment.origin?.city || 'Origin'} &gt; {activeShipment.destination?.city || 'Destination'}
                                </Typography>

                                {/* Status Pill */}
                                <Box sx={{
                                    alignSelf: 'flex-start'
                                }}>
                                    <Chip
                                        label={activeShipment.status?.replace('_', ' ').toUpperCase() || 'STATUS'}
                                        sx={{
                                            backgroundColor: '#3B82F6',
                                            color: 'white',
                                            fontSize: '0.65rem',
                                            fontWeight: 600,
                                            height: '20px',
                                            borderRadius: '10px',
                                            '& .MuiChip-label': {
                                                paddingX: '8px',
                                                paddingY: '0'
                                            }
                                        }}
                                    />
                                </Box>
                            </Box>
                        </Box>
                    )}
                </Box>
            </Slide>

            {/* Enhanced Top Right Controls */}
            {!isFullScreen && (
                <Box sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    zIndex: 6,
                    display: 'flex',
                    gap: 1,
                    alignItems: 'center'
                }}>
                    {/* Search Box */}
                    <Box sx={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '8px',
                        overflow: 'hidden'
                    }}>
                        <TextField
                            size="small"
                            placeholder="Search shipment ID..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem' }} />
                                    </InputAdornment>
                                ),
                                sx: {
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    height: '36px',
                                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                    '& input': {
                                        padding: '8px 8px 8px 0',
                                        '&::placeholder': {
                                            color: 'rgba(255,255,255,0.5)',
                                            opacity: 1
                                        }
                                    }
                                }
                            }}
                            sx={{ width: '200px' }}
                        />
                    </Box>

                    {/* Control Buttons */}
                    {isSearchMode && (
                        <Button
                            size="small"
                            onClick={handleResume}
                            sx={{
                                background: 'rgba(0, 0, 0, 0.3)',
                                backdropFilter: 'blur(20px)',
                                color: 'white',
                                minWidth: '80px',
                                height: '36px',
                                fontSize: '0.75rem',
                                '&:hover': {
                                    background: 'rgba(0, 0, 0, 0.5)'
                                }
                            }}
                        >
                            Resume Auto
                        </Button>
                    )}

                    {!isSearchMode && (
                        <IconButton
                            size="small"
                            onClick={handleTogglePause}
                            sx={{
                                background: 'rgba(0, 0, 0, 0.3)',
                                backdropFilter: 'blur(20px)',
                                color: 'white',
                                width: '36px',
                                height: '36px',
                                '&:hover': {
                                    background: 'rgba(0, 0, 0, 0.5)'
                                }
                            }}
                        >
                            {isPaused ? <PlayIcon /> : <PauseIcon />}
                        </IconButton>
                    )}

                    {/* Fullscreen Button */}
                    <IconButton
                        onClick={toggleFullScreen}
                        sx={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            backdropFilter: 'blur(20px)',
                            color: 'white',
                            width: '36px',
                            height: '36px',
                            '&:hover': {
                                background: 'rgba(0, 0, 0, 0.5)'
                            }
                        }}
                    >
                        <FullscreenIcon />
                    </IconButton>
                </Box>
            )}
        </>
    );

    if (isFullScreen) {
        return (
            <Box sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: '#000000', // Black background
                zIndex: 9999,
                backdropFilter: 'blur(10px)'
            }}>
                {/* Close Button */}
                <Box
                    onClick={toggleFullScreen}
                    sx={{
                        position: 'absolute',
                        top: 24,
                        right: 24,
                        background: 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '50%',
                        width: 48,
                        height: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 10000,
                        transition: 'all 0.3s ease',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        '&:hover': {
                            background: 'rgba(255, 255, 255, 0.2)',
                            transform: 'scale(1.1)'
                        }
                    }}
                >
                    <Typography sx={{
                        color: 'white',
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        lineHeight: 1
                    }}>
                        ✕
                    </Typography>
                </Box>

                {/* Enhanced Fullscreen Controls */}
                <Box sx={{
                    position: 'absolute',
                    top: 24,
                    right: 80, // Leave space for close button
                    zIndex: 10001,
                    display: 'flex',
                    gap: 1,
                    alignItems: 'center'
                }}>
                    {/* Search Box */}
                    <Box sx={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '8px',
                        overflow: 'hidden'
                    }}>
                        <TextField
                            size="small"
                            placeholder="Search shipment ID..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem' }} />
                                    </InputAdornment>
                                ),
                                sx: {
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    height: '36px',
                                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                    '& input': {
                                        padding: '8px 8px 8px 0',
                                        '&::placeholder': {
                                            color: 'rgba(255,255,255,0.5)',
                                            opacity: 1
                                        }
                                    }
                                }
                            }}
                            sx={{ width: '200px' }}
                        />
                    </Box>

                    {/* Control Buttons */}
                    {isSearchMode && (
                        <Button
                            size="small"
                            onClick={handleResume}
                            sx={{
                                background: 'rgba(0, 0, 0, 0.3)',
                                backdropFilter: 'blur(20px)',
                                color: 'white',
                                minWidth: '80px',
                                height: '36px',
                                fontSize: '0.75rem',
                                '&:hover': {
                                    background: 'rgba(0, 0, 0, 0.5)'
                                }
                            }}
                        >
                            Resume Auto
                        </Button>
                    )}

                    {!isSearchMode && (
                        <IconButton
                            size="small"
                            onClick={handleTogglePause}
                            sx={{
                                background: 'rgba(0, 0, 0, 0.3)',
                                backdropFilter: 'blur(20px)',
                                color: 'white',
                                width: '36px',
                                height: '36px',
                                '&:hover': {
                                    background: 'rgba(0, 0, 0, 0.5)'
                                }
                            }}
                        >
                            {isPaused ? <PlayIcon /> : <PauseIcon />}
                        </IconButton>
                    )}
                </Box>

                {/* Full Screen Globe Container */}
                <Box className="globe-container" sx={{
                    position: 'relative',
                    width: '100vw',
                    height: '100vh'
                }}>
                    {globeContent}
                </Box>
            </Box>
        );
    }

    return (
        <Box className="globe-container" sx={{
            position: 'relative',
            width,
            height,
            backgroundColor: '#000000', // Black background
            borderRadius: '8px'
        }}>
            {globeContent}
        </Box>
    );
};

export default ShipmentGlobe; 
