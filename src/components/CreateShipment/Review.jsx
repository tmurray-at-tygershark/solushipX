import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import {
    Box,
    Typography,
    Paper,
    IconButton,
    Collapse,
    Divider,
    Chip,
    Tooltip,
    useTheme
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
    Map as MapIcon
} from '@mui/icons-material';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

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

const SimpleMap = ({ address }) => {
    const [position, setPosition] = useState(null);

    useEffect(() => {
        // Simple geocoding
        const geocoder = new window.google.maps.Geocoder();
        const addressString = `${address.street}, ${address.city}, ${address.state} ${address.postalCode}`;

        geocoder.geocode({ address: addressString }, (results, status) => {
            if (status === 'OK') {
                const location = results[0].geometry.location;
                setPosition({
                    lat: location.lat(),
                    lng: location.lng()
                });
            } else {
                console.error('Geocoding failed:', status);
            }
        });
    }, [address]);

    if (!position) return null;

    return (
        <GoogleMap
            mapContainerStyle={{
                width: '100%',
                height: '300px',
                borderRadius: '12px'
            }}
            center={position}
            zoom={15}
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
};

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
    const [directions, setDirections] = useState(null);
    const [mapCenter, setMapCenter] = useState({ lat: 41.8781, lng: -87.6298 });
    const [mapZoom, setMapZoom] = useState(15);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [distance, setDistance] = useState('');
    const [duration, setDuration] = useState('');
    const [mapsApiKey, setMapsApiKey] = useState('AIzaSyCf3rYCEhFA2ed0VIhLfJxerIlQqsbC4Gw');
    const [mapError, setMapError] = useState(null);
    const [routeError, setRouteError] = useState(null);
    const [fromMarkerPosition, setFromMarkerPosition] = useState(null);
    const [toMarkerPosition, setToMarkerPosition] = useState(null);
    const [expandedSections, setExpandedSections] = useState({
        shipment: true,
        locations: true,
        packages: true,
        rate: true
    });
    const [selectedRate, setSelectedRate] = useState(initialSelectedRate);

    useEffect(() => {
        const fetchMapsApiKey = async () => {
            try {
                const response = await fetch('https://getmapsapikey-xedyh5vw7a-uc.a.run.app');
                const data = await response.json();
                if (data.key) {
                    setMapsApiKey(data.key);
                    console.log('Maps API Key fetched successfully');
                } else {
                    console.error('No API key in response');
                }
            } catch (error) {
                console.error('Error fetching Maps API key:', error);
            }
        };

        fetchMapsApiKey();
    }, []);

    useEffect(() => {
        // Log the API key being used
        console.log('Using Maps API Key:', mapsApiKey);

        // Function to calculate route using Routes API
        const calculateRoute = async () => {
            if (!isMapLoaded || !formData.shipFrom || !formData.shipTo) return;

            setRouteError(null);
            const fromAddress = `${formData.shipFrom.street}, ${formData.shipFrom.city}, ${formData.shipFrom.state} ${formData.shipFrom.postalCode}`;
            const toAddress = `${formData.shipTo.street}, ${formData.shipTo.city}, ${formData.shipTo.state} ${formData.shipTo.postalCode}`;

            try {
                // First, geocode the addresses to get coordinates
                const geocoder = new window.google.maps.Geocoder();

                const [originResult, destinationResult] = await Promise.all([
                    new Promise((resolve, reject) => {
                        geocoder.geocode({ address: fromAddress }, (results, status) => {
                            if (status === 'OK') resolve(results[0]);
                            else reject(new Error(`Geocoding failed for origin: ${status}`));
                        });
                    }),
                    new Promise((resolve, reject) => {
                        geocoder.geocode({ address: toAddress }, (results, status) => {
                            if (status === 'OK') resolve(results[0]);
                            else reject(new Error(`Geocoding failed for destination: ${status}`));
                        });
                    })
                ]);

                // Call the Routes API through our backend
                const response = await fetch('https://getmapsapikey-xedyh5vw7a-uc.a.run.app/route', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        origin: {
                            location: {
                                latLng: {
                                    latitude: originResult.geometry.location.lat(),
                                    longitude: originResult.geometry.location.lng()
                                }
                            }
                        },
                        destination: {
                            location: {
                                latLng: {
                                    latitude: destinationResult.geometry.location.lat(),
                                    longitude: destinationResult.geometry.location.lng()
                                }
                            }
                        },
                        travelMode: "DRIVE",
                        routingPreference: "TRAFFIC_AWARE",
                        computeAlternativeRoutes: false,
                        languageCode: "en-US",
                        units: "IMPERIAL"
                    })
                });

                if (!response.ok) {
                    throw new Error(`Route calculation failed: ${response.statusText}`);
                }

                const routeData = await response.json();

                if (!routeData.routes || routeData.routes.length === 0) {
                    throw new Error('No routes found');
                }

                const route = routeData.routes[0];

                // Convert the encoded polyline to a DirectionsResult format that DirectionsRenderer can understand
                const decodedPath = window.google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
                const directionsResult = {
                    routes: [{
                        legs: [{
                            steps: decodedPath.map((point, index) => ({
                                path: [point],
                                start_location: point,
                                end_location: decodedPath[index + 1] || point
                            })),
                            start_location: decodedPath[0],
                            end_location: decodedPath[decodedPath.length - 1],
                            distance: { text: `${Math.round(route.distanceMeters / 1609.34)} mi` },
                            duration: { text: `${Math.round(parseInt(route.duration.replace('s', '')) / 3600)} hours` }
                        }],
                        overview_path: decodedPath
                    }]
                };

                setDirections(directionsResult);
                setDistance(directionsResult.routes[0].legs[0].distance.text);
                setDuration(directionsResult.routes[0].legs[0].duration.text);

                // Set map bounds to include the route
                const bounds = new window.google.maps.LatLngBounds();
                decodedPath.forEach(point => bounds.extend(point));
                if (map) {
                    map.fitBounds(bounds);
                }

            } catch (error) {
                console.error('Error calculating route:', error);
                setRouteError(error.message || 'Failed to calculate route. Please try again.');
            }
        };

        if (isMapLoaded) {
            calculateRoute();
        }
    }, [isMapLoaded, formData.shipFrom, formData.shipTo, mapsApiKey, map]);

    useEffect(() => {
        // Function to geocode the Ship From address
        const geocodeAddress = async () => {
            if (!formData.shipFrom || !window.google) return;

            const geocoder = new window.google.maps.Geocoder();
            const address = `${formData.shipFrom.street}, ${formData.shipFrom.city}, ${formData.shipFrom.state} ${formData.shipFrom.postalCode}`;

            try {
                const result = await new Promise((resolve, reject) => {
                    geocoder.geocode({ address }, (results, status) => {
                        if (status === 'OK') resolve(results[0]);
                        else reject(new Error(`Geocoding failed: ${status}`));
                    });
                });

                const location = result.geometry.location;
                setFromMarkerPosition({
                    lat: location.lat(),
                    lng: location.lng()
                });
            } catch (error) {
                console.error('Error geocoding address:', error);
                setMapError('Failed to locate address on map');
            }
        };

        if (isMapLoaded) {
            geocodeAddress();
        }
    }, [isMapLoaded, formData.shipFrom]);

    // Add new useEffect for Ship To map
    useEffect(() => {
        const geocodeShipToAddress = async () => {
            if (!formData.shipTo || !window.google) return;

            const geocoder = new window.google.maps.Geocoder();
            const address = `${formData.shipTo.street}, ${formData.shipTo.city}, ${formData.shipTo.state} ${formData.shipTo.postalCode}`;

            try {
                const result = await new Promise((resolve, reject) => {
                    geocoder.geocode({ address }, (results, status) => {
                        if (status === 'OK') resolve(results[0]);
                        else reject(new Error(`Geocoding failed: ${status}`));
                    });
                });

                const location = result.geometry.location;
                setToMarkerPosition({
                    lat: location.lat(),
                    lng: location.lng()
                });
            } catch (error) {
                console.error('Error geocoding Ship To address:', error);
                setMapError('Failed to locate Ship To address on map');
            }
        };

        if (isMapLoaded) {
            geocodeShipToAddress();
        }
    }, [isMapLoaded, formData.shipTo]);

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
            alert('Please select a rate before submitting');
            return;
        }

        try {
            // Create the shipment document
            const shipmentData = {
                ...formData.shipmentInfo,
                shipFrom: formData.shipFrom,
                shipTo: formData.shipTo,
                selectedRate: selectedRate,
                status: 'pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Add the shipment document
            const shipmentRef = await addDoc(collection(db, 'shipments'), shipmentData);
            const shipmentId = shipmentRef.id;

            // Save packages to the subcollection
            const packagesRef = collection(db, 'shipments', shipmentId, 'packages');
            const packagePromises = formData.packages.map(pkg => addDoc(packagesRef, pkg));
            await Promise.all(packagePromises);

            // Save the selected rate
            await saveRateToFirebase(selectedRate, shipmentId);

            // Redirect to the shipment detail page
            window.location.href = `/shipment/${shipmentId}`;
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
        if (selectedRate?.id === rate.id) {
            // If clicking the same rate, deselect it
            setSelectedRate(null);
            onRateSelect(null);
        } else {
            // Select the new rate and save to Firebase
            setSelectedRate(rate);
            onRateSelect(rate);

            // Save the rate to Firebase if we have a shipment ID
            if (formData.shipmentId) {
                await saveRateToFirebase(rate, formData.shipmentId);
            }

            onNext(); // Automatically move to next step
        }
    };

    return (
        <Box sx={{ width: '100%', p: 0 }}>
            <LoadScript
                googleMapsApiKey={mapsApiKey}
                libraries={GOOGLE_MAPS_LIBRARIES}
                onLoad={() => {
                    console.log('Maps API loaded successfully');
                    setMapError(null);
                }}
                onError={(error) => {
                    console.error('Maps API error:', error);
                    setMapError('Failed to load Google Maps. Please try refreshing the page.');
                }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    style={{ width: '100%' }}
                >
                    <Typography
                        variant="h3"
                        component="h2"
                        gutterBottom
                        sx={{
                            fontWeight: 800,
                            color: '#000',
                            mb: 4,
                            letterSpacing: '-0.02em',
                            px: 3,
                            pt: 3
                        }}
                    >
                        Review Shipment Details
                    </Typography>

                    {/* Shipment Details Section */}
                    <Paper
                        elevation={0}
                        sx={{
                            mb: 3,
                            borderRadius: 0,
                            border: '1px solid #e0e0e0',
                            borderLeft: 0,
                            borderRight: 0,
                            overflow: 'hidden',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <Box
                            sx={{
                                p: 2,
                                bgcolor: '#000',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <i className="fas fa-truck" style={{ fontSize: '1.2rem' }}></i>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>Shipment Information</Typography>
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
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Shipment Type</Typography>
                                        <Typography variant="body1">{formData.shipmentInfo.shipmentType}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Shipment Date</Typography>
                                        <Typography variant="body1">{formData.shipmentInfo.shipmentDate}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Pickup Window</Typography>
                                        <Typography variant="body1">
                                            {formData.shipmentInfo.earliestPickup} - {formData.shipmentInfo.latestPickup}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Delivery Window</Typography>
                                        <Typography variant="body1">
                                            {formData.shipmentInfo.earliestDelivery} - {formData.shipmentInfo.latestDelivery}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </Collapse>
                    </Paper>

                    {/* Shipping Locations Section */}
                    <Paper
                        elevation={0}
                        sx={{
                            mb: 3,
                            borderRadius: 0,
                            border: '1px solid #e0e0e0',
                            borderLeft: 0,
                            borderRight: 0,
                            overflow: 'hidden'
                        }}
                    >
                        <Box
                            sx={{
                                p: 2,
                                bgcolor: '#000',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <i className="fas fa-map-marked-alt" style={{ fontSize: '1.2rem' }}></i>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>Shipping Locations</Typography>
                            </Box>
                            <IconButton
                                onClick={() => toggleSection('locations')}
                                sx={{ color: 'white' }}
                            >
                                <ExpandMoreIcon
                                    sx={{
                                        transform: expandedSections.locations ? 'rotate(180deg)' : 'none',
                                        transition: 'transform 0.3s'
                                    }}
                                />
                            </IconButton>
                        </Box>
                        <Collapse in={expandedSections.locations}>
                            <Box sx={{ p: 3 }}>
                                <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                    gap: 3
                                }}>
                                    {/* Ship From Side */}
                                    <Box>
                                        <Typography variant="h6" gutterBottom sx={{
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1
                                        }}>
                                            <i className="fas fa-arrow-right" style={{ fontSize: '1rem', color: '#666' }}></i>
                                            Ship From
                                        </Typography>
                                        <Box sx={{ mb: 2 }}>
                                            <SimpleMap address={formData.shipFrom} />
                                        </Box>
                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                            <Box>
                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>Company Details</Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                    <i className="fas fa-building" style={{ color: '#000' }}></i>
                                                    <Typography variant="body1">{formData.shipFrom.company}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                    <i className="fas fa-phone" style={{ color: '#000' }}></i>
                                                    <Typography variant="body1">{formatPhone(formData.shipFrom.contactPhone)}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <i className="fas fa-envelope" style={{ color: '#000' }}></i>
                                                    <Typography variant="body1">{formData.shipFrom.contactEmail}</Typography>
                                                </Box>
                                            </Box>
                                            <Box>
                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>Address</Typography>
                                                <Typography variant="body1">{formatAddress(formData.shipFrom)}</Typography>
                                            </Box>
                                        </Box>
                                    </Box>

                                    {/* Ship To Side */}
                                    <Box>
                                        <Typography variant="h6" gutterBottom sx={{
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1
                                        }}>
                                            <i className="fas fa-arrow-left" style={{ fontSize: '1rem', color: '#666' }}></i>
                                            Ship To
                                        </Typography>
                                        <Box sx={{ mb: 2 }}>
                                            <SimpleMap address={formData.shipTo} />
                                        </Box>
                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                            <Box>
                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>Company Details</Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                    <i className="fas fa-building" style={{ color: '#000' }}></i>
                                                    <Typography variant="body1">{formData.shipTo.company}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                    <i className="fas fa-phone" style={{ color: '#000' }}></i>
                                                    <Typography variant="body1">{formatPhone(formData.shipTo.contactPhone)}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <i className="fas fa-envelope" style={{ color: '#000' }}></i>
                                                    <Typography variant="body1">{formData.shipTo.contactEmail}</Typography>
                                                </Box>
                                            </Box>
                                            <Box>
                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>Address</Typography>
                                                <Typography variant="body1">{formatAddress(formData.shipTo)}</Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                        </Collapse>
                    </Paper>

                    {/* Packages Section */}
                    <Paper
                        elevation={0}
                        sx={{
                            mb: 3,
                            borderRadius: 0,
                            border: '1px solid #e0e0e0',
                            borderLeft: 0,
                            borderRight: 0,
                            overflow: 'hidden'
                        }}
                    >
                        <Box
                            sx={{
                                p: 2,
                                bgcolor: '#000',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <i className="fas fa-box" style={{ fontSize: '1.2rem' }}></i>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>Packages</Typography>
                            </Box>
                            <IconButton
                                onClick={() => toggleSection('packages')}
                                sx={{ color: 'white' }}
                            >
                                <ExpandMoreIcon
                                    sx={{
                                        transform: expandedSections.packages ? 'rotate(180deg)' : 'none',
                                        transition: 'transform 0.3s'
                                    }}
                                />
                            </IconButton>
                        </Box>
                        <Collapse in={expandedSections.packages}>
                            <Box sx={{ p: 3 }}>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
                                    {formData.packages.map((pkg, index) => (
                                        <Paper
                                            key={index}
                                            elevation={0}
                                            sx={{
                                                p: 2,
                                                borderRadius: 2,
                                                border: '1px solid #e0e0e0',
                                                bgcolor: 'background.default'
                                            }}
                                        >
                                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Package {index + 1}</Typography>
                                            <Box sx={{ display: 'grid', gap: 1 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Description</Typography>
                                                    <Typography variant="body1">{pkg.itemDescription || 'No description'}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Quantity</Typography>
                                                    <Typography variant="body1">{pkg.quantity || 1} {parseInt(pkg.quantity || 1) > 1 ? 'pieces' : 'piece'}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Weight</Typography>
                                                    <Typography variant="body1">{pkg.weight} lbs</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Dimensions</Typography>
                                                    <Typography variant="body1">{pkg.length}" × {pkg.width}" × {pkg.height}"</Typography>
                                                </Box>
                                                {pkg.freightClass && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Freight Class</Typography>
                                                        <Typography variant="body1">{pkg.freightClass}</Typography>
                                                    </Box>
                                                )}
                                                {pkg.value > 0 && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Declared Value</Typography>
                                                        <Typography variant="body1">${pkg.value.toFixed(2)}</Typography>
                                                    </Box>
                                                )}
                                            </Box>
                                        </Paper>
                                    ))}
                                </Box>
                            </Box>
                        </Collapse>
                    </Paper>

                    {/* Selected Rate Section */}
                    <Paper
                        elevation={0}
                        sx={{
                            mb: 3,
                            borderRadius: 0,
                            border: '1px solid #e0e0e0',
                            borderLeft: 0,
                            borderRight: 0,
                            overflow: 'hidden'
                        }}
                    >
                        <Box
                            sx={{
                                p: 2,
                                bgcolor: '#000',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <i className="fas fa-dollar-sign" style={{ fontSize: '1.2rem' }}></i>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>Selected Rate</Typography>
                            </Box>
                            <IconButton
                                onClick={() => toggleSection('rate')}
                                sx={{ color: 'white' }}
                            >
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
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#000' }}>
                                        {selectedRate?.carrier}
                                    </Typography>
                                    <Chip
                                        label={selectedRate?.serviceLevel}
                                        sx={{
                                            bgcolor: '#000',
                                            color: 'white',
                                            fontWeight: 500
                                        }}
                                        size="small"
                                    />
                                </Box>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Freight Charges</Typography>
                                        <Typography variant="body1">${selectedRate?.freightCharges.toFixed(2)}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Fuel Charges</Typography>
                                        <Typography variant="body1">${selectedRate?.fuelCharges.toFixed(2)}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Service Charges</Typography>
                                        <Typography variant="body1">${selectedRate?.serviceCharges.toFixed(2)}</Typography>
                                    </Box>
                                    {selectedRate?.accessorialCharges > 0 && (
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Accessorial Charges</Typography>
                                            <Typography variant="body1">${selectedRate?.accessorialCharges.toFixed(2)}</Typography>
                                        </Box>
                                    )}
                                    {selectedRate?.guaranteed && (
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>Guarantee Charge</Typography>
                                            <Typography variant="body1">${selectedRate?.guaranteeCharge.toFixed(2)}</Typography>
                                        </Box>
                                    )}
                                </Box>
                                <Divider sx={{ my: 2 }} />
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Total Charges</Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#000' }}>
                                        ${selectedRate?.rate.toFixed(2)}
                                    </Typography>
                                </Box>
                            </Box>
                        </Collapse>
                    </Paper>

                    {/* Navigation Buttons */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, px: 3, pb: 3 }}>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onPrevious}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '8px',
                                border: '2px solid #000',
                                background: 'transparent',
                                color: '#000',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '16px',
                                fontWeight: 500
                            }}
                        >
                            <i className="fas fa-arrow-left"></i> Previous
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSubmit}
                            disabled={!selectedRate || isLoading}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#000',
                                color: 'white',
                                cursor: selectedRate && !isLoading ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '16px',
                                fontWeight: 500,
                                opacity: selectedRate && !isLoading ? 1 : 0.7
                            }}
                        >
                            <i className="fas fa-check-circle"></i> Book Shipment
                        </motion.button>
                    </Box>
                </motion.div>
            </LoadScript>
        </Box>
    );
};

export default Review; 