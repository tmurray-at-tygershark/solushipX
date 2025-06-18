import React, { useState, useEffect, useRef } from 'react';
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
    Collapse
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
    Info as InfoIcon
} from '@mui/icons-material';
import { doc, setDoc, getDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';

const AddressForm = ({ addressId = null, onCancel, onSuccess, isModal = false }) => {
    const { companyIdForAddress } = useCompany();
    const { currentUser } = useAuth();

    // Form state
    const [formData, setFormData] = useState({
        companyName: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        street: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        specialInstructions: '',
        openHours: '',
        closeHours: '',
        status: 'active'
    });

    // UI state
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [useGoogleAutocomplete, setUseGoogleAutocomplete] = useState(true);
    const [isValidated, setIsValidated] = useState(false);
    const [googleApiLoaded, setGoogleApiLoaded] = useState(false);
    const [showManualEntry, setShowManualEntry] = useState(false);

    // Google autocomplete state
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const autocompleteService = useRef(null);
    const placesService = useRef(null);

    const isEditing = !!addressId;

    useEffect(() => {
        initializeGoogleMaps();
        if (isEditing) {
            loadAddressData();
        }
    }, [addressId, isEditing]);

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
                setFormData({
                    companyName: data.companyName || '',
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    street: data.street || '',
                    street2: data.street2 || '',
                    city: data.city || '',
                    state: data.state || '',
                    postalCode: data.postalCode || '',
                    country: data.country || 'US',
                    specialInstructions: data.specialInstructions || '',
                    openHours: data.openHours || '',
                    closeHours: data.closeHours || '',
                    status: data.status || 'active'
                });

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

    const handleGooglePlaceSearch = (searchText) => {
        if (!autocompleteService.current || !searchText.trim()) {
            setAddressSuggestions([]);
            return;
        }

        const request = {
            input: searchText,
            types: ['address'],
            componentRestrictions: { country: formData.country === 'US' ? 'us' : 'ca' }
        };

        autocompleteService.current.getPlacePredictions(request, (predictions, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                setAddressSuggestions(predictions.map(prediction => ({
                    id: prediction.place_id,
                    description: prediction.description,
                    structured_formatting: prediction.structured_formatting
                })));
            } else {
                setAddressSuggestions([]);
            }
        });
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

                setFormData(prev => ({
                    ...prev,
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
        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required';
        }
        if (!formData.lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        }
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }
        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required';
        }
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
            const addressData = {
                ...formData,
                companyID: companyIdForAddress,
                createdBy: currentUser?.uid || 'system',
                updatedAt: Timestamp.now(),
                ...(isEditing ? {} : { createdAt: Timestamp.now() })
            };

            let docRef;
            if (isEditing) {
                docRef = doc(db, 'addressBook', addressId);
                await setDoc(docRef, addressData, { merge: true });
            } else {
                // For new addresses, use addDoc to auto-generate ID
                docRef = await addDoc(collection(db, 'addressBook'), addressData);
            }

            console.log(`Address ${isEditing ? 'updated' : 'created'} successfully`);
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
                {/* Customer Details */}
                <Grid item xs={12}>
                    <Card sx={{ border: '1px solid #e2e8f0' }}>
                        <CardHeader
                            title={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <BusinessIcon sx={{ color: '#6b7280' }} />
                                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        Customer Details
                                    </Typography>
                                </Box>
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
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PersonIcon sx={{ color: '#6b7280' }} />
                                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        Main Contact Person & Address
                                    </Typography>
                                </Box>
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
                                        label="First Name"
                                        value={formData.firstName}
                                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                                        fullWidth
                                        required
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
                                        label="Last Name"
                                        value={formData.lastName}
                                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                                        fullWidth
                                        required
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
                                        label="Email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                        fullWidth
                                        required
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
                                    <TextField
                                        label="Phone"
                                        value={formData.phone}
                                        onChange={(e) => handleInputChange('phone', e.target.value)}
                                        fullWidth
                                        required
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

                                {/* Address Search and Manual Entry Toggle */}
                                <Grid item xs={12}>
                                    {googleApiLoaded && !isEditing ? (
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                            <Autocomplete
                                                sx={{ flex: 1 }}
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
                                                        label="Search Address"
                                                        placeholder="Start typing an address..."
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
                                                renderOption={(props, option) => (
                                                    <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                                        <LocationIcon sx={{ mr: 1, fontSize: '16px', color: '#6b7280' }} />
                                                        <Box>
                                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                                {option.structured_formatting?.main_text}
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                                {option.structured_formatting?.secondary_text}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                )}
                                                noOptionsText="No addresses found"
                                            />
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={() => setShowManualEntry(!showManualEntry)}
                                                sx={{
                                                    fontSize: '12px',
                                                    minWidth: 'auto',
                                                    px: 2
                                                }}
                                            >
                                                {showManualEntry ? 'Hide Manual' : 'Manual Entry'}
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Alert severity="info" sx={{ fontSize: '12px' }}>
                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                {isEditing ? 'Editing existing address information' : 'Enter address details manually below'}
                                            </Typography>
                                        </Alert>
                                    )}
                                </Grid>

                                {/* Manual Address Entry - Collapsible */}
                                {(!googleApiLoaded || showManualEntry || isEditing) && (
                                    <>
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
                                    </>
                                )}
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Additional Information */}
                <Grid item xs={12}>
                    <Card sx={{ border: '1px solid #e2e8f0' }}>
                        <CardHeader
                            title={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <InfoIcon sx={{ color: '#6b7280' }} />
                                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        Additional Information
                                    </Typography>
                                </Box>
                            }
                            sx={{ pb: 1 }}
                        />
                        <CardContent sx={{ pt: 1 }}>
                            <Grid container spacing={2}>
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
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        select
                                        label="Open Hours"
                                        value={formData.openHours}
                                        onChange={(e) => handleInputChange('openHours', e.target.value)}
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
                                        label="Close Hours"
                                        value={formData.closeHours}
                                        onChange={(e) => handleInputChange('closeHours', e.target.value)}
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
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>


        </Box>
    );
};

export default AddressForm; 