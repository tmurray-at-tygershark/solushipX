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
    InputAdornment
} from '@mui/material';
import {
    Search as SearchIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { collection, query, orderBy, limit, onSnapshot, where, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';

import { loadGoogleMaps } from '../../utils/googleMapsLoader';
import StatusChip from '../StatusChip/StatusChip';
import './Globe.css';

// Calculates the sun's position based on the current date for realistic lighting.
const getSunPosition = (date) => {
    // Day of the year (1-365)
    const dayOfYear = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000;

    // Solar declination (approximate) - determines the sun's latitude
    const declination = -23.45 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));

    // Time of day in hours (UTC)
    const utcTime = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

    // Longitude of the sun. Noon (12:00 UTC) corresponds to longitude 0 (Prime Meridian).
    const sunLongitude = (utcTime - 12) * 15;

    const latRad = THREE.MathUtils.degToRad(declination);
    const lonRad = THREE.MathUtils.degToRad(sunLongitude);

    // A large distance simulates parallel rays from a distant sun
    const sunDistance = 150;

    // Convert from spherical (lat, lon) to Cartesian (x, y, z) coordinates
    const sunX = sunDistance * Math.cos(latRad) * Math.cos(lonRad);
    const sunY = sunDistance * Math.sin(latRad);
    const sunZ = sunDistance * Math.cos(latRad) * Math.sin(lonRad);

    // The globe model in this scene has an inverted Z-axis, so we must match it.
    return new THREE.Vector3(sunX, sunY, -sunZ);
};

// Component to handle carrier logo fetching and display
const CarrierLogo = ({ activeShipment }) => {
    const [carrierLogoURL, setCarrierLogoURL] = React.useState(null); // Start with null to prevent flash

    React.useEffect(() => {
        const fetchCarrierLogo = async () => {
            console.log('🚀 Starting fetchCarrierLogo for activeShipment:', activeShipment?.id);
            console.log('🔄 useEffect triggered with dependencies:', {
                shipmentId: activeShipment?.id,
                topLevelCarrier: activeShipment?.carrier,
                trackingDataCarrier: activeShipment?.carrierTrackingData?.carrier
            });

            // Reset to null while fetching to prevent flash
            setCarrierLogoURL(null);

            if (!activeShipment) {
                console.warn('❌ No activeShipment provided');
                return;
            }

            // Log the RAW carrierTrackingData to see what's actually there
            console.log('🔍 RAW carrierTrackingData object:', activeShipment.carrierTrackingData);
            console.log('🔍 RAW carrierTrackingData.rawData:', activeShipment.carrierTrackingData?.rawData);

            // Extract master carrier from carrierTrackingData.rawData.carrier
            const masterCarrier = activeShipment.carrierTrackingData?.rawData?.carrier;

            console.log('🔍 Carrier extraction debug:', {
                documentId: activeShipment.id,
                shipmentID: activeShipment.shipmentID,
                trackingNumber: activeShipment.trackingNumber,
                masterCarrier: masterCarrier,
                carrierTrackingDataExists: !!activeShipment.carrierTrackingData,
                rawDataExists: !!activeShipment.carrierTrackingData?.rawData,
                rawDataCarrier: activeShipment.carrierTrackingData?.rawData?.carrier
            });

            if (!masterCarrier) {
                console.warn('❌ No master carrier found in carrierTrackingData.rawData.carrier, using solushipx fallback');
                setCarrierLogoURL('/images/carrier-badges/solushipx.png');
                return;
            }

            // Convert master carrier to uppercase for database query
            const upperCaseCarrierID = masterCarrier.toUpperCase();

            console.log('🔍 Querying carriers collection:', {
                masterCarrier: masterCarrier,
                upperCaseCarrierID: upperCaseCarrierID,
                queryField: 'carrierID'
            });

            try {
                // Query carriers collection by carrierID field
                const carriersQuery = query(
                    collection(db, 'carriers'),
                    where('carrierID', '==', upperCaseCarrierID),
                    limit(1)
                );

                const carriersSnapshot = await getDocs(carriersQuery);

                if (!carriersSnapshot.empty) {
                    const carrierDoc = carriersSnapshot.docs[0];
                    const carrierData = carrierDoc.data();
                    const logoURL = carrierData.logoURL;
                    const logoFileName = carrierData.logoFileName;

                    console.log('✅ Found carrier in database:', {
                        documentId: carrierDoc.id,
                        carrierID: carrierData.carrierID,
                        logoURL: logoURL,
                        logoFileName: logoFileName,
                        carrierName: carrierData.carrierName || carrierData.name
                    });

                    if (logoURL) {
                        // Use the complete logoURL directly from the database
                        console.log('🖼️ Using database logoURL:', logoURL);
                        setCarrierLogoURL(logoURL);
                        return;
                    } else if (logoFileName) {
                        // Fallback: try to construct URL from logoFileName
                        let constructedURL;
                        if (logoFileName.startsWith('http://') || logoFileName.startsWith('https://')) {
                            constructedURL = logoFileName;
                        } else {
                            constructedURL = `/images/carrier-badges/${logoFileName}`;
                        }

                        console.log('🖼️ Using constructed logo URL:', constructedURL);
                        setCarrierLogoURL(constructedURL);
                        return;
                    } else {
                        console.warn('⚠️ Carrier found but no logoURL or logoFileName field');
                    }
                } else {
                    console.warn('❌ No carrier found with carrierID:', upperCaseCarrierID);
                }

            } catch (error) {
                console.error('🚨 Error querying carriers collection:', error);
            }

            // Fallback to solushipx logo if database query fails
            console.log('🔄 Using fallback logo: solushipx.png');
            setCarrierLogoURL('/images/carrier-badges/solushipx.png');
        };

        fetchCarrierLogo();
    }, [activeShipment?.id, activeShipment?.carrierTrackingData?.rawData?.carrier]);

    console.log('🖼️ Rendering CarrierLogo with URL:', carrierLogoURL);

    // Don't render anything if no URL is set (prevents flash)
    if (!carrierLogoURL) {
        return (
            <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.7rem'
            }}>
                Loading...
            </div>
        );
    }

    return (
        <img
            src={carrierLogoURL}
            alt="Carrier Logo"
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover', // Fill the entire container
                // filter: 'brightness(0) invert(1)', // Temporarily removed to test
            }}
            onLoad={(e) => {
                console.log('✅ Carrier logo loaded successfully:', e.target.src);
            }}
            onError={(e) => {
                console.error('🚨 Logo failed to load:', e.target.src);

                // Try different fallback strategies
                if (e.target.src.includes('firebasestorage.googleapis.com')) {
                    // Remote storage failed, try local eship.png
                    console.error('🚨 Remote storage failed, trying local eship logo');
                    const localEshipURL = '/images/carrier-badges/eship.png';
                    e.target.src = localEshipURL;
                    setCarrierLogoURL(localEshipURL);
                } else if (e.target.src.includes('eship.png') && !e.target.src.includes('solushipx')) {
                    // Local eship failed, try solushipx fallback
                    console.error('🚨 Local eship failed, trying solushipx fallback');
                    const fallbackURL = '/images/carrier-badges/solushipx.png';
                    e.target.src = fallbackURL;
                    setCarrierLogoURL(fallbackURL);
                } else if (!e.target.src.includes('solushipx')) {
                    // Any other failure, go straight to solushipx
                    console.error('🚨 Trying solushipx fallback');
                    const fallbackURL = '/images/carrier-badges/solushipx.png';
                    e.target.src = fallbackURL;
                    setCarrierLogoURL(fallbackURL);
                } else {
                    // Even solushipx failed, hide the image
                    console.error('🚨 All logo attempts failed, hiding image');
                    e.target.style.display = 'none';
                }
            }}
        />
    );
};



