import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    MenuItem,
    Switch,
    FormControlLabel,
    Autocomplete,
    IconButton,
    InputAdornment,
    Alert,
    CircularProgress,
    Card,
    CardContent,
    CardHeader,
    Collapse,
    FormGroup,
    Divider,
    FormControl,
    InputLabel,
    Select,
    Avatar,
    Chip
} from '@mui/material';
import {
    LocationOn as LocationIcon,
    Search as SearchIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    Business as BusinessIcon,
    Person as PersonIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    AccessTime as AccessTimeIcon,
    Info as InfoIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { doc, setDoc, getDoc, addDoc, collection, Timestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';

const AddressForm = ({ addressId = null, onCancel, onSuccess, isModal = false, initialData = {}, companyId = null, customerId = null }) => {
    const { companyIdForAddress } = useCompany();
    const { currentUser } = useAuth();

    // Form state
    const [formData, setFormData] = useState({
        companyName: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        phoneExt: '',
        street: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        specialInstructions: '',
        status: 'active',
        isResidential: false,
        // Address classification - default to customer
        addressClass: 'customer',
        // Enhanced hours structure
        useCustomHours: false,
        defaultHours: {
            open: '',
            close: ''
        },
        customHours: {
            monday: { open: '', close: '', closed: false },
            tuesday: { open: '', close: '', closed: false },
            wednesday: { open: '', close: '', closed: false },
            thursday: { open: '', close: '', closed: false },
            friday: { open: '', close: '', closed: false },
            saturday: { open: '', close: '', closed: false },
            sunday: { open: '', close: '', closed: false }
        },
        // Default address flags
        isDefaultShipFrom: false,
        isDefaultShipTo: false,
        // Include initial data for customer-specific fields
        ...initialData
    });

    // UI state
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [useGoogleAutocomplete, setUseGoogleAutocomplete] = useState(true);
    const [isValidated, setIsValidated] = useState(false);
    const [googleApiLoaded, setGoogleApiLoaded] = useState(false);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [expandedDays, setExpandedDays] = useState(false);

    // Customer selector state
    const [availableCustomers, setAvailableCustomers] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // Google autocomplete state
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const autocompleteService = useRef(null);
    const placesService = useRef(null);

    const isEditing = !!addressId;

    // Load available customers for address assignment
    const loadAvailableCustomers = useCallback(async () => {
        if (!companyIdForAddress) return;

        setLoadingCustomers(true);
        try {
            const customersQuery = query(
                collection(db, 'customers'),
                where('companyID', '==', companyIdForAddress),
                orderBy('name')
            );
            const customersSnapshot = await getDocs(customersQuery);
            const customersData = customersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAvailableCustomers(customersData);
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setLoadingCustomers(false);
        }
    }, [companyIdForAddress]);

    const daysOfWeek = [
        { key: 'monday', label: 'Monday' },
        { key: 'tuesday', label: 'Tuesday' },
        { key: 'wednesday', label: 'Wednesday' },
        { key: 'thursday', label: 'Thursday' },
        { key: 'friday', label: 'Friday' },
        { key: 'saturday', label: 'Saturday' },
        { key: 'sunday', label: 'Sunday' }
    ];

    useEffect(() => {
        initializeGoogleMaps();
        if (isEditing) {
            loadAddressData();
        }
    }, [addressId, isEditing]);

    // Load customers when component mounts
    useEffect(() => {
        loadAvailableCustomers();
    }, [loadAvailableCustomers]);

    // Auto-select customer if there's only one available
    useEffect(() => {
        if (availableCustomers.length === 1 && !selectedCustomerId) {
            const singleCustomer = availableCustomers[0];
            setSelectedCustomerId(singleCustomer.customerID || singleCustomer.id);
        }
    }, [availableCustomers, selectedCustomerId]);

    // Initialize customer selection from props
    useEffect(() => {
        if (customerId) {
            setSelectedCustomerId(customerId);
            console.log('[AddressForm] Initialized customer from props:', customerId, 'isEditing:', isEditing);
        }
    }, [customerId, isEditing]);

    const initializeGoogleMaps = async () => {
        try {
            // Check if Google Maps is already loaded
            if (window.google && window.google.maps) {
                setGoogleApiLoaded(true);
                initializeAutocompleteService();
                return;
            }

            // Try to load API key from Firestore
            const apiKeyDoc = await getDoc(doc(db, 'config', 'googleMaps'));
            if (apiKeyDoc.exists()) {
                const apiKey = apiKeyDoc.data().apiKey;
                loadGoogleMapsScript(apiKey);
            } else {
                console.warn('Google Maps API key not found. Autocomplete disabled.');
                setUseGoogleAutocomplete(false);
            }
        } catch (error) {
            console.error('Error loading Google Maps:', error);
            setUseGoogleAutocomplete(false);
        }
    };

    const loadGoogleMapsScript = (apiKey) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.onload = () => {
            setGoogleApiLoaded(true);
            initializeAutocompleteService();
        };
        script.onerror = () => {
            console.error('Failed to load Google Maps API');
            setUseGoogleAutocomplete(false);
        };
        document.head.appendChild(script);
    };

    const initializeAutocompleteService = () => {
        if (window.google && window.google.maps) {
            autocompleteService.current = new window.google.maps.places.AutocompleteService();
            placesService.current = new window.google.maps.places.PlacesService(document.createElement('div'));
        }
    };

    const loadAddressData = async () => {
        if (!addressId) return;

        try {
            setLoading(true);
            const addressDoc = await getDoc(doc(db, 'addressBook', addressId));

            if (addressDoc.exists()) {
                const data = addressDoc.data();

                // Handle legacy data format
                let hoursData = {
                    useCustomHours: false,
                    defaultHours: {
                        open: data.openHours || '',
                        close: data.closeHours || ''
                    },
                    customHours: {
                        monday: { open: '', close: '', closed: false },
                        tuesday: { open: '', close: '', closed: false },
                        wednesday: { open: '', close: '', closed: false },
                        thursday: { open: '', close: '', closed: false },
                        friday: { open: '', close: '', closed: false },
                        saturday: { open: '', close: '', closed: false },
                        sunday: { open: '', close: '', closed: false }
                    }
                };

                // If the data has the new hours structure, use it
                if (data.businessHours) {
                    hoursData = {
                        useCustomHours: data.businessHours.useCustomHours || false,
                        defaultHours: data.businessHours.defaultHours || hoursData.defaultHours,
                        customHours: data.businessHours.customHours || hoursData.customHours
                    };
                }

                setFormData({
                    companyName: data.companyName || '',
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    phoneExt: data.phoneExt || '',
                    // CRITICAL FIX: Map database fields to form fields correctly
                    street: data.address1 || data.street || '',
                    street2: data.address2 || data.street2 || '',
                    city: data.city || '',
                    state: data.stateProv || data.state || '',
                    postalCode: data.zipPostal || data.postalCode || '',
                    country: data.country || 'US',
                    specialInstructions: data.specialInstructions || '',
                    status: data.status || 'active',
                    isResidential: data.isResidential || false,
                    // Load address classification from database
                    addressClass: data.addressClass || 'customer', // Default to customer if not set
                    // Load default address flags
                    isDefaultShipFrom: data.isDefaultShipFrom || false,
                    isDefaultShipTo: data.isDefaultShipTo || false,
                    ...hoursData
                });

                // CRITICAL FIX: Restore customer selection when editing
                if (data.addressClass === 'customer' && data.addressClassID) {
                    setSelectedCustomerId(data.addressClassID);
                }

                // When editing, show manual entry instead of autocomplete
                setShowManualEntry(true);
            }
        } catch (error) {
            console.error('Error loading address data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear error for this field
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: null
            }));
        }

        // Reset validation status
        setIsValidated(false);
    };

    const handleHoursChange = (type, field, value) => {
        if (type === 'default') {
            setFormData(prev => ({
                ...prev,
                defaultHours: {
                    ...prev.defaultHours,
                    [field]: value
                }
            }));
        } else {
            // Custom hours for specific day
            const [day, timeField] = field.split('.');
            setFormData(prev => ({
                ...prev,
                customHours: {
                    ...prev.customHours,
                    [day]: {
                        ...prev.customHours[day],
                        [timeField]: timeField === 'closed' ? value : value
                    }
                }
            }));
        }
    };

    const handleToggleCustomHours = (checked) => {
        setFormData(prev => ({
            ...prev,
            useCustomHours: checked
        }));
        if (checked) {
            setExpandedDays(true);
        }
    };

    const handleGooglePlaceSearch = (searchText) => {
        if (!autocompleteService.current || !searchText.trim()) {
            setAddressSuggestions([]);
            return;
        }

        // Make two separate requests since 'address' cannot be mixed with other types
        const allPredictions = [];
        let completedRequests = 0;
        const totalRequests = 2;

        const handlePredictionsResponse = (predictions, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                allPredictions.push(...predictions.map(prediction => ({
                    id: prediction.place_id,
                    description: prediction.description,
                    structured_formatting: prediction.structured_formatting,
                    types: prediction.types
                })));
            }

            completedRequests++;
            if (completedRequests === totalRequests) {
                // Remove duplicates based on place_id and sort by relevance
                const uniquePredictions = allPredictions.filter((prediction, index, self) =>
                    index === self.findIndex(p => p.id === prediction.id)
                );
                setAddressSuggestions(uniquePredictions);
            }
        };

        // Request 1: Search for establishments (businesses)
        const establishmentRequest = {
            input: searchText,
            types: ['establishment'],
            componentRestrictions: { country: ['us', 'ca'] }
        };

        // Request 2: Search for addresses (geocode type works better than address)
        const addressRequest = {
            input: searchText,
            types: ['geocode'],
            componentRestrictions: { country: ['us', 'ca'] }
        };

        autocompleteService.current.getPlacePredictions(establishmentRequest, handlePredictionsResponse);
        autocompleteService.current.getPlacePredictions(addressRequest, handlePredictionsResponse);
    };

    const handlePlaceSelect = (place) => {
        if (!placesService.current || !place) return;

        const request = {
            placeId: place.id,
            fields: ['address_components', 'formatted_address', 'geometry']
        };

        placesService.current.getDetails(request, (placeDetails, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && placeDetails) {
                const addressComponents = placeDetails.address_components;

                const getComponent = (types) => {
                    const component = addressComponents.find(comp =>
                        types.some(type => comp.types.includes(type))
                    );
                    return component ? component.long_name : '';
                };

                const getShortComponent = (types) => {
                    const component = addressComponents.find(comp =>
                        types.some(type => comp.types.includes(type))
                    );
                    return component ? component.short_name : '';
                };

                const streetNumber = getComponent(['street_number']);
                const streetName = getComponent(['route']);
                const street = `${streetNumber} ${streetName}`.trim();

                // If this is a business establishment, use the business name as company name
                const businessName = placeDetails.name;
                const isBusiness = place.types?.includes('establishment');

                setFormData(prev => ({
                    ...prev,
                    // If it's a business and no company name is set, use the business name
                    companyName: (isBusiness && !prev.companyName.trim()) ? businessName : prev.companyName,
                    street: street,
                    city: getComponent(['locality', 'administrative_area_level_3']),
                    state: getShortComponent(['administrative_area_level_1']),
                    postalCode: getComponent(['postal_code']),
                    country: getShortComponent(['country'])
                }));

                setSelectedPlace(place);
                setAddressSuggestions([]);
                setIsValidated(true);
            }
        });
    };

    const validateForm = () => {
        const newErrors = {};

        // Required fields validation
        if (!formData.companyName.trim()) {
            newErrors.companyName = 'Company name is required';
        }
        // Email validation - only validate format if provided
        if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }
        // Phone is no longer required
        if (!formData.street.trim()) {
            newErrors.street = 'Street address is required';
        }
        if (!formData.city.trim()) {
            newErrors.city = 'City is required';
        }
        if (!formData.state.trim()) {
            newErrors.state = 'State/Province is required';
        }
        if (!formData.postalCode.trim()) {
            newErrors.postalCode = 'Postal/Zip code is required';
        }
        if (!selectedCustomerId) {
            newErrors.selectedCustomerId = 'Please select a customer to assign this address to';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleValidateAddress = async () => {
        if (!window.google || !window.google.maps) {
            setIsValidated(true);
            return;
        }

        const geocoder = new window.google.maps.Geocoder();
        const fullAddress = `${formData.street}, ${formData.city}, ${formData.state} ${formData.postalCode}, ${formData.country}`;

        geocoder.geocode({ address: fullAddress }, (results, status) => {
            if (status === 'OK' && results[0]) {
                setIsValidated(true);
                console.log('Address validated successfully');
            } else {
                setIsValidated(false);
                console.log('Address validation failed');
            }
        });
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        setSaving(true);

        try {
            // Prepare the business hours data
            const businessHours = {
                useCustomHours: formData.useCustomHours,
                defaultHours: formData.defaultHours,
                customHours: formData.customHours
            };

            // Determine if this is a customer address based on the props
            const isCustomerAddress = selectedCustomerId && selectedCustomerId !== '';

            // Fetch company information if this is a customer address
            let companyInfo = null;
            if (isCustomerAddress) {
                try {
                    const companiesRef = collection(db, 'companies');
                    const companyQuery = query(companiesRef, where('companyID', '==', companyIdForAddress));
                    const companySnapshot = await getDocs(companyQuery);

                    if (!companySnapshot.empty) {
                        const companyDoc = companySnapshot.docs[0];
                        companyInfo = {
                            id: companyDoc.id,
                            ...companyDoc.data()
                        };
                        console.log('[AddressForm] Found company info:', companyInfo);
                    }
                } catch (error) {
                    console.error('[AddressForm] Error fetching company info:', error);
                }
            }

            const addressData = {
                companyName: formData.companyName,
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                phone: formData.phone,
                phoneExt: formData.phoneExt,
                // CRITICAL FIX: Save to correct database field names
                address1: formData.street,
                address2: formData.street2,
                city: formData.city,
                stateProv: formData.state,
                zipPostal: formData.postalCode,
                country: formData.country,
                specialInstructions: formData.specialInstructions,
                status: formData.status,
                isResidential: formData.isResidential,
                businessHours: businessHours,
                // Keep legacy fields for backward compatibility AND form fields for backward compatibility
                street: formData.street,
                street2: formData.street2,
                state: formData.state,
                postalCode: formData.postalCode,
                openHours: formData.defaultHours.open,
                closeHours: formData.defaultHours.close,
                // Default address flags for customer addresses
                isDefaultShipFrom: formData.addressClass === 'customer' ? formData.isDefaultShipFrom : false,
                isDefaultShipTo: formData.addressClass === 'customer' ? formData.isDefaultShipTo : false,
                companyID: companyId || companyIdForAddress,
                createdBy: currentUser?.uid || 'system',
                updatedAt: Timestamp.now(),
                // Set address classification - always customer since company addresses are not allowed
                addressClass: 'customer',
                addressClassID: selectedCustomerId,
                addressType: 'destination',
                // Add company owner information for customer addresses
                ...(isCustomerAddress && companyInfo ? {
                    ownerCompanyName: companyInfo.name,
                    ownerCompanyLogo: companyInfo.logoURL || companyInfo.logo || companyInfo.logoUrl,
                    ownerCompanyID: companyInfo.companyID
                } : {}),
                ...(isEditing ? {} : { createdAt: Timestamp.now() })
            };

            console.log('[AddressForm] Saving address with data:', {
                isEditing,
                addressId,
                isCustomerAddress,
                companyId,
                customerId,
                selectedCustomerId,
                addressClass: addressData.addressClass,
                addressClassID: addressData.addressClassID,
                addressType: addressData.addressType,
                companyID: addressData.companyID,
                // CRITICAL: Log special instructions handling
                formSpecialInstructions: formData.specialInstructions,
                savedSpecialInstructions: addressData.specialInstructions,
                hasSpecialInstructions: !!addressData.specialInstructions,
                specialInstructionsLength: addressData.specialInstructions ? addressData.specialInstructions.length : 0
            });

            // If setting as default, clear other defaults first
            if (addressData.isDefaultShipFrom || addressData.isDefaultShipTo) {
                try {
                    // Clear existing defaults for this customer
                    const existingDefaultsQuery = query(
                        collection(db, 'addressBook'),
                        where('addressClass', '==', 'customer'),
                        where('addressClassID', '==', selectedCustomerId),
                        where('status', '==', 'active')
                    );

                    const defaultsSnapshot = await getDocs(existingDefaultsQuery);
                    const batch = [];

                    defaultsSnapshot.docs.forEach(docSnapshot => {
                        const existingData = docSnapshot.data();
                        let needsUpdate = false;
                        const updates = {};

                        // Clear shipFrom default if we're setting a new one
                        if (addressData.isDefaultShipFrom && existingData.isDefaultShipFrom && docSnapshot.id !== addressId) {
                            updates.isDefaultShipFrom = false;
                            needsUpdate = true;
                        }

                        // Clear shipTo default if we're setting a new one
                        if (addressData.isDefaultShipTo && existingData.isDefaultShipTo && docSnapshot.id !== addressId) {
                            updates.isDefaultShipTo = false;
                            needsUpdate = true;
                        }

                        if (needsUpdate) {
                            batch.push({
                                ref: doc(db, 'addressBook', docSnapshot.id),
                                updates: { ...updates, updatedAt: Timestamp.now() }
                            });
                        }
                    });

                    // Execute batch updates to clear existing defaults
                    for (const update of batch) {
                        await setDoc(update.ref, update.updates, { merge: true });
                    }

                    console.log(`📍 Cleared ${batch.length} existing default addresses for customer ${selectedCustomerId}`);
                } catch (error) {
                    console.error('Error clearing existing defaults:', error);
                    // Continue with saving - don't fail the entire operation
                }
            }

            let docRef;
            if (isEditing) {
                docRef = doc(db, 'addressBook', addressId);
                await setDoc(docRef, addressData, { merge: true });
                console.log(`✅ Address updated successfully:`, {
                    addressId,
                    specialInstructionsInSavedData: addressData.specialInstructions,
                    isDefaultShipFrom: addressData.isDefaultShipFrom,
                    isDefaultShipTo: addressData.isDefaultShipTo,
                    mergeUsed: true
                });
            } else {
                // For new addresses, use addDoc to auto-generate ID
                docRef = await addDoc(collection(db, 'addressBook'), addressData);
                console.log(`✅ Address created successfully:`, {
                    newAddressId: docRef.id,
                    specialInstructionsInSavedData: addressData.specialInstructions,
                    isDefaultShipFrom: addressData.isDefaultShipFrom,
                    isDefaultShipTo: addressData.isDefaultShipTo
                });
            }

            onSuccess(isEditing ? addressId : docRef.id);
        } catch (error) {
            console.error('Error saving address:', error);
            alert('Failed to save address. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const countries = [
        { value: 'US', label: 'United States' },
        { value: 'CA', label: 'Canada' }
    ];

    const timeOptions = [];
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const display = new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            timeOptions.push({ value: time, label: display });
        }
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                <CircularProgress />
                <Typography variant="body2" sx={{ ml: 2, fontSize: '12px' }}>
                    Loading address data...
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={isModal ? {
            height: '100%',
            width: '100%',
            overflow: 'auto',
            p: 3
        } : {
            maxWidth: 900,
            mx: 'auto',
            p: 3
        }}>
            {/* Header with Action Buttons */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                        {isEditing ? 'Edit Address' : 'Add New Address'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                        {isEditing ? 'Update the address information below' : 'Enter the complete address information for this location'}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        onClick={onCancel}
                        startIcon={<CancelIcon />}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                        sx={{ fontSize: '12px' }}
                    >
                        {saving ? 'Saving...' : (isEditing ? 'Update Address' : 'Save Address')}
                    </Button>
                </Box>
            </Box>



            <Grid container spacing={3}>
                {/* Customer Assignment Selector */}
                <Grid item xs={12}>
                    <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                        <CardHeader
                            title={
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                    Address Assignment
                                </Typography>
                            }
                            sx={{ pb: 1 }}
                        />
                        <CardContent sx={{ pt: 1 }}>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    {/* Debug info - remove after testing */}
                                    {console.log('[AddressForm Debug]', {
                                        isEditing,
                                        selectedCustomerId,
                                        availableCustomersLength: availableCustomers.length,
                                        addressId,
                                        loadingCustomers
                                    })}

                                    {isEditing && selectedCustomerId ? (
                                        // Edit mode: Show customer info as non-editable display
                                        (() => {
                                            // Try to find customer by customerID first, then by id
                                            let selectedCustomer = availableCustomers.find(
                                                c => c.customerID === selectedCustomerId
                                            );

                                            if (!selectedCustomer) {
                                                selectedCustomer = availableCustomers.find(
                                                    c => c.id === selectedCustomerId
                                                );
                                            }

                                            // If still not found and we have customers, show a fallback
                                            if (!selectedCustomer && availableCustomers.length > 0) {
                                                return (
                                                    <Box>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                fontSize: '11px',
                                                                color: '#6b7280',
                                                                display: 'block',
                                                                mb: 1
                                                            }}
                                                        >
                                                            Assigned Customer
                                                        </Typography>
                                                        <Box sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 2,
                                                            p: 2,
                                                            border: '1px solid #e5e7eb',
                                                            borderRadius: 1,
                                                            bgcolor: '#fff3cd'
                                                        }}>
                                                            <Avatar
                                                                sx={{
                                                                    width: 40,
                                                                    height: 40,
                                                                    bgcolor: '#f59e0b',
                                                                    fontSize: '14px',
                                                                    fontWeight: 600,
                                                                    border: '2px solid #e5e7eb'
                                                                }}
                                                            >
                                                                {selectedCustomerId.charAt(0).toUpperCase()}
                                                            </Avatar>
                                                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                                                <Typography sx={{
                                                                    fontSize: '14px',
                                                                    fontWeight: 600,
                                                                    color: '#374151'
                                                                }}>
                                                                    Customer ID: {selectedCustomerId}
                                                                </Typography>
                                                                <Typography sx={{
                                                                    fontSize: '12px',
                                                                    color: '#f59e0b'
                                                                }}>
                                                                    Customer details not found
                                                                </Typography>
                                                            </Box>
                                                            <Chip
                                                                label="Assigned"
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: '#fef3c7',
                                                                    color: '#d97706',
                                                                    fontSize: '11px',
                                                                    fontWeight: 600
                                                                }}
                                                            />
                                                        </Box>
                                                    </Box>
                                                );
                                            }

                                            // Still loading customers
                                            if (!selectedCustomer && loadingCustomers) {
                                                return (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
                                                        <CircularProgress size={20} />
                                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                            Loading customer information...
                                                        </Typography>
                                                    </Box>
                                                );
                                            }

                                            // Customer found - show the card
                                            if (selectedCustomer) {
                                                return (
                                                    <Box>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                fontSize: '11px',
                                                                color: '#6b7280',
                                                                display: 'block',
                                                                mb: 1
                                                            }}
                                                        >
                                                            Assigned Customer
                                                        </Typography>
                                                        <Box sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 2,
                                                            p: 2,
                                                            border: '1px solid #e5e7eb',
                                                            borderRadius: 1,
                                                            bgcolor: '#f9fafb'
                                                        }}>
                                                            <Avatar
                                                                src={selectedCustomer.logo || selectedCustomer.companyLogo}
                                                                sx={{
                                                                    width: 40,
                                                                    height: 40,
                                                                    bgcolor: '#059669',
                                                                    fontSize: '14px',
                                                                    fontWeight: 600,
                                                                    border: '2px solid #e5e7eb'
                                                                }}
                                                            >
                                                                {!selectedCustomer.logo && !selectedCustomer.companyLogo &&
                                                                    (selectedCustomer.name || 'C').charAt(0).toUpperCase()
                                                                }
                                                            </Avatar>
                                                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                                                <Typography sx={{
                                                                    fontSize: '14px',
                                                                    fontWeight: 600,
                                                                    color: '#374151',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap'
                                                                }}>
                                                                    {selectedCustomer.name}
                                                                </Typography>
                                                                <Typography sx={{
                                                                    fontSize: '12px',
                                                                    color: '#6b7280',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap'
                                                                }}>
                                                                    Customer ID: {selectedCustomer.customerID || selectedCustomer.id}
                                                                </Typography>
                                                            </Box>
                                                            <Chip
                                                                label="Assigned"
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: '#dcfce7',
                                                                    color: '#16a34a',
                                                                    fontSize: '11px',
                                                                    fontWeight: 600
                                                                }}
                                                            />
                                                        </Box>
                                                    </Box>
                                                );
                                            }

                                            // Fallback if nothing works
                                            return (
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    Customer information not available
                                                </Typography>
                                            );
                                        })()
                                    ) : (
                                        // Create mode: Show dropdown for customer selection
                                        <FormControl fullWidth size="small">
                                            <InputLabel sx={{ fontSize: '12px' }}>
                                                Select Customer *
                                            </InputLabel>
                                            <Select
                                                value={selectedCustomerId}
                                                onChange={(e) => setSelectedCustomerId(e.target.value)}
                                                sx={{
                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                                }}
                                                disabled={loadingCustomers}
                                                required
                                                error={!!errors.selectedCustomerId}
                                            >
                                                {availableCustomers.map((customer) => (
                                                    <MenuItem
                                                        key={customer.id}
                                                        value={customer.customerID || customer.id}
                                                        sx={{ fontSize: '12px' }}
                                                    >
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                                            <Avatar
                                                                src={customer.logo || customer.companyLogo}
                                                                sx={{
                                                                    width: 24,
                                                                    height: 24,
                                                                    bgcolor: '#059669',
                                                                    fontSize: '11px',
                                                                    fontWeight: 600
                                                                }}
                                                            >
                                                                {!customer.logo && !customer.companyLogo &&
                                                                    (customer.name || 'C').charAt(0).toUpperCase()
                                                                }
                                                            </Avatar>
                                                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                    {customer.name}
                                                                </Typography>
                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                    {customer.customerID || customer.id}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            {errors.selectedCustomerId && (
                                                <Typography variant="caption" color="error" sx={{ fontSize: '11px', mt: 0.5 }}>
                                                    {errors.selectedCustomerId}
                                                </Typography>
                                            )}
                                        </FormControl>
                                    )}
                                </Grid>

                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Customer Details */}
                <Grid item xs={12}>
                    <Card sx={{ border: '1px solid #e2e8f0' }}>
                        <CardHeader
                            title={
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                    Customer Details
                                </Typography>
                            }
                            sx={{ pb: 1 }}
                        />
                        <CardContent sx={{ pt: 1 }}>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        label="Customer / Company Name"
                                        value={formData.companyName}
                                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                                        fullWidth
                                        required
                                        size="small"
                                        error={!!errors.companyName}
                                        helperText={errors.companyName}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Main Contact Person & Address */}
                <Grid item xs={12}>
                    <Card sx={{ border: '1px solid #e2e8f0' }}>
                        <CardHeader
                            title={
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                    Main Contact Person & Address
                                </Typography>
                            }
                            subtitle={
                                <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                    This contact information will also be used as the default shipping destination for this customer
                                </Typography>
                            }
                            sx={{ pb: 1 }}
                        />
                        <CardContent sx={{ pt: 1 }}>
                            <Grid container spacing={2}>
                                {/* Contact Information */}
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        label="First Name (Optional)"
                                        value={formData.firstName}
                                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                                        fullWidth
                                        size="small"
                                        error={!!errors.firstName}
                                        helperText={errors.firstName}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        label="Last Name (Optional)"
                                        value={formData.lastName}
                                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                                        fullWidth
                                        size="small"
                                        error={!!errors.lastName}
                                        helperText={errors.lastName}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        label="Email (Optional)"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                        fullWidth
                                        size="small"
                                        error={!!errors.email}
                                        helperText={errors.email}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <EmailIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                </InputAdornment>
                                            )
                                        }}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Grid container spacing={1}>
                                        <Grid item xs={8}>
                                            <TextField
                                                label="Phone (Optional)"
                                                value={formData.phone}
                                                onChange={(e) => handleInputChange('phone', e.target.value)}
                                                fullWidth
                                                size="small"
                                                error={!!errors.phone}
                                                helperText={errors.phone}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <PhoneIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                        </InputAdornment>
                                                    )
                                                }}
                                                sx={{
                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={4}>
                                            <TextField
                                                label="EXT"
                                                value={formData.phoneExt}
                                                onChange={(e) => handleInputChange('phoneExt', e.target.value)}
                                                fullWidth
                                                size="small"
                                                placeholder="Ext"
                                                sx={{
                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                }}
                                            />
                                        </Grid>
                                    </Grid>
                                </Grid>

                                {/* Address Search */}
                                <Grid item xs={12}>
                                    {googleApiLoaded && !isEditing ? (
                                        <Autocomplete
                                            options={addressSuggestions}
                                            getOptionLabel={(option) => option.description}
                                            onInputChange={(event, value) => {
                                                handleGooglePlaceSearch(value);
                                            }}
                                            onChange={(event, value) => {
                                                if (value) {
                                                    handlePlaceSelect(value);
                                                }
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Search Address or Business (Optional)"
                                                    placeholder="Start typing an address or business name..."
                                                    size="small"
                                                    InputProps={{
                                                        ...params.InputProps,
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                <SearchIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                            </InputAdornment>
                                                        ),
                                                        sx: { fontSize: '12px' }
                                                    }}
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' },
                                                        '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                    }}
                                                />
                                            )}
                                            renderOption={(props, option) => {
                                                const isBusiness = option.types?.includes('establishment');
                                                return (
                                                    <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                                        {isBusiness ? (
                                                            <BusinessIcon sx={{ mr: 1, fontSize: '16px', color: '#3b82f6' }} />
                                                        ) : (
                                                            <LocationIcon sx={{ mr: 1, fontSize: '16px', color: '#6b7280' }} />
                                                        )}
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                                {option.structured_formatting?.main_text}
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                                {option.structured_formatting?.secondary_text}
                                                            </Typography>
                                                            {isBusiness && (
                                                                <Typography variant="caption" sx={{
                                                                    color: '#3b82f6',
                                                                    fontSize: '10px',
                                                                    fontWeight: 500,
                                                                    ml: 1
                                                                }}>
                                                                    Business
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    </Box>
                                                );
                                            }}
                                            noOptionsText="No addresses or businesses found"
                                        />
                                    ) : (
                                        <Alert severity="info" sx={{ fontSize: '12px' }}>
                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                {isEditing ? 'Editing existing address information' : 'Enter address details manually below'}
                                            </Typography>
                                        </Alert>
                                    )}
                                </Grid>

                                {/* Manual Address Entry - Always Visible */}
                                <Grid item xs={12}>
                                    <TextField
                                        label="Street Address"
                                        value={formData.street}
                                        onChange={(e) => handleInputChange('street', e.target.value)}
                                        fullWidth
                                        required
                                        size="small"
                                        error={!!errors.street}
                                        helperText={errors.street}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        label="Street Address 2 (Optional)"
                                        value={formData.street2}
                                        onChange={(e) => handleInputChange('street2', e.target.value)}
                                        fullWidth
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        label="City"
                                        value={formData.city}
                                        onChange={(e) => handleInputChange('city', e.target.value)}
                                        fullWidth
                                        required
                                        size="small"
                                        error={!!errors.city}
                                        helperText={errors.city}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        label="State/Province"
                                        value={formData.state}
                                        onChange={(e) => handleInputChange('state', e.target.value)}
                                        fullWidth
                                        required
                                        size="small"
                                        error={!!errors.state}
                                        helperText={errors.state}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        label="Postal/Zip Code"
                                        value={formData.postalCode}
                                        onChange={(e) => handleInputChange('postalCode', e.target.value)}
                                        fullWidth
                                        required
                                        size="small"
                                        error={!!errors.postalCode}
                                        helperText={errors.postalCode}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        select
                                        label="Country"
                                        value={formData.country}
                                        onChange={(e) => handleInputChange('country', e.target.value)}
                                        fullWidth
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    >
                                        {countries.map((country) => (
                                            <MenuItem key={country.value} value={country.value} sx={{ fontSize: '12px' }}>
                                                {country.label}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        select
                                        label="Status"
                                        value={formData.status}
                                        onChange={(e) => handleInputChange('status', e.target.value)}
                                        fullWidth
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    >
                                        <MenuItem value="active" sx={{ fontSize: '12px' }}>Active</MenuItem>
                                        <MenuItem value="inactive" sx={{ fontSize: '12px' }}>Inactive</MenuItem>
                                    </TextField>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Additional Information */}
                <Grid item xs={12}>
                    <Card sx={{ border: '1px solid #e2e8f0' }}>
                        <CardHeader
                            title={
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                    Additional Information
                                </Typography>
                            }
                            sx={{ pb: 1 }}
                        />
                        <CardContent sx={{ pt: 1 }}>
                            <Grid container spacing={2}>
                                {/* Residential Address Toggle */}
                                <Grid item xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={formData.isResidential}
                                                onChange={(e) => handleInputChange('isResidential', e.target.checked)}
                                                size="small"
                                                color="primary"
                                            />
                                        }
                                        label={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    Residential Address
                                                </Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                    (Check if this is a home/residential delivery location)
                                                </Typography>
                                            </Box>
                                        }
                                        sx={{ mb: 1 }}
                                    />
                                </Grid>

                                <Grid item xs={12}>
                                    <TextField
                                        label="Special Instructions"
                                        value={formData.specialInstructions}
                                        onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                                        fullWidth
                                        multiline
                                        rows={3}
                                        size="small"
                                        placeholder="Any special delivery instructions, access codes, or notes..."
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' },
                                            '& .MuiInputBase-input::placeholder': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>

                                {/* Default Address Settings - Only show for customer addresses */}
                                {formData.addressClass === 'customer' && selectedCustomerId && (
                                    <Grid item xs={12}>
                                        <Box sx={{
                                            mt: 2,
                                            p: 2,
                                            border: '1px solid #e5e7eb',
                                            borderRadius: 1,
                                            bgcolor: '#f8fafc'
                                        }}>
                                            <Typography variant="subtitle2" sx={{
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                mb: 2,
                                                color: '#374151'
                                            }}>
                                                Default Address Settings
                                            </Typography>
                                            <Typography variant="body2" sx={{
                                                fontSize: '11px',
                                                color: '#6b7280',
                                                mb: 2
                                            }}>
                                                Setting as default will automatically populate this address when creating new shipments for this customer.
                                            </Typography>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} sm={6}>
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                checked={formData.isDefaultShipFrom}
                                                                onChange={(e) => handleInputChange('isDefaultShipFrom', e.target.checked)}
                                                                size="small"
                                                                sx={{
                                                                    '& .MuiSwitch-switchBase.Mui-checked': {
                                                                        color: '#059669',
                                                                    },
                                                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                                        backgroundColor: '#059669',
                                                                    },
                                                                }}
                                                            />
                                                        }
                                                        label="Set as Default Ship From"
                                                        sx={{
                                                            '& .MuiFormControlLabel-label': {
                                                                fontSize: '12px',
                                                                fontWeight: 500,
                                                                color: '#374151'
                                                            }
                                                        }}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={6}>
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                checked={formData.isDefaultShipTo}
                                                                onChange={(e) => handleInputChange('isDefaultShipTo', e.target.checked)}
                                                                size="small"
                                                                sx={{
                                                                    '& .MuiSwitch-switchBase.Mui-checked': {
                                                                        color: '#2563eb',
                                                                    },
                                                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                                        backgroundColor: '#2563eb',
                                                                    },
                                                                }}
                                                            />
                                                        }
                                                        label="Set as Default Ship To"
                                                        sx={{
                                                            '& .MuiFormControlLabel-label': {
                                                                fontSize: '12px',
                                                                fontWeight: 500,
                                                                color: '#374151'
                                                            }
                                                        }}
                                                    />
                                                </Grid>
                                            </Grid>
                                        </Box>
                                    </Grid>
                                )}

                                {/* Business Hours Section */}
                                <Grid item xs={12}>
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, mb: 1 }}>
                                            Business Hours (Optional)
                                        </Typography>

                                        {/* Toggle for custom hours */}
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={formData.useCustomHours}
                                                    onChange={(e) => handleToggleCustomHours(e.target.checked)}
                                                    size="small"
                                                />
                                            }
                                            label="Set different hours for each day"
                                            sx={{ mb: 2, '& .MuiFormControlLabel-label': { fontSize: '12px' } }}
                                        />

                                        {!formData.useCustomHours ? (
                                            // Default hours for all days
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} md={6}>
                                                    <TextField
                                                        select
                                                        label="Open Hours (All Days)"
                                                        value={formData.defaultHours.open}
                                                        onChange={(e) => handleHoursChange('default', 'open', e.target.value)}
                                                        fullWidth
                                                        size="small"
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <AccessTimeIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                                </InputAdornment>
                                                            )
                                                        }}
                                                        sx={{
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                        }}
                                                    >
                                                        <MenuItem value="" sx={{ fontSize: '12px' }}>Select opening time</MenuItem>
                                                        {timeOptions.map((time) => (
                                                            <MenuItem key={time.value} value={time.value} sx={{ fontSize: '12px' }}>
                                                                {time.label}
                                                            </MenuItem>
                                                        ))}
                                                    </TextField>
                                                </Grid>
                                                <Grid item xs={12} md={6}>
                                                    <TextField
                                                        select
                                                        label="Close Hours (All Days)"
                                                        value={formData.defaultHours.close}
                                                        onChange={(e) => handleHoursChange('default', 'close', e.target.value)}
                                                        fullWidth
                                                        size="small"
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <AccessTimeIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                                                </InputAdornment>
                                                            )
                                                        }}
                                                        sx={{
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                        }}
                                                    >
                                                        <MenuItem value="" sx={{ fontSize: '12px' }}>Select closing time</MenuItem>
                                                        {timeOptions.map((time) => (
                                                            <MenuItem key={time.value} value={time.value} sx={{ fontSize: '12px' }}>
                                                                {time.label}
                                                            </MenuItem>
                                                        ))}
                                                    </TextField>
                                                </Grid>
                                            </Grid>
                                        ) : (
                                            // Custom hours for each day
                                            <Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        Set specific hours for each day of the week
                                                    </Typography>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setExpandedDays(!expandedDays)}
                                                        sx={{ ml: 'auto' }}
                                                    >
                                                        {expandedDays ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                    </IconButton>
                                                </Box>

                                                <Collapse in={expandedDays}>
                                                    <Box sx={{ pl: 2 }}>
                                                        {daysOfWeek.map((day) => (
                                                            <Box key={day.key} sx={{ mb: 2 }}>
                                                                <Grid container spacing={2} alignItems="center">
                                                                    <Grid item xs={12} sm={3}>
                                                                        <Typography variant="body2" sx={{
                                                                            fontSize: '12px',
                                                                            fontWeight: 500,
                                                                            color: formData.customHours[day.key].closed ? '#9ca3af' : '#374151'
                                                                        }}>
                                                                            {day.label}
                                                                        </Typography>
                                                                    </Grid>
                                                                    <Grid item xs={12} sm={7}>
                                                                        <Grid container spacing={1}>
                                                                            <Grid item xs={6}>
                                                                                <TextField
                                                                                    select
                                                                                    label="Open"
                                                                                    value={formData.customHours[day.key].open}
                                                                                    onChange={(e) => handleHoursChange('custom', `${day.key}.open`, e.target.value)}
                                                                                    fullWidth
                                                                                    size="small"
                                                                                    disabled={formData.customHours[day.key].closed}
                                                                                    sx={{
                                                                                        '& .MuiInputBase-input': { fontSize: '11px' },
                                                                                        '& .MuiInputLabel-root': { fontSize: '11px' }
                                                                                    }}
                                                                                >
                                                                                    <MenuItem value="" sx={{ fontSize: '11px' }}>--:--</MenuItem>
                                                                                    {timeOptions.map((time) => (
                                                                                        <MenuItem key={time.value} value={time.value} sx={{ fontSize: '11px' }}>
                                                                                            {time.label}
                                                                                        </MenuItem>
                                                                                    ))}
                                                                                </TextField>
                                                                            </Grid>
                                                                            <Grid item xs={6}>
                                                                                <TextField
                                                                                    select
                                                                                    label="Close"
                                                                                    value={formData.customHours[day.key].close}
                                                                                    onChange={(e) => handleHoursChange('custom', `${day.key}.close`, e.target.value)}
                                                                                    fullWidth
                                                                                    size="small"
                                                                                    disabled={formData.customHours[day.key].closed}
                                                                                    sx={{
                                                                                        '& .MuiInputBase-input': { fontSize: '11px' },
                                                                                        '& .MuiInputLabel-root': { fontSize: '11px' }
                                                                                    }}
                                                                                >
                                                                                    <MenuItem value="" sx={{ fontSize: '11px' }}>--:--</MenuItem>
                                                                                    {timeOptions.map((time) => (
                                                                                        <MenuItem key={time.value} value={time.value} sx={{ fontSize: '11px' }}>
                                                                                            {time.label}
                                                                                        </MenuItem>
                                                                                    ))}
                                                                                </TextField>
                                                                            </Grid>
                                                                        </Grid>
                                                                    </Grid>
                                                                    <Grid item xs={12} sm={2}>
                                                                        <FormControlLabel
                                                                            control={
                                                                                <Switch
                                                                                    size="small"
                                                                                    checked={formData.customHours[day.key].closed}
                                                                                    onChange={(e) => handleHoursChange('custom', `${day.key}.closed`, e.target.checked)}
                                                                                />
                                                                            }
                                                                            label="Closed"
                                                                            sx={{
                                                                                '& .MuiFormControlLabel-label': {
                                                                                    fontSize: '11px',
                                                                                    color: formData.customHours[day.key].closed ? '#ef4444' : '#6b7280'
                                                                                }
                                                                            }}
                                                                        />
                                                                    </Grid>
                                                                </Grid>
                                                                {day.key !== 'sunday' && <Divider sx={{ mt: 2 }} />}
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                </Collapse>
                                            </Box>
                                        )}
                                    </Box>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default AddressForm; 