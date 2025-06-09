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

// Earth textures - using local hosted images to avoid CORS issues
const EARTH_TEXTURES = {
    day: '/textures/land_ocean_ice_8192.png', // High-resolution NASA Earth Observatory texture
    normal: '/textures/planets/earth_normal_2048.jpg', // Normal map for terrain relief
    clouds: '/textures/planets/earth_clouds_1024.png',
    ocean: '/textures/planets/earth_specular_2048.jpg',
    nightLights: '/textures/planets/earth_lights_2048.jpg' // Will create programmatically if needed
};

// Create a simple night lights texture programmatically as fallback
const createFallbackNightLights = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Create a black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add some random bright spots for cities
    ctx.fillStyle = '#ffff88';
    for (let i = 0; i < 1000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 2 + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Convert to texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
};

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

                // Franky's setup
                THREE.ColorManagement.enabled = true;
                scene = new THREE.Scene();
                camera = new THREE.PerspectiveCamera(45, actualWidth / actualHeight, 1, 1000);
                camera.position.set(0, 0, 30);
                camera.lookAt(0, 0, 0); // Ensure camera is looking at origin

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

                // Add OrbitControls
                controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.05;
                controls.minDistance = 15; // Minimum zoom
                controls.maxDistance = 100; // Maximum zoom
                controls.target.set(0, 0, 0); // Look at globe center

                // Uniform daylight lighting optimized for bump mapping visibility
                const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
                directionalLight.position.set(50, 25, 50); // Angled for better bump map shadows
                scene.add(directionalLight);

                // Moderate ambient light to show bump details while keeping visibility
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
                scene.add(ambientLight);

                // Add neutral environment for PBR material to prevent black appearance
                const pmremGenerator = new THREE.PMREMGenerator(renderer);
                const neutralEnv = pmremGenerator.fromScene(new THREE.Scene(), 0.04).texture;
                scene.environment = neutralEnv;
                pmremGenerator.dispose();

                // Create group - Franky's exact setup
                group = new THREE.Group();
                group.rotation.z = 23.5 / 360 * 2 * Math.PI; // Earth's axial tilt

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

                const [albedoMap, normalMap, cloudsMap, oceanMap, nightLightsMap] = await Promise.all([
                    loadTextureWithFallback(EARTH_TEXTURES.day),
                    loadTextureWithFallback(EARTH_TEXTURES.normal),
                    loadTextureWithFallback(EARTH_TEXTURES.clouds),
                    loadTextureWithFallback(EARTH_TEXTURES.ocean),
                    loadTextureWithFallback(EARTH_TEXTURES.nightLights, createFallbackNightLights)
                ]);

                albedoMap.colorSpace = THREE.SRGBColorSpace;

                // Debug texture loading
                console.log('✅ All Earth textures loaded successfully');
                console.log('🗻 Normal map dimensions:', normalMap.image?.width, 'x', normalMap.image?.height);
                console.log('🌍 Albedo map dimensions:', albedoMap.image?.width, 'x', albedoMap.image?.height);

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

                // Create Earth - Enhanced material for proper bump mapping following Franky's approach
                const earthGeo = new THREE.SphereGeometry(10, 64, 64);
                earthGeo.computeBoundingSphere();

                // Use MeshStandardMaterial with proper normal mapping for terrain relief
                const earthMat = new THREE.MeshStandardMaterial({
                    map: albedoMap,
                    normalMap: normalMap,  // Use as normal map for terrain relief
                    normalScale: new THREE.Vector2(1.5, 1.5), // Amplify normal map effect for visible terrain
                    roughness: 0.7,  // Add some surface roughness for realism
                    metalness: 0.0   // Earth surface is not metallic
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
                clouds.renderOrder = 1;
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

                console.log('✅ Globe initialized with Franky\'s realistic Earth implementation');
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

                    // Rotate entire group (Earth, clouds, and all arcs together)
                    group.rotateY(interval * 0.005 * params.speedFactor);

                    // Additional cloud rotation for dynamic effect
                    clouds.rotateY(interval * 0.005 * params.speedFactor);

                    // Animate futuristic shooting arcs
                    if (scene.userData.animatedArcs) {
                        scene.userData.animatedArcs.forEach(arc => {
                            if (arc.userData.isGlowArc) {
                                // Animate glow arc
                                const parentArc = arc.userData.parentArc;
                                if (parentArc && parentArc.userData) {
                                    const pulseValue = Math.sin(time * 8) * 0.2 + 0.8;
                                    arc.material.opacity = arc.userData.originalOpacity * pulseValue;
                                }
                            } else if (arc.userData.isAnimatedArc) {
                                // Sequential shooting animation with waves
                                const animTime = (time * 1000) - arc.userData.animationDelay;

                                if (animTime > 0) {
                                    // Wave animation along arc
                                    arc.userData.animationPhase += arc.userData.shootingSpeed;

                                    // Create traveling wave effect
                                    const wavePosition = (arc.userData.animationPhase % 1.0);
                                    const waveIntensity = Math.sin(wavePosition * Math.PI) * 0.6 + 0.4;

                                    // Pulsing base intensity
                                    const pulseValue = Math.sin(time * arc.userData.pulseSpeed * 8) * 0.3 + 0.7;

                                    // Combine wave and pulse for futuristic effect
                                    arc.material.opacity = arc.userData.originalOpacity * pulseValue * waveIntensity;

                                    // Enhanced glow for in-transit shipments
                                    if (arc.userData.status?.toLowerCase() === 'in_transit') {
                                        arc.material.opacity *= 1.4; // Much brighter for active shipments

                                        // Add color shifting for active routes
                                        const colorShift = Math.sin(time * 6) * 0.1 + 0.9;
                                        arc.material.color.setHSL(0.6, 1.0, colorShift * 0.8);
                                    }
                                } else {
                                    // Before animation starts, keep dim
                                    arc.material.opacity = arc.userData.originalOpacity * 0.1;
                                }
                            }
                        });
                    }

                    // Markers are now tiny and static - no animation needed

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

                        // Create futuristic animated arc with glow effect
                        const geometry = new THREE.BufferGeometry().setFromPoints(points);

                        // Main arc line with futuristic glow
                        const material = new THREE.LineBasicMaterial({
                            color: getStatusColor(shipment.status),
                            opacity: 0.9,
                            transparent: true,
                            linewidth: 3
                        });
                        const arc = new THREE.Line(geometry, material);

                        // Add sequential animation delay for "shooting" effect
                        const animationDelay = index * 200 + Math.random() * 500; // Stagger animations
                        const shootingSpeed = 0.01 + Math.random() * 0.005; // Variable shooting speeds

                        arc.userData = {
                            isAnimatedArc: true,
                            originalOpacity: 0.9,
                            pulseSpeed: 0.03 + Math.random() * 0.02,
                            status: shipment.status,
                            shipmentId: shipment.id,
                            animationDelay: animationDelay,
                            shootingSpeed: shootingSpeed,
                            animationPhase: 0, // For wave animation along arc
                            curve: curve,
                            points: points
                        };
                        group.add(arc); // Add to rotating Earth group
                        animatedArcs.push(arc);

                        // Create secondary glow arc for futuristic effect
                        const glowMaterial = new THREE.LineBasicMaterial({
                            color: getStatusColor(shipment.status),
                            opacity: 0.3,
                            transparent: true,
                            linewidth: 6
                        });
                        const glowArc = new THREE.Line(geometry.clone(), glowMaterial);
                        glowArc.userData = {
                            isGlowArc: true,
                            parentArc: arc,
                            originalOpacity: 0.3
                        };
                        group.add(glowArc);
                        animatedArcs.push(glowArc);

                        // Create tiny endpoint markers (much smaller)
                        const originGeo = new THREE.SphereGeometry(0.02, 6, 6); // Tiny markers
                        const originMat = new THREE.MeshBasicMaterial({
                            color: 0x00ffaa,
                            transparent: true,
                            opacity: 0.8
                        });
                        const originMarker = new THREE.Mesh(originGeo, originMat);
                        originMarker.position.copy(startVec);
                        group.add(originMarker);

                        const destGeo = new THREE.SphereGeometry(0.02, 6, 6); // Tiny markers
                        const destMat = new THREE.MeshBasicMaterial({
                            color: getStatusColor(shipment.status),
                            transparent: true,
                            opacity: 0.8
                        });
                        const destMarker = new THREE.Mesh(destGeo, destMat);
                        destMarker.position.copy(endVec);
                        group.add(destMarker);

                        // Add animated particles for in-transit shipments
                        if (shipment.status?.toLowerCase() === 'in_transit') {
                            const particleGeo = new THREE.SphereGeometry(0.03, 8, 8);
                            const particleMat = new THREE.MeshBasicMaterial({
                                color: 0xffffff,
                                transparent: true,
                                opacity: 0.9
                            });
                            const particle = new THREE.Mesh(particleGeo, particleMat);
                            particle.position.copy(startVec);
                            particle.userData = {
                                isMovingParticle: true,
                                curve: curve,
                                progress: Math.random() * 0.3, // Start at different positions
                                speed: 0.005 + Math.random() * 0.003,
                                shipmentId: shipment.id
                            };
                            group.add(particle); // Add to rotating Earth group
                            animatedParticles.push(particle);
                        }

                        // Add city labels for major hubs
                        if (distance > 5) { // Only for long-distance routes
                            const addCityLabel = (position, text, color = 0xffffff) => {
                                const canvas = document.createElement('canvas');
                                const context = canvas.getContext('2d');
                                canvas.width = 256;
                                canvas.height = 64;
                                context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
                                context.font = '20px Arial';
                                context.textAlign = 'center';
                                context.fillText(text, 128, 40);

                                const texture = new THREE.CanvasTexture(canvas);
                                const labelMat = new THREE.SpriteMaterial({
                                    map: texture,
                                    transparent: true,
                                    opacity: 0.7
                                });
                                const label = new THREE.Sprite(labelMat);
                                label.position.copy(position);
                                label.position.multiplyScalar(1.15); // Place outside atmosphere
                                label.scale.set(1.5, 0.375, 1);
                                group.add(label); // Add to rotating Earth group
                            };

                            // Extract city names
                            const originCity = extractLocationFromAddress(shipment.origin)?.city;
                            const destCity = extractLocationFromAddress(shipment.destination)?.city;

                            if (originCity && originCity.length < 15) {
                                addCityLabel(startVec, originCity, 0x00ff00);
                            }
                            if (destCity && destCity.length < 15) {
                                const statusColorHex = parseInt(getStatusColor(shipment.status).replace('#', ''), 16);
                                addCityLabel(endVec, destCity, statusColorHex);
                            }
                        }
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
    }, [width, height, shipments]);

    return (
        <Box className="globe-container" sx={{ position: 'relative', width, height }}>
            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
            {loading && (
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', color: 'white', zIndex: 10 }}>
                    <Typography>Loading realistic Earth...</Typography>
                </Box>
            )}
            {showOverlays && !loading && (
                <Box sx={{ position: 'absolute', top: 20, left: 20, display: 'flex', flexDirection: 'column', gap: 1, zIndex: 5 }}>
                    {Object.entries(statusCounts).map(([status, count]) => (
                        <Box key={status} sx={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(10px)', border: `2px solid ${getStatusColor(status)}`, borderRadius: '8px', padding: '6px 10px', minWidth: '110px', textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold', display: 'block' }}>
                                {status === 'all' ? 'Total' : status === 'pending' ? 'Pending' : status === 'in_transit' ? 'Transit' : status === 'delivered' ? 'Delivered' : status}
                            </Typography>
                            <Typography variant="h6" sx={{ color: getStatusColor(status), fontWeight: 'bold' }}>{count}</Typography>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default ShipmentGlobe; 