const geocodingCache = new Map();
const MAX_CACHE_SIZE = 100; // Limit cache to 100 entries to prevent memory growth

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

            // Implement cache size limit
            if (geocodingCache.size >= MAX_CACHE_SIZE) {
                const firstKey = geocodingCache.keys().next().value;
                geocodingCache.delete(firstKey);
            }
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

    // Implement cache size limit for fallback too
    if (geocodingCache.size >= MAX_CACHE_SIZE) {
        const firstKey = geocodingCache.keys().next().value;
        geocodingCache.delete(firstKey);
    }
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

// Earth textures - upgraded to 8K for stunning detail
const EARTH_TEXTURES = {
    day: '/textures/8k_earth_daymap.jpg', // 8K high-resolution Earth texture for incredible detail
    normal: '/textures/planets/earth_normal_2048.jpg', // Normal map for terrain relief  
    bump: '/textures/8k_earth_daymap.jpg', // Bump map using 8K texture for realistic surface details
    clouds: '/textures/planets/earth_clouds_1024.png'
    // Removed ocean/specular map to reduce memory usage
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

const ShipmentGlobe = React.forwardRef(({ width = 500, height = 600, showOverlays = true, statusCounts = {} }, ref) => {
    const mountRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const sceneRef = useRef(null);
    const [userInteracting, setUserInteracting] = useState(false);
    const isInitializedRef = useRef(false);
    const routesInitializedRef = useRef(false);
    const activeTimeoutsRef = useRef(new Set());
    const directionalLightRef = useRef(null);

    // Real-time data state
    const [realTimeShipments, setRealTimeShipments] = useState([]);
    const [realtimeStatusCounts, setRealtimeStatusCounts] = useState({});
    const { companyIdForAddress, companyLoading, company } = useCompany();

    // Enhanced UI features state
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [currentShipmentIndex, setCurrentShipmentIndex] = useState(0);
    const [activeShipment, setActiveShipment] = useState(null);
    const [isPaused, setIsPaused] = useState(false);
    const [manualNavigation, setManualNavigation] = useState(false);

    // Camera position references for region navigation (calibrated from user data)
    const defaultCameraPosition = { x: -8, y: 10, z: 16 };
    const regionPositions = {
        // North America - calibrated from user coordinates
        northAmerica: { x: -7.171, y: 12.491, z: 14.579, target: { x: 0, y: 0, z: 0 } },

        // Europe - user-provided calibrated coordinates
        europe: { x: 14.636, y: 14.485, z: -8.845, target: { x: 0, y: 0, z: 0 } },

        // Asia - user-provided calibrated coordinates (China)
        asia: { x: 3.746, y: 10.485, z: -15.731, target: { x: 0, y: 0, z: 0 } },

        // South America - user-provided calibrated coordinates
        southAmerica: { x: 2.385, y: -3.911, z: 18.720, target: { x: 0, y: 0, z: 0 } }
    };

    // Globe is self-sufficient - uses only its own enhanced query with carrier tracking data
    const shipments = realTimeShipments;

    // Helper function to create managed timeouts that get cleaned up on unmount
    const createManagedTimeout = useCallback((callback, delay) => {
        const timeoutId = setTimeout(() => {
            activeTimeoutsRef.current.delete(timeoutId);
            if (isMountedRef.current) {
                callback();
            }
        }, delay);

        activeTimeoutsRef.current.add(timeoutId);
        return timeoutId;
    }, []);

    // Moved to component scope to be accessible by all effects
    const addShipmentRoutes = useCallback(async (scene, shipments) => {
        console.log(`📦 Total shipments received:`, shipments.length);

        const group = scene.children.find(child => child.type === 'Group');
        if (!group) {
            console.error("❌ Could not find the main group to add routes to.");
            return;
        }

        const validShipments = shipments.filter(s => {
            const status = s.status?.toLowerCase();
            return status && status !== 'draft' && status !== 'cancelled' && status !== 'void';
        });
        console.log(`🚚 Valid shipments (non-draft/cancelled/void):`, validShipments.length);

        // Arrays to track animated objects for the animation loop
        const animatedArcs = [];
        const animatedParticles = [];

        scene.userData.animatedArcs = animatedArcs;
        scene.userData.animatedParticles = animatedParticles;
        scene.userData.totalShipments = validShipments.length;
        scene.userData.currentShipmentIndex = 0;
        scene.userData.isProcessingShipments = true;
        scene.userData.maxDelay = validShipments.length * 4000;

        // ROBUST PROCESSING: Use an async loop instead of a fragile setTimeout chain
        const processAllShipments = async () => {
            for (const [index, shipment] of validShipments.entries()) {
                try {
                    console.log(`🔍 Processing shipment ${index + 1}/${validShipments.length}: ${shipment.id}`);

                    const originCoords = await getCityCoordinates(shipment.origin);
                    const destCoords = await getCityCoordinates(shipment.destination);

                    if (originCoords && destCoords) {
                        const startVec = latLngToVector3(originCoords.lat, originCoords.lng, 10.05);
                        const endVec = latLngToVector3(destCoords.lat, destCoords.lng, 10.05);
                        const distance = startVec.distanceTo(endVec);

                        const arcHeight = Math.max(2, distance * 0.5);
                        const mid = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
                        mid.normalize().multiplyScalar(10 + arcHeight);

                        const curve = new THREE.QuadraticBezierCurve3(startVec, mid, endVec);
                        const points = curve.getPoints(100);

                        const trailLength = 25;
                        const trailPoints = new Array(trailLength).fill().map(() => startVec.clone());
                        const trailCurve = new THREE.CatmullRomCurve3(trailPoints);
                        const tubeRadius = 0.02;
                        const tubularSegments = trailLength - 1;
                        const radialSegments = 8;
                        const trailGeometry = new THREE.TubeGeometry(trailCurve, tubularSegments, tubeRadius, radialSegments, false);

                        const material = new THREE.MeshStandardMaterial({
                            color: getStatusColor(shipment.status),
                            opacity: 0, // Start fully transparent, fade in during animation
                            transparent: true,
                            emissive: new THREE.Color(getStatusColor(shipment.status)),
                            emissiveIntensity: 0.3,
                            roughness: 0.5,
                            metalness: 0.1
                        });
                        const arc = new THREE.Mesh(trailGeometry, material);

                        // --- NEW SEQUENTIAL TIMING LOGIC ---
                        const TRAVEL_DURATION = 2000; // 2.0 seconds for the arc to travel
                        const HOLD_DURATION = 3000;   // 3.0 seconds to hold the full arc
                        const FADE_DURATION = 500;    // 0.5 seconds to fade out
                        const SINGLE_CYCLE_DURATION = TRAVEL_DURATION + HOLD_DURATION + FADE_DURATION;

                        const animationStartDelay = index * SINGLE_CYCLE_DURATION; // Each animation starts after the previous one *completely* finishes
                        const currentTime = performance.now();

                        arc.userData = {
                            isAnimatedArc: true,
                            originalOpacity: 0.95,
                            status: shipment.status,
                            shipmentId: shipment.shipmentID || shipment.shipmentId || shipment.id,
                            animationStartTime: currentTime + animationStartDelay,
                            originalDelay: animationStartDelay,
                            curve: curve,
                            points: points,
                            trailLength: trailLength,
                            progress: 0,
                            badgeSynced: false,
                            shipmentData: shipment,
                            sequentialIndex: index,
                            // Store new timing constants
                            TRAVEL_DURATION,
                            HOLD_DURATION,
                            FADE_DURATION,
                            SINGLE_CYCLE_DURATION
                        };
                        group.add(arc);
                        animatedArcs.push(arc);

                        const originGeo = new THREE.SphereGeometry(0.04, 8, 8);
                        const originMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.9 });
                        const originMarker = new THREE.Mesh(originGeo, originMat);
                        originMarker.position.copy(startVec);
                        originMarker.userData = { isMarker: true, parentArc: arc, originalOpacity: 0.9 };
                        group.add(originMarker);

                        const destGeo = new THREE.SphereGeometry(0.04, 8, 8);
                        const destMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.9 });
                        const destMarker = new THREE.Mesh(destGeo, destMat);
                        destMarker.position.copy(endVec);
                        destMarker.userData = { isMarker: true, parentArc: arc, originalOpacity: 0.9 };
                        group.add(destMarker);

                        animatedArcs.push(originMarker, destMarker);

                        if (shipment.status?.toLowerCase() === 'in_transit') {
                            const particleGeo = new THREE.SphereGeometry(0.12, 12, 12);
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
                                progress: Math.random() * 0.3,
                                speed: 0.008 + Math.random() * 0.004,
                                shipmentId: shipment.shipmentID || shipment.shipmentId || shipment.id,
                                sequentialIndex: index
                            };
                            group.add(particle);
                            animatedParticles.push(particle);

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
                                speed: 0.006 + Math.random() * 0.003,
                                shipmentId: shipment.shipmentID || shipment.shipmentId || shipment.id,
                                sequentialIndex: index
                            };
                            group.add(trailParticle);
                            animatedParticles.push(trailParticle);
                        }
                    } else {
                        console.warn(`❌ Skipping shipment ${shipment.id} - missing coordinates.`);
                    }
                } catch (error) {
                    console.error(`❌ Error processing shipment ${shipment.id}:`, error);
                }
            }
            console.log(`✅ All ${validShipments.length} shipments processed.`);
            if (scene.userData) {
                scene.userData.isProcessingShipments = false;
            }
        };

        processAllShipments();

    }, [createManagedTimeout]);

    const animateCameraTo = useCallback((position, target = { x: 0, y: 0, z: 0 }, duration = 1500) => {
        if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;
        const camera = cameraRef.current;
        const controls = camera.userData?.controls;
        if (controls) controls.enabled = false;

        const startPosition = camera.position.clone();
        const startTarget = controls ? controls.target.clone() : new THREE.Vector3();
        const startTime = performance.now();

        const animateFrame = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);

            camera.position.lerpVectors(startPosition, position, easedProgress);
            if (controls) {
                controls.target.lerpVectors(startTarget, target, easedProgress);
                controls.update();
            }

            if (progress < 1) {
                requestAnimationFrame(animateFrame);
            } else {
                if (controls) controls.enabled = true;
            }
        };
        animateFrame();
    }, []);

    const resetView = useCallback(() => {
        animateCameraTo(defaultCameraPosition, new THREE.Vector3(0, 0, 0));
        setUserInteracting(false);
    }, [animateCameraTo, defaultCameraPosition]);

    const goToNorthAmerica = useCallback(() => animateCameraTo(regionPositions.northAmerica, new THREE.Vector3(0, 0, 0)), [animateCameraTo, regionPositions.northAmerica]);
    const goToEurope = useCallback(() => animateCameraTo(regionPositions.europe, new THREE.Vector3(0, 0, 0)), [animateCameraTo, regionPositions.europe]);
    const goToAsia = useCallback(() => animateCameraTo(regionPositions.asia, new THREE.Vector3(0, 0, 0)), [animateCameraTo, regionPositions.asia]);
    const goToSouthAmerica = useCallback(() => animateCameraTo(regionPositions.southAmerica, new THREE.Vector3(0, 0, 0)), [animateCameraTo, regionPositions.southAmerica]);

    const handleResume = useCallback(() => {
        setIsSearchMode(false);
        setSearchTerm('');
        setActiveShipment(null);
        setIsPaused(false);
        setManualNavigation(false);
        setUserInteracting(false);
    }, []);

    const toggleFullScreen = useCallback(() => {
        setIsFullScreen(prev => !prev);
    }, []);

    // Expose imperative methods to the parent component
    React.useImperativeHandle(ref, () => ({
        resetView,
        toggleFullScreen,
    }));

    // Shared Region Navigation Component to avoid duplication
    const RegionNavigationButtons = ({ isFullscreenMode = false }) => (
        <Box sx={{
            position: 'absolute',
            bottom: isFullscreenMode ? '24px' : { xs: '1rem', sm: '1.5rem', md: '2rem' }, // Use responsive rem units for consistent spacing
            left: isFullscreenMode ? '24px' : { xs: '1rem', sm: '1.5rem', md: '2rem' }, // Use responsive rem units for consistent spacing
            zIndex: isFullscreenMode ? 10001 : 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            alignItems: 'flex-start'
        }}>
            {[
                { label: 'North America', action: goToNorthAmerica },
                { label: 'Europe', action: goToEurope },
                { label: 'Asia', action: goToAsia },
                { label: 'South America', action: goToSouthAmerica }
            ].map((region, index) => (
                <Button
                    key={region.label}
                    onClick={region.action}
                    size="small"
                    sx={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(20px)',
                        color: 'white',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        padding: '4px 12px',
                        minWidth: 'auto',
                        height: '28px',
                        borderRadius: '14px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        textTransform: 'none',
                        '&:hover': {
                            background: 'rgba(255, 255, 255, 0.1)',
                            transform: 'translateX(4px)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        },
                        transition: 'all 0.3s ease'
                    }}
                >
                    {region.label}
                </Button>
            ))}
        </Box>
    );

    // Track if component is mounted
    const isMountedRef = useRef(true);

    // Store resize handler for cleanup
    const resizeHandlerRef = useRef(null);

    // Real-time shipment data listener with carrier tracking data
    useEffect(() => {
        if (!companyIdForAddress || companyLoading) {
            return;
        }

        if (isMountedRef.current) {
            console.log('🌍 Globe: Setting up independent enhanced real-time shipment listener for company:', companyIdForAddress);
        }

        // Calculate date range for last 30 days to get comprehensive data for the globe
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateFilter = Timestamp.fromDate(thirtyDaysAgo);

        const shipmentsQuery = query(
            collection(db, 'shipments'),
            where('companyID', '==', companyIdForAddress),
            where('createdAt', '>=', dateFilter),
            orderBy('createdAt', 'desc'),
            limit(100) // Increased limit for comprehensive globe display
        );

        const unsubscribe = onSnapshot(shipmentsQuery, async (snapshot) => {
            // Check if component is still mounted before logging
            if (!isMountedRef.current) {
                return;
            }

            console.log('🌍 Globe: Received real-time shipments update:', {
                snapshotSize: snapshot.docs.length,
                companyId: companyIdForAddress,
                dateFilter: dateFilter.toDate().toISOString(),
                queryPath: 'shipments collection'
            });

            // Log first few shipment documents for debugging
            if (snapshot.docs.length > 0 && isMountedRef.current) {
                console.log('🌍 Globe: Sample shipment documents:', snapshot.docs.slice(0, 3).map(doc => ({
                    id: doc.id,
                    data: {
                        shipmentID: doc.data().shipmentID,
                        companyID: doc.data().companyID,
                        status: doc.data().status,
                        createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || 'No createdAt'
                    }
                })));
            }

            // Enhanced shipment processing - carrierTrackingData is a direct field, not subcollection
            const shipmentsData = snapshot.docs.map((doc) => {
                const data = doc.data();
                const shipmentId = doc.id;

                // carrierTrackingData is already in the document data - no subcollection query needed!
                const carrierTrackingData = data.carrierTrackingData;

                if (isMountedRef.current) {
                    console.log(`🔍 Globe: Processing shipment ${shipmentId}:`, {
                        hasCarrierTrackingData: !!carrierTrackingData,
                        hasRawData: !!carrierTrackingData?.rawData,
                        masterCarrier: carrierTrackingData?.rawData?.carrier,
                        carrierName: carrierTrackingData?.carrierName
                    });
                }

                // Debug the shipment structure being created
                const shipmentObject = {
                    id: shipmentId, // This is the Firestore document ID
                    documentId: shipmentId, // Explicitly store document ID
                    shipmentID: data.shipmentID, // This is the shipment ID field from the document
                    trackingNumber: data.trackingNumber || data.shipmentID || shipmentId,
                    ...data,
                    // carrierTrackingData is already included in ...data spread
                    // Ensure address fields are properly mapped
                    origin: data.shipFrom || data.origin,
                    destination: data.shipTo || data.destination,
                };

                if (isMountedRef.current) {
                    console.log(`🔍 Globe: Created shipment object for ${shipmentId}:`, {
                        documentId: shipmentObject.documentId,
                        shipmentID: shipmentObject.shipmentID,
                        trackingNumber: shipmentObject.trackingNumber,
                        hasCarrierData: !!shipmentObject.carrierTrackingData,
                        carrierFromData: shipmentObject.carrierTrackingData?.rawData?.carrier
                    });
                }

                return shipmentObject;
            });

            // Filter valid shipments
            const validShipments = shipmentsData.filter(shipment => {
                // Only include shipments with valid addresses and exclude drafts, cancelled, and void shipments
                const status = shipment.status?.toLowerCase();
                return status !== 'draft' &&
                    status !== 'cancelled' &&
                    status !== 'void' &&
                    shipment.origin &&
                    shipment.destination;
            });

            // Calculate real-time status counts (excluding cancelled/void)
            const statusCounts = validShipments.reduce((counts, shipment) => {
                const status = shipment.status?.toLowerCase();
                // Skip cancelled and void shipments
                if (status === 'cancelled' || status === 'void') {
                    return counts;
                }

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

            // Only update state if component is still mounted
            if (isMountedRef.current) {
                setRealTimeShipments(validShipments);
                setRealtimeStatusCounts(statusCounts);

                console.log('🌍 Globe: Independently processed shipments with enhanced carrier data:', {
                    total: snapshot.docs.length,
                    valid: validShipments.length,
                    withCarrierData: validShipments.filter(s => s.carrierTrackingData).length,
                    eShipPlusDetected: validShipments.filter(s => s.carrierTrackingData?.rawData?.carrier === 'eshipplus').length,
                    dateRange: '30 days',
                    isIndependent: true
                });
            }
        }, (error) => {
            if (isMountedRef.current) {
                console.error('🌍 Globe: Error in real-time shipments listener:', error);
            }
        });

        return () => unsubscribe();
    }, [companyIdForAddress, companyLoading]);

    // Loading state handling for independent Globe
    useEffect(() => {
        if (!isMountedRef.current) return;

        if (companyLoading) {
            console.log('🌍 Globe: Waiting for company data...');
            setLoading(true);
        } else if (!companyIdForAddress) {
            console.log('⚠️ Globe: No company ID available');
            setLoading(false);
            setRealTimeShipments([]);
        } else if (realTimeShipments.length === 0) {
            console.log('🌍 Globe: No shipments available yet, but ready to receive data');
        }
    }, [companyLoading, companyIdForAddress, realTimeShipments.length]);



    useEffect(() => {
        let scene, camera, renderer, controls, earth, clouds, atmosphere, group, animationId;

        const initializeGlobe = async () => {
            if (isInitializedRef.current) {
                console.log('⚠️ Skipping duplicate initialization');
                return;
            }
            isInitializedRef.current = true;

            console.log('🔄 Cleared geocoding cache for fresh coordinates');
            geocodingCache.clear();

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

                const containerRect = mountRef.current?.getBoundingClientRect();
                const containerWidth = containerRect?.width || mountRef.current?.offsetWidth || mountRef.current?.clientWidth;
                const containerHeight = containerRect?.height || mountRef.current?.offsetHeight || mountRef.current?.clientHeight;

                const actualWidth = containerWidth > 0 ? containerWidth :
                    (mountRef.current?.parentElement?.offsetWidth || width || 800);
                const actualHeight = containerHeight > 0 ? containerHeight :
                    (mountRef.current?.parentElement?.offsetHeight || height || 600);

                console.log('🎯 Canvas setup:', {
                    actualWidth,
                    actualHeight,
                });

                THREE.ColorManagement.enabled = true;
                scene = new THREE.Scene();
                sceneRef.current = scene;
                camera = new THREE.PerspectiveCamera(45, actualWidth / actualHeight, 1, 1000);
                camera.position.set(-8, 10, 16);
                camera.lookAt(0, 0, 0);

                renderer = new THREE.WebGLRenderer({
                    antialias: true,
                    alpha: true,
                    preserveDrawingBuffer: true
                });
                renderer.setSize(actualWidth, actualHeight);
                renderer.outputColorSpace = THREE.SRGBColorSpace;
                renderer.setClearColor(0x000000, 1);
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

                rendererRef.current = renderer;
                cameraRef.current = camera;

                renderer.domElement.style.display = 'block';
                renderer.domElement.style.width = '100%';
                renderer.domElement.style.height = '100%';
                mountRef.current.appendChild(renderer.domElement);

                controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.08;
                controls.minDistance = 10.5;
                controls.maxDistance = 50;
                controls.target.set(0, 0, 0);
                controls.rotateSpeed = 0.4;
                controls.zoomSpeed = 1.2;
                controls.panSpeed = 1.0;
                controls.autoRotate = false;

                controls.addEventListener('start', () => {
                    if (isMountedRef.current) setUserInteracting(true);
                });

                camera.userData = { controls: controls };

                let resizeTimeout;
                const handleResize = () => {
                    if (!mountRef.current || !renderer || !camera) return;

                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => {
                        const containerRect = mountRef.current.getBoundingClientRect();
                        const newWidth = containerRect.width;
                        const newHeight = containerRect.height;

                        camera.aspect = newWidth / newHeight;
                        camera.updateProjectionMatrix();
                        renderer.setSize(newWidth, newHeight);
                        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                        renderer.render(scene, camera);
                    }, 150);
                };

                window.addEventListener('resize', handleResize);

                let resizeObserver;
                if (window.ResizeObserver && mountRef.current) {
                    resizeObserver = new ResizeObserver(handleResize);
                    resizeObserver.observe(mountRef.current);
                }

                resizeHandlerRef.current = { handleResize, resizeObserver };

                // A soft, neutral ambient light to ensure the dark side is not completely black
                const ambientLight = new THREE.AmbientLight(0x404040, 0.7);
                scene.add(ambientLight);

                // This directional light simulates the sun. Its position is updated in real-time.
                const directionalLight = new THREE.DirectionalLight(0xffffff, 2.8);
                directionalLightRef.current = directionalLight; // Store ref to update in animate loop
                scene.add(directionalLight);

                const pmremGenerator = new THREE.PMREMGenerator(renderer);
                scene.environment = pmremGenerator.fromScene(new THREE.Scene(), 0.04).texture;
                pmremGenerator.dispose();

                group = new THREE.Group();
                group.rotation.y = -0.3;

                const textureLoader = new THREE.TextureLoader();
                const [dayMap, normalMap, bumpMap, cloudsMap] = await Promise.all([
                    textureLoader.loadAsync(EARTH_TEXTURES.day),
                    textureLoader.loadAsync(EARTH_TEXTURES.normal),
                    textureLoader.loadAsync(EARTH_TEXTURES.bump),
                    textureLoader.loadAsync(EARTH_TEXTURES.clouds)
                ]);
                dayMap.colorSpace = THREE.SRGBColorSpace;

                const earthGeo = new THREE.SphereGeometry(10, 64, 64);
                const earthMat = new THREE.MeshStandardMaterial({
                    map: dayMap,
                    normalMap: normalMap,
                    bumpMap: bumpMap,
                    bumpScale: 0.4,
                    roughness: 0.7,
                    metalness: 0.05,
                    envMapIntensity: 0.4,
                    normalScale: new THREE.Vector2(1.2, 1.2),
                });
                earth = new THREE.Mesh(earthGeo, earthMat);
                group.add(earth);

                const cloudGeo = new THREE.SphereGeometry(10.1, 32, 32);
                const cloudsMat = new THREE.MeshLambertMaterial({
                    map: cloudsMap,
                    transparent: true,
                    opacity: 0.3,
                    depthWrite: false,
                });
                clouds = new THREE.Mesh(cloudGeo, cloudsMat);
                group.add(clouds);

                const atmosGeo = new THREE.SphereGeometry(12.5, 64, 64);
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
                group.add(atmosphere);

                scene.add(group);

                if (shipments && shipments.length > 0) {
                    await addShipmentRoutes(scene, shipments);
                    routesInitializedRef.current = true;
                }

                setLoading(false);

                const animate = () => {
                    animationId = requestAnimationFrame(animate);
                    controls.update();
                    const time = performance.now();

                    // Update sun position for real-time day/night cycle
                    if (directionalLightRef.current) {
                        directionalLightRef.current.position.copy(getSunPosition(new Date()));
                    }

                    if (!userInteracting) {
                        clouds.rotateY(0.0001 * params.speedFactor);
                    }

                    if (scene.userData.animatedArcs && !isPaused) {
                        let maxAnimationTime = scene.userData.maxAnimationTime || 0;
                        if (maxAnimationTime === 0 && scene.userData.animatedArcs.length > 0) {
                            scene.userData.animatedArcs.forEach(arc => {
                                if (!arc.userData.isMarker) {
                                    maxAnimationTime = Math.max(maxAnimationTime, arc.userData.animationStartTime + arc.userData.SINGLE_CYCLE_DURATION);
                                }
                            });
                            scene.userData.maxAnimationTime = maxAnimationTime;
                        }

                        if (maxAnimationTime > 0 && time > maxAnimationTime) {
                            const cycleStartTime = time;
                            scene.userData.animatedArcs.forEach(arc => {
                                if (!arc.userData.isMarker) {
                                    arc.userData.animationStartTime = cycleStartTime + arc.userData.originalDelay;
                                    arc.userData.animationComplete = false;
                                    arc.userData.badgeSynced = false;
                                    arc.userData.fullArcGeometryCreated = false;
                                }
                            });
                            scene.userData.maxAnimationTime = 0;
                        }

                        scene.userData.animatedArcs.forEach(arc => {
                            if (arc.userData.isMarker) {
                                const parentArc = arc.userData.parentArc;
                                arc.visible = parentArc ? parentArc.visible : false;
                                return;
                            }

                            const { animationStartTime, TRAVEL_DURATION, HOLD_DURATION, FADE_DURATION, SINGLE_CYCLE_DURATION, curve, trailLength } = arc.userData;
                            const timeSinceStart = time - animationStartTime;

                            if (timeSinceStart >= 0 && timeSinceStart <= SINGLE_CYCLE_DURATION) {
                                arc.visible = true;
                                const progress = Math.min(timeSinceStart / TRAVEL_DURATION, 1.0);

                                // Sync badge as soon as animation starts
                                if (progress > 0 && !arc.userData.badgeSynced) {
                                    arc.userData.badgeSynced = true;
                                    setActiveShipment(arc.userData.shipmentData);
                                    setCurrentShipmentIndex(arc.userData.sequentialIndex);
                                }

                                // Phase 1: Travel (Fade in and shoot across)
                                if (timeSinceStart <= TRAVEL_DURATION) {
                                    const newTrailPoints = [];
                                    for (let i = 0; i < trailLength; i++) {
                                        const trailProgress = Math.max(0, progress - (i * 0.04));
                                        newTrailPoints.push(curve.getPoint(trailProgress));
                                    }
                                    const newTrailCurve = new THREE.CatmullRomCurve3(newTrailPoints);
                                    if (arc.geometry) arc.geometry.dispose();
                                    arc.geometry = new THREE.TubeGeometry(newTrailCurve, trailLength - 1, 0.02, 8, false);
                                    arc.material.opacity = Math.min(progress * 5, 1.0) * arc.userData.originalOpacity;

                                    // Phase 2: Hold (Display full arc)
                                } else if (timeSinceStart <= TRAVEL_DURATION + HOLD_DURATION) {
                                    if (!arc.userData.fullArcGeometryCreated) {
                                        if (arc.geometry) arc.geometry.dispose();
                                        arc.geometry = new THREE.TubeGeometry(curve, 100, 0.02, 8, false);
                                        arc.userData.fullArcGeometryCreated = true;
                                    }
                                    arc.material.opacity = arc.userData.originalOpacity;

                                    // Phase 3: Fade Out
                                } else {
                                    const fadeProgress = (timeSinceStart - (TRAVEL_DURATION + HOLD_DURATION)) / FADE_DURATION;
                                    arc.material.opacity = (1.0 - fadeProgress) * arc.userData.originalOpacity;
                                }

                            } else {
                                arc.visible = false;
                                arc.userData.fullArcGeometryCreated = false; // Reset for next loop
                            }
                        });
                    }
                    renderer.render(scene, camera);
                };
                animate();

            } catch (error) {
                console.error('Error initializing globe:', error);
                isInitializedRef.current = false;
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(initializeGlobe, 50);

        return () => {
            console.log('🧹 Globe: Component unmounting - cleaning up resources');
            isMountedRef.current = false;

            if (resizeHandlerRef.current) {
                window.removeEventListener('resize', resizeHandlerRef.current.handleResize);
                if (resizeHandlerRef.current.resizeObserver) {
                    resizeHandlerRef.current.resizeObserver.disconnect();
                }
            }

            clearTimeout(timeoutId);
            if (animationId) cancelAnimationFrame(animationId);
            activeTimeoutsRef.current.forEach(clearTimeout);
            activeTimeoutsRef.current.clear();

            isInitializedRef.current = false;
            routesInitializedRef.current = false;

            if (scene) {
                scene.traverse((object) => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        const materials = Array.isArray(object.material) ? object.material : [object.material];
                        materials.forEach(mat => {
                            Object.values(mat).forEach(value => {
                                if (value && typeof value.dispose === 'function') {
                                    value.dispose();
                                }
                            });
                            mat.dispose();
                        });
                    }
                });
                while (scene.children.length > 0) {
                    scene.remove(scene.children[0]);
                }
            }

            if (renderer) {
                renderer.dispose();
                if (mountRef.current && renderer.domElement) {
                    mountRef.current.removeChild(renderer.domElement);
                }
            }
            geocodingCache.clear();
        };
    }, [addShipmentRoutes, width, height]);

    useEffect(() => {
        if (sceneRef.current && shipments.length > 0 && !loading && isInitializedRef.current) {
            console.log('🔄 Updating shipment routes...');
            const scene = sceneRef.current;

            if (scene.userData.animatedArcs) {
                scene.userData.animatedArcs.forEach(arc => {
                    if (arc.geometry) arc.geometry.dispose();
                    if (arc.material) arc.material.dispose();
                    if (arc.parent) arc.parent.remove(arc);
                });
            }

            scene.userData.animatedArcs = [];
            scene.userData.animatedParticles = [];
            scene.userData.maxAnimationTime = 0;

            addShipmentRoutes(scene, shipments);
        }
    }, [shipments.length, addShipmentRoutes, loading]);

    // Effect to handle canvas re-parenting for fullscreen mode
    useEffect(() => {
        const renderer = rendererRef.current;
        const mountNode = mountRef.current;
        const resizeHandler = resizeHandlerRef.current?.handleResize;

        if (!loading && renderer && mountNode) {
            // If the canvas isn't inside the current mount node, move it.
            if (mountNode.children.length === 0) {
                mountNode.appendChild(renderer.domElement);
            }

            // Always trigger a resize after a short delay to ensure dimensions are correct
            if (resizeHandler) {
                setTimeout(resizeHandler, 100);
            }
        }
    }, [isFullScreen, loading]); // This effect runs whenever the view toggles between normal and fullscreen

    const handleTogglePause = useCallback(() => {
        setIsPaused(prev => !prev);
    }, []);

    const globeContent = (
        <>
            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
            {loading && (
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.95)', color: 'white', zIndex: 10 }}>
                    <Typography>Loading Globe...</Typography>
                </Box>
            )}
            {showOverlays && !loading && (
                <Box sx={{
                    position: 'absolute',
                    top: { xs: '64px', sm: '72px' }, // Push down to avoid new header
                    left: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.8,
                    zIndex: 5
                }}>
                    {[
                        { key: 'pending', label: 'Ready To Ship', color: '#FFA726', value: realtimeStatusCounts.pending || 0 },
                        { key: 'transit', label: 'In Transit', color: '#42A5F5', value: realtimeStatusCounts.transit || 0 },
                        { key: 'delivered', label: 'Delivered', color: '#66BB6A', value: realtimeStatusCounts.delivered || 0 },
                        { key: 'delayed', label: 'Delayed', color: '#F44336', value: realtimeStatusCounts.delayed || 0 }
                    ].map(({ key, label, color, value }) => (
                        <Box key={key} sx={{ background: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(20px)', borderRadius: '8px', padding: '6px 10px', minWidth: '80px', textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.65rem', fontWeight: 500, textTransform: 'uppercase', display: 'block' }}>
                                {label}
                            </Typography>
                            <Typography variant="h4" sx={{ color: color, fontWeight: 700, fontSize: '1.8rem', lineHeight: 1, textShadow: `0 0 12px ${color}60` }}>
                                {value}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            )}

            {!loading && shipments.length > 0 && (
                <Box sx={{ position: 'absolute', bottom: { xs: '1rem', sm: '1.5rem', md: '2rem' }, right: { xs: '1rem', sm: '1.5rem', md: '2rem' }, zIndex: 7 }}>
                    <Box sx={{ display: 'flex', minWidth: { xs: '280px', sm: '350px', md: '420px' }, height: { xs: '80px', sm: '90px', md: '100px' }, background: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(20px)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        <Box sx={{ width: { xs: '80px', sm: '110px', md: '140px' }, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: { xs: '8px', sm: '12px', md: '16px' } }}>
                            <CarrierLogo activeShipment={activeShipment || shipments[0]} />
                        </Box>
                        <Box sx={{ flex: 1, padding: { xs: '8px 12px', sm: '12px 16px', md: '16px 20px' }, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
                            <Box>
                                <Typography variant="h4" sx={{ color: 'white', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' }, fontWeight: 700 }}>
                                    #{(activeShipment || shipments[0])?.trackingNumber || 'Loading...'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem' }, display: 'block' }}>
                                    {(activeShipment || shipments[0])?.origin?.city || 'Origin'} → {(activeShipment || shipments[0])?.destination?.city || 'Destination'}
                                </Typography>
                            </Box>
                            <Box sx={{ alignSelf: 'flex-start', paddingY: '6px' }}>
                                <StatusChip status={(activeShipment || shipments[0])?.status || 'pending'} size="small" sx={{ fontSize: '0.7rem', height: '24px' }} />
                            </Box>
                            <Typography variant="caption" sx={{ position: 'absolute', bottom: '8px', right: '8px', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.65rem' }}>
                                {currentShipmentIndex + 1} / {shipments.length}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            )}
        </>
    );

    if (isFullScreen) {
        return (
            <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#000000', zIndex: 9999 }}>
                {/* Close Fullscreen Button */}
                <IconButton onClick={toggleFullScreen} sx={{ position: 'absolute', top: 24, right: 24, background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', borderRadius: '50%', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10002, color: 'white' }}>
                    <FullscreenExitIcon />
                </IconButton>

                {/* Main Content Area */}
                <Box className="globe-container" sx={{ position: 'relative', width: '100vw', height: '100vh' }}>
                    {/* Render Globe and Overlays */}
                    {globeContent}

                    {/* Render Controls in Fullscreen */}
                    {!loading && <RegionNavigationButtons isFullscreenMode={true} />}
                </Box>
            </Box>
        );
    }

    // Default (non-fullscreen) view
    return (
        <Box className="globe-container" sx={{
            position: 'relative',
            width,
            height: '100%', // Use 100% to fill parent
            backgroundColor: '#000000',
            borderRadius: '8px',
            overflow: 'hidden' // Hide anything that might spill out
        }}>
            {/* Render Globe and Overlays */}
            {globeContent}

            {/* Controls are now handled by the parent Dashboard component */}
            {!loading && <RegionNavigationButtons isFullscreenMode={false} />}
        </Box>
    );
});

export default React.memo(ShipmentGlobe);
