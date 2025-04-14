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
    Container
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
    CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { getMapsApiKey } from '../../utils/maps';

// Define libraries array as a static constant outside the component
const GOOGLE_MAPS_LIBRARIES = ["places", "geometry"];

// Function to save rate to Firebase
const saveRateToFirebase = async (rate, shipmentId) => {
    try {
        const rateData = {
            shipmentId,
            quoteId: rate.id,
            carrier: rate.carrier,
            service: rate.service,
            freightCharges: rate.freightCharges,
            fuelCharges: rate.fuelCharges,
            serviceCharges: rate.serviceCharges,
            accessorialCharges: rate.accessorialCharges || 0,
            guaranteeCharge: rate.guaranteeCharge || 0,
            totalCharges: rate.rate,
            currency: rate.currency,
            transitDays: rate.transitDays,
            deliveryDate: rate.deliveryDate,
            guaranteed: rate.guaranteed,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        const shipmentRatesRef = collection(db, 'shipmentRates');
        await addDoc(shipmentRatesRef, rateData);
        console.log('Rate saved to Firebase');
    } catch (error) {
        console.error('Error saving rate to Firebase:', error);
    }
};

const SimpleMap = React.memo(({ address, title }) => {
    const [position, setPosition] = useState(null);
    const [error, setError] = useState(null);
    const mapRef = useRef(null);

    useEffect(() => {
        if (!window.google || !window.google.maps) {
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

const Review = ({ formData, selectedRate: initialSelectedRate, onPrevious, onNext, onRateSelect }) => {
    const theme = useTheme();
    const [isLoading, setIsLoading] = useState(true);
    const [rates, setRates] = useState([]);
    const [filteredRates, setFilteredRates] = useState([]);
    const [error, setError] = useState(null);
    const [sortBy, setSortBy] = useState('price');
    const [serviceFilter, setServiceFilter] = useState('all');
    const [showRateDetails, setShowRateDetails] = useState(false);
    const [loadingDots, setLoadingDots] = useState('');
    const [ratesLoaded, setRatesLoaded] = useState(false);
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
    const [selectedRate, setSelectedRate] = useState(initialSelectedRate);
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);

    // Fetch Maps API key when component mounts
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

    // Wait for Maps API to load
    const handleGoogleMapsLoaded = useCallback(() => {
        console.log('Google Maps API loaded');
        setIsGoogleMapsLoaded(true);
    }, []);

    useEffect(() => {
        const geocodeAddress = async (address, type) => {
            return new Promise((resolve, reject) => {
                if (!window.google || !window.google.maps) {
                    reject(new Error('Google Maps API not loaded'));
                    return;
                }

                const geocoder = new window.google.maps.Geocoder();
                const addressString = `${address.street}${address.street2 ? ', ' + address.street2 : ''}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`;

                console.log(`Attempting to geocode ${type} address:`, addressString);

                geocoder.geocode(
                    {
                        address: addressString,
                        region: address.country?.toLowerCase() || 'us',
                        key: mapsApiKey // Include API key in the request
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
            if (!isGoogleMapsLoaded || !mapsApiKey || !formData.shipFrom || !formData.shipTo) {
                console.log('Waiting for dependencies:', {
                    isGoogleMapsLoaded,
                    hasMapsApiKey: !!mapsApiKey,
                    hasShipFrom: !!formData.shipFrom,
                    hasShipTo: !!formData.shipTo
                });
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

        updateGeocodedAddresses();
    }, [formData.shipFrom, formData.shipTo, isGoogleMapsLoaded, mapsApiKey]);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                setIsLoading(true);
                setError(null);
                setRatesLoaded(false);

                // Use a simple booking reference
                const bookingRef = "shipment 123";

                // Determine shipment bill type and booking reference type based on shipment type
                const shipmentType = formData.shipmentInfo.shipmentType || 'courier';
                const shipmentBillType = 'DefaultLogisticsPlus';
                const bookingReferenceNumberType = 'Shipment';

                const rateRequestData = {
                    bookingReferenceNumber: bookingRef,
                    bookingReferenceNumberType: bookingReferenceNumberType,
                    shipmentBillType: shipmentBillType,
                    shipmentDate: formData.shipmentInfo.shipmentDate || new Date().toISOString().split('T')[0],
                    pickupWindow: {
                        earliest: formData.shipmentInfo.earliestPickup || "09:00",
                        latest: formData.shipmentInfo.latestPickup || "17:00"
                    },
                    deliveryWindow: {
                        earliest: formData.shipmentInfo.earliestDelivery || "09:00",
                        latest: formData.shipmentInfo.latestDelivery || "17:00"
                    },
                    fromAddress: {
                        company: formData.shipFrom.company || "",
                        street: formData.shipFrom.street || "",
                        street2: formData.shipFrom.street2 || "",
                        postalCode: formData.shipFrom.postalCode || "",
                        city: formData.shipFrom.city || "",
                        state: formData.shipFrom.state || "",
                        country: formData.shipFrom.country || "US",
                        contactName: formData.shipFrom.contactName || "",
                        contactPhone: formData.shipFrom.contactPhone || "",
                        contactEmail: formData.shipFrom.contactEmail || "",
                        specialInstructions: formData.shipFrom.specialInstructions || ""
                    },
                    toAddress: {
                        company: formData.shipTo.company || "",
                        street: formData.shipTo.street || "",
                        street2: formData.shipTo.street2 || "",
                        postalCode: formData.shipTo.postalCode || "",
                        city: formData.shipTo.city || "",
                        state: formData.shipTo.state || "",
                        country: formData.shipTo.country || "US",
                        contactName: formData.shipTo.contactName || "",
                        contactPhone: formData.shipTo.contactPhone || "",
                        contactEmail: formData.shipTo.contactEmail || "",
                        specialInstructions: formData.shipTo.specialInstructions || ""
                    },
                    items: formData.packages.map(pkg => ({
                        name: pkg.description || "Package",
                        weight: parseFloat(pkg.weight) || 1,
                        length: parseInt(pkg.length) || 12,
                        width: parseInt(pkg.width) || 12,
                        height: parseInt(pkg.height) || 12,
                        quantity: parseInt(pkg.quantity) || 1,
                        freightClass: String(pkg.freightClass || "50"),
                        value: parseFloat(pkg.value || "0"),
                        stackable: pkg.stackable || false
                    }))
                };

                console.log('Rate Request Data:', rateRequestData);

                const response = await fetch('https://getshippingrates-xedyh5vw7a-uc.a.run.app/rates', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(rateRequestData)
                });

                const data = await response.json();

                // Process the response data
                if (data.success && data.data) {
                    // Add detailed logging
                    console.log('Response structure:', {
                        hasData: !!data.data,
                        dataKeys: Object.keys(data.data),
                        dataType: typeof data.data,
                        isString: typeof data.data === 'string',
                        isObject: typeof data.data === 'object'
                    });

                    try {
                        // The response is already parsed JSON from the backend
                        const rateData = data.data;
                        console.log('Rate Data:', rateData);

                        // Get available rates from the transformed response
                        const availableRates = rateData?.availableRates || [];

                        if (!availableRates || availableRates.length === 0) {
                            throw new Error('No rates available');
                        }

                        console.log('Available Rates:', availableRates);

                        const transformedRates = availableRates.map(rate => {
                            // Add detailed logging for debugging
                            console.log('Processing rate:', {
                                freightCharges: rate.freightCharges,
                                fuelCharges: rate.fuelCharges,
                                serviceCharges: rate.serviceCharges,
                                accessorialCharges: rate.accessorialCharges,
                                totalCharges: rate.totalCharges,
                                serviceMode: rate.serviceMode,
                                fullRate: rate
                            });

                            // Update validation to match actual data structure
                            if (!rate.carrierKey || !rate.carrierName || !rate.serviceMode || !rate.totalCharges) {
                                console.warn('Rate missing required fields:', rate);
                            }

                            return {
                                id: rate.QuoteId || rate.quoteId,
                                carrier: rate.CarrierName || rate.carrierName,
                                service: rate.ServiceMode || rate.serviceMode,
                                rate: parseFloat(rate.TotalCharges || rate.totalCharges),
                                freightCharges: parseFloat(rate.FreightCharges || rate.freightCharges || 0),
                                fuelCharges: parseFloat(rate.FuelCharges || rate.fuelCharges || 0),
                                serviceCharges: parseFloat(rate.ServiceCharges || rate.serviceCharges || 0),
                                accessorialCharges: parseFloat(rate.AccessorialCharges || rate.accessorialCharges || 0),
                                currency: rate.Currency || rate.currency || 'USD',
                                transitDays: parseInt(rate.TransitTime || rate.transitTime) || 0,
                                deliveryDate: (rate.EstimatedDeliveryDate || rate.estimatedDeliveryDate)?.split('T')[0] || '',
                                serviceLevel: rate.ServiceMode || rate.serviceMode,
                                guaranteed: rate.GuaranteedService || rate.guaranteedService || false,
                                guaranteeCharge: parseFloat(rate.GuaranteeCharge || rate.guaranteeCharge || 0),
                                express: (rate.ServiceMode || rate.serviceMode || '').toLowerCase().includes('express'),
                                surcharges: [
                                    {
                                        name: 'Freight Charges',
                                        amount: parseFloat(rate.freightCharges || 0),
                                        category: 'Freight'
                                    },
                                    {
                                        name: 'Fuel Charges',
                                        amount: parseFloat(rate.fuelCharges || 0),
                                        category: 'Fuel'
                                    },
                                    {
                                        name: 'Service Charges',
                                        amount: parseFloat(rate.serviceCharges || 0),
                                        category: 'Service'
                                    },
                                    ...(parseFloat(rate.accessorialCharges || 0) > 0 ? [{
                                        name: 'Accessorial Charges',
                                        amount: parseFloat(rate.accessorialCharges || 0),
                                        category: 'Accessorial'
                                    }] : []),
                                    ...((rate.accessorials || []).map(accessorial => ({
                                        name: accessorial.description || 'Additional Charge',
                                        amount: parseFloat(accessorial.amount || 0),
                                        category: accessorial.category || 'Service'
                                    })))
                                ]
                            };
                        });

                        // Save the selected rate to Firebase
                        // Function moved outside the component for better scope access

                        console.log('Transformed rates:', transformedRates);
                        setRates(transformedRates);
                        setFilteredRates(transformedRates);
                    } catch (err) {
                        console.error('Error parsing response:', err);
                        throw new Error('Failed to parse rate response: ' + err.message);
                    }
                } else {
                    throw new Error(data.error?.message || 'Failed to fetch rates');
                }
            } catch (err) {
                console.error('Error fetching rates:', err);
                setError(err.message);
            } finally {
                // Add a minimum delay before setting ratesLoaded
                await new Promise(resolve => setTimeout(resolve, 2000));
                setRatesLoaded(true);
                setIsLoading(false);
            }
        };

        fetchRates();
    }, [formData]);

    useEffect(() => {
        let filtered = [...rates];

        // Apply service filter
        if (serviceFilter !== 'all') {
            filtered = filtered.filter(rate => {
                switch (serviceFilter) {
                    case 'guaranteed':
                        return rate.guaranteed;
                    case 'economy':
                        return rate.service.toLowerCase().includes('economy') ||
                            rate.service.toLowerCase().includes('standard');
                    case 'express':
                        return rate.service.toLowerCase().includes('express') ||
                            rate.service.toLowerCase().includes('priority');
                    default:
                        return true;
                }
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'price':
                    return (a.rate || 0) - (b.rate || 0);
                case 'transit':
                    return (a.transitDays || 0) - (b.transitDays || 0);
                case 'carrier':
                    return (a.carrier || '').localeCompare(b.carrier || '');
                default:
                    return 0;
            }
        });

        setFilteredRates(filtered);
    }, [rates, sortBy, serviceFilter]);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRate) {
            alert('Please select a rate before proceeding');
            return;
        }

        try {
            const shipmentData = {
                ...formData,
                selectedRate,
                status: 'pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            const shipmentRef = await addDoc(collection(db, 'shipments'), shipmentData);
            const shipmentId = shipmentRef.id;

            // Update the shipment with the ID
            await updateDoc(doc(db, 'shipments', shipmentId), {
                shipmentId
            });

            onNext();
        } catch (error) {
            console.error('Error saving shipment:', error);
            alert('Failed to save shipment. Please try again.');
        }
    };

    const handleGuaranteeChange = (rate, checked) => {
        // Update the rate's guarantee option
        const updatedRate = {
            ...rate,
            guaranteeSelected: checked
        };
        // Update the rates list
        const updatedRates = rates.map(r =>
            r.id === rate.id ? updatedRate : r
        );
        setRates(updatedRates);
        setFilteredRates(updatedRates);
    };

    // Add effect for loading dots animation
    useEffect(() => {
        let interval;
        if (isLoading) {
            interval = setInterval(() => {
                setLoadingDots(prev => prev.length >= 3 ? '' : prev + '.');
            }, 500);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    const handleRateSelect = async (rate) => {
        try {
            if (selectedRate && selectedRate.id === rate.id) {
                // If clicking the same rate, deselect it
                onRateSelect(null);
            } else {
                // Select the new rate and save to Firebase
                onRateSelect(rate);

                // Save the rate to Firebase if we have a shipment ID
                if (formData.shipmentId) {
                    try {
                        const shipmentRef = doc(db, 'shipments', formData.shipmentId);
                        await updateDoc(shipmentRef, {
                            selectedRate: rate,
                            updatedAt: serverTimestamp()
                        });
                    } catch (error) {
                        console.error('Error saving rate to Firebase:', error);
                    }
                }

                // Automatically move to next step
                onNext();
            }
        } catch (error) {
            console.error('Error selecting rate:', error);
            setError('Failed to select rate. Please try again.');
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {mapsApiKey ? (
                <LoadScript
                    googleMapsApiKey={mapsApiKey}
                    libraries={GOOGLE_MAPS_LIBRARIES}
                    onLoad={handleGoogleMapsLoaded}
                >
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
                            Review Shipment Details
                        </Typography>
                    </Box>

                    {/* Shipment Information */}
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
                                    {/* Basic Information Card */}
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
                                                        {formData.shipmentInfo?.shipmentType || 'N/A'}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        Reference Number
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {formData.shipmentInfo?.referenceNumber || 'N/A'}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        Bill Type
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {formData.shipmentInfo?.billType || 'Prepaid'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Paper>
                                    </Grid>

                                    {/* Timing Information Card */}
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
                                                        {formData.shipmentInfo?.shipmentDate || 'N/A'}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        Pickup Window
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {formData.shipmentInfo?.earliestPickup || '09:00'} - {formData.shipmentInfo?.latestPickup || '17:00'}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        Delivery Window
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {formData.shipmentInfo?.earliestDelivery || '09:00'} - {formData.shipmentInfo?.latestDelivery || '17:00'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Paper>
                                    </Grid>

                                    {/* Service Options Card */}
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
                                                        label={formData.shipmentInfo?.holdForPickup ? "Yes" : "No"}
                                                        color={formData.shipmentInfo?.holdForPickup ? "primary" : "default"}
                                                        size="small"
                                                        sx={{ minWidth: 60 }}
                                                    />
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        International
                                                    </Typography>
                                                    <Chip
                                                        label={formData.shipmentInfo?.international ? "Yes" : "No"}
                                                        color={formData.shipmentInfo?.international ? "primary" : "default"}
                                                        size="small"
                                                        sx={{ minWidth: 60 }}
                                                    />
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        Saturday Delivery
                                                    </Typography>
                                                    <Chip
                                                        label={formData.shipmentInfo?.saturdayDelivery ? "Yes" : "No"}
                                                        color={formData.shipmentInfo?.saturdayDelivery ? "primary" : "default"}
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

                    {/* Locations */}
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
                                        {formData.shipFrom.company}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        {formatAddress(formData.shipFrom)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Contact: {formData.shipFrom.contactName}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Phone: {formatPhone(formData.shipFrom.contactPhone)}
                                    </Typography>
                                    <Box sx={{ mt: 2 }}>
                                        <SimpleMap address={formData.shipFrom} />
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
                                        {formData.shipTo.company}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        {formatAddress(formData.shipTo)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Contact: {formData.shipTo.contactName}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Phone: {formatPhone(formData.shipTo.contactPhone)}
                                    </Typography>
                                    <Box sx={{ mt: 2 }}>
                                        <SimpleMap address={formData.shipTo} />
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Packages */}
                    <Paper sx={{ mb: 3 }}>
                        <Box sx={{ p: 2, bgcolor: '#000000', color: 'white' }}>
                            <Typography variant="h6">Package Details</Typography>
                        </Box>
                        <Box sx={{ p: 2 }}>
                            <Grid container spacing={3}>
                                {formData.packages.map((pkg, index) => (
                                    <Grid item xs={12} md={6} key={index}>
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

                    {/* Selected Rate */}
                    <Paper sx={{ mb: 4 }}>
                        <Box sx={{ p: 2, bgcolor: '#000000', color: 'white' }}>
                            <Typography variant="h6">Rate Details</Typography>
                        </Box>
                        <Box sx={{ p: 3 }}>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="h5" gutterBottom>
                                        {selectedRate?.carrier}
                                    </Typography>
                                    <Chip
                                        label={selectedRate?.service}
                                        color="primary"
                                        sx={{ mb: 2 }}
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        Transit Time: {selectedRate?.transitDays} days
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="h4" color="primary" gutterBottom>
                                            ${selectedRate?.rate.toFixed(2)}
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
                                        ${selectedRate?.freightCharges.toFixed(2)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">
                                        Fuel Surcharge
                                    </Typography>
                                    <Typography variant="body1">
                                        ${selectedRate?.fuelCharges.toFixed(2)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">
                                        Accessorial Charges
                                    </Typography>
                                    <Typography variant="body1">
                                        ${selectedRate?.accessorialCharges.toFixed(2)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">
                                        Service Charges
                                    </Typography>
                                    <Typography variant="body1">
                                        ${selectedRate?.serviceCharges.toFixed(2)}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    </Paper>

                    {/* Navigation Buttons */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onPrevious}
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
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSubmit}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#1a237e',
                                color: 'white',
                                cursor: 'pointer',
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
                </LoadScript>
            ) : (
                <Typography variant="body1" color="error">
                    {mapError}
                </Typography>
            )}
        </Container>
    );
};

export default Review; 