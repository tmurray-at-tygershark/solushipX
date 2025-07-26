import React, { useState, useEffect, useCallback, Suspense, lazy, useRef } from 'react';
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
    Drawer,
    Alert,
    Snackbar,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Avatar,
    Chip,
    Autocomplete
} from '@mui/material';
import {
    PictureAsPdf as PictureAsPdfIcon,
    FileDownload as FileDownloadIcon,
    Close as CloseIcon,
    Add as AddIcon
} from '@mui/icons-material';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { db, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, where, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';

// Components
import ShipmentHeader from './components/ShipmentHeader';
import ShipmentInformation from './components/ShipmentInformation';
import DocumentsSection from './components/DocumentsSection';
import RateDetails from './components/RateDetails';
import PackageDetails from './components/PackageDetails';
import ShipmentHistory from './components/ShipmentHistory';
import LoadingSkeleton from './components/LoadingSkeleton';
import TrackingDrawer from '../Tracking/Tracking';
import EnhancedStatusChip from '../StatusChip/EnhancedStatusChip';

// Dialogs and Modals
import PrintLabelDialog from './dialogs/PrintLabelDialog';
// PDF viewer will be inline - no separate import needed
import CancelShipmentModal from './components/CancelShipmentModal';
import SnackbarNotification from './components/SnackbarNotification';
import EditShipmentModal from './components/EditShipmentModal';
import DocumentRegenerationDialog from './components/DocumentRegenerationDialog';
import FollowUpTable from './components/FollowUpTable';

// Hooks
import { useShipmentData } from './hooks/useShipmentData';
import { useShipmentActions } from './hooks/useShipmentActions';
import { useDocuments } from './hooks/useDocuments';
import { useSmartStatusUpdate } from '../../hooks/useSmartStatusUpdate';
import { useCarrierAgnosticStatusUpdate } from '../../hooks/useCarrierAgnosticStatusUpdate';

// Utils
import { ErrorBoundary } from './components/ErrorBoundary';
import { fixShipmentEncoding } from '../../utils/textUtils';

const ShipmentDetailX = ({ shipmentId: propShipmentId, onBackToTable, isAdmin: propIsAdmin, editMode = false, onShipmentUpdated: parentOnShipmentUpdated }) => {
    const { id } = useParams();
    const shipmentId = propShipmentId || id;
    const authState = useAuth();
    const { currentUser: user } = authState;
    const { companyIdForAddress, setCompanyContext } = useCompany();
    console.log('🔐 Full Auth State in ShipmentDetailX:', authState);
    console.log('👤 User from authState:', user);

    // Get user ID from multiple possible sources
    const userId = user?.uid || user?.id || authState?.currentUser?.uid || authState?.currentUser?.id;
    console.log('🆔 Resolved userId:', userId);

    // Check if user is admin or super admin - use prop if provided, otherwise calculate
    const isAdmin = propIsAdmin !== undefined ? propIsAdmin : (user?.role === 'admin' || user?.role === 'superadmin');

    // Get user role for permission checking
    const userRole = user?.role || 'user';

    // Follow-up dialog state
    const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
    const [followUpListOpen, setFollowUpListOpen] = useState(false);
    const [existingFollowUps, setExistingFollowUps] = useState([]);
    const [loadingFollowUps, setLoadingFollowUps] = useState(false);
    const [editingFollowUp, setEditingFollowUp] = useState(null);
    const [followUpData, setFollowUpData] = useState({
        title: '',
        description: '',
        actionType: 'follow-up',
        actionTypes: ['email'], // Multi-select action types
        dueDate: '',
        dueTime: '09:00',
        assignmentType: 'general',
        assignedTo: '',
        estimatedDuration: 30,
        category: 'manual',
        notificationType: 'email', // Fixed to email only
        tags: [],
        reminders: []
    });
    const [availableUsers, setAvailableUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [followUpSubmitting, setFollowUpSubmitting] = useState(false);

    // Refs for date/time inputs to make rows clickable
    const dueDateRef = useRef(null);
    const dueTimeRef = useRef(null);
    const reminderDateRef = useRef(null);
    const reminderTimeRef = useRef(null);

    // CRITICAL CLEANUP: Clear any shipment session data when component unmounts
    useEffect(() => {
        return () => {
            console.log('🧹 ShipmentDetailX unmounting - clearing session data for shipment:', shipmentId);
            // Clear any window-stored shipment references
            if (window.currentShipmentId) {
                delete window.currentShipmentId;
            }
            if (window.lastViewedShipment) {
                delete window.lastViewedShipment;
            }
        };
    }, [shipmentId]);

    // Main hooks for data and actions
    const {
        shipment,
        setShipment,
        loading,
        error,
        carrierData,
        mergedEvents,
        getBestRateInfo,
        isEShipPlusCarrier,
        refreshShipment
    } = useShipmentData(shipmentId);

    // Load available users for assignment - moved after shipment data is loaded
    useEffect(() => {
        const loadUsers = async () => {
            if (!followUpDialogOpen || !shipment) return;

            setLoadingUsers(true);
            try {
                // Get the company ID from the shipment
                const shipmentCompanyId = shipment.companyID || shipment.companyId;

                if (!shipmentCompanyId) {
                    console.warn('No company ID found in shipment for user filtering');
                    setAvailableUsers([]);
                    return;
                }

                // Get all users
                const usersSnapshot = await getDocs(collection(db, 'users'));
                const allUsers = usersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).filter(user => user.role && user.email);

                // Filter users who have access to this shipment's company
                const filteredUsers = allUsers.filter(user => {
                    // Super admins can access all companies
                    if (user.role === 'superadmin') return true;

                    // Admins need to have the company in their connected companies
                    if (user.role === 'admin' && user.connectedCompanies?.companies) {
                        return user.connectedCompanies.companies.includes(shipmentCompanyId);
                    }

                    // Regular users need to belong to the same company
                    if (user.role === 'user') {
                        return user.companyID === shipmentCompanyId || user.companyId === shipmentCompanyId;
                    }

                    return false;
                });

                // Sort users by name for better UX
                const sortedUsers = filteredUsers.sort((a, b) => {
                    const nameA = a.firstName || a.displayName || a.email;
                    const nameB = b.firstName || b.displayName || b.email;
                    return nameA.localeCompare(nameB);
                });

                setAvailableUsers(sortedUsers);
            } catch (error) {
                console.error('Error loading users:', error);
                setAvailableUsers([]);
            } finally {
                setLoadingUsers(false);
            }
        };

        loadUsers();
    }, [followUpDialogOpen, shipment]);

    // Load existing follow-ups when shipment changes - will be defined after useShipmentActions
    // (moved below to avoid initialization issues)

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

    // Enhanced PDF viewer function - will be defined after useShipmentActions
    const viewPdfInModalRef = useRef(null);

    const {
        actionStates,
        snackbar,
        regenerationDialog,
        handlePrintLabel,
        handlePrintBOL,
        handlePrintConfirmation,
        handlePrintShipment,
        handleRefreshStatus,
        handleCancelShipment,
        showSnackbar,
        setSnackbar,
        handleRegenerateBOL,
        handleRegenerateCarrierConfirmation,
        handleEditShipment,
        handleArchiveShipment,
        showRegenerationDialog,
        closeRegenerationDialog,
        canViewCarrierConfirmations,
        canGenerateCarrierConfirmations
    } = useShipmentActions(shipment, carrierData, shipmentDocuments, (...args) => viewPdfInModalRef.current?.(...args), {
        smartUpdateLoading,
        forceSmartRefresh,
        clearUpdateState,
        refreshShipment,
        fetchShipmentDocuments
    }, userRole);

    // Custom handlers for modals
    const handleEditShipmentClick = useCallback(async () => {
        console.log('🔧 Edit shipment clicked - checking company context');

        // Ensure proper company context is set before opening edit modal
        if (shipment && isAdmin) {
            const shipmentCompanyId = shipment.companyID || shipment.companyId;
            console.log('🏢 Shipment company ID:', shipmentCompanyId);
            console.log('🏢 Current company context:', companyIdForAddress);

            // If we're in admin mode and the shipment belongs to a different company,
            // we need to switch the company context first
            if (shipmentCompanyId && shipmentCompanyId !== companyIdForAddress) {
                try {
                    console.log('🔄 Admin: Switching company context for edit from', companyIdForAddress, 'to', shipmentCompanyId);

                    // Find the company data
                    const companiesQuery = query(
                        collection(db, 'companies'),
                        where('companyID', '==', shipmentCompanyId),
                        limit(1)
                    );

                    const companiesSnapshot = await getDocs(companiesQuery);

                    if (!companiesSnapshot.empty) {
                        const companyDoc = companiesSnapshot.docs[0];
                        const companyData = {
                            id: companyDoc.id,
                            ...companyDoc.data()
                        };

                        console.log('✅ Found company data for context switch:', companyData);

                        showSnackbar(`Switching to ${companyData.name} for editing...`, 'info');

                        // Set the company context - this will properly update all downstream components
                        await setCompanyContext(companyData);

                        // Wait a bit for the context to update
                        setTimeout(() => {
                            setEditShipmentModalOpen(true);
                        }, 500);

                        return;
                    } else {
                        console.warn('⚠️ Company not found for ID:', shipmentCompanyId);
                        showSnackbar('Warning: Company information not found', 'warning');
                    }
                } catch (error) {
                    console.error('❌ Error switching company context:', error);
                    showSnackbar('Error switching company context', 'error');
                }
            }
        }

        // Default behavior - open modal immediately
        setEditShipmentModalOpen(true);
    }, [shipment, isAdmin, companyIdForAddress, showSnackbar, setCompanyContext]);

    const handleShipmentUpdated = useCallback((updatedShipment) => {
        console.log('🔄 ShipmentDetailX: Handling shipment update, refreshing all data...');

        // Refresh the shipment data after successful update
        refreshShipment();

        // Also refresh documents in case any documents were affected
        if (fetchShipmentDocuments) {
            console.log('🔄 Refreshing shipment documents...');
            fetchShipmentDocuments();
        }

        showSnackbar('Shipment updated successfully! Refreshing data...', 'success');
        setEditShipmentModalOpen(false);

        // Also call the parent callback to refresh the shipments table
        if (parentOnShipmentUpdated) {
            console.log('🔄 Calling parent callback to refresh shipments table');
            parentOnShipmentUpdated(shipmentId, 'Shipment updated successfully');
        }
    }, [refreshShipment, fetchShipmentDocuments, showSnackbar, parentOnShipmentUpdated, shipmentId]);

    const handleShipmentCancelled = useCallback((cancelledShipment) => {
        // Refresh the shipment data after successful cancellation
        // Add a small delay to ensure the event has been written to the database
        setTimeout(() => {
            refreshShipment();
        }, 1000); // 1 second delay to allow event recording to complete

        showSnackbar('Shipment cancelled successfully! Status updated.', 'success');
        setCancelModalOpen(false);

        // REMOVED: Don't automatically navigate away - let user stay on the page
        // User can manually go back if they want to see the updated status and timeline
        // if (onBackToTable) {
        //     setTimeout(() => {
        //         onBackToTable();
        //     }, 2000); // Give time for the success message to show
        // }
    }, [refreshShipment, showSnackbar]);

    // Load existing follow-ups for this shipment
    const loadExistingFollowUps = useCallback(async () => {
        if (!shipment?.id) return;

        setLoadingFollowUps(true);
        try {
            const followUpsQuery = query(
                collection(db, 'followUpTasks'),
                where('shipmentId', '==', shipment.id),
                orderBy('createdAt', 'desc')
            );

            const followUpsSnapshot = await getDocs(followUpsQuery);
            const followUps = followUpsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setExistingFollowUps(followUps);
        } catch (error) {
            console.error('Error loading follow-ups:', error);
            showSnackbar('Failed to load follow-ups', 'error');
        } finally {
            setLoadingFollowUps(false);
        }
    }, [shipment?.id, showSnackbar]);

    // Load existing follow-ups when shipment changes
    useEffect(() => {
        if (shipment?.id) {
            loadExistingFollowUps();
        }
    }, [shipment?.id, loadExistingFollowUps]);



    // Enhanced PDF viewer function - identical to working ShipmentDetail
    viewPdfInModalRef.current = async (documentId, filename, title, actionType = 'printLabel', directUrl = null) => {
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
    const [editShipmentModalOpen, setEditShipmentModalOpen] = useState(false);
    const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
    const [currentPdfUrl, setCurrentPdfUrl] = useState(null);
    const [currentPdfTitle, setCurrentPdfTitle] = useState('');
    const [cancelModalOpen, setCancelModalOpen] = useState(false);



    // Auto-open edit modal when editMode is true
    useEffect(() => {
        if (editMode && shipment && !loading && !editShipmentModalOpen) {
            console.log('🔧 Auto-opening edit modal due to editMode prop');
            setEditShipmentModalOpen(true);
        }
    }, [editMode, shipment, loading, editShipmentModalOpen]);

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



    // Follow-up handlers
    const handleViewFollowUps = useCallback(() => {
        setFollowUpListOpen(true);
        loadExistingFollowUps();
    }, [loadExistingFollowUps]);

    const handleEditFollowUp = useCallback((followUp) => {
        setEditingFollowUp(followUp);
        setFollowUpData({
            title: followUp.title || 'Follow-up Task',
            description: followUp.description || '',
            actionType: followUp.actionType || 'follow-up',
            actionTypes: followUp.actionTypes || ['email'],
            dueDate: followUp.dueDate ? new Date(followUp.dueDate.seconds * 1000).toISOString().split('T')[0] : '',
            dueTime: followUp.dueTime || '09:00',
            reminderDate: followUp.reminderDate ? new Date(followUp.reminderDate.seconds * 1000).toISOString().split('T')[0] : '',
            reminderTime: followUp.reminderTime || '08:00',
            assignmentType: followUp.assignmentType || 'general',
            assignedTo: followUp.assignedTo || '',
            estimatedDuration: followUp.estimatedDuration || 30,
            category: followUp.category || 'manual',
            notificationType: followUp.notificationType || 'email',
            tags: followUp.tags || [],
            reminders: followUp.reminders || []
        });
        setFollowUpDialogOpen(true);
    }, []);

    const handleCreateFollowUp = useCallback(() => {
        setEditingFollowUp(null);
        setFollowUpDialogOpen(true);
        // Pre-populate with shipment context
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        setFollowUpData({
            title: 'Follow-up Task',
            description: '',
            actionType: 'follow-up',
            actionTypes: ['email'],
            dueDate: tomorrow.toISOString().split('T')[0],
            dueTime: '09:00',
            reminderDate: tomorrow.toISOString().split('T')[0],
            reminderTime: '08:00',
            assignmentType: 'general',
            assignedTo: userId || '',
            estimatedDuration: 30,
            category: 'manual',
            notificationType: 'email',
            tags: [],
            reminders: []
        });
    }, [shipment?.shipmentID, userId]);

    const handleFollowUpSubmit = useCallback(async () => {
        console.log('🔄 CREATE TASK clicked - handleFollowUpSubmit called');
        console.log('📋 Follow-up data:', followUpData);
        console.log('👤 User:', user);
        console.log('📦 Shipment:', shipment);

        try {
            setFollowUpSubmitting(true);
            console.log('🔍 Using userId from component:', userId);

            if (!userId) {
                console.log('❌ No user ID found');
                showSnackbar('User authentication required to create follow-up tasks', 'error');
                return;
            }

            // Combine date and time for due date
            const dueDateTime = new Date(`${followUpData.dueDate}T${followUpData.dueTime}`);

            // Combine date and time for reminder date if provided
            const reminderDateTime = followUpData.reminderDate ?
                new Date(`${followUpData.reminderDate}T${followUpData.reminderTime || '08:00'}`) : null;

            const taskData = {
                shipmentId: shipment.id,
                companyId: shipment.companyID || companyIdForAddress,
                customerId: shipment.customerId || null,
                title: followUpData.title,
                description: followUpData.description,
                actionType: followUpData.actionType,
                actionTypes: followUpData.actionTypes, // Multi-select action types
                dueDate: dueDateTime.toISOString(),
                scheduledFor: dueDateTime.toISOString(),
                reminderDate: reminderDateTime ? reminderDateTime.toISOString() : null,
                estimatedDuration: followUpData.estimatedDuration,
                category: followUpData.category,
                notificationType: followUpData.notificationType,
                assignedTo: followUpData.assignmentType === 'general' ? 'general' : (followUpData.assignedTo || userId),
                tags: followUpData.tags,
                reminders: followUpData.reminders,
                customFields: {
                    shipmentID: shipment.shipmentID,
                    customerName: shipment.shipTo?.companyName || shipment.shipTo?.company,
                    route: `${shipment.shipFrom?.city || 'N/A'} → ${shipment.shipTo?.city || 'N/A'}`,
                    shipmentStatus: shipment.status,
                    actionType: followUpData.actionType,
                    actionTypes: followUpData.actionTypes,
                    assignmentType: followUpData.assignmentType,
                    notificationType: followUpData.notificationType
                }
            };

            if (editingFollowUp) {
                // Update existing follow-up
                const updateFollowUpTask = httpsCallable(functions, 'updateFollowUpTask');
                await updateFollowUpTask({
                    taskId: editingFollowUp.id,
                    ...taskData
                });
                showSnackbar('Follow-up task updated successfully!', 'success');
            } else {
                // Create new follow-up
                const createFollowUpTask = httpsCallable(functions, 'createFollowUpTask');
                await createFollowUpTask(taskData);
                showSnackbar('Follow-up task created successfully!', 'success');
            }
            setFollowUpDialogOpen(false);

            // Refresh the follow-up list if it's open
            if (followUpListOpen) {
                loadExistingFollowUps();
            }

            // Reset form
            setFollowUpData({
                title: '',
                description: '',
                actionType: 'follow-up',
                actionTypes: ['email'],
                dueDate: '',
                dueTime: '09:00',
                reminderDate: '',
                reminderTime: '08:00',
                assignmentType: 'general',
                assignedTo: '',
                estimatedDuration: 30,
                category: 'manual',
                notificationType: 'email',
                tags: [],
                reminders: []
            });
            setEditingFollowUp(null);
        } catch (error) {
            console.error('Error creating follow-up task:', error);
            showSnackbar('Failed to create follow-up task', 'error');
        } finally {
            setFollowUpSubmitting(false);
        }
    }, [followUpData, shipment, userId, showSnackbar, editingFollowUp, followUpListOpen, loadExistingFollowUps]);

    const handleFollowUpCancel = useCallback(() => {
        setFollowUpDialogOpen(false);
        setEditingFollowUp(null);
        setFollowUpSubmitting(false);
        setFollowUpData({
            title: '',
            description: '',
            actionType: 'follow-up',
            actionTypes: ['email'],
            dueDate: '',
            dueTime: '09:00',
            reminderDate: '',
            reminderTime: '08:00',
            assignmentType: 'general',
            assignedTo: '',
            estimatedDuration: 30,
            category: 'manual',
            notificationType: 'email',
            tags: [],
            reminders: []
        });
    }, []);

    // Handle charges update - save to database with optimistic updates
    const handleChargesUpdate = useCallback(async (updatedCharges, isOptimistic = false) => {
        console.log('💰 ShipmentDetailX: handleChargesUpdate called', {
            shipmentId: shipment?.id,
            shipmentExists: !!shipment,
            chargesCount: updatedCharges?.length,
            isOptimistic
        });

        if (!shipment?.id || !updatedCharges) {
            console.error('❌ Missing shipment ID or charges:', { shipmentId: shipment?.id, chargesLength: updatedCharges?.length });
            return;
        }

        // For optimistic updates, just return success immediately
        if (isOptimistic) {
            console.log('🚀 Optimistic update - UI updated, will save in background');
            return { success: true };
        }

        try {
            // 🔧 CRITICAL FIX: Filter out charges with empty descriptions before sending to backend
            const validCharges = updatedCharges.filter((charge, index) => {
                if (!charge.description || charge.description.trim() === '') {
                    console.warn(`⚠️ Skipping charge ${index + 1} with empty description:`, charge);
                    return false;
                }
                return true;
            });

            if (validCharges.length === 0) {
                throw new Error('No valid charges to save. All charges must have a description.');
            }

            console.log('💰 Saving updated charges to database:', {
                shipmentId: shipment.id,
                originalChargeCount: updatedCharges.length,
                validChargeCount: validCharges.length,
                charges: validCharges.map(charge => ({
                    id: charge.id,
                    code: charge.code,
                    description: charge.description,
                    quotedCharge: charge.quotedCharge,
                    isTax: charge.isTax || false
                }))
            });

            // Call Firebase function to update charges
            const updateShipmentCharges = httpsCallable(functions, 'updateShipmentCharges');

            const chargesData = {
                shipmentId: shipment.id,
                charges: validCharges.map((charge, index) => ({
                    // 🔧 CRITICAL FIX: Only use fallbacks for truly missing/null values, preserve existing data
                    id: charge.id || `charge_${index}`, // Add unique ID for tracking
                    code: charge.code != null ? charge.code : 'FRT', // Preserve empty strings, only fallback for null/undefined
                    description: charge.description.trim(), // Ensure description is trimmed and not empty
                    quotedCost: charge.quotedCost != null ? parseFloat(charge.quotedCost) || 0 : 0,
                    quotedCharge: charge.quotedCharge != null ? parseFloat(charge.quotedCharge) || 0 : 0,
                    actualCost: charge.actualCost != null ? parseFloat(charge.actualCost) || 0 : 0,
                    actualCharge: charge.actualCharge != null ? parseFloat(charge.actualCharge) || 0 : 0,
                    invoiceNumber: charge.invoiceNumber != null ? charge.invoiceNumber : '-',
                    ediNumber: charge.ediNumber != null ? charge.ediNumber : '-',
                    commissionable: charge.commissionable != null ? charge.commissionable : false,
                    // Preserve any tax-related fields
                    isTax: charge.isTax || false,
                    isMarkup: charge.isMarkup || false
                }))
            };

            const result = await updateShipmentCharges(chargesData);

            if (result.data && result.data.success) {
                console.log('✅ Charges saved to database successfully');
                if (showSnackbar) {
                    showSnackbar('Charges saved successfully', 'success');
                }

                // 🔧 HYBRID APPROACH: Update local state with saved charges, then fallback refresh if needed
                try {
                    // 2. Selective State Update: Update local shipment state with confirmed data
                    console.log('🔄 Updating local state with saved charges');
                    setShipment(prevShipment => {
                        if (!prevShipment) {
                            console.warn('⚠️ No previous shipment data for state update');
                            return prevShipment;
                        }

                        // Calculate totals from the saved charges
                        const totalQuotedCost = validCharges.reduce((sum, charge) => sum + (parseFloat(charge.quotedCost) || 0), 0);
                        const totalQuotedCharge = validCharges.reduce((sum, charge) => sum + (parseFloat(charge.quotedCharge) || 0), 0);
                        const totalActualCost = validCharges.reduce((sum, charge) => sum + (parseFloat(charge.actualCost) || 0), 0);
                        const totalActualCharge = validCharges.reduce((sum, charge) => sum + (parseFloat(charge.actualCharge) || 0), 0);

                        // Update the shipment with new charge data
                        const updatedShipment = {
                            ...prevShipment,
                            rateBreakdown: validCharges,
                            // Update selectedRate if it exists
                            ...(prevShipment.selectedRate && {
                                selectedRate: {
                                    ...prevShipment.selectedRate,
                                    charges: validCharges,
                                    totalCharges: totalQuotedCharge,
                                    // Update rate totals if they exist
                                    ...(totalQuotedCharge > 0 && {
                                        cost: totalQuotedCost,
                                        price: totalQuotedCharge,
                                        totalCost: totalQuotedCost,
                                        totalPrice: totalQuotedCharge
                                    })
                                }
                            }),
                            // Update actualRates if it exists (for dual rate system)
                            ...(prevShipment.actualRates && {
                                actualRates: {
                                    ...prevShipment.actualRates,
                                    charges: validCharges,
                                    totalCharges: totalActualCost
                                }
                            }),
                            // Update markupRates if it exists (for dual rate system)
                            ...(prevShipment.markupRates && {
                                markupRates: {
                                    ...prevShipment.markupRates,
                                    charges: validCharges,
                                    totalCharges: totalActualCharge
                                }
                            }),
                            // Update any legacy charge fields
                            ...(prevShipment.charges && { charges: validCharges }),
                            // Update timestamp to track when charges were last modified
                            lastChargeUpdate: new Date().toISOString(),
                            chargesLastModified: new Date().toISOString()
                        };

                        console.log('✅ Local state updated with saved charges:', {
                            chargeCount: validCharges.length,
                            totalQuotedCost,
                            totalQuotedCharge,
                            totalActualCost,
                            totalActualCharge
                        });

                        return updatedShipment;
                    });

                    return { success: true };
                } catch (stateUpdateError) {
                    console.warn('⚠️ State update failed, falling back to full refresh:', stateUpdateError);

                    // 3. Fallback: Full refresh only if state update fails
                    setTimeout(() => {
                        console.log('🔄 Executing fallback refresh due to state update failure');
                        refreshShipment();
                    }, 300); // Shorter delay since this is a fallback

                    return { success: true };
                }
            } else {
                throw new Error(result.data?.error || 'Failed to update charges');
            }
        } catch (error) {
            console.error('❌ Error updating charges:', error);
            if (showSnackbar) {
                showSnackbar(`Failed to save charges: ${error.message}`, 'error');
            }
            return { success: false, error: error.message };
        }
    }, [shipment?.id, setShipment, refreshShipment]); // Added setShipment and refreshShipment for hybrid approach

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
            <Box sx={{ width: '100%', minHeight: '100vh', p: 3, pt: onBackToTable ? 1 : 3 }}>
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
                    onRefreshShipment={refreshShipment}
                    onRegenerateBOL={handleRegenerateBOL}
                    onRegenerateCarrierConfirmation={handleRegenerateCarrierConfirmation}
                    onEditShipment={handleEditShipmentClick}
                    onArchiveShipment={handleArchiveShipment}
                    onCreateFollowUp={handleCreateFollowUp}
                    onViewFollowUps={handleViewFollowUps}
                    followUpCount={existingFollowUps.filter(f => f.status !== 'completed').length}
                    isAdmin={isAdmin}
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
                        onStatusUpdated={refreshShipment}
                        isAdmin={isAdmin}
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
                        onViewPdf={viewPdfInModalRef.current}
                    /> */}

                    {/* Documents Section */}
                    <DocumentsSection
                        shipment={shipment}
                        shipmentDocuments={shipmentDocuments}
                        documentsLoading={documentsLoading}
                        documentsError={documentsError}
                        onRetryFetch={fetchShipmentDocuments}
                        onViewPdf={viewPdfInModalRef.current}
                        onDocumentUploaded={fetchShipmentDocuments}
                        showNotification={showSnackbar}
                    />

                    {/* Main Content Grid */}
                    <Grid container spacing={1} sx={{ mt: 1 }}>
                        {/* Rate Details */}
                        <RateDetails
                            key={`rate-details-${shipment?.id}`}
                            getBestRateInfo={getBestRateInfo}
                            carrierData={carrierData}
                            shipment={shipment}
                            isAdmin={isAdmin}
                            onChargesUpdate={handleChargesUpdate}
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
                shipment={shipment}
                onShipmentCancelled={handleShipmentCancelled}
                showNotification={showSnackbar}
            />

            <SnackbarNotification
                open={snackbar.open}
                message={snackbar.message}
                severity={snackbar.severity}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            />

            <EditShipmentModal
                open={editShipmentModalOpen}
                onClose={() => setEditShipmentModalOpen(false)}
                onShipmentUpdated={handleShipmentUpdated}
                shipment={shipment}
                carrierData={carrierData}
                showNotification={showSnackbar}
                companyIdForAddress={companyIdForAddress}
                isAdmin={isAdmin}
                userRole={userRole}
            />

            <DocumentRegenerationDialog
                open={regenerationDialog.open}
                onClose={closeRegenerationDialog}
                onViewDocument={regenerationDialog.onViewDocument}
                documentType={regenerationDialog.documentType}
                shipmentID={shipment?.shipmentID}
                isLoading={regenerationDialog.isLoading}
            />

            {/* Follow-Up Dialog */}
            <Dialog
                open={followUpDialogOpen}
                onClose={handleFollowUpCancel}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        maxHeight: '90vh'
                    }
                }}
            >
                <DialogTitle sx={{
                    fontSize: '16px',
                    fontWeight: 600,
                    borderBottom: '1px solid #e5e7eb',
                    pb: 2
                }}>
                    {editingFollowUp ? 'Edit Follow-Up Task' : 'Create Follow-Up Task'}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Grid container spacing={3}>
                        {/* Shipment Context */}
                        <Grid item xs={12}>
                            <Paper sx={{
                                p: 2,
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e5e7eb'
                            }}>

                                <Grid container spacing={2} alignItems="center">
                                    {/* Column 1: Shipment ID */}
                                    <Grid item xs={4}>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Shipment ID: {shipment?.shipmentID}
                                        </Typography>
                                    </Grid>

                                    {/* Column 2: Ship Date, ETA1, ETA2 (stacked) */}
                                    <Grid item xs={4}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                <strong>Ship Date:</strong> {shipment?.shipmentInfo?.shipmentDate ?
                                                    new Date(shipment.shipmentInfo.shipmentDate).toLocaleDateString() :
                                                    shipment?.bookedAt ? new Date(shipment.bookedAt).toLocaleDateString() : 'N/A'}
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                <strong>ETA1:</strong> {(() => {
                                                    const eta1 = shipment?.shipmentInfo?.eta1 || shipment?.eta1 || shipment?.ETA1;
                                                    if (eta1) {
                                                        try {
                                                            let dateObj;
                                                            // Handle Firestore Timestamp
                                                            if (eta1?.toDate) {
                                                                dateObj = eta1.toDate();
                                                            }
                                                            // Handle date-only strings (YYYY-MM-DD)
                                                            else if (typeof eta1 === 'string' && eta1.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                                                const parts = eta1.split('-');
                                                                dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                                            }
                                                            // Handle other date formats
                                                            else {
                                                                dateObj = new Date(eta1);
                                                            }
                                                            return dateObj.toLocaleDateString();
                                                        } catch (error) {
                                                            return 'N/A';
                                                        }
                                                    }
                                                    return 'N/A';
                                                })()}
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                <strong>ETA2:</strong> {(() => {
                                                    const eta2 = shipment?.shipmentInfo?.eta2 || shipment?.eta2 || shipment?.ETA2;
                                                    if (eta2) {
                                                        try {
                                                            let dateObj;
                                                            // Handle Firestore Timestamp
                                                            if (eta2?.toDate) {
                                                                dateObj = eta2.toDate();
                                                            }
                                                            // Handle date-only strings (YYYY-MM-DD)
                                                            else if (typeof eta2 === 'string' && eta2.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                                                const parts = eta2.split('-');
                                                                dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                                            }
                                                            // Handle other date formats
                                                            else {
                                                                dateObj = new Date(eta2);
                                                            }
                                                            return dateObj.toLocaleDateString();
                                                        } catch (error) {
                                                            return 'N/A';
                                                        }
                                                    }
                                                    return 'N/A';
                                                })()}
                                            </Typography>
                                        </Box>
                                    </Grid>

                                    {/* Column 3: Status */}
                                    <Grid item xs={4}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                Status:
                                            </Typography>
                                            <EnhancedStatusChip
                                                status={shipment?.status}
                                                size="small"
                                                compact={true}
                                                displayMode="auto"
                                                sx={{
                                                    height: '18px',
                                                    '& .MuiChip-label': {
                                                        fontSize: '9px',
                                                        fontWeight: 500,
                                                        px: 1
                                                    }
                                                }}
                                            />
                                            {/* Show substatus if available */}
                                            {(shipment?.statusOverride?.enhancedStatus?.subStatus || shipment?.subStatus) && (
                                                <EnhancedStatusChip
                                                    status={shipment?.statusOverride?.enhancedStatus || shipment?.subStatus}
                                                    size="small"
                                                    compact={true}
                                                    displayMode="sub-only"
                                                    sx={{
                                                        height: '18px',
                                                        '& .MuiChip-label': {
                                                            fontSize: '9px',
                                                            fontWeight: 500,
                                                            px: 1
                                                        }
                                                    }}
                                                />
                                            )}
                                        </Box>
                                    </Grid>

                                </Grid>
                            </Paper>
                        </Grid>





                        {/* Action Type */}
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Action Type</InputLabel>
                                <Select
                                    value={followUpData.actionType}
                                    label="Action Type"
                                    onChange={(e) => setFollowUpData(prev => ({ ...prev, actionType: e.target.value }))}
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="follow-up" sx={{ fontSize: '12px' }}>General Follow-Up</MenuItem>
                                    <MenuItem value="rate-request" sx={{ fontSize: '12px' }}>Rate Request</MenuItem>
                                    <MenuItem value="booking" sx={{ fontSize: '12px' }}>Booking Required</MenuItem>
                                    <MenuItem value="requested-update" sx={{ fontSize: '12px' }}>Requested Update</MenuItem>
                                    <MenuItem value="on-hold" sx={{ fontSize: '12px' }}>On Hold</MenuItem>
                                    <MenuItem value="claim" sx={{ fontSize: '12px' }}>Claim/Issue</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Action Types (Multi-select) */}
                        <Grid item xs={12} md={6}>
                            <Autocomplete
                                multiple
                                value={followUpData.actionTypes}
                                onChange={(event, newValue) => {
                                    setFollowUpData(prev => ({ ...prev, actionTypes: newValue }));
                                }}
                                options={['email', 'phone', 'internal']}
                                getOptionLabel={(option) => {
                                    switch (option) {
                                        case 'email': return 'Email';
                                        case 'phone': return 'Phone';
                                        case 'internal': return 'Internal';
                                        default: return option;
                                    }
                                }}
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => (
                                        <Chip
                                            {...getTagProps({ index })}
                                            key={option}
                                            label={option === 'email' ? 'Email' : option === 'phone' ? 'Phone' : 'Internal'}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                        />
                                    ))
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Communication Methods"
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-root': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                )}
                                sx={{
                                    '& .MuiAutocomplete-inputRoot': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiAutocomplete-option': {
                                        fontSize: '12px'
                                    }
                                }}
                                componentsProps={{
                                    popper: {
                                        sx: {
                                            '& .MuiAutocomplete-option': {
                                                fontSize: '12px'
                                            }
                                        }
                                    }
                                }}
                            />
                        </Grid>

                        {/* Note */}
                        <Grid item xs={12}>
                            <TextField
                                label="Note"
                                value={followUpData.description}
                                onChange={(e) => setFollowUpData(prev => ({ ...prev, description: e.target.value }))}
                                fullWidth
                                multiline
                                rows={3}
                                size="small"
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                placeholder="Note"
                            />
                        </Grid>

                        {/* Scheduling & Assignment */}
                        <Grid item xs={12}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 1 }}>
                                Scheduling & Assignment
                            </Typography>
                        </Grid>

                        {/* Due Date */}
                        <Grid
                            item
                            xs={12}
                            md={6}
                            sx={{
                                mt: 0,
                                cursor: 'pointer',
                                '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                }
                            }}
                            onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                    dueDateRef.current?.focus();
                                    dueDateRef.current?.click();
                                }
                            }}
                        >
                            <TextField
                                ref={dueDateRef}
                                label="Due Date"
                                type="date"
                                value={followUpData.dueDate}
                                onChange={(e) => setFollowUpData(prev => ({ ...prev, dueDate: e.target.value }))}
                                fullWidth
                                required
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            />
                        </Grid>

                        {/* Due Time */}
                        <Grid
                            item
                            xs={12}
                            md={6}
                            sx={{
                                cursor: 'pointer',
                                '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                }
                            }}
                            onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                    dueTimeRef.current?.focus();
                                    dueTimeRef.current?.click();
                                }
                            }}
                        >
                            <TextField
                                ref={dueTimeRef}
                                label="Due Time"
                                type="time"
                                value={followUpData.dueTime}
                                onChange={(e) => setFollowUpData(prev => ({ ...prev, dueTime: e.target.value }))}
                                fullWidth
                                required
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            />
                        </Grid>

                        {/* Reminder Section */}

                        {/* Reminder Date */}
                        <Grid
                            item
                            xs={12}
                            md={6}
                            sx={{
                                mt: 0,
                                cursor: 'pointer',
                                '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                }
                            }}
                            onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                    reminderDateRef.current?.focus();
                                    reminderDateRef.current?.click();
                                }
                            }}
                        >
                            <TextField
                                ref={reminderDateRef}
                                label="Reminder Date"
                                type="date"
                                value={followUpData.reminderDate}
                                onChange={(e) => setFollowUpData(prev => ({ ...prev, reminderDate: e.target.value }))}
                                fullWidth
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            />
                        </Grid>

                        {/* Reminder Time */}
                        <Grid
                            item
                            xs={12}
                            md={6}
                            sx={{
                                cursor: 'pointer',
                                '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                }
                            }}
                            onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                    reminderTimeRef.current?.focus();
                                    reminderTimeRef.current?.click();
                                }
                            }}
                        >
                            <TextField
                                ref={reminderTimeRef}
                                label="Reminder Time"
                                type="time"
                                value={followUpData.reminderTime}
                                onChange={(e) => setFollowUpData(prev => ({ ...prev, reminderTime: e.target.value }))}
                                fullWidth
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                sx={{
                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            />
                        </Grid>

                        {/* Assignment Type */}
                        <Grid item xs={12} md={6} sx={{ mt: 0 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Assignment Type</InputLabel>
                                <Select
                                    value={followUpData.assignmentType}
                                    label="Assignment Type"
                                    onChange={(e) => setFollowUpData(prev => ({
                                        ...prev,
                                        assignmentType: e.target.value,
                                        assignedTo: e.target.value === 'general' ? '' : prev.assignedTo
                                    }))}
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="general" sx={{ fontSize: '12px' }}>General Assignment</MenuItem>
                                    <MenuItem value="specific" sx={{ fontSize: '12px' }}>Specific User</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Specific User Assignment */}
                        {followUpData.assignmentType === 'specific' && (
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Assign To</InputLabel>
                                    <Select
                                        value={followUpData.assignedTo}
                                        label="Assign To"
                                        onChange={(e) => setFollowUpData(prev => ({ ...prev, assignedTo: e.target.value }))}
                                        sx={{ fontSize: '12px' }}
                                        disabled={loadingUsers}
                                    >
                                        {loadingUsers ? (
                                            <MenuItem disabled sx={{ fontSize: '12px' }}>Loading users...</MenuItem>
                                        ) : availableUsers.length === 0 ? (
                                            <MenuItem disabled sx={{ fontSize: '12px' }}>No users available for this company</MenuItem>
                                        ) : (
                                            availableUsers.map(user => {
                                                // Create a display name with proper formatting
                                                const displayName = user.firstName && user.lastName
                                                    ? `${user.firstName} ${user.lastName}`
                                                    : user.displayName || user.email;

                                                return (
                                                    <MenuItem key={user.id} value={user.id} sx={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Avatar
                                                            src={user.photoURL || user.avatar || user.profilePicture}
                                                            sx={{
                                                                width: 20,
                                                                height: 20,
                                                                fontSize: '10px',
                                                                bgcolor: user.photoURL || user.avatar || user.profilePicture ? 'transparent' : '#6366f1'
                                                            }}
                                                        >
                                                            {!user.photoURL && !user.avatar && !user.profilePicture && (
                                                                displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                                                            )}
                                                        </Avatar>
                                                        <Box>
                                                            {displayName} ({user.email})
                                                        </Box>
                                                    </MenuItem>
                                                );
                                            })
                                        )}
                                    </Select>
                                </FormControl>
                            </Grid>
                        )}



                        {/* Notification Type - Email Only */}
                        <Grid item xs={12} sx={{ mt: 0 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Notification Type</InputLabel>
                                <Select
                                    value={followUpData.notificationType}
                                    label="Notification Type"
                                    onChange={(e) => setFollowUpData(prev => ({ ...prev, notificationType: e.target.value }))}
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="email" sx={{ fontSize: '12px' }}>Email</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>


                    </Grid>
                </DialogContent>

                <DialogActions sx={{
                    px: 3,
                    py: 2,
                    borderTop: '1px solid #e5e7eb',
                    gap: 1
                }}>
                    <Button
                        onClick={handleFollowUpCancel}
                        sx={{
                            fontSize: '12px',
                            textTransform: 'none',
                            color: '#6b7280'
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            console.log('🖱️ CREATE TASK button clicked');
                            console.log('📋 Current followUpData:', followUpData);
                            console.log('✅ Button disabled state:', !followUpData.dueDate || !followUpData.actionTypes.length || (followUpData.assignmentType === 'specific' && !followUpData.assignedTo));
                            console.log('📅 Due date:', followUpData.dueDate);
                            console.log('🎯 Action types:', followUpData.actionTypes);
                            console.log('👥 Assignment type:', followUpData.assignmentType);
                            console.log('👤 Assigned to:', followUpData.assignedTo);
                            handleFollowUpSubmit();
                        }}
                        variant="contained"
                        disabled={followUpSubmitting || !followUpData.dueDate || !followUpData.actionTypes.length || (followUpData.assignmentType === 'specific' && !followUpData.assignedTo)}
                        sx={{
                            fontSize: '12px',
                            textTransform: 'none',
                            minWidth: 120
                        }}
                        startIcon={followUpSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                        {followUpSubmitting ?
                            (editingFollowUp ? 'Updating...' : 'Creating...') :
                            (editingFollowUp ? 'Update Task' : 'Create Task')
                        }
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Follow-Up List Dialog */}
            <Dialog
                open={followUpListOpen}
                onClose={() => setFollowUpListOpen(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        minHeight: '600px'
                    }
                }}
            >
                <DialogTitle sx={{
                    fontSize: '18px',
                    fontWeight: 600,
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    Follow-Up Tasks - {shipment?.shipmentID}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={handleCreateFollowUp}
                            sx={{
                                fontSize: '12px',
                                bgcolor: '#f59e0b',
                                '&:hover': {
                                    bgcolor: '#d97706'
                                }
                            }}
                        >
                            Create New
                        </Button>
                        <IconButton
                            onClick={() => setFollowUpListOpen(false)}
                            sx={{
                                color: '#6b7280',
                                '&:hover': {
                                    bgcolor: '#f3f4f6'
                                }
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    {loadingFollowUps ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <FollowUpTable
                            followUps={existingFollowUps}
                            onEditFollowUp={handleEditFollowUp}
                            onRefresh={loadExistingFollowUps}
                            availableUsers={availableUsers}
                        />
                    )}
                </DialogContent>
            </Dialog>


        </ErrorBoundary>
    );
};

export default ShipmentDetailX; 