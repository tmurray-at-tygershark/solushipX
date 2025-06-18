import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import {
    Box,
    Typography,
    Paper,
    Chip,
    useTheme,
    CircularProgress,
    Grid,
    Container,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs, setDoc, getDoc, query, where, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase';
import { getMapsApiKey } from '../../utils/maps';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useNavigate } from 'react-router-dom';
import { getRateDetailsByDocumentId, formatRateReference } from '../../utils/rateUtils';



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

// Modular component for action buttons
const ActionButton = ({
    onClick,
    disabled = false,
    variant = 'primary',
    children,
    icon: Icon,
    loading = false
}) => {
    const getButtonStyles = () => {
        const baseStyles = {
            padding: '12px 24px',
            borderRadius: '8px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: 'none'
        };

        switch (variant) {
            case 'secondary':
                return {
                    ...baseStyles,
                    border: '2px solid #1a237e',
                    background: 'transparent',
                    color: '#1a237e'
                };
            case 'draft':
                return {
                    ...baseStyles,
                    border: '2px solid #666',
                    background: disabled ? '#4caf50' : 'transparent',
                    color: disabled ? 'white' : '#666'
                };
            default: // primary
                return {
                    ...baseStyles,
                    background: disabled ? '#cccccc' : '#1a237e',
                    color: 'white'
                };
        }
    };

    return (
        <motion.button
            whileHover={{ scale: disabled ? 1 : 1.02 }}
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            onClick={onClick}
            type="button"
            disabled={disabled}
            style={getButtonStyles()}
        >
            {loading ? (
                <CircularProgress size={20} color="inherit" />
            ) : Icon ? (
                <Icon sx={{ fontSize: 20 }} />
            ) : null}
            {children}
        </motion.button>
    );
};

