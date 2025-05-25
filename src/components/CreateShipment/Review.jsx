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
            carrierCode: rate.carrierCode || '',
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
            originalRate: rate.originalRate,
            status: status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

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
    const { selectedRate, selectedRateRef } = formData;

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
        if (!selectedRateRef && !selectedRate) {
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
        console.log('Starting carrier booking simulation...');
        simulateCarrierBooking();
    };

    const simulateCarrierBooking = async () => {
        console.log('simulateCarrierBooking started. Initial formData:', JSON.parse(JSON.stringify(formData)));
        const docIdToProcess = formData.draftFirestoreDocId;
        console.log('Current Draft ID from formData.draftFirestoreDocId within simulateCarrierBooking:', docIdToProcess);

        if (!docIdToProcess) {
            console.error('CRITICAL: simulateCarrierBooking called without formData.draftFirestoreDocId. A draft record should always exist with its ID in context.');
            setError('Cannot book shipment: No shipment ID found in form data. Please try saving as a draft first or restart the process.');
            setShowBookingDialog(false);
            return;
        }

        try {
            // Extract clean form data without the full selectedRate and rateDetails
            const { status, id, draftFirestoreDocId, selectedRate, selectedRateRef, rateDetails, ...restOfFormData } = formData;

            console.log(`Attempting to book existing draft. docIdToProcess: ${docIdToProcess}`);
            const shipmentDocRef = doc(db, 'shipments', docIdToProcess);

            // Use the selected rate data to book
            const rateToBook = fullRateDetails || selectedRate || selectedRateRef;
            if (!rateToBook) {
                throw new Error('No rate selected for booking');
            }

            console.log('Booking rate:', rateToBook);

            let bookedRateDocId = null;

            // Use rate reference for confirmation number generation
            const rateCarrier = selectedRateRef?.carrier || rateToBook?.carrier || 'CARRIER';
            const mockConfirmationNumber = `${rateCarrier.toUpperCase()}-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
            setConfirmationNumber(mockConfirmationNumber);

            // Instead of creating a new rate record, update the existing one to 'booked' status
            if (selectedRateRef?.rateDocumentId) {
                console.log('Updating existing rate document to booked status:', selectedRateRef.rateDocumentId);
                try {
                    const rateDocRef = doc(db, 'shipmentRates', selectedRateRef.rateDocumentId);
                    await updateDoc(rateDocRef, {
                        status: 'booked',
                        confirmationNumber: mockConfirmationNumber,
                        bookedAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    bookedRateDocId = selectedRateRef.rateDocumentId;
                    console.log('Successfully updated rate status to booked with confirmation number');
                } catch (updateError) {
                    console.error('Error updating existing rate, creating new one:', updateError);
                    // Fallback: create new rate record
                    bookedRateDocId = await saveRateToShipmentRates(rateToBook, docIdToProcess, 'booked');

                    // Update the new rate document with confirmation number
                    if (bookedRateDocId) {
                        const newRateDocRef = doc(db, 'shipmentRates', bookedRateDocId);
                        await updateDoc(newRateDocRef, {
                            confirmationNumber: mockConfirmationNumber,
                            bookedAt: serverTimestamp()
                        });
                    }
                }
            } else {
                console.log('No existing rate document found, creating new booked rate');
                // Create new rate record for booking
                bookedRateDocId = await saveRateToShipmentRates(rateToBook, docIdToProcess, 'booked');

                // Update the new rate document with confirmation number
                if (bookedRateDocId) {
                    const newRateDocRef = doc(db, 'shipmentRates', bookedRateDocId);
                    await updateDoc(newRateDocRef, {
                        confirmationNumber: mockConfirmationNumber,
                        bookedAt: serverTimestamp()
                    });
                }
            }

            // Update shipment to pending status (exclude full selectedRate)
            await updateDoc(shipmentDocRef, {
                ...restOfFormData,
                status: 'pending',
                updatedAt: serverTimestamp(),
                // Keep the rate reference but update it if we created a new booked rate record
                ...(bookedRateDocId && {
                    selectedRateRef: {
                        ...selectedRateRef,
                        rateDocumentId: bookedRateDocId,
                        status: 'booked'
                    }
                })
            });
            console.log(`Shipment ${docIdToProcess} status updated to pending.`);

            await new Promise(resolve => setTimeout(resolve, 3000));

            // Final booking completion - update to booked status and save confirmation number in selectedRateRef
            await updateDoc(shipmentDocRef, {
                status: 'booked',
                updatedAt: serverTimestamp(),
                // Save confirmation number in the selectedRateRef map, not at root level
                selectedRateRef: {
                    ...selectedRateRef,
                    rateDocumentId: bookedRateDocId || selectedRateRef?.rateDocumentId,
                    status: 'booked',
                    confirmationNumber: mockConfirmationNumber,
                    bookedAt: serverTimestamp()
                }
            });
            console.log(`Shipment ${docIdToProcess} booked successfully with confirmation: ${mockConfirmationNumber}`);
            setBookingStep('completed');

        } catch (error) {
            console.error(`Error booking shipment ${docIdToProcess}:`, error);
            setError(`Failed to book shipment (ID: ${docIdToProcess}). Please try again.`);
            setShowBookingDialog(false);
        }
    };

    const handleBookingComplete = () => {
        console.log('handleBookingComplete called - user clicked Continue');
        // Remove any automatic delays/timers - user must manually finish
        setShowBookingDialog(false);
        clearFormData();
        // Navigate directly to shipments instead of using onNext prop
        console.log('Navigating to /shipments');
        navigate('/shipments');
    };

    // Fetch full rate details when selectedRateRef has a document ID
    useEffect(() => {
        const fetchFullRateDetails = async () => {
            if (selectedRateRef?.rateDocumentId) {
                try {
                    const rateDetails = await getRateDetailsByDocumentId(selectedRateRef.rateDocumentId);
                    if (rateDetails) {
                        setFullRateDetails(rateDetails);
                        console.log('Fetched full rate details:', rateDetails);
                    }
                } catch (error) {
                    console.error('Error fetching full rate details:', error);
                }
            } else if (selectedRate) {
                // Fallback to selectedRate for backward compatibility
                setFullRateDetails(selectedRate);
            } else {
                setFullRateDetails(null);
            }
        };

        fetchFullRateDetails();
    }, [selectedRateRef, selectedRate]);

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

                            {(selectedRateRef || selectedRate) ? (
                                <Paper sx={{ mb: 4 }}>
                                    <Box sx={{ p: 2, bgcolor: '#000000', color: 'white' }}>
                                        <Typography variant="h6">Rate Details</Typography>
                                    </Box>
                                    <Box sx={{ p: 3 }}>
                                        <Grid container spacing={3}>
                                            <Grid item xs={12} md={6}>
                                                <Typography variant="h5" gutterBottom>
                                                    {selectedRateRef?.carrier || selectedRate?.carrier}
                                                </Typography>
                                                <Chip
                                                    label={selectedRateRef?.service || selectedRate?.service}
                                                    color="primary"
                                                    sx={{ mb: 2 }}
                                                />
                                                <Typography variant="body2" color="text.secondary">
                                                    Transit Time: {selectedRateRef?.transitDays || selectedRate?.transitDays} days
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12} md={6}>
                                                <Box sx={{ textAlign: 'right' }}>
                                                    <Typography variant="h4" color="primary" gutterBottom>
                                                        ${(selectedRateRef?.totalCharges || selectedRate?.price || 0).toFixed(2)}
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
                                                    ${(fullRateDetails?.freightCharge || selectedRate?.originalRate?.freightCharges || 0).toFixed(2)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Fuel Surcharge
                                                </Typography>
                                                <Typography variant="body1">
                                                    ${(fullRateDetails?.fuelCharge || selectedRate?.originalRate?.fuelCharges || 0).toFixed(2)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Accessorial Charges
                                                </Typography>
                                                <Typography variant="body1">
                                                    ${(fullRateDetails?.accessorialCharges || selectedRate?.originalRate?.accessorialCharges || 0).toFixed(2)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Service Charges
                                                </Typography>
                                                <Typography variant="body1">
                                                    ${(fullRateDetails?.serviceCharges || selectedRate?.originalRate?.serviceCharges || 0).toFixed(2)}
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
                                        disabled={!selectedRateRef && !selectedRate}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: (!selectedRateRef && !selectedRate) ? '#cccccc' : '#1a237e',
                                            color: 'white',
                                            cursor: (!selectedRateRef && !selectedRate) ? 'not-allowed' : 'pointer',
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
                                        Are you sure you want to book this shipment with <strong>{selectedRateRef?.carrier || selectedRate?.carrier}</strong>?
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Total cost: <strong>${(selectedRateRef?.totalCharges || selectedRate?.price || 0).toFixed(2)}</strong>
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
                                                Booking shipment with {selectedRateRef?.carrier || selectedRate?.carrier}...
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
                                                    ${(selectedRate.originalRate?.freightCharges || 0).toFixed(2)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Fuel Surcharge
                                                </Typography>
                                                <Typography variant="body1">
                                                    ${(selectedRate.originalRate?.fuelCharges || 0).toFixed(2)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Accessorial Charges
                                                </Typography>
                                                <Typography variant="body1">
                                                    ${(selectedRate.originalRate?.accessorialCharges || 0).toFixed(2)}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Service Charges
                                                </Typography>
                                                <Typography variant="body1">
                                                    ${(selectedRate.originalRate?.serviceCharges || 0).toFixed(2)}
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
                                        Are you sure you want to book this shipment with <strong>{selectedRate?.carrier}</strong>?
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Total cost: <strong>${(selectedRate?.price || 0).toFixed(2)}</strong>
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