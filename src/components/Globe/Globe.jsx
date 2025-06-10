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

const ShipmentGlobe = ({ width = 500, height = 600, showOverlays = true, statusCounts = {} }) => {
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
    const pausedTimeRef = useRef(0);

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

    // Shared Region Navigation Component to avoid duplication
    const RegionNavigationButtons = ({ isFullscreenMode = false }) => (
        <Box sx={{
            position: 'absolute',
            bottom: isFullscreenMode ? 24 : 16,
            left: isFullscreenMode ? 24 : 16,
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

    // Shared Top Controls Component to avoid duplication
    const TopControlsComponent = ({ isFullscreenMode = false }) => (
        <Box sx={{
            position: 'absolute',
            top: 24,
            right: isFullscreenMode ? 80 : 16, // Leave space for close button in fullscreen
            zIndex: isFullscreenMode ? 10001 : 6,
            display: 'flex',
            gap: 1,
            alignItems: 'center'
        }}>
            {/* SoluShipX Logo */}
            <Box sx={{
                background: 'rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(20px)',
                borderRadius: '8px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '36px'
            }}>
                <img
                    src="/images/solushipx_logo_white.png"
                    alt="SoluShipX"
                    style={{
                        height: '20px',
                        width: 'auto',
                        objectFit: 'contain'
                    }}
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

            {/* Reset View Button */}
            <IconButton
                onClick={resetView}
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
                <RefreshIcon />
            </IconButton>

            {/* Fullscreen Button - Only in normal view */}
            {!isFullscreenMode && (
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
            )}
        </Box>
    );

    // Helper function to create managed timeouts that get cleaned up on unmount
    const createManagedTimeout = useCallback((callback, delay) => {
        const timeoutId = setTimeout(() => {
            activeTimeoutsRef.current.delete(timeoutId);
            callback();
        }, delay);
        
        activeTimeoutsRef.current.add(timeoutId);
        return timeoutId;
    }, []);

    // Real-time shipment data listener with carrier tracking data
    useEffect(() => {
        if (!companyIdForAddress || companyLoading) {
            return;
        }

        console.log('🌍 Globe: Setting up independent enhanced real-time shipment listener for company:', companyIdForAddress);

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
            console.log('🌍 Globe: Received real-time shipments update:', {
                snapshotSize: snapshot.docs.length,
                companyId: companyIdForAddress,
                dateFilter: dateFilter.toDate().toISOString(),
                queryPath: 'shipments collection'
            });

            // Log first few shipment documents for debugging
            if (snapshot.docs.length > 0) {
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

                console.log(`🔍 Globe: Processing shipment ${shipmentId}:`, {
                    hasCarrierTrackingData: !!carrierTrackingData,
                    hasRawData: !!carrierTrackingData?.rawData,
                    masterCarrier: carrierTrackingData?.rawData?.carrier,
                    carrierName: carrierTrackingData?.carrierName
                });

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

                console.log(`🔍 Globe: Created shipment object for ${shipmentId}:`, {
                    documentId: shipmentObject.documentId,
                    shipmentID: shipmentObject.shipmentID,
                    trackingNumber: shipmentObject.trackingNumber,
                    hasCarrierData: !!shipmentObject.carrierTrackingData,
                    carrierFromData: shipmentObject.carrierTrackingData?.rawData?.carrier
                });

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
        }, (error) => {
            console.error('🌍 Globe: Error in real-time shipments listener:', error);
        });

        return () => unsubscribe();
    }, [companyIdForAddress, companyLoading]);

    // Loading state handling for independent Globe
    useEffect(() => {
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

                // Position camera to focus on North America with optimal viewing angle - zoomed in more
                camera.position.set(-8, 10, 16); // Closer view for better detail (was 28)
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

                // Add WebGL context loss detection
                const canvas = renderer.domElement;
                canvas.addEventListener('webglcontextlost', (event) => {
                    console.error('🚨 WebGL context lost! Preventing default and attempting recovery...');
                    event.preventDefault();
                    if (animationId) cancelAnimationFrame(animationId);
                }, false);

                canvas.addEventListener('webglcontextrestored', () => {
                    console.log('🔄 WebGL context restored, reinitializing globe...');
                    // The component will reinitialize automatically due to React
                }, false);

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
                    
                    // 📍 COORDINATE LOGGING FOR CALIBRATION
                    console.log('\n🌍 === GLOBE POSITION CALIBRATION DATA ===');
                    console.log('📷 Camera Position:', {
                        x: camera.position.x.toFixed(3),
                        y: camera.position.y.toFixed(3),
                        z: camera.position.z.toFixed(3)
                    });
                    console.log('🎯 Camera Target:', {
                        x: controls.target.x.toFixed(3),
                        y: controls.target.y.toFixed(3),
                        z: controls.target.z.toFixed(3)
                    });
                    console.log('🌐 Globe Rotation:', {
                        x: group.rotation.x.toFixed(3),
                        y: group.rotation.y.toFixed(3),
                        z: group.rotation.z.toFixed(3)
                    });
                    console.log('📐 Camera Rotation:', {
                        x: camera.rotation.x.toFixed(3),
                        y: camera.rotation.y.toFixed(3),
                        z: camera.rotation.z.toFixed(3)
                    });
                    console.log('🔍 Camera Distance from Origin:', camera.position.distanceTo(new THREE.Vector3(0, 0, 0)).toFixed(3));
                    console.log('🎪 Controls Distance:', controls.getDistance().toFixed(3));
                    console.log('=== END CALIBRATION DATA ===\n');
                    
                    // Note: We don't restart auto-rotation - user's position is maintained
                });

                // Rotation change listener removed to reduce console noise

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

                // Store controls reference in camera for region navigation
                camera.userData = { controls: controls };

                // Enhanced dramatic lighting setup for realistic terrain rendering
                const ambientLight = new THREE.AmbientLight(0x404080, 0.3); // Reduced ambient for more dramatic shadows
                scene.add(ambientLight);

                // Primary directional light - enhanced for terrain detail visibility  
                const directionalLight = new THREE.DirectionalLight(0xfff4e6, 2.2); // Increased intensity for bump mapping
                directionalLight.position.set(-12, 10, 15); // Adjusted for better terrain lighting
                directionalLight.target.position.set(0, 0, 0);
                directionalLight.castShadow = false; // Disable shadows for performance
                scene.add(directionalLight);
                scene.add(directionalLight.target);

                // Secondary fill light for realistic contrast
                const fillLight = new THREE.DirectionalLight(0xe6f3ff, 0.8); // Increased fill light for terrain detail
                fillLight.position.set(10, -6, -10); // Enhanced positioning for better fill lighting
                fillLight.target.position.set(0, 0, 0);
                scene.add(fillLight);
                scene.add(fillLight.target);

                // Add subtle rim lighting for atmospheric effect
                const rimLight = new THREE.DirectionalLight(0xb3d9ff, 0.4); // Cool rim light
                rimLight.position.set(0, 0, -20); // Behind the globe for rim effect
                rimLight.target.position.set(0, 0, 0);
                scene.add(rimLight);
                scene.add(rimLight.target);

                // Add neutral environment for PBR material to prevent black appearance
                const pmremGenerator = new THREE.PMREMGenerator(renderer);
                const neutralEnv = pmremGenerator.fromScene(new THREE.Scene(), 0.04).texture;
                scene.environment = neutralEnv;
                pmremGenerator.dispose();

                // Create group for globe rotation
                group = new THREE.Group();

                // Set rotation with slight right turn for better initial view
                // Rotate slightly right to show more of North America/Pacific
                const initialRotationY = -0.3; // ~17° right rotation for better continent positioning
                const initialRotationX = 0; // 0° - no X rotation

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

                const [dayMap, normalMap, bumpMap, cloudsMap] = await Promise.all([
                    loadTextureWithFallback(EARTH_TEXTURES.day),
                    loadTextureWithFallback(EARTH_TEXTURES.normal),
                    loadTextureWithFallback(EARTH_TEXTURES.bump),
                    loadTextureWithFallback(EARTH_TEXTURES.clouds)
                ]);

                dayMap.colorSpace = THREE.SRGBColorSpace;

                // Debug texture loading
                console.log('✅ All Earth textures loaded successfully');
                console.log('🗻 Normal map dimensions:', normalMap.image?.width, 'x', normalMap.image?.height);
                console.log('🌍 Earth day map dimensions:', dayMap.image?.width, 'x', dayMap.image?.height);
                console.log('🏔️ Bump map dimensions:', bumpMap.image?.width, 'x', bumpMap.image?.height);

                // Create efficient programmatic star field
                const createProgrammaticStarField = () => {
                    const starCount = 1000; // Reduced for memory efficiency
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

                // Enhanced Earth material with realistic bump mapping and lighting response
                const earthMat = new THREE.MeshStandardMaterial({
                    map: dayMap,
                    normalMap: normalMap,
                    bumpMap: bumpMap,
                    bumpScale: 0.4, // Increased for more pronounced terrain relief
                    roughness: 0.7, // Slightly more reflective for realistic surface
                    metalness: 0.05, // Subtle metallic properties for mineral content
                    envMapIntensity: 0.4, // Enhanced environment reflection for realism
                    normalScale: new THREE.Vector2(1.2, 1.2), // Enhanced normal mapping intensity
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
                    console.log('🚚 Adding initial shipment routes to globe...');
                    await addShipmentRoutes(scene, shipments);
                    routesInitializedRef.current = true;
                }

                // Click debugging removed - coordinate mapping is now correct

                console.log('✅ Globe initialized with carrier logos, reduced zoom, dramatic lighting');
                console.log('🔍 Scene objects count:', scene.children.length);
                console.log('🌍 Earth object:', earth ? 'Created' : 'Missing');
                console.log('☁️ Clouds object:', clouds ? 'Created' : 'Missing');
                console.log('🌌 Atmosphere object:', atmosphere ? 'Created' : 'Missing');

                // Only set loading to false after everything is ready
                setTimeout(() => {
                    setLoading(false);
                    console.log('🎯 Globe loading state cleared - ready for display');
                }, 100); // Small delay to ensure smooth initialization

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

                    // Only rotate clouds for subtle animation (no more Earth spinning)
                    if (!userInteracting) {
                        // Only rotate clouds for gentle atmospheric movement
                        clouds.rotateY(interval * 0.003 * params.speedFactor);
                    }

                    // Realistic Earth with proper bump mapping - no separate night lights needed

                    // UNIFIED TIMING SYSTEM: Badge and Animation Synchronization
                    // ALL timing calculations MUST use the exact same constants and logic
                    // to prevent any drift between badge switching and arc animations
                    // Sequential shooting star animation with trail movement
                    // In manual navigation mode, only animate the selected shipment continuously
                    // In auto mode, run the full sequence when not paused
                    if (scene.userData.animatedArcs && (!isPaused || manualNavigation)) {
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
                                // Handle manual navigation mode - simple static display
                                if (manualNavigation) {
                                    if (arc.userData.isManuallySelected) {
                                        // Keep the manually selected arc visible and static
                                        arc.visible = true;
                                        // Arc geometry and opacity are already set by showSpecificShipmentArc
                                    } else {
                                        // Hide all other arcs in manual navigation mode
                                        arc.visible = false;
                                        arc.material.opacity = 0;
                                    }
                                    return; // Skip auto-animation logic in manual mode
                                }
                                if (arc.userData.isShootingArc) {
                                    // Handle shooting arc animation with trail movement - UNIFIED TIMING
                                    const ANIMATION_DURATION = arc.userData.ANIMATION_DURATION;
                                    const HOLD_DURATION = arc.userData.HOLD_DURATION;
                                    const TOTAL_DURATION = arc.userData.TOTAL_DURATION;
                                    const timeSinceStart = currentTime - arc.userData.animationStartTime;

                                    // Check if animation should start - EXACT timing match with badge
                                    if (timeSinceStart >= 0 && timeSinceStart <= TOTAL_DURATION) {
                                        arc.visible = true;
                                        const progress = Math.min(timeSinceStart / ANIMATION_DURATION, 1.0);

                                        // Sync badge with currently animating arc - EXACT timing at animation start (NO tolerance window)
                                        if (timeSinceStart >= 0 && timeSinceStart <= 16.67 && !arc.userData.badgeSynced) { // Single frame window at 60fps
                                            arc.userData.badgeSynced = true;

                                            // Use stored shipment data from arc userData
                                            const shipmentForArc = arc.userData.shipmentData;
                                            if (shipmentForArc) {
                                                // Update active shipment at EXACT same time as arc
                                                setActiveShipment(shipmentForArc);
                                                console.log(`🎯 Badge synced with arc animation for shipment: ${shipmentForArc.trackingNumber || shipmentForArc.id}`);
                                            }
                                        }

                                        // Handle animation phases: active animation vs hold phase - UNIFIED TIMING
                                        if (timeSinceStart <= ANIMATION_DURATION) {
                                            // Active animation phase with trail movement
                                            arc.userData.progress = progress;

                                            // Calculate trail positions with movement for tube geometry
                                            const trailLength = arc.userData.trailLength;
                                            const newTrailPoints = [];

                                            for (let i = 0; i < trailLength; i++) {
                                                // Create trailing effect - each point follows behind the main progress
                                                const trailProgress = Math.max(0, progress - (i * 0.04)); // 0.04 spacing between trail points

                                                if (trailProgress > 0) {
                                                    const point = arc.userData.curve.getPoint(trailProgress);
                                                    newTrailPoints.push(point);
                                                } else {
                                                    // If trail point hasn't started yet, use the starting position
                                                    const startPoint = arc.userData.curve.getPoint(0);
                                                    newTrailPoints.push(startPoint);
                                                }
                                            }

                                            // Only recreate geometry if trail points actually changed significantly
                                            if (!arc.userData.lastTrailPoints ||
                                                arc.userData.lastTrailPoints.length !== newTrailPoints.length ||
                                                newTrailPoints.some((point, i) =>
                                                    !arc.userData.lastTrailPoints[i] ||
                                                    point.distanceTo(arc.userData.lastTrailPoints[i]) > 0.1
                                                )) {

                                                const newTrailCurve = new THREE.CatmullRomCurve3(newTrailPoints);
                                                const newTubeGeometry = new THREE.TubeGeometry(newTrailCurve, trailLength - 1, 0.02, 8, false);

                                                // Dispose old geometry and update
                                                if (arc.geometry) arc.geometry.dispose();
                                                arc.geometry = newTubeGeometry;

                                                // Store trail points for comparison
                                                arc.userData.lastTrailPoints = newTrailPoints.map(p => p.clone());
                                            }

                                            // Dynamic opacity for trail effect (smooth throughout)
                                            let intensity;
                                            if (progress < 0.1) {
                                                // Quick fade-in
                                                intensity = progress * 10;
                                            } else {
                                                // Full intensity throughout the rest of animation (no fade-out at end)
                                                intensity = 1.0;
                                            }

                                            arc.material.opacity = Math.min(intensity, 1.0) * arc.userData.originalOpacity;

                                            // Enhanced color with shooting effect
                                            const baseColor = new THREE.Color(getStatusColor(arc.userData.status));
                                            const brightnessMultiplier = 1.0 + intensity * 0.5;
                                            arc.material.color = baseColor.clone().multiplyScalar(brightnessMultiplier);
                                        } else {
                                            // Hold phase - keep full arc visible with smooth transition (only create once)
                                            if (!arc.userData.fullArcGeometryCreated) {
                                                const fullArcCurve = arc.userData.curve;
                                                const fullTubeGeometry = new THREE.TubeGeometry(fullArcCurve, 100, 0.02, 8, false);

                                                // Dispose old geometry and update to full arc
                                                if (arc.geometry) arc.geometry.dispose();
                                                arc.geometry = fullTubeGeometry;
                                                arc.userData.fullArcGeometryCreated = true;
                                            }

                                            // Smooth transition from animation opacity (no sudden change)
                                            arc.material.opacity = 0.9 * arc.userData.originalOpacity; // Slightly dimmer but smooth
                                            const baseColor = new THREE.Color(getStatusColor(arc.userData.status));
                                            arc.material.color = baseColor;
                                        }

                                    } else if (timeSinceStart > TOTAL_DURATION) {
                                        // Animation completed - mark as done and hide - EXACT timing
                                        arc.userData.animationComplete = true;
                                        arc.userData.hasAnimated = true;
                                        arc.visible = false;
                                        arc.material.opacity = 0;

                                        // Mark badge as handled when arc animation completes - EXACT timing
                                        if (arc.userData.badgeSynced && !arc.userData.badgeHidden) {
                                            arc.userData.badgeHidden = true;
                                        }

                                        // Schedule cleanup after a delay to prevent memory accumulation
                                        if (!arc.userData.cleanupScheduled) {
                                            arc.userData.cleanupScheduled = true;
                                            setTimeout(() => {
                                                if (arc.geometry) arc.geometry.dispose();
                                                if (arc.material) arc.material.dispose();
                                                if (arc.parent) arc.parent.remove(arc);
                                                console.log(`🧹 Cleaned up completed arc for shipment ${arc.userData.shipmentId}`);
                                            }, 10000); // Clean up 10 seconds after completion
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
                                // Handle legacy static arc animation - converted to sequential timing - UNIFIED TIMING
                                if (!arc.userData.animationComplete) {
                                    const ANIMATION_DURATION = arc.userData.ANIMATION_DURATION || 2500;
                                    const HOLD_DURATION = arc.userData.HOLD_DURATION || 4500;
                                    const TOTAL_DURATION = arc.userData.TOTAL_DURATION || (ANIMATION_DURATION + HOLD_DURATION);
                                    const timeSinceStart = currentTime - arc.userData.animationStartTime;

                                    if (timeSinceStart >= 0 && timeSinceStart <= TOTAL_DURATION) {
                                        arc.visible = true;
                                        const progress = Math.min(timeSinceStart / ANIMATION_DURATION, 1.0);

                                        // Sync badge with currently animating arc (legacy fallback) - EXACT timing
                                        if (timeSinceStart >= 0 && timeSinceStart <= 16.67 && !arc.userData.badgeSynced) { // Single frame window at 60fps
                                            arc.userData.badgeSynced = true;

                                            // Use stored shipment data from arc userData
                                            const shipmentForArc = arc.userData.shipmentData;
                                            if (shipmentForArc) {
                                                // Update active shipment at EXACT same time as arc
                                                setActiveShipment(shipmentForArc);
                                                console.log(`🎯 Badge synced with legacy arc animation for shipment: ${shipmentForArc.trackingNumber || shipmentForArc.id}`);
                                            }
                                        }

                                        if (timeSinceStart <= ANIMATION_DURATION) {
                                            // Active animation phase with smooth opacity
                                            let intensity;
                                            if (progress < 0.1) {
                                                // Quick fade-in
                                                intensity = progress * 10;
                                            } else {
                                                // Full intensity throughout (no flicker at end)
                                                intensity = 1.0;
                                            }

                                            arc.material.opacity = Math.min(intensity, 1.0) * arc.userData.originalOpacity;
                                            const baseColor = new THREE.Color(getStatusColor(arc.userData.status));
                                            const brightnessMultiplier = 1.0 + intensity * 0.5;
                                            arc.material.color = baseColor.clone().multiplyScalar(brightnessMultiplier);
                                        } else {
                                            // Hold phase - smooth transition from animation
                                            arc.material.opacity = 0.9 * arc.userData.originalOpacity; // Match main animation hold opacity
                                            const baseColor = new THREE.Color(getStatusColor(arc.userData.status));
                                            arc.material.color = baseColor;
                                        }

                                    } else if (timeSinceStart > TOTAL_DURATION) {
                                        // Animation completed - EXACT timing
                                        arc.userData.animationComplete = true;
                                        arc.visible = false;
                                        arc.material.opacity = 0;

                                        // Mark badge as handled when legacy arc animation completes - EXACT timing
                                        if (arc.userData.badgeSynced && !arc.userData.badgeHidden) {
                                            arc.userData.badgeHidden = true;
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
                    if (scene.userData.animatedParticles && !isPaused) {
                        const particleCount = scene.userData.animatedParticles.length;
                        for (let i = 0; i < particleCount; i++) {
                            const particle = scene.userData.animatedParticles[i];

                            // Check if this particle should be active based on sequential timing - UNIFIED TIMING
                            const SHIPMENT_INTERVAL = 4000; // Same as arc timing
                            const PARTICLE_TOTAL_DURATION = 7000; // Same as arc timing (2.5s + 4.5s)
                            const sequentialDelay = particle.userData.sequentialIndex * SHIPMENT_INTERVAL;
                            const particleTimeSinceStart = (time * 1000) - sequentialDelay;

                            if (particleTimeSinceStart >= 0 && particleTimeSinceStart <= PARTICLE_TOTAL_DURATION) { // EXACT match with arc timing
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

                        // Memory monitoring
                        const memInfo = renderer.info.memory;
                        const renderInfo = renderer.info.render;

                        if (memInfo.geometries > 100 || memInfo.textures > 50) {
                            console.warn(`⚠️ High memory usage: ${memInfo.geometries} geometries, ${memInfo.textures} textures`);
                        }

                        if (frameCount % 600 === 0) { // Every 10 seconds
                            console.log(`📊 Performance stats: Geometries: ${memInfo.geometries}, Textures: ${memInfo.textures}, Draw calls: ${renderInfo.calls}`);
                        }

                        // Emergency cleanup if we have too many objects
                        if (memInfo.geometries > 200) {
                            console.warn('🚨 Emergency cleanup triggered - too many geometries!');
                            scene.userData.animatedArcs?.forEach((arc, index) => {
                                if (arc.userData.animationComplete && index % 2 === 0) { // Clean up every other completed arc
                                    if (arc.geometry) arc.geometry.dispose();
                                    if (arc.material) arc.material.dispose();
                                    if (arc.parent) arc.parent.remove(arc);
                                }
                            });
                        }
                    }
                };
                animate();

            } catch (error) {
                console.error('Error initializing globe:', error);
                isInitializedRef.current = false; // Reset on error
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

            const validShipments = shipments.filter(s => {
                const status = s.status?.toLowerCase();
                return status && status !== 'draft' && status !== 'cancelled' && status !== 'void';
            });
            console.log(`🚚 Valid shipments (non-draft/cancelled/void):`, validShipments.length);
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
                if (scene.userData) {
                    scene.userData.isProcessingShipments = false;
                }
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

                        // Create thick 3D tube arc with trail effect for movement
                        const trailLength = 25; // Number of points in the shooting trail (increased for visibility)
                        const trailPoints = new Array(trailLength).fill().map(() => startVec.clone());

                        // Create tube geometry for actually thick arcs
                        const trailCurve = new THREE.CatmullRomCurve3(trailPoints);
                        const tubeRadius = 0.02; // Thin tube radius for elegant visibility
                        const tubularSegments = trailLength - 1;
                        const radialSegments = 8; // Circular cross-section
                        const trailGeometry = new THREE.TubeGeometry(trailCurve, tubularSegments, tubeRadius, radialSegments, false);

                        // Enhanced material for thick tube effect with glow
                        const material = new THREE.MeshStandardMaterial({
                            color: getStatusColor(shipment.status),
                            opacity: 0.95,
                            transparent: true,
                            emissive: new THREE.Color(getStatusColor(shipment.status)),
                            emissiveIntensity: 0.3,
                            roughness: 0.5,
                            metalness: 0.1
                        });
                        const arc = new THREE.Mesh(trailGeometry, material);

                        // UNIFIED TIMING SYSTEM - Badge and Animation use EXACTLY the same timing
                        const ANIMATION_DURATION = 2500; // 2.5s animation (faster movement)
                        const HOLD_DURATION = 4500; // 4.5s hold (2.0s longer for better visibility)
                        const TOTAL_DURATION = ANIMATION_DURATION + HOLD_DURATION; // 7.0s total
                        const SHIPMENT_INTERVAL = 4000; // 4s between shipments for better flow
                        const animationStartDelay = index * SHIPMENT_INTERVAL;
                        const currentTime = performance.now(); // Get current time when creating arc

                        // Debug shipment data before storing
                        console.log('🔍 Storing shipment data in arc userData:', {
                            shipmentId: shipment.id,
                            hasCarrierTrackingData: !!shipment.carrierTrackingData,
                            carrierFromTrackingData: shipment.carrierTrackingData?.carrier,
                            carrierFromRawData: shipment.carrierTrackingData?.rawData?.carrier,
                            shipmentKeys: Object.keys(shipment)
                        });

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
                            // UNIFIED TIMING - Use exact same constants as animation loop
                            ANIMATION_DURATION: ANIMATION_DURATION,
                            HOLD_DURATION: HOLD_DURATION,
                            TOTAL_DURATION: TOTAL_DURATION
                        };
                        group.add(arc); // Add to rotating Earth group
                        animatedArcs.push(arc);

                        // No glow layers for thin line approach - keep it clean and simple

                        // Create visible endpoint markers - bigger than the tube arcs
                        const originGeo = new THREE.SphereGeometry(0.04, 8, 8); // Bigger markers, twice the tube size
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

                        const destGeo = new THREE.SphereGeometry(0.04, 8, 8); // Bigger markers, twice the tube size
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

                        console.log(`✅ Shipment ${index + 1} geocoded and added - scheduling next in ${SHIPMENT_INTERVAL}ms`);

                        // Schedule next shipment processing with overlap for better flow - UNIFIED TIMING
                        createManagedTimeout(() => {
                            processNextShipment(index + 1);
                        }, SHIPMENT_INTERVAL); // Use same interval as animation timing

                    } else {
                        console.warn(`❌ Skipping shipment ${shipment.id} - missing coordinates, processing next...`);
                        // Process next shipment immediately if current one fails
                        createManagedTimeout(() => processNextShipment(index + 1), 100);
                    }
                } catch (error) {
                    console.error(`❌ Error processing shipment ${shipment.id}:`, error);
                    // Process next shipment immediately if current one fails
                    createManagedTimeout(() => processNextShipment(index + 1), 100);
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
            console.log(`🎯 UNIFIED TIMING: 2.5s animation + 4.5s hold = 7.0s total, 4.0s intervals - Badge+Arc perfectly synchronized`);
        };

        // Small delay to ensure DOM is ready and prevent double initialization in React Strict Mode
        const timeoutId = setTimeout(initializeGlobe, 50); // Slightly longer delay for stability

        // Add manual coordinate logging with 'C' key for calibration (outside initializeGlobe)
        const handleKeyPress = (event) => {
            if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey && cameraRef.current && sceneRef.current) {
                const camera = cameraRef.current;
                const controls = camera.userData?.controls;
                const scene = sceneRef.current;
                const group = scene.children.find(child => child.type === 'Group');
                
                console.log('\n🔧 === MANUAL CALIBRATION LOG (C key pressed) ===');
                console.log('📷 Camera Position:', {
                    x: camera.position.x.toFixed(3),
                    y: camera.position.y.toFixed(3),
                    z: camera.position.z.toFixed(3)
                });
                console.log('🎯 Camera Target:', {
                    x: controls?.target.x.toFixed(3) || 'N/A',
                    y: controls?.target.y.toFixed(3) || 'N/A',
                    z: controls?.target.z.toFixed(3) || 'N/A'
                });
                console.log('🌐 Globe Rotation:', {
                    x: group?.rotation.x.toFixed(3) || 'N/A',
                    y: group?.rotation.y.toFixed(3) || 'N/A',
                    z: group?.rotation.z.toFixed(3) || 'N/A'
                });
                console.log('📐 Camera Rotation:', {
                    x: camera.rotation.x.toFixed(3),
                    y: camera.rotation.y.toFixed(3),
                    z: camera.rotation.z.toFixed(3)
                });
                console.log('🔍 Distance from Origin:', camera.position.distanceTo(new THREE.Vector3(0, 0, 0)).toFixed(3));
                console.log('🎪 Controls Distance:', controls?.getDistance().toFixed(3) || 'N/A');
                console.log('=== END MANUAL LOG ===\n');
            }
        };
        window.addEventListener('keydown', handleKeyPress);

        return () => {
            console.log('🧹 Globe: Component unmounting - cleaning up resources');

            clearTimeout(timeoutId);
            if (animationId) cancelAnimationFrame(animationId);

            // Cancel all active timeouts
            activeTimeoutsRef.current.forEach(timeoutId => {
                clearTimeout(timeoutId);
            });
            activeTimeoutsRef.current.clear();
            console.log('🧹 Globe: Cancelled all active timeouts');

            // Reset initialization flags
            isInitializedRef.current = false;
            routesInitializedRef.current = false;

            // Comprehensive Three.js resource cleanup
            if (scene) {
                console.log('🧹 Starting comprehensive Three.js cleanup...');

                // Dispose of all animated arcs and their resources
                if (scene.userData.animatedArcs) {
                    scene.userData.animatedArcs.forEach(arc => {
                        if (arc.geometry) arc.geometry.dispose();
                        if (arc.material) {
                            if (arc.material.map) arc.material.map.dispose();
                            arc.material.dispose();
                        }
                        if (arc.parent) arc.parent.remove(arc);
                    });
                    scene.userData.animatedArcs = [];
                }

                // Dispose of all animated particles and their resources
                if (scene.userData.animatedParticles) {
                    scene.userData.animatedParticles.forEach(particle => {
                        if (particle.geometry) particle.geometry.dispose();
                        if (particle.material) {
                            if (particle.material.map) particle.material.map.dispose();
                            particle.material.dispose();
                        }
                        if (particle.parent) particle.parent.remove(particle);
                    });
                    scene.userData.animatedParticles = [];
                }

                // Dispose of main globe objects
                scene.traverse((object) => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(mat => {
                                if (mat.map) mat.map.dispose();
                                if (mat.normalMap) mat.normalMap.dispose();
                                if (mat.bumpMap) mat.bumpMap.dispose();
                                if (mat.emissiveMap) mat.emissiveMap.dispose();
                                if (mat.roughnessMap) mat.roughnessMap.dispose();
                                mat.dispose();
                            });
                        } else {
                            if (object.material.map) object.material.map.dispose();
                            if (object.material.normalMap) object.material.normalMap.dispose();
                            if (object.material.bumpMap) object.material.bumpMap.dispose();
                            if (object.material.emissiveMap) object.material.emissiveMap.dispose();
                            if (object.material.roughnessMap) object.material.roughnessMap.dispose();
                            object.material.dispose();
                        }
                    }
                });

                // Clear the scene
                while (scene.children.length > 0) {
                    scene.remove(scene.children[0]);
                }

                console.log('✅ Three.js resources disposed');
            }

            // Dispose of renderer
            if (renderer) {
                renderer.dispose();
                console.log('✅ Renderer disposed');
            }

            // Remove DOM element
            if (mountRef.current && renderer?.domElement) {
                try {
                    mountRef.current.removeChild(renderer.domElement);
                } catch (e) {
                    console.warn('Canvas cleanup warning:', e.message);
                }
            }

            // Remove keyboard event listener
            window.removeEventListener('keydown', handleKeyPress);

            // Clear geocoding cache to free memory
            geocodingCache.clear();
            console.log('🧹 Globe cleanup completed');
        };
    }, [width, height, shipments.length]); // Only reinitialize if dimensions or shipment count changes

    // Separate effect to update shipment routes without reinitializing globe
    useEffect(() => {
        // Only update routes if globe is initialized and routes were previously initialized
        if (sceneRef.current && shipments.length > 0 && !loading && isInitializedRef.current && routesInitializedRef.current) {
            console.log('🔄 Updating shipment routes without reinitializing globe...');

            const scene = sceneRef.current;
            const group = scene.children.find(child => child.type === 'Group');

            if (group) {
                // Clear old animated arcs and particles
                if (scene.userData.animatedArcs) {
                    scene.userData.animatedArcs.forEach(arc => {
                        if (arc.geometry) arc.geometry.dispose();
                        if (arc.material) arc.material.dispose();
                        if (arc.parent) arc.parent.remove(arc);
                    });
                    scene.userData.animatedArcs = [];
                }

                if (scene.userData.animatedParticles) {
                    scene.userData.animatedParticles.forEach(particle => {
                        if (particle.geometry) particle.geometry.dispose();
                        if (particle.material) particle.material.dispose();
                        if (particle.parent) particle.parent.remove(particle);
                    });
                    scene.userData.animatedParticles = [];
                }

                // Add new shipment routes
                const addShipmentRoutes = async (scene, shipments) => {
                    const validShipments = shipments.filter(s => {
                        const status = s.status?.toLowerCase();
                        return status && status !== 'draft' && status !== 'cancelled' && status !== 'void';
                    });
                    console.log(`🚚 Updating ${validShipments.length} shipment routes (excluding cancelled/void)...`);

                    const animatedArcs = [];
                    const animatedParticles = [];

                    scene.userData.animatedArcs = animatedArcs;
                    scene.userData.animatedParticles = animatedParticles;
                    scene.userData.totalShipments = validShipments.length;
                    scene.userData.currentShipmentIndex = 0;
                    scene.userData.isProcessingShipments = true;

                    // Process shipments without delays for instant update
                    for (let index = 0; index < validShipments.length; index++) {
                        const shipment = validShipments[index];
                        try {
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
                                const trailLength = 25;
                                const trailPoints = new Array(trailLength).fill().map(() => startVec.clone());
                                const trailCurve = new THREE.CatmullRomCurve3(trailPoints);
                                const trailGeometry = new THREE.TubeGeometry(trailCurve, trailLength - 1, 0.02, 8, false);

                                const material = new THREE.MeshStandardMaterial({
                                    color: getStatusColor(shipment.status),
                                    opacity: 0.95,
                                    transparent: true,
                                    emissive: new THREE.Color(getStatusColor(shipment.status)),
                                    emissiveIntensity: 0.3,
                                    roughness: 0.5,
                                    metalness: 0.1
                                });
                                const arc = new THREE.Mesh(trailGeometry, material);

                                const ANIMATION_DURATION = 2500; // UNIFIED TIMING
                                const HOLD_DURATION = 4500; // UNIFIED TIMING
                                const animationStartDelay = index * 4000; // UNIFIED TIMING
                                const currentTime = performance.now();

                                                                arc.userData = {
                                    isAnimatedArc: true,
                                    isShootingArc: true,
                                    originalOpacity: 0.95,
                                    status: shipment.status,
                                    shipmentId: shipment.shipmentID || shipment.shipmentId || shipment.id,
                                    animationStartTime: currentTime + animationStartDelay,
                                    curve: curve,
                                    trailLength: trailLength,
                                    trailPoints: trailPoints,
                                    progress: 0,
                                    badgeSynced: false,
                                    badgeHidden: false,
                                    shipmentData: shipment,
                                    sequentialIndex: index,
                                    // UNIFIED TIMING - Use exact same constants as animation loop
                                    ANIMATION_DURATION: ANIMATION_DURATION,
                                    HOLD_DURATION: HOLD_DURATION,
                                    TOTAL_DURATION: ANIMATION_DURATION + HOLD_DURATION
                                };

                                group.add(arc);
                                animatedArcs.push(arc);

                                // Add markers
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
                            }
                        } catch (error) {
                            console.error(`❌ Error updating shipment route ${shipment.id}:`, error);
                        }
                    }

                    console.log(`✅ Updated ${validShipments.length} shipment routes`);
                };

                addShipmentRoutes(scene, shipments);
            }
        }
    }, [JSON.stringify(shipments.map(s => ({ id: s.id, status: s.status, origin: s.origin, destination: s.destination })))]); // Only when shipment data actually changes

    // Enhanced UI Functions





    // Auto-advance shipments when not in search mode or manual navigation
    useEffect(() => {
        // Only auto-advance if not in search mode, not paused, and not in manual navigation mode
        if (!isSearchMode && !isPaused && !manualNavigation && shipments.length > 0) {
            const interval = setInterval(() => {
                setCurrentShipmentIndex(prev => (prev + 1) % shipments.length);
            }, 5000); // Keep index cycling for other features

            return () => clearInterval(interval);
        }
    }, [isSearchMode, isPaused, manualNavigation, shipments.length]);





    // Search functionality
    const handleSearch = useCallback((searchValue) => {
        setSearchTerm(searchValue);

        if (!searchValue.trim()) {
            setIsSearchMode(false);
            setActiveShipment(null);
            return;
        }

        const foundShipment = shipments.find(s =>
            s.trackingNumber?.toLowerCase().includes(searchValue.toLowerCase()) ||
            (s.shipmentID || s.shipmentId || s.id)?.toLowerCase().includes(searchValue.toLowerCase())
        );

        if (foundShipment) {
            const enhancedShipment = {
                ...foundShipment
            };

            setIsSearchMode(true);
            setActiveShipment(enhancedShipment);
            setUserInteracting(true); // Stop auto rotation
        }
    }, [shipments]);

    // Resume auto mode
    const handleResume = useCallback(() => {
        setIsSearchMode(false);
        setSearchTerm('');
        setActiveShipment(null);
        setIsPaused(false);
        setManualNavigation(false);
        setUserInteracting(false); // Resume auto rotation
    }, []);

    // Show specific shipment arc for manual navigation - SIMPLE AND CLEAR
    const showSpecificShipmentArc = useCallback((shipmentIndex) => {
        if (!sceneRef.current?.userData?.animatedArcs || shipmentIndex < 0 || shipmentIndex >= shipments.length) {
            return;
        }

        console.log(`🎯 Showing shipment arc for index: ${shipmentIndex}`);

        // Find the arc for this shipment
        const arcs = sceneRef.current.userData.animatedArcs;
        const targetArc = arcs.find(arc =>
            !arc.userData.isMarker &&
            arc.userData.sequentialIndex === shipmentIndex
        );

        if (targetArc && targetArc.userData.curve) {
            // Show the full arc immediately - no complex animations
            const fullArcCurve = targetArc.userData.curve;
            const fullTubeGeometry = new THREE.TubeGeometry(fullArcCurve, 100, 0.02, 8, false);

            // Update the arc's geometry to show full route
            targetArc.geometry.dispose();
            targetArc.geometry = fullTubeGeometry;

            // Make it clearly visible
            targetArc.visible = true;
            targetArc.material.opacity = 0.95; // Full opacity for clear visibility

            // Set appropriate color based on status
            const baseColor = new THREE.Color(getStatusColor(targetArc.userData.status));
            targetArc.material.color = baseColor;

            // Simple flag to indicate this is the manually selected arc
            targetArc.userData.isManuallySelected = true;

            console.log(`✅ Shipment ${shipmentIndex} arc displayed clearly`);
        } else {
            console.warn(`❌ No arc found for shipment index: ${shipmentIndex}`);
        }
    }, [shipments.length]);

    // Toggle pause/play
    const handleTogglePause = useCallback(() => {
        setIsPaused(prev => {
            const newPaused = !prev;
            if (newPaused) {
                // Store the time when paused and enter manual navigation
                pausedTimeRef.current = performance.now();
                setManualNavigation(true);

                // If we're currently on a shipment, set it up for continuous looping
                if (sceneRef.current?.userData?.animatedArcs && currentShipmentIndex >= 0) {
                    // Find current arc and set it to manual loop mode
                    const currentArc = sceneRef.current.userData.animatedArcs.find(arc =>
                        !arc.userData.isMarker &&
                        arc.userData.sequentialIndex === currentShipmentIndex
                    );

                    if (currentArc) {
                        // Set up current shipment for continuous looping
                        const currentTime = performance.now();
                        currentArc.userData.manualLoopMode = true;
                        currentArc.userData.manualLoopStartTime = currentTime;
                        currentArc.userData.animationComplete = false;
                        currentArc.userData.badgeSynced = false;
                        currentArc.userData.badgeHidden = false;
                        currentArc.userData.manualBadgeSynced = false;

                        // Hide all other arcs
                        sceneRef.current.userData.animatedArcs.forEach(arc => {
                            if (!arc.userData.isMarker && arc !== currentArc) {
                                arc.visible = false;
                                arc.material.opacity = 0;
                                arc.userData.manualLoopMode = false;
                            }
                        });

                        console.log(`🔄 Paused and set up continuous looping for shipment ${currentShipmentIndex}`);
                    }
                }
            } else {
                // When resuming, clear manual navigation and restart auto-loop from NEXT shipment
                setManualNavigation(false);

                // Calculate next shipment index for seamless continuation  
                const nextIndex = (currentShipmentIndex + 1) % shipments.length;

                // Clear all manual loop modes and reset arcs
                if (sceneRef.current?.userData?.animatedArcs) {
                    sceneRef.current.userData.animatedArcs.forEach(arc => {
                        if (!arc.userData.isMarker) {
                            arc.visible = false;
                            arc.material.opacity = 0;
                            arc.userData.animationComplete = false;
                            arc.userData.badgeSynced = false;
                            arc.userData.badgeHidden = false;
                            arc.userData.manualLoopMode = false;
                            arc.userData.manualBadgeSynced = false;
                        }
                    });

                    // Reset animation start times from the NEXT shipment
                    const currentTime = performance.now();
                    sceneRef.current.userData.animatedArcs.forEach((arc, index) => {
                        if (!arc.userData.isMarker && arc.userData.sequentialIndex !== undefined) {
                            // Calculate delay: start immediately for next shipment, then continue sequence
                            const shipmentPosition = (arc.userData.sequentialIndex - nextIndex + shipments.length) % shipments.length;
                            arc.userData.animationStartTime = currentTime + (shipmentPosition * 4000);
                        }
                    });
                }

                console.log(`🔄 Resumed auto-loop from shipment ${nextIndex}, restarting sequence`);
            }
            return newPaused;
        });
    }, [currentShipmentIndex, shipments.length]);

    // Manual navigation functions - SIMPLE USER EXPERIENCE
    const handlePreviousShipment = useCallback(() => {
        if (shipments.length === 0) return;

        // Pause auto-mode and enter manual browsing
        setIsPaused(true);
        setManualNavigation(true);

        setCurrentShipmentIndex(prev => {
            const newIndex = prev === 0 ? shipments.length - 1 : prev - 1;
            const shipment = shipments[newIndex];

            // Hide all arcs first
            if (sceneRef.current?.userData?.animatedArcs) {
                sceneRef.current.userData.animatedArcs.forEach(arc => {
                    if (!arc.userData.isMarker) {
                        arc.visible = false;
                        arc.material.opacity = 0;
                        arc.userData.isManuallySelected = false;
                    }
                });
            }

            // Immediately update badge and show the selected shipment's arc
            setActiveShipment(shipment);
            showSpecificShipmentArc(newIndex);

            console.log(`◀️ Previous: ${shipment.trackingNumber || shipment.id} (${newIndex + 1}/${shipments.length})`);
            return newIndex;
        });
    }, [shipments, showSpecificShipmentArc]);

    const handleNextShipment = useCallback(() => {
        if (shipments.length === 0) return;

        // Pause auto-mode and enter manual browsing
        setIsPaused(true);
        setManualNavigation(true);

        setCurrentShipmentIndex(prev => {
            const newIndex = (prev + 1) % shipments.length;
            const shipment = shipments[newIndex];

            // Hide all arcs first
            if (sceneRef.current?.userData?.animatedArcs) {
                sceneRef.current.userData.animatedArcs.forEach(arc => {
                    if (!arc.userData.isMarker) {
                        arc.visible = false;
                        arc.material.opacity = 0;
                        arc.userData.isManuallySelected = false;
                    }
                });
            }

            // Immediately update badge and show the selected shipment's arc
            setActiveShipment(shipment);
            showSpecificShipmentArc(newIndex);

            console.log(`▶️ Next: ${shipment.trackingNumber || shipment.id} (${newIndex + 1}/${shipments.length})`);
            return newIndex;
        });
    }, [shipments, showSpecificShipmentArc]);

    // Camera navigation functions for region switching
    const animateCameraTo = useCallback((position, target = { x: 0, y: 0, z: 0 }, duration = 1500) => {
        if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;

        const camera = cameraRef.current;
        const controls = camera.userData?.controls;

        console.log(`🎥 Animating camera to position:`, position, 'target:', target);

        // Disable controls during animation
        if (controls) controls.enabled = false;

        const startPosition = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
        const startTarget = controls ? { 
            x: controls.target.x, 
            y: controls.target.y, 
            z: controls.target.z 
        } : { x: 0, y: 0, z: 0 };

        const startTime = performance.now();

        const animateFrame = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth easing function
            const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
            const easedProgress = easeInOutCubic(progress);

            // Interpolate camera position
            camera.position.x = startPosition.x + (position.x - startPosition.x) * easedProgress;
            camera.position.y = startPosition.y + (position.y - startPosition.y) * easedProgress;
            camera.position.z = startPosition.z + (position.z - startPosition.z) * easedProgress;

            // Interpolate target
            if (controls) {
                controls.target.x = startTarget.x + (target.x - startTarget.x) * easedProgress;
                controls.target.y = startTarget.y + (target.y - startTarget.y) * easedProgress;
                controls.target.z = startTarget.z + (target.z - startTarget.z) * easedProgress;
                controls.update();
            }

            if (progress < 1) {
                requestAnimationFrame(animateFrame);
            } else {
                // Re-enable controls after animation
                if (controls) controls.enabled = true;
                console.log(`✅ Camera animation completed`);
            }
        };

        animateFrame();
    }, []);

    // Region navigation functions
    const resetView = useCallback(() => {
        console.log('🔄 Resetting to default view');
        animateCameraTo(defaultCameraPosition, { x: 0, y: 0, z: 0 });
        setUserInteracting(false); // Allow auto-rotation to resume if needed
    }, [animateCameraTo]);

    const goToNorthAmerica = useCallback(() => {
        console.log('🌎 Navigating to North America');
        const pos = regionPositions.northAmerica;
        animateCameraTo(pos, pos.target);
        setUserInteracting(true); // Prevent auto-rotation
    }, [animateCameraTo]);

    const goToEurope = useCallback(() => {
        console.log('🌍 Navigating to Europe');
        const pos = regionPositions.europe;
        animateCameraTo(pos, pos.target);
        setUserInteracting(true); // Prevent auto-rotation
    }, [animateCameraTo]);

    const goToAsia = useCallback(() => {
        console.log('🌏 Navigating to Asia');
        const pos = regionPositions.asia;
        animateCameraTo(pos, pos.target);
        setUserInteracting(true); // Prevent auto-rotation
    }, [animateCameraTo]);

    const goToSouthAmerica = useCallback(() => {
        console.log('🌎 Navigating to South America');
        const pos = regionPositions.southAmerica;
        animateCameraTo(pos, pos.target);
        setUserInteracting(true); // Prevent auto-rotation
    }, [animateCameraTo]);

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
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.95)', color: 'white', zIndex: 10 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Loading Globe...</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.7, textAlign: 'center' }}>
                        Initializing Earth textures and shipment data
                    </Typography>
                </Box>
            )}
            {showOverlays && !loading && (
                <Box sx={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 0.8, zIndex: 5 }}>
                    {[
                        { key: 'pending', label: 'Ready To Ship', color: '#FFA726', value: realtimeStatusCounts.pending || statusCounts.pending || statusCounts.awaitingShipment || 0 },
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



            {/* Compact Badge (Bottom Right) - Always Visible */}
            {!loading && shipments.length > 0 && (
                <Box sx={{
                    position: 'absolute',
                    bottom: 32,
                    right: 16,
                    zIndex: 7,
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                }}>
                    {/* Previous Button - Hidden for now */}
                    {false && (
                        <Box sx={{
                            width: '36px',
                            height: '36px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            '&:hover': {
                                background: 'rgba(255, 255, 255, 0.1)',
                                transform: 'scale(1.1)'
                            }
                        }} onClick={handlePreviousShipment}>
                            <ChevronLeftIcon sx={{ color: 'white', fontSize: '1.2rem' }} />
                        </Box>
                    )}

                    {/* Main Badge - Always show current or first shipment */}
                    <Box sx={{
                        display: 'flex',
                        minWidth: '420px',
                        height: '100px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        {/* Left: Carrier Logo Section */}
                        <Box sx={{
                            width: '140px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '16px'
                        }}>
                            <CarrierLogo activeShipment={activeShipment || shipments[currentShipmentIndex] || shipments[0]} />
                        </Box>

                        {/* Right: Info Section */}
                        <Box sx={{
                            flex: 1,
                            padding: '16px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            position: 'relative'
                        }}>
                            {/* Header with Tracking Number */}
                            <Box>
                                <Typography variant="h4" sx={{
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.5px'
                                }}>
                                    #{(activeShipment || shipments[currentShipmentIndex] || shipments[0])?.trackingNumber || (activeShipment || shipments[currentShipmentIndex] || shipments[0])?.id || 'Loading...'}
                                </Typography>

                                {/* Route - Using Scorecard Caption Style - No margin */}
                                <Typography variant="caption" sx={{
                                    color: '#9CA3AF',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    lineHeight: 1.2,
                                    display: 'block'
                                }}>
                                    {(activeShipment || shipments[currentShipmentIndex] || shipments[0])?.origin?.city || 'Origin'} → {(activeShipment || shipments[currentShipmentIndex] || shipments[0])?.destination?.city || 'Destination'}
                                </Typography>
                            </Box>

                            {/* Status Chip - With Vertical Padding */}
                            <Box sx={{
                                alignSelf: 'flex-start',
                                paddingY: '6px'
                            }}>
                                <StatusChip
                                    status={(activeShipment || shipments[currentShipmentIndex] || shipments[0])?.status || 'pending'}
                                    size="small"
                                    sx={{
                                        fontSize: '0.7rem',
                                        height: '24px'
                                    }}
                                />
                            </Box>

                            {/* Counter - Bottom Right Corner */}
                            <Typography variant="caption" sx={{
                                position: 'absolute',
                                bottom: '8px',
                                right: '8px',
                                color: 'rgba(255, 255, 255, 0.6)',
                                fontSize: '0.65rem',
                                fontWeight: 500
                            }}>
                                {currentShipmentIndex + 1} / {shipments.length}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Next Button - Hidden for now */}
                    {false && (
                        <Box sx={{
                            width: '36px',
                            height: '36px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            '&:hover': {
                                background: 'rgba(255, 255, 255, 0.1)',
                                transform: 'scale(1.1)'
                            }
                        }} onClick={handleNextShipment}>
                            <ChevronRightIcon sx={{ color: 'white', fontSize: '1.2rem' }} />
                        </Box>
                    )}
                </Box>
            )}

            {/* Region Navigation Controls (Bottom Left) - Only in Normal View */}
            {!loading && !isFullScreen && <RegionNavigationButtons isFullscreenMode={false} />}

            {/* Enhanced Top Right Controls */}
            {!isFullScreen && <TopControlsComponent isFullscreenMode={false} />}
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
                <TopControlsComponent isFullscreenMode={true} />

                {/* Full Screen Globe Container */}
                <Box className="globe-container" sx={{
                    position: 'relative',
                    width: '100vw',
                    height: '100vh'
                }}>
                    {globeContent}
                    
                    {/* Fullscreen Region Navigation Controls (Bottom Left) */}
                    {!loading && <RegionNavigationButtons isFullscreenMode={true} />}
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
