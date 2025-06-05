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
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase';
import { getMapsApiKey } from '../../utils/maps';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import { useNavigate } from 'react-router-dom';
import { getRateDetailsByDocumentId, formatRateReference } from '../../utils/rateUtils';

// Define libraries array as a static constant outside the component
const GOOGLE_MAPS_LIBRARIES = ["places", "geometry"];

// Function to recursively remove undefined values from objects
const removeUndefinedValues = (obj) => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(removeUndefinedValues).filter(item => item !== undefined);
    }

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            cleaned[key] = removeUndefinedValues(value);
        }
    }
    return cleaned;
};

// Function to save rate to Firebase
const saveRateToShipmentRates = async (rate, shipmentId, status = 'selected') => {
    try {
        let rateData;

        // Check if rate is in universal format
        if (rate.carrier && rate.pricing && rate.transit) {
            // Universal format - map to collection structure
            rateData = {
                shipmentId,
                rateId: rate.id,
                quoteId: rate.quoteId,

                // Carrier information
                carrier: rate.carrier.name,
                carrierId: rate.carrier.id,
                carrierScac: rate.carrier.scac,
                carrierKey: rate.carrier.key,

                // Service information
                service: rate.service.name,
                serviceCode: rate.service.code,
                serviceType: rate.service.type,
                serviceMode: rate.service.mode,

                // Pricing information
                totalCharges: rate.pricing.total,
                freightCharges: rate.pricing.freight,
                fuelCharges: rate.pricing.fuel,
                serviceCharges: rate.pricing.service,
                accessorialCharges: rate.pricing.accessorial,
                insuranceCharges: rate.pricing.insurance,
                taxCharges: rate.pricing.tax,
                discountAmount: rate.pricing.discount,
                guaranteeCharge: rate.pricing.guarantee,
                currency: rate.pricing.currency,

                // Transit information
                transitTime: rate.transit.days,
                transitDays: rate.transit.days,
                transitHours: rate.transit.hours,
                businessDays: rate.transit.businessDays,
                estimatedDeliveryDate: rate.transit.estimatedDelivery,
                guaranteed: rate.transit.guaranteed,

                // Weight and dimensions
                billedWeight: rate.weight.billed,
                ratedWeight: rate.weight.rated,
                actualWeight: rate.weight.actual,
                dimensionalWeight: rate.weight.dimensional,
                weightUnit: rate.weight.unit,

                length: rate.dimensions.length,
                width: rate.dimensions.width,
                height: rate.dimensions.height,
                cubicFeet: rate.dimensions.cubicFeet,
                dimensionUnit: rate.dimensions.unit,

                // Service features
                residential: rate.features.residential,
                liftgate: rate.features.liftgate,
                insideDelivery: rate.features.insideDelivery,
                appointmentDelivery: rate.features.appointmentDelivery,
                signatureRequired: rate.features.signatureRequired,
                hazmat: rate.features.hazmat,
                freezable: rate.features.freezable,

                // Additional data
                billingDetails: rate.pricing.breakdown,
                guaranteeOptions: rate.transit.guaranteeOptions,

                // Store the complete universal rate object
                universalRateData: rate,
                rawRateDetails: rate, // For booking function compatibility

                status: status,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
        } else {
            // Legacy format - maintain backward compatibility
            rateData = {
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
        }

        // Remove undefined values from the rateData object
        const cleanedRateData = removeUndefinedValues(rateData);

        // UNIFIED ID STRUCTURE: Use shipment ID as the rate document ID
        // Store in unified structure: shipments/{shipmentId}/rates/{shipmentId}
        const unifiedRateRef = doc(db, 'shipments', shipmentId, 'rates', shipmentId);
        await setDoc(unifiedRateRef, cleanedRateData);

        // UNIFIED ID STRUCTURE: Use shipment ID as the main collection document ID
        // Store in main collection using shipment ID as document ID
        const legacyRateRef = doc(db, 'shipmentRates', shipmentId);
        await setDoc(legacyRateRef, {
            ...cleanedRateData,
            unifiedRateId: shipmentId, // Reference to the unified structure
            migrationNote: 'Created with unified ID structure',
            _isUnifiedStructure: true // Flag to identify unified structure documents
        });

        console.log(`Rate saved with unified ID structure:`, {
            shipmentId,
            rateId: shipmentId, // Now using shipment ID as rate ID
            status,
            carrier: cleanedRateData.carrier,
            unifiedPath: `shipments/${shipmentId}/rates/${shipmentId}`,
            legacyPath: `shipmentRates/${shipmentId}`
        });

        return shipmentId; // Return the unified ID (same as shipment ID)
    } catch (error) {
        console.error('Error saving rate to unified structure:', error);
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
    const [bookingStep, setBookingStep] = useState('booking'); // 'booking', 'generating_label', or 'completed'
    const [shipmentId, setShipmentId] = useState('');
    const [isDraftSaving, setIsDraftSaving] = useState(false);
    const [draftSaveSuccess, setDraftSaveSuccess] = useState(false);
    // NEW: Canpar label generation states
    const [isGeneratingLabel, setIsGeneratingLabel] = useState(false);
    const [labelGenerationStatus, setLabelGenerationStatus] = useState('');

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

        // Check if we need to save the selected rate first
        let selectedRateDocumentId = formData.selectedRateDocumentId;

        if (!selectedRateDocumentId && formData.selectedRate) {
            console.log('selectedRateDocumentId is null but selectedRate exists. Saving rate to database first...');
            try {
                // Save the selected rate to the database first
                selectedRateDocumentId = await saveRateToShipmentRates(
                    formData.selectedRate,
                    docIdToProcess,
                    'selected_for_booking'
                );
                console.log('Rate saved to database with ID:', selectedRateDocumentId);
            } catch (saveError) {
                console.error('Error saving rate before booking:', saveError);
                setError('Failed to prepare rate for booking. Please try again.');
                setBookingStep('error');
                setIsLoading(false);
                return;
            }
        }

        if (!selectedRateDocumentId) {
            console.error('No selectedRateDocumentId available after attempting to save rate.');
            setError('No rate selected for booking. Please go back and select a rate.');
            setBookingStep('error');
            setIsLoading(false);
            return;
        }

        // Prepare the payload for the Firebase function
        const payload = {
            apiKey: "development-api-key",
            rateRequestData: formData.originalRateRequestData,
            draftFirestoreDocId: docIdToProcess,
            selectedRateDocumentId: selectedRateDocumentId
        };
        console.log('Payload for bookRateUniversal:', JSON.stringify(payload, null, 2));

        try {
            const functionsInstance = getFunctions();
            const bookFunction = httpsCallable(functionsInstance, 'bookRateUniversal');
            console.log('Calling bookRateUniversal Firebase function...');
            const result = await bookFunction(payload);
            console.log('Firebase function bookRateUniversal raw result:', result);

            if (result.data && result.data.success && result.data.data) {
                const bookingDetails = result.data.data;
                console.log('Successfully booked shipment:', bookingDetails);

                // Fetch the shipment document to get the actual shipmentID
                try {
                    const shipmentDocRef = doc(db, 'shipments', docIdToProcess);
                    const shipmentDoc = await getDoc(shipmentDocRef);

                    if (shipmentDoc.exists()) {
                        const shipmentData = shipmentDoc.data();
                        const actualShipmentId = shipmentData.shipmentID || docIdToProcess;
                        console.log('Fetched shipment ID from document:', actualShipmentId);
                        setShipmentId(actualShipmentId);
                    } else {
                        console.warn('Shipment document not found, using fallback ID');
                        setShipmentId(docIdToProcess);
                    }
                } catch (error) {
                    console.error('Error fetching shipment document for ID:', error);
                    // Fallback to the document ID if fetch fails
                    setShipmentId(docIdToProcess);
                }

                setError(null); // Clear previous errors

                // NEW: Check if this is a Canpar booking and generate label
                const carrierName = fullRateDetails?.carrier?.name ||
                    fullRateDetails?.carrier ||
                    selectedRate?.carrier?.name ||
                    selectedRate?.carrier ||
                    '';

                console.log('Detected carrier:', carrierName);

                if (carrierName && carrierName.toLowerCase().includes('canpar')) {
                    console.log('Canpar booking detected, preparing to generate label...');

                    // Extract Canpar shipment ID from booking response
                    const canparShipmentId = bookingDetails.shipmentId ||
                        bookingDetails.id ||
                        bookingDetails.trackingNumber;

                    if (canparShipmentId) {
                        console.log('Canpar shipment ID:', canparShipmentId);
                        // Generate label after successful booking
                        generateCanparLabel(canparShipmentId, docIdToProcess, carrierName);
                    } else {
                        console.warn('No Canpar shipment ID found in booking response');
                        setBookingStep('completed'); // Move to completed without label generation
                    }
                } else if (carrierName && (carrierName.toLowerCase().includes('polaris') || carrierName.toLowerCase().includes('polaristransportation'))) {
                    console.log('Polaris Transportation booking detected, preparing to generate BOL...');

                    // Extract Polaris shipment ID from booking response (Order_Number)
                    const polarisOrderNumber = bookingDetails.orderNumber ||
                        bookingDetails.confirmationNumber ||
                        bookingDetails.shipmentId ||
                        bookingDetails.id;

                    if (polarisOrderNumber) {
                        console.log('Polaris order number:', polarisOrderNumber);
                        // Generate BOL after successful booking
                        generatePolarisBOL(polarisOrderNumber, docIdToProcess, carrierName);
                    } else {
                        console.warn('No Polaris order number found in booking response');
                        setBookingStep('completed'); // Move to completed without BOL generation
                    }
                } else {
                    console.log('Non-Canpar/Non-Polaris booking, proceeding to completion');
                    setBookingStep('completed'); // Move to completed step in dialog for other carriers
                }

                // Optionally, call onNext to move to the next step in the main stepper
                if (onNext) {
                    // We might want to pass some confirmation data to the next step
                    // onNext({ bookingConfirmation: bookingDetails }); 
                }

            } else {
                const errorMessage = result.data?.data?.messages?.map(m => m.text).join('; ') || result.data?.error || 'Failed to book shipment. Unknown error from function.';
                console.error('Error from bookRateUniversal function:', errorMessage, result.data);
                setError(errorMessage);
                setBookingStep('error');
            }
        } catch (error) {
            console.error('Error calling bookRateUniversal or processing its response:', error);
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

    // NEW: Generate Canpar labels after booking
    const generateCanparLabel = async (canparShipmentId, docIdToProcess, carrierName) => {
        console.log('generateCanparLabel called with shipmentId:', canparShipmentId);
        setIsGeneratingLabel(true);
        setLabelGenerationStatus('Preparing to generate label...');
        setBookingStep('generating_label');

        try {
            // Wait 3 seconds as required by Canpar
            console.log('Waiting 3 seconds before generating label...');
            setLabelGenerationStatus('Waiting for shipment to be ready...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            setLabelGenerationStatus('Generating shipping label...');
            console.log('Calling generateCanparLabel Firebase function...');

            const functionsInstance = getFunctions();
            const generateLabelFunction = httpsCallable(functionsInstance, 'generateCanparLabel');

            const payload = {
                shipmentId: canparShipmentId,
                firebaseDocId: docIdToProcess,
                carrier: carrierName,
                thermalFormat: true // Always use thermal format for Canpar labels
            };

            console.log('Label generation payload:', payload);
            const result = await generateLabelFunction(payload);
            console.log('Label generation result:', result);

            if (result.data && result.data.success) {
                console.log('Label generated successfully:', result.data);
                setLabelGenerationStatus('Shipping label generated successfully!');
                setBookingStep('completed');
            } else {
                const errorMessage = result.data?.error || 'Failed to generate label';
                console.error('Label generation failed:', errorMessage);
                setLabelGenerationStatus(`Label generation failed: ${errorMessage}`);
                // Still move to completed step but show warning
                setBookingStep('completed');
            }
        } catch (error) {
            console.error('Error generating Canpar label:', error);
            setLabelGenerationStatus(`Error generating label: ${error.message}`);
            // Still move to completed step but show error
            setBookingStep('completed');
        } finally {
            setIsGeneratingLabel(false);
        }
    };

    // NEW: Generate Polaris Transportation BOL after booking
    const generatePolarisBOL = async (polarisOrderNumber, docIdToProcess, carrierName) => {
        console.log('generatePolarisBOL called with order number:', polarisOrderNumber);
        setIsGeneratingLabel(true);
        setLabelGenerationStatus('Preparing to generate BOL...');
        setBookingStep('generating_label');

        try {
            setLabelGenerationStatus('Generating Bill of Lading...');
            console.log('Calling generatePolarisTransportationBOL Firebase function...');

            const functionsInstance = getFunctions();
            const generateBOLFunction = httpsCallable(functionsInstance, 'generatePolarisTransportationBOL');

            const payload = {
                shipmentId: polarisOrderNumber,
                firebaseDocId: docIdToProcess,
                carrier: carrierName
            };

            console.log('BOL generation payload:', payload);
            const result = await generateBOLFunction(payload);
            console.log('BOL generation result:', result);

            if (result.data && result.data.success) {
                console.log('BOL generated successfully:', result.data);
                setLabelGenerationStatus('Bill of Lading generated successfully!');
                setBookingStep('completed');
            } else {
                const errorMessage = result.data?.error || 'Failed to generate BOL';
                console.error('BOL generation failed:', errorMessage);
                setLabelGenerationStatus(`BOL generation failed: ${errorMessage}`);
                // Still move to completed step but show warning
                setBookingStep('completed');
            }
        } catch (error) {
            console.error('Error generating Polaris BOL:', error);
            setLabelGenerationStatus(`Error generating BOL: ${error.message}`);
            // Still move to completed step but show error
            setBookingStep('completed');
        } finally {
            setIsGeneratingLabel(false);
        }
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
                                                                {shipmentInfo.shipperReferenceNumber || 'N/A'}
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
                                                                label={shipFrom.country && shipTo.country && shipFrom.country !== shipTo.country ? "Yes" : "No"}
                                                                color={shipFrom.country && shipTo.country && shipFrom.country !== shipTo.country ? "primary" : "default"}
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
                                                                label={formData.shipmentInfo?.signatureRequired ? "Yes" : "No"}
                                                                color={formData.shipmentInfo?.signatureRequired ? "primary" : "default"}
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
                                                        {/* Handle both universal and legacy formats */}
                                                        {fullRateDetails?.carrier?.name ||
                                                            fullRateDetails?.carrier ||
                                                            formData.selectedRate?.carrier?.name ||
                                                            formData.selectedRate?.carrierName ||
                                                            formData.selectedRate?.carrier || 'N/A'}
                                                    </Typography>
                                                    <Chip
                                                        label={fullRateDetails?.service?.name ||
                                                            fullRateDetails?.service ||
                                                            formData.selectedRate?.service?.name ||
                                                            formData.selectedRate?.serviceType ||
                                                            formData.selectedRate?.service || 'N/A'}
                                                        color="primary"
                                                        sx={{ mb: 2 }}
                                                    />
                                                    <Typography variant="body2" color="text.secondary">
                                                        Transit Time: {fullRateDetails?.transit?.days ??
                                                            fullRateDetails?.transitDays ??
                                                            (formData.selectedRate?.transit?.days ??
                                                                formData.selectedRate?.transitTime ??
                                                                formData.selectedRate?.transitDays)} days
                                                    </Typography>
                                                    {(fullRateDetails?.transit?.guaranteed ||
                                                        fullRateDetails?.guaranteed ||
                                                        formData.selectedRate?.transit?.guaranteed ||
                                                        formData.selectedRate?.guaranteed) &&
                                                        <Chip label="Guaranteed" color="success" size="small" sx={{ ml: 1 }} />
                                                    }
                                                </Grid>
                                                <Grid item xs={12} md={6}>
                                                    <Box sx={{ textAlign: 'right' }}>
                                                        <Typography variant="h4" color="primary" gutterBottom>
                                                            ${(fullRateDetails?.pricing?.total ??
                                                                fullRateDetails?.totalCharges ??
                                                                formData.selectedRate?.pricing?.total ??
                                                                formData.selectedRate?.totalCharges ??
                                                                formData.selectedRate?.price ?? 0).toFixed(2)}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Currency: {fullRateDetails?.pricing?.currency ||
                                                                fullRateDetails?.currency ||
                                                                formData.selectedRate?.pricing?.currency ||
                                                                formData.selectedRate?.currency || 'USD'}
                                                        </Typography>
                                                        {(fullRateDetails?.transit?.estimatedDelivery ||
                                                            fullRateDetails?.estimatedDeliveryDate ||
                                                            formData.selectedRate?.transit?.estimatedDelivery ||
                                                            formData.selectedRate?.estimatedDeliveryDate) ? (
                                                            <Typography variant="body2" color="text.secondary">
                                                                Est. Delivery: {fullRateDetails?.transit?.estimatedDelivery ||
                                                                    fullRateDetails?.estimatedDeliveryDate ||
                                                                    formData.selectedRate?.transit?.estimatedDelivery ||
                                                                    formData.selectedRate?.estimatedDeliveryDate}
                                                            </Typography>
                                                        ) : null}
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                            {/* Detailed breakdown - unified approach for all carriers */}
                                            {(() => {
                                                // Helper function to safely get a numeric value
                                                const safeNumber = (value) => {
                                                    const num = parseFloat(value);
                                                    return isNaN(num) ? 0 : num;
                                                };

                                                // Try to build breakdown from enhanced billing details first (Canpar style)
                                                if (fullRateDetails?.billingDetails && Array.isArray(fullRateDetails.billingDetails) && fullRateDetails.billingDetails.length > 0) {
                                                    const validDetails = fullRateDetails.billingDetails.filter(detail =>
                                                        detail &&
                                                        detail.name &&
                                                        (detail.amount !== undefined && detail.amount !== null)
                                                    );

                                                    if (validDetails.length > 0) {
                                                        return (
                                                            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #eee' }}>
                                                                <Typography variant="subtitle1" gutterBottom>Rate Breakdown:</Typography>
                                                                <Grid container spacing={1}>
                                                                    {validDetails.map((detail, index) => (
                                                                        <Grid item xs={6} sm={3} key={index}>
                                                                            <Typography variant="body2">
                                                                                {detail.name}: ${safeNumber(detail.amount).toFixed(2)}
                                                                            </Typography>
                                                                        </Grid>
                                                                    ))}
                                                                </Grid>
                                                            </Box>
                                                        );
                                                    }
                                                }

                                                // Fallback to standard breakdown (eShipPlus and other carriers)
                                                const breakdownItems = [];

                                                // Check for freight charges
                                                const freight = safeNumber(fullRateDetails?.pricing?.freight || fullRateDetails?.freightCharge || fullRateDetails?.freightCharges);
                                                if (freight > 0) {
                                                    breakdownItems.push({ name: 'Freight', amount: freight });
                                                }

                                                // Check for fuel charges
                                                const fuel = safeNumber(fullRateDetails?.pricing?.fuel || fullRateDetails?.fuelCharge || fullRateDetails?.fuelCharges);
                                                if (fuel > 0) {
                                                    breakdownItems.push({ name: 'Fuel', amount: fuel });
                                                }

                                                // Check for accessorial charges
                                                const accessorial = safeNumber(fullRateDetails?.pricing?.accessorial || fullRateDetails?.accessorialCharges);
                                                if (accessorial > 0) {
                                                    breakdownItems.push({ name: 'Accessorials', amount: accessorial });
                                                }

                                                // Check for service charges
                                                const service = safeNumber(fullRateDetails?.pricing?.service || fullRateDetails?.serviceCharges);
                                                if (service > 0) {
                                                    breakdownItems.push({ name: 'Service', amount: service });
                                                }

                                                // Check for tax charges
                                                const tax = safeNumber(fullRateDetails?.pricing?.tax || fullRateDetails?.taxCharges);
                                                if (tax > 0) {
                                                    breakdownItems.push({ name: 'Tax', amount: tax });
                                                }

                                                // Check for insurance charges
                                                const insurance = safeNumber(fullRateDetails?.pricing?.insurance || fullRateDetails?.insuranceCharges);
                                                if (insurance > 0) {
                                                    breakdownItems.push({ name: 'Insurance', amount: insurance });
                                                }

                                                if (breakdownItems.length > 0) {
                                                    return (
                                                        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #eee' }}>
                                                            <Typography variant="subtitle1" gutterBottom>Rate Breakdown:</Typography>
                                                            <Grid container spacing={1}>
                                                                {breakdownItems.map((item, index) => (
                                                                    <Grid item xs={6} sm={3} key={index}>
                                                                        <Typography variant="body2">
                                                                            {item.name}: ${item.amount.toFixed(2)}
                                                                        </Typography>
                                                                    </Grid>
                                                                ))}
                                                            </Grid>
                                                        </Box>
                                                    );
                                                }

                                                // No breakdown available
                                                return null;
                                            })()}
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
                                        Are you sure you want to book this shipment with <strong>
                                            {fullRateDetails?.carrier?.name ||
                                                fullRateDetails?.carrier ||
                                                selectedRate?.carrier?.name ||
                                                selectedRate?.carrier || 'N/A'}
                                        </strong>?
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Total cost: <strong>
                                            ${((fullRateDetails?.pricing?.total ??
                                                fullRateDetails?.totalCharges ??
                                                selectedRate?.pricing?.total ??
                                                selectedRate?.totalCharges ??
                                                selectedRate?.price) || 0).toFixed(2)}
                                        </strong>
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
                                                Booking shipment with {selectedRate?.carrier?.name || selectedRate?.carrier || 'carrier'}...
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Please wait while we process your shipment booking.
                                            </Typography>
                                        </>
                                    ) : bookingStep === 'generating_label' ? (
                                        <>
                                            <CircularProgress size={60} sx={{ mb: 3, color: '#1a237e' }} />
                                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                                {labelGenerationStatus.includes('BOL') || labelGenerationStatus.includes('Bill of Lading')
                                                    ? 'Generating Bill of Lading...'
                                                    : 'Generating Shipping Label...'
                                                }
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                {labelGenerationStatus}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                This may take a few moments.
                                            </Typography>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircleIcon sx={{ fontSize: 80, color: '#4caf50', mb: 2 }} />
                                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                                Shipment Booked Successfully!
                                            </Typography>
                                            <Typography variant="body1" sx={{ mb: 1 }}>
                                                Shipment ID:
                                            </Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1a237e', mb: 2 }}>
                                                {shipmentId}
                                            </Typography>
                                            {/* Show document generation status if applicable */}
                                            {labelGenerationStatus && (
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                    Document Status: {labelGenerationStatus}
                                                </Typography>
                                            )}
                                            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
                                                <Button
                                                    onClick={handleBookingComplete}
                                                    variant="outlined"
                                                    size="large"
                                                    sx={{ minWidth: 160 }}
                                                >
                                                    Return to Shipments
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        setShowBookingDialog(false);
                                                        clearFormData();
                                                        navigate(`/shipment/${shipmentId}`, { replace: true });
                                                    }}
                                                    variant="contained"
                                                    size="large"
                                                    sx={{ minWidth: 160, bgcolor: '#1a237e' }}
                                                >
                                                    View Shipment
                                                </Button>
                                            </Box>
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
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CircularProgress />
                    <Typography variant="body2" sx={{ mt: 2 }}>
                        Loading Google Maps API...
                    </Typography>
                </Box>
            )}
        </Container>
    );
};

export default Review; 