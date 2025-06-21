import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    IconButton,
    Chip,
    Collapse,
    Avatar,
    CircularProgress,
    LinearProgress
} from '@mui/material';

// Icons
import {
    SkipNext as NextIcon,
    SkipPrevious as PrevIcon,
    Timeline as TimelineIcon,
    Warning as WarningIcon,
    CheckCircle as CheckIcon,
    LocalShipping as ShippingIcon,
    Settings as SettingsIcon,
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    CalendarToday as CalendarIcon,
    LocationOn as LocationIcon,
    Traffic as TrafficIcon,
    Inventory as BoxIcon // Box icon for Ready to Ship
} from '@mui/icons-material';

import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { app } from '../../firebase/firebase';
import AdvancedLogisticsMap from './AdvancedLogisticsMap';
import StatusChip from '../StatusChip/StatusChip';

// Real-time status definitions - UPDATED with new statuses and icons
const SHIPMENT_STATUSES = {
    all: { label: 'All', color: '#9C27B0', icon: CalendarIcon },
    ready_to_ship: { label: 'Ready to Ship', color: '#FFFFFF', icon: BoxIcon },
    in_transit: { label: 'In Transit', color: '#2196F3', icon: ShippingIcon }, // Changed to truck icon
    delivered: { label: 'Delivered', color: '#8BC34A', icon: CheckIcon },
    delayed: { label: 'Delayed', color: '#FF9800', icon: WarningIcon }
};



