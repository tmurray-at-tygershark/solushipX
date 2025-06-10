// New Franky-style Globe implementation

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Box, Typography } from '@mui/material';
import { loadGoogleMaps } from '../../utils/googleMapsLoader';
import './Globe.css';



const geocodingCache = new Map();

const extractLocationFromAddress = (address) => {
    if (!address) return null;
    const parts = address.split(',').map(part => part.trim());
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

    // Split address into components and clean them
    const parts = address.split(',').map(part => part.trim());

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

const getCityCoordinates = async (addressString) => {
    if (!addressString) return { lat: 45.0, lng: -100.0 };

    // Check cache first
    if (geocodingCache.has(addressString)) {
        return geocodingCache.get(addressString);
    }

    // Try Google Maps geocoding first (if available)
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
        try {
            const geocoder = new window.google.maps.Geocoder();
            const result = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: addressString }, (results, status) => {
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

const ShipmentGlobe = ({ width = 500, height = 600, showOverlays = true, statusCounts = {}, shipments = [] }) => {
    const mountRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const sceneRef = useRef(null);
    const [userInteracting, setUserInteracting] = useState(false);

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

                    // Sequential shooting star animation - only one arc visible at a time
                    if (scene.userData.animatedArcs) {
                        const currentTime = time * 1000; // Convert to milliseconds
                        const animDuration = 6000; // 6 seconds for longer shooting star effect
                        const totalShipments = scene.userData.animatedArcs.filter(a => a.userData.isAnimatedArc).length;
                        const cycleDuration = totalShipments * 7000 + 3000; // Total cycle + 3 second pause (7s per arc for no overlap)

                        scene.userData.animatedArcs.forEach(arc => {
                            if (arc.userData.isMarker) {
                                // Markers follow parent arc's visibility exactly
                                const parentArc = arc.userData.parentArc;
                                if (parentArc && parentArc.userData) {
                                    arc.material.opacity = parentArc.visible ? arc.userData.originalOpacity : 0;
                                    arc.visible = parentArc.visible;
                                }
                            } else if (arc.userData.isCarrierLogo) {
                                // Carrier logos with elastic pop animations
                                const parentArc = arc.userData.parentArc;
                                if (parentArc && parentArc.userData) {
                                    const shouldShow = parentArc.visible;
                                    const logoData = arc.userData;

                                    // State machine for elastic animations
                                    if (shouldShow && logoData.animationPhase === 'hidden') {
                                        // Start appear animation
                                        logoData.animationPhase = 'appearing';
                                        logoData.animationStartTime = currentTime;
                                    } else if (!shouldShow && logoData.animationPhase === 'visible') {
                                        // Start disappear animation
                                        logoData.animationPhase = 'disappearing';
                                        logoData.animationStartTime = currentTime;
                                    }

                                    // Handle animation phases
                                    const animDuration = 800; // 0.8 seconds for pop animation
                                    const timeSinceStart = currentTime - logoData.animationStartTime;

                                    if (logoData.animationPhase === 'appearing') {
                                        if (timeSinceStart < animDuration) {
                                            // Elastic pop-in animation
                                            const progress = timeSinceStart / animDuration;

                                            // Elastic easing function (overshoot then settle)
                                            const elasticEase = (t) => {
                                                if (t === 0) return 0;
                                                if (t === 1) return 1;
                                                const p = 0.3;
                                                const s = p / 4;
                                                return Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1;
                                            };

                                            const scale = elasticEase(progress);
                                            arc.scale.set(
                                                logoData.finalScale.x * scale,
                                                logoData.finalScale.y * scale,
                                                1
                                            );
                                            arc.material.opacity = progress * logoData.originalOpacity;
                                            arc.visible = true;
                                        } else {
                                            // Animation complete - set to visible
                                            logoData.animationPhase = 'visible';
                                            arc.scale.set(logoData.finalScale.x, logoData.finalScale.y, 1);
                                            arc.material.opacity = logoData.originalOpacity;
                                            arc.visible = true;
                                        }
                                    } else if (logoData.animationPhase === 'disappearing') {
                                        if (timeSinceStart < animDuration * 0.6) { // Faster disappear
                                            // Elastic pop-out animation (reverse)
                                            const progress = 1 - (timeSinceStart / (animDuration * 0.6));

                                            // Bounce ease out (quick shrink with small bounce)
                                            const bounceEase = (t) => {
                                                if (t < 1 / 2.75) {
                                                    return 7.5625 * t * t;
                                                } else if (t < 2 / 2.75) {
                                                    return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
                                                } else if (t < 2.5 / 2.75) {
                                                    return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
                                                } else {
                                                    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
                                                }
                                            };

                                            const scale = bounceEase(progress);
                                            arc.scale.set(
                                                logoData.finalScale.x * scale,
                                                logoData.finalScale.y * scale,
                                                1
                                            );
                                            arc.material.opacity = progress * logoData.originalOpacity;
                                            arc.visible = true;
                                        } else {
                                            // Animation complete - hide
                                            logoData.animationPhase = 'hidden';
                                            arc.scale.set(0, 0, 1);
                                            arc.material.opacity = 0;
                                            arc.visible = false;
                                        }
                                    } else if (logoData.animationPhase === 'visible') {
                                        // Steady visible state
                                        arc.scale.set(logoData.finalScale.x, logoData.finalScale.y, 1);
                                        arc.material.opacity = logoData.originalOpacity;
                                        arc.visible = true;
                                    } else {
                                        // Hidden state
                                        arc.scale.set(0, 0, 1);
                                        arc.material.opacity = 0;
                                        arc.visible = false;
                                    }
                                }
                            } else if (arc.userData.isAnimatedArc) {
                                // Calculate cycle position
                                const cycleStartTime = Math.floor(currentTime / cycleDuration) * cycleDuration;
                                const timeInCycle = currentTime - cycleStartTime;
                                const animStartTime = arc.userData.originalDelay;
                                const animEndTime = animStartTime + animDuration;

                                // Only show arc during its specific animation window
                                if (timeInCycle >= animStartTime && timeInCycle <= animEndTime) {
                                    // Arc is currently animating - dramatic shooting star effect
                                    arc.visible = true;
                                    const progress = (timeInCycle - animStartTime) / animDuration;

                                    // Enhanced shooting star intensity curve
                                    let intensity;
                                    if (progress < 0.2) {
                                        // Rapid fade-in
                                        intensity = progress * 5;
                                    } else if (progress < 0.7) {
                                        // Bright middle section
                                        intensity = 0.9 + Math.sin(progress * Math.PI * 8) * 0.1;
                                    } else {
                                        // Dramatic fade-out
                                        intensity = (1 - progress) * 3;
                                    }

                                    arc.material.opacity = Math.min(intensity, 1.0);

                                    // Enhanced color with pulsing effect
                                    const baseColor = new THREE.Color(getStatusColor(arc.userData.status));
                                    const pulseMultiplier = 1.0 + intensity * 0.8;
                                    arc.material.color = baseColor.clone().multiplyScalar(pulseMultiplier);

                                } else {
                                    // Hide arc completely when not animating
                                    arc.visible = false;
                                    arc.material.opacity = 0;
                                }

                                // Update animation start time for next cycle
                                if (timeInCycle >= cycleDuration - 100) { // Near end of cycle
                                    arc.userData.animationStartTime = currentTime + animStartTime + 3000;
                                }
                            }
                        });
                    }

                    // Animate moving particles for in-transit shipments
                    if (scene.userData.animatedParticles) {
                        scene.userData.animatedParticles.forEach(particle => {
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

                            // Slight glow effect
                            const glowIntensity = Math.sin(time * 15) * 0.2 + 0.8;
                            particle.material.opacity *= glowIntensity;
                        });
                    }

                    renderer.render(scene, camera);

                    // Debug first few frames
                    if (frameCount < 5) {
                        console.log(`🎬 Frame ${frameCount + 1} rendered with ${scene.userData.animatedArcs?.length || 0} animated elements`);
                        frameCount++;
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
            console.log(`🚚 Adding ${validShipments.length} shipment routes to globe`);

            // Arrays to track animated objects for the animation loop
            const animatedArcs = [];
            const animatedParticles = [];



            for (const [index, shipment] of validShipments.entries()) {
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

                        // Create thin shooting star arc using line geometry
                        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

                        // Thin line arc with bright material
                        const material = new THREE.LineBasicMaterial({
                            color: getStatusColor(shipment.status),
                            opacity: 0.95,
                            transparent: true,
                            linewidth: 3 // Thin but visible line
                        });
                        const arc = new THREE.Line(lineGeometry, material);

                        // Add sequential animation timing for shooting star effect
                        const animationStartDelay = index * 7000; // 7 seconds between each shipment (6s animation + 1s gap)
                        const currentTime = performance.now(); // Get current time when creating arc

                        arc.userData = {
                            isAnimatedArc: true,
                            originalOpacity: 0.9,
                            status: shipment.status,
                            shipmentId: shipment.id,
                            animationStartTime: currentTime + animationStartDelay,
                            originalDelay: animationStartDelay, // Store original delay for restart cycles
                            curve: curve,
                            points: points
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

                        // Add carrier logo near the arc midpoint
                        const carrierLogoPath = getCarrierLogoPath(shipment);
                        console.log(`🚛 Checking carrier logo for shipment ${shipment.id}:`, {
                            carrierLogoPath,
                            carrier: shipment.carrier,
                            selectedRateCarrier: shipment.selectedRate?.carrier,
                            displayCarrierId: shipment.selectedRate?.displayCarrierId
                        });

                        if (carrierLogoPath) {
                            const addCarrierLogo = (logoPath, arcCurve) => {
                                // Get the midpoint of the arc for logo placement
                                const midPoint = arcCurve.getPoint(0.5);

                                // Position logo closer to surface but keep visible
                                const logoPosition = midPoint.clone();
                                logoPosition.normalize().multiplyScalar(11.2); // Slightly higher for better visibility

                                // Move logo slightly away from arc center for visibility
                                logoPosition.y -= 0.3; // Small southern offset to avoid overlap but stay visible

                                // Offset along arc to avoid overlap with shipping route
                                const offsetPoint = arcCurve.getPoint(0.6); // Use different point on arc
                                const offsetPosition = offsetPoint.clone();
                                offsetPosition.normalize().multiplyScalar(11.2);
                                offsetPosition.y -= 0.3; // Apply same small southern offset

                                // Use the offset position for better visibility
                                logoPosition.copy(offsetPosition);

                                // Load carrier logo texture
                                const textureLoader = new THREE.TextureLoader();
                                console.log(`🖼️ Attempting to load carrier logo: ${logoPath}`);

                                textureLoader.load(
                                    logoPath,
                                    (texture) => {
                                        console.log(`✅ Successfully loaded carrier logo: ${logoPath}`);

                                        // Create rounded corners canvas for the logo
                                        const canvas = document.createElement('canvas');
                                        const ctx = canvas.getContext('2d');

                                        // Set canvas size based on texture
                                        const size = 256;
                                        canvas.width = size;
                                        canvas.height = size;

                                        // Create rounded rectangle path
                                        const radius = size * 0.15; // 15% border radius
                                        ctx.beginPath();
                                        ctx.roundRect(0, 0, size, size, radius);
                                        ctx.clip();

                                        // Draw the logo texture onto the rounded canvas
                                        const img = new Image();
                                        img.crossOrigin = 'anonymous';
                                        img.onload = () => {
                                            ctx.drawImage(img, 0, 0, size, size);

                                            // Create texture from rounded canvas
                                            const roundedTexture = new THREE.CanvasTexture(canvas);
                                            roundedTexture.needsUpdate = true;

                                            // Create sprite material with the rounded carrier logo
                                            const logoMaterial = new THREE.SpriteMaterial({
                                                map: roundedTexture,
                                                transparent: true,
                                                opacity: 1.0, // Make immediately visible
                                                alphaTest: 0.1
                                            });

                                            const logoSprite = new THREE.Sprite(logoMaterial);
                                            logoSprite.position.copy(logoPosition);

                                            // Optimized size for visibility - 16:9 ratio
                                            const finalScaleX = 0.5; // Increased for better visibility
                                            const finalScaleY = 0.28; // Increased while maintaining 16:9 ratio
                                            logoSprite.scale.set(finalScaleX, finalScaleY, 1); // Make immediately visible at final size

                                            // Enhanced userData for animations
                                            logoSprite.userData = {
                                                isCarrierLogo: true,
                                                parentArc: arc,
                                                originalOpacity: 1.0,
                                                finalScale: { x: finalScaleX, y: finalScaleY },
                                                animationPhase: 'visible', // Make immediately visible
                                                animationStartTime: 0,
                                                originalDelay: arc.userData.originalDelay || 0
                                            };

                                            group.add(logoSprite);
                                            animatedArcs.push(logoSprite);

                                            console.log(`✅ Added animated carrier logo sprite for ${shipment.carrier || 'unknown carrier'}`);
                                        };

                                        img.src = logoPath;
                                    },
                                    undefined,
                                    (error) => {
                                        console.error(`❌ Failed to load carrier logo: ${logoPath}`, error);
                                    }
                                );
                            };

                            addCarrierLogo(carrierLogoPath, curve);
                        } else {
                            console.log(`⚠️ No carrier logo path found for shipment ${shipment.id}`);
                        }

                        // Add detailed address labels with dynamic positioning to avoid overlaps
                        const addCityLabel = (position, addressData, color = 0xffffff) => {
                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d');
                            canvas.width = 400; // Wider canvas for detailed addresses
                            canvas.height = 120; // Taller canvas for stacked address format

                            // Clean text styling with thin font
                            context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
                            context.font = '100 16px Arial'; // 100 = thin font weight
                            context.textAlign = 'left';
                            context.textBaseline = 'top';

                            // Add subtle shadow for better contrast
                            context.shadowColor = 'rgba(0, 0, 0, 0.8)';
                            context.shadowOffsetX = 1;
                            context.shadowOffsetY = 1;
                            context.shadowBlur = 2;

                            // Stacked address format: Street on line 1, City/State on line 2
                            let line1 = '';
                            let line2 = '';

                            if (addressData && typeof addressData === 'object') {
                                // Use structured address data
                                if (addressData.street) {
                                    line1 = addressData.street;
                                }
                                if (addressData.city || addressData.stateProvince) {
                                    const cityState = [];
                                    if (addressData.city) cityState.push(addressData.city);
                                    if (addressData.stateProvince) cityState.push(addressData.stateProvince);
                                    line2 = cityState.join(', ');
                                }
                                // If no street, use city as line 1
                                if (!line1 && addressData.city) {
                                    line1 = addressData.city;
                                    line2 = addressData.stateProvince || '';
                                }
                            } else if (typeof addressData === 'string') {
                                // Fallback for string format
                                const parts = addressData.split(',').map(p => p.trim());
                                if (parts.length >= 2) {
                                    line1 = parts[0];
                                    line2 = parts.slice(1).join(', ');
                                } else {
                                    line1 = addressData;
                                }
                            }

                            // Draw stacked text
                            const lineHeight = 20;
                            const startY = 25;

                            if (line1) {
                                context.fillText(line1, 12, startY);
                            }
                            if (line2) {
                                context.fillText(line2, 12, startY + lineHeight);
                            }

                            // Simple label positioning - just move away from surface
                            const labelPosition = position.clone();
                            labelPosition.multiplyScalar(1.08); // Move labels further from dots

                            const texture = new THREE.CanvasTexture(canvas);
                            const labelMat = new THREE.SpriteMaterial({
                                map: texture,
                                transparent: true,
                                opacity: 1.0
                            });
                            const label = new THREE.Sprite(labelMat);
                            label.position.copy(labelPosition);
                            label.scale.set(1.4, 0.42, 1); // Adjusted scale for taller stacked labels
                            label.userData = {
                                isMarker: true,
                                parentArc: arc,
                                originalOpacity: 1.0
                            };
                            group.add(label);
                            animatedArcs.push(label);
                        };

                        // Extract detailed address components and add labels
                        const originAddress = formatDetailedAddress(shipment.origin);
                        const destAddress = formatDetailedAddress(shipment.destination);

                        if (originAddress && originAddress.formatted && originAddress.formatted.length < 50) {
                            // Create structured address data for the label function
                            const originData = {
                                street: originAddress.street,
                                city: originAddress.city,
                                stateProvince: originAddress.stateProvince,
                                formatted: originAddress.formatted
                            };
                            addCityLabel(startVec, originData, 0xffffff); // White label for origin
                        }
                        if (destAddress && destAddress.formatted && destAddress.formatted.length < 50) {
                            // Create structured address data for the label function
                            const destData = {
                                street: destAddress.street,
                                city: destAddress.city,
                                stateProvince: destAddress.stateProvince,
                                formatted: destAddress.formatted
                            };
                            addCityLabel(endVec, destData, 0xffffff); // White label for destination
                        }

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
                                shipmentId: shipment.id
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
                                shipmentId: shipment.id
                            };
                            group.add(trailParticle);
                            animatedParticles.push(trailParticle);
                        }

                        // City labels are now added inline with markers above
                    } else {
                        console.warn(`❌ Skipping shipment ${shipment.id} - missing coordinates:`, {
                            originCoords,
                            destCoords,
                            origin: shipment.origin,
                            destination: shipment.destination
                        });
                    }
                } catch (error) {
                    console.error(`❌ Error processing shipment ${shipment.id}:`, error);
                }
            }

            // Store references for animation loop
            scene.userData.animatedArcs = animatedArcs;
            scene.userData.animatedParticles = animatedParticles;

            console.log(`✅ Created ${animatedArcs.length} futuristic arcs, ${animatedParticles.length} particles`);
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
                        { key: 'pending', label: 'Awaiting Shipment', color: '#FFA726', value: statusCounts.pending || statusCounts.awaitingShipment || 0 },
                        { key: 'transit', label: 'In Transit', color: '#42A5F5', value: statusCounts.transit || statusCounts.inTransit || 0 },
                        { key: 'delivered', label: 'Delivered', color: '#66BB6A', value: statusCounts.delivered || 0 },
                        { key: 'delayed', label: 'Delayed', color: '#F44336', value: statusCounts.delayed || 0 }
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

            {/* Fullscreen Button - Only show when NOT in fullscreen */}
            {!isFullScreen && (
                <Box sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    zIndex: 6
                }}>
                    <Box
                        onClick={toggleFullScreen}
                        sx={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: '8px',
                            padding: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                background: 'rgba(0, 0, 0, 0.5)',
                                transform: 'scale(1.05)'
                            }
                        }}
                    >
                        <Typography sx={{ color: 'white', fontSize: '0.75rem', textAlign: 'center' }}>
                            ⛶
                        </Typography>
                    </Box>
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
