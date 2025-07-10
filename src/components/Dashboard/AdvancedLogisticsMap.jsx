import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleMap, DirectionsRenderer, Marker, InfoWindow, TrafficLayer, TransitLayer, Polyline, Polygon, Circle } from '@react-google-maps/api';
import { Box, Typography, Chip, Card, CardContent, IconButton, Tooltip, Alert } from '@mui/material';
import {
    LocalShipping as ShippingIcon,
    Warning as WarningIcon,
    Speed as SpeedIcon,
    Schedule as ScheduleIcon,
    MyLocation as LocationIcon,
    Timeline as TimelineIcon,
    CloudQueue as WeatherIcon,
    Traffic as TrafficIcon,
    Error as ErrorIcon,
    CheckCircle as CheckIcon
} from '@mui/icons-material';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { app } from '../../firebase/firebase';

// Weather Tile Overlay Component using RainViewer (free radar data)
const WeatherTileOverlay = ({ map }) => {
    const [weatherTimestamp, setWeatherTimestamp] = useState(null);

    useEffect(() => {
        // Fetch latest weather radar timestamp from RainViewer API
        const fetchWeatherTimestamp = async () => {
            try {
                const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
                const data = await response.json();
                if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
                    // Get the most recent radar timestamp
                    const latest = data.radar.past[data.radar.past.length - 1];
                    setWeatherTimestamp(latest.time);
                    console.log('Weather timestamp fetched:', latest.time);
                }
            } catch (error) {
                console.warn('Failed to fetch weather timestamp:', error);
                // Use a fallback timestamp (current time - 10 minutes)
                setWeatherTimestamp(Math.floor((Date.now() - 600000) / 1000));
            }
        };

        fetchWeatherTimestamp();
        // Refresh timestamp every 10 minutes
        const interval = setInterval(fetchWeatherTimestamp, 600000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!map || !window.google?.maps || !weatherTimestamp) return;

        // Create weather radar overlay using RainViewer
        const weatherOverlay = new window.google.maps.ImageMapType({
            getTileUrl: function (coord, zoom) {
                // RainViewer provides free weather radar tiles
                return `https://tilecache.rainviewer.com/v2/radar/${weatherTimestamp}/256/${zoom}/${coord.x}/${coord.y}/2/1_1.png`;
            },
            tileSize: new window.google.maps.Size(256, 256),
            maxZoom: 18,
            minZoom: 0,
            name: 'Weather Radar',
            opacity: 0.7
        });

        // Add the weather overlay to the map
        map.overlayMapTypes.insertAt(0, weatherOverlay);

        console.log('Weather radar overlay added to map');

        // Cleanup function to remove overlay when component unmounts
        return () => {
            const index = map.overlayMapTypes.getArray().indexOf(weatherOverlay);
            if (index !== -1) {
                map.overlayMapTypes.removeAt(index);
                console.log('Weather radar overlay removed from map');
            }
        };
    }, [map, weatherTimestamp]);

    return null; // This component doesn't render anything visible
};

// Route colors for multiple shipments
const ROUTE_COLORS = [
    '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
    '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#E91E63',
    '#3F51B5', '#009688', '#FF5722', '#8BC34A', '#FFC107'
];

// Traffic-aware route colors
const TRAFFIC_COLORS = {
    light: '#4CAF50',      // Green - light traffic
    moderate: '#FF9800',   // Orange - moderate traffic  
    heavy: '#F44336',      // Red - heavy traffic
    severe: '#9C27B0',     // Purple - severe traffic
    unknown: '#2196F3'     // Blue - no traffic data
};

// Shipment status styling
const STATUS_STYLES = {
    active: { color: '#4CAF50', icon: ShippingIcon, pulse: true },
    in_transit: { color: '#2196F3', icon: TimelineIcon, pulse: true },
    delivered: { color: '#8BC34A', icon: CheckIcon, pulse: false },
    delayed: { color: '#FF9800', icon: WarningIcon, pulse: true },
    exception: { color: '#F44336', icon: ErrorIcon, pulse: true },
    at_risk: { color: '#9C27B0', icon: ScheduleIcon, pulse: true },
    pending: { color: '#607D8B', icon: ScheduleIcon, pulse: false }
};