const Review = ({ onPrevious, onNext, activeDraftId, onReturnToShipments, isModal = false, onClose = null }) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const { formData, clearFormData } = useShipmentForm();
    const { companyIdForAddress } = useCompany();
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
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);

    // Map dialog states - matching ShipmentDetailX pattern
    const [openMap, setOpenMap] = useState(null);
    const [geocodedPosition, setGeocodedPosition] = useState(null);
    const [geocodingLoading, setGeocodingLoading] = useState(false);
    const [directions, setDirections] = useState(null);

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

    // State for carrier logo
    const [carrierLogoUrl, setCarrierLogoUrl] = useState(null);

    // Google Maps initialization effect - EXACT copy from ShipmentDetailX
    useEffect(() => {
        const initializeMaps = async () => {
            try {
                setMapError(null);

                // Always fetch API key from Firestore (needed for Routes API v2)
                const keysRef = collection(db, 'keys');
                const keysSnapshot = await getDocs(keysRef);

                if (!keysSnapshot.empty) {
                    const firstDoc = keysSnapshot.docs[0];
                    const key = firstDoc.data().googleAPI;
                    if (!key) {
                        throw new Error('No API key found in Firestore');
                    }
                    setMapsApiKey(key);
                } else {
                    throw new Error('API key document not found in Firestore');
                }

                // Check if Google Maps is already loaded globally (from Globe component)
                if (window.google && window.google.maps) {
                    console.log('Google Maps already loaded globally');
                    setIsGoogleMapsLoaded(true);
                } else {
                    // If not loaded, we still have the API key for when it loads
                    const checkGoogleMaps = () => {
                        if (window.google && window.google.maps) {
                            setIsGoogleMapsLoaded(true);
                        } else {
                            setTimeout(checkGoogleMaps, 100);
                        }
                    };
                    checkGoogleMaps();
                }
            } catch (error) {
                console.error('Error initializing Maps:', error);
                setMapError('Failed to load Google Maps. Please try refreshing the page.');
                setIsGoogleMapsLoaded(false);
            }
        };

        initializeMaps();
    }, []);

    const handleGoogleMapsLoaded = useCallback(() => {
        console.log('Google Maps API loaded');
        // Add a longer delay to ensure the API is fully available
        setTimeout(() => {
            if (window.google && window.google.maps && window.google.maps.Geocoder) {
                setIsGoogleMapsLoaded(true);
                console.log('Google Maps API confirmed ready');
            } else {
                console.error('Google Maps API loaded but not accessible');
                setMapError('Google Maps API failed to initialize properly');
            }
        }, 500); // Increased delay
    }, []);

    useEffect(() => {
        const geocodeAddress = async (address, type) => {
            return new Promise((resolve, reject) => {
                // Enhanced safety check with multiple retries
                const attemptGeocode = (retryCount = 0) => {
                    if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
                        if (retryCount < 3) {
                            console.log(`Google Maps API not ready, retrying in ${(retryCount + 1) * 500}ms...`);
                            setTimeout(() => attemptGeocode(retryCount + 1), (retryCount + 1) * 500);
                            return;
                        }
                        reject(new Error('Google Maps API not fully loaded after retries'));
                        return;
                    }

                    try {
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
                    } catch (error) {
                        console.error(`Error creating geocoder for ${type}:`, error);
                        reject(error);
                    }
                };

                attemptGeocode();
            });
        };

        const updateGeocodedAddresses = async () => {
            // Enhanced dependency check
            if (!isGoogleMapsLoaded || !formData.shipFrom || !formData.shipTo) {
                console.log('Waiting for dependencies:', {
                    isGoogleMapsLoaded,
                    hasShipFrom: !!formData.shipFrom,
                    hasShipTo: !!formData.shipTo,
                    hasGoogleMaps: !!(window.google && window.google.maps && window.google.maps.Geocoder)
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
                setMapError('Failed to geocode addresses. Maps will show default locations.');
            }
        };

        // Add a longer delay to ensure everything is ready
        const timeoutId = setTimeout(() => {
            updateGeocodedAddresses();
        }, 1000); // Increased delay

        return () => clearTimeout(timeoutId);
    }, [formData.shipFrom, formData.shipTo, isGoogleMapsLoaded]);

    useEffect(() => {
        let interval;
        if (isLoading) {
            interval = setInterval(() => {
                setLoadingDots(prev => prev.length >= 3 ? '' : prev + '.');
            }, 500);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

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

            // Handle navigation based on modal/non-modal context
            setTimeout(() => {
                clearFormData();

                // Use the callback if provided (modal mode), otherwise navigate directly
                if (isModal && onReturnToShipments) {
                    console.log('Modal mode: Using onReturnToShipments callback for draft save navigation');
                    onReturnToShipments();
                } else if (isModal && onClose) {
                    console.log('Modal mode: Using onClose callback to close modal after draft save');
                    onClose();

                    // Add a small delay and then trigger the shipments modal to open
                    setTimeout(() => {
                        // Dispatch a custom event that the Dashboard can listen for
                        window.dispatchEvent(new CustomEvent('openShipmentsModal'));
                    }, 300);
                } else {
                    console.log('Non-modal mode: Navigating directly to /shipments after draft save');
                    navigate('/shipments', { replace: true });
                }
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

                // Extract shipment ID from booking response or use multiple fallback strategies
                let finalShipmentId = null;

                // First, try to get the shipment ID from the booking response
                if (bookingDetails) {
                    finalShipmentId = bookingDetails.shipmentId ||
                        bookingDetails.trackingNumber ||
                        bookingDetails.confirmationNumber ||
                        bookingDetails.orderNumber ||
                        bookingDetails.id;
                    console.log('Extracted shipment ID from booking response:', finalShipmentId);
                }

                // If no ID from booking response, fetch from the shipment document
                if (!finalShipmentId) {
                    try {
                        // Add a small delay to ensure the database has been updated
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        const shipmentDocRef = doc(db, 'shipments', docIdToProcess);
                        const shipmentDoc = await getDoc(shipmentDocRef);

                        if (shipmentDoc.exists()) {
                            const shipmentData = shipmentDoc.data();
                            finalShipmentId = shipmentData.shipmentID ||
                                shipmentData.trackingNumber ||
                                shipmentData.confirmationNumber ||
                                docIdToProcess;
                            console.log('Fetched shipment ID from document:', finalShipmentId);
                        } else {
                            console.warn('Shipment document not found, using document ID as fallback');
                            finalShipmentId = docIdToProcess;
                        }
                    } catch (error) {
                        console.error('Error fetching shipment document for ID:', error);
                        // Fallback to the document ID if fetch fails
                        finalShipmentId = docIdToProcess;
                    }
                }

                // Set the final shipment ID
                console.log('Final shipment ID to display:', finalShipmentId);
                setShipmentId(finalShipmentId);

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
        console.log('handleBookingComplete called - user clicked Return to Shipments');

        // Close the booking dialog first
        setShowBookingDialog(false);
        clearFormData();

        // Use the callback if provided (modal mode), otherwise navigate directly
        if (isModal && onReturnToShipments) {
            console.log('Modal mode: Using onReturnToShipments callback for modal state management');
            onReturnToShipments();
        } else if (isModal && onClose) {
            console.log('Modal mode: Using onClose callback to close modal');
            onClose();

            // Add a small delay and then trigger the shipments modal to open
            // This mimics the Dashboard's handleReturnToShipmentsFromCreateShipment pattern
            setTimeout(() => {
                // Dispatch a custom event that the Dashboard can listen for
                window.dispatchEvent(new CustomEvent('openShipmentsModal'));
            }, 300);
        } else {
            console.log('Non-modal mode: Navigating directly to /shipments');
            navigate('/shipments', { replace: true });
        }
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

    // Function to fetch carrier logo from database
    const fetchCarrierLogo = async (carrierName) => {
        if (!carrierName) return null;

        try {
            // Map carrier display names to database carrierID values
            const carrierNameToIdMap = {
                'canpar express': 'CANPAR',
                'canpar': 'CANPAR',
                'eship plus': 'ESHIPPLUS',
                'eshipplus': 'ESHIPPLUS',
                'polaris transportation': 'POLARISTRANSPORTATION',
                'polaris': 'POLARISTRANSPORTATION',
                'fedex': 'FEDEX',
                'ups': 'UPS',
                'purolator': 'PUROLATOR',
                'dhl': 'DHL'
            };

            // Normalize carrier name and map to carrierID
            const normalizedCarrierName = carrierName.toLowerCase().trim();
            const carrierID = carrierNameToIdMap[normalizedCarrierName] || carrierName.toUpperCase();

            console.log('Review - Mapping carrier name to ID:', { carrierName, normalizedCarrierName, carrierID });

            // Query carriers collection by carrierID field
            const carriersQuery = query(
                collection(db, 'carriers'),
                where('carrierID', '==', carrierID),
                limit(1)
            );

            const carriersSnapshot = await getDocs(carriersQuery);

            if (!carriersSnapshot.empty) {
                const carrierDoc = carriersSnapshot.docs[0];
                const carrierData = carrierDoc.data();
                const logoURL = carrierData.logoURL;

                console.log('Review - Fetched carrier logo from database:', { carrierName, carrierID, logoURL });
                return logoURL || '/images/carrier-badges/solushipx.png';
            } else {
                console.log('Review - Carrier not found in database:', { carrierName, carrierID });
                return '/images/carrier-badges/solushipx.png';
            }
        } catch (error) {
            console.error('Review - Error fetching carrier logo:', error);
            return '/images/carrier-badges/solushipx.png';
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

    // Fetch carrier logo when rate details change
    useEffect(() => {
        const fetchLogo = async () => {
            const carrierName = fullRateDetails?.carrier?.name ||
                fullRateDetails?.carrier ||
                formData.selectedRate?.carrier?.name ||
                formData.selectedRate?.carrierName ||
                formData.selectedRate?.carrier;

            if (carrierName) {
                const logoUrl = await fetchCarrierLogo(carrierName);
                setCarrierLogoUrl(logoUrl);
            } else {
                setCarrierLogoUrl(null);
            }
        };

        fetchLogo();
    }, [fullRateDetails, formData.selectedRate]);

    const { shipmentInfo = {}, shipFrom = {}, shipTo = {}, packages = [] } = formData;

    // Helper functions - EXACT copy from ShipmentDetailX
    const getAddress = (formData, type) => {
        if (!type) return null;
        return formData?.[type] || formData?.[type.toLowerCase()] || null;
    };

    // Route calculation useEffect - EXACT copy from ShipmentDetailX
    useEffect(() => {
        if (!openMap || !formData.shipFrom || !formData.shipTo || !isGoogleMapsLoaded) return;
        setGeocodedPosition(null);
        setDirections(null);
        setMapError(null);
        setGeocodingLoading(true);

        if (openMap === 'route') {
            // Complete route calculation using Routes API v2 - EXACT copy from ShipmentDetailX
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

                    const fromAddress = getAddress(formData, 'shipFrom');
                    const toAddress = getAddress(formData, 'shipTo');

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
            // Handle single location geocoding - EXACT copy from ShipmentDetailX
            const address = getAddress(formData, openMap);
            if (!address) {
                setMapError('No address available');
                setGeocodingLoading(false);
                return;
            }

            const geocoder = new window.google.maps.Geocoder();
            const formatAddressForGeocode = (address) => {
                if (!address) return 'N/A';
                const parts = [];
                if (address.company) parts.push(address.company);
                if (address.street) parts.push(address.street);
                if (address.street2) parts.push(address.street2);
                if (address.city && address.state) {
                    parts.push(`${address.city}, ${address.state} ${address.postalCode || ''}`);
                }
                if (address.country) parts.push(address.country);
                return parts.join(', ') || 'N/A';
            };
            const addressString = formatAddressForGeocode(address).replace(/\n/g, ', ');

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
    }, [openMap, formData.shipFrom, formData.shipTo, isGoogleMapsLoaded, mapsApiKey]);

    return (
        <Box sx={{ width: '100%', p: 3 }}>
            {/* Google Maps is handled globally, render content directly */}
            <>
                {!isModal && (
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
                            Review Shipment Details
                        </Typography>
                    </Box>
                )}

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
                )}

                {mapError && (
                    <Alert severity="warning" sx={{ mb: 3 }}>{mapError}</Alert>
                )}

                {/* Live Shipment Notice Callout */}
                <Box sx={{
                    mb: 4,
                    p: 3,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
                    border: '1px solid #3b82f6',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Background Pattern */}
                    <Box sx={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '100%',
                        height: '100%',
                        background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                        opacity: 0.3
                    }} />

                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        position: 'relative',
                        zIndex: 1
                    }}>
                        {/* Left Side - Notice */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                            {/* Warning Icon */}
                            <Box sx={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                bgcolor: 'rgba(255, 255, 255, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Box component="span" sx={{ fontSize: '24px' }}>⚡</Box>
                            </Box>

                            {/* Notice Text */}
                            <Box>
                                <Typography variant="h6" sx={{
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '18px',
                                    mb: 0.5
                                }}>
                                    Live Shipment Notice
                                </Typography>
                                <Typography variant="body2" sx={{
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '14px',
                                    lineHeight: 1.4
                                }}>
                                    Booking this shipment is live and will activate all downstream processes you have chosen for this shipment
                                </Typography>
                            </Box>
                        </Box>

                        {/* Right Side - Book Shipment Button */}
                        <Box sx={{ ml: 3 }}>
                            <Button
                                onClick={handleBookShipment}
                                disabled={!selectedRate}
                                variant="contained"
                                size="large"
                                startIcon={<CheckCircleIcon />}
                                sx={{
                                    bgcolor: 'white !important',
                                    color: '#1e3a8a !important',
                                    fontWeight: '600 !important',
                                    fontSize: '16px !important',
                                    px: 4,
                                    py: 1.5,
                                    borderRadius: '8px !important',
                                    textTransform: 'none !important',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15) !important',
                                    border: '2px solid transparent !important',
                                    transition: 'all 0.3s ease !important',
                                    minWidth: '160px !important',
                                    height: '48px !important',
                                    fontFamily: 'inherit !important',
                                    letterSpacing: 'normal !important',
                                    lineHeight: '1.5 !important',
                                    '&:hover': {
                                        bgcolor: '#f8fafc !important',
                                        color: '#1e3a8a !important',
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2) !important',
                                        border: '2px solid rgba(255, 255, 255, 0.3) !important'
                                    },
                                    '&:disabled': {
                                        bgcolor: 'white !important',
                                        color: '#94a3b8 !important',
                                        boxShadow: 'none !important',
                                        transform: 'none !important'
                                    },
                                    '&.MuiButton-contained': {
                                        bgcolor: 'white !important',
                                        color: '#1e3a8a !important',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15) !important'
                                    },
                                    '&.MuiButton-containedPrimary': {
                                        bgcolor: 'white !important',
                                        color: '#1e3a8a !important'
                                    },
                                    '&.MuiButton-sizeLarge': {
                                        fontSize: '16px !important',
                                        px: 4,
                                        py: 1.5,
                                        minWidth: '160px !important',
                                        height: '48px !important'
                                    },
                                    // Ensure icon styling is consistent
                                    '& .MuiButton-startIcon': {
                                        color: '#1e3a8a !important',
                                        fontSize: '20px !important',
                                        marginRight: '8px !important'
                                    },
                                    '& .MuiSvgIcon-root': {
                                        color: '#1e3a8a !important',
                                        fontSize: '20px !important'
                                    }
                                }}
                            >
                                Book Shipment
                            </Button>
                        </Box>
                    </Box>
                </Box>

                {/* Shipment Information Section - Matching ShipmentDetailX three-column design */}
                <Grid item xs={12} sx={{ mb: 3 }}>
                    <Grid container spacing={3}>
                        {/* Basic Information */}
                        <Grid item xs={12} md={4}>
                            <Box sx={{
                                p: 2,
                                bgcolor: 'background.default',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                height: '100%'
                            }}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                                    Basic Information
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Company ID</Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                            {companyIdForAddress || 'IC'}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Customer ID</Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                            {formData.shipTo?.customerID || 'N/A'}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Shipment Type</Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                            {shipmentInfo.shipmentType || 'N/A'}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Shipper Reference</Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                            {shipmentInfo.shipperReferenceNumber || 'N/A'}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Bill Type</Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px', textTransform: 'capitalize' }}>
                                            {shipmentInfo.billType || 'Prepaid'}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </Grid>

                        {/* Timing Information */}
                        <Grid item xs={12} md={4}>
                            <Box sx={{
                                p: 2,
                                bgcolor: 'background.default',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                height: '100%'
                            }}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                                    Timing Information
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Created At</Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                            {(() => {
                                                // Get current date and time for created at
                                                const now = new Date();
                                                return now.toLocaleDateString('en-US', {
                                                    month: 'numeric',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                }) + ', ' + now.toLocaleTimeString('en-US', {
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                    second: '2-digit',
                                                    hour12: true
                                                });
                                            })()}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Shipment Date</Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                            {(() => {
                                                if (shipmentInfo.shipmentDate) {
                                                    try {
                                                        const date = new Date(shipmentInfo.shipmentDate);
                                                        return date.toLocaleDateString('en-US', {
                                                            month: 'numeric',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        });
                                                    } catch (error) {
                                                        return shipmentInfo.shipmentDate;
                                                    }
                                                }
                                                return 'N/A';
                                            })()}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Estimated Delivery</Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Box component="span" sx={{ fontSize: '14px' }}>🕐</Box>
                                            {(() => {
                                                const deliveryDate = fullRateDetails?.transit?.estimatedDelivery ||
                                                    fullRateDetails?.estimatedDeliveryDate ||
                                                    formData.selectedRate?.transit?.estimatedDelivery ||
                                                    formData.selectedRate?.estimatedDeliveryDate;

                                                if (deliveryDate) {
                                                    try {
                                                        const date = deliveryDate.toDate ? deliveryDate.toDate() : new Date(deliveryDate);
                                                        return date.toLocaleDateString('en-US', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        });
                                                    } catch (error) {
                                                        console.error('Error formatting delivery date:', error);
                                                        return 'Invalid Date';
                                                    }
                                                }
                                                return 'N/A';
                                            })()}
                                        </Typography>
                                    </Box>
                                    {/* Pickup Window - Hidden but data preserved */}
                                    <Box sx={{ display: 'none' }}>
                                        <Typography variant="caption" color="text.secondary">Pickup Window</Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                            {(() => {
                                                const earliest = shipmentInfo.earliestPickup || '9:00';
                                                const latest = shipmentInfo.latestPickup || '17:00';

                                                // Convert to 12-hour format
                                                const formatTime = (time) => {
                                                    if (!time) return '';
                                                    const [hours, minutes] = time.split(':');
                                                    const hour = parseInt(hours);
                                                    const ampm = hour >= 12 ? 'PM' : 'AM';
                                                    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                                    return `${displayHour}:${minutes || '00'} ${ampm}`;
                                                };

                                                return `${formatTime(earliest)} - ${formatTime(latest)}`;
                                            })()}
                                        </Typography>
                                    </Box>
                                    {/* Dropoff Window - Hidden but data preserved */}
                                    <Box sx={{ display: 'none' }}>
                                        <Typography variant="caption" color="text.secondary">Dropoff Window</Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                            {(() => {
                                                const earliest = shipmentInfo.earliestDelivery || '9:00';
                                                const latest = shipmentInfo.latestDelivery || '17:00';

                                                // Convert to 12-hour format
                                                const formatTime = (time) => {
                                                    if (!time) return '';
                                                    const [hours, minutes] = time.split(':');
                                                    const hour = parseInt(hours);
                                                    const ampm = hour >= 12 ? 'PM' : 'AM';
                                                    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                                    return `${displayHour}:${minutes || '00'} ${ampm}`;
                                                };

                                                return `${formatTime(earliest)} - ${formatTime(latest)}`;
                                            })()}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </Grid>

                        {/* Locations - Matching ShipmentDetailX exact layout */}
                        <Grid item xs={12} md={4}>
                            <Box sx={{
                                p: 2,
                                bgcolor: 'background.default',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                height: '100%'
                            }}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                                    Locations
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {/* Ship From */}
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Ship From</Typography>
                                        <Box
                                            sx={{
                                                mt: 0.5,
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    '& .MuiTypography-root': {
                                                        textDecoration: 'underline'
                                                    }
                                                }
                                            }}
                                            onClick={() => setOpenMap('shipFrom')}
                                        >
                                            {(() => {
                                                const address = shipFrom;
                                                if (!address) return <Typography variant="body2" sx={{ fontSize: '12px' }}>N/A</Typography>;

                                                return (
                                                    <>
                                                        {address.company && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.3, color: 'primary.main' }}>
                                                                {address.company}
                                                            </Typography>
                                                        )}
                                                        {address.street && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.3, color: 'primary.main' }}>
                                                                {address.street}
                                                            </Typography>
                                                        )}
                                                        {address.street2 && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.3, color: 'primary.main' }}>
                                                                {address.street2}
                                                            </Typography>
                                                        )}
                                                        {(address.city || address.state) && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.3, color: 'primary.main' }}>
                                                                {address.city}{address.city && address.state ? ', ' : ''}{address.state}
                                                            </Typography>
                                                        )}
                                                        {(address.postalCode || address.country) && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.3, color: 'primary.main' }}>
                                                                {address.postalCode} {address.country}
                                                            </Typography>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </Box>
                                    </Box>

                                    {/* Ship To */}
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Ship To</Typography>
                                        <Box
                                            sx={{
                                                mt: 0.5,
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    '& .MuiTypography-root': {
                                                        textDecoration: 'underline'
                                                    }
                                                }
                                            }}
                                            onClick={() => setOpenMap('shipTo')}
                                        >
                                            {(() => {
                                                const address = shipTo;
                                                if (!address) return <Typography variant="body2" sx={{ fontSize: '12px' }}>N/A</Typography>;

                                                return (
                                                    <>
                                                        {address.company && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.3, color: 'primary.main' }}>
                                                                {address.company}
                                                            </Typography>
                                                        )}
                                                        {address.street && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.3, color: 'primary.main' }}>
                                                                {address.street}
                                                            </Typography>
                                                        )}
                                                        {address.street2 && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.3, color: 'primary.main' }}>
                                                                {address.street2}
                                                            </Typography>
                                                        )}
                                                        {(address.city || address.state) && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.3, color: 'primary.main' }}>
                                                                {address.city}{address.city && address.state ? ', ' : ''}{address.state}
                                                            </Typography>
                                                        )}
                                                        {(address.postalCode || address.country) && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', lineHeight: 1.3, color: 'primary.main' }}>
                                                                {address.postalCode} {address.country}
                                                            </Typography>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </Box>
                                    </Box>

                                    {/* View Route Button - Matching ShipmentDetailX exactly */}
                                    <Box>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            size="small"
                                            onClick={() => setOpenMap('route')}
                                            startIcon={
                                                <svg className="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium" focusable="false" aria-hidden="true" viewBox="0 0 24 24" style={{ width: '20px', height: '20px', fill: 'white' }}>
                                                    <path d="M19 15.18V7c0-2.21-1.79-4-4-4s-4 1.79-4 4v10c0 1.1-.9 2-2 2s-2-.9-2-2V8.82C8.16 8.4 9 7.3 9 6c0-1.66-1.34-3-3-3S3 4.34 3 6c0 1.3.84 2.4 2 2.82V17c0 2.21 1.79 4 4 4s4-1.79 4-4V7c0-1.1.9-2 2-2s2 .9 2 2v8.18c-1.16.41-2 1.51-2 2.82 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.3-.84-2.4-2-2.82"></path>
                                                </svg>
                                            }
                                            sx={{
                                                textTransform: 'none',
                                                fontSize: '12px',
                                                width: '50%'
                                            }}
                                        >
                                            View Route
                                        </Button>
                                    </Box>
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>
                </Grid>

                {/* Rate Details Section - Exact copy from ShipmentDetailX */}
                {(formData.selectedRateDocumentId || formData.selectedRate) ? (
                    <Grid item xs={12} sx={{ mb: 1 }}>
                        <Paper>
                            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#000', fontSize: '16px' }}>
                                    Rate Details
                                </Typography>
                            </Box>
                            <Box sx={{ p: 2 }}>
                                <Grid container spacing={3}>
                                    {/* Left Column - Service Details */}
                                    <Grid item xs={12} md={4}>
                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                            <Box>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Carrier & Service
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                        <Typography
                                                            variant="body1"
                                                            sx={{
                                                                fontSize: '12px',
                                                                fontWeight: 500
                                                            }}
                                                        >
                                                            {fullRateDetails?.carrier?.name ||
                                                                fullRateDetails?.carrier ||
                                                                formData.selectedRate?.carrier?.name ||
                                                                formData.selectedRate?.carrierName ||
                                                                formData.selectedRate?.carrier || 'N/A'}
                                                            {((fullRateDetails?.displayCarrierId === 'ESHIPPLUS' || fullRateDetails?.sourceCarrierName === 'eShipPlus') ||
                                                                (formData.selectedRate?.displayCarrierId === 'ESHIPPLUS' || formData.selectedRate?.sourceCarrierName === 'eShipPlus')) && (
                                                                    <Typography component="span" sx={{ fontSize: '10px', color: 'text.secondary', ml: 0.5 }}>
                                                                        (via eShip Plus)
                                                                    </Typography>
                                                                )}
                                                        </Typography>
                                                    </Box>
                                                    {(fullRateDetails?.service?.name ||
                                                        fullRateDetails?.service ||
                                                        formData.selectedRate?.service?.name ||
                                                        formData.selectedRate?.serviceType ||
                                                        formData.selectedRate?.service) && (
                                                            <>
                                                                <Typography variant="body2" color="text.secondary">-</Typography>
                                                                <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '12px' }}>
                                                                    {fullRateDetails?.service?.name ||
                                                                        fullRateDetails?.service ||
                                                                        formData.selectedRate?.service?.name ||
                                                                        formData.selectedRate?.serviceType ||
                                                                        formData.selectedRate?.service}
                                                                </Typography>
                                                            </>
                                                        )}
                                                </Box>
                                            </Box>
                                            <Box>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Transit Time
                                                </Typography>
                                                <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                    {(fullRateDetails?.transit?.days ??
                                                        fullRateDetails?.transitDays ??
                                                        (formData.selectedRate?.transit?.days ??
                                                            formData.selectedRate?.transitTime ??
                                                            formData.selectedRate?.transitDays)) || 0} {(((fullRateDetails?.transit?.days ??
                                                                fullRateDetails?.transitDays ??
                                                                (formData.selectedRate?.transit?.days ??
                                                                    formData.selectedRate?.transitTime ??
                                                                    formData.selectedRate?.transitDays)) || 0) === 1) ? 'day' : 'days'}
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Estimated Delivery Date
                                                </Typography>
                                                <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                    {(() => {
                                                        const deliveryDate = fullRateDetails?.transit?.estimatedDelivery ||
                                                            fullRateDetails?.estimatedDeliveryDate ||
                                                            formData.selectedRate?.transit?.estimatedDelivery ||
                                                            formData.selectedRate?.estimatedDeliveryDate;

                                                        if (deliveryDate) {
                                                            try {
                                                                const date = deliveryDate.toDate ? deliveryDate.toDate() : new Date(deliveryDate);
                                                                return date.toLocaleDateString('en-US', {
                                                                    weekday: 'short',
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                });
                                                            } catch (error) {
                                                                console.error('Error formatting delivery date:', error);
                                                                return 'Invalid Date';
                                                            }
                                                        }
                                                        return 'N/A';
                                                    })()}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Grid>

                                    {/* Middle Column - Charges */}
                                    <Grid item xs={12} md={4}>
                                        {(() => {
                                            const safeNumber = (value) => {
                                                return isNaN(parseFloat(value)) ? 0 : parseFloat(value);
                                            };

                                            if (fullRateDetails?.billingDetails && Array.isArray(fullRateDetails.billingDetails) && fullRateDetails.billingDetails.length > 0) {
                                                const validDetails = fullRateDetails.billingDetails.filter(detail =>
                                                    detail &&
                                                    detail.name &&
                                                    (detail.amount !== undefined && detail.amount !== null)
                                                );

                                                if (validDetails.length > 0) {
                                                    return (
                                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                                            {validDetails.map((detail, index) => (
                                                                <Box key={index}>
                                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                        {detail.name}
                                                                    </Typography>
                                                                    <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                                        ${safeNumber(detail.amount).toFixed(2)}
                                                                    </Typography>
                                                                </Box>
                                                            ))}
                                                        </Box>
                                                    );
                                                }
                                            }

                                            const breakdownItems = [];
                                            const freight = safeNumber(fullRateDetails?.pricing?.freight || fullRateDetails?.freightCharge || fullRateDetails?.freightCharges);
                                            if (freight > 0) {
                                                breakdownItems.push({ name: 'Freight Charges', amount: freight });
                                            }

                                            const fuel = safeNumber(fullRateDetails?.pricing?.fuel || fullRateDetails?.fuelCharge || fullRateDetails?.fuelCharges);
                                            if (fuel > 0) {
                                                breakdownItems.push({ name: 'Fuel Charges', amount: fuel });
                                            }

                                            const service = safeNumber(fullRateDetails?.pricing?.service || fullRateDetails?.serviceCharges);
                                            if (service > 0) {
                                                breakdownItems.push({ name: 'Service Charges', amount: service });
                                            }

                                            const accessorial = safeNumber(fullRateDetails?.pricing?.accessorial || fullRateDetails?.accessorialCharges);
                                            if (accessorial > 0) {
                                                breakdownItems.push({ name: 'Accessorial Charges', amount: accessorial });
                                            }

                                            if (fullRateDetails?.guaranteed || formData.selectedRate?.guaranteed) {
                                                const guarantee = safeNumber(fullRateDetails?.pricing?.guarantee || fullRateDetails?.guaranteeCharge);
                                                if (guarantee > 0) {
                                                    breakdownItems.push({ name: 'Guarantee Charge', amount: guarantee });
                                                }
                                            }

                                            if (breakdownItems.length > 0) {
                                                return (
                                                    <Box sx={{ display: 'grid', gap: 2 }}>
                                                        {breakdownItems.map((item, index) => (
                                                            <Box key={index}>
                                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                    {item.name}
                                                                </Typography>
                                                                <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                                    ${item.amount.toFixed(2)}
                                                                </Typography>
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                );
                                            }

                                            return (
                                                <Box sx={{ display: 'grid', gap: 2 }}>
                                                    <Box>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                            Freight Charges
                                                        </Typography>
                                                        <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                            ${(fullRateDetails?.pricing?.freight ||
                                                                fullRateDetails?.freightCharge ||
                                                                fullRateDetails?.freightCharges || 0).toFixed(2)}
                                                        </Typography>
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                            Fuel Charges
                                                        </Typography>
                                                        <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                            ${(fullRateDetails?.pricing?.fuel ||
                                                                fullRateDetails?.fuelCharge ||
                                                                fullRateDetails?.fuelCharges || 0).toFixed(2)}
                                                        </Typography>
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                            Service Charges
                                                        </Typography>
                                                        <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                            ${(fullRateDetails?.pricing?.service ||
                                                                fullRateDetails?.serviceCharges || 0).toFixed(2)}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            );
                                        })()}
                                    </Grid>

                                    {/* Right Column - Total */}
                                    <Grid item xs={12} md={4}>
                                        <Paper
                                            elevation={0}
                                            sx={{
                                                p: 2,
                                                borderRadius: 2,
                                                border: '1px solid #e0e0e0',
                                                bgcolor: 'background.default',
                                                height: '100%',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {/* Carrier Icon */}
                                            {carrierLogoUrl && (
                                                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                                                    <img
                                                        src={carrierLogoUrl}
                                                        alt="Carrier logo"
                                                        style={{
                                                            height: '32px',
                                                            maxWidth: '80px',
                                                            objectFit: 'contain'
                                                        }}
                                                        onError={(e) => {
                                                            console.log('Review - Logo failed to load:', carrierLogoUrl);
                                                            e.target.style.display = 'none';
                                                        }}
                                                        onLoad={() => {
                                                            console.log('Review - Logo loaded successfully:', carrierLogoUrl);
                                                        }}
                                                    />
                                                </Box>
                                            )}

                                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, textAlign: 'center' }}>
                                                Total Charges
                                            </Typography>
                                            <Typography variant="h4" sx={{ fontWeight: 700, color: '#000', textAlign: 'center' }}>
                                                ${(fullRateDetails?.pricing?.total ??
                                                    fullRateDetails?.totalCharges ??
                                                    formData.selectedRate?.pricing?.total ??
                                                    formData.selectedRate?.totalCharges ??
                                                    formData.selectedRate?.price ?? 0).toFixed(2)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontSize: '12px' }}>
                                                {fullRateDetails?.pricing?.currency ||
                                                    fullRateDetails?.currency ||
                                                    formData.selectedRate?.pricing?.currency ||
                                                    formData.selectedRate?.currency || 'USD'}
                                            </Typography>
                                        </Paper>
                                    </Grid>
                                </Grid>

                                {/* Additional Services Section - Updated to match ShipmentInfo field names */}
                                {(() => {
                                    const additionalServices = [];

                                    // Check for delivery/pickup options (from ShipmentInfo deliveryPickupOption field)
                                    if (formData.shipmentInfo?.deliveryPickupOption) {
                                        const option = formData.shipmentInfo.deliveryPickupOption;
                                        if (option === 'residential') {
                                            additionalServices.push('Residential Delivery');
                                        } else if (option === 'holdForPickup') {
                                            additionalServices.push('Hold for Pickup');
                                        }
                                    }

                                    // Check for hazardous goods (from ShipmentInfo hazardousGoods field)
                                    if (formData.shipmentInfo?.hazardousGoods && formData.shipmentInfo.hazardousGoods !== '') {
                                        const hazardType = formData.shipmentInfo.hazardousGoods;
                                        if (hazardType === 'limited_quantity') {
                                            additionalServices.push('Hazardous Materials (Limited Quantity)');
                                        } else if (hazardType === '500kg_exemption') {
                                            additionalServices.push('Hazardous Materials (500kg Exemption)');
                                        } else if (hazardType === 'fully_regulated') {
                                            additionalServices.push('Hazardous Materials (Fully Regulated)');
                                        }
                                    }

                                    // Check for priority delivery (from ShipmentInfo priorityDelivery field)
                                    if (formData.shipmentInfo?.priorityDelivery && formData.shipmentInfo.priorityDelivery !== '') {
                                        const priority = formData.shipmentInfo.priorityDelivery;
                                        if (priority === '10am') {
                                            additionalServices.push('10AM Delivery');
                                        } else if (priority === 'noon') {
                                            additionalServices.push('Noon Delivery');
                                        } else if (priority === 'saturday') {
                                            additionalServices.push('Saturday Delivery');
                                        }
                                    }

                                    // Check for signature options (from ShipmentInfo signatureOptions field)
                                    if (formData.shipmentInfo?.signatureOptions && formData.shipmentInfo.signatureOptions !== '') {
                                        const signature = formData.shipmentInfo.signatureOptions;
                                        if (signature === 'standard') {
                                            additionalServices.push('Signature Required');
                                        } else if (signature === 'adult') {
                                            additionalServices.push('Adult Signature Required');
                                        }
                                    }

                                    // Check for international shipment
                                    if (formData.shipmentInfo?.internationalShipment) {
                                        additionalServices.push('International Shipment');
                                    } else if (formData.shipFrom?.country && formData.shipTo?.country) {
                                        const originCountry = formData.shipFrom.country;
                                        const destinationCountry = formData.shipTo.country;
                                        if (originCountry !== destinationCountry) {
                                            additionalServices.push('International Shipment');
                                        }
                                    }

                                    // Check for guaranteed service
                                    if (fullRateDetails?.guaranteed || formData.selectedRate?.guaranteed) {
                                        additionalServices.push('Guaranteed Service');
                                    }

                                    // Check for insurance/declared value
                                    if (formData.packages && formData.packages.length > 0) {
                                        const totalDeclaredValue = formData.packages.reduce((total, pkg) => {
                                            return total + (parseFloat(pkg.declaredValue) || 0);
                                        }, 0);
                                        if (totalDeclaredValue > 0) {
                                            additionalServices.push(`Insurance Coverage ($${totalDeclaredValue.toFixed(2)})`);
                                        }
                                    }

                                    // Check for special delivery times - Hidden but data preserved
                                    // if (formData.shipmentInfo?.earliestDelivery && formData.shipmentInfo?.latestDelivery) {
                                    //     const earliestTime = formData.shipmentInfo.earliestDelivery;
                                    //     const latestTime = formData.shipmentInfo.latestDelivery;
                                    //     if (earliestTime !== '09:00' || latestTime !== '17:00') {
                                    //         additionalServices.push(`Delivery Window (${earliestTime} - ${latestTime})`);
                                    //     }
                                    // }

                                    // Check for special pickup times - Hidden but data preserved
                                    // if (formData.shipmentInfo?.earliestPickup && formData.shipmentInfo?.latestPickup) {
                                    //     const earliestTime = formData.shipmentInfo.earliestPickup;
                                    //     const latestTime = formData.shipmentInfo.latestPickup;
                                    //     if (earliestTime !== '09:00' || latestTime !== '17:00') {
                                    //         additionalServices.push(`Pickup Window (${earliestTime} - ${latestTime})`);
                                    //     }
                                    // }

                                    return additionalServices.length > 0 ? (
                                        <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid #e0e0e0' }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>
                                                Additional Services
                                            </Typography>
                                            <Box component="ul" sx={{
                                                margin: 0,
                                                paddingLeft: 2,
                                                '& li': {
                                                    fontSize: '12px',
                                                    marginBottom: 0.5,
                                                    color: 'text.primary'
                                                }
                                            }}>
                                                {additionalServices.map((service, index) => (
                                                    <li key={index}>{service}</li>
                                                ))}
                                            </Box>
                                        </Box>
                                    ) : null;
                                })()}
                            </Box>
                        </Paper>
                    </Grid>
                ) : (
                    <Grid item xs={12} sx={{ mb: 1 }}>
                        <Paper>
                            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#000', fontSize: '16px' }}>
                                    Rate Details
                                </Typography>
                            </Box>
                            <Box sx={{ p: 3, textAlign: 'center' }}>
                                <Typography variant="h6" color="error" sx={{ fontSize: '16px' }}>
                                    No rate selected. Please go back and select a rate.
                                </Typography>
                            </Box>
                        </Paper>
                    </Grid>
                )}

                {/* Package Details - Exact copy from ShipmentDetailX */}
                {(() => {
                    const processedPackages = packages.map((pkg, index) => ({
                        id: pkg.id || index,
                        index: index + 1,
                        description: pkg.description || pkg.itemDescription || 'N/A',
                        quantity: pkg.quantity || pkg.packagingQuantity || 1,
                        weight: pkg.weight || 0,
                        dimensions: pkg.dimensions ?
                            `${pkg.dimensions.length || 0}" × ${pkg.dimensions.width || 0}" × ${pkg.dimensions.height || 0}"` :
                            (pkg.length && pkg.width && pkg.height ?
                                `${pkg.length}" × ${pkg.width}" × ${pkg.height}"` : 'N/A'),
                        freightClass: pkg.freightClass || null,
                        value: pkg.value || pkg.declaredValue || 0,
                        packagingType: pkg.packagingType || null
                    }));

                    const formatQuantity = (quantity) => {
                        const qty = parseInt(quantity) || 1;
                        return `${qty} ${qty > 1 ? 'pcs' : 'pc'}`;
                    };

                    const formatWeight = (weight) => {
                        const weightNum = parseFloat(weight) || 0;
                        return weightNum > 0 ? `${weightNum} lbs` : 'N/A';
                    };

                    const formatValue = (value) => {
                        const valueNum = parseFloat(value) || 0;
                        return `$${valueNum.toFixed(2)}`;
                    };

                    const getFreightClassColor = (freightClass) => {
                        if (!freightClass) return 'default';
                        const classNum = parseInt(freightClass);
                        if (classNum >= 500) return 'error';
                        if (classNum >= 300) return 'warning';
                        if (classNum >= 150) return 'info';
                        return 'success';
                    };

                    const totals = processedPackages.reduce((acc, pkg) => ({
                        totalQuantity: acc.totalQuantity + (parseInt(pkg.quantity) || 0),
                        totalWeight: acc.totalWeight + (parseFloat(pkg.weight) || 0),
                        totalValue: acc.totalValue + (parseFloat(pkg.value) || 0)
                    }), { totalQuantity: 0, totalWeight: 0, totalValue: 0 });

                    if (processedPackages.length === 0) {
                        return (
                            <Grid item xs={12} sx={{ mb: 1 }}>
                                <Paper>
                                    <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#000', fontSize: '16px', whiteSpace: 'nowrap' }}>
                                                Packages
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Box sx={{ p: 3, textAlign: 'center' }}>
                                        <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                                            No packages found
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Grid>
                        );
                    }

                    return (
                        <Grid item xs={12} sx={{ mb: 1 }}>
                            <Paper>
                                {/* Header */}
                                <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#000', fontSize: '16px', whiteSpace: 'nowrap' }}>
                                                Packages ({processedPackages.length})
                                            </Typography>
                                        </Box>
                                        {/* Summary chips */}
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
                                            <Chip
                                                label={`${totals.totalQuantity} items`}
                                                size="small"
                                                variant="outlined"
                                                sx={{ fontSize: '11px', height: '24px' }}
                                            />
                                            <Chip
                                                label={`${totals.totalWeight.toFixed(1)} lbs`}
                                                size="small"
                                                variant="outlined"
                                                sx={{ fontSize: '11px', height: '24px' }}
                                            />
                                            <Chip
                                                label={formatValue(totals.totalValue)}
                                                size="small"
                                                variant="outlined"
                                                sx={{ fontSize: '11px', height: '24px' }}
                                            />
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Table Content */}
                                <Box sx={{ p: 0 }}>
                                    <TableContainer>
                                        <Table size="small" sx={{ minWidth: 650 }}>
                                            <TableHead>
                                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151' }}>#</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151' }}>Description</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151', textAlign: 'center' }}>Qty</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151', textAlign: 'right' }}>Weight</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151', textAlign: 'center' }}>Dimensions</TableCell>
                                                    {/* Only show Class column for freight shipments */}
                                                    {formData.shipmentInfo?.shipmentType === 'freight' && (
                                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151', textAlign: 'center' }}>Class</TableCell>
                                                    )}
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151', textAlign: 'right' }}>Value</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {processedPackages.map((pkg) => (
                                                    <TableRow
                                                        key={pkg.id}
                                                        sx={{
                                                            '&:nth-of-type(odd)': { bgcolor: '#fafafa' },
                                                            '&:hover': { bgcolor: '#f5f5f5' },
                                                            transition: 'background-color 0.2s'
                                                        }}
                                                    >
                                                        <TableCell sx={{ fontSize: '12px', py: 1.5, fontWeight: 500 }}>
                                                            {pkg.index}
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '12px', py: 1.5, maxWidth: '200px' }}>
                                                            <Tooltip title={pkg.description} placement="top">
                                                                <Typography
                                                                    sx={{
                                                                        fontSize: '12px',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                >
                                                                    {pkg.description}
                                                                </Typography>
                                                            </Tooltip>
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '12px', py: 1.5, textAlign: 'center', fontWeight: 500 }}>
                                                            {formatQuantity(pkg.quantity)}
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '12px', py: 1.5, textAlign: 'right', fontWeight: 500 }}>
                                                            {formatWeight(pkg.weight)}
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '12px', py: 1.5, textAlign: 'center' }}>
                                                            <Typography sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                                                {pkg.dimensions}
                                                            </Typography>
                                                        </TableCell>
                                                        {/* Only show Class cell for freight shipments */}
                                                        {formData.shipmentInfo?.shipmentType === 'freight' && (
                                                            <TableCell sx={{ fontSize: '12px', py: 1.5, textAlign: 'center' }}>
                                                                {pkg.freightClass ? (
                                                                    <Chip
                                                                        label={pkg.freightClass}
                                                                        size="small"
                                                                        color={getFreightClassColor(pkg.freightClass)}
                                                                        sx={{ fontSize: '10px', height: '20px', minWidth: '40px' }}
                                                                    />
                                                                ) : (
                                                                    <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                                                                        N/A
                                                                    </Typography>
                                                                )}
                                                            </TableCell>
                                                        )}
                                                        <TableCell sx={{ fontSize: '12px', py: 1.5, textAlign: 'right', fontWeight: 500 }}>
                                                            {formatValue(pkg.value)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            </Paper>
                        </Grid>
                    );
                })()}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                    <ActionButton
                        onClick={onPrevious}
                        variant="secondary"
                    >
                        ← Previous
                    </ActionButton>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <ActionButton
                            onClick={saveDraft}
                            disabled={isDraftSaving || draftSaveSuccess}
                            variant="draft"
                            icon={isDraftSaving ? null : draftSaveSuccess ? CheckCircleIcon : SaveIcon}
                            loading={isDraftSaving}
                        >
                            {isDraftSaving ? 'Saving...' : draftSaveSuccess ? 'Saved!' : 'Save Draft'}
                        </ActionButton>

                        <ActionButton
                            onClick={handleBookShipment}
                            disabled={!selectedRate}
                            icon={CheckCircleIcon}
                        >
                            Book Shipment
                        </ActionButton>
                    </Box>
                </Box>

                {/* Confirmation Dialog */}
                <Dialog
                    open={showConfirmDialog}
                    onClose={() => setShowConfirmDialog(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle sx={{ textAlign: 'center', fontWeight: 600, fontSize: '18px' }}>
                        CONFIRM SHIPMENT BOOKING
                    </DialogTitle>
                    <DialogContent sx={{ textAlign: 'center', py: 3 }}>
                        <Typography variant="body1" sx={{ mb: 2, fontSize: '14px' }}>
                            Are you sure you want to book this shipment with <strong>
                                {fullRateDetails?.carrier?.name ||
                                    fullRateDetails?.carrier ||
                                    selectedRate?.carrier?.name ||
                                    selectedRate?.carrier || 'N/A'}
                            </strong>?
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
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
                            sx={{ minWidth: 100, fontSize: '14px' }}
                        >
                            NO
                        </Button>
                        <Button
                            onClick={handleConfirmBooking}
                            variant="contained"
                            size="large"
                            sx={{ minWidth: 100, bgcolor: '#1a237e', fontSize: '14px' }}
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
                        {bookingStep === 'booking' ? (
                            <>
                                <CircularProgress size={60} sx={{ mb: 3, color: '#1a237e' }} />
                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '16px' }}>
                                    Booking shipment with {selectedRate?.carrier?.name || selectedRate?.carrier || 'carrier'}...
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                    Please wait while we process your shipment booking.
                                </Typography>
                            </>
                        ) : bookingStep === 'generating_label' ? (
                            <>
                                <CircularProgress size={60} sx={{ mb: 3, color: '#1a237e' }} />
                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '16px' }}>
                                    {labelGenerationStatus.includes('BOL') || labelGenerationStatus.includes('Bill of Lading')
                                        ? 'Generating Bill of Lading...'
                                        : 'Generating Shipping Label...'
                                    }
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '12px' }}>
                                    {labelGenerationStatus}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                    This may take a few moments.
                                </Typography>
                            </>
                        ) : (
                            <>
                                <CheckCircleIcon sx={{ fontSize: 80, color: '#4caf50', mb: 2 }} />
                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '16px' }}>
                                    Shipment Booked Successfully!
                                </Typography>
                                <Typography variant="body1" sx={{ mb: 1, fontSize: '14px' }}>
                                    Shipment ID:
                                </Typography>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#1a237e', mb: 2, fontSize: '16px' }}>
                                    {shipmentId}
                                </Typography>
                                {/* Show document generation status if applicable */}
                                {labelGenerationStatus && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '12px' }}>
                                        Document Status: {labelGenerationStatus}
                                    </Typography>
                                )}
                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                    <Button
                                        onClick={handleBookingComplete}
                                        variant="contained"
                                        size="large"
                                        sx={{ minWidth: 200, bgcolor: '#1a237e', fontSize: '14px' }}
                                    >
                                        Return to Shipments
                                    </Button>
                                </Box>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Map Dialogs - Single dialog matching ShipmentDetailX */}
                <Dialog
                    open={!!openMap}
                    onClose={() => setOpenMap(null)}
                    maxWidth="lg"
                    fullWidth
                    PaperProps={{
                        sx: { height: '90vh', borderRadius: 2 }
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
                            <svg className="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium" focusable="false" aria-hidden="true" viewBox="0 0 24 24" style={{ width: '20px', height: '20px', color: '#1976d2' }}>
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path>
                            </svg>
                            <Typography variant="h6">
                                {openMap === 'route'
                                    ? `Route: ${(() => {
                                        const fromAddress = formData.shipFrom;
                                        const toAddress = formData.shipTo;
                                        const fromCity = fromAddress?.city || 'Unknown';
                                        const fromState = fromAddress?.state || '';
                                        const toCity = toAddress?.city || 'Unknown';
                                        const toState = toAddress?.state || '';

                                        const fromLocation = fromState ? `${fromCity}, ${fromState}` : fromCity;
                                        const toLocation = toState ? `${toCity}, ${toState}` : toCity;

                                        return `${fromLocation} → ${toLocation}`;
                                    })()}`
                                    : openMap === 'shipFrom'
                                        ? `Origin: ${(() => {
                                            const address = formData.shipFrom;
                                            if (!address) return 'N/A';
                                            const parts = [];
                                            if (address.company) parts.push(address.company);
                                            if (address.street) parts.push(address.street);
                                            if (address.street2) parts.push(address.street2);
                                            if (address.city && address.state) {
                                                parts.push(`${address.city}, ${address.state} ${address.postalCode || ''}`);
                                            }
                                            if (address.country) parts.push(address.country);
                                            return parts.join(', ') || 'N/A';
                                        })()}`
                                        : `Destination: ${(() => {
                                            const address = formData.shipTo;
                                            if (!address) return 'N/A';
                                            const parts = [];
                                            if (address.company) parts.push(address.company);
                                            if (address.street) parts.push(address.street);
                                            if (address.street2) parts.push(address.street2);
                                            if (address.city && address.state) {
                                                parts.push(`${address.city}, ${address.state} ${address.postalCode || ''}`);
                                            }
                                            if (address.country) parts.push(address.country);
                                            return parts.join(', ') || 'N/A';
                                        })()}`
                                }
                            </Typography>
                        </Box>
                        <Button onClick={() => setOpenMap(null)} sx={{ minWidth: 'auto', p: 1 }}>
                            ✕
                        </Button>
                    </DialogTitle>
                    <DialogContent sx={{ p: 0, height: '100%' }}>
                        {(() => {
                            // renderMap function - EXACT copy from ShipmentDetailX
                            const mapOptions = {
                                disableDefaultUI: false,
                                zoomControl: true,
                                streetViewControl: true,
                                mapTypeControl: false,
                                fullscreenControl: true,
                                maxZoom: 20,
                                minZoom: 5,
                                gestureHandling: 'greedy',
                                preserveViewport: false
                            };

                            if (!isGoogleMapsLoaded || geocodingLoading) {
                                return (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                        <CircularProgress />
                                    </Box>
                                );
                            }
                            if (mapError) {
                                return (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                        <Typography color="error">{mapError}</Typography>
                                    </Box>
                                );
                            }

                            // For route view
                            if (openMap === 'route') {
                                if (!directions) {
                                    return (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                            <Typography color="error">No route available</Typography>
                                        </Box>
                                    );
                                }
                                return (
                                    <Box sx={{ height: '100%', width: '100%' }}>
                                        <GoogleMap
                                            mapContainerStyle={{ width: '100%', height: '100%' }}
                                            center={directions.routes[0].bounds.getCenter()}
                                            zoom={6}
                                            options={mapOptions}
                                            onLoad={(map) => {
                                                // Fit bounds to show the entire route with appropriate padding
                                                map.fitBounds(directions.routes[0].bounds, {
                                                    padding: {
                                                        top: 50,
                                                        right: 50,
                                                        bottom: 50,
                                                        left: 50
                                                    }
                                                });
                                                // Let Google Maps determine the optimal zoom level to show the entire route
                                            }}
                                        >
                                            <DirectionsRenderer
                                                directions={directions}
                                                options={{
                                                    polylineOptions: {
                                                        strokeColor: '#2196f3',
                                                        strokeWeight: 5,
                                                        strokeOpacity: 0.8
                                                    },
                                                    suppressMarkers: true
                                                }}
                                            />
                                            {/* Custom green start marker */}
                                            <Marker
                                                position={directions.routes[0].legs[0].start_location}
                                                icon={{
                                                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                                        <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#4caf50" stroke="#ffffff" stroke-width="2"/>
                                                            <circle cx="12" cy="12" r="4" fill="#ffffff"/>
                                                        </svg>
                                                    `),
                                                    scaledSize: new window.google.maps.Size(24, 36),
                                                    anchor: new window.google.maps.Point(12, 36)
                                                }}
                                                title="Start Location"
                                            />
                                            {/* Custom red end marker */}
                                            <Marker
                                                position={directions.routes[0].legs[0].end_location}
                                                icon={{
                                                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                                        <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#f44336" stroke="#ffffff" stroke-width="2"/>
                                                            <circle cx="12" cy="12" r="4" fill="#ffffff"/>
                                                        </svg>
                                                    `),
                                                    scaledSize: new window.google.maps.Size(24, 36),
                                                    anchor: new window.google.maps.Point(12, 36)
                                                }}
                                                title="End Location"
                                            />
                                        </GoogleMap>
                                    </Box>
                                );
                            }

                            // For single location view
                            if (!geocodedPosition) {
                                return (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                        <Typography color="error">No address available</Typography>
                                    </Box>
                                );
                            }
                            return (
                                <Box sx={{ height: '100%', width: '100%' }}>
                                    <GoogleMap
                                        mapContainerStyle={{ width: '100%', height: '100%' }}
                                        center={geocodedPosition}
                                        zoom={15}
                                        options={mapOptions}
                                    >
                                        <Marker
                                            position={geocodedPosition}
                                            icon={{
                                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                                    <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="${openMap === 'shipFrom' ? '#4caf50' : '#f44336'}" stroke="#ffffff" stroke-width="2"/>
                                                        <circle cx="12" cy="12" r="4" fill="#ffffff"/>
                                                    </svg>
                                                `),
                                                scaledSize: new window.google.maps.Size(24, 36),
                                                anchor: new window.google.maps.Point(12, 36)
                                            }}
                                        />
                                    </GoogleMap>
                                </Box>
                            );
                        })()}
                    </DialogContent>
                </Dialog>
            </>
        </Box>
    );
};

export default Review; 