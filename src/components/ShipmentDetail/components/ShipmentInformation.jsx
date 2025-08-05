import React, { useState, useEffect } from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Stack,
    Chip,
    IconButton,
    CircularProgress,
    Link,
    Avatar,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Popover
} from '@mui/material';
import {
    LocalShipping as LocalShippingIcon,
    AccessTime as AccessTimeIcon,
    Assignment as AssignmentIcon,
    ContentCopy as ContentCopyIcon,
    Refresh as RefreshIcon,
    Map as MapIcon,
    Route as RouteIcon,
    LocationOn as LocationOnIcon,
    Close as CloseIcon,
    Business as BusinessIcon,
    Person as PersonIcon,
    OpenInNew as OpenInNewIcon,
    KeyboardArrowDown as ArrowDownIcon
} from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
// Note: We don't use @react-google-maps/api components here due to provider issues
// Instead we'll create the map directly with the Google Maps JavaScript API
import { db } from '../../../firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';
import EnhancedStatusChip from '../../StatusChip/EnhancedStatusChip';
import ManualStatusOverride from './ManualStatusOverride';
import invoiceStatusService from '../../../services/invoiceStatusService';
import { recordShipmentEvent, EVENT_TYPES, EVENT_SOURCES } from '../../../utils/shipmentEvents';
import { getCircleLogo } from '../../../utils/logoUtils';

// CarrierDisplay component to show carrier logo and name
const CarrierDisplay = React.memo(({ carrierName, carrierData, size = 'medium', isIntegrationCarrier }) => {
    const sizeConfig = {
        small: { logoSize: 24, fontSize: '12px' },
        medium: { logoSize: 32, fontSize: '1rem' },
        large: { logoSize: 40, fontSize: '1.125rem' }
    };

    const { logoSize, fontSize } = sizeConfig[size] || sizeConfig.medium;

    if (!carrierName || carrierName === 'N/A') {
        return <Typography variant="body1" sx={{ fontSize }}>N/A</Typography>;
    }

    const logoUrl = carrierData?.logoUrl || carrierData?.image;

    return (
        <Typography variant="body1" sx={{ fontSize, fontWeight: 500 }}>
            {carrierName}
            {isIntegrationCarrier && (
                <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
                    (via eShipPlus)
                </Typography>
            )}
        </Typography>
    );
});

const ShipmentInformation = ({
    shipment,
    getBestRateInfo,
    carrierData,
    mergedEvents,
    actionStates,
    smartUpdateLoading,
    onRefreshStatus,
    onShowSnackbar,
    onOpenTrackingDrawer,
    onStatusUpdated, // Add callback for status updates
    isAdmin // Add admin context
}) => {
    // Hooks
    const navigate = useNavigate();
    const { user, currentUser } = useAuth();



    // Map state
    const [openMap, setOpenMap] = useState(null);
    const [geocodedPosition, setGeocodedPosition] = useState(null);
    const [geocodingLoading, setGeocodingLoading] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
    const [directions, setDirections] = useState(null);
    const [mapsApiKey, setMapsApiKey] = useState(null);

    // Company and Customer Data State
    const [companyData, setCompanyData] = useState(null);
    const [customerData, setCustomerData] = useState(null);
    const [loadingCompanyData, setLoadingCompanyData] = useState(false);
    const [loadingCustomerData, setLoadingCustomerData] = useState(false);

    // Invoice status editing state
    const [invoiceStatuses, setInvoiceStatuses] = useState([]);
    const [statusPopoverAnchor, setStatusPopoverAnchor] = useState(null);
    const [editingStatusValue, setEditingStatusValue] = useState('');
    const [savingInvoiceStatus, setSavingInvoiceStatus] = useState(false);

    // Check if Google Maps is loaded and get API key
    useEffect(() => {
        const initializeMaps = async () => {
            try {
                console.log('🗺️ [ShipmentInformation] Starting Maps initialization...');
                setMapError(null);

                // Check if we're in admin context and Google Maps is already initialized
                if (window.adminGoogleMapsStatus) {
                    console.log('🏢 [ShipmentInformation] Checking admin Google Maps context');
                    if (window.adminGoogleMapsStatus.isLoaded && window.adminGoogleMapsStatus.apiKey) {
                        console.log('✅ [ShipmentInformation] Google Maps loaded from admin context');
                        setIsGoogleMapsLoaded(true);
                        setMapsApiKey(window.adminGoogleMapsStatus.apiKey);
                        return;
                    }
                }

                // Check if Google Maps is already loaded globally
                if (window.google && window.google.maps) {
                    console.log('✅ [ShipmentInformation] Google Maps already loaded globally');
                    setIsGoogleMapsLoaded(true);

                    // Still try to get API key for Routes API
                    try {
                        const keysRef = collection(db, 'keys');
                        const keysSnapshot = await getDocs(keysRef);
                        if (!keysSnapshot.empty) {
                            const firstDoc = keysSnapshot.docs[0];
                            const key = firstDoc.data().googleAPI;
                            if (key) {
                                console.log('✅ [ShipmentInformation] API key retrieved for Routes API');
                                setMapsApiKey(key);
                            } else {
                                console.warn('⚠️ [ShipmentInformation] No API key found, maps will work but Routes API may fail');
                            }
                        }
                    } catch (apiKeyError) {
                        console.warn('⚠️ [ShipmentInformation] Could not get API key:', apiKeyError);
                    }
                    return;
                }

                console.log('🔄 [ShipmentInformation] Google Maps not loaded, fetching API key...');

                // Fetch API key from Firestore
                const keysRef = collection(db, 'keys');
                const keysSnapshot = await getDocs(keysRef);

                if (!keysSnapshot.empty) {
                    const firstDoc = keysSnapshot.docs[0];
                    const key = firstDoc.data().googleAPI;
                    if (!key) {
                        throw new Error('No API key found in Firestore');
                    }
                    console.log('✅ [ShipmentInformation] API key retrieved from Firestore');
                    setMapsApiKey(key);
                } else {
                    throw new Error('API key document not found in Firestore');
                }

                // Wait for Google Maps to load (including admin context)
                console.log('⏳ [ShipmentInformation] Waiting for Google Maps to load...');
                const checkGoogleMaps = () => {
                    // Check both regular loading and admin context
                    const regularMapsLoaded = window.google && window.google.maps;
                    const adminMapsLoaded = window.adminGoogleMapsStatus &&
                        window.adminGoogleMapsStatus.isLoaded &&
                        window.adminGoogleMapsStatus.apiKey;

                    if (regularMapsLoaded || adminMapsLoaded) {
                        console.log('✅ [ShipmentInformation] Google Maps loaded successfully');
                        setIsGoogleMapsLoaded(true);

                        // Use admin API key if available and not already set
                        if (adminMapsLoaded && !mapsApiKey) {
                            setMapsApiKey(window.adminGoogleMapsStatus.apiKey);
                            console.log('✅ [ShipmentInformation] Using admin API key');
                        }
                    } else {
                        console.log('🔄 [ShipmentInformation] Still waiting for Google Maps...');
                        setTimeout(checkGoogleMaps, 500); // Increased interval for better debugging
                    }
                };
                checkGoogleMaps();

                // Set a timeout to show error if Maps doesn't load within 15 seconds (increased for admin routes)
                setTimeout(() => {
                    const regularMapsLoaded = window.google && window.google.maps;
                    const adminMapsLoaded = window.adminGoogleMapsStatus &&
                        window.adminGoogleMapsStatus.isLoaded;

                    if (!regularMapsLoaded && !adminMapsLoaded) {
                        console.error('❌ [ShipmentInformation] Google Maps failed to load within 15 seconds');
                        setMapError('Google Maps failed to load. Please check your internet connection and try refreshing the page.');
                        setIsGoogleMapsLoaded(false);
                    }
                }, 15000);

            } catch (error) {
                console.error('❌ [ShipmentInformation] Error initializing Maps:', error);
                setMapError(`Failed to load Google Maps: ${error.message}`);
                setIsGoogleMapsLoaded(false);
            }
        };

        initializeMaps();
    }, []);

    // Load company data
    useEffect(() => {
        const loadCompanyData = async () => {
            // Check multiple possible company ID fields
            const companyId = shipment?.companyID || shipment?.companyId || shipment?.company?.id || shipment?.company;

            console.log('🏢 Loading company data for ID:', companyId);
            console.log('🏢 Shipment object:', {
                companyID: shipment?.companyID,
                companyId: shipment?.companyId,
                company: shipment?.company
            });

            if (!companyId) {
                console.warn('🏢 No company ID found in shipment');
                setCompanyData(null);
                setLoadingCompanyData(false);
                return;
            }

            setLoadingCompanyData(true);
            try {
                // Query companies by companyID field (not document ID)
                const companiesQuery = query(
                    collection(db, 'companies'),
                    where('companyID', '==', companyId),
                    limit(1)
                );

                const companiesSnapshot = await getDocs(companiesQuery);

                if (!companiesSnapshot.empty) {
                    const companyDoc = companiesSnapshot.docs[0];
                    const data = {
                        id: companyDoc.id,
                        ...companyDoc.data()
                    };
                    console.log('✅ Company data loaded:', data);
                    setCompanyData(data);
                } else {
                    // Fallback: try as document ID (for backward compatibility)
                    console.log('🔄 Trying as document ID fallback...');
                    const companyDoc = await getDoc(doc(db, 'companies', companyId));

                    if (companyDoc.exists()) {
                        const data = { id: companyDoc.id, ...companyDoc.data() };
                        console.log('✅ Company data loaded (fallback):', data);
                        setCompanyData(data);
                    } else {
                        console.warn('❌ Company not found in Firestore:', companyId);
                        setCompanyData(null);
                    }
                }
            } catch (error) {
                console.error('❌ Error loading company data:', error);
                setCompanyData(null);
            } finally {
                setLoadingCompanyData(false);
            }
        };

        loadCompanyData();
    }, [shipment?.companyID, shipment?.companyId, shipment?.company]);

    // Load customer data
    useEffect(() => {
        const loadCustomerData = async () => {
            // Get the customer ID from multiple possible sources
            const customerId = shipment?.customerId ||
                shipment?.customerID ||
                shipment?.shipFrom?.customerID ||
                shipment?.origin?.customerID ||
                shipment?.shipTo?.customerID ||
                shipment?.destination?.customerID ||
                shipment?.shipFrom?.addressClassID ||
                shipment?.shipTo?.addressClassID;

            console.log('🔍 [ShipmentInformation] Customer ID lookup:', {
                shipmentCustomerId: shipment?.customerId,
                shipmentCustomerID: shipment?.customerID,
                shipFromCustomerID: shipment?.shipFrom?.customerID,
                originCustomerID: shipment?.origin?.customerID,
                shipToCustomerID: shipment?.shipTo?.customerID,
                destinationCustomerID: shipment?.destination?.customerID,
                shipFromAddressClassID: shipment?.shipFrom?.addressClassID,
                shipToAddressClassID: shipment?.shipTo?.addressClassID,
                resolvedCustomerId: customerId
            });

            if (!customerId) {
                console.log('❌ [ShipmentInformation] No customer ID found in any location');
                setCustomerData(null);
                setLoadingCustomerData(false);
                return;
            }

            setLoadingCustomerData(true);

            try {
                console.log('🔍 [ShipmentInformation] Loading customer data for ID:', customerId);

                // FIRST: Try to get customer by document ID (direct lookup)
                const customerDocRef = doc(db, 'customers', customerId);
                const customerDocSnapshot = await getDoc(customerDocRef);

                if (customerDocSnapshot.exists()) {
                    const data = { id: customerDocSnapshot.id, ...customerDocSnapshot.data() };
                    console.log('✅ [ShipmentInformation] Customer found by document ID:', data);
                    setCustomerData(data);
                    setLoadingCustomerData(false);
                    return;
                }

                // SECOND: Try to query by customerID field
                const customerQuery = query(
                    collection(db, 'customers'),
                    where('customerID', '==', customerId),
                    limit(1)
                );
                const customerSnapshot = await getDocs(customerQuery);

                if (!customerSnapshot.empty) {
                    const customerDoc = customerSnapshot.docs[0];
                    const data = { id: customerDoc.id, ...customerDoc.data() };
                    console.log('✅ [ShipmentInformation] Customer found by customerID field:', data);
                    setCustomerData(data);
                } else {
                    console.log('❌ [ShipmentInformation] Customer not found in database for ID:', customerId);
                    setCustomerData(null);
                }
            } catch (error) {
                console.error('❌ [ShipmentInformation] Error loading customer:', error);
                setCustomerData(null);
            }

            setLoadingCustomerData(false);
        };

        loadCustomerData();
    }, [shipment?.customerId, shipment?.customerID, shipment?.shipFrom?.customerID, shipment?.origin?.customerID, shipment?.shipTo?.customerID, shipment?.destination?.customerID, shipment?.shipFrom?.addressClassID, shipment?.shipTo?.addressClassID]);

    // Load invoice statuses
    useEffect(() => {
        const loadInvoiceStatuses = async () => {
            try {
                const statuses = await invoiceStatusService.loadInvoiceStatuses();
                setInvoiceStatuses(statuses);
            } catch (error) {
                console.error('Error loading invoice statuses:', error);
                setInvoiceStatuses([]);
            }
        };

        loadInvoiceStatuses();
    }, []);

    // Company and Customer navigation handlers
    const handleNavigateToCompany = () => {
        if (!companyData) return;

        console.log('🏢 Navigating to company detail for:', companyData);

        // Check if user is admin to determine route
        const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

        if (isAdmin && companyData.id) {
            // Navigate to admin company detail page using Firestore document ID
            navigate(`/admin/companies/${companyData.id}`);
        } else {
            console.warn('🏢 Cannot navigate - insufficient permissions or missing company ID');
        }
    };

    const handleNavigateToCustomer = () => {
        if (!customerData || customerData.id === 'ship-to-data') return;

        console.log('👤 Navigating to customer detail for:', customerData);

        // Check if user is admin to determine route
        const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

        if (isAdmin && customerData.id) {
            // Navigate to admin customer detail page using Firestore document ID
            navigate(`/admin/customers/${customerData.id}`);
        } else if (customerData.id) {
            // Navigate to regular customer detail page
            navigate(`/customers/${customerData.id}`);
        } else {
            console.warn('👤 Cannot navigate - missing customer ID');
        }
    };

    // Invoice status editing handlers
    const handleStartEditInvoiceStatus = (currentInvoiceStatus, event) => {
        setEditingStatusValue(currentInvoiceStatus);
        setStatusPopoverAnchor(event.currentTarget);
    };

    const handleClosePopover = () => {
        setStatusPopoverAnchor(null);
        setEditingStatusValue('');
    };

    const handleSaveInvoiceStatus = async (newStatusValue = null) => {
        const statusToSave = newStatusValue || editingStatusValue;
        const currentInvoiceStatus = shipment?.invoiceStatus || 'uninvoiced';

        // Compare with the shipment's current invoice status
        if (!statusToSave || statusToSave === currentInvoiceStatus) {
            handleClosePopover();
            return;
        }

        setSavingInvoiceStatus(true);
        try {
            console.log(`Updating shipment ${shipment.shipmentID} invoice status from "${currentInvoiceStatus}" to "${statusToSave}"`);

            // Find the actual Firestore document that contains this shipmentID
            const shipmentsQuery = query(
                collection(db, 'shipments'),
                where('shipmentID', '==', shipment.shipmentID),
                limit(1)
            );

            const querySnapshot = await getDocs(shipmentsQuery);

            if (querySnapshot.empty) {
                throw new Error(`No shipment document found with shipmentID: ${shipment.shipmentID}`);
            }

            // Get the actual document ID (not the shipmentID field)
            const shipmentDoc = querySnapshot.docs[0];
            const actualDocumentId = shipmentDoc.id;

            console.log(`Found shipment document ID: ${actualDocumentId} for shipmentID: ${shipment.shipmentID}`);

            // Update using the actual document ID
            const shipmentRef = doc(db, 'shipments', actualDocumentId);
            await updateDoc(shipmentRef, {
                invoiceStatus: statusToSave,
                updatedAt: new Date(),
                updatedBy: currentUser.email
            });

            console.log(`Successfully updated shipment document ${actualDocumentId} (shipmentID: ${shipment.shipmentID}) invoiceStatus to "${statusToSave}"`);

            // Verify the update by reading the document back
            const updatedShipment = await getDoc(shipmentRef);
            if (updatedShipment.exists()) {
                const shipmentData = updatedShipment.data();
                console.log(`Verified: shipment ${shipment.shipmentID} now has invoiceStatus: "${shipmentData.invoiceStatus}"`);
            }

            // 🔧 RECORD INVOICE STATUS CHANGE EVENT
            try {
                // Get the status labels for better display
                const currentStatusObj = invoiceStatuses.find(s => s.statusCode === currentInvoiceStatus);
                const newStatusObj = invoiceStatuses.find(s => s.statusCode === statusToSave);

                const currentStatusLabel = currentStatusObj?.statusLabel || currentInvoiceStatus;
                const newStatusLabel = newStatusObj?.statusLabel || statusToSave;

                // 🔍 DEBUG LOGGING: Let's see what IDs we're working with
                console.log('🔍 DEBUG - Invoice Status Change Event Recording:');
                console.log('shipment.id (Firestore document ID):', shipment.id);
                console.log('shipment.shipmentID (business ID):', shipment.shipmentID);
                console.log('actualDocumentId (from query):', actualDocumentId);
                console.log('Event will be recorded using actualDocumentId:', actualDocumentId);

                await recordShipmentEvent(actualDocumentId, {
                    eventType: EVENT_TYPES.USER_ACTION,
                    title: 'Invoice Status Changed',
                    description: `Invoice status changed from "${currentStatusLabel}" to "${newStatusLabel}"`,
                    source: EVENT_SOURCES.USER,
                    metadata: {
                        previousInvoiceStatus: currentInvoiceStatus,
                        newInvoiceStatus: statusToSave,
                        previousStatusLabel: currentStatusLabel,
                        newStatusLabel: newStatusLabel,
                        changeType: 'invoice_status'
                    }
                }, {
                    email: currentUser?.email,
                    uid: currentUser?.uid,
                    displayName: currentUser?.displayName || currentUser?.email
                });

                console.log(`📝 Recorded invoice status change event for shipment ${shipment.shipmentID} using documentId ${actualDocumentId}`);
            } catch (eventError) {
                console.error('Failed to record invoice status change event:', eventError);
                // Don't fail the main operation if event logging fails
            }

            if (onShowSnackbar) {
                onShowSnackbar('Invoice status updated successfully', 'success');
            }

            handleClosePopover();

            // Trigger a refresh of the shipment data if callback is available
            if (onStatusUpdated) {
                onStatusUpdated();
            }

        } catch (error) {
            console.error('Error updating invoice status:', error);
            if (onShowSnackbar) {
                onShowSnackbar('Failed to update invoice status: ' + error.message, 'error');
            }
        } finally {
            setSavingInvoiceStatus(false);
        }
    };

    // Map options - normal styling with street view enabled
    const mapOptions = {
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: true,
        mapTypeControl: false,
        fullscreenControl: true
    };

    const formatAddress = (address) => {
        if (!address) return 'N/A';
        const parts = [];
        if (address.company) parts.push(address.company);
        if (address.street) parts.push(address.street);
        if (address.street2) parts.push(address.street2);
        if (address.city && address.state) {
            parts.push(`${address.city}, ${address.state} ${address.postalCode || ''}`);
        }
        if (address.country) parts.push(address.country);
        return parts.join('\n') || 'N/A';
    };

    const getAddress = (shipment, type) => {
        if (!type) return null;
        return shipment?.[type] || shipment?.[type.toLowerCase()] || null;
    };

    const handleOpenMap = (type) => {
        setOpenMap(type);
    };

    const handleCloseMap = () => {
        setOpenMap(null);
    };

    // Geocoding and map rendering logic
    useEffect(() => {
        console.log('🗺️ [ShipmentInformation] Geocoding effect triggered:', {
            openMap,
            hasShipment: !!shipment,
            isGoogleMapsLoaded,
            mapsApiKey: !!mapsApiKey
        });

        if (!openMap || !shipment || !isGoogleMapsLoaded) {
            console.log('🔄 [ShipmentInformation] Geocoding conditions not met, skipping...');
            return;
        }

        console.log('✅ [ShipmentInformation] Starting geocoding for:', openMap);
        setGeocodedPosition(null);
        setDirections(null);
        setMapError(null);
        setGeocodingLoading(true);

        if (openMap === 'route') {
            // Complete route calculation using Routes API v2
            const calculateRoute = async () => {
                try {
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

                    const fromAddress = getAddress(shipment, 'shipFrom');
                    const toAddress = getAddress(shipment, 'shipTo');

                    if (!fromAddress || !toAddress) {
                        setMapError('Missing origin or destination address');
                        setGeocodingLoading(false);
                        return;
                    }

                    const [originResult, destinationResult] = await Promise.all([
                        geocodeWithRetry(fromAddress, 'origin'),
                        geocodeWithRetry(toAddress, 'destination')
                    ]);

                    // Validate geocoding results
                    if (!originResult || !originResult.geometry || !originResult.geometry.location) {
                        throw new Error('Invalid origin location data');
                    }

                    if (!destinationResult || !destinationResult.geometry || !destinationResult.geometry.location) {
                        throw new Error('Invalid destination location data');
                    }

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
                        units: "IMPERIAL"
                    };

                    // Add region code if country is available
                    if (fromAddress.country) {
                        const countryCode = fromAddress.country.toLowerCase();
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

                    // Create proper bounds that include the entire route path
                    const routeBounds = new window.google.maps.LatLngBounds();
                    decodedPath.forEach(point => {
                        routeBounds.extend(point);
                    });

                    // Create a properly structured directions object that matches what DirectionsRenderer expects
                    const directionsResult = {
                        routes: [{
                            legs: [{
                                start_location: originResult.geometry.location,
                                end_location: destinationResult.geometry.location,
                                distance: {
                                    text: `${Math.round(route.distanceMeters / 1609.34)} mi`,
                                    value: route.distanceMeters
                                },
                                duration: {
                                    text: `${durationInMinutes} mins`,
                                    value: durationInSeconds
                                },
                                steps: [{
                                    distance: {
                                        text: `${Math.round(route.distanceMeters / 1609.34)} mi`,
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
                            bounds: routeBounds,
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
                setGeocodingLoading(false);
            };

            // Only calculate route when API key is available
            if (mapsApiKey) {
                calculateRoute();
            } else {
                setMapError('API key not available');
                setGeocodingLoading(false);
            }
        } else {
            // Handle single location geocoding
            const address = getAddress(shipment, openMap);
            if (!address) {
                setMapError('No address available');
                setGeocodingLoading(false);
                return;
            }

            const geocoder = new window.google.maps.Geocoder();
            const addressString = formatAddress(address).replace(/\n/g, ', ');

            geocoder.geocode({ address: addressString }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    setGeocodedPosition({
                        lat: results[0].geometry.location.lat(),
                        lng: results[0].geometry.location.lng()
                    });
                } else {
                    setMapError('Could not find location');
                }
                setGeocodingLoading(false);
            });
        }
    }, [openMap, shipment, isGoogleMapsLoaded, mapsApiKey]);

    // Map container ref
    const mapContainerRef = React.useRef(null);
    const mapInstanceRef = React.useRef(null);
    const directionsRendererRef = React.useRef(null);

    // Initialize map when container is ready and Google Maps is loaded
    React.useEffect(() => {
        if (!mapContainerRef.current || !isGoogleMapsLoaded || !openMap) return;

        console.log('🗺️ [ShipmentInformation] Initializing Google Map directly...');

        try {
            // Clear any existing map
            if (mapInstanceRef.current) {
                console.log('🧹 [ShipmentInformation] Cleaning up existing map...');
                mapInstanceRef.current = null;
            }

            if (directionsRendererRef.current) {
                directionsRendererRef.current.setMap(null);
                directionsRendererRef.current = null;
            }

            // Create map options
            const mapOptions = {
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: true,
                mapTypeControl: false,
                fullscreenControl: true,
                gestureHandling: 'greedy'
            };

            // Initialize the map
            const map = new window.google.maps.Map(mapContainerRef.current, mapOptions);
            mapInstanceRef.current = map;

            console.log('✅ [ShipmentInformation] Google Map initialized successfully');

            // Handle route view
            if (openMap === 'route' && directions) {
                // Rendering route on map

                // Create and render directions
                const directionsRenderer = new window.google.maps.DirectionsRenderer({
                    polylineOptions: {
                        strokeColor: '#2196f3',
                        strokeWeight: 5,
                        strokeOpacity: 0.8
                    },
                    suppressMarkers: true
                });

                directionsRenderer.setMap(map);
                directionsRenderer.setDirections(directions);
                directionsRendererRef.current = directionsRenderer;

                // Add custom markers
                const startIcon = {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#4caf50" stroke="#ffffff" stroke-width="2"/>
                            <circle cx="12" cy="12" r="4" fill="#ffffff"/>
                        </svg>
                    `),
                    scaledSize: new window.google.maps.Size(24, 36),
                    anchor: new window.google.maps.Point(12, 36)
                };

                const endIcon = {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#f44336" stroke="#ffffff" stroke-width="2"/>
                            <circle cx="12" cy="12" r="4" fill="#ffffff"/>
                        </svg>
                    `),
                    scaledSize: new window.google.maps.Size(24, 36),
                    anchor: new window.google.maps.Point(12, 36)
                };

                new window.google.maps.Marker({
                    position: directions.routes[0].legs[0].start_location,
                    map: map,
                    icon: startIcon,
                    title: "Start Location"
                });

                new window.google.maps.Marker({
                    position: directions.routes[0].legs[0].end_location,
                    map: map,
                    icon: endIcon,
                    title: "End Location"
                });

                // Fit route bounds with proper timing and padding
                const routeBounds = directions.routes[0].bounds;
                if (routeBounds && !routeBounds.isEmpty()) {
                    // Small delay to ensure map is fully rendered
                    setTimeout(() => {
                        map.fitBounds(routeBounds, {
                            top: 40,
                            right: 40,
                            bottom: 40,
                            left: 40
                        });

                        // Ensure zoom level is reasonable for route viewing
                        const listener = window.google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
                            if (map.getZoom() > 16) {
                                map.setZoom(16);
                            }
                        });
                    }, 100);
                }
            } else if (geocodedPosition) {
                console.log('📍 [ShipmentInformation] Rendering single location on map...');

                // Set center and zoom for single location
                map.setCenter(geocodedPosition);
                map.setZoom(15);

                // Add marker for single location
                const markerIcon = {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="${openMap === 'shipFrom' ? '#4caf50' : '#f44336'}" stroke="#ffffff" stroke-width="2"/>
                            <circle cx="12" cy="12" r="4" fill="#ffffff"/>
                        </svg>
                    `),
                    scaledSize: new window.google.maps.Size(24, 36),
                    anchor: new window.google.maps.Point(12, 36)
                };

                new window.google.maps.Marker({
                    position: geocodedPosition,
                    map: map,
                    icon: markerIcon
                });
            }

        } catch (error) {
            console.error('❌ [ShipmentInformation] Error initializing map:', error);
            setMapError(`Failed to initialize map: ${error.message}`);
        }

        // Cleanup function
        return () => {
            if (directionsRendererRef.current) {
                directionsRendererRef.current.setMap(null);
                directionsRendererRef.current = null;
            }
        };

    }, [isGoogleMapsLoaded, openMap, directions, geocodedPosition]);

    const renderMap = () => {
        if (!isGoogleMapsLoaded || geocodingLoading) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <CircularProgress />
                    <Typography variant="body2" sx={{ ml: 2 }}>
                        {!isGoogleMapsLoaded ? 'Loading Google Maps...' : 'Loading location data...'}
                    </Typography>
                </Box>
            );
        }

        if (mapError) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 2 }}>
                    <Typography color="error" align="center">{mapError}</Typography>
                </Box>
            );
        }

        // For route view
        if (openMap === 'route') {
            if (!directions) {
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <Typography color="text.secondary" align="center">No route available</Typography>
                    </Box>
                );
            }
        } else {
            // For single location view
            if (!geocodedPosition) {
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <Typography color="text.secondary" align="center">No location available</Typography>
                    </Box>
                );
            }
        }

        // Return the map container
        return (
            <Box
                ref={mapContainerRef}
                sx={{
                    height: '100%',
                    width: '100%',
                    minHeight: '400px',
                    borderRadius: 1,
                    overflow: 'hidden'
                }}
            />
        );
    };

    // Helper function to format bill type for display
    const formatBillType = (billType) => {
        if (!billType) return 'N/A';

        const billTypeMap = {
            'prepaid': 'Prepaid',
            'collect': 'Collect',
            'third_party': 'Third Party'
        };

        return billTypeMap[billType.toLowerCase()] || billType;
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Not Available';

        try {
            let date;

            // Debug logging
            console.log('formatTimestamp input:', timestamp);
            console.log('formatTimestamp type:', typeof timestamp);
            if (timestamp && typeof timestamp === 'object') {
                console.log('formatTimestamp object keys:', Object.keys(timestamp));
                console.log('formatTimestamp object:', JSON.stringify(timestamp, null, 2));
            }

            // Handle Firestore Timestamp
            if (timestamp && timestamp.toDate && typeof timestamp.toDate === 'function') {
                date = timestamp.toDate();
            }
            // Handle timestamp objects with seconds (and optional nanoseconds)
            else if (timestamp && typeof timestamp === 'object' && timestamp.seconds !== undefined) {
                const milliseconds = timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000;
                date = new Date(milliseconds);
            }
            // Handle timestamp objects with _seconds (alternative format)
            else if (timestamp && typeof timestamp === 'object' && timestamp._seconds !== undefined) {
                const milliseconds = timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000;
                date = new Date(milliseconds);
            }
            // Handle Date objects
            else if (timestamp instanceof Date) {
                date = timestamp;
            }
            // Handle numeric timestamps
            else if (typeof timestamp === 'number') {
                date = new Date(timestamp);
            }
            // Handle string timestamps
            else if (typeof timestamp === 'string') {
                date = new Date(timestamp);
            }
            // Handle objects that might have a different structure
            else if (timestamp && typeof timestamp === 'object') {
                // Handle serverTimestamp placeholders (these should not exist in production)
                if (timestamp._methodName === 'serverTimestamp') {
                    console.warn('Found serverTimestamp placeholder in data - this should not happen in production:', timestamp);
                    return 'Pending...';
                }

                // Try to extract a date value from the object
                if (timestamp.date) {
                    date = new Date(timestamp.date);
                } else if (timestamp.value) {
                    date = new Date(timestamp.value);
                } else if (timestamp.time) {
                    date = new Date(timestamp.time);
                } else {
                    // Last resort - try to convert to string and parse
                    date = new Date(String(timestamp));
                }
            }
            else {
                date = new Date(timestamp);
            }

            // Check if date is valid
            if (!date || isNaN(date.getTime())) {
                console.warn('Invalid timestamp format after parsing:', timestamp, 'resulted in:', date);
                return 'Invalid Date';
            }

            // Format the date nicely
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'America/Toronto' // Force Eastern Time
            });
        } catch (error) {
            console.error('Error formatting timestamp:', error, timestamp);
            return 'Format Error';
        }
    };

    const getLastUpdatedTimestamp = (shipment, mergedEvents) => {
        if (!shipment && !mergedEvents) return null;

        const timestamps = [];

        if (shipment?.updatedAt) {
            timestamps.push(shipment.updatedAt);
        }

        // For QuickShip, also include bookedAt timestamp
        if (shipment?.creationMethod === 'quickship' && shipment?.bookedAt) {
            timestamps.push(shipment.bookedAt);
        }

        if (mergedEvents && Array.isArray(mergedEvents)) {
            mergedEvents.forEach(event => {
                if (event.timestamp) timestamps.push(event.timestamp);
                if (event.eventTime) timestamps.push(event.eventTime);
            });
        }

        if (timestamps.length === 0) return null;

        return timestamps.reduce((latest, current) => {
            try {
                let currentTime, latestTime;

                // Handle current timestamp
                if (current?.toDate) {
                    currentTime = current.toDate();
                } else if (current?.seconds) {
                    currentTime = new Date(current.seconds * 1000 + (current.nanoseconds || 0) / 1000000);
                } else {
                    currentTime = new Date(current);
                }

                // Handle latest timestamp
                if (latest?.toDate) {
                    latestTime = latest.toDate();
                } else if (latest?.seconds) {
                    latestTime = new Date(latest.seconds * 1000 + (latest.nanoseconds || 0) / 1000000);
                } else {
                    latestTime = new Date(latest);
                }

                return currentTime > latestTime ? current : latest;
            } catch (error) {
                console.error('Error comparing timestamps:', error);
                return latest;
            }
        });
    };

    const capitalizeShipmentType = (type) => {
        if (!type) return 'N/A';
        return type.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };

    const handleCopyTracking = () => {
        const trackingNum = (() => {
            // For QuickShip, use the carrier tracking number entered in the form first
            if (shipment?.creationMethod === 'quickship') {
                return shipment?.shipmentInfo?.carrierTrackingNumber ||
                    shipment?.trackingNumber ||
                    shipment?.shipmentID ||
                    shipment?.id;
            }

            const isCanparShipment = getBestRateInfo?.carrier?.toLowerCase().includes('canpar') ||
                carrierData?.name?.toLowerCase().includes('canpar') ||
                carrierData?.carrierID === 'CANPAR';
            if (isCanparShipment) {
                return shipment?.trackingNumber ||
                    shipment?.carrierBookingConfirmation?.trackingNumber ||
                    shipment?.selectedRate?.TrackingNumber ||
                    shipment?.selectedRate?.Barcode ||
                    shipment?.id;
            } else {
                return shipment?.carrierBookingConfirmation?.proNumber ||
                    shipment?.carrierBookingConfirmation?.confirmationNumber ||
                    shipment?.trackingNumber ||
                    shipment?.id;
            }
        })();

        if (trackingNum && trackingNum !== 'N/A') {
            navigator.clipboard.writeText(trackingNum);
            onShowSnackbar('Tracking number copied!', 'success');
        } else {
            onShowSnackbar('No tracking number to copy.', 'warning');
        }
    };

    const getTrackingNumber = () => {
        // For QuickShip, use the carrier tracking number entered in the form first
        if (shipment?.creationMethod === 'quickship') {
            return shipment?.shipmentInfo?.carrierTrackingNumber ||
                shipment?.trackingNumber ||
                shipment?.shipmentID ||
                shipment?.id ||
                'N/A';
        }

        const isCanparShipment = getBestRateInfo?.carrier?.toLowerCase().includes('canpar') ||
            carrierData?.name?.toLowerCase().includes('canpar') ||
            carrierData?.carrierID === 'CANPAR';

        if (isCanparShipment) {
            return shipment?.trackingNumber ||
                shipment?.carrierBookingConfirmation?.trackingNumber ||
                shipment?.selectedRate?.TrackingNumber ||
                shipment?.selectedRate?.Barcode ||
                shipment?.id ||
                'N/A';
        } else {
            return shipment?.carrierBookingConfirmation?.proNumber ||
                shipment?.carrierBookingConfirmation?.confirmationNumber ||
                shipment?.trackingNumber ||
                shipment?.id ||
                'N/A';
        }
    };

    // Function to convert 24-hour time to AM/PM format
    const formatTimeToAMPM = (time24) => {
        if (!time24) return 'N/A';

        // Handle different input formats
        let timeStr = time24.toString().trim();

        // If already in AM/PM format, return as-is
        if (/AM|PM/i.test(timeStr)) {
            return timeStr;
        }

        // Extract hours and minutes from various formats
        let hours, minutes;

        if (timeStr.includes(':')) {
            // Format like "08:00", "8:30", "08:00:00"
            const parts = timeStr.split(':');
            hours = parseInt(parts[0], 10);
            minutes = parts[1] ? parts[1].padStart(2, '0') : '00';
        } else if (timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
            // Format like "0800", "1430"
            hours = parseInt(timeStr.substring(0, 2), 10);
            minutes = timeStr.substring(2, 4);
        } else if (timeStr.length <= 2 && /^\d+$/.test(timeStr)) {
            // Format like "8", "14"
            hours = parseInt(timeStr, 10);
            minutes = '00';
        } else {
            // Invalid format, return original
            console.log('formatTimeToAMPM: Unable to parse time format:', timeStr);
            return timeStr;
        }

        // Validate hours and minutes
        if (isNaN(hours) || hours < 0 || hours > 23) {
            console.log('formatTimeToAMPM: Invalid hours:', hours, 'from input:', timeStr);
            return timeStr;
        }

        if (isNaN(parseInt(minutes)) || parseInt(minutes) < 0 || parseInt(minutes) > 59) {
            console.log('formatTimeToAMPM: Invalid minutes:', minutes, 'from input:', timeStr);
            minutes = '00';
        }

        // Convert to 12-hour format
        if (hours === 0) {
            return `12:${minutes} AM`;
        } else if (hours < 12) {
            return `${hours}:${minutes} AM`;
        } else if (hours === 12) {
            return `12:${minutes} PM`;
        } else {
            return `${hours - 12}:${minutes} PM`;
        }
    };

    // Add time extraction helpers
    function formatTime(timeString) {
        if (!timeString || timeString.toString().trim() === '') {
            return '';
        }

        // If already in AM/PM format, return as-is
        if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(timeString)) {
            return timeString;
        }

        // If in 24-hour format, convert to AM/PM
        if (/^\d{1,2}:\d{2}$/.test(timeString)) {
            return formatTimeToAMPM(timeString);
        }

        // Handle various datetime formats
        try {
            // Try parsing as different formats
            let parsedTime = null;

            // Handle Firestore Timestamp
            if (timeString && typeof timeString.toDate === 'function') {
                parsedTime = timeString.toDate();
            }
            // Handle timestamp objects with seconds/nanoseconds
            else if (timeString && typeof timeString === 'object' && (timeString.seconds || timeString.nanoseconds)) {
                parsedTime = new Date(timeString.seconds * 1000 + (timeString.nanoseconds || 0) / 1000000);
            }
            // Handle Unix timestamp (milliseconds)
            else if (typeof timeString === 'number' && timeString > 1000000000000) {
                parsedTime = new Date(timeString);
            }
            // Handle Unix timestamp (seconds)
            else if (typeof timeString === 'number' && timeString > 1000000000) {
                parsedTime = new Date(timeString * 1000);
            }
            // Handle date strings
            else if (typeof timeString === 'string') {
                // If in HHMM format, convert to HH:MM then AM/PM
                if (/^\d{4}$/.test(timeString)) {
                    const formatted = `${timeString.substring(0, 2)}:${timeString.substring(2, 4)}`;
                    return formatTimeToAMPM(formatted);
                }

                // Try parsing as date string and extract time
                const date = new Date(timeString);
                if (!isNaN(date.getTime())) {
                    parsedTime = date;
                }
            }

            // Extract time from Date object
            if (parsedTime && !isNaN(parsedTime.getTime())) {
                const hours = parsedTime.getHours();
                const minutes = parsedTime.getMinutes();
                const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                return formatTimeToAMPM(timeStr);
            }
        } catch (error) {
            // Fallback to original string
        }

        return timeString;
    }

    function extractOpenTime(address) {
        if (!address) return '';

        // Check all possible sources for open time
        let openTime = null;

        // Check businessHours structure
        if (address?.businessHours) {
            if (address.businessHours.useCustomHours) {
                const mondayHours = address.businessHours.customHours?.monday;
                if (mondayHours && !mondayHours.closed && mondayHours.open) {
                    openTime = mondayHours.open;
                }
            } else if (address.businessHours.defaultHours?.open) {
                openTime = address.businessHours.defaultHours.open;
            }
        }

        // Check direct fields
        if (!openTime && (address?.openTime || address?.openHours)) {
            openTime = address.openTime || address.openHours;
        }

        // Check various field names
        const timeFields = ['Opening Time', 'openingTime', 'open_time', 'startTime', 'start_time', 'businessOpen'];
        for (const field of timeFields) {
            if (!openTime && address?.[field]) {
                openTime = address[field];
                break;
            }
        }

        // If no time found, return empty string instead of N/A
        if (!openTime) return '';

        return formatTime(openTime);
    }

    function extractCloseTime(address) {
        if (!address) return '';

        // Check all possible sources for close time
        let closeTime = null;

        // Check businessHours structure
        if (address?.businessHours) {
            if (address.businessHours.useCustomHours) {
                const mondayHours = address.businessHours.customHours?.monday;
                if (mondayHours && !mondayHours.closed && mondayHours.close) {
                    closeTime = mondayHours.close;
                }
            } else if (address.businessHours.defaultHours?.close) {
                closeTime = address.businessHours.defaultHours.close;
            }
        }

        // Check direct fields
        if (!closeTime && (address?.closeTime || address?.closeHours)) {
            closeTime = address.closeTime || address.closeHours;
        }

        // Check various field names
        const timeFields = ['Closing Time', 'closingTime', 'close_time', 'endTime', 'end_time', 'businessClose'];
        for (const field of timeFields) {
            if (!closeTime && address?.[field]) {
                closeTime = address[field];
                break;
            }
        }

        // If no time found, return empty string instead of N/A
        if (!closeTime) return '';

        return formatTime(closeTime);
    }

    // Helper function to format shipment date without timezone issues
    const formatShipmentDate = (dateString) => {
        if (!dateString) return 'Not Set';

        try {
            // Handle different date formats
            let date;

            if (typeof dateString === 'string') {
                // If it's a date string like "2024-01-15", parse it as local date
                if (dateString.includes('T') || dateString.includes(' ')) {
                    // Full datetime string
                    date = new Date(dateString);
                } else {
                    // Date-only string (YYYY-MM-DD) - parse as local date to avoid timezone shift
                    const parts = dateString.split('-');
                    if (parts.length === 3) {
                        const [year, month, day] = parts;
                        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                    } else {
                        date = new Date(dateString);
                    }
                }
            } else if (dateString.toDate && typeof dateString.toDate === 'function') {
                // Firestore timestamp
                date = dateString.toDate();
            } else if (dateString.seconds !== undefined) {
                // Timestamp object with seconds
                const milliseconds = dateString.seconds * 1000 + (dateString.nanoseconds || 0) / 1000000;
                date = new Date(milliseconds);
            } else if (dateString._seconds !== undefined) {
                // Timestamp object with _seconds
                const milliseconds = dateString._seconds * 1000 + (dateString._nanoseconds || 0) / 1000000;
                date = new Date(milliseconds);
            } else {
                // Already a Date object or other format
                date = new Date(dateString);
            }

            // Verify the date is valid
            if (isNaN(date.getTime())) {
                console.warn('Invalid shipment date format:', dateString);
                return 'Invalid Date';
            }

            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                timeZone: 'America/Toronto' // Force Eastern Time
            });
        } catch (error) {
            console.error('Error formatting shipment date:', error, dateString);
            return 'Format Error';
        }
    };

    return (
        <Grid item xs={12}>
            <Grid container spacing={3}>
                {/* Basic Information */}
                <Grid item xs={12} md={3}>
                    <Box sx={{
                        p: 2,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        height: '100%'
                    }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                            Basic Information
                        </Typography>
                        <Stack spacing={2}>
                            {/* Company Information */}
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Company</Typography>
                                {loadingCompanyData ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                        <CircularProgress size={16} />
                                        <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                                            Loading...
                                        </Typography>
                                    </Box>
                                ) : companyData ? (
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            cursor: 'pointer',
                                            p: 0.5,
                                            borderRadius: 1,
                                            mt: 0.5,
                                            '&:hover': {
                                                backgroundColor: 'action.hover'
                                            }
                                        }}
                                        onClick={handleNavigateToCompany}
                                    >
                                        <Avatar
                                            src={getCircleLogo(companyData)}
                                            sx={{
                                                width: 24,
                                                height: 24,
                                                bgcolor: '#ffffff',
                                                border: '1px solid #e5e7eb'
                                            }}
                                        >
                                            <BusinessIcon sx={{ fontSize: 12 }} />
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                color: 'text.primary',
                                                lineHeight: 1.2,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {companyData.companyName || companyData.name || 'Unknown Company'}
                                            </Typography>
                                            <Typography sx={{
                                                fontSize: '10px',
                                                color: 'text.secondary',
                                                lineHeight: 1.2
                                            }}>
                                                ID: {shipment?.companyID || shipment?.companyId}
                                            </Typography>
                                        </Box>
                                        <OpenInNewIcon sx={{
                                            fontSize: 12,
                                            color: 'text.secondary',
                                            opacity: 0.7
                                        }} />
                                    </Box>
                                ) : (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                        <Avatar sx={{
                                            width: 24,
                                            height: 24,
                                            bgcolor: 'grey.400'
                                        }}>
                                            <BusinessIcon sx={{ fontSize: 12 }} />
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{
                                                fontSize: '12px',
                                                color: 'text.secondary'
                                            }}>
                                                Company not found
                                            </Typography>
                                            <Typography sx={{
                                                fontSize: '10px',
                                                color: 'text.secondary'
                                            }}>
                                                ID: {shipment?.companyID || shipment?.companyId || 'N/A'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Box>

                            {/* Customer Information */}
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Customer</Typography>
                                {loadingCustomerData ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                        <CircularProgress size={16} />
                                        <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                                            Loading...
                                        </Typography>
                                    </Box>
                                ) : customerData ? (
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            cursor: (customerData.id !== 'ship-to-data' && (user?.role === 'admin' || user?.role === 'superadmin')) ? 'pointer' : 'default',
                                            p: 0.5,
                                            borderRadius: 1,
                                            mt: 0.5,
                                            '&:hover': (customerData.id !== 'ship-to-data' && (user?.role === 'admin' || user?.role === 'superadmin')) ? {
                                                backgroundColor: 'action.hover'
                                            } : {}
                                        }}
                                        onClick={(customerData.id !== 'ship-to-data' && (user?.role === 'admin' || user?.role === 'superadmin')) ? handleNavigateToCustomer : undefined}
                                    >
                                        <Avatar
                                            src={customerData.logo || customerData.logoUrl || customerData.logoURL}
                                            sx={{
                                                width: 24,
                                                height: 24,
                                                bgcolor: 'success.main'
                                            }}
                                            onError={(e) => {
                                                console.log('🖼️ Customer logo failed to load:', {
                                                    src: e.target.src,
                                                    customerData: {
                                                        logo: customerData.logo,
                                                        logoUrl: customerData.logoUrl,
                                                        logoURL: customerData.logoURL
                                                    }
                                                });
                                                e.target.style.display = 'none';
                                            }}
                                        >
                                            <PersonIcon sx={{ fontSize: 12 }} />
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                color: 'text.primary',
                                                lineHeight: 1.2,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {customerData.companyName || customerData.name || 'Unknown Customer'}
                                            </Typography>

                                        </Box>
                                        {(customerData.id !== 'ship-to-data' && (user?.role === 'admin' || user?.role === 'superadmin')) && (
                                            <OpenInNewIcon sx={{
                                                fontSize: 12,
                                                color: 'text.secondary',
                                                opacity: 0.7
                                            }} />
                                        )}
                                    </Box>
                                ) : (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                        <Avatar sx={{
                                            width: 24,
                                            height: 24,
                                            bgcolor: 'grey.400'
                                        }}>
                                            <PersonIcon sx={{ fontSize: 12 }} />
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{
                                                fontSize: '12px',
                                                color: 'text.secondary'
                                            }}>
                                                Customer not available
                                            </Typography>
                                            {/* REMOVED: Never show ship-to company as customer fallback */}
                                        </Box>
                                    </Box>
                                )}
                            </Box>

                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Shipment Type</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>{capitalizeShipmentType(shipment?.shipmentInfo?.shipmentType || 'N/A')}</Typography>
                            </Box>

                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Bill Type</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {formatBillType(shipment?.shipmentInfo?.shipmentBillType || shipment?.shipmentInfo?.billType)}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Invoice Status</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {(() => {
                                        const statusCode = shipment?.invoiceStatus || 'uninvoiced';
                                        const dynamicStatus = invoiceStatuses.find(s => s.statusCode === statusCode);

                                        if (dynamicStatus) {
                                            return (
                                                <Chip
                                                    label={dynamicStatus.statusLabel}
                                                    size="small"
                                                    sx={{
                                                        fontSize: '11px',
                                                        height: '22px',
                                                        fontWeight: 500,
                                                        color: dynamicStatus.fontColor || '#ffffff',
                                                        backgroundColor: dynamicStatus.color || '#6b7280',
                                                        border: '1px solid rgba(0,0,0,0.1)'
                                                    }}
                                                />
                                            );
                                        }

                                        // Fallback for unknown status
                                        return (
                                            <Chip
                                                label={statusCode}
                                                size="small"
                                                sx={{
                                                    fontSize: '11px',
                                                    height: '22px',
                                                    fontWeight: 500,
                                                    color: '#ffffff',
                                                    backgroundColor: '#6b7280',
                                                    border: '1px solid rgba(0,0,0,0.1)'
                                                }}
                                            />
                                        );
                                    })()}
                                    {isAdmin && (
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleStartEditInvoiceStatus(shipment?.invoiceStatus || 'uninvoiced', e)}
                                            sx={{ padding: '2px' }}
                                            title="Edit invoice status"
                                        >
                                            <ArrowDownIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                        </IconButton>
                                    )}
                                </Box>
                            </Box>
                        </Stack>
                    </Box>
                </Grid>

                {/* Timing Information */}
                <Grid item xs={12} md={3}>
                    <Box sx={{
                        p: 2,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        height: '100%'
                    }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                            Timing Information
                        </Typography>
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Created At</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {formatTimestamp(shipment?.createdAt)}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Shipment Date</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {formatShipmentDate(shipment?.shipmentInfo?.shipmentDate)}
                                </Typography>
                            </Box>
                            {/* Hide Estimated Delivery for QuickShip */}
                            {shipment?.creationMethod !== 'quickship' && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Estimated Delivery</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <AccessTimeIcon sx={{ color: 'text.secondary', fontSize: '0.9rem' }} />
                                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12px' }}>
                                            {(() => {
                                                const deliveryDate =
                                                    shipment?.carrierBookingConfirmation?.estimatedDeliveryDate ||
                                                    getBestRateInfo?.transit?.estimatedDelivery ||
                                                    getBestRateInfo?.estimatedDeliveryDate;

                                                if (deliveryDate) {
                                                    try {
                                                        const date = deliveryDate.toDate ? deliveryDate.toDate() : new Date(deliveryDate);
                                                        return date.toLocaleDateString('en-US', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                            timeZone: 'America/Toronto' // Force Eastern Time
                                                        });
                                                    } catch (error) {
                                                        return 'Invalid Date';
                                                    }
                                                }
                                                return 'N/A';
                                            })()}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Origin Operating Hours</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {(() => {
                                        const openTime = extractOpenTime(shipment?.shipFrom);
                                        const closeTime = extractCloseTime(shipment?.shipFrom);
                                        if (!openTime && !closeTime) return 'Not Available';
                                        if (!openTime || !closeTime) return 'Incomplete Hours';
                                        return `${openTime} - ${closeTime}`;
                                    })()}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Destination Operating Hours</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {(() => {
                                        const openTime = extractOpenTime(shipment?.shipTo);
                                        const closeTime = extractCloseTime(shipment?.shipTo);
                                        if (!openTime && !closeTime) return 'Not Available';
                                        if (!openTime || !closeTime) return 'Incomplete Hours';
                                        return `${openTime} - ${closeTime}`;
                                    })()}
                                </Typography>
                            </Box>

                            {/* ETA Fields */}
                            {(shipment?.shipmentInfo?.eta1 || shipment?.shipmentInfo?.eta2) && (
                                <>
                                    {shipment?.shipmentInfo?.eta1 && (
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>ETA 1</Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                {(() => {
                                                    try {
                                                        let date;

                                                        // Handle Firestore Timestamp
                                                        if (shipment.shipmentInfo.eta1?.toDate) {
                                                            date = shipment.shipmentInfo.eta1.toDate();
                                                        }
                                                        // Handle date-only strings (YYYY-MM-DD) to avoid timezone issues
                                                        else if (typeof shipment.shipmentInfo.eta1 === 'string' &&
                                                            shipment.shipmentInfo.eta1.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                                            const parts = shipment.shipmentInfo.eta1.split('-');
                                                            date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                                        }
                                                        // Handle other date formats
                                                        else {
                                                            date = new Date(shipment.shipmentInfo.eta1);
                                                        }

                                                        return date.toLocaleDateString('en-US', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                            timeZone: 'America/Toronto' // Force Eastern Time
                                                        });
                                                    } catch (error) {
                                                        return 'Invalid Date';
                                                    }
                                                })()}
                                            </Typography>
                                        </Box>
                                    )}
                                    {shipment?.shipmentInfo?.eta2 && (
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>ETA 2</Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                {(() => {
                                                    try {
                                                        let date;

                                                        // Handle Firestore Timestamp
                                                        if (shipment.shipmentInfo.eta2?.toDate) {
                                                            date = shipment.shipmentInfo.eta2.toDate();
                                                        }
                                                        // Handle date-only strings (YYYY-MM-DD) to avoid timezone issues
                                                        else if (typeof shipment.shipmentInfo.eta2 === 'string' &&
                                                            shipment.shipmentInfo.eta2.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                                            const parts = shipment.shipmentInfo.eta2.split('-');
                                                            date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                                        }
                                                        // Handle other date formats
                                                        else {
                                                            date = new Date(shipment.shipmentInfo.eta2);
                                                        }

                                                        return date.toLocaleDateString('en-US', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                            timeZone: 'America/Toronto' // Force Eastern Time
                                                        });
                                                    } catch (error) {
                                                        return 'Invalid Date';
                                                    }
                                                })()}
                                            </Typography>
                                        </Box>
                                    )}
                                </>
                            )}
                        </Stack>
                    </Box>
                </Grid>



                {/* Tracking Information */}
                <Grid item xs={12} md={3}>
                    <Box sx={{
                        p: 2,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        height: '100%'
                    }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                            Tracking & Status
                        </Typography>
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Current Status</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexGrow: 1 }}>
                                        {/* Manual Override Indicator - Small Bold M (same as ShipmentTableRow) */}
                                        {shipment?.statusOverride?.isManual && (
                                            <Tooltip title="Status manually overridden">
                                                <Box sx={{
                                                    width: '16px',
                                                    height: '16px',
                                                    backgroundColor: '#e5e7eb',
                                                    color: '#374151',
                                                    borderRadius: '3px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '10px',
                                                    fontWeight: 'bold',
                                                    flexShrink: 0
                                                }}>
                                                    M
                                                </Box>
                                            </Tooltip>
                                        )}
                                        {/* Manual Status Override - Component handles its own permission checking */}
                                        <ManualStatusOverride
                                            shipment={shipment}
                                            onStatusUpdated={onStatusUpdated}
                                            onShowSnackbar={onShowSnackbar}
                                            disabled={shipment?.status === 'draft'}
                                        />
                                    </Box>
                                    <IconButton
                                        size="small"
                                        onClick={onRefreshStatus}
                                        disabled={smartUpdateLoading || actionStates.refreshStatus.loading || shipment?.status === 'draft'}
                                        sx={{
                                            padding: '4px',
                                            '&:hover': { bgcolor: 'action.hover' }
                                        }}
                                        title="Refresh status from carrier"
                                    >
                                        {smartUpdateLoading || actionStates.refreshStatus.loading ?
                                            <CircularProgress size={14} /> :
                                            <RefreshIcon sx={{ fontSize: 16 }} />
                                        }
                                    </IconButton>
                                </Box>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Carrier</Typography>
                                <CarrierDisplay
                                    carrierName={shipment?.creationMethod === 'quickship' ?
                                        (shipment?.selectedCarrier || shipment?.carrier) :
                                        getBestRateInfo?.carrier
                                    }
                                    carrierData={carrierData}
                                    size="small"
                                    isIntegrationCarrier={shipment?.creationMethod !== 'quickship' && (getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' || getBestRateInfo?.sourceCarrierName === 'eShipPlus')}
                                />
                            </Box>
                            {/* Hide Service for QuickShip */}
                            {shipment?.creationMethod !== 'quickship' && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Service</Typography>
                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                        {getBestRateInfo?.service || 'N/A'}
                                    </Typography>
                                </Box>
                            )}
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Tracking Number</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {onOpenTrackingDrawer ? (
                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            cursor: 'pointer',
                                            '&:hover .tracking-text': { textDecoration: 'underline' }
                                        }}>
                                            <AssignmentIcon sx={{ color: 'primary.main', fontSize: '0.9rem' }} />
                                            <Typography
                                                className="tracking-text"
                                                variant="body2"
                                                onClick={() => onOpenTrackingDrawer(getTrackingNumber())}
                                                sx={{
                                                    fontWeight: 500,
                                                    color: 'primary.main',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                                title="Click to open tracking details"
                                            >
                                                {getTrackingNumber()}
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5
                                        }}>
                                            <AssignmentIcon sx={{ color: 'primary.main', fontSize: '0.9rem' }} />
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontWeight: 500,
                                                    color: 'primary.main',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                {getTrackingNumber()}
                                            </Typography>
                                        </Box>
                                    )}
                                    <IconButton
                                        size="small"
                                        onClick={handleCopyTracking}
                                        sx={{ padding: '2px' }}
                                        title="Copy tracking number"
                                    >
                                        <ContentCopyIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                    </IconButton>
                                </Box>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Reference Numbers</Typography>
                                {/* Primary reference */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                        {shipment?.shipmentInfo?.shipperReferenceNumber || shipment?.shipmentID || 'N/A'}
                                    </Typography>
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            const referenceNumber = shipment?.shipmentInfo?.shipperReferenceNumber || shipment?.shipmentID || 'N/A';
                                            if (referenceNumber && referenceNumber !== 'N/A') {
                                                navigator.clipboard.writeText(referenceNumber);
                                                onShowSnackbar('Reference number copied!', 'success');
                                            } else {
                                                onShowSnackbar('No reference number to copy.', 'warning');
                                            }
                                        }}
                                        sx={{ padding: '2px' }}
                                        title="Copy reference number"
                                    >
                                        <ContentCopyIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                    </IconButton>
                                </Box>
                                {/* Additional references */}
                                {shipment?.shipmentInfo?.referenceNumbers && shipment.shipmentInfo.referenceNumbers.length > 0 && (
                                    <>
                                        {shipment.shipmentInfo.referenceNumbers.map((ref, index) => (
                                            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                    {ref}
                                                </Typography>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        if (ref) {
                                                            navigator.clipboard.writeText(ref);
                                                            onShowSnackbar('Reference number copied!', 'success');
                                                        }
                                                    }}
                                                    sx={{ padding: '2px' }}
                                                    title="Copy reference number"
                                                >
                                                    <ContentCopyIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                                </IconButton>
                                            </Box>
                                        ))}
                                    </>
                                )}
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Last Updated</Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {(() => {
                                        const lastUpdated = getLastUpdatedTimestamp(shipment, mergedEvents);
                                        if (!lastUpdated) {
                                            // If no update timestamp, try to use creation timestamp
                                            if (shipment?.createdAt) {
                                                return formatTimestamp(shipment.createdAt);
                                            }
                                            return 'No Updates';
                                        }
                                        return formatTimestamp(lastUpdated);
                                    })()}
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>
                </Grid>

                {/* Ship From/Ship To Information */}
                <Grid item xs={12} md={3}>
                    <Box sx={{
                        p: 2,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        height: '100%'
                    }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                            Locations
                        </Typography>
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Ship From</Typography>
                                <Box
                                    sx={{
                                        mb: 1,
                                        cursor: 'pointer',
                                        '&:hover': {
                                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                            borderRadius: 1
                                        },
                                        p: 0.5,
                                        borderRadius: 1
                                    }}
                                    onClick={() => handleOpenMap('shipFrom')}
                                >
                                    {(() => {
                                        const address = shipment?.shipFrom;
                                        if (!address) return <Typography variant="body2" sx={{ fontSize: '12px' }}>N/A</Typography>;
                                        const addressLines = [];
                                        const companyName = address.company || address.companyName || address.businessName || shipment?.shipmentInfo?.originCompany || shipment?.companyName;
                                        if (companyName) addressLines.push(companyName);
                                        if (address.street) addressLines.push(address.street);
                                        if (address.street2) addressLines.push(address.street2);
                                        if (address.city && address.state) addressLines.push(`${address.city}, ${address.state}`);
                                        if (address.postalCode && address.country) addressLines.push(`${address.postalCode.toUpperCase()} ${address.country}`);
                                        return <>
                                            {addressLines.map((line, index) => (
                                                <Typography key={index} variant="body2" sx={{ fontSize: '12px', lineHeight: 1.3, color: 'primary.main' }}>{line}</Typography>
                                            ))}
                                            {address.email && (
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: 'text.secondary' }}>{address.email}</Typography>
                                            )}
                                            {address.phone && (
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: 'text.secondary' }}>{address.phone}</Typography>
                                            )}
                                        </>;
                                    })()}
                                </Box>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>Ship To</Typography>
                                <Box
                                    sx={{
                                        mb: 1,
                                        cursor: 'pointer',
                                        '&:hover': {
                                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                            borderRadius: 1
                                        },
                                        p: 0.5,
                                        borderRadius: 1
                                    }}
                                    onClick={() => handleOpenMap('shipTo')}
                                >
                                    {(() => {
                                        const address = shipment?.shipTo;
                                        if (!address) return <Typography variant="body2" sx={{ fontSize: '12px' }}>N/A</Typography>;
                                        const addressLines = [];
                                        const companyName = address.company || address.companyName || address.businessName || shipment?.shipmentInfo?.destinationCompany || shipment?.customerCompany || address.customerName;
                                        if (companyName) addressLines.push(companyName);
                                        if (address.street) addressLines.push(address.street);
                                        if (address.street2) addressLines.push(address.street2);
                                        if (address.city && address.state) addressLines.push(`${address.city}, ${address.state}`);
                                        if (address.postalCode && address.country) addressLines.push(`${address.postalCode.toUpperCase()} ${address.country}`);
                                        return <>
                                            {addressLines.map((line, index) => (
                                                <Typography key={index} variant="body2" sx={{ fontSize: '12px', lineHeight: 1.3, color: 'primary.main' }}>{line}</Typography>
                                            ))}
                                            {address.email && (
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: 'text.secondary' }}>{address.email}</Typography>
                                            )}
                                            {address.phone && (
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: 'text.secondary' }}>{address.phone}</Typography>
                                            )}
                                        </>;
                                    })()}
                                </Box>
                            </Box>
                            <Box>
                                <Button
                                    size="small"
                                    startIcon={<RouteIcon />}
                                    variant="contained"
                                    color="primary"
                                    fullWidth
                                    onClick={() => handleOpenMap('route')}
                                    sx={{ fontSize: '0.75rem', height: '28px' }}
                                >
                                    View Route
                                </Button>
                            </Box>
                        </Stack>
                    </Box>
                </Grid>

                {/* Broker Information - Full width table format - Only show if broker data exists */}
                {(shipment?.selectedBroker || shipment?.brokerDetails) && (
                    <Grid item xs={12}>
                        <Paper sx={{ mb: 2 }}>
                            <Box sx={{ p: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151', mb: 2 }}>
                                    Broker Information
                                </Typography>
                                <TableContainer>
                                    <Table size="small" sx={{ border: '1px solid #e0e0e0' }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', width: '200px' }}>
                                                    Broker Name
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', width: '150px' }}>
                                                    Phone
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', width: '200px' }}>
                                                    Email
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', width: '120px' }}>
                                                    Port
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>
                                                    Reference
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            <TableRow sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'middle' }}>
                                                    {shipment?.brokerDetails?.name || shipment?.selectedBroker || 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'middle' }}>
                                                    {shipment?.brokerDetails?.phone || 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'middle' }}>
                                                    {shipment?.brokerDetails?.email || 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'middle' }}>
                                                    {shipment?.brokerPort || 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'middle' }}>
                                                    {shipment?.brokerReference ? (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                                {shipment.brokerReference}
                                                            </Typography>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(shipment.brokerReference);
                                                                    onShowSnackbar('Broker reference copied!', 'success');
                                                                }}
                                                                sx={{ padding: '2px' }}
                                                                title="Copy broker reference"
                                                            >
                                                                <ContentCopyIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                                            </IconButton>
                                                        </Box>
                                                    ) : 'N/A'}
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        </Paper>
                    </Grid>
                )}
            </Grid>

            {/* Map Dialog */}
            <Dialog
                open={!!openMap}
                onClose={handleCloseMap}
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
                        <LocationOnIcon color="primary" />
                        <Typography variant="h6">
                            {openMap === 'route'
                                ? `Route: ${(() => {
                                    const fromAddress = getAddress(shipment, 'shipFrom');
                                    const toAddress = getAddress(shipment, 'shipTo');
                                    const fromCity = fromAddress?.city || 'Unknown';
                                    const fromState = fromAddress?.state || '';
                                    const toCity = toAddress?.city || 'Unknown';
                                    const toState = toAddress?.state || '';

                                    const fromLocation = fromState ? `${fromCity}, ${fromState}` : fromCity;
                                    const toLocation = toState ? `${toCity}, ${toState}` : toCity;

                                    return `${fromLocation} → ${toLocation}`;
                                })()}`
                                : openMap === 'shipFrom'
                                    ? `Origin: ${formatAddress(getAddress(shipment, openMap)) || 'N/A'}`
                                    : `Destination: ${formatAddress(getAddress(shipment, openMap)) || 'N/A'}`
                            }
                        </Typography>
                    </Box>
                    <IconButton onClick={handleCloseMap}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0, height: '100%' }}>
                    {renderMap()}
                </DialogContent>
            </Dialog>

            {/* Invoice Status Popover */}
            <Popover
                open={Boolean(statusPopoverAnchor)}
                anchorEl={statusPopoverAnchor}
                onClose={handleClosePopover}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                PaperProps={{
                    sx: {
                        p: 2,
                        minWidth: 320,
                        maxWidth: 400,
                        border: '1px solid #e5e7eb',
                        borderRadius: 2,
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                    }
                }}
            >
                <Box>
                    {/* Current status header */}
                    <Box sx={{ mb: 2 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                            Current Status
                        </Typography>
                        {(() => {
                            const currentStatus = invoiceStatuses.find(s => s.statusCode === editingStatusValue);
                            if (currentStatus) {
                                return (
                                    <Chip
                                        label={currentStatus.statusLabel}
                                        size="small"
                                        sx={{
                                            fontSize: '11px',
                                            height: '22px',
                                            fontWeight: 500,
                                            color: currentStatus.fontColor || '#ffffff',
                                            backgroundColor: currentStatus.color || '#6b7280',
                                            border: '1px solid rgba(0,0,0,0.1)'
                                        }}
                                    />
                                );
                            }
                            return <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Unknown Status</Typography>;
                        })()}
                    </Box>

                    {/* Available status options */}
                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                        Select Status
                    </Typography>
                    <Box sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        p: 2,
                        border: '1px solid #e5e7eb',
                        borderRadius: 1,
                        backgroundColor: '#f9fafb'
                    }}>
                        {invoiceStatuses.filter(status => status.enabled).map((status) => (
                            <Chip
                                key={status.statusCode}
                                label={status.statusLabel}
                                size="small"
                                onClick={async () => {
                                    // Only save if it's a different status
                                    if (status.statusCode !== editingStatusValue) {
                                        setEditingStatusValue(status.statusCode);
                                        await handleSaveInvoiceStatus(status.statusCode);
                                    }
                                }}
                                disabled={savingInvoiceStatus}
                                sx={{
                                    fontSize: '11px',
                                    height: '24px',
                                    fontWeight: 500,
                                    color: status.fontColor || '#ffffff',
                                    backgroundColor: status.color || '#6b7280',
                                    border: '1px solid rgba(0,0,0,0.1)',
                                    cursor: savingInvoiceStatus ? 'not-allowed' : 'pointer',
                                    opacity: editingStatusValue === status.statusCode ? 1 : (savingInvoiceStatus ? 0.5 : 0.8),
                                    transform: editingStatusValue === status.statusCode ? 'scale(1.05)' : 'scale(1)',
                                    '&:hover': {
                                        opacity: savingInvoiceStatus ? 0.5 : 1,
                                        transform: savingInvoiceStatus ? 'scale(1)' : 'scale(1.05)',
                                        transition: 'all 0.2s'
                                    }
                                }}
                            />
                        ))}
                    </Box>

                    {/* Loading indicator when saving */}
                    {savingInvoiceStatus && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 1 }}>
                            <CircularProgress size={16} />
                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                Saving...
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Popover>

        </Grid >
    );
};

export default ShipmentInformation; 