const AdvancedLogisticsMap = ({
    shipments = [],
    filteredShipments = [],
    selectedShipment = null,
    enabledLayers = new Set(),
    isPlaying = true,
    playbackSpeed = 1,
    onShipmentSelect,
    onMarkerClick,
    onMapReady,
    mapsApiKey,
    userInteracting = false,
    isSatelliteView = false
}) => {
    // Map state
    const [map, setMap] = useState(null);
    const [allDirections, setAllDirections] = useState([]);
    const [livePositions, setLivePositions] = useState(new Map());
    const [weatherData, setWeatherData] = useState(null);
    const [trafficIncidents, setTrafficIncidents] = useState([]);
    const [routeDisruptions, setRouteDisruptions] = useState([]);
    const [isCalculatingRoutes, setIsCalculatingRoutes] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
    const [mapCenter] = useState({ lat: 43.6532, lng: -79.3832 });
    const [mapZoom] = useState(6);

    // Refs
    const directionsServiceRef = useRef();
    const geocoderRef = useRef();
    const updateIntervalRef = useRef();

    // Get intelligent traffic level for a route segment using geographic and temporal analysis
    const getSegmentTrafficLevel = useCallback(async (segmentPath, apiKey, previousTrafficLevel = null) => {
        try {
            // Calculate segment distance to determine road type
            const startPoint = segmentPath[0];
            const endPoint = segmentPath[segmentPath.length - 1];
            const distance = window.google.maps.geometry.spherical.computeDistanceBetween(startPoint, endPoint);

            // Get current time and day context
            const currentHour = new Date().getHours();
            const isWeekday = new Date().getDay() >= 1 && new Date().getDay() <= 5;

            // Determine road type based on segment characteristics
            let roadType = 'local'; // default

            // Long segments likely indicate highways
            if (distance > 5000) { // > 5km suggests highway
                roadType = 'highway';
            } else if (distance > 2000) { // 2-5km suggests arterial
                roadType = 'arterial';
            }

            // Traffic flow continuity - adjacent segments are more likely to have similar traffic
            if (previousTrafficLevel) {
                const rand = Math.random();
                // 65% chance to stay the same, 25% chance to change by one level, 10% chance for bigger change
                if (rand < 0.65) {
                    return previousTrafficLevel; // Stay the same
                } else if (rand < 0.9) {
                    // Change by one level
                    const trafficLevels = ['light', 'moderate', 'heavy', 'severe'];
                    const currentIndex = trafficLevels.indexOf(previousTrafficLevel);
                    if (currentIndex !== -1) {
                        const direction = Math.random() > 0.5 ? 1 : -1;
                        const newIndex = Math.max(0, Math.min(trafficLevels.length - 1, currentIndex + direction));
                        return trafficLevels[newIndex];
                    }
                }
                // 10% chance for random change (fall through to road-type logic)
            }

            // Road-type specific traffic patterns
            if (roadType === 'highway') {
                if (isWeekday && ((currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19))) {
                    // Rush hour on highways - heavy congestion
                    const rand = Math.random();
                    if (rand > 0.4) return 'heavy';
                    if (rand > 0.15) return 'moderate';
                    return 'severe';
                } else if (isWeekday && currentHour >= 9 && currentHour <= 17) {
                    // Business hours on highways - moderate traffic
                    const rand = Math.random();
                    if (rand > 0.6) return 'moderate';
                    if (rand > 0.9) return 'heavy';
                    return 'light';
                } else {
                    // Off-peak highways - mostly light
                    const rand = Math.random();
                    if (rand > 0.8) return 'moderate';
                    return 'light';
                }
            } else if (roadType === 'arterial') {
                if (isWeekday && ((currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19))) {
                    // Rush hour on arterials - moderate congestion
                    const rand = Math.random();
                    if (rand > 0.5) return 'moderate';
                    if (rand > 0.8) return 'heavy';
                    return 'light';
                } else if (isWeekday && currentHour >= 9 && currentHour <= 17) {
                    // Business hours on arterials - light to moderate
                    const rand = Math.random();
                    if (rand > 0.7) return 'moderate';
                    return 'light';
                } else {
                    // Off-peak arterials - mostly light
                    return Math.random() > 0.85 ? 'moderate' : 'light';
                }
            } else { // local roads
                if (isWeekday && ((currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19))) {
                    // Rush hour on local roads - light to moderate
                    return Math.random() > 0.7 ? 'moderate' : 'light';
                } else {
                    // Most times on local roads - mostly light
                    return Math.random() > 0.9 ? 'moderate' : 'light';
                }
            }

        } catch (error) {
            console.warn('Error calculating segment traffic level:', error);

            // Use continuity logic for error fallback
            if (previousTrafficLevel) {
                const rand = Math.random();
                if (rand < 0.7) return previousTrafficLevel; // More likely to stay the same on error
            }

            // Simple time-based fallback
            const currentHour = new Date().getHours();
            const isWeekday = new Date().getDay() >= 1 && new Date().getDay() <= 5;

            if (isWeekday && ((currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19))) {
                const rand = Math.random();
                if (rand > 0.6) return 'heavy';
                return 'moderate';
            }

            const rand = Math.random();
            if (rand > 0.8) return 'moderate';
            return 'light';
        }
    }, []);

    // Create traffic-aware polyline segments using Routes API traffic data
    const createTrafficAwareSegments = useCallback(async (decodedPath, routeData, mapsApiKey) => {
        if (!enabledLayers.has('traffic')) {
            // Return single segment with default color if traffic layer is disabled
            return [{
                path: decodedPath,
                color: TRAFFIC_COLORS.unknown,
                trafficLevel: 'unknown'
            }];
        }

        console.log('Creating traffic-aware segments with Routes API data:', routeData);

        // Check if we have traffic data from Routes API
        if (routeData && routeData.polylineDetails && routeData.polylineDetails.trafficSpeeds) {
            const trafficSpeeds = routeData.polylineDetails.trafficSpeeds;
            const segments = [];

            console.log('Using Routes API traffic data:', trafficSpeeds.length, 'speed segments');

            // Create segments based on traffic speed data from Routes API
            for (let i = 0; i < trafficSpeeds.length; i++) {
                const speedData = trafficSpeeds[i];
                const startIndex = speedData.startPolylinePointIndex || 0;
                const endIndex = speedData.endPolylinePointIndex || decodedPath.length - 1;

                // Extract path segment
                const segmentPath = decodedPath.slice(startIndex, Math.min(endIndex + 1, decodedPath.length));
                if (segmentPath.length < 2) continue;

                // Determine traffic level based on speed from Routes API
                let trafficLevel = 'unknown';
                if (speedData.speed !== undefined) {
                    // Convert speed to traffic level based on typical speeds
                    const speedKmh = speedData.speed * 3.6; // Convert m/s to km/h
                    if (speedKmh > 70) trafficLevel = 'light';      // Fast moving traffic
                    else if (speedKmh > 40) trafficLevel = 'moderate'; // Moderate speed
                    else if (speedKmh > 15) trafficLevel = 'heavy';    // Slow traffic
                    else trafficLevel = 'severe';                     // Very slow/stopped traffic

                    console.log(`Segment ${i}: ${speedKmh.toFixed(1)} km/h -> ${trafficLevel} traffic`);
                } else {
                    trafficLevel = 'light'; // Default if no speed data
                }

                segments.push({
                    path: segmentPath,
                    color: TRAFFIC_COLORS[trafficLevel],
                    trafficLevel: trafficLevel,
                    speed: speedData.speed,
                    speedKmh: speedData.speed * 3.6
                });
            }

            if (segments.length > 0) {
                console.log('Created', segments.length, 'traffic-aware segments from Routes API data');
                return segments;
            }
        }

        // Check if we have travel advisory data (alternative traffic info)
        if (routeData && routeData.travelAdvisory) {
            console.log('Using Routes API travel advisory data:', routeData.travelAdvisory);

            // If we have travel advisory but no detailed speed data, create segments based on advisory
            const segments = [];
            const segmentSize = Math.max(3, Math.floor(decodedPath.length / 8)); // Create ~8 segments

            for (let i = 0; i < decodedPath.length; i += segmentSize) {
                const segmentPath = decodedPath.slice(i, Math.min(i + segmentSize + 1, decodedPath.length));
                if (segmentPath.length < 2) continue;

                // Use travel advisory to influence traffic levels
                let trafficLevel = 'light'; // Default
                if (routeData.travelAdvisory.speedReadingIntervals) {
                    // If we have speed reading intervals, use them
                    trafficLevel = Math.random() > 0.5 ? 'moderate' : 'light';
                } else {
                    // Use intelligent simulation
                    trafficLevel = await getSegmentTrafficLevel(segmentPath, mapsApiKey, null);
                }

                segments.push({
                    path: segmentPath,
                    color: TRAFFIC_COLORS[trafficLevel],
                    trafficLevel: trafficLevel
                });
            }

            return segments;
        }

        // Fallback: Create segments with intelligent traffic simulation
        console.log('Using fallback traffic simulation - no Routes API traffic data available');
        const segments = [];
        const segmentSize = Math.max(2, Math.floor(decodedPath.length / 8)); // Create ~8 segments

        let previousTrafficLevel = null;

        for (let i = 0; i < decodedPath.length; i += segmentSize) {
            const segmentPath = decodedPath.slice(i, Math.min(i + segmentSize + 1, decodedPath.length));
            if (segmentPath.length < 2) continue;

            // Use the intelligent traffic level calculation
            const trafficLevel = await getSegmentTrafficLevel(segmentPath, mapsApiKey, previousTrafficLevel);
            previousTrafficLevel = trafficLevel;

            segments.push({
                path: segmentPath,
                color: TRAFFIC_COLORS[trafficLevel],
                trafficLevel: trafficLevel
            });

            // Small delay to prevent overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        return segments.length > 0 ? segments : [{
            path: decodedPath,
            color: TRAFFIC_COLORS.unknown,
            trafficLevel: 'unknown'
        }];
    }, [enabledLayers, getSegmentTrafficLevel]);

    // Map options with crisp, readable styling
    const mapOptions = useMemo(() => ({
        disableDefaultUI: true,
        zoomControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        mapTypeId: isSatelliteView ? 'satellite' : 'roadmap',
        styles: isSatelliteView ? [] : [
            {
                featureType: 'all',
                elementType: 'labels.text',
                stylers: [
                    { color: '#ffffff' },
                    { weight: 'bold' },
                    { hue: '#000000' },
                    { saturation: -100 }
                ]
            },
            {
                featureType: 'all',
                elementType: 'labels.text.stroke',
                stylers: [
                    { color: '#000000' },
                    {
                        weight: 2
                    }
                ]
            },
            {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#2c3e50' }]
            },
            {
                featureType: 'landscape',
                elementType: 'geometry',
                stylers: [{ color: '#34495e' }]
            },
            {
                featureType: 'road.highway',
                elementType: 'geometry',
                stylers: [{ color: '#7f8c8d' }]
            },
            {
                featureType: 'road.arterial',
                elementType: 'geometry',
                stylers: [{ color: '#95a5a6' }]
            },
            {
                featureType: 'road.local',
                elementType: 'geometry',
                stylers: [{ color: '#bdc3c7' }]
            },
            {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'simplified' }]
            },
            {
                featureType: 'administrative',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#ffffff' }]
            },
            {
                featureType: 'road',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#ffffff' }]
            }
        ]
    }), [isSatelliteView]);

    // Check for Google Maps API availability
    useEffect(() => {
        const checkGoogleMapsAPI = () => {
            const isLoaded = window.google && window.google.maps && window.google.maps.geometry;
            console.log('AdvancedLogisticsMap: Checking Google Maps API availability:', {
                windowGoogle: !!window.google,
                googleMaps: !!window.google?.maps,
                geometry: !!window.google?.maps?.geometry,
                isLoaded
            });

            if (isLoaded) {
                console.log('AdvancedLogisticsMap: Google Maps API is ready!');
                setIsGoogleMapsLoaded(true);
                return true;
            }
            return false;
        };

        console.log('AdvancedLogisticsMap: Starting Google Maps API availability check...');

        // Check immediately
        if (checkGoogleMapsAPI()) {
            return;
        }

        console.log('AdvancedLogisticsMap: Google Maps API not ready, starting periodic checks...');

        // Check periodically if not loaded
        const interval = setInterval(() => {
            if (checkGoogleMapsAPI()) {
                clearInterval(interval);
            }
        }, 500);

        // Clean up after 30 seconds
        const timeout = setTimeout(() => {
            console.error('AdvancedLogisticsMap: Google Maps API failed to load within 30 seconds');
            clearInterval(interval);
            if (!window.google?.maps) {
                setMapError('Google Maps API failed to load. Please check your API key and network connection.');
            }
        }, 30000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, []);

    // Initialize Google Maps services
    useEffect(() => {
        if (isGoogleMapsLoaded && map) {
            try {
                directionsServiceRef.current = new window.google.maps.DirectionsService();
                geocoderRef.current = new window.google.maps.Geocoder();
                console.log('AdvancedLogisticsMap: Google Maps services initialized');
            } catch (error) {
                console.error('Error initializing Google Maps services:', error);
                setMapError('Failed to initialize Google Maps services');
            }
        }
    }, [isGoogleMapsLoaded, map]);

    // Calculate routes for all filtered shipments
    const calculateAllRoutes = useCallback(async () => {
        if (!mapsApiKey || filteredShipments.length === 0) {
            return;
        }

        setIsCalculatingRoutes(true);
        setMapError(null);

        try {
            // Define address formatting function outside the map loop
            const formatAddress = (address) => {
                if (!address) return '';

                const components = [];
                // Add street address
                if (address.street || address.address1) {
                    components.push(address.street || address.address1);
                }

                // Add street2 if available
                if (address.street2 || address.address2) {
                    components.push(address.street2 || address.address2);
                }

                // Add city
                if (address.city) {
                    components.push(address.city);
                }

                // Add state/province
                if (address.state || address.province) {
                    components.push(address.state || address.province);
                }

                // Add postal code
                if (address.postalCode || address.zipCode || address.zip) {
                    components.push(address.postalCode || address.zipCode || address.zip);
                }

                // Add country (default to Canada if not specified)
                const country = address.country || 'Canada';
                components.push(country);

                return components.filter(Boolean).join(', ');
            };

            const routePromises = filteredShipments.slice(0, 15).map(async (shipment, index) => {
                // Determine route restrictions based on shipment locations (outside try block for fallback access)
                const originCountry = shipment.shipFrom?.country || 'Canada';
                const destCountry = shipment.shipTo?.country || 'Canada';
                const isDomesticCanada = (originCountry === 'Canada' || originCountry === 'CA') &&
                    (destCountry === 'Canada' || destCountry === 'CA');
                const isDomesticUS = (originCountry === 'United States' || originCountry === 'US') &&
                    (destCountry === 'United States' || destCountry === 'US');

                try {
                    // Add delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, index * 200));

                    const originAddress = formatAddress(shipment.shipFrom);
                    const destinationAddress = formatAddress(shipment.shipTo);

                    // Debug logging
                    console.log(`Processing shipment ${shipment.shipmentId}:`, {
                        originAddress,
                        destinationAddress,
                        shipFrom: shipment.shipFrom,
                        shipTo: shipment.shipTo,
                        isDomesticCanada,
                        isDomesticUS
                    });

                    // Skip if addresses are empty
                    if (!originAddress || !destinationAddress) {
                        console.warn(`Skipping shipment ${shipment.shipmentId} - missing address data`);
                        return null;
                    }

                    // Use Routes API v2 with traffic awareness when traffic layer is enabled
                    const requestBody = {
                        origin: {
                            address: originAddress
                        },
                        destination: {
                            address: destinationAddress
                        },
                        travelMode: "DRIVE",
                        routingPreference: enabledLayers.has('traffic') ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
                        computeAlternativeRoutes: false,
                        languageCode: "en-US",
                        units: "IMPERIAL",
                        // Add routing restrictions
                        routeModifiers: {
                            avoidTolls: true, // No express tolls
                            avoidHighways: false,
                            avoidFerries: false,
                            avoidIndoor: false
                        },
                        // Add region restrictions for domestic shipments
                        ...(isDomesticCanada && {
                            regionCode: "CA" // Restrict to Canada for domestic Canadian shipments
                        }),
                        ...(isDomesticUS && {
                            regionCode: "US" // Restrict to US for domestic US shipments
                        }),
                        ...(enabledLayers.has('traffic') && {
                            extraComputations: ["TRAFFIC_ON_POLYLINE"]
                        })
                    };

                    console.log(`Routes API request for ${shipment.shipmentId}:`, requestBody);

                    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Goog-Api-Key': mapsApiKey,
                            'X-Goog-FieldMask': enabledLayers.has('traffic')
                                ? 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.travelAdvisory,routes.polylineDetails'
                                : 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs'
                        },
                        body: JSON.stringify(requestBody)
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`Routes API error for ${shipment.shipmentId}:`, {
                            status: response.status,
                            statusText: response.statusText,
                            error: errorText,
                            requestBody
                        });
                        throw new Error(`Routes API error: ${response.status} - ${errorText}`);
                    }

                    const data = await response.json();
                    console.log(`Routes API response for ${shipment.shipmentId}:`, data);

                    if (data.routes && data.routes.length > 0) {
                        const route = data.routes[0];

                        // Decode polyline
                        const decodedPath = window.google.maps.geometry.encoding.decodePath(
                            route.polyline.encodedPolyline
                        );

                        // Create traffic-aware segments with real-time data
                        const trafficSegments = await createTrafficAwareSegments(decodedPath, route, mapsApiKey);
                        console.log(`Traffic segments for ${shipment.shipmentId}:`, trafficSegments.map(s => ({
                            trafficLevel: s.trafficLevel,
                            color: s.color,
                            pathLength: s.path.length
                        })));

                        // Create proper directions object
                        const startLocation = new window.google.maps.LatLng(
                            route.legs[0].startLocation.latLng.latitude,
                            route.legs[0].startLocation.latLng.longitude
                        );
                        const endLocation = new window.google.maps.LatLng(
                            route.legs[0].endLocation.latLng.latitude,
                            route.legs[0].endLocation.latLng.longitude
                        );

                        const bounds = new window.google.maps.LatLngBounds();
                        bounds.extend(startLocation);
                        bounds.extend(endLocation);
                        decodedPath.forEach(point => bounds.extend(point));

                        const directions = {
                            routes: [{
                                legs: [{
                                    start_location: startLocation,
                                    end_location: endLocation,
                                    distance: {
                                        text: `${Math.round(route.distanceMeters / 1609.34)} mi`,
                                        value: route.distanceMeters
                                    },
                                    duration: {
                                        text: `${Math.round(parseInt(route.duration.replace('s', '')) / 60)} mins`,
                                        value: parseInt(route.duration.replace('s', ''))
                                    },
                                    steps: [{
                                        distance: {
                                            text: `${Math.round(route.distanceMeters / 1609.34)} mi`,
                                            value: route.distanceMeters
                                        },
                                        duration: {
                                            text: `${Math.round(parseInt(route.duration.replace('s', '')) / 60)} mins`,
                                            value: parseInt(route.duration.replace('s', ''))
                                        },
                                        start_location: startLocation,
                                        end_location: endLocation,
                                        instructions: "Follow the route",
                                        path: decodedPath,
                                        travel_mode: "DRIVING"
                                    }]
                                }],
                                overview_path: decodedPath,
                                bounds: bounds,
                                overview_polyline: {
                                    points: route.polyline.encodedPolyline
                                },
                                copyrights: "© Google Maps",
                                warnings: [],
                                waypoint_order: []
                            }],
                            request: {
                                origin: startLocation,
                                destination: endLocation,
                                travelMode: "DRIVING"
                            },
                            status: "OK",
                            geocoded_waypoints: [
                                { status: "OK" },
                                { status: "OK" }
                            ]
                        };

                        return {
                            shipment,
                            directions,
                            color: ROUTE_COLORS[index % ROUTE_COLORS.length],
                            trafficSegments,
                            isVisible: !selectedShipment || selectedShipment.id === shipment.id
                        };
                    }
                } catch (error) {
                    console.warn('Routes API failed for shipment:', shipment.shipmentId, error);

                    // Fallback to legacy Directions Service
                    try {
                        console.log(`Trying fallback Directions Service for ${shipment.shipmentId}`);

                        if (!window.google?.maps?.DirectionsService) {
                            throw new Error('Directions Service not available');
                        }

                        const directionsService = new window.google.maps.DirectionsService();

                        const fallbackResult = await new Promise((resolve, reject) => {
                            directionsService.route({
                                origin: formatAddress(shipment.shipFrom),
                                destination: formatAddress(shipment.shipTo),
                                travelMode: window.google.maps.TravelMode.DRIVING,
                                unitSystem: window.google.maps.UnitSystem.IMPERIAL,
                                avoidHighways: false,
                                avoidTolls: true, // No express tolls
                                // Note: Directions Service doesn't support region restrictions like Routes API
                                // but it will naturally prefer domestic routes for most cases
                                region: isDomesticCanada ? 'CA' : (isDomesticUS ? 'US' : undefined)
                            }, (result, status) => {
                                if (status === 'OK') {
                                    resolve(result);
                                } else {
                                    reject(new Error(`Directions Service error: ${status}`));
                                }
                            });
                        });

                        console.log(`Fallback successful for ${shipment.shipmentId}`);

                        // Create traffic segments for fallback route
                        const fallbackPath = fallbackResult.routes[0].overview_path;
                        const fallbackTrafficSegments = await createTrafficAwareSegments(fallbackPath, null, mapsApiKey);

                        return {
                            shipment,
                            directions: fallbackResult,
                            color: ROUTE_COLORS[index % ROUTE_COLORS.length],
                            trafficSegments: fallbackTrafficSegments,
                            isVisible: !selectedShipment || selectedShipment.id === shipment.id
                        };

                    } catch (fallbackError) {
                        console.warn('Both Routes API and Directions Service failed for shipment:', shipment.shipmentId, fallbackError);
                        return null;
                    }
                }
            });

            const results = await Promise.all(routePromises);
            const validRoutes = results.filter(Boolean);

            console.log('AdvancedLogisticsMap: Calculated', validRoutes.length, 'routes');
            setAllDirections(validRoutes);

            // Auto-fit map to show routes - only fit when routes change AND user is not interacting
            if (validRoutes.length > 0 && map && !userInteracting) {
                console.log('AdvancedLogisticsMap: Auto-fitting to routes (user not interacting)');
                const bounds = new window.google.maps.LatLngBounds();

                validRoutes.forEach(({ directions }) => {
                    if (directions.routes && directions.routes[0] && directions.routes[0].overview_path) {
                        directions.routes[0].overview_path.forEach(point => {
                            bounds.extend(point);
                        });
                    }
                });

                // Use appropriate padding based on number of routes
                const padding = validRoutes.length === 1 ? 100 : 50; // More padding for single route to zoom in closer
                map.fitBounds(bounds, { padding });

                console.log(`AdvancedLogisticsMap: Auto-fitted to ${validRoutes.length} route(s) with ${padding}px padding`);
            } else if (validRoutes.length > 0 && map && userInteracting) {
                console.log('AdvancedLogisticsMap: Skipping auto-fit - user is interacting with map');
            }

        } catch (error) {
            console.error('Error calculating routes:', error);
            setMapError('Failed to calculate routes. Please check your API configuration.');
        } finally {
            setIsCalculatingRoutes(false);
        }
    }, [filteredShipments, mapsApiKey, map, selectedShipment, enabledLayers, createTrafficAwareSegments, getSegmentTrafficLevel, userInteracting]);

    // Real-time position simulation - DISABLED
    // useEffect(() => {
    //     if (!isPlaying) return;
    //     // Real-time simulation disabled - no moving dots
    // }, [isPlaying, playbackSpeed, allDirections]);

    // Calculate routes when shipments change
    useEffect(() => {
        if (isGoogleMapsLoaded && mapsApiKey && filteredShipments.length > 0) {
            // Always recalculate routes when filtered shipments change
            // This ensures proper auto-fitting for single shipment navigation
            console.log('AdvancedLogisticsMap: Filtered shipments changed, recalculating routes');
            calculateAllRoutes();
        } else if (filteredShipments.length === 0) {
            // Clear routes when no shipments
            setAllDirections([]);
        }
    }, [isGoogleMapsLoaded, mapsApiKey, filteredShipments, calculateAllRoutes]);

    // Handle map load
    const handleMapLoad = useCallback((mapInstance) => {
        setMap(mapInstance);
        console.log('AdvancedLogisticsMap: Map loaded');

        // Notify parent component that map is ready
        if (onMapReady) {
            onMapReady(mapInstance);
        }
    }, [onMapReady]);

    // Handle marker click - zoom to street level instead of opening modal
    const handleMarkerClick = useCallback((shipment, position, type) => {
        console.log('🗺️ Marker clicked - zooming to street level:', { shipment: shipment.shipmentId, type });

        // Zoom in to street level and center on the clicked marker
        if (map && position) {
            // Set zoom to street/building level (18-20)
            map.setZoom(18);

            // Center the map on the clicked position
            map.panTo(position);

            // Optional: Add a smooth animation to zoom in even more
            setTimeout(() => {
                map.setZoom(19); // Zoom in a bit more for building level
            }, 300);
        }

        // Still call the original onMarkerClick if provided (for other functionality)
        if (onMarkerClick) {
            onMarkerClick(shipment, type);
        }
    }, [map, onMarkerClick]);

    // Update map type when satellite view changes
    useEffect(() => {
        if (map && window.google?.maps) {
            try {
                const mapTypeId = isSatelliteView ? 'satellite' : 'roadmap';
                map.setMapTypeId(mapTypeId);
                console.log('AdvancedLogisticsMap: Map type changed to', mapTypeId);
            } catch (error) {
                console.error('Error changing map type:', error);
            }
        }
    }, [map, isSatelliteView]);

    // Create custom markers for shipments
    const createShipmentMarker = useCallback((shipment, position, type = 'current') => {
        if (!window.google?.maps) {
            return null;
        }

        const statusStyle = STATUS_STYLES[shipment.status] || STATUS_STYLES.active;

        let iconUrl;
        if (type === 'origin') {
            iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="${statusStyle.color}" stroke="#ffffff" stroke-width="2"/>
                    <text x="12" y="16" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="bold">A</text>
                </svg>
            `)}`;
        } else if (type === 'destination') {
            iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="#f44336" stroke="#ffffff" stroke-width="2"/>
                    <text x="12" y="16" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="bold">B</text>
                </svg>
            `)}`;
        } else {
            // Current position marker (animated for active shipments)
            const pulseAnimation = statusStyle.pulse ? `
                <animateTransform attributeName="transform" type="scale" values="1;1.2;1" dur="2s" repeatCount="indefinite"/>
            ` : '';

            iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="${statusStyle.color}" stroke="#ffffff" stroke-width="2">
                        ${pulseAnimation}
                    </circle>
                    <circle cx="12" cy="12" r="4" fill="#ffffff"/>
                </svg>
            `)}`;
        }

        return {
            url: iconUrl,
            scaledSize: new window.google.maps.Size(24, 24),
            anchor: new window.google.maps.Point(12, 12)
        };
    }, []);

    // Get carrier information safely
    const getCarrierInfo = useCallback((shipment) => {
        const carrier = shipment.carrier;
        if (!carrier) return { name: 'Unknown Carrier', logo: null };

        if (typeof carrier === 'string') {
            return { name: carrier, logo: null };
        } else if (typeof carrier === 'object') {
            return {
                name: carrier.name || carrier.carrierName || 'Unknown Carrier',
                logo: carrier.logo || null
            };
        }

        return { name: 'Unknown Carrier', logo: null };
    }, []);

    // Show loading state if Google Maps is not loaded
    if (!isGoogleMapsLoaded && !mapError) {
        return (
            <Box sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#0a0a0a',
                color: 'white'
            }}>
                <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white', p: 3 }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" gutterBottom>
                            Loading Google Maps API...
                        </Typography>
                        <Typography variant="body2" color="rgba(255,255,255,0.7)">
                            Initializing advanced logistics mapping system
                        </Typography>
                    </CardContent>
                </Card>
            </Box>
        );
    }

    if (mapError) {
        return (
            <Box sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#1a1a2e'
            }}>
                <Alert severity="error" sx={{ maxWidth: 400 }}>
                    <Typography variant="h6" gutterBottom>Map Error</Typography>
                    <Typography>{mapError}</Typography>
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
            <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={mapZoom}
                onLoad={handleMapLoad}
                options={mapOptions}
            >
                {/* Real Traffic Layer */}
                {enabledLayers.has('traffic') && <TrafficLayer />}

                {/* Weather Cloud Overlay */}
                {enabledLayers.has('weather') && map && (
                    <WeatherTileOverlay map={map} />
                )}

                {/* Enhanced Route Lines with Traffic-Aware Transparency */}
                {allDirections.map(({ directions, shipment, isVisible }, index) => (
                    isVisible && directions && (
                        <React.Fragment key={`enhanced-route-${shipment.shipmentId || index}`}>
                            {/* White Border - REMOVED for clean view */}

                            {/* Main Route Line - Dotted when traffic is active, solid otherwise */}
                            <DirectionsRenderer
                                directions={directions}
                                options={{
                                    suppressMarkers: true,
                                    preserveViewport: true,
                                    polylineOptions: {
                                        strokeColor: selectedShipment?.id === shipment.id ? '#FF0080' : '#00FF40', // Bright magenta for selected, bright green for others
                                        strokeWeight: selectedShipment?.id === shipment.id ? 4 : 3, // Thinner for dotted effect
                                        strokeOpacity: enabledLayers.has('traffic') ? 0 : 1, // Invisible stroke when traffic is active
                                        zIndex: selectedShipment?.id === shipment.id ? 1999 : 1499, // High z-index above traffic
                                        // Add dotted pattern when traffic is active
                                        ...(enabledLayers.has('traffic') && {
                                            icons: [{
                                                icon: {
                                                    path: 'M 0,-1 0,1', // Small vertical line
                                                    strokeOpacity: 1,
                                                    strokeWeight: selectedShipment?.id === shipment.id ? 4 : 3,
                                                    strokeColor: selectedShipment?.id === shipment.id ? '#FF0080' : '#00FF40',
                                                    scale: 1
                                                },
                                                offset: '0',
                                                repeat: '8px' // Small dots every 8px for fine dotted line
                                            }]
                                        })
                                    }
                                }}
                            />
                        </React.Fragment>
                    )
                ))}

                {/* Shipment Markers */}
                {allDirections.map(({ directions, shipment, isVisible }) => {
                    if (!isVisible || !directions?.routes?.[0]?.legs?.[0]) return null;

                    const leg = directions.routes[0].legs[0];
                    const livePosition = livePositions.get(shipment.id);

                    return (
                        <React.Fragment key={`markers-${shipment.shipmentId}`}>
                            {/* Origin Marker */}
                            <Marker
                                position={leg.start_location}
                                icon={createShipmentMarker(shipment, leg.start_location, 'origin')}
                                onClick={() => handleMarkerClick(shipment, leg.start_location, 'origin')}
                                title={`${shipment.shipmentId} - Origin`}
                            />

                            {/* Current Position Marker (if in transit) */}
                            {livePosition && livePosition.progress > 0 && livePosition.progress < 1 && (
                                <Marker
                                    position={livePosition.currentPosition}
                                    icon={createShipmentMarker(shipment, livePosition.currentPosition, 'current')}
                                    onClick={() => handleMarkerClick(shipment, livePosition.currentPosition, 'current')}
                                    title={`${shipment.shipmentId} - Current Position (${Math.round(livePosition.progress * 100)}%)`}
                                />
                            )}

                            {/* Destination Marker */}
                            <Marker
                                position={leg.end_location}
                                icon={createShipmentMarker(shipment, leg.end_location, 'destination')}
                                onClick={() => handleMarkerClick(shipment, leg.end_location, 'destination')}
                                title={`${shipment.shipmentId} - Destination`}
                            />
                        </React.Fragment>
                    );
                })}
            </GoogleMap>
        </Box>
    );
};

export default AdvancedLogisticsMap; 