const LogisticsCommandCenter = ({ shipments = [], onShipmentSelect, onRouteClick }) => {
    // Core state
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [currentShipmentIndex, setCurrentShipmentIndex] = useState(0);
    const [focusedShipments, setFocusedShipments] = useState([]);
    const [activeFilters, setActiveFilters] = useState(new Set(['all'])); // Default to 'all'
    const [isPlaying, setIsPlaying] = useState(true);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isLoadingNext, setIsLoadingNext] = useState(false);
    const [autoTimer, setAutoTimer] = useState(30); // 30 second countdown (extended from 10)
    const [isPaused, setIsPaused] = useState(false);

    // Map state
    const [map, setMap] = useState(null);
    const [mapCenter, setMapCenter] = useState({ lat: 43.6532, lng: -79.3832 });
    const [mapZoom, setMapZoom] = useState(6);
    const [enabledLayers, setEnabledLayers] = useState(new Set(['weather'])); // Traffic off by default

    // User interaction tracking
    const [userInteracting, setUserInteracting] = useState(false);
    const userInteractionTimeoutRef = useRef();

    // Real-time data - SIMPLIFIED
    // Removed unused live position tracking states
    const [carrierLogos, setCarrierLogos] = useState({});

    // UI state
    const [showControls, setShowControls] = useState(true);
    const [mapsApiKey, setMapsApiKey] = useState(null);

    // Refs
    const updateIntervalRef = useRef();
    const mapRef = useRef();

    // Add new prop for opening shipment detail modal
    const [onViewShipmentDetail, setOnViewShipmentDetail] = useState(null);

    // Filter shipments based on active filters and 10-day limit
    const filteredShipments = useMemo(() => {
        // First filter by date - only show shipments from last 10 days
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

        const recentShipments = shipments.filter(shipment => {
            // Check various date fields for when shipment was created
            const createdDate = shipment.createdAt || shipment.bookedAt || shipment.shipmentDate;
            if (!createdDate) return false;

            let shipmentDate;
            if (createdDate.toDate) {
                // Firestore timestamp
                shipmentDate = createdDate.toDate();
            } else if (createdDate.seconds) {
                // Timestamp object
                shipmentDate = new Date(createdDate.seconds * 1000);
            } else {
                // Regular date
                shipmentDate = new Date(createdDate);
            }

            return shipmentDate >= tenDaysAgo;
        });

        // If 'all' is selected, return all recent shipments
        if (activeFilters.has('all')) {
            return recentShipments;
        }

        // Otherwise filter by status categories
        return recentShipments.filter(shipment => {
            if (activeFilters.size === 0) return true;

            // Map global shipment status to our categories
            const status = shipment.status?.toLowerCase() || '';
            let category = 'ready_to_ship'; // Default category

            // Use global status mapping
            if (status === 'delivered') {
                category = 'delivered';
            } else if (status === 'in_transit' || status === 'in transit' || status === 'picked_up') {
                category = 'in_transit';
            } else if (status === 'delayed' || status === 'exception' || status === 'on_hold' || shipment.delayedReason) {
                category = 'delayed';
            } else if (status === 'pending' || status === 'scheduled' || status === 'ready_for_pickup' || status === 'draft') {
                category = 'ready_to_ship';
            }

            return activeFilters.has(category);
        });
    }, [shipments, activeFilters]);

    // Calculate status counts for scorecards (including 10-day filter)
    const statusCounts = useMemo(() => {
        // First filter by date - only count shipments from last 10 days
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

        const recentShipments = shipments.filter(shipment => {
            const createdDate = shipment.createdAt || shipment.bookedAt || shipment.shipmentDate;
            if (!createdDate) return false;

            let shipmentDate;
            if (createdDate.toDate) {
                shipmentDate = createdDate.toDate();
            } else if (createdDate.seconds) {
                shipmentDate = new Date(createdDate.seconds * 1000);
            } else {
                shipmentDate = new Date(createdDate);
            }

            return shipmentDate >= tenDaysAgo;
        });

        const counts = {};
        Object.keys(SHIPMENT_STATUSES).forEach(status => {
            counts[status] = 0;
        });

        // Count all recent shipments for 'all' category
        counts.all = recentShipments.length;

        // Count by categories
        recentShipments.forEach(shipment => {
            const status = shipment.status?.toLowerCase() || '';
            let category = 'ready_to_ship';

            if (status === 'delivered') {
                category = 'delivered';
            } else if (status === 'in_transit' || status === 'in transit' || status === 'picked_up') {
                category = 'in_transit';
            } else if (status === 'delayed' || status === 'exception' || status === 'on_hold' || shipment.delayedReason) {
                category = 'delayed';
            } else if (status === 'pending' || status === 'scheduled' || status === 'ready_for_pickup' || status === 'draft') {
                category = 'ready_to_ship';
            }

            counts[category]++;
        });

        return counts;
    }, [shipments]);

    // Real-time position simulation - DISABLED
    // This would be used for live position tracking if implemented
    // For now, we focus on route display without animated positions

    // Handle filter toggle with timer restart
    const handleFilterToggle = useCallback((status) => {
        console.log(`🎯 FILTER TOGGLE: Clicked ${status}`);
        console.log(`🎯 BEFORE: activeFilters =`, Array.from(activeFilters));

        setActiveFilters(prev => {
            const newFilters = new Set(prev);

            // If clicking 'all', clear other filters and set only 'all'
            if (status === 'all') {
                console.log(`🎯 Setting filter to 'all' - will show all shipments`);
                return new Set(['all']);
            }

            // If clicking any other status while 'all' is active, remove 'all' and add the new status
            if (newFilters.has('all')) {
                newFilters.delete('all');
                newFilters.add(status);
                console.log(`🎯 Removed 'all', added '${status}'`);
            } else {
                // Normal toggle behavior for specific statuses
                if (newFilters.has(status)) {
                    newFilters.delete(status);
                    console.log(`🎯 Removed '${status}' from filters`);
                } else {
                    newFilters.add(status);
                    console.log(`🎯 Added '${status}' to filters`);
                }
            }

            console.log(`🎯 AFTER: activeFilters =`, Array.from(newFilters));
            return newFilters;
        });

        // Restart the timer when filters change
        setAutoTimer(30);
        setIsPaused(false); // Resume auto-switching

        console.log(`🎯 Filter toggled for ${status}, timer restarted`);
    }, [activeFilters]);

    // Enhanced debugging for filtered shipments
    useEffect(() => {
        console.log(`🔍 FILTERING DEBUG:`);
        console.log(`🔍 Total shipments: ${shipments.length}`);
        console.log(`🔍 Active filters:`, Array.from(activeFilters));
        console.log(`🔍 Filtered shipments: ${filteredShipments.length}`);
        console.log(`🔍 Status counts:`, statusCounts);

        // Log first few shipments and their statuses for debugging
        if (shipments.length > 0) {
            console.log(`🔍 Sample shipment statuses:`);
            shipments.slice(0, 5).forEach((shipment, index) => {
                console.log(`  ${index + 1}. ${shipment.shipmentID}: status="${shipment.status}"`);
            });
        }

        if (filteredShipments.length > 0) {
            console.log(`🔍 Filtered shipment IDs:`, filteredShipments.map(s => s.shipmentID).join(', '));
        }
    }, [shipments, activeFilters, filteredShipments, statusCounts]);

    // Navigation controls with auto-zoom and loading states
    const handlePrevious = useCallback(() => {
        if (filteredShipments.length === 0) return;
        setIsLoadingNext(true);
        setAutoTimer(30); // Reset timer to 30 seconds

        const newIndex = currentShipmentIndex > 0 ? currentShipmentIndex - 1 : filteredShipments.length - 1;
        const newShipment = filteredShipments[newIndex];
        setCurrentShipmentIndex(newIndex);
        setSelectedShipment(newShipment);

        // Simulate loading delay
        setTimeout(() => setIsLoadingNext(false), 500);
        console.log(`LogisticsCommandCenter: Navigated to previous shipment (${newIndex + 1}/${filteredShipments.length})`);
    }, [currentShipmentIndex, filteredShipments]);

    const handleNext = useCallback(() => {
        if (filteredShipments.length === 0) return;
        setIsLoadingNext(true);
        setAutoTimer(30); // Reset timer to 30 seconds

        const newIndex = currentShipmentIndex < filteredShipments.length - 1 ? currentShipmentIndex + 1 : 0;
        const newShipment = filteredShipments[newIndex];
        setCurrentShipmentIndex(newIndex);
        setSelectedShipment(newShipment);

        // Simulate loading delay
        setTimeout(() => setIsLoadingNext(false), 500);
        console.log(`LogisticsCommandCenter: Navigated to next shipment (${newIndex + 1}/${filteredShipments.length})`);
    }, [currentShipmentIndex, filteredShipments]);

    // Auto-advance timer
    useEffect(() => {
        if (isPaused || filteredShipments.length <= 1) return;

        const interval = setInterval(() => {
            setAutoTimer(prev => {
                if (prev <= 1) {
                    handleNext();
                    return 30; // Reset to 30 seconds
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isPaused, filteredShipments.length, handleNext]);

    // Pause/Resume controls
    const handleTogglePlayPause = useCallback(() => {
        setIsPaused(!isPaused);
    }, [isPaused]);

    // Focus on specific shipment using real route data
    const focusOnShipment = useCallback((shipment) => {
        setSelectedShipment(shipment);

        // Signal to AdvancedLogisticsMap that it should auto-fit to the selected shipment
        // The actual fitting will be done by AdvancedLogisticsMap when routes are ready
        console.log(`LogisticsCommandCenter: Selected shipment ${shipment.shipmentID || 'N/A'} (ID: ${shipment.id}) for auto-focus`);
    }, []);

    // Auto-select first shipment when filtered shipments change
    useEffect(() => {
        if (filteredShipments.length > 0) {
            setCurrentShipmentIndex(0);
            setSelectedShipment(filteredShipments[0]);
            console.log(`LogisticsCommandCenter: Selected first shipment from ${filteredShipments.length} filtered shipments`);
        } else {
            // Clear everything when no shipments match the filter
            setSelectedShipment(null);
            setCurrentShipmentIndex(0);
            setIsPaused(true); // Pause auto-switching when no shipments
            console.log('LogisticsCommandCenter: No shipments found for current filter - clearing all routes and pausing');
        }
    }, [filteredShipments]);

    // Auto-zoom logic is now handled by AdvancedLogisticsMap when routes are ready
    // No need for timing-based delays or fake coordinates

    // Fetch Google Maps API key and load API
    useEffect(() => {
        const fetchApiKeyAndLoadMaps = async () => {
            try {
                console.log('LogisticsCommandCenter: Fetching API key...');
                const db = getFirestore(app);
                const keysSnapshot = await getDocs(collection(db, 'keys'));
                if (!keysSnapshot.empty) {
                    const firstDoc = keysSnapshot.docs[0];
                    const key = firstDoc.data().googleAPI;
                    if (key) {
                        console.log('LogisticsCommandCenter: API key found, loading Google Maps...');
                        setMapsApiKey(key);

                        // Load Google Maps API if not already loaded
                        if (!window.google || !window.google.maps) {
                            console.log('LogisticsCommandCenter: Loading Google Maps API script...');
                            const script = document.createElement('script');
                            script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry,routes`;
                            script.async = true;
                            script.defer = true;

                            // Wait for the script to load
                            await new Promise((resolve, reject) => {
                                script.onload = () => {
                                    console.log('LogisticsCommandCenter: Google Maps API loaded successfully');
                                    resolve();
                                };
                                script.onerror = (error) => {
                                    console.error('LogisticsCommandCenter: Failed to load Google Maps API:', error);
                                    reject(error);
                                };
                                document.head.appendChild(script);
                            });
                        } else {
                            console.log('LogisticsCommandCenter: Google Maps API already loaded');
                        }
                    } else {
                        console.error('LogisticsCommandCenter: No API key found in keys collection');
                    }
                } else {
                    console.error('LogisticsCommandCenter: No keys document found');
                }
            } catch (error) {
                console.error('LogisticsCommandCenter: Error fetching API key or loading Maps:', error);
            }
        };

        fetchApiKeyAndLoadMaps();
    }, []);

    // Handle marker clicks
    const handleMarkerClick = useCallback((shipment, type) => {
        setSelectedShipment(shipment);
        if (onShipmentSelect) {
            onShipmentSelect(shipment);
        }
    }, [onShipmentSelect]);

    // Track user interactions with the map
    const handleUserInteraction = useCallback(() => {
        setUserInteracting(true);

        // Clear existing timeout
        if (userInteractionTimeoutRef.current) {
            clearTimeout(userInteractionTimeoutRef.current);
        }

        // Set timeout to stop tracking user interaction after 3 seconds of inactivity
        userInteractionTimeoutRef.current = setTimeout(() => {
            setUserInteracting(false);
        }, 3000);
    }, []);

    // Handle map ready and set up interaction listeners
    const handleMapReady = useCallback((mapInstance) => {
        setMap(mapInstance);
        console.log('LogisticsCommandCenter: Map instance received');

        // Add listeners for user interactions
        if (mapInstance) {
            mapInstance.addListener('zoom_changed', handleUserInteraction);
            mapInstance.addListener('dragstart', handleUserInteraction);
            mapInstance.addListener('bounds_changed', handleUserInteraction);
        }
    }, [handleUserInteraction]);

    // Helper functions
    const interpolatePosition = (shipment, progress) => {
        // This would be used for real-time position tracking if implemented
        // For now, not used since we focus on route display
        return { lat: 0, lng: 0 };
    };

    // Comprehensive carrier logo logic from existing components
    const getCarrierLogo = useCallback((shipment) => {
        if (!shipment) return '/images/carrier-badges/solushipx.png';

        // Check if we already have the logo cached
        const carrierKey = shipment.id;
        if (carrierLogos[carrierKey]) {
            return carrierLogos[carrierKey];
        }

        // Extract carrier name from various possible fields
        let carrierName = '';
        if (shipment.carrier?.name) {
            carrierName = shipment.carrier.name;
        } else if (shipment.carrierName) {
            carrierName = shipment.carrierName;
        } else if (shipment.selectedCarrier) {
            carrierName = shipment.selectedCarrier;
        } else if (typeof shipment.carrier === 'string') {
            carrierName = shipment.carrier;
        }

        if (!carrierName) {
            return '/images/carrier-badges/solushipx.png';
        }

        // Check for eShip Plus indicators
        const isEshipPlus =
            carrierName.toLowerCase().includes('eshipplus') ||
            carrierName.toLowerCase().includes('eship plus') ||
            carrierName.toLowerCase().includes('freight') ||
            carrierName.toLowerCase().includes('ltl') ||
            shipment.creationMethod !== 'quickship' && (
                shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                shipment.selectedRate?.sourceCarrierName === 'eShip Plus'
            );

        if (isEshipPlus) {
            return '/images/carrier-badges/eship.png';
        }

        // Standard logo mapping
        const logoMap = {
            'canpar': '/images/carrier-badges/canpar.png',
            'canpar express': '/images/carrier-badges/canpar.png',
            'polaris transportation': '/images/carrier-badges/polaristransportation.png',
            'polaris': '/images/carrier-badges/polaristransportation.png',
            'fedex': '/images/carrier-badges/fedex.png',
            'ups': '/images/carrier-badges/ups.png',
            'dhl': '/images/carrier-badges/dhl.png',
            'canada post': '/images/carrier-badges/canadapost.png',
            'purolator': '/images/carrier-badges/purolator.png',
            'usps': '/images/carrier-badges/usps.png',
            'tnt': '/images/carrier-badges/tnt.png'
        };

        const normalizedCarrierName = carrierName.toLowerCase().trim();
        return logoMap[normalizedCarrierName] || '/images/carrier-badges/solushipx.png';
    }, [carrierLogos]);

    // Get carrier name for display
    const getCarrierName = useCallback((shipment) => {
        if (!shipment) return 'Unknown';

        if (shipment.carrier?.name) return shipment.carrier.name;
        if (shipment.carrierName) return shipment.carrierName;
        if (shipment.selectedCarrier) return shipment.selectedCarrier;
        if (typeof shipment.carrier === 'string') return shipment.carrier;

        return 'Unknown Carrier';
    }, []);

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'delivered': return '#4CAF50';
            case 'in_transit': case 'in transit': return '#2196F3';
            case 'pending': case 'scheduled': return '#FF9800';
            case 'delayed': case 'exception': return '#F44336';
            case 'cancelled': case 'void': return '#9E9E9E';
            default: return '#9C27B0';
        }
    };

    // Handler for clicking shipment ID to open detail modal AND pause auto-switching
    const handleShipmentIdClick = useCallback(() => {
        // Pause the auto-switching when shipment ID is clicked
        setIsPaused(true);

        if (selectedShipment && onShipmentSelect) {
            // Call the parent handler to open shipment detail modal
            // This should match the pattern used in ShipmentsX
            onShipmentSelect(selectedShipment.id || selectedShipment.shipmentID);
        }
    }, [selectedShipment, onShipmentSelect]);

    // Handle traffic layer toggle
    const handleTrafficToggle = useCallback(() => {
        setEnabledLayers(prev => {
            const newLayers = new Set(prev);
            if (newLayers.has('traffic')) {
                newLayers.delete('traffic');
            } else {
                newLayers.add('traffic');
            }
            return newLayers;
        });
    }, []);

    return (
        <Box sx={{
            position: 'relative',
            width: '100%',
            height: '100vh',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)'
        }}>


            {/* Command Center Header with Integrated Scorecards */}
            <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '80px',
                background: 'linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(26,26,46,0.9) 100%)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                px: 3,
                gap: 3
            }}>
                {/* Title Section */}
                <Box sx={{ flexShrink: 0 }}>
                    <Typography variant="h6" sx={{
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '1.2rem'
                    }}>
                        Shipping Command Center
                    </Typography>
                    <Typography variant="caption" sx={{
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '0.75rem'
                    }}>
                        Real-time shipment monitoring & control
                    </Typography>
                </Box>

                {/* Compact Scorecards */}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flex: 1,
                    overflowX: 'auto',
                    ml: '10px',
                    mr: '10px',
                    '&::-webkit-scrollbar': {
                        display: 'none'
                    }
                }}>
                    {Object.entries(SHIPMENT_STATUSES).map(([status, config]) => {
                        const isActive = activeFilters.has(status);
                        const count = statusCounts[status] || 0;
                        const IconComponent = config.icon;

                        return (
                            <Card
                                key={status}
                                onClick={() => {
                                    console.log(`Scorecard clicked: ${status}, resetting timer`);
                                    handleFilterToggle(status);
                                }}
                                sx={{
                                    minWidth: '80px',
                                    height: '44px',
                                    cursor: 'pointer',
                                    transition: 'border-color 0.2s ease, background-color 0.2s ease',
                                    backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                                    border: isActive ? `1px solid ${config.color}` : '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: '6px',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        border: `1px solid ${config.color}`
                                    }
                                }}
                            >
                                <CardContent sx={{
                                    p: '6px 8px',
                                    '&:last-child': { pb: '6px' },
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 0.75
                                }}>
                                    <IconComponent sx={{
                                        color: config.color,
                                        fontSize: '16px'
                                    }} />
                                    <Typography sx={{
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        lineHeight: 1
                                    }}>
                                        {count}
                                    </Typography>
                                    <Typography sx={{
                                        color: 'rgba(255,255,255,0.8)',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.3px',
                                        lineHeight: 1
                                    }}>
                                        {config.label}
                                    </Typography>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Box>
            </Box>

            {/* Main Map */}
            <Box sx={{
                position: 'absolute',
                top: '80px',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1
            }}>
                {mapsApiKey ? (
                    <AdvancedLogisticsMap
                        shipments={shipments}
                        filteredShipments={filteredShipments.length > 0 && selectedShipment ? [selectedShipment] : []}
                        selectedShipment={selectedShipment}
                        enabledLayers={enabledLayers}
                        isPlaying={isPlaying}
                        playbackSpeed={playbackSpeed}
                        onShipmentSelect={onShipmentSelect}
                        onMarkerClick={handleMarkerClick}
                        onMapReady={handleMapReady}
                        mapsApiKey={mapsApiKey}
                        userInteracting={userInteracting}
                    />
                ) : (
                    <Box sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
                        color: 'white'
                    }}>
                        <Typography variant="h6">
                            Loading Google Maps API...
                        </Typography>
                    </Box>
                )}

                {/* No Shipments Found Overlay */}
                {mapsApiKey && filteredShipments.length === 0 && activeFilters.size > 0 && !activeFilters.has('all') && (
                    <Box sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1200,
                        textAlign: 'center',
                        color: 'white',
                        background: 'rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        p: 3,
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                            No Shipments Found
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            No shipments match the selected status filter.
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mt: 0.5 }}>
                            Try selecting a different status or "All" to see available shipments.
                        </Typography>
                    </Box>
                )}

                {/* Traffic Layer Toggle - Bottom Right Corner */}
                <Box sx={{
                    position: 'absolute',
                    bottom: 20,
                    right: 20,
                    zIndex: 1100
                }}>
                    <Box
                        onClick={handleTrafficToggle}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            bgcolor: enabledLayers.has('traffic')
                                ? 'rgba(244, 67, 54, 0.9)'
                                : 'rgba(0, 0, 0, 0.8)',
                            border: enabledLayers.has('traffic')
                                ? '1px solid #F44336'
                                : '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '25px',
                            px: 2,
                            py: 1,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            backdropFilter: 'blur(10px)',
                            '&:hover': {
                                bgcolor: enabledLayers.has('traffic')
                                    ? 'rgba(244, 67, 54, 1)'
                                    : 'rgba(0, 0, 0, 0.9)',
                                transform: 'scale(1.05)'
                            }
                        }}
                    >
                        <TrafficIcon sx={{
                            fontSize: '1.2rem',
                            color: enabledLayers.has('traffic') ? 'white' : 'rgba(255,255,255,0.8)'
                        }} />
                        <Typography sx={{
                            color: enabledLayers.has('traffic') ? 'white' : 'rgba(255,255,255,0.8)',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            userSelect: 'none'
                        }}>
                            Traffic
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {/* Compact Special Shipment Display - MOVED TO LEFT SIDE */}
            {selectedShipment && (
                <Box sx={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '20px', // Changed from center positioning to left
                    zIndex: 1000,
                    width: { xs: '85%', sm: '430px', md: '470px' } // Made 10% narrower (was 480px/520px)
                }}>
                    <Card sx={{
                        background: 'linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(26,26,46,0.95) 50%, rgba(16,21,46,0.9) 100%)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '12px',
                        border: '1px solid rgba(0, 229, 255, 0.3)',
                        boxShadow: '0 8px 24px rgba(0, 229, 255, 0.1)',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 12px 32px rgba(0, 229, 255, 0.15)',
                            border: '1px solid rgba(0, 229, 255, 0.5)'
                        }
                    }}>
                        <CardContent sx={{
                            pt: 1.5,
                            px: 1.5,
                            pb: 0.5,
                            position: 'relative'
                        }}>
                            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                                {/* Enhanced Carrier Logo */}
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    minWidth: '80px'
                                }}>
                                    <Box
                                        component="img"
                                        src={getCarrierLogo(selectedShipment)}
                                        alt={getCarrierName(selectedShipment)}
                                        sx={{
                                            width: 64,
                                            height: 40,
                                            objectFit: 'contain',
                                            borderRadius: '4px',
                                            bgcolor: 'rgba(255,255,255,0.9)',
                                            p: 0.5,
                                            border: '1px solid rgba(0, 229, 255, 0.2)'
                                        }}
                                        onError={(e) => {
                                            e.target.src = '/images/carrier-badges/solushipx.png';
                                        }}
                                    />
                                    <Typography sx={{
                                        color: 'rgba(255,255,255,0.8)',
                                        fontSize: '0.65rem',
                                        fontWeight: 500,
                                        textAlign: 'center',
                                        maxWidth: '80px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {selectedShipment.shipmentInfo?.shipmentDate ?
                                            new Date(selectedShipment.shipmentInfo.shipmentDate).toLocaleDateString() :
                                            'No Date'
                                        }
                                    </Typography>
                                </Box>

                                {/* Main Information */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    {/* Shipment ID and Status */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography
                                                onClick={handleShipmentIdClick}
                                                sx={{
                                                    color: '#00E5FF',
                                                    fontSize: '1.1rem',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.5px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    '&:hover': {
                                                        color: '#40E0D0',
                                                        transform: 'scale(1.02)'
                                                    }
                                                }}
                                                title="Click to pause auto-switching and view shipment details"
                                            >
                                                {selectedShipment.shipmentID || 'N/A'}
                                            </Typography>
                                            {/* Small Loading Spinner */}
                                            {isLoadingNext && (
                                                <CircularProgress
                                                    size={12}
                                                    sx={{
                                                        color: '#00E5FF',
                                                        opacity: 0.8
                                                    }}
                                                />
                                            )}
                                        </Box>
                                        <StatusChip
                                            status={selectedShipment.status}
                                            size="small"
                                        />
                                    </Box>

                                    {/* Route Information */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0 }}>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{
                                                color: 'white',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {(() => {
                                                    const from = selectedShipment.shipFrom || selectedShipment.origin || {};
                                                    return from.city || 'Origin';
                                                })()}
                                            </Typography>
                                            <Typography sx={{
                                                color: 'rgba(255,255,255,0.5)',
                                                fontSize: '0.55rem',
                                                lineHeight: 1.2,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {(() => {
                                                    const from = selectedShipment.shipFrom || selectedShipment.origin || {};
                                                    const street = from.street || from.address1;

                                                    if (street) {
                                                        return street;
                                                    }
                                                    return '';
                                                })()}
                                            </Typography>
                                            <Typography sx={{
                                                color: 'rgba(255,255,255,0.5)',
                                                fontSize: '0.55rem',
                                                lineHeight: 1.2,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {(() => {
                                                    const from = selectedShipment.shipFrom || selectedShipment.origin || {};
                                                    const state = from.state || from.province || from.stateProvince;
                                                    const country = from.country;

                                                    let locationText = '';
                                                    if (state) locationText += state;
                                                    if (country && country !== 'US') {
                                                        locationText += locationText ? `, ${country}` : country;
                                                    }

                                                    return locationText || '';
                                                })()}
                                            </Typography>
                                        </Box>

                                        <Box sx={{
                                            width: '16px',
                                            height: '1px',
                                            bgcolor: '#00E5FF',
                                            position: 'relative',
                                            mx: 0.5,
                                            '&::after': {
                                                content: '""',
                                                position: 'absolute',
                                                right: '-4px',
                                                top: '-3px',
                                                width: 0,
                                                height: 0,
                                                borderLeft: '4px solid #00E5FF',
                                                borderTop: '3px solid transparent',
                                                borderBottom: '3px solid transparent'
                                            }
                                        }} />

                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{
                                                color: 'white',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {(() => {
                                                    const to = selectedShipment.shipTo || selectedShipment.destination || {};
                                                    return to.city || 'Destination';
                                                })()}
                                            </Typography>
                                            <Typography sx={{
                                                color: 'rgba(255,255,255,0.5)',
                                                fontSize: '0.55rem',
                                                lineHeight: 1.2,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {(() => {
                                                    const to = selectedShipment.shipTo || selectedShipment.destination || {};
                                                    const street = to.street || to.address1;

                                                    if (street) {
                                                        return street;
                                                    }
                                                    return '';
                                                })()}
                                            </Typography>
                                            <Typography sx={{
                                                color: 'rgba(255,255,255,0.5)',
                                                fontSize: '0.55rem',
                                                lineHeight: 1.2,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {(() => {
                                                    const to = selectedShipment.shipTo || selectedShipment.destination || {};
                                                    const state = to.state || to.province || to.stateProvince;
                                                    const country = to.country;

                                                    let locationText = '';
                                                    if (state) locationText += state;
                                                    if (country && country !== 'US') {
                                                        locationText += locationText ? `, ${country}` : country;
                                                    }

                                                    return locationText || '';
                                                })()}
                                            </Typography>
                                        </Box>
                                    </Box>

                                </Box>

                                {/* Compact Controls */}
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 1,
                                    minWidth: '70px'
                                }}>
                                    {/* Play/Pause Button with Circular Progress */}
                                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                                        {/* Circular Progress Indicator */}
                                        {!isPaused && filteredShipments.length > 1 && (
                                            <CircularProgress
                                                variant="determinate"
                                                value={(autoTimer / 30) * 100}
                                                size={40}
                                                thickness={2}
                                                sx={{
                                                    position: 'absolute',
                                                    top: -4,
                                                    left: -4,
                                                    color: '#FFFFFF',
                                                    '& .MuiCircularProgress-circle': {
                                                        strokeLinecap: 'round',
                                                    }
                                                }}
                                            />
                                        )}
                                        {/* Background Circle for Progress Track */}
                                        {!isPaused && filteredShipments.length > 1 && (
                                            <CircularProgress
                                                variant="determinate"
                                                value={100}
                                                size={40}
                                                thickness={2}
                                                sx={{
                                                    position: 'absolute',
                                                    top: -4,
                                                    left: -4,
                                                    color: 'rgba(255,255,255,0.1)',
                                                    '& .MuiCircularProgress-circle': {
                                                        strokeLinecap: 'round',
                                                    }
                                                }}
                                            />
                                        )}
                                        <IconButton
                                            onClick={handleTogglePlayPause}
                                            size="small"
                                            sx={{
                                                bgcolor: isPaused ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.2)',
                                                border: isPaused ? '1px solid #4CAF50' : '1px solid #FFFFFF',
                                                color: isPaused ? '#4CAF50' : '#FFFFFF',
                                                width: 32,
                                                height: 32,
                                                '&:hover': {
                                                    bgcolor: isPaused ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.3)'
                                                }
                                            }}
                                        >
                                            {isPaused ? <PlayIcon sx={{ fontSize: '1rem' }} /> : <PauseIcon sx={{ fontSize: '1rem' }} />}
                                        </IconButton>
                                    </Box>

                                    {/* Navigation Controls */}
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        bgcolor: 'rgba(0, 0, 0, 0.6)',
                                        borderRadius: '8px',
                                        padding: '4px 8px',
                                        border: '1px solid rgba(0, 229, 255, 0.2)'
                                    }}>
                                        <IconButton
                                            onClick={handlePrevious}
                                            size="small"
                                            sx={{
                                                color: '#00E5FF',
                                                padding: '2px',
                                                '&:hover': {
                                                    bgcolor: 'rgba(0, 229, 255, 0.1)'
                                                }
                                            }}
                                        >
                                            <PrevIcon sx={{ fontSize: '0.9rem' }} />
                                        </IconButton>
                                        <Typography sx={{
                                            color: 'white',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            minWidth: '35px',
                                            textAlign: 'center'
                                        }}>
                                            {currentShipmentIndex + 1}/{filteredShipments.length}
                                        </Typography>
                                        <IconButton
                                            onClick={handleNext}
                                            size="small"
                                            sx={{
                                                color: '#00E5FF',
                                                padding: '2px',
                                                '&:hover': {
                                                    bgcolor: 'rgba(0, 229, 255, 0.1)'
                                                }
                                            }}
                                        >
                                            <NextIcon sx={{ fontSize: '0.9rem' }} />
                                        </IconButton>
                                    </Box>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Box>
            )}
        </Box>
    );
};

export default LogisticsCommandCenter; 