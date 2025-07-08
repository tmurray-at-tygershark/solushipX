import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Typography,
    Alert,
    Box,
    Paper,
    Chip,
    FormHelperText,
    InputAdornment
} from '@mui/material';
import {
    LocalShipping as LocalShippingIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';

const markupTypes = [
    {
        value: 'PERCENTAGE',
        label: 'Percentage Markup',
        description: 'Percentage markup applied to carrier base rate',
        example: '15% markup on all rates'
    },
    {
        value: 'FIXED_AMOUNT',
        label: 'Fixed Amount',
        description: 'Fixed dollar amount added to each shipment',
        example: '$25.00 per shipment'
    },
    {
        value: 'PER_POUND',
        label: 'Per Pound/Kg',
        description: 'Fixed amount per pound or kilogram',
        example: '$0.50 per pound'
    },
    {
        value: 'PER_PACKAGE',
        label: 'Per Package',
        description: 'Fixed amount per package in shipment',
        example: '$5.00 per package'
    }
];

const AddEditCarrierMarkupDialog = ({
    open,
    onClose,
    onSave,
    initialData,
    carriersList = []
}) => {
    const [formData, setFormData] = useState({
        carrierId: '',
        service: 'ANY',
        type: 'PERCENTAGE',
        value: 0,
        description: '',
        effectiveDate: dayjs(),
        expiryDate: null,
        id: null
    });

    const [loading, setLoading] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});
    const [serviceTypes, setServiceTypes] = useState([]);
    const [loadingServiceTypes, setLoadingServiceTypes] = useState(false);

    // Load service types from Firebase
    const loadServiceTypes = async () => {
        try {
            setLoadingServiceTypes(true);

            // Load both courier and freight service levels
            const serviceLevelsRef = collection(db, 'serviceLevels');
            const q = query(
                serviceLevelsRef,
                where('enabled', '==', true),
                orderBy('type'),
                orderBy('sortOrder'),
                orderBy('label')
            );
            const querySnapshot = await getDocs(q);

            const services = [
                { value: 'ANY', label: 'Any Service', description: 'Applies to all service levels for this carrier' }
            ];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                services.push({
                    value: data.code,
                    label: data.label,
                    description: data.description || `${data.type} service level`,
                    type: data.type
                });
            });

            console.log('🔧 Loaded service types from database:', services);
            setServiceTypes(services);
        } catch (error) {
            console.error('🔧 Error loading service types:', error);
            // Fallback to ANY option if loading fails
            setServiceTypes([
                { value: 'ANY', label: 'Any Service', description: 'Applies to all service levels for this carrier' }
            ]);
        } finally {
            setLoadingServiceTypes(false);
        }
    };

    // Load service types when component opens
    useEffect(() => {
        if (open) {
            loadServiceTypes();
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            if (initialData) {
                setFormData({
                    carrierId: initialData.carrierId || '',
                    service: initialData.service || 'ANY',
                    type: initialData.type || 'PERCENTAGE',
                    value: initialData.value || 0,
                    description: initialData.description || '',
                    effectiveDate: initialData.effectiveDate ? dayjs(initialData.effectiveDate) : dayjs(),
                    expiryDate: initialData.expiryDate ? dayjs(initialData.expiryDate) : null,
                    id: initialData.id || null
                });
            } else {
                setFormData({
                    carrierId: carriersList.length > 0 ? carriersList[0].id : '',
                    service: 'ANY',
                    type: 'PERCENTAGE',
                    value: 0,
                    description: '',
                    effectiveDate: dayjs(),
                    expiryDate: null,
                    id: null
                });
            }
            setValidationErrors({});
        }
    }, [initialData, open, carriersList]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear validation error when user starts typing
        if (validationErrors[name]) {
            setValidationErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const handleDateChange = (name, date) => {
        setFormData(prev => ({ ...prev, [name]: date }));
    };

    const validateForm = () => {
        const errors = {};

        // Required field validation
        if (!formData.carrierId) {
            errors.carrierId = 'Carrier is required';
        }

        if (!formData.type) {
            errors.type = 'Markup type is required';
        }

        if (!formData.value || formData.value <= 0) {
            errors.value = 'Value must be greater than 0';
        }

        if (formData.type === 'PERCENTAGE' && formData.value > 100) {
            errors.value = 'Percentage cannot exceed 100%';
        }

        // Date validation
        if (formData.expiryDate && formData.effectiveDate && formData.expiryDate.isBefore(formData.effectiveDate)) {
            errors.expiryDate = 'Expiry date must be after effective date';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        setLoading(true);

        const selectedCarrier = carriersList.find(c => c.id === formData.carrierId);

        const saveData = {
            ...formData,
            carrierName: selectedCarrier?.name || formData.carrierId,
            effectiveDate: formData.effectiveDate ? formData.effectiveDate.toISOString() : null,
            expiryDate: formData.expiryDate ? formData.expiryDate.toISOString() : null,
            value: parseFloat(formData.value) || 0,
        };

        await onSave(saveData);
        setLoading(false);
        onClose();
    };

    const getSelectedMarkupType = () => {
        return markupTypes.find(type => type.value === formData.type) || markupTypes[0];
    };

    const getSelectedService = () => {
        return serviceTypes.find(service => service.value === formData.service) || serviceTypes[0];
    };

    const dialogTitle = formData.id ? 'Edit Carrier Markup' : 'Add New Carrier Markup';

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
                <DialogTitle sx={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    pb: 2
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocalShippingIcon sx={{ color: '#22c55e' }} />
                        {dialogTitle}
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ p: 0 }}>
                    {/* Preview Card */}
                    <Paper sx={{ m: 3, p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <LocalShippingIcon sx={{ fontSize: '24px', color: '#22c55e' }} />
                            <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                    {formData.carrierId ? carriersList.find(c => c.id === formData.carrierId)?.name || 'Select Carrier' : 'Select Carrier'}
                                    {formData.service && formData.service !== 'ANY' && ` - ${formData.service}`}
                                </Typography>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    {getSelectedMarkupType().description}
                                </Typography>
                                <Typography sx={{ fontSize: '11px', color: '#059669', fontWeight: 500 }}>
                                    Example: {getSelectedMarkupType().example}
                                </Typography>
                            </Box>
                            {formData.value > 0 && (
                                <Chip
                                    label={`${formData.value}${formData.type === 'PERCENTAGE' ? '%' : ''} markup`}
                                    sx={{
                                        bgcolor: '#22c55e',
                                        color: 'white',
                                        fontWeight: 600,
                                        fontSize: '12px'
                                    }}
                                />
                            )}
                        </Box>
                    </Paper>

                    {/* Form Content */}
                    <Box sx={{ px: 3, pb: 3 }}>
                        <Grid container spacing={3}>
                            {/* Basic Configuration */}
                            <Grid item xs={12}>
                                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                    Basic Configuration
                                </Typography>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth required error={!!validationErrors.carrierId}>
                                    <InputLabel sx={{ fontSize: '12px' }}>Carrier</InputLabel>
                                    <Select
                                        name="carrierId"
                                        value={formData.carrierId}
                                        label="Carrier"
                                        onChange={handleChange}
                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                    >
                                        {carriersList.map(carrier => (
                                            <MenuItem key={carrier.id} value={carrier.id} sx={{ fontSize: '12px' }}>
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                        {carrier.name}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        ID: {carrier.id}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {validationErrors.carrierId && (
                                        <FormHelperText>{validationErrors.carrierId}</FormHelperText>
                                    )}
                                    <FormHelperText sx={{ fontSize: '11px' }}>
                                        Which carrier this markup applies to
                                    </FormHelperText>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                    <InputLabel sx={{ fontSize: '12px' }}>Service Level</InputLabel>
                                    <Select
                                        name="service"
                                        value={formData.service}
                                        label="Service Level"
                                        onChange={handleChange}
                                        disabled={loadingServiceTypes}
                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        endAdornment={
                                            loadingServiceTypes && (
                                                <InputAdornment position="end">
                                                    <CircularProgress size={20} sx={{ mr: 2 }} />
                                                </InputAdornment>
                                            )
                                        }
                                    >
                                        {loadingServiceTypes ? (
                                            <MenuItem disabled sx={{ fontSize: '12px' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <CircularProgress size={16} />
                                                    <Typography sx={{ fontSize: '12px' }}>Loading service levels...</Typography>
                                                </Box>
                                            </MenuItem>
                                        ) : (
                                            serviceTypes.map(service => (
                                                <MenuItem key={service.value} value={service.value} sx={{ fontSize: '12px' }}>
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                            {service.label}
                                                            {service.type && service.value !== 'ANY' && (
                                                                <Chip
                                                                    label={service.type}
                                                                    size="small"
                                                                    sx={{
                                                                        ml: 1,
                                                                        height: '16px',
                                                                        fontSize: '9px',
                                                                        bgcolor: service.type === 'courier' ? '#e3f2fd' : '#f3e5f5',
                                                                        color: service.type === 'courier' ? '#1976d2' : '#7b1fa2'
                                                                    }}
                                                                />
                                                            )}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                            {service.description}
                                                        </Typography>
                                                    </Box>
                                                </MenuItem>
                                            ))
                                        )}
                                    </Select>
                                    <FormHelperText sx={{ fontSize: '11px' }}>
                                        {loadingServiceTypes ? 'Loading service levels from database...' : 'Specific service or "Any" for all services'}
                                    </FormHelperText>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth required error={!!validationErrors.type}>
                                    <InputLabel sx={{ fontSize: '12px' }}>Markup Type</InputLabel>
                                    <Select
                                        name="type"
                                        value={formData.type}
                                        label="Markup Type"
                                        onChange={handleChange}
                                        sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                    >
                                        {markupTypes.map(type => (
                                            <MenuItem key={type.value} value={type.value} sx={{ fontSize: '12px' }}>
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                        {type.label}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        {type.description}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {validationErrors.type && (
                                        <FormHelperText>{validationErrors.type}</FormHelperText>
                                    )}
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <TextField
                                    label="Markup Value"
                                    name="value"
                                    type="number"
                                    value={formData.value}
                                    onChange={handleChange}
                                    fullWidth
                                    required
                                    error={!!validationErrors.value}
                                    helperText={validationErrors.value}
                                    InputProps={{
                                        sx: { fontSize: '12px' },
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {formData.type === 'PERCENTAGE' ? '%' : '$'}
                                                </Typography>
                                            </InputAdornment>
                                        )
                                    }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <TextField
                                    label="Description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    fullWidth
                                    multiline
                                    rows={2}
                                    placeholder="Brief description of this markup rule (e.g., Premium service markup for expedited delivery)"
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    helperText="Optional description to explain the purpose of this markup"
                                />
                            </Grid>

                            {/* Timing Configuration */}
                            <Grid item xs={12}>
                                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 2, mt: 2 }}>
                                    Timing Configuration
                                </Typography>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <DatePicker
                                    label="Effective Date"
                                    value={formData.effectiveDate}
                                    onChange={(date) => handleDateChange('effectiveDate', date)}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            required: true,
                                            InputLabelProps: { sx: { fontSize: '12px' } },
                                            InputProps: { sx: { fontSize: '12px' } }
                                        }
                                    }}
                                />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <DatePicker
                                    label="Expiry Date (Optional)"
                                    value={formData.expiryDate}
                                    onChange={(date) => handleDateChange('expiryDate', date)}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            error: !!validationErrors.expiryDate,
                                            helperText: validationErrors.expiryDate || "Leave empty for no expiry",
                                            InputLabelProps: { sx: { fontSize: '12px' } },
                                            InputProps: { sx: { fontSize: '12px' } }
                                        }
                                    }}
                                />
                            </Grid>
                        </Grid>

                        {/* Information Alert */}
                        <Alert severity="info" sx={{ mt: 3, fontSize: '12px' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <InfoIcon sx={{ fontSize: '16px' }} />
                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                    Global Carrier & Service Markups
                                </Typography>
                            </Box>
                            <Typography sx={{ fontSize: '11px', mt: 1 }}>
                                These markups apply globally to all shipments using the specified carrier and service combination.
                                They work alongside company-specific markups and will be applied according to the markup hierarchy.
                                Use this for carrier-specific pricing strategies (e.g., all Canpar Expedited shipments get 15% markup).
                            </Typography>
                        </Alert>
                    </Box>
                </DialogContent>

                <DialogActions sx={{ p: 3, borderTop: '1px solid #e5e7eb' }}>
                    <Button
                        onClick={onClose}
                        disabled={loading}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        disabled={loading}
                        sx={{ fontSize: '12px', minWidth: 120 }}
                    >
                        {loading ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CircularProgress size={16} color="inherit" />
                                Saving...
                            </Box>
                        ) : (
                            formData.id ? 'Update Markup' : 'Create Markup'
                        )}
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default AddEditCarrierMarkupDialog; 