import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Grid,
    FormControlLabel,
    Switch,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Box,
    IconButton,
    CircularProgress,
    FormHelperText,
    Paper
} from '@mui/material';
import {
    Close as CloseIcon,
    Save as SaveIcon,
    LocationOn as LocationIcon
} from '@mui/icons-material';
import { isValidEmail } from '../../utils/validationUtils';

// State/Province data for different countries
const STATE_PROVINCE_DATA = {
    US: [
        { value: 'AL', label: 'Alabama' },
        { value: 'AK', label: 'Alaska' },
        { value: 'AZ', label: 'Arizona' },
        { value: 'AR', label: 'Arkansas' },
        { value: 'CA', label: 'California' },
        { value: 'CO', label: 'Colorado' },
        { value: 'CT', label: 'Connecticut' },
        { value: 'DE', label: 'Delaware' },
        { value: 'FL', label: 'Florida' },
        { value: 'GA', label: 'Georgia' },
        { value: 'HI', label: 'Hawaii' },
        { value: 'ID', label: 'Idaho' },
        { value: 'IL', label: 'Illinois' },
        { value: 'IN', label: 'Indiana' },
        { value: 'IA', label: 'Iowa' },
        { value: 'KS', label: 'Kansas' },
        { value: 'KY', label: 'Kentucky' },
        { value: 'LA', label: 'Louisiana' },
        { value: 'ME', label: 'Maine' },
        { value: 'MD', label: 'Maryland' },
        { value: 'MA', label: 'Massachusetts' },
        { value: 'MI', label: 'Michigan' },
        { value: 'MN', label: 'Minnesota' },
        { value: 'MS', label: 'Mississippi' },
        { value: 'MO', label: 'Missouri' },
        { value: 'MT', label: 'Montana' },
        { value: 'NE', label: 'Nebraska' },
        { value: 'NV', label: 'Nevada' },
        { value: 'NH', label: 'New Hampshire' },
        { value: 'NJ', label: 'New Jersey' },
        { value: 'NM', label: 'New Mexico' },
        { value: 'NY', label: 'New York' },
        { value: 'NC', label: 'North Carolina' },
        { value: 'ND', label: 'North Dakota' },
        { value: 'OH', label: 'Ohio' },
        { value: 'OK', label: 'Oklahoma' },
        { value: 'OR', label: 'Oregon' },
        { value: 'PA', label: 'Pennsylvania' },
        { value: 'RI', label: 'Rhode Island' },
        { value: 'SC', label: 'South Carolina' },
        { value: 'SD', label: 'South Dakota' },
        { value: 'TN', label: 'Tennessee' },
        { value: 'TX', label: 'Texas' },
        { value: 'UT', label: 'Utah' },
        { value: 'VT', label: 'Vermont' },
        { value: 'VA', label: 'Virginia' },
        { value: 'WA', label: 'Washington' },
        { value: 'WV', label: 'West Virginia' },
        { value: 'WI', label: 'Wisconsin' },
        { value: 'WY', label: 'Wyoming' },
        { value: 'DC', label: 'District of Columbia' }
    ],
    CA: [
        { value: 'AB', label: 'Alberta' },
        { value: 'BC', label: 'British Columbia' },
        { value: 'MB', label: 'Manitoba' },
        { value: 'NB', label: 'New Brunswick' },
        { value: 'NL', label: 'Newfoundland and Labrador' },
        { value: 'NS', label: 'Nova Scotia' },
        { value: 'ON', label: 'Ontario' },
        { value: 'PE', label: 'Prince Edward Island' },
        { value: 'QC', label: 'Quebec' },
        { value: 'SK', label: 'Saskatchewan' },
        { value: 'NT', label: 'Northwest Territories' },
        { value: 'NU', label: 'Nunavut' },
        { value: 'YT', label: 'Yukon' }
    ],
    MX: [
        { value: 'AGU', label: 'Aguascalientes' },
        { value: 'BCN', label: 'Baja California' },
        { value: 'BCS', label: 'Baja California Sur' },
        { value: 'CAM', label: 'Campeche' },
        { value: 'CHP', label: 'Chiapas' },
        { value: 'CHH', label: 'Chihuahua' },
        { value: 'COA', label: 'Coahuila' },
        { value: 'COL', label: 'Colima' },
        { value: 'DUR', label: 'Durango' },
        { value: 'GUA', label: 'Guanajuato' },
        { value: 'GRO', label: 'Guerrero' },
        { value: 'HID', label: 'Hidalgo' },
        { value: 'JAL', label: 'Jalisco' },
        { value: 'MEX', label: 'Mexico' },
        { value: 'MIC', label: 'Michoacán' },
        { value: 'MOR', label: 'Morelos' },
        { value: 'NAY', label: 'Nayarit' },
        { value: 'NLE', label: 'Nuevo León' },
        { value: 'OAX', label: 'Oaxaca' },
        { value: 'PUE', label: 'Puebla' },
        { value: 'QUE', label: 'Querétaro' },
        { value: 'ROO', label: 'Quintana Roo' },
        { value: 'SLP', label: 'San Luis Potosí' },
        { value: 'SIN', label: 'Sinaloa' },
        { value: 'SON', label: 'Sonora' },
        { value: 'TAB', label: 'Tabasco' },
        { value: 'TAM', label: 'Tamaulipas' },
        { value: 'TLA', label: 'Tlaxcala' },
        { value: 'VER', label: 'Veracruz' },
        { value: 'YUC', label: 'Yucatán' },
        { value: 'ZAC', label: 'Zacatecas' },
        { value: 'CMX', label: 'Ciudad de México' }
    ]
};

const DestinationAddressDialog = ({
    open,
    onClose,
    addressData,
    onSave,
    customerID,
    customerCompanyName = ''
}) => {
    const initialFormState = {
        nickname: '',
        companyName: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address1: '',
        address2: '',
        city: '',
        stateProv: '',
        zipPostal: '',
        country: 'US',
        isDefault: false,
        specialInstructions: '',
    };

    const [formState, setFormState] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        console.log("DestinationAddressDialog: useEffect triggered. addressData prop is:", addressData ? JSON.parse(JSON.stringify(addressData)) : addressData, "Open prop is:", open);

        if (open && addressData && addressData.id) {
            // Editing existing address
            console.log("DestinationAddressDialog: Populating form for EDIT with addressData.id:", addressData.id);
            setFormState({
                nickname: addressData.nickname || addressData.name || '',
                companyName: addressData.companyName || addressData.company || customerCompanyName || '',
                firstName: addressData.firstName || '',
                lastName: addressData.lastName || '',
                email: addressData.email || '',
                phone: addressData.phone || '',
                address1: addressData.address1 || addressData.street || '',
                address2: addressData.address2 || addressData.street2 || '',
                city: addressData.city || '',
                stateProv: addressData.stateProv || addressData.state || '',
                zipPostal: addressData.zipPostal || addressData.postalCode || '',
                country: addressData.country || addressData.countryCode || 'US',
                isDefault: addressData.isDefault || addressData.isDefaultShipping || false,
                specialInstructions: addressData.specialInstructions || '',
                id: addressData.id
            });
        } else if (open) {
            // Adding new address or prefilling
            console.log("DestinationAddressDialog: Open, but no ID on addressData. Resetting/prefilling.");
            const initialStateToUse = addressData ?
                {
                    ...initialFormState,
                    ...addressData,
                    companyName: addressData.companyName || customerCompanyName || '',
                    id: null
                } :
                {
                    ...initialFormState,
                    companyName: customerCompanyName || ''
                };
            setFormState(initialStateToUse);
        }

        // Clear errors when dialog opens
        if (open) {
            setErrors({});
            setSaving(false);
        }
    }, [addressData, open, customerCompanyName]);

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        const newValue = type === 'checkbox' ? checked : value;

        setFormState(prev => {
            const newState = {
                ...prev,
                [name]: newValue
            };

            // Clear state/province when country changes
            if (name === 'country' && value !== prev.country) {
                newState.stateProv = '';
            }

            return newState;
        });

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: null
            }));
        }
    };

    const handleToggleChange = (event) => {
        const { name, checked } = event.target;
        setFormState(prev => ({
            ...prev,
            [name]: checked
        }));
    };

    const validateForm = () => {
        const newErrors = {};

        // Optional field validation for nickname - no requirement

        if (!formState.address1?.trim()) {
            newErrors.address1 = 'Address Line 1 is required';
        }

        if (!formState.city?.trim()) {
            newErrors.city = 'City is required';
        }

        if (!formState.stateProv?.trim()) {
            newErrors.stateProv = 'State/Province is required';
        }

        if (!formState.zipPostal?.trim()) {
            newErrors.zipPostal = 'Zip/Postal Code is required';
        }

        if (!formState.country?.trim()) {
            newErrors.country = 'Country is required';
        }

        // Email validation (if provided)
        if (formState.email?.trim() && !isValidEmail(formState.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        // Phone validation (basic)
        if (formState.phone?.trim() && formState.phone.length < 10) {
            newErrors.phone = 'Please enter a valid phone number';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        if (!customerID) {
            setErrors({ general: 'Customer ID is missing. Cannot save address.' });
            return;
        }

        setSaving(true);
        try {
            // Prepare data for saving
            const addressDataToSave = {
                ...formState,
                // Ensure consistent field mapping - default to "Delivery Location" if empty
                nickname: formState.nickname?.trim() || 'Delivery Location',
                companyName: formState.companyName?.trim(),
                firstName: formState.firstName?.trim(),
                lastName: formState.lastName?.trim(),
                email: formState.email?.trim(),
                phone: formState.phone?.trim(),
                address1: formState.address1?.trim(),
                address2: formState.address2?.trim(),
                city: formState.city?.trim(),
                stateProv: formState.stateProv?.trim(),
                zipPostal: formState.zipPostal?.trim(),
                country: formState.country?.trim(),
                specialInstructions: formState.specialInstructions?.trim(),
                // Additional fields for database consistency
                addressClass: 'customer',
                addressClassID: customerID,
                addressType: 'destination',
                // Map to alternative field names for compatibility
                name: formState.nickname?.trim() || 'Delivery Location',
                company: formState.companyName?.trim(),
                street: formState.address1?.trim(),
                street2: formState.address2?.trim(),
                state: formState.stateProv?.trim(),
                postalCode: formState.zipPostal?.trim(),
                countryCode: formState.country?.trim(),
                isDefaultShipping: formState.isDefault
            };

            await onSave(addressDataToSave);
            handleClose();
        } catch (error) {
            console.error('Error saving address:', error);
            setErrors({ general: 'Failed to save address. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        setFormState(initialFormState);
        setErrors({});
        setSaving(false);
        onClose();
    };

    const dialogTitle = formState.id ? 'Edit Destination Address' : 'Add New Destination Address';

    // Get available states/provinces for selected country
    const getAvailableStatesProvinces = () => {
        return STATE_PROVINCE_DATA[formState.country] || [];
    };

    // Get label for state/province field based on country
    const getStateProvinceLabel = () => {
        switch (formState.country) {
            case 'CA':
                return 'Province';
            case 'MX':
                return 'State';
            case 'US':
            default:
                return 'State';
        }
    };

    // Get label for postal code field based on country
    const getPostalCodeLabel = () => {
        switch (formState.country) {
            case 'CA':
                return 'Postal Code';
            case 'MX':
                return 'Código Postal';
            case 'US':
            default:
                return 'ZIP Code';
        }
    };

    return (
        <Dialog
            open={open}
            onClose={!saving ? handleClose : undefined}
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
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8f0',
                pb: 2
            }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocationIcon color="primary" />
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                            {dialogTitle}
                        </Typography>
                    </Box>
                    {customerCompanyName && (
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#64748b', ml: 3 }}>
                            for {customerCompanyName}
                        </Typography>
                    )}
                </Box>
                <IconButton
                    onClick={handleClose}
                    disabled={saving}
                    size="small"
                    sx={{
                        color: '#64748b',
                        '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 4 }}>
                {errors.general && (
                    <Paper sx={{
                        p: 2,
                        mb: 3,
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 1
                    }}>
                        <Typography sx={{ fontSize: '12px', color: '#dc2626' }}>
                            {errors.general}
                        </Typography>
                    </Paper>
                )}

                <Grid container spacing={2}>
                    {/* Address Identification */}
                    <Grid item xs={12}>
                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 1, mt: 2, color: '#374151' }}>
                            Address Information
                        </Typography>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Company Name (at destination)"
                            name="companyName"
                            value={formState.companyName}
                            onChange={handleChange}
                            error={!!errors.companyName}
                            helperText={errors.companyName}
                            fullWidth
                            disabled={saving}
                            size="small"
                            sx={{
                                '& .MuiInputBase-root': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Address Nickname"
                            name="nickname"
                            value={formState.nickname}
                            onChange={handleChange}
                            error={!!errors.nickname}
                            helperText={errors.nickname || 'e.g., Main Warehouse, East Office (optional)'}
                            fullWidth
                            disabled={saving}
                            size="small"
                            sx={{
                                '& .MuiInputBase-root': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    {/* Contact Information */}
                    <Grid item xs={12}>
                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 1, color: '#374151' }}>
                            Contact Information
                        </Typography>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Contact First Name"
                            name="firstName"
                            value={formState.firstName}
                            onChange={handleChange}
                            error={!!errors.firstName}
                            helperText={errors.firstName}
                            fullWidth
                            disabled={saving}
                            size="small"
                            sx={{
                                '& .MuiInputBase-root': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Contact Last Name"
                            name="lastName"
                            value={formState.lastName}
                            onChange={handleChange}
                            error={!!errors.lastName}
                            helperText={errors.lastName}
                            fullWidth
                            disabled={saving}
                            size="small"
                            sx={{
                                '& .MuiInputBase-root': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Contact Email"
                            name="email"
                            type="email"
                            value={formState.email}
                            onChange={handleChange}
                            error={!!errors.email}
                            helperText={errors.email}
                            fullWidth
                            disabled={saving}
                            size="small"
                            sx={{
                                '& .MuiInputBase-root': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Contact Phone"
                            name="phone"
                            value={formState.phone}
                            onChange={handleChange}
                            error={!!errors.phone}
                            helperText={errors.phone}
                            fullWidth
                            disabled={saving}
                            size="small"
                            sx={{
                                '& .MuiInputBase-root': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    {/* Physical Address */}
                    <Grid item xs={12}>
                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 1, mt: 1, color: '#374151' }}>
                            Physical Address
                        </Typography>
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            label="Address Line 1"
                            name="address1"
                            value={formState.address1}
                            onChange={handleChange}
                            error={!!errors.address1}
                            helperText={errors.address1}
                            fullWidth
                            required
                            disabled={saving}
                            size="small"
                            sx={{
                                '& .MuiInputBase-root': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            label="Address Line 2"
                            name="address2"
                            value={formState.address2}
                            onChange={handleChange}
                            error={!!errors.address2}
                            helperText={errors.address2 || 'Suite, apartment, floor, etc. (optional)'}
                            fullWidth
                            disabled={saving}
                            size="small"
                            sx={{
                                '& .MuiInputBase-root': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <FormControl
                            fullWidth
                            required
                            error={!!errors.country}
                            disabled={saving}
                            size="small"
                        >
                            <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                            <Select
                                name="country"
                                value={formState.country}
                                label="Country"
                                onChange={handleChange}
                                sx={{ fontSize: '12px' }}
                            >
                                <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                <MenuItem value="MX" sx={{ fontSize: '12px' }}>Mexico</MenuItem>
                            </Select>
                            {errors.country && (
                                <FormHelperText sx={{ fontSize: '11px' }}>
                                    {errors.country}
                                </FormHelperText>
                            )}
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            label="City"
                            name="city"
                            value={formState.city}
                            onChange={handleChange}
                            error={!!errors.city}
                            helperText={errors.city}
                            fullWidth
                            required
                            disabled={saving}
                            size="small"
                            sx={{
                                '& .MuiInputBase-root': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <FormControl
                            fullWidth
                            required
                            error={!!errors.stateProv}
                            disabled={saving}
                            size="small"
                        >
                            <InputLabel sx={{ fontSize: '12px' }}>{getStateProvinceLabel()}</InputLabel>
                            <Select
                                name="stateProv"
                                value={formState.stateProv}
                                label={getStateProvinceLabel()}
                                onChange={handleChange}
                                sx={{ fontSize: '12px' }}
                            >
                                {getAvailableStatesProvinces().map((stateProvince) => (
                                    <MenuItem key={stateProvince.value} value={stateProvince.value} sx={{ fontSize: '12px' }}>
                                        {stateProvince.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            {errors.stateProv && (
                                <FormHelperText sx={{ fontSize: '11px' }}>
                                    {errors.stateProv}
                                </FormHelperText>
                            )}
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            label={getPostalCodeLabel()}
                            name="zipPostal"
                            value={formState.zipPostal}
                            onChange={handleChange}
                            error={!!errors.zipPostal}
                            helperText={errors.zipPostal}
                            fullWidth
                            required
                            disabled={saving}
                            size="small"
                            sx={{
                                '& .MuiInputBase-root': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    {/* Special Instructions */}
                    <Grid item xs={12}>
                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 1, mt: 1, color: '#374151' }}>
                            Special Instructions
                        </Typography>
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            label="Special Instructions"
                            name="specialInstructions"
                            value={formState.specialInstructions}
                            onChange={handleChange}
                            error={!!errors.specialInstructions}
                            helperText={errors.specialInstructions || 'Delivery instructions, gate codes, etc.'}
                            fullWidth
                            multiline
                            rows={3}
                            disabled={saving}
                            size="small"
                            sx={{
                                '& .MuiInputBase-root': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                            }}
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            p: 2,
                            border: '1px solid #e2e8f0',
                            borderRadius: 1,
                            backgroundColor: '#f8fafc'
                        }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 500, flex: 1 }}>
                                Set as default destination address
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formState.isDefault}
                                        onChange={handleToggleChange}
                                        name="isDefault"
                                        disabled={saving}
                                        size="small"
                                        sx={{
                                            '& .MuiSwitch-switchBase.Mui-checked': {
                                                color: '#3b82f6',
                                            },
                                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                backgroundColor: '#3b82f6',
                                            },
                                        }}
                                    />
                                }
                                label=""
                                sx={{ margin: 0 }}
                            />
                        </Box>
                    </Grid>
                </Grid>
            </DialogContent>

            <DialogActions sx={{
                borderTop: '1px solid #e2e8f0',
                px: 3,
                py: 2,
                gap: 1
            }}>
                <Button
                    onClick={handleClose}
                    disabled={saving}
                    size="small"
                    sx={{
                        fontSize: '12px',
                        textTransform: 'none',
                        color: '#64748b'
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                    size="small"
                    sx={{
                        fontSize: '12px',
                        textTransform: 'none',
                        minWidth: '100px'
                    }}
                >
                    {saving ? 'Saving...' : 'Save Address'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DestinationAddressDialog; 