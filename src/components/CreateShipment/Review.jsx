import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';
import {
    Box,
    Typography,
    Paper,
    IconButton,
    Collapse,
    Divider,
    Chip,
    Tooltip,
    useTheme,
    CircularProgress,
    Grid,
    Container,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    LocationOn as LocationIcon,
    LocalShipping as ShippingIcon,
    Inventory as BoxIcon,
    AttachMoney as MoneyIcon,
    AccessTime as TimeIcon,
    Business as BusinessIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    Map as MapIcon,
    CheckCircle as CheckCircleIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase';
import { getMapsApiKey } from '../../utils/maps';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import { useNavigate } from 'react-router-dom';
import { getRateDetailsByDocumentId, formatRateReference } from '../../utils/rateUtils';

// Define libraries array as a static constant outside the component
const GOOGLE_MAPS_LIBRARIES = ["places", "geometry"];

// Function to save rate to Firebase
const saveRateToShipmentRates = async (rate, shipmentId, status = 'selected') => {
    try {
        const rateData = {
            shipmentId,
            rateId: rate.id,
            carrier: rate.carrier,
            service: rate.service,
            carrierCode: rate.carrierScac || rate.carrierCode || '',
            serviceCode: rate.serviceCode || '',
            totalCharges: rate.totalCharges || rate.price,
            freightCharge: rate.freightCharge || rate.originalRate?.freightCharges || 0,
            fuelCharge: rate.fuelCharge || rate.originalRate?.fuelCharges || 0,
            serviceCharges: rate.serviceCharges || rate.originalRate?.serviceCharges || 0,
            accessorialCharges: rate.accessorialCharges || rate.originalRate?.accessorialCharges || 0,
            guaranteeCharge: rate.guaranteeCharge || 0,
            currency: rate.currency || 'USD',
            transitDays: rate.transitDays,
            transitTime: rate.transitTime,
            estimatedDeliveryDate: rate.estimatedDeliveryDate,
            guaranteed: rate.guaranteed || false,
            guaranteedOptionAvailable: rate.guaranteedOptionAvailable || false,
            guaranteedPrice: rate.guaranteedPrice || null,
            packageCounts: rate.packageCounts || {},
            originalRate: rate.originalRate || rate,
            status: status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...(status === 'booked' && rate.carrierBookingData && {
                confirmationNumber: rate.confirmationNumber || rate.carrierBookingData.confirmationNumber,
                carrierBookingData: rate.carrierBookingData
            })
        };

        Object.keys(rateData).forEach(key => {
            if (rateData[key] === undefined) {
                delete rateData[key];
            }
        });

        const shipmentRatesRef = collection(db, 'shipmentRates');
        const rateDocRef = await addDoc(shipmentRatesRef, rateData);
        console.log(`Rate saved to shipmentRates collection with status '${status}' and ID:`, rateDocRef.id);
        return rateDocRef.id;
    } catch (error) {
        console.error('Error saving rate to shipmentRates:', error);
        throw error;
    }
};

const SimpleMap = React.memo(({ address, title }) => {
    const [position, setPosition] = useState(null);
    const [error, setError] = useState(null);
    const mapRef = useRef(null);

    useEffect(() => {
        // Enhanced safety check - wait for the parent component to confirm Maps is ready
        const checkAndGeocode = () => {
            if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
                setError('Google Maps not loaded');
                return;
            }

            if (!address) {
                setError('Address information is missing');
                return;
            }

            const geocoder = new window.google.maps.Geocoder();
            const addressString = `${address.street || ''}${address.street2 ? ', ' + address.street2 : ''}, ${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}, ${address.country || ''}`;

            geocoder.geocode({ address: addressString }, (results, status) => {
                if (status === 'OK') {
                    const location = results[0].geometry.location;
                    setPosition({
                        lat: location.lat(),
                        lng: location.lng()
                    });

                    // Fit bounds with padding
                    if (mapRef.current) {
                        const bounds = new window.google.maps.LatLngBounds();
                        bounds.extend(location);
                        mapRef.current.fitBounds(bounds, {
                            padding: { top: 50, right: 50, bottom: 50, left: 50 }
                        });
                    }
                } else {
                    console.error('Geocoding failed:', status);
                    setError('Failed to geocode address');
                }
            });
        };

        // Add a longer delay to ensure the API is ready
        const timeoutId = setTimeout(checkAndGeocode, 1000);
        return () => clearTimeout(timeoutId);
    }, [address]);

    const handleMapLoad = React.useCallback((map) => {
        mapRef.current = map;
    }, []);

    if (error) {
        return (
            <Box sx={{
                height: '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f5f5f5',
                borderRadius: '8px',
                p: 2
            }}>
                <Typography variant="body2" color="text.secondary" align="center">
                    {error}
                </Typography>
            </Box>
        );
    }

    if (!position) {
        return (
            <Box sx={{
                height: '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f5f5f5',
                borderRadius: '8px'
            }}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    return (
        <GoogleMap
            mapContainerStyle={{
                width: '100%',
                height: '300px',
                borderRadius: '8px'
            }}
            center={position}
            zoom={17}
            onLoad={handleMapLoad}
            options={{
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: true,
                fullscreenControl: true
            }}
        >
            <Marker
                position={position}
                icon={{
                    url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                    scaledSize: new window.google.maps.Size(30, 30)
                }}
            />
        </GoogleMap>
    );
});

const Review = ({ onPrevious, onNext, activeDraftId }) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const { formData, clearFormData } = useShipmentForm();
    const { selectedRate } = formData;

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [loadingDots, setLoadingDots] = useState('');
    const [map, setMap] = useState(null);
    const [mapCenter, setMapCenter] = useState({ lat: 41.8781, lng: -87.6298 });
    const [mapZoom, setMapZoom] = useState(15);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [mapsApiKey, setMapsApiKey] = useState(null);
    const [mapError, setMapError] = useState(null);
    const [fromMarkerPosition, setFromMarkerPosition] = useState(null);
    const [toMarkerPosition, setToMarkerPosition] = useState(null);
    const [expandedSections, setExpandedSections] = useState({
        shipment: true,
        locations: true,
        packages: true,
        rate: true
    });
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);

    // Dialog states
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [showBookingDialog, setShowBookingDialog] = useState(false);
    const [bookingStep, setBookingStep] = useState('booking'); // 'booking' or 'completed'
    const [confirmationNumber, setConfirmationNumber] = useState('');
    const [isDraftSaving, setIsDraftSaving] = useState(false);
    const [draftSaveSuccess, setDraftSaveSuccess] = useState(false);

    // State for full rate details when needed
    const [fullRateDetails, setFullRateDetails] = useState(null);

    useEffect(() => {
        const fetchMapsApiKey = async () => {
            try {
                const keysRef = collection(db, 'keys');
                const keysSnapshot = await getDocs(keysRef);

                if (!keysSnapshot.empty) {
                    const keyDoc = keysSnapshot.docs[0];
                    const key = keyDoc.data().googleAPI;
                    if (!key) {
                        throw new Error('No API key found in Firestore');
                    }
                    console.log('Successfully loaded Maps API key');
                    setMapsApiKey(key);
                } else {
                    throw new Error('No keys document found in Firestore');
                }
            } catch (error) {
                console.error('Error fetching Maps API key:', error);
                setMapError('Failed to load Google Maps API key');
            }
        };

        fetchMapsApiKey();
    }, []);

    const handleGoogleMapsLoaded = useCallback(() => {
        console.log('Google Maps API loaded');
        // Add a small delay to ensure the API is fully available
        setTimeout(() => {
            if (window.google && window.google.maps) {
                setIsGoogleMapsLoaded(true);
                console.log('Google Maps API confirmed ready');
            } else {
                console.error('Google Maps API loaded but not accessible');
            }
        }, 100);
    }, []);

    useEffect(() => {
        const geocodeAddress = async (address, type) => {
            return new Promise((resolve, reject) => {
                // Enhanced safety check
                if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
                    reject(new Error('Google Maps API not fully loaded'));
                    return;
                }

                const geocoder = new window.google.maps.Geocoder();
                const addressString = `${address.street}${address.street2 ? ', ' + address.street2 : ''}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`;

                console.log(`Attempting to geocode ${type} address:`, addressString);

                geocoder.geocode(
                    {
                        address: addressString,
                        region: address.country?.toLowerCase() || 'us'
                    },
                    (results, status) => {
                        if (status === 'OK' && results && results.length > 0) {
                            console.log(`${type} geocoding successful:`, results[0].formatted_address);
                            resolve(results[0]);
                        } else {
                            console.error(`${type} geocoding failed:`, {
                                status,
                                address: addressString,
                                error: status === 'ZERO_RESULTS' ? 'No results found' : `Geocoding error: ${status}`
                            });
                            reject(new Error(`Geocoding failed for ${type}: ${status}`));
                        }
                    }
                );
            });
        };

        const updateGeocodedAddresses = async () => {
            // Enhanced dependency check
            if (!isGoogleMapsLoaded || !mapsApiKey || !formData.shipFrom || !formData.shipTo) {
                console.log('Waiting for dependencies:', {
                    isGoogleMapsLoaded,
                    hasMapsApiKey: !!mapsApiKey,
                    hasShipFrom: !!formData.shipFrom,
                    hasShipTo: !!formData.shipTo,
                    hasGoogleMaps: !!(window.google && window.google.maps)
                });
                return;
            }

            // Double-check Google Maps API availability
            if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
                console.warn('Google Maps API not ready, skipping geocoding');
                return;
            }

            try {
                const [fromResult, toResult] = await Promise.all([
                    geocodeAddress(formData.shipFrom, 'origin'),
                    geocodeAddress(formData.shipTo, 'destination')
                ]);

                if (fromResult) {
                    setFromMarkerPosition({
                        lat: fromResult.geometry.location.lat(),
                        lng: fromResult.geometry.location.lng()
                    });
                }

                if (toResult) {
                    setToMarkerPosition({
                        lat: toResult.geometry.location.lat(),
                        lng: toResult.geometry.location.lng()
                    });
                }
            } catch (error) {
                console.error('Error geocoding addresses:', error);
                setMapError('Failed to geocode addresses. Please try again.');
            }
        };

        // Add a delay to ensure everything is ready
        const timeoutId = setTimeout(() => {
            updateGeocodedAddresses();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [formData.shipFrom, formData.shipTo, isGoogleMapsLoaded, mapsApiKey]);

    useEffect(() => {
        let interval;
        if (isLoading) {
            interval = setInterval(() => {
                setLoadingDots(prev => prev.length >= 3 ? '' : prev + '.');
            }, 500);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const formatAddress = (address) => {
        return `${address.street}${address.street2 ? `, ${address.street2}` : ''}, ${address.city}, ${address.state} ${address.postalCode}`;
    };

    const formatPhone = (phone) => {
        if (!phone) return 'N/A';
        return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    };

    const saveDraft = async () => {
        setIsDraftSaving(true);
        setDraftSaveSuccess(false);
        setError(null);

        const docIdToSave = formData.draftFirestoreDocId;
        console.log('saveDraft: Using formData.draftFirestoreDocId:', docIdToSave);

        if (!docIdToSave) {
            console.error('CRITICAL ERROR in saveDraft: formData.draftFirestoreDocId is missing. This implies an issue with initial draft creation or context update.');
            setError('Cannot save draft: Critical error - shipment ID is missing. Please restart the shipment creation process.');
            setIsDraftSaving(false);
            return;
        }

        try {
            // Extract and clean the form data, excluding the full selectedRate and rateDetails
            const { selectedRate, rateDetails, ...cleanFormData } = formData;

            const draftDataToUpdate = {
                ...cleanFormData,
                status: 'draft',
                updatedAt: serverTimestamp()
            };

            // The selectedRateRef should already be saved from the Rates component
            // We don't include the full selectedRate object or rateDetails

            // Remove undefined fields to prevent Firestore errors
            Object.keys(draftDataToUpdate).forEach(key => {
                if (draftDataToUpdate[key] === undefined) {
                    delete draftDataToUpdate[key];
                }
            });

            console.log(`Updating existing draft: ${docIdToSave}`, {
                ...draftDataToUpdate,
                selectedRateRef: formData.selectedRateRef
            });

            const shipmentDocRef = doc(db, 'shipments', docIdToSave);
            await updateDoc(shipmentDocRef, draftDataToUpdate);
            console.log(`Draft ${docIdToSave} updated successfully.`);

            setDraftSaveSuccess(true);
            setTimeout(() => {
                clearFormData();
                navigate('/shipments');
            }, 1500);

        } catch (error) {
            console.error(`Error saving draft ${docIdToSave}:`, error);
            setError('Failed to save draft. Please try again.');
            setIsDraftSaving(false);
            setDraftSaveSuccess(false);
        }
    };

    const handleBookShipment = () => {
        console.log('handleBookShipment called');
        if (!selectedRate) {
            alert('Please select a rate before proceeding');
            return;
        }
        console.log('Opening confirmation dialog');
        setShowConfirmDialog(true);
    };

    const handleConfirmBooking = () => {
        console.log('handleConfirmBooking called - user clicked YES');
        setShowConfirmDialog(false);
        setShowBookingDialog(true);
        console.log('showBookingDialog set to true by handleConfirmBooking');
        setBookingStep('booking');
        console.log('Starting actual carrier booking...');
        bookCarrierShipment();
    };

    const bookCarrierShipment = async () => {
        console.log('bookCarrierShipment started. Initial formData (full):', JSON.stringify(formData, null, 2));
        console.log('bookCarrierShipment - specifically logging formData.originalRateRequestData at start:', JSON.stringify(formData.originalRateRequestData, null, 2));

        const docIdToProcess = formData.draftFirestoreDocId;

        if (!docIdToProcess) {
            console.error("No draftFirestoreDocId found in formData. Cannot proceed with booking.");
            setError('Draft shipment ID is missing. Cannot proceed.');
            setBookingStep('error');
            return;
        }

        console.log('Current Draft ID from formData.draftFirestoreDocId within bookCarrierShipment:', docIdToProcess);
        setIsLoading(true);
        setBookingStep('booking');
        setError(null); // Clear previous errors
        console.log('Attempting to book existing draft. docIdToProcess:', docIdToProcess);

        // Before calling the Firebase function
        console.log('bookCarrierShipment - CHECKING formData.originalRateRequestData RIGHT BEFORE VALIDATION:', JSON.stringify(formData.originalRateRequestData, null, 2));
        if (!formData.originalRateRequestData || Object.keys(formData.originalRateRequestData).length === 0) {
            console.error('Missing originalRateRequestData in formData. This is required for booking.');
            throw new Error('Original rate request data is missing. Cannot proceed with booking.');
        }

        // Prepare the payload for the Firebase function
        const payload = {
            apiKey: "development-api-key",
            rateRequestData: formData.originalRateRequestData,
            draftFirestoreDocId: docIdToProcess,
            selectedRateDocumentId: formData.selectedRateDocumentId
        };
        console.log('Payload for bookRateEShipPlus:', JSON.stringify(payload, null, 2));

        try {
            const functionsInstance = getFunctions();
            const bookFunction = httpsCallable(functionsInstance, 'bookRateEShipPlus');
            console.log('Calling bookRateEShipPlus Firebase function...');
            const result = await bookFunction(payload);
            console.log('Firebase function bookRateEShipPlus raw result:', result);

            if (result.data && result.data.success && result.data.data) {
                const bookingDetails = result.data.data;
                console.log('Successfully booked shipment:', bookingDetails);

                // Set the confirmation number for display in the success dialog
                setConfirmationNumber(bookingDetails.confirmationNumber);

                setError(null); // Clear previous errors
                setBookingStep('completed'); // Move to completed step in dialog

                // Optionally, call onNext to move to the next step in the main stepper
                if (onNext) {
                    // We might want to pass some confirmation data to the next step
                    // onNext({ bookingConfirmation: bookingDetails }); 
                }

            } else {
                const errorMessage = result.data?.data?.messages?.map(m => m.text).join('; ') || result.data?.error || 'Failed to book shipment. Unknown error from function.';
                console.error('Error from bookRateEShipPlus function:', errorMessage, result.data);
                setError(errorMessage);
                setBookingStep('error');
            }
        } catch (error) {
            console.error('Error calling bookRateEShipPlus or processing its response:', error);
            let detailedMessage = error.message;
            if (error.details) {
                detailedMessage += ` Details: ${JSON.stringify(error.details)}`;
            }
            setError(`Error booking shipment ${docIdToProcess}: ${detailedMessage}`);
            setBookingStep('error');
        } finally {
            setIsLoading(false); // Ensure isLoading is set to false if it was used for the dialog
            // setShowBookingDialog will be controlled by the dialog's own close/complete buttons now
        }
    };

    const handleBookingComplete = () => {
        console.log('handleBookingComplete called - user clicked Continue');
        // Remove any automatic delays/timers - user must manually finish
        setShowBookingDialog(false);
        clearFormData();
        // Navigate directly to shipments instead of using onNext prop
        // Use replace to ensure we don't have navigation history issues
        console.log('Navigating to /shipments');
        navigate('/shipments', { replace: true });
    };

    // Fetch full rate details when selectedRateDocumentId or selectedRate changes
    useEffect(() => {
        const fetchFullRateDetails = async () => {
            if (formData.selectedRateDocumentId) {
                console.log('Review: Attempting to fetch full rate details using document ID:', formData.selectedRateDocumentId);
                try {
                    const rateDetails = await getRateDetailsByDocumentId(formData.selectedRateDocumentId);
                    if (rateDetails) {
                        setFullRateDetails(rateDetails);
                        console.log('Review: Fetched full rate details from Firestore:', rateDetails);
                    } else {
                        console.warn('Review: getRateDetailsByDocumentId returned null for ID:', formData.selectedRateDocumentId);
                        setFullRateDetails(null); // Clear if not found
                    }
                } catch (error) {
                    console.error('Review: Error fetching full rate details by ID:', error);
                    setFullRateDetails(null); // Clear on error
                }
            } else if (formData.selectedRate) {
                console.log('Review: Using selectedRate from context as fallback for fullRateDetails:', formData.selectedRate);
                // Shape selectedRate to match the structure expected from Firestore/selectedRateRef
                const shapedFallback = {
                    ...formData.selectedRate,
                    // Ensure crucial fields for display are present, mapping if necessary
                    // The original logic for shaping had freightCharge, fuelCharge, etc.
                    // We assume selectedRate from context now contains these directly or they are mapped in Rates.jsx
                    // For example, if selectedRate has totalCharges, carrier, service, transitDays, estimatedDeliveryDate
                    // and the detailed breakdown (freightCharges, fuelCharges etc.)
                    // This shaping might need adjustment based on what's in formData.selectedRate
                    // For now, we'll assume formData.selectedRate has the necessary fields like:
                    // freightCharges, fuelCharges, accessorialCharges, serviceCharges, etc.
                    // If not, this part needs to be more robust.
                    id: formData.selectedRate.quoteId || formData.selectedRate.rateId, // ensure an id field for consistency if needed elsewhere
                    // Example mapping (adjust if formData.selectedRate structure is different):
                    freightCharge: formData.selectedRate.freightCharges,
                    fuelCharge: formData.selectedRate.fuelCharges,
                    accessorialCharges: formData.selectedRate.accessorialCharges,
                    serviceCharges: formData.selectedRate.serviceCharges,
                    totalCharges: formData.selectedRate.totalCharges || formData.selectedRate.price,
                    carrier: formData.selectedRate.carrierName || formData.selectedRate.carrier,
                    service: formData.selectedRate.serviceType || formData.selectedRate.service,
                    transitDays: formData.selectedRate.transitTime || formData.selectedRate.transitDays,
                };
                setFullRateDetails(shapedFallback);
            } else {
                console.log('Review: No selectedRateDocumentId or selectedRate in context to fetch/display details.');
                setFullRateDetails(null);
            }
        };

        fetchFullRateDetails();
    }, [formData.selectedRateDocumentId, formData.selectedRate]);

    const { shipmentInfo = {}, shipFrom = {}, shipTo = {}, packages = [] } = formData;

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {mapsApiKey ? (
                <LoadScript
                    googleMapsApiKey={mapsApiKey}
                    libraries={GOOGLE_MAPS_LIBRARIES}
                    onLoad={handleGoogleMapsLoaded}
                    onError={(error) => {
                        console.error('Google Maps LoadScript error:', error);
                        setMapError('Failed to load Google Maps. Maps functionality may be limited.');
                    }}
                    loadingElement={
                        <Box sx={{ py: 4, textAlign: 'center' }}>
                            <CircularProgress />
                            <Typography variant="body2" sx={{ mt: 2 }}>
                                Loading Google Maps API...
                            </Typography>
                        </Box>
                    }
                >
                    {isGoogleMapsLoaded ? (
                        <>
                            <Box sx={{ mb: 4 }}>
                                <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
                                    Review Shipment Details
                                </Typography>
                            </Box>

                            {error && (
                                <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
                            )}

                            {mapError && (
                                <Alert severity="warning" sx={{ mb: 3 }}>{mapError}</Alert>
                            )}

                            <Paper sx={{ mb: 3, overflow: 'hidden' }}>
                                <Box
                                    sx={{
                                        p: 2,
                                        bgcolor: '#000000',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ShippingIcon />
                                        <Typography variant="h6">Shipment Information</Typography>
                                    </Box>
                                    <IconButton
                                        onClick={() => toggleSection('shipment')}
                                        sx={{ color: 'white' }}
                                    >
                                        <ExpandMoreIcon
                                            sx={{
                                                transform: expandedSections.shipment ? 'rotate(180deg)' : 'none',
                                                transition: 'transform 0.3s'
                                            }}
                                        />
                                    </IconButton>
                                </Box>
                                <Collapse in={expandedSections.shipment}>
                                    <Box sx={{ p: 3 }}>
                                        <Grid container spacing={3}>
                                            <Grid item xs={12} md={4}>
                                                <Paper elevation={2} sx={{ height: '100%', p: 2, bgcolor: 'background.paper' }}>
                                                    <Typography variant="h6" gutterBottom color="black" sx={{
                                                        pb: 1,
                                                        mb: 2
                                                    }}>
                                                        Basic Information
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Shipment Type
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {shipmentInfo.shipmentType || 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Reference Number
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {shipmentInfo.referenceNumber || 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Bill Type
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {shipmentInfo.billType || 'Prepaid'}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </Paper>
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Paper elevation={2} sx={{ height: '100%', p: 2, bgcolor: 'background.paper' }}>
                                                    <Typography variant="h6" gutterBottom color="black" sx={{
                                                        pb: 1,
                                                        mb: 2
                                                    }}>
                                                        Timing Information
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Shipment Date
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {shipmentInfo.shipmentDate || 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Pickup Window
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {shipmentInfo.earliestPickup || '09:00'} - {shipmentInfo.latestPickup || '17:00'}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Delivery Window
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {shipmentInfo.earliestDelivery || '09:00'} - {shipmentInfo.latestDelivery || '17:00'}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </Paper>
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Paper elevation={2} sx={{ height: '100%', p: 2, bgcolor: 'background.paper' }}>
                                                    <Typography variant="h6" gutterBottom color="black" sx={{
                                                        pb: 1,
                                                        mb: 2
                                                    }}>
                                                        Service Options
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Hold for Pickup
                                                            </Typography>
                                                            <Chip
                                                                label={shipmentInfo.holdForPickup ? "Yes" : "No"}
                                                                color={shipmentInfo.holdForPickup ? "primary" : "default"}
                                                                size="small"
                                                                sx={{ minWidth: 60 }}
                                                            />
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                International
                                                            </Typography>
                                                            <Chip
                                                                label={shipmentInfo.international ? "Yes" : "No"}
                                                                color={shipmentInfo.international ? "primary" : "default"}
                                                                size="small"
                                                                sx={{ minWidth: 60 }}
                                                            />
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Saturday Delivery
                                                            </Typography>
                                                            <Chip
                                                                label={shipmentInfo.saturdayDelivery ? "Yes" : "No"}
                                                                color={shipmentInfo.saturdayDelivery ? "primary" : "default"}
                                                                size="small"
                                                                sx={{ minWidth: 60 }}
                                                            />
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Signature Required
                                                            </Typography>
                                                            <Chip
                                                                label={shipmentInfo.signatureRequired ? "Yes" : "No"}
                                                                color={shipmentInfo.signatureRequired ? "primary" : "default"}
                                                                size="small"
                                                                sx={{ minWidth: 60 }}
                                                            />
                                                        </Box>
                                                    </Box>
                                                </Paper>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Collapse>
                            </Paper>

                            <Grid container spacing={3} sx={{ mb: 3 }}>
                                <Grid item xs={12} md={6}>
                                    <Paper sx={{ height: '100%' }}>
                                        <Box sx={{ p: 2, bgcolor: '#000000', color: 'white' }}>
                                            <Typography variant="h6">
                                                <LocationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                                Ship From
                                            </Typography>
                                        </Box>
                                        <Box sx={{ p: 2 }}>
                                            <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                                {shipFrom.company}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                {formatAddress(shipFrom)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Contact: {shipFrom.contactName}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Phone: {formatPhone(shipFrom.contactPhone)}
                                            </Typography>
                                            <Box sx={{ mt: 2 }}>
                                                {isGoogleMapsLoaded ? (
                                                    <SimpleMap address={shipFrom} />
                                                ) : (
                                                    <Box sx={{
                                                        height: '300px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        bgcolor: '#f5f5f5',
                                                        borderRadius: 1
                                                    }}>
                                                        <CircularProgress size={24} />
                                                    </Box>
                                                )}
                                            </Box>
                                        </Box>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Paper sx={{ height: '100%' }}>
                                        <Box sx={{ p: 2, bgcolor: '#000000', color: 'white' }}>
                                            <Typography variant="h6">
                                                <LocationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                                Ship To
                                            </Typography>
                                        </Box>
                                        <Box sx={{ p: 2 }}>
                                            <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                                {shipTo.company}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                {formatAddress(shipTo)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Contact: {shipTo.contactName}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Phone: {formatPhone(shipTo.contactPhone)}
                                            </Typography>
                                            <Box sx={{ mt: 2 }}>
                                                {isGoogleMapsLoaded ? (
                                                    <SimpleMap address={shipTo} />
                                                ) : (
                                                    <Box sx={{
                                                        height: '300px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        bgcolor: '#f5f5f5',
                                                        borderRadius: 1
                                                    }}>
                                                        <CircularProgress size={24} />
                                                    </Box>
                                                )}
                                            </Box>
                                        </Box>
                                    </Paper>
                                </Grid>
                            </Grid>

                            <Paper sx={{ mb: 3 }}>
                                <Box sx={{ p: 2, bgcolor: '#000000', color: 'white' }}>
                                    <Typography variant="h6">Package Details</Typography>
                                </Box>
                                <Box sx={{ p: 2 }}>
                                    <Grid container spacing={3}>
                                        {packages.map((pkg, index) => (
                                            <Grid item xs={12} md={6} key={pkg.id || index}>
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 2,
                                                        border: '1px solid #e0e0e0',
                                                        borderRadius: 1
                                                    }}
                                                >
                                                    <Typography variant="subtitle1" gutterBottom>
                                                        Package {index + 1}
                                                    </Typography>
                                                    <Grid container spacing={2}>
                                                        <Grid item xs={6}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Description
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {pkg.itemDescription || 'N/A'}
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Weight
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {pkg.weight} lbs
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Dimensions
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {pkg.length}" × {pkg.width}" × {pkg.height}"
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Freight Class
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {pkg.freightClass || 'N/A'}
                                                            </Typography>
                                                        </Grid>
                                                    </Grid>
                                                </Paper>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Box>
                            </Paper>

                            {/* Rate Details Section */}
                            {(formData.selectedRateDocumentId || formData.selectedRate) ? (
                                <Paper sx={{ mb: 4 }}>
                                    <Box
                                        sx={{
                                            p: 2,
                                            bgcolor: '#000000',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}
                                        onClick={() => toggleSection('rate')}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <MoneyIcon />
                                            <Typography variant="h6">Selected Rate</Typography>
                                        </Box>
                                        <IconButton sx={{ color: 'white' }}>
                                            <ExpandMoreIcon
                                                sx={{
                                                    transform: expandedSections.rate ? 'rotate(180deg)' : 'none',
                                                    transition: 'transform 0.3s'
                                                }}
                                            />
                                        </IconButton>
                                    </Box>
                                    <Collapse in={expandedSections.rate}>
                                        <Box sx={{ p: 3 }}>
                                            <Grid container spacing={3}>
                                                <Grid item xs={12} md={6}>
                                                    <Typography variant="h5" gutterBottom>
                                                        {fullRateDetails?.carrier || formData.selectedRate?.carrierName || formData.selectedRate?.carrier || 'N/A'}
                                                    </Typography>
                                                    <Chip
                                                        label={fullRateDetails?.service || formData.selectedRate?.serviceType || formData.selectedRate?.service || 'N/A'}
                                                        color="primary"
                                                        sx={{ mb: 2 }}
                                                    />
                                                    <Typography variant="body2" color="text.secondary">
                                                        Transit Time: {fullRateDetails?.transitDays ?? (formData.selectedRate?.transitTime ?? formData.selectedRate?.transitDays)} days
                                                    </Typography>
                                                    {(fullRateDetails?.guaranteed || formData.selectedRate?.guaranteed) &&
                                                        <Chip label="Guaranteed" color="success" size="small" sx={{ ml: 1 }} />
                                                    }
                                                </Grid>
                                                <Grid item xs={12} md={6}>
                                                    <Box sx={{ textAlign: 'right' }}>
                                                        <Typography variant="h4" color="primary" gutterBottom>
                                                            ${(fullRateDetails?.totalCharges ?? formData.selectedRate?.totalCharges ?? formData.selectedRate?.price ?? 0).toFixed(2)}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Currency: {fullRateDetails?.currency || formData.selectedRate?.currency || 'USD'}
                                                        </Typography>
                                                        {fullRateDetails?.estimatedDeliveryDate || formData.selectedRate?.estimatedDeliveryDate ? (
                                                            <Typography variant="body2" color="text.secondary">
                                                                Est. Delivery: {fullRateDetails?.estimatedDeliveryDate || formData.selectedRate?.estimatedDeliveryDate}
                                                            </Typography>
                                                        ) : null}
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                            {/* Detailed breakdown if available in fullRateDetails */}
                                            {(fullRateDetails && (fullRateDetails.freightCharge || fullRateDetails.fuelCharge || fullRateDetails.accessorialCharges || fullRateDetails.serviceCharges)) && (
                                                <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #eee' }}>
                                                    <Typography variant="subtitle1" gutterBottom>Rate Breakdown:</Typography>
                                                    <Grid container spacing={1}>
                                                        {fullRateDetails.freightCharge !== undefined && <Grid item xs={6} sm={3}><Typography variant="body2">Freight: ${fullRateDetails.freightCharge.toFixed(2)}</Typography></Grid>}
                                                        {fullRateDetails.fuelCharge !== undefined && <Grid item xs={6} sm={3}><Typography variant="body2">Fuel: ${fullRateDetails.fuelCharge.toFixed(2)}</Typography></Grid>}
                                                        {fullRateDetails.accessorialCharges !== undefined && <Grid item xs={6} sm={3}><Typography variant="body2">Accessorials: ${fullRateDetails.accessorialCharges.toFixed(2)}</Typography></Grid>}
                                                        {fullRateDetails.serviceCharges !== undefined && <Grid item xs={6} sm={3}><Typography variant="body2">Service: ${fullRateDetails.serviceCharges.toFixed(2)}</Typography></Grid>}
                                                    </Grid>
                                                </Box>
                                            )}
                                        </Box>
                                    </Collapse>
                                </Paper>
                            ) : (
                                <Paper sx={{ mb: 4, p: 3, textAlign: 'center' }}>
                                    <Typography variant="h6" color="error">
                                        No rate selected. Please go back and select a rate.
                                    </Typography>
                                </Paper>
                            )}

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={onPrevious}
                                    type="button"
                                    style={{
                                        padding: '12px 24px',
                                        borderRadius: '8px',
                                        border: '2px solid #1a237e',
                                        background: 'transparent',
                                        color: '#1a237e',
                                        cursor: 'pointer',
                                        fontSize: '16px',
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    ← Previous
                                </motion.button>

                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={saveDraft}
                                        type="button"
                                        disabled={isDraftSaving || draftSaveSuccess}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '8px',
                                            border: '2px solid #666',
                                            background: draftSaveSuccess ? '#4caf50' : 'transparent',
                                            color: draftSaveSuccess ? 'white' : '#666',
                                            cursor: (isDraftSaving || draftSaveSuccess) ? 'not-allowed' : 'pointer',
                                            fontSize: '16px',
                                            fontWeight: 500,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        {isDraftSaving ? (
                                            <CircularProgress size={20} color="inherit" />
                                        ) : draftSaveSuccess ? (
                                            <CheckCircleIcon sx={{ fontSize: 20 }} />
                                        ) : (
                                            <SaveIcon sx={{ fontSize: 20 }} />
                                        )}
                                        {isDraftSaving ? 'Saving...' : draftSaveSuccess ? 'Saved!' : 'Save Draft'}
                                    </motion.button>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleBookShipment}
                                        type="button"
                                        disabled={!selectedRate}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: !selectedRate ? '#cccccc' : '#1a237e',
                                            color: 'white',
                                            cursor: !selectedRate ? 'not-allowed' : 'pointer',
                                            fontSize: '16px',
                                            fontWeight: 500,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <CheckCircleIcon sx={{ fontSize: 20 }} />
                                        Book Shipment
                                    </motion.button>
                                </Box>
                            </Box>

                            {/* Confirmation Dialog */}
                            <Dialog
                                open={showConfirmDialog}
                                onClose={() => setShowConfirmDialog(false)}
                                maxWidth="sm"
                                fullWidth
                            >
                                <DialogTitle sx={{ textAlign: 'center', fontWeight: 600, fontSize: '1.5rem' }}>
                                    CONFIRM SHIPMENT BOOKING
                                </DialogTitle>
                                <DialogContent sx={{ textAlign: 'center', py: 3 }}>
                                    <Typography variant="body1" sx={{ mb: 2 }}>
                                        Are you sure you want to book this shipment with <strong>{fullRateDetails?.carrier || selectedRate?.carrier || 'N/A'}</strong>?
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Total cost: <strong>${((fullRateDetails?.totalCharges ?? selectedRate?.totalCharges ?? selectedRate?.price) || 0).toFixed(2)}</strong>
                                    </Typography>
                                </DialogContent>
                                <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3 }}>
                                    <Button
                                        onClick={() => setShowConfirmDialog(false)}
                                        variant="outlined"
                                        size="large"
                                        sx={{ minWidth: 100 }}
                                    >
                                        NO
                                    </Button>
                                    <Button
                                        onClick={handleConfirmBooking}
                                        variant="contained"
                                        size="large"
                                        sx={{ minWidth: 100, bgcolor: '#1a237e' }}
                                    >
                                        YES
                                    </Button>
                                </DialogActions>
                            </Dialog>

                            {/* Booking Progress Dialog */}
                            <Dialog
                                open={showBookingDialog}
                                onClose={() => { /* Intentionally empty to prevent closing by click outside/Esc */ }}
                                maxWidth="sm"
                                fullWidth
                                disableEscapeKeyDown // Explicitly prevent Esc key from closing
                            >
                                <DialogContent sx={{ textAlign: 'center', py: 4 }}>
                                    {console.log('Rendering Booking Progress Dialog. showBookingDialog:', showBookingDialog, 'bookingStep:', bookingStep)}
                                    {bookingStep === 'booking' ? (
                                        <>
                                            <CircularProgress size={60} sx={{ mb: 3, color: '#1a237e' }} />
                                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                                Booking shipment with {selectedRate?.carrier}...
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Please wait while we process your shipment booking.
                                            </Typography>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircleIcon sx={{ fontSize: 80, color: '#4caf50', mb: 2 }} />
                                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                                Shipment Booked Successfully!
                                            </Typography>
                                            <Typography variant="body1" sx={{ mb: 1 }}>
                                                Confirmation Number:
                                            </Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1a237e', mb: 3 }}>
                                                {confirmationNumber}
                                            </Typography>
                                            <Button
                                                onClick={handleBookingComplete}
                                                variant="contained"
                                                size="large"
                                                sx={{ bgcolor: '#1a237e' }}
                                            >
                                                Complete & Return to Shipments
                                            </Button>
                                        </>
                                    )}
                                </DialogContent>
                            </Dialog>
                        </>
                    ) : (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <CircularProgress />
                            <Typography variant="body2" sx={{ mt: 2 }}>
                                Loading Google Maps API...
                            </Typography>
                        </Box>
                    )}
                </LoadScript>
            ) : (
                <Box sx={{ py: 4 }}>
                    {mapError ? (
                        <>
                            <Alert severity="warning" sx={{ mb: 3 }}>
                                {mapError} - Maps functionality will be disabled, but you can still book shipments.
                            </Alert>

                            <Box sx={{ mb: 4 }}>
                                <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
                                    Review Shipment Details
                                </Typography>
                            </Box>

                            {error && (
                                <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
                            )}

                            {/* Render shipment details without maps */}
                            <Paper sx={{ mb: 3, overflow: 'hidden' }}>
                                <Box
                                    sx={{
                                        p: 2,
                                        bgcolor: '#000000',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ShippingIcon />
                                        <Typography variant="h6">Shipment Information</Typography>
                                    </Box>
                                    <IconButton
                                        onClick={() => toggleSection('shipment')}
                                        sx={{ color: 'white' }}
                                    >
                                        <ExpandMoreIcon
                                            sx={{
                                                transform: expandedSections.shipment ? 'rotate(180deg)' : 'none',
                                                transition: 'transform 0.3s'
                                            }}
                                        />
                                    </IconButton>
                                </Box>
                                <Collapse in={expandedSections.shipment}>
                                    <Box sx={{ p: 3 }}>
                                        <Grid container spacing={3}>
                                            <Grid item xs={12} md={4}>
                                                <Paper elevation={2} sx={{ height: '100%', p: 2, bgcolor: 'background.paper' }}>
                                                    <Typography variant="h6" gutterBottom color="black" sx={{
                                                        pb: 1,
                                                        mb: 2
                                                    }}>
                                                        Basic Information
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Shipment Type
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {shipmentInfo.shipmentType || 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Reference Number
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {shipmentInfo.referenceNumber || 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Bill Type
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {shipmentInfo.billType || 'Prepaid'}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </Paper>
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Paper elevation={2} sx={{ height: '100%', p: 2, bgcolor: 'background.paper' }}>
                                                    <Typography variant="h6" gutterBottom color="black" sx={{
                                                        pb: 1,
                                                        mb: 2
                                                    }}>
                                                        Timing Information
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Shipment Date
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {shipmentInfo.shipmentDate || 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Pickup Window
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {shipmentInfo.earliestPickup || '09:00'} - {shipmentInfo.latestPickup || '17:00'}
                                                            </Typography>
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Delivery Window
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {shipmentInfo.earliestDelivery || '09:00'} - {shipmentInfo.latestDelivery || '17:00'}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </Paper>
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Paper elevation={2} sx={{ height: '100%', p: 2, bgcolor: 'background.paper' }}>
                                                    <Typography variant="h6" gutterBottom color="black" sx={{
                                                        pb: 1,
                                                        mb: 2
                                                    }}>
                                                        Service Options
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Hold for Pickup
                                                            </Typography>
                                                            <Chip
                                                                label={shipmentInfo.holdForPickup ? "Yes" : "No"}
                                                                color={shipmentInfo.holdForPickup ? "primary" : "default"}
                                                                size="small"
                                                                sx={{ minWidth: 60 }}
                                                            />
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                International
                                                            </Typography>
                                                            <Chip
                                                                label={shipmentInfo.international ? "Yes" : "No"}
                                                                color={shipmentInfo.international ? "primary" : "default"}
                                                                size="small"
                                                                sx={{ minWidth: 60 }}
                                                            />
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Saturday Delivery
                                                            </Typography>
                                                            <Chip
                                                                label={shipmentInfo.saturdayDelivery ? "Yes" : "No"}
                                                                color={shipmentInfo.saturdayDelivery ? "primary" : "default"}
                                                                size="small"
                                                                sx={{ minWidth: 60 }}
                                                            />
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="subtitle2" color="text.secondary">
                                                                Signature Required
                                                            </Typography>
                                                            <Chip
                                                                label={shipmentInfo.signatureRequired ? "Yes" : "No"}
                                                                color={shipmentInfo.signatureRequired ? "primary" : "default"}
                                                                size="small"
                                                                sx={{ minWidth: 60 }}
                                                            />
                                                        </Box>
                                                    </Box>
                                                </Paper>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Collapse>
                            </Paper>

                            <Grid container spacing={3} sx={{ mb: 3 }}>
                                <Grid item xs={12} md={6}>
                                    <Paper sx={{ height: '100%' }}>
                                        <Box sx={{ p: 2, bgcolor: '#000000', color: 'white' }}>
                                            <Typography variant="h6">
                                                <LocationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                                Ship From
                                            </Typography>
                                        </Box>
                                        <Box sx={{ p: 2 }}>
                                            <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                                {shipFrom.company}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                {formatAddress(shipFrom)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Contact: {shipFrom.contactName}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Phone: {formatPhone(shipFrom.contactPhone)}
                                            </Typography>
                                            <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1, textAlign: 'center' }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Map unavailable
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Paper sx={{ height: '100%' }}>
                                        <Box sx={{ p: 2, bgcolor: '#000000', color: 'white' }}>
                                            <Typography variant="h6">
                                                <LocationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                                Ship To
                                            </Typography>
                                        </Box>
                                        <Box sx={{ p: 2 }}>
                                            <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                                {shipTo.company}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                {formatAddress(shipTo)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Contact: {shipTo.contactName}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Phone: {formatPhone(shipTo.contactPhone)}
                                            </Typography>
                                            <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1, textAlign: 'center' }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Map unavailable
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Paper>
                                </Grid>
                            </Grid>

                            <Paper sx={{ mb: 3 }}>
                                <Box sx={{ p: 2, bgcolor: '#000000', color: 'white' }}>
                                    <Typography variant="h6">Package Details</Typography>
                                </Box>
                                <Box sx={{ p: 2 }}>
                                    <Grid container spacing={3}>
                                        {packages.map((pkg, index) => (
                                            <Grid item xs={12} md={6} key={pkg.id || index}>
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 2,
                                                        border: '1px solid #e0e0e0',
                                                        borderRadius: 1
                                                    }}
                                                >
                                                    <Typography variant="subtitle1" gutterBottom>
                                                        Package {index + 1}
                                                    </Typography>
                                                    <Grid container spacing={2}>
                                                        <Grid item xs={6}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Description
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {pkg.itemDescription || 'N/A'}
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Weight
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {pkg.weight} lbs
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Dimensions
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {pkg.length}" × {pkg.width}" × {pkg.height}"
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Freight Class
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                {pkg.freightClass || 'N/A'}
                                                            </Typography>
                                                        </Grid>
                                                    </Grid>
                                                </Paper>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Box>
                            </Paper>

                            {selectedRate ? (
                                <Paper sx={{ mb: 4 }}>
                                    <Box sx={{ p: 2, bgcolor: '#000000', color: 'white' }}>
                                        <Typography variant="h6">Rate Details</Typography>
                                    </Box>
                                    <Box sx={{ p: 3 }}>
                                        <Grid container spacing={3}>
                                            <Grid item xs={12} md={6}>
                                                <Typography variant="h5" gutterBottom>
                                                    {selectedRate.carrier}
                                                </Typography>
                                                <Chip
                                                    label={selectedRate.service}
                                                    color="primary"
                                                    sx={{ mb: 2 }}
                                                />
                                                <Typography variant="body2" color="text.secondary">
                                                    Transit Time: {selectedRate.transitDays} days
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12} md={6}>
                                                <Box sx={{ textAlign: 'right' }}>
                                                    <Typography variant="h4" color="primary" gutterBottom>
                                                        ${(selectedRate.price || 0).toFixed(2)}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Total Charges
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                        <Divider sx={{ my: 2 }} />
                                        <Grid container spacing={2}>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Freight Charges
                                                </Typography>
                                                <Typography variant="body1">
                                                    ${(fullRateDetails?.freightCharge || 0).toFixed(2)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Fuel Surcharge
                                                </Typography>
                                                <Typography variant="body1">
                                                    ${(fullRateDetails?.fuelCharge || 0).toFixed(2)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Accessorial Charges
                                                </Typography>
                                                <Typography variant="body1">
                                                    ${(fullRateDetails?.accessorialCharges || 0).toFixed(2)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Service Charges
                                                </Typography>
                                                <Typography variant="body1">
                                                    ${(fullRateDetails?.serviceCharges || 0).toFixed(2)}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Paper>
                            ) : (
                                <Paper sx={{ mb: 4, p: 3, textAlign: 'center' }}>
                                    <Typography variant="h6" color="error">
                                        No rate selected. Please go back and select a rate.
                                    </Typography>
                                </Paper>
                            )}

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={onPrevious}
                                    type="button"
                                    style={{
                                        padding: '12px 24px',
                                        borderRadius: '8px',
                                        border: '2px solid #1a237e',
                                        background: 'transparent',
                                        color: '#1a237e',
                                        cursor: 'pointer',
                                        fontSize: '16px',
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    ← Previous
                                </motion.button>

                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={saveDraft}
                                        type="button"
                                        disabled={isDraftSaving || draftSaveSuccess}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '8px',
                                            border: '2px solid #666',
                                            background: draftSaveSuccess ? '#4caf50' : 'transparent',
                                            color: draftSaveSuccess ? 'white' : '#666',
                                            cursor: (isDraftSaving || draftSaveSuccess) ? 'not-allowed' : 'pointer',
                                            fontSize: '16px',
                                            fontWeight: 500,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        {isDraftSaving ? (
                                            <CircularProgress size={20} color="inherit" />
                                        ) : draftSaveSuccess ? (
                                            <CheckCircleIcon sx={{ fontSize: 20 }} />
                                        ) : (
                                            <SaveIcon sx={{ fontSize: 20 }} />
                                        )}
                                        {isDraftSaving ? 'Saving...' : draftSaveSuccess ? 'Saved!' : 'Save Draft'}
                                    </motion.button>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleBookShipment}
                                        type="button"
                                        disabled={!selectedRate}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: !selectedRate ? '#cccccc' : '#1a237e',
                                            color: 'white',
                                            cursor: !selectedRate ? 'not-allowed' : 'pointer',
                                            fontSize: '16px',
                                            fontWeight: 500,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <CheckCircleIcon sx={{ fontSize: 20 }} />
                                        Book Shipment
                                    </motion.button>
                                </Box>
                            </Box>

                            {/* Confirmation Dialog */}
                            <Dialog
                                open={showConfirmDialog}
                                onClose={() => setShowConfirmDialog(false)}
                                maxWidth="sm"
                                fullWidth
                            >
                                <DialogTitle sx={{ textAlign: 'center', fontWeight: 600, fontSize: '1.5rem' }}>
                                    CONFIRM SHIPMENT BOOKING
                                </DialogTitle>
                                <DialogContent sx={{ textAlign: 'center', py: 3 }}>
                                    <Typography variant="body1" sx={{ mb: 2 }}>
                                        Are you sure you want to book this shipment with <strong>{fullRateDetails?.carrier || selectedRate?.carrier || 'N/A'}</strong>?
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Total cost: <strong>${((fullRateDetails?.totalCharges ?? selectedRate?.totalCharges ?? selectedRate?.price) || 0).toFixed(2)}</strong>
                                    </Typography>
                                </DialogContent>
                                <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3 }}>
                                    <Button
                                        onClick={() => setShowConfirmDialog(false)}
                                        variant="outlined"
                                        size="large"
                                        sx={{ minWidth: 100 }}
                                    >
                                        NO
                                    </Button>
                                    <Button
                                        onClick={handleConfirmBooking}
                                        variant="contained"
                                        size="large"
                                        sx={{ minWidth: 100, bgcolor: '#1a237e' }}
                                    >
                                        YES
                                    </Button>
                                </DialogActions>
                            </Dialog>

                            {/* Booking Progress Dialog */}
                            <Dialog
                                open={showBookingDialog}
                                onClose={() => { /* Intentionally empty to prevent closing by click outside/Esc */ }}
                                maxWidth="sm"
                                fullWidth
                                disableEscapeKeyDown // Explicitly prevent Esc key from closing
                            >
                                <DialogContent sx={{ textAlign: 'center', py: 4 }}>
                                    {console.log('Rendering Booking Progress Dialog. showBookingDialog:', showBookingDialog, 'bookingStep:', bookingStep)}
                                    {bookingStep === 'booking' ? (
                                        <>
                                            <CircularProgress size={60} sx={{ mb: 3, color: '#1a237e' }} />
                                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                                Booking shipment with {selectedRate?.carrier}...
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Please wait while we process your shipment booking.
                                            </Typography>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircleIcon sx={{ fontSize: 80, color: '#4caf50', mb: 2 }} />
                                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                                Shipment Booked Successfully!
                                            </Typography>
                                            <Typography variant="body1" sx={{ mb: 1 }}>
                                                Confirmation Number:
                                            </Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1a237e', mb: 3 }}>
                                                {confirmationNumber}
                                            </Typography>
                                            <Button
                                                onClick={handleBookingComplete}
                                                variant="contained"
                                                size="large"
                                                sx={{ bgcolor: '#1a237e' }}
                                            >
                                                Complete & Return to Shipments
                                            </Button>
                                        </>
                                    )}
                                </DialogContent>
                            </Dialog>
                        </>
                    ) : (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <CircularProgress />
                            <Typography variant="body2" sx={{ mt: 2 }}>
                                Loading Google Maps API...
                            </Typography>
                        </Box>
                    )}
                </Box>
            )}
        </Container>
    );
};

export default Review; 