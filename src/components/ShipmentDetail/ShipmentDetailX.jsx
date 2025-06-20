import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Drawer
} from '@mui/material';
import {
    PictureAsPdf as PictureAsPdfIcon,
    FileDownload as FileDownloadIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import { db, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs } from 'firebase/firestore';

// Components
import ShipmentHeader from './components/ShipmentHeader';
import ShipmentInformation from './components/ShipmentInformation';
import ShipmentDocuments from './components/ShipmentDocuments';
import RateDetails from './components/RateDetails';
import PackageDetails from './components/PackageDetails';
import ShipmentHistory from './components/ShipmentHistory';
import LoadingSkeleton from './components/LoadingSkeleton';
import TrackingDrawer from '../Tracking/Tracking';

// Dialogs and Modals
import PrintLabelDialog from './dialogs/PrintLabelDialog';
// PDF viewer will be inline - no separate import needed
import CancelShipmentModal from './dialogs/CancelShipmentModal';
import SnackbarNotification from './components/SnackbarNotification';

// Hooks
import { useShipmentData } from './hooks/useShipmentData';
import { useShipmentActions } from './hooks/useShipmentActions';
import { useDocuments } from './hooks/useDocuments';
import { useSmartStatusUpdate } from '../../hooks/useSmartStatusUpdate';

// Utils
import { ErrorBoundary } from './components/ErrorBoundary';

const ShipmentDetailX = ({ shipmentId: propShipmentId, onBackToTable }) => {
    const { id } = useParams();
    const shipmentId = propShipmentId || id;

    // Main hooks for data and actions
    const {
        shipment,
        loading,
        error,
        carrierData,
        mergedEvents,
        getBestRateInfo,
        isEShipPlusCarrier,
        refreshShipment
    } = useShipmentData(shipmentId);

    const {
        shipmentDocuments,
        documentsLoading,
        documentsError,
        fetchShipmentDocuments
    } = useDocuments(shipment?.id, shipment?.status);

    // Smart status update hook for auto-checking and manual refresh
    const {
        loading: smartUpdateLoading,
        error: smartUpdateError,
        updateResult,
        performSmartUpdate,
        forceRefresh: forceSmartRefresh,
        getUpdateStatusMessage,
        clearUpdateState,
        hasUpdates,
        wasSkipped
    } = useSmartStatusUpdate(shipment?.id, shipment);

    // Enhanced PDF viewer function - identical to working ShipmentDetail
    const viewPdfInModal = async (documentId, filename, title, actionType = 'printLabel', directUrl = null) => {
        try {
            let pdfUrl;

            if (directUrl) {
                // Use the direct URL (blob URL for multiplied PDFs)
                pdfUrl = directUrl;
            } else {
                // Fetch the document URL from Firebase
                const getDocumentDownloadUrlFunction = httpsCallable(functions, 'getDocumentDownloadUrl');
                const result = await getDocumentDownloadUrlFunction({
                    documentId: documentId,
                    shipmentId: shipment?.id
                });

                if (result.data && result.data.success) {
                    pdfUrl = result.data.downloadUrl;
                    console.log('PDF viewer opened for document:', {
                        documentId,
                        title,
                        foundInUnified: result.data.metadata?.foundInUnified,
                        storagePath: result.data.metadata?.storagePath
                    });
                } else {
                    throw new Error(result.data?.error || 'Failed to get document URL');
                }
            }

            setCurrentPdfUrl(pdfUrl);
            setCurrentPdfTitle(title || filename || 'Document');
            setPdfViewerOpen(true);

        } catch (error) {
            console.error('Error viewing document:', error);
            showSnackbar('Failed to load document: ' + error.message, 'error');
        }
    };

    const {
        actionStates,
        snackbar,
        handlePrintLabel,
        handlePrintBOL,
        handlePrintConfirmation,
        handlePrintShipment,
        handleRefreshStatus,
        handleCancelShipment,
        showSnackbar,
        setSnackbar
    } = useShipmentActions(shipment, carrierData, shipmentDocuments, viewPdfInModal, {
        smartUpdateLoading,
        forceSmartRefresh,
        clearUpdateState,
        refreshShipment
    });

    // UI State - Remove expandedSections since we don't need collapsible sections anymore
    // const [expandedSections, setExpandedSections] = useState({
    //     shipment: true,
    //     locations: true,
    //     packages: true,
    //     rate: true,
    //     documents: true
    // });

    // Modal States
    const [printLabelModalOpen, setPrintLabelModalOpen] = useState(false);
    const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
    const [currentPdfUrl, setCurrentPdfUrl] = useState(null);
    const [currentPdfTitle, setCurrentPdfTitle] = useState('');
    const [cancelModalOpen, setCancelModalOpen] = useState(false);

    // Maps and Route States  
    const [directions, setDirections] = useState(null);
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
    const [mapCenter, setMapCenter] = useState({ lat: 43.6532, lng: -79.3832 });
    const [useMetric, setUseMetric] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [mapsApiKey, setMapsApiKey] = useState(null);
    const [mapError, setMapError] = useState(null);
    const [mapBounds, setMapBounds] = useState(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [map, setMap] = useState(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    // Tracking drawer state
    const [isTrackingDrawerOpen, setIsTrackingDrawerOpen] = useState(false);
    const [selectedTrackingNumber, setSelectedTrackingNumber] = useState(null);

    // Dark mode map styling - exactly like the original
    const mapStyles = [
        {
            "elementType": "geometry",
            "stylers": [{ "color": "#242f3e" }]
        },
        {
            "elementType": "labels.text.stroke",
            "stylers": [{ "color": "#242f3e" }]
        },
        {
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "administrative.locality",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "poi",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "poi.park",
            "elementType": "geometry",
            "stylers": [{ "color": "#263c3f" }]
        },
        {
            "featureType": "poi.park",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "road",
            "elementType": "geometry",
            "stylers": [{ "color": "#38414e" }]
        },
        {
            "featureType": "road",
            "elementType": "geometry.stroke",
            "stylers": [{ "color": "#212a37" }]
        },
        {
            "featureType": "road",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry",
            "stylers": [{ "color": "#746855" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry.stroke",
            "stylers": [{ "color": "#1f2835" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "transit",
            "elementType": "geometry",
            "stylers": [{ "color": "#2f3948" }]
        },
        {
            "featureType": "transit.station",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [{ "color": "#17263c" }]
        },
        {
            "featureType": "water",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "water",
            "elementType": "labels.text.stroke",
            "stylers": [{ "color": "#17263c" }]
        }
    ];

    // Map options with dark styling
    const mapOptions = React.useMemo(() => ({
        styles: mapStyles,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        maxZoom: 20,
        minZoom: 5,
        gestureHandling: 'greedy',
        preserveViewport: false
    }), []);

    // Label Configuration
    const [labelConfig, setLabelConfig] = useState({
        quantity: 1,
        labelType: '4x6'
    });

    // Google Maps initialization effect - according to memory, check if window.google.maps is already available
    useEffect(() => {
        const initializeMaps = async () => {
            try {
                setMapError(null);

                // Check if Google Maps is already loaded globally (from Globe component)
                if (window.google && window.google.maps) {
                    console.log('Google Maps already loaded globally');
                    setIsGoogleMapsLoaded(true);
                    return;
                }

                // Fetch API key from Firestore only if maps not already loaded
                const keysRef = collection(db, 'keys');
                const keysSnapshot = await getDocs(keysRef);

                if (!keysSnapshot.empty) {
                    const firstDoc = keysSnapshot.docs[0];
                    const key = firstDoc.data().googleAPI;
                    if (!key) {
                        throw new Error('No API key found in Firestore');
                    }
                    setMapsApiKey(key);
                    setIsGoogleMapsLoaded(true);
                } else {
                    throw new Error('API key document not found in Firestore');
                }
            } catch (error) {
                console.error('Error initializing Maps:', error);
                setMapError('Failed to load Google Maps. Please try refreshing the page.');
                setIsGoogleMapsLoaded(false);
            }
        };

        initializeMaps();
    }, []);

    // Route calculation effect - using the working logic from OLD-ShipmentDetail.jsx
    useEffect(() => {
        const calculateRoute = async () => {
            if (!shipment?.shipFrom || !shipment?.shipTo || !window.google || !window.google.maps || !isGoogleMapsLoaded) {
                console.log('Missing required data for route calculation:', {
                    hasShipFrom: !!shipment?.shipFrom,
                    hasShipTo: !!shipment?.shipTo,
                    hasGoogleMaps: !!window.google?.maps,
                    isGoogleMapsLoaded
                });
                setDirections(null);
                setMapError('Missing required data for route calculation');
                return;
            }

            try {
                setMapError(null);

                const formatAddress = (address) => {
                    if (!address) return '';

                    const components = [];

                    // Add company name if available
                    if (address.company) {
                        components.push(address.company);
                    }

                    // Add street address
                    if (address.street) {
                        components.push(address.street);
                    }

                    // Add street2 if available
                    if (address.street2) {
                        components.push(address.street2);
                    }

                    // Add city, state, and postal code
                    const cityStateZip = [];
                    if (address.city) cityStateZip.push(address.city);
                    if (address.state) cityStateZip.push(address.state);
                    if (address.postalCode) cityStateZip.push(address.postalCode);

                    if (cityStateZip.length > 0) {
                        components.push(cityStateZip.join(', '));
                    }

                    // Add country
                    if (address.country) {
                        components.push(address.country);
                    }

                    return components.join(', ');
                };

                const geocodeAddress = async (address, type) => {
                    return new Promise((resolve, reject) => {
                        const geocoder = new window.google.maps.Geocoder();
                        const formattedAddress = formatAddress(address);

                        console.log(`Attempting to geocode ${type} address:`, {
                            address: formattedAddress,
                            originalAddress: address
                        });

                        geocoder.geocode({
                            address: formattedAddress,
                            region: address.country?.toLowerCase() || 'us'
                        }, (results, status) => {
                            if (status === 'OK' && results && results.length > 0) {
                                console.log(`${type} geocoding successful:`, {
                                    address: results[0].formatted_address,
                                    location: results[0].geometry.location.toJSON(),
                                    placeId: results[0].place_id
                                });
                                resolve(results[0]);
                            } else {
                                console.error(`${type} geocoding failed:`, {
                                    status,
                                    address: formattedAddress,
                                    error: status === 'ZERO_RESULTS' ? 'No results found' : `Geocoding error: ${status}`
                                });
                                reject(new Error(`Geocoding failed for ${type}: ${status}`));
                            }
                        });
                    });
                };

                const geocodeWithRetry = async (address, type, maxRetries = 3) => {
                    for (let i = 0; i < maxRetries; i++) {
                        try {
                            return await geocodeAddress(address, type);
                        } catch (error) {
                            if (i === maxRetries - 1) throw error;
                            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
                        }
                    }
                };

                const [originResult, destinationResult] = await Promise.all([
                    geocodeWithRetry(shipment.shipFrom, 'origin'),
                    geocodeWithRetry(shipment.shipTo, 'destination')
                ]);

                // Validate geocoding results
                if (!originResult || !originResult.geometry || !originResult.geometry.location) {
                    throw new Error('Invalid origin location data');
                }

                if (!destinationResult || !destinationResult.geometry || !destinationResult.geometry.location) {
                    throw new Error('Invalid destination location data');
                }

                const bounds = new window.google.maps.LatLngBounds();
                bounds.extend(originResult.geometry.location);
                bounds.extend(destinationResult.geometry.location);
                setMapBounds(bounds);

                // Prepare the request body with place IDs if available
                const requestBody = {
                    origin: originResult.place_id ?
                        { placeId: originResult.place_id } :
                        {
                            location: {
                                latLng: {
                                    latitude: originResult.geometry.location.lat(),
                                    longitude: originResult.geometry.location.lng()
                                }
                            }
                        },
                    destination: destinationResult.place_id ?
                        { placeId: destinationResult.place_id } :
                        {
                            location: {
                                latLng: {
                                    latitude: destinationResult.geometry.location.lat(),
                                    longitude: destinationResult.geometry.location.lng()
                                }
                            }
                        },
                    travelMode: "DRIVE",
                    routingPreference: "TRAFFIC_UNAWARE",
                    computeAlternativeRoutes: false,
                    languageCode: "en-US",
                    units: useMetric ? "METRIC" : "IMPERIAL"
                };

                // Add region code if country is available
                if (shipment.shipFrom.country) {
                    const countryCode = shipment.shipFrom.country.toLowerCase();
                    if (countryCode.length === 2) {
                        requestBody.regionCode = countryCode;
                    }
                }

                const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': mapsApiKey,
                        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.legs.duration,routes.legs.distanceMeters,routes.legs.startLocation,routes.legs.endLocation'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Route calculation API error:', errorData);
                    throw new Error(`Route calculation failed: ${errorData.error?.message || response.statusText}`);
                }

                const routeData = await response.json();

                // Check if route data is valid
                if (!routeData.routes || routeData.routes.length === 0) {
                    throw new Error('No routes found in the response');
                }

                const route = routeData.routes[0];

                // Check if the route has the required polyline data
                if (!route.polyline || !route.polyline.encodedPolyline) {
                    throw new Error('Route polyline data is missing');
                }

                const decodedPath = window.google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);

                // Parse duration safely
                const durationInSeconds = parseInt(route.duration);
                const durationInMinutes = Math.round(durationInSeconds / 60);

                // Create a properly structured directions object that matches what DirectionsRenderer expects
                const directionsResult = {
                    routes: [{
                        legs: [{
                            start_location: originResult.geometry.location,
                            end_location: destinationResult.geometry.location,
                            distance: {
                                text: useMetric ? `${Math.round(route.distanceMeters / 1000)} km` : `${Math.round(route.distanceMeters / 1609.34)} mi`,
                                value: route.distanceMeters
                            },
                            duration: {
                                text: `${durationInMinutes} mins`,
                                value: durationInSeconds
                            },
                            steps: [{
                                distance: {
                                    text: useMetric ? `${Math.round(route.distanceMeters / 1000)} km` : `${Math.round(route.distanceMeters / 1609.34)} mi`,
                                    value: route.distanceMeters
                                },
                                duration: {
                                    text: `${durationInMinutes} mins`,
                                    value: durationInSeconds
                                },
                                start_location: originResult.geometry.location,
                                end_location: destinationResult.geometry.location,
                                instructions: "Follow the route",
                                path: decodedPath
                            }]
                        }],
                        overview_path: decodedPath,
                        bounds: new window.google.maps.LatLngBounds(originResult.geometry.location, destinationResult.geometry.location),
                        copyrights: "© Google Maps",
                        warnings: [],
                        waypoint_order: [],
                        overview_polyline: {
                            points: route.polyline.encodedPolyline
                        }
                    }],
                    request: {
                        origin: originResult.geometry.location,
                        destination: destinationResult.geometry.location,
                        travelMode: "DRIVING"
                    },
                    status: "OK",
                    geocoded_waypoints: [
                        { status: "OK", place_id: originResult.place_id },
                        { status: "OK", place_id: destinationResult.place_id }
                    ]
                };

                setDirections(directionsResult);
                console.log('Route calculated successfully using Routes API v2');
            } catch (error) {
                console.error('Error calculating route:', error);
                setDirections(null);
                setMapError('Error calculating route: ' + error.message);
            }
        };

        // Only calculate route when all required components are ready
        if (shipment && isGoogleMapsLoaded && mapsApiKey && isMapReady) {
            calculateRoute();
        }
    }, [shipment, isGoogleMapsLoaded, mapsApiKey, useMetric, isMapReady]);

    // Handle map load and bounds - fixed for proper route zoom
    const handleMapLoad = React.useCallback((map) => {
        setMap(map);
        setIsMapLoaded(true);
        setIsMapReady(true); // Set map as ready when it's fully loaded
    }, []);

    // Separate effect to handle bounds fitting when directions change
    useEffect(() => {
        if (map && directions && directions.routes && directions.routes[0]) {
            const route = directions.routes[0];

            // Use the route bounds if available, otherwise create bounds from origin/destination
            let bounds;
            if (route.bounds) {
                bounds = route.bounds;
            } else if (directions.request?.origin && directions.request?.destination) {
                bounds = new window.google.maps.LatLngBounds();
                bounds.extend(directions.request.origin);
                bounds.extend(directions.request.destination);

                // If we have overview_path, extend bounds to include the entire route
                if (route.overview_path && route.overview_path.length > 0) {
                    route.overview_path.forEach(point => {
                        bounds.extend(point);
                    });
                }
            }

            if (bounds) {
                // Add appropriate padding for better visibility
                const padding = 80; // Increased padding for better route visibility

                // Fit the map to the route bounds with padding
                map.fitBounds(bounds, {
                    top: padding,
                    right: padding,
                    bottom: padding,
                    left: padding
                });

                // Ensure minimum zoom level for route visibility
                const listener = window.google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
                    const currentZoom = map.getZoom();
                    if (currentZoom > 15) {
                        map.setZoom(15); // Set max zoom for route view
                    }
                    if (currentZoom < 6) {
                        map.setZoom(6); // Set min zoom for route view
                    }
                });
            }
        }
    }, [map, directions]);

    // Handle opening tracking drawer
    const handleOpenTrackingDrawer = (trackingNumber) => {
        setSelectedTrackingNumber(trackingNumber);
        setIsTrackingDrawerOpen(true);
    };

    const handleCloseTrackingDrawer = () => {
        setIsTrackingDrawerOpen(false);
        setSelectedTrackingNumber(null);
    };

    if (loading) {
        return <LoadingSkeleton />;
    }

    if (error) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <Typography color="error">{error}</Typography>
            </Box>
        );
    }

    if (!shipment) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <Typography>No shipment data available</Typography>
            </Box>
        );
    }

    return (
        <ErrorBoundary>
            <Box sx={{ width: '100%', minHeight: '100vh', p: 3 }}>
                {/* Header with action buttons */}
                <ShipmentHeader
                    shipment={shipment}
                    actionStates={actionStates}
                    documentsLoading={documentsLoading}
                    documentsError={documentsError}
                    shipmentDocuments={shipmentDocuments}
                    isEShipPlusCarrier={isEShipPlusCarrier}
                    onPrintLabel={() => setPrintLabelModalOpen(true)}
                    onPrintBOL={handlePrintBOL}
                    onPrintConfirmation={handlePrintConfirmation}
                    onPrintShipment={handlePrintShipment}
                    fetchShipmentDocuments={fetchShipmentDocuments}
                    onBackToTable={onBackToTable}

                    onCancelShipment={() => setCancelModalOpen(true)}
                    onShowSnackbar={showSnackbar}
                />

                {/* Main Content Container */}
                <Box id="shipment-detail-content">
                    {/* Shipment Information - Now the first section */}
                    <ShipmentInformation
                        shipment={shipment}
                        getBestRateInfo={getBestRateInfo}
                        carrierData={carrierData}
                        mergedEvents={mergedEvents}
                        actionStates={actionStates}
                        smartUpdateLoading={smartUpdateLoading}
                        onRefreshStatus={handleRefreshStatus}
                        onShowSnackbar={showSnackbar}
                        onOpenTrackingDrawer={handleOpenTrackingDrawer}
                    />

                    {/* Documents Section - Hidden for now */}
                    {/* <ShipmentDocuments
                        shipment={shipment}
                        expanded={expandedSections.documents}
                        onToggle={() => toggleSection('documents')}
                        shipmentDocuments={shipmentDocuments}
                        documentsLoading={documentsLoading}
                        documentsError={documentsError}
                        onRetryFetch={fetchShipmentDocuments}
                        onViewPdf={viewPdfInModal}
                    /> */}

                    {/* Main Content Grid */}
                    <Grid container spacing={1} sx={{ mt: 1 }}>
                        {/* Rate Details */}
                        <RateDetails
                            getBestRateInfo={getBestRateInfo}
                            carrierData={carrierData}
                            shipment={shipment}
                        />

                        {/* Package Details */}
                        <PackageDetails
                            packages={shipment?.packages || []}
                        />

                        {/* Shipment History - Full Width */}
                        <ShipmentHistory
                            mergedEvents={mergedEvents}
                            historyLoading={historyLoading}
                        />
                    </Grid>
                </Box>

                {/* Tracking Drawer */}
                {isTrackingDrawerOpen && (
                    <Box
                        onClick={handleCloseTrackingDrawer}
                        sx={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            bgcolor: 'rgba(0,0,0,0.7)',
                            zIndex: 1499,
                            transition: 'opacity 0.3s',
                        }}
                    />
                )}
                <Drawer
                    anchor="right"
                    open={isTrackingDrawerOpen}
                    onClose={handleCloseTrackingDrawer}
                    PaperProps={{
                        sx: {
                            width: { xs: '90vw', sm: 400, md: 450 },
                            height: '100%',
                            bgcolor: '#0a0a0a',
                            zIndex: 1500,
                            position: 'fixed',
                            right: 0,
                            top: 0,
                        }
                    }}
                    ModalProps={{
                        keepMounted: true,
                        sx: { zIndex: 1500 }
                    }}
                >
                    <Box sx={{ width: { xs: '90vw', sm: 400, md: 450 }, height: '100%', bgcolor: '#0a0a0a' }} role="presentation">
                        <TrackingDrawer
                            trackingIdentifier={selectedTrackingNumber}
                            isDrawer={true}
                            onClose={handleCloseTrackingDrawer}
                        />
                    </Box>
                </Drawer>
            </Box>

            {/* Modals and Dialogs */}
            <PrintLabelDialog
                open={printLabelModalOpen}
                onClose={() => setPrintLabelModalOpen(false)}
                onPrint={(config) => handlePrintLabel(config.quantity, config.labelType)}
                labelConfig={labelConfig}
                setLabelConfig={setLabelConfig}
                shipment={shipment}
            />

            {/* PDF Viewer Modal - Identical to working ShipmentDetail */}
            <Dialog
                open={pdfViewerOpen}
                onClose={() => {
                    setPdfViewerOpen(false);
                    if (currentPdfUrl?.startsWith('blob:')) {
                        URL.revokeObjectURL(currentPdfUrl);
                    }
                    setCurrentPdfUrl(null);
                }}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        height: '90vh',
                        borderRadius: 2
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PictureAsPdfIcon color="error" />
                        <Typography variant="h6">{currentPdfTitle}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            onClick={() => {
                                if (currentPdfUrl) {
                                    window.open(currentPdfUrl, '_blank');
                                }
                            }}
                            startIcon={<FileDownloadIcon />}
                            size="small"
                        >
                            Download
                        </Button>
                        <IconButton onClick={() => {
                            setPdfViewerOpen(false);
                            if (currentPdfUrl?.startsWith('blob:')) {
                                URL.revokeObjectURL(currentPdfUrl);
                            }
                            setCurrentPdfUrl(null);
                        }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ p: 0, height: '100%' }}>
                    {currentPdfUrl && (
                        <Box sx={{ height: '100%', width: '100%' }}>
                            <iframe
                                src={currentPdfUrl}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none'
                                }}
                                title={currentPdfTitle}
                            />
                        </Box>
                    )}
                </DialogContent>
            </Dialog>

            <CancelShipmentModal
                open={cancelModalOpen}
                onClose={() => setCancelModalOpen(false)}
                onConfirm={handleCancelShipment}
                shipment={shipment}
                loading={actionStates.cancelShipment}
            />

            <SnackbarNotification
                open={snackbar.open}
                message={snackbar.message}
                severity={snackbar.severity}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            />
        </ErrorBoundary>
    );
};

export default ShipmentDetailX